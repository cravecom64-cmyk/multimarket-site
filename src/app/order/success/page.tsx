"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trackPurchase as trackPurchasePixel } from "@/lib/pixel";
import { trackPurchase as trackPurchaseGA4 } from "@/lib/ga4";

interface PendingOrder {
  orderId: string;
  gateway?: "monobank" | "wayforpay";
  invoiceId?: string; // тільки для monobank
  wfpRef?: string; // тільки для wayforpay — технічний orderReference з телефоном
  items: { id: string; name: string; price: number; quantity: number; category?: string }[];
  totalPrice: number;
  // Рішення Павла 12.11.2026 — чистої "наложки" без передоплати більше
  // нема; якщо isDeposit, залишок codRemainder клієнт платить при
  // отриманні на Новій Пошті, і про це треба сказати на цій сторінці.
  isDeposit?: boolean;
  codRemainder?: number;
}

type PageStatus = "checking" | "success" | "failure" | "pending" | "notfound" | "link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ref = searchParams.get("ref");
  const [status, setStatus] = useState<PageStatus>("checking");
  const [codRemainder, setCodRemainder] = useState<number | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const raw = localStorage.getItem("mm_pending_order");
    // Оплата за посиланням від менеджера (/pay/…, 28.11.2026): запису в
    // localStorage немає, оплату зараховує вебхук — просто дякуємо.
    if (!raw && searchParams.get("via") === "link") {
      setStatus("link");
      return;
    }
    if (!raw) {
      setStatus("notfound");
      return;
    }

    let pending: PendingOrder;
    try {
      pending = JSON.parse(raw);
    } catch {
      setStatus("notfound");
      return;
    }

    // Захист від чужого/старого запису в localStorage — звіряємо orderId з ?ref=
    if (ref && pending.orderId !== ref) {
      setStatus("notfound");
      return;
    }

    const markSuccess = () => {
      // Purchase шлемо саме тут — момент реальної оплати, а не
      // моменту заповнення форми (див. коментар у pixel.ts/ga4.ts).
      //
      // ДОДАНО 24.11.2026 (аудит сайту п.2): якщо людина закриє вкладку ДО
      // того, як долетить сюди, вебхук оплати (Monobank/WayForPay) сам
      // відправить цю ж Purchase-подію з сервера (src/lib/serverConversions.ts)
      // — тому тут атомарно "застовблюємо" право на GA4 (там немає
      // дедуплікації по event_id, на відміну від Meta): якщо вебхук уже
      // встиг це зробити раніше (типовий випадок — він зазвичай швидший за
      // повний редирект туди-назад через сторінку оплати), GA4 тут вдруге
      // не шлемо, щоб не задвоїти дохід. Pixel шлемо завжди — Meta сама
      // дедуплікує по eventID (той самий orderId, що й у серверній CAPI-події).
      trackPurchasePixel(pending.items, pending.totalPrice, pending.orderId);
      fetch("/api/track-purchase-confirmed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderRef: pending.orderId }),
      })
        .then((r) => r.json())
        .then((data: { claimed?: boolean }) => {
          if (data.claimed) trackPurchaseGA4(pending.items, pending.totalPrice, pending.orderId);
        })
        .catch(() => {
          // Мережева помилка — краще все одно порахувати GA4 (ризик рідкісного
          // задвоєння нижчий, ніж ризик зовсім загубити конверсію).
          trackPurchaseGA4(pending.items, pending.totalPrice, pending.orderId);
        });
      if (pending.isDeposit && pending.codRemainder) {
        setCodRemainder(pending.codRemainder);
      }
      localStorage.removeItem("mm_pending_order");
      setStatus("success");
    };

    // Окрема сторінка невдалої оплати (/order/failed) — свій URL, щоб
    // рахувати/ретаргетити невдалі оплати окремо від успішних (Pixel/GA4).
    const goToFailed = () => {
      router.replace(`/order/failed?ref=${encodeURIComponent(pending.orderId)}`);
    };

    if (pending.gateway === "wayforpay") {
      fetch(`/api/checkout/wayforpay/status?orderReference=${encodeURIComponent(pending.wfpRef || pending.orderId)}`)
        .then((r) => r.json())
        .then((data: { transactionStatus?: string }) => {
          if (data.transactionStatus === "Approved") {
            markSuccess();
          } else if (
            data.transactionStatus === "Declined" ||
            data.transactionStatus === "Expired" ||
            data.transactionStatus === "Refunded" ||
            data.transactionStatus === "Voided"
          ) {
            goToFailed();
          } else {
            // InProcessing / Pending — оплата ще обробляється
            setStatus("pending");
          }
        })
        .catch(() => goToFailed());
      return;
    }

    // За замовчуванням — monobank (стара форма localStorage без gateway теж сюди)
    fetch(`/api/checkout/monobank/status?invoiceId=${encodeURIComponent(pending.invoiceId || "")}`)
      .then((r) => r.json())
      .then((data: { status?: string }) => {
        if (data.status === "success") {
          markSuccess();
        } else if (data.status === "failure" || data.status === "reversed" || data.status === "expired") {
          goToFailed();
        } else {
          // created / processing / hold — оплата ще обробляється
          setStatus("pending");
        }
      })
      .catch(() => goToFailed());
  }, [ref, router]);

  if (status === "checking") {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">⏳</div>
        <div className="text-lg font-bold">Перевіряємо оплату...</div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <div className="text-xl font-extrabold mb-2">Оплата пройшла успішно!</div>
        <div className="text-sm text-gray-500 mb-2">
          Дякуємо за замовлення. Ми вже готуємо його до відправки Новою Поштою.
        </div>
        {codRemainder != null && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-6 inline-block">
            💰 Залишок <b>{codRemainder}₴</b> сплатиш при отриманні на Новій Пошті.
          </div>
        )}
        {codRemainder == null && <div className="mb-6" />}
        <Link href="/" className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold inline-block">
          На головну
        </Link>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🕐</div>
        <div className="text-xl font-extrabold mb-2">Оплата обробляється</div>
        <div className="text-sm text-gray-500 mb-6">
          Це займає лічені хвилини. Ми напишемо тобі, щойно платіж підтвердиться.
        </div>
        <Link href="/" className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold inline-block">
          На головну
        </Link>
      </div>
    );
  }

  if (status === "link") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <div className="text-xl font-extrabold mb-2">Дякуємо за оплату!</div>
        <div className="text-sm text-gray-500 mb-6">
          Щойно банк підтвердить платіж, ми отримаємо його автоматично і передамо замовлення на відправку.
        </div>
        <Link href="/" className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold inline-block">
          На головну
        </Link>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🤔</div>
        <div className="text-xl font-extrabold mb-2">Замовлення не знайдено</div>
        <div className="text-sm text-gray-500 mb-6">
          Схоже, ти вже оформив(-ла) це замовлення раніше або перейшов(-шла) за старим посиланням.
        </div>
        <Link href="/" className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold inline-block">
          На головну
        </Link>
      </div>
    );
  }

  // status === "failure" більше сюди не доходить — редіректимо на
  // /order/failed одразу, як тільки дізнаємось про відмову (goToFailed()).
  return null;
}

export default function OrderSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-center text-lg font-bold">Завантаження...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
