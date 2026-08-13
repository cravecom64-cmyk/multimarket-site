"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useCart } from "./CartProvider";
import { trackPurchase, trackInitiateCheckout } from "@/lib/pixel";
import {
  trackPurchase as trackPurchaseGA4,
  trackInitiateCheckout as trackInitiateCheckoutGA4,
} from "@/lib/ga4";

interface OrderModalProps {
  onClose: () => void;
}

type PaymentMethod = "card_mono" | "card_wfp" | "cod";

export function OrderModal({ onClose }: OrderModalProps) {
  const { items, totalPrice, clearCart } = useCart();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    branch: "",
    comment: "",
    website: "", // honeypot — hidden from users, bots fill it
  });

  // InitiateCheckout — момент відкриття форми оформлення (між AddToCart і
  // Purchase). Раніше функція була написана в pixel.ts, але ніде не
  // викликалась — Meta не бачила цей крок воронки взагалі.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    trackInitiateCheckout(
      items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        category: i.categoryName ?? i.category,
      })),
      totalPrice
    );
    trackInitiateCheckoutGA4(
      items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        category: i.categoryName ?? i.category,
      })),
      totalPrice
    );
  }, []);
  // Два онлайн-еквайринги (mono і WayForPay) + оплата при отриманні. mono —
  // пріоритетний варіант за замовчуванням (перевірений першим, надійніший
  // за досвідом). Назви без логотипів — за брендбуком monobank для сайтів
  // з кількома еквайрингами (monobank.ua/knowledge-base/acquiring/online/brandbook):
  // "назва без лого" — валідний варіант поряд з варіантом із лого.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card_mono");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const formLoadedAt = useRef(Date.now());

  // Серверні коди валідації → людське повідомлення українською. Раніше при
  // будь-якій 400-помилці (напр. закоротке поле) показувався загальний
  // "Щось пішло не так" — покупець не розумів що саме виправити.
  const VALIDATION_MESSAGES: Record<string, string> = {
    "Invalid name": "Перевір поле «Ім'я» — має бути мінімум 2 символи.",
    "Invalid phone number": "Перевір номер телефону — формат +380XXXXXXXXX.",
    "Invalid city": "Перевір поле «Місто» — має бути мінімум 2 символи.",
    "Invalid NP branch": "Вкажи відділення Нової Пошти детальніше (мінімум 3 символи, напр. «Відділення №5»).",
    "Invalid cart": "Кошик порожній або некоректний — онови сторінку і спробуй ще раз.",
    "Invalid cart item": "Один з товарів у кошику некоректний — онови сторінку і спробуй ще раз.",
    "Too many requests": "Забагато спроб поспіль — зачекай хвилину і спробуй ще раз.",
  };

  async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error && VALIDATION_MESSAGES[data.error]) {
        return VALIDATION_MESSAGES[data.error];
      }
    } catch {
      // не JSON — ігноруємо, повертаємо fallback
    }
    return fallback;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    // Спільний ID замовлення — йде і в Telegram-заявку, і в інвойс/платіж
    // конкретного еквайрингу (як reference), щоб продавець міг зіставити
    // заявку з оплатою за одним номером незалежно від того, який гейтвей
    // клієнт обрав.
    const orderId = `MM${Date.now().toString(36).toUpperCase()}`;

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          name: form.name,
          phone: form.phone,
          city: form.city,
          branch: form.branch,
          comment: form.comment,
          website: form.website,
          _t: formLoadedAt.current,
          paymentMethod,
          items: items.map((i) => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          totalPrice,
        }),
      });

      if (!res.ok) {
        setErrorMessage(await extractErrorMessage(res, "Не вдалося відправити заявку. Спробуй ще раз або напиши нам у Telegram."));
        setStatus("error");
        return;
      }

      if (paymentMethod === "card_mono") {
        // Онлайн-оплата Monobank — створюємо інвойс і редіректимо на
        // сторінку оплати. Purchase-подія летить НЕ тут, а на /order/success
        // після підтвердження реальної оплати (див. pixel.ts/ga4.ts).
        const invoiceRes = await fetch("/api/checkout/monobank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })),
            totalPrice,
          }),
        });

        if (!invoiceRes.ok) {
          setErrorMessage("Не вдалося створити оплату mono. Спробуй ще раз, обери інший спосіб оплати або напиши нам у Telegram.");
          setStatus("error");
          return;
        }

        const { invoiceId, pageUrl } = await invoiceRes.json();

        // Зберігаємо дані для пікселя/GA4, які вистрелять на сторінці
        // успіху ПІСЛЯ підтвердження оплати, а не зараз.
        localStorage.setItem(
          "mm_pending_order",
          JSON.stringify({
            orderId,
            gateway: "monobank",
            invoiceId,
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              category: i.categoryName ?? i.category,
            })),
            totalPrice,
          })
        );

        clearCart();
        window.location.href = pageUrl;
        return;
      }

      if (paymentMethod === "card_wfp") {
        // WayForPay працює через класичний POST-редирект форми (не JSON-
        // редирект як у Monobank) — сервер віддає готові поля з підписом,
        // ми збираємо приховану форму і сабмітимо її на secure.wayforpay.com.
        const purchaseRes = await fetch("/api/checkout/wayforpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })),
          }),
        });

        if (!purchaseRes.ok) {
          setErrorMessage("Не вдалося створити оплату WayForPay. Спробуй ще раз, обери інший спосіб оплати або напиши нам у Telegram.");
          setStatus("error");
          return;
        }

        const { actionUrl, fields } = await purchaseRes.json();

        localStorage.setItem(
          "mm_pending_order",
          JSON.stringify({
            orderId,
            gateway: "wayforpay",
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              category: i.categoryName ?? i.category,
            })),
            totalPrice,
          })
        );

        clearCart();

        const form = document.createElement("form");
        form.method = "POST";
        form.action = actionUrl;
        for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
          if (Array.isArray(value)) {
            for (const v of value) {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = key;
              input.value = String(v);
              form.appendChild(input);
            }
          } else {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = String(value);
            form.appendChild(input);
          }
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }

      // Оплата при отриманні — Purchase шлемо в момент прийняття заявки,
      // а не реальної оплати (для card-оплати перенесено на /order/success).
      trackPurchase(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          category: i.categoryName ?? i.category,
        })),
        totalPrice
      );
      trackPurchaseGA4(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          category: i.categoryName ?? i.category,
        })),
        totalPrice
      );
      setStatus("success");
      clearCart();
    } catch {
      setErrorMessage("Не вдалося з'єднатися з сервером. Перевір інтернет і спробуй ще раз.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="fixed inset-0 z-[80] overlay flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-lg font-extrabold mb-2">Замовлення прийнято!</div>
          <div className="text-sm text-gray-500 mb-1">
            Ми зв&apos;яжемося з тобою протягом 30 хвилин для підтвердження.
          </div>
          <div className="text-xs text-gray-400 mb-6">
            Відправка Новою Поштою · Оплата при отриманні
          </div>
          <button
            onClick={onClose}
            className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold"
          >
            Супер!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] overlay flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-extrabold">📋 Оформлення</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ✕
          </button>
        </div>

        {/* Order summary */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-100">
          {items.map((item) => {
            const thumb = (
              <div className="w-7 h-7 rounded-md bg-gray-200 flex items-center justify-center text-sm overflow-hidden flex-shrink-0">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  item.emoji
                )}
              </div>
            );
            return (
              <div
                key={item.id}
                className="flex justify-between items-center gap-2 text-xs py-1"
              >
                {item.slug ? (
                  // Відкриваємо в новій вкладці — щоб не втратити заповнену
                  // форму замовлення, якщо покупець хоче ще раз глянути товар.
                  <Link
                    href={`/product/${item.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 min-w-0 hover:underline"
                  >
                    {thumb}
                    <span className="truncate">
                      {item.name} ×{item.quantity}
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 min-w-0">
                    {thumb}
                    <span className="truncate">
                      {item.name} ×{item.quantity}
                    </span>
                  </span>
                )}
                <span className="font-bold flex-shrink-0">
                  {item.price * item.quantity}₴
                </span>
              </div>
            );
          })}
          <hr className="my-2" />
          <div className="flex justify-between text-sm font-extrabold">
            <span>Разом</span>
            <span>{totalPrice}₴</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {totalPrice >= 2000
              ? "✅ Безкоштовна доставка"
              : `📦 Доставка НП ~60-80₴`}
          </div>
        </div>

        {/* Payment method — картка онлайн пріоритетна: менше повернень і відмов при курєрі */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
            Спосіб оплати
          </label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("card_mono")}
              className={`w-full flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                paymentMethod === "card_mono"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200"
              }`}
            >
              <span className="text-xl">💳</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-bold">Оплата mono</span>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                    Рекомендуємо
                  </span>
                </span>
                <span className="block text-[11px] text-gray-500">
                  Швидше обробимо і відправимо замовлення
                </span>
              </span>
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  paymentMethod === "card_mono"
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-gray-300"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("card_wfp")}
              className={`w-full flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                paymentMethod === "card_wfp"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200"
              }`}
            >
              <span className="text-xl">💳</span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-bold">Оплата WayForPay</span>
                <span className="block text-[11px] text-gray-500">
                  Картка, Apple Pay, Google Pay
                </span>
              </span>
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  paymentMethod === "card_wfp"
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-gray-300"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("cod")}
              className={`w-full flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                paymentMethod === "cod"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200"
              }`}
            >
              <span className="text-xl">💰</span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-bold">Оплата при отриманні</span>
                <span className="block text-[11px] text-gray-500">
                  Готівкою або карткою на Новій Пошті
                </span>
              </span>
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  paymentMethod === "cod"
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-gray-300"
                }`}
              />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Honeypot — invisible to users, bots auto-fill it */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Ім&apos;я *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Олена"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Телефон *
            </label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+380 __ ___ __ __"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Місто *
            </label>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Київ"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Відділення Нової Пошти *
            </label>
            <input
              type="text"
              required
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
              placeholder="Відділення №5, вул. Хрещатик, 1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Коментар
            </label>
            <textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Колір, розмір або побажання..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {status === "error" && (
            <div className="text-xs text-red-500 text-center">
              {errorMessage || "Щось пішло не так. Спробуй ще раз або напиши нам у Telegram."}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white py-3.5 rounded-xl text-base font-extrabold transition-colors"
          >
            {status === "sending"
              ? "Відправляю..."
              : paymentMethod === "cod"
              ? "Замовити · Оплата при отриманні"
              : "Замовити · Оплата карткою"}
          </button>

          <div className="text-[10px] text-gray-400 text-center">
            {paymentMethod === "cod"
              ? "💰 Оплата при отриманні на Новій Пошті · ↩️ Повернення 14 днів"
              : "💳 Перейдеш на захищену сторінку оплати · ↩️ Повернення 14 днів"}
          </div>
        </form>
      </div>
    </div>
  );
}
