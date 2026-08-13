// Інтеграція з Monobank Acquiring (інтернет-еквайринг).
// Джерело істини по API — офіційна документація monobank.ua/api-docs/acquiring,
// перевірено 2026-08-13 (invoice/create, invoice/status, webhook signature).
//
// X-Token — токен мерчанта з web.monobank.ua, зберігається ТІЛЬКИ в
// Vercel env var MONOBANK_TOKEN, ніколи не потрапляє в клієнтський код.

const MONOBANK_API = "https://api.monobank.ua";

function getToken(): string {
  const token = process.env.MONOBANK_TOKEN;
  if (!token) {
    throw new Error("MONOBANK_TOKEN не задано в env vars");
  }
  return token;
}

export interface BasketItem {
  name: string;
  qty: number;
  sum: number; // ціна за одиницю, у копійках
  unit?: string;
}

export interface CreateInvoiceParams {
  amount: number; // повна сума в копійках
  reference: string; // наш orderId, повертається монобанком у webhook/status
  destination: string; // призначення платежу, показується клієнту
  basketOrder: BasketItem[];
  redirectUrl: string;
  webHookUrl: string;
  validitySeconds?: number; // за замовчуванням 3600 (1 година)
}

export interface CreateInvoiceResult {
  invoiceId: string;
  pageUrl: string;
}

// Деякі мерчант-акаунти Monobank налаштовані за агентською/маркетплейс-
// схемою (кілька терміналів під одним токеном) — тоді invoice/create
// вимагає явно вказати code конкретного субмерчанта, інакше 400
// INVALID_MERCHANT_PAYM_INFO ("'code' is required"). Для звичайного
// одиночного ФОП-акаунту список субмерчантів порожній — тоді code просто
// не додаємо в запит, як і документовано (поле не обов'язкове).
let cachedSubmerchantCode: { code: string | null; fetchedAt: number } | null = null;
const SUBMERCHANT_TTL_MS = 60 * 60 * 1000;

async function getSubmerchantCode(): Promise<string | null> {
  if (
    cachedSubmerchantCode &&
    Date.now() - cachedSubmerchantCode.fetchedAt < SUBMERCHANT_TTL_MS
  ) {
    return cachedSubmerchantCode.code;
  }

  const res = await fetch(`${MONOBANK_API}/api/merchant/submerchant/list`, {
    headers: { "X-Token": getToken() },
  });

  if (!res.ok) {
    // Ендпоінт недоступний для звичайних (не агентських) акаунтів — це не
    // помилка, просто означає "код не потрібен".
    cachedSubmerchantCode = { code: null, fetchedAt: Date.now() };
    return null;
  }

  const data = await res.json();
  const code =
    data.list && data.list.length > 0 ? (data.list[0].code as string) : null;
  cachedSubmerchantCode = { code, fetchedAt: Date.now() };
  return code;
}

export async function createInvoice(
  params: CreateInvoiceParams
): Promise<CreateInvoiceResult> {
  const code = await getSubmerchantCode();

  const res = await fetch(`${MONOBANK_API}/api/merchant/invoice/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Token": getToken(),
    },
    body: JSON.stringify({
      amount: params.amount,
      ccy: 980, // UAH
      merchantPaymInfo: {
        reference: params.reference,
        destination: params.destination,
        basketOrder: params.basketOrder,
      },
      redirectUrl: params.redirectUrl,
      webHookUrl: params.webHookUrl,
      validity: params.validitySeconds ?? 3600,
      paymentType: "debit",
      ...(code ? { code } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Monobank invoice/create ${res.status}: ${text}`);
  }

  return res.json();
}

export type InvoiceStatus =
  | "created"
  | "processing"
  | "hold"
  | "success"
  | "failure"
  | "reversed"
  | "expired";

export interface InvoiceStatusResult {
  invoiceId: string;
  status: InvoiceStatus;
  amount: number;
  ccy: number;
  finalAmount?: number;
  reference?: string;
  destination?: string;
  modifiedDate?: string;
  failureReason?: string;
}

export async function getInvoiceStatus(
  invoiceId: string
): Promise<InvoiceStatusResult> {
  const res = await fetch(
    `${MONOBANK_API}/api/merchant/invoice/status?invoiceId=${encodeURIComponent(
      invoiceId
    )}`,
    {
      headers: { "X-Token": getToken() },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Monobank invoice/status ${res.status}: ${text}`);
  }

  return res.json();
}

// ==================== WEBHOOK SIGNATURE VERIFICATION ====================
// Monobank підписує тіло webhook-запиту приватним ключем (ECDSA/SHA256) і
// передає підпис у заголовку x-sign (base64). Публічний ключ віддає
// GET /api/merchant/pubkey. Приклад верифікації взято 1:1 з офіційної
// документації (NodeJs snippet): crypto.createVerify('SHA256') +
// verify.verify(pubKeyBuffer, signatureBuffer), де pubKeyBuffer —
// base64-декодований PEM-текст ключа.

let cachedPubKey: { key: string; fetchedAt: number } | null = null;
const PUBKEY_TTL_MS = 60 * 60 * 1000; // 1 година — ключ довгоживучий, але не вічний

async function getPubKeyBase64(): Promise<string> {
  if (cachedPubKey && Date.now() - cachedPubKey.fetchedAt < PUBKEY_TTL_MS) {
    return cachedPubKey.key;
  }

  const res = await fetch(`${MONOBANK_API}/api/merchant/pubkey`, {
    headers: { "X-Token": getToken() },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Monobank pubkey ${res.status}: ${text}`);
  }

  const data = await res.json();
  cachedPubKey = { key: data.key as string, fetchedAt: Date.now() };
  return cachedPubKey.key;
}

// rawBody — точний текст тіла запиту (до JSON.parse!), інакше підпис не збіжиться.
export async function verifyWebhookSignature(
  rawBody: string,
  xSignBase64: string
): Promise<boolean> {
  const crypto = await import("crypto");
  const pubKeyBase64 = await getPubKeyBase64();

  const pubKeyBuf = Buffer.from(pubKeyBase64, "base64");
  const signatureBuf = Buffer.from(xSignBase64, "base64");

  const verify = crypto.createVerify("SHA256");
  verify.write(rawBody);
  verify.end();

  return verify.verify(pubKeyBuf, signatureBuf);
}
