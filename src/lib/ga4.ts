"use client";

// Легкі обгортки над GA4 (gtag) ecommerce-подіями. Дзеркалить pixel.ts —
// викликаються в тих самих місцях коду, паралельно з trackXxx з pixel.ts.
// Це дає повну воронку в GA4 (перегляд товару → кошик → чекаут → покупка),
// а не тільки page_view.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const CURRENCY = "UAH";

function gtagReady(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

export function trackViewContent(product: {
  id: string;
  name: string;
  price: number;
  category?: string;
}) {
  if (!gtagReady()) return;
  window.gtag!("event", "view_item", {
    currency: CURRENCY,
    value: product.price,
    items: [
      {
        item_id: product.id,
        item_name: product.name,
        item_category: product.category,
        price: product.price,
        quantity: 1,
      },
    ],
  });
}

export function trackAddToCart(item: {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  category?: string;
}) {
  if (!gtagReady()) return;
  const quantity = item.quantity ?? 1;
  window.gtag!("event", "add_to_cart", {
    currency: CURRENCY,
    value: item.price * quantity,
    items: [
      {
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity,
      },
    ],
  });
}

export function trackInitiateCheckout(
  items: { id: string; name: string; price: number; quantity: number; category?: string }[],
  value: number
) {
  if (!gtagReady()) return;
  window.gtag!("event", "begin_checkout", {
    currency: CURRENCY,
    value,
    items: items.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      item_category: i.category,
      price: i.price,
      quantity: i.quantity,
    })),
  });
}

export function trackSearch(searchString: string, resultsCount?: number) {
  if (!gtagReady()) return;
  window.gtag!("event", "search", {
    search_term: searchString,
    ...(typeof resultsCount === "number" ? { num_items: resultsCount } : {}),
  });
}

// Оплата при отриманні (COD) — Purchase шлемо в момент прийняття
// замовлення на сайті, так само як в pixel.ts. Коли підключимо онлайн-оплату
// — перенесемо на сторінку "оплата пройшла успішно".
export function trackPurchase(
  items: { id: string; name: string; price: number; quantity: number; category?: string }[],
  value: number
) {
  if (!gtagReady()) return;
  window.gtag!("event", "purchase", {
    transaction_id: `order_${Date.now()}`,
    currency: CURRENCY,
    value,
    items: items.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      item_category: i.category,
      price: i.price,
      quantity: i.quantity,
    })),
  });
}
