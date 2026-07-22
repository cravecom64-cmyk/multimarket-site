"use client";

// Легкі обгортки над Meta Pixel (fbq). Усі функції — безпечні no-op,
// поки не заданий NEXT_PUBLIC_META_PIXEL_ID і не завантажений сам pixel
// (компонент MetaPixel). Це дозволяє тримати виклики трекінгу в коді
// вже зараз, і активувати їх пізніше просто додавши env var — без правок коду.

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
export const CURRENCY = "UAH";

function pixelReady(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.fbq === "function" &&
    !!META_PIXEL_ID
  );
}

export function trackViewContent(product: {
  id: string;
  name: string;
  price: number;
}) {
  if (!pixelReady()) return;
  window.fbq!("track", "ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    value: product.price,
    currency: CURRENCY,
  });
}

export function trackAddToCart(item: {
  id: string;
  name: string;
  price: number;
  quantity?: number;
}) {
  if (!pixelReady()) return;
  window.fbq!("track", "AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    value: item.price * (item.quantity ?? 1),
    currency: CURRENCY,
  });
}

export function trackInitiateCheckout(
  items: { id: string; price: number; quantity: number }[],
  value: number
) {
  if (!pixelReady()) return;
  window.fbq!("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    contents: items.map((i) => ({ id: i.id, quantity: i.quantity })),
    content_type: "product",
    value,
    currency: CURRENCY,
    num_items: items.reduce((s, i) => s + i.quantity, 0),
  });
}

// Оплата при отриманні (COD) — Purchase шлемо в момент прийняття
// замовлення на сайті (заявка підтверджена формою), не в момент реальної
// оплати. Коли підключимо онлайн-оплату — просто перенесемо цей виклик
// на сторінку "оплата пройшла успішно", решта коду не зміниться.
export function trackPurchase(
  items: { id: string; price: number; quantity: number }[],
  value: number
) {
  if (!pixelReady()) return;
  window.fbq!("track", "Purchase", {
    content_ids: items.map((i) => i.id),
    contents: items.map((i) => ({ id: i.id, quantity: i.quantity })),
    content_type: "product",
    value,
    currency: CURRENCY,
  });
}
