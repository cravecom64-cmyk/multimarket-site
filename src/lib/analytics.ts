"use client";

// Легкий трекер власних подій у Supabase (product_events) — паралельно до
// GA4 (lib/ga4.ts) і Meta Pixel (lib/pixel.ts), не замінює їх. Той самий
// принцип, що вже застосований до командного центру: власна незалежна
// база — джерело правди для ранжування карток на сайті і для розділу
// "Аналітика" в командному центрі, а не GA4/Meta API (щоб не було
// розбіжностей між джерелами).

// ЗМІНЕНО 30.10.2026: сесія живе в localStorage з 30-хвилинним тайм-аутом
// неактивності (стандарт GA), а не в sessionStorage. Раніше кожна нова
// вкладка рахувалась окремим відвідувачем: людина, що відкрила 5 карток у
// нових вкладках, давала 5 "сесій" по одному перегляду, і воронка в
// командному центрі виходила заниженою в рази.
const SESSION_KEY = "mm_sid";
const SESSION_TS_KEY = "mm_sid_ts";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    let id = localStorage.getItem(SESSION_KEY);
    const last = Number(localStorage.getItem(SESSION_TS_KEY) || 0);
    if (!id || now - last > SESSION_TIMEOUT_MS) {
      id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    localStorage.setItem(SESSION_TS_KEY, String(now));
    return id;
  } catch {
    return "";
  }
}

// ДОДАНО 30.10.2026: внутрішні візити (Павел, перевірки сайту після правок,
// зокрема автоматичні з браузера) більше не пишуться в аналітику — раніше
// вони становили більшість "сесій" і перетворювали воронку на шум.
// Позначка ставиться один раз на пристрій відкриттям сайту з ?internal=1
// (знімається ?internal=0) і живе в localStorage цього браузера. Плюс
// автоматизовані браузери (navigator.webdriver) не рахуються ніколи.
const INTERNAL_KEY = "mm_internal";

export function isInternalVisit(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const flag = new URLSearchParams(window.location.search).get("internal");
    if (flag === "1") localStorage.setItem(INTERNAL_KEY, "1");
    if (flag === "0") localStorage.removeItem(INTERNAL_KEY);
    if (localStorage.getItem(INTERNAL_KEY) === "1") return true;
  } catch {
    // localStorage недоступний — вважаємо звичайним відвідувачем
  }
  return navigator.webdriver === true;
}

function getUtm() {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get("utm_source") || undefined,
      medium: params.get("utm_medium") || undefined,
      campaign: params.get("utm_campaign") || undefined,
      term: params.get("utm_term") || undefined,
      content: params.get("utm_content") || undefined,
    };
  } catch {
    return {};
  }
}

function send(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (isInternalVisit()) return;
  // fire-and-forget — трекінг ніколи не повинен блокувати чи ламати UX.
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function trackPageView(path: string, productId?: string) {
  send({
    eventType: "page_view",
    path,
    productId,
    sessionId: getSessionId(),
    utm: getUtm(),
  });
}

export function trackAddToCartEvent(productId: string) {
  send({
    eventType: "add_to_cart",
    productId,
    sessionId: getSessionId(),
    utm: getUtm(),
  });
}

// ДОДАНО 30.10.2026: кроки оформлення заказу — щоб у командному центрі було
// видно, де люди відпадають між кошиком і заказом.
//   begin_checkout  — відкрили форму оформлення
//   checkout_error  — заказ не пройшов (detail: код помилки валідації / network)
//   order_submitted — заказ прийнято сервером
export function trackCheckoutEvent(
  eventType: "begin_checkout" | "checkout_error" | "order_submitted",
  detail?: string
) {
  send({
    eventType,
    path: detail ? `checkout:${detail}` : "checkout",
    sessionId: getSessionId(),
    utm: getUtm(),
  });
}
