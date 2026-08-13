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
}

type PageStatus = "checking" | "success" | "failure" | "pending" | "notfound";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ref = searchParams.get("ref");
  const [status, setStatus] = useState<PageStatus>("checking");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const raw = localStorage.getItem("mm_pending_order");
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
      trackPurchasePixel(pending.items, pending.totalPrice);
      trackPurchaseGA4(pending.items, pending.totalPrice);
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
        <div className="text-sm text-gray-500 mb-6">
          Дякуємо за замовлення. Ми вже готуємо його до відправки Новою Поштою.
        </div>
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
