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

// ЗМІНЕНО 17.11.2026: джерело візиту зберігається на 30 днів (остання
// не-пряма точка входу), а не читається лише з поточного URL. Раніше UTM
// губились, щойно людина переходила з посадкової сторінки в іншу, і в
// замовлення джерело не потрапляло взагалі. Google Ads з автотегуванням
// додає лише gclid без UTM — тоді записуємо google / cpc.
const ATTR_KEY = "mm_attr";
const ATTR_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

function readUrlAttribution(): Attribution | null {
  const params = new URLSearchParams(window.location.search);
  const utm: Attribution = {
    source: params.get("utm_source") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    term: params.get("utm_term") || undefined,
    content: params.get("utm_content") || undefined,
  };
  if (utm.source || utm.medium || utm.campaign) return utm;
  const gclid = params.get("gclid") || params.get("gbraid") || params.get("wbraid");
  if (gclid) return { source: "google", medium: "cpc", campaign: params.get("utm_campaign") || undefined };
  const fbclid = params.get("fbclid");
  if (fbclid) return { source: "facebook", medium: "paid_or_social" };
  // Без міток: дивимось, з якого сайту прийшли (пошук, ChatGPT, агрегатори).
  try {
    const ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
    if (ref && ref !== window.location.hostname.replace(/^www\./, "")) {
      if (/(^|\.)google\./.test(ref)) return { source: "google", medium: "organic" };
      if (/(^|\.)bing\.com$/.test(ref)) return { source: "bing", medium: "organic" };
      if (/chatgpt\.com$|openai\.com$/.test(ref)) return { source: "chatgpt", medium: "referral" };
      return { source: ref.slice(0, 100), medium: "referral" };
    }
  } catch {
    // некоректний referrer — ігноруємо
  }
  return null;
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const fromUrl = readUrlAttribution();
    if (fromUrl) {
      localStorage.setItem(ATTR_KEY, JSON.stringify({ ...fromUrl, ts: Date.now() }));
      return fromUrl;
    }
    const raw = localStorage.getItem(ATTR_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Attribution & { ts?: number };
      if (saved.ts && Date.now() - saved.ts < ATTR_TTL_MS) {
        const { ts: _ts, ...rest } = saved;
        return rest;
      }
      localStorage.removeItem(ATTR_KEY);
    }
  } catch {
    // localStorage недоступний — працюємо без збереження
  }
  return {};
}

function getUtm() {
  return getAttribution();
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
