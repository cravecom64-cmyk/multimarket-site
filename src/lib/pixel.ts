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
  category?: string;
}) {
  if (!pixelReady()) return;
  window.fbq!("track", "ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_category: product.category,
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
  category?: string;
}) {
  if (!pixelReady()) return;
  window.fbq!("track", "AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_category: item.category,
    content_type: "product",
    value: item.price * (item.quantity ?? 1),
    currency: CURRENCY,
  });
}

// items несуть name/category — потрібні для content_name/content_category,
// які вимагає ТЗ для InitiateCheckout (крок воронки між AddToCart і Purchase).
// Беремо name/category першого товару в кошику як репрезентативні для events,
// а contents/content_ids покривають повний список товарів.
export function trackInitiateCheckout(
  items: { id: string; name: string; price: number; quantity: number; category?: string }[],
  value: number
) {
  if (!pixelReady()) return;
  window.fbq!("track", "InitiateCheckout", {
    content_ids: items.map((i) => i.id),
    contents: items.map((i) => ({ id: i.id, quantity: i.quantity })),
    content_name: items.map((i) => i.name).join(", "),
    content_category: items[0]?.category,
    content_type: "product",
    value,
    currency: CURRENCY,
    num_items: items.reduce((s, i) => s + i.quantity, 0),
  });
}

export function trackSearch(searchString: string, resultsCount?: number) {
  if (!pixelReady()) return;
  window.fbq!("track", "Search", {
    search_string: searchString,
    content_category: "product",
    ...(typeof resultsCount === "number" ? { num_items: resultsCount } : {}),
  });
}

// Purchase шлемо на сторінці "оплата пройшла успішно" (момент реального
// підтвердження оплати, не заповнення форми).
//
// ДОДАНО 24.11.2026 (аудит сайту п.2): eventId (= orderId) — для
// дедуплікації з тією самою Purchase-подією, яку тепер МОЖЕ надіслати і
// сервер (Meta Conversions API, src/lib/serverConversions.ts) по сигналу
// вебхука оплати — якщо людина закрила вкладку, не дочекавшись цієї
// клієнтської події. Meta дедуплікує Pixel+CAPI самостійно, якщо event_id
// співпадає (офіційно задокументована поведінка).
export function trackPurchase(
  items: { id: string; name: string; price: number; quantity: number; category?: string }[],
  value: number,
  eventId?: string
) {
  if (!pixelReady()) return;
  window.fbq!(
    "track",
    "Purchase",
    {
      content_ids: items.map((i) => i.id),
      contents: items.map((i) => ({ id: i.id, quantity: i.quantity })),
      content_name: items.map((i) => i.name).join(", "),
      content_category: items[0]?.category,
      content_type: "product",
      value,
      currency: CURRENCY,
      num_items: items.reduce((s, i) => s + i.quantity, 0),
    },
    eventId ? { eventID: eventId } : undefined
  );
}
