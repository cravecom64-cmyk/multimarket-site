"use client";

// Легкий трекер власних подій у Supabase (product_events) — паралельно до
// GA4 (lib/ga4.ts) і Meta Pixel (lib/pixel.ts), не замінює їх. Той самий
// принцип, що вже застосований до командного центру: власна незалежна
// база — джерело правди для ранжування карток на сайті і для розділу
// "Аналітика" в командному центрі, а не GA4/Meta API (щоб не було
// розбіжностей між джерелами).

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("mm_sid");
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("mm_sid", id);
    }
    return id;
  } catch {
    return "";
  }
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
