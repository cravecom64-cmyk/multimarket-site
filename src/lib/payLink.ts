import { createHmac, timingSafeEqual } from "crypto";

// ==================== Посилання на оплату для менеджера (28.11.2026) ====================
// Для замовлень, які клієнт оформив, але не оплатив: менеджер надсилає клієнту
// посилання /pay/<order_ref>?s=<підпис>. Підпис (HMAC) не дає підібрати чуже
// замовлення; суму сторінка бере з бази (prepaid_amount), а не з посилання.
const SITE_URL = "https://www.multi-market.com.ua";

function secret(): string | null {
  return process.env.PAY_LINK_SECRET || process.env.SUPABASE_SECRET_KEY || null;
}

export function payLinkSignature(orderRef: string): string | null {
  const key = secret();
  if (!key) return null;
  return createHmac("sha256", key).update(`pay:${orderRef}`).digest("hex").slice(0, 24);
}

export function payLinkUrl(orderRef: string): string | null {
  const sig = payLinkSignature(orderRef);
  return sig ? `${SITE_URL}/pay/${encodeURIComponent(orderRef)}?s=${sig}` : null;
}

export function verifyPayLink(orderRef: string, sig: string | null | undefined): boolean {
  const expected = payLinkSignature(orderRef);
  if (!expected || !sig || sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
