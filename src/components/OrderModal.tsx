"use client";

import { useState, useRef } from "react";
import { useCart } from "./CartProvider";
import { trackPurchase } from "@/lib/pixel";

interface OrderModalProps {
  onClose: () => void;
}

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
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const formLoadedAt = useRef(Date.now());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          city: form.city,
          branch: form.branch,
          comment: form.comment,
          website: form.website,
          _t: formLoadedAt.current,
          items: items.map((i) => ({
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          totalPrice,
        }),
      });

      if (res.ok) {
        // Оплата при отриманні — Purchase шлемо в момент прийняття заявки,
        // а не реальної оплати. Коли підключимо онлайн-оплату — перенесемо
        // цей виклик на сторінку успішної оплати.
        trackPurchase(
          items.map((i) => ({ id: i.id, price: i.price, quantity: i.quantity })),
          totalPrice
        );
        setStatus("success");
        clearCart();
      } else {
        setStatus("error");
      }
    } catch {
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
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-xs py-1">
              <span>
                {item.emoji} {item.name} ×{item.quantity}
              </span>
              <span className="font-bold">{item.price * item.quantity}₴</span>
            </div>
          ))}
          <hr className="my-2" />
          <div className="flex justify-between text-sm font-extrabold">
            <span>Разом</span>
            <span>{totalPrice}₴</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {totalPrice >= 800
              ? "✅ Безкоштовна доставка"
              : `📦 Доставка НП ~60-80₴`}
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
              Щось пішло не так. Спробуй ще раз або напиши нам у Telegram.
            </div>
          )}

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white py-3.5 rounded-xl text-base font-extrabold transition-colors"
          >
            {status === "sending" ? "Відправляю..." : "Замовити · Оплата при отриманні"}
          </button>

          <div className="text-[10px] text-gray-400 text-center">
            💰 Оплата при отриманні на Новій Пошті · ↩️ Повернення 14 днів
          </div>
        </form>
      </div>
    </div>
  );
}