// Інтеграція з WayForPay (Purchase / webhook / Check Status).
// Джерело істини — офіційна документація wiki.wayforpay.com, перевірено
// 2026-08-13 (Accept payment (Purchase), Check Status, повідомлення на serviceUrl).
//
// merchantAccount + secretKey — з особистого кабінету merchant.wayforpay.com,
// зберігаються ТІЛЬКИ в Vercel env vars (WAYFORPAY_MERCHANT_ACCOUNT,
// WAYFORPAY_SECRET_KEY), ніколи не потрапляють у клієнтський код напряму
// (клієнт отримує вже готові поля форми + підпис, а не сам ключ).

import crypto from "crypto";

const PURCHASE_URL = "https://secure.wayforpay.com/pay";
const API_URL = "https://api.wayforpay.com/api";

function getConfig() {
  const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
  const secretKey = process.env.WAYFORPAY_SECRET_KEY;
  const domainName = process.env.WAYFORPAY_DOMAIN || "multi-market.com.ua";

  if (!merchantAccount || !secretKey) {
    throw new Error(
      "WAYFORPAY_MERCHANT_ACCOUNT / WAYFORPAY_SECRET_KEY не задано в env vars"
    );
  }

  return { merchantAccount, secretKey, domainName };
}

function hmacMd5(baseString: string, secretKey: string): string {
  return crypto.createHmac("md5", secretKey).update(baseString, "utf8").digest("hex");
}

export interface PurchaseItem {
  name: string;
  price: number; // за одиницю, у гривнях (НЕ копійках — на відміну від Monobank)
  count: number;
}

export interface PurchaseFields {
  merchantAccount: string;
  merchantAuthType: string;
  merchantDomainName: string;
  merchantSignature: string;
  orderReference: string;
  orderDate: number;
  amount: string;
  currency: string;
  "productName[]": string[];
  "productPrice[]": string[];
  "productCount[]": string[];
  returnUrl: string;
  serviceUrl: string;
}

// Будує поля для форми, яку клієнт сам сабмітить (POST) на secure.wayforpay.com/pay.
// Підпис рахується СЕРВЕРНО із secretKey, на клієнт секрет ніколи не йде.
export function buildPurchaseFields(params: {
  orderReference: string;
  items: PurchaseItem[];
  returnUrl: string;
  serviceUrl: string;
}): { actionUrl: string; fields: PurchaseFields } {
  const { merchantAccount, secretKey, domainName } = getConfig();

  const orderDate = Math.floor(Date.now() / 1000);
  const amount = params.items
    .reduce((sum, i) => sum + i.price * i.count, 0)
    .toFixed(2);

  const productNames = params.items.map((i) => i.name);
  const productCounts = params.items.map((i) => String(i.count));
  const productPrices = params.items.map((i) => i.price.toFixed(2));

  // Базовий рядок для HMAC_MD5 — суворо в цьому порядку, документація WayForPay:
  // merchantAccount;merchantDomainName;orderReference;orderDate;amount;currency;
  // productName[0..n];productCount[0..n];productPrice[0..n]
  const baseString = [
    merchantAccount,
    domainName,
    params.orderReference,
    orderDate,
    amount,
    "UAH",
    ...productNames,
    ...productCounts,
    ...productPrices,
  ].join(";");

  const merchantSignature = hmacMd5(baseString, secretKey);

  return {
    actionUrl: PURCHASE_URL,
    fields: {
      merchantAccount,
      merchantAuthType: "SimpleSignature",
      merchantDomainName: domainName,
      merchantSignature,
      orderReference: params.orderReference,
      orderDate,
      amount,
      currency: "UAH",
      "productName[]": productNames,
      "productPrice[]": productPrices,
      "productCount[]": productCounts,
      returnUrl: params.returnUrl,
      serviceUrl: params.serviceUrl,
    },
  };
}

export interface CheckStatusResult {
  merchantAccount: string;
  orderReference: string;
  amount: string;
  currency: string;
  transactionStatus: string;
  reason?: string;
  reasonCode?: string;
}

export async function checkStatus(orderReference: string): Promise<CheckStatusResult> {
  const { merchantAccount, secretKey } = getConfig();

  // Підпис Check Status: merchantAccount;orderReference
  const baseString = [merchantAccount, orderReference].join(";");
  const merchantSignature = hmacMd5(baseString, secretKey);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactionType: "CHECK_STATUS",
      merchantAccount,
      orderReference,
      merchantSignature,
      apiVersion: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WayForPay CHECK_STATUS ${res.status}: ${text}`);
  }

  return res.json();
}

// ==================== WEBHOOK (serviceUrl) ====================
// WayForPay шле на serviceUrl POST з даними платежу + merchantSignature,
// підпис рахується з: merchantAccount;orderReference;amount;currency;
// authCode;cardPan;transactionStatus;reasonCode
export interface WebhookPayload {
  merchantAccount: string;
  orderReference: string;
  merchantSignature: string;
  amount: number | string;
  currency: string;
  authCode?: string;
  cardPan?: string;
  transactionStatus: string;
  reasonCode?: string;
  reason?: string;
}

export function verifyWebhookSignature(payload: WebhookPayload): boolean {
  const { secretKey } = getConfig();

  const baseString = [
    payload.merchantAccount,
    payload.orderReference,
    payload.amount,
    payload.currency,
    payload.authCode || "",
    payload.cardPan || "",
    payload.transactionStatus,
    payload.reasonCode || "",
  ].join(";");

  const expected = hmacMd5(baseString, secretKey);
  return expected === payload.merchantSignature;
}

// Обов'язкова відповідь мерчанта — інакше WayForPay ретраїть запит до 4 діб.
// Підпис відповіді: orderReference;status;time
export function buildWebhookResponse(orderReference: string) {
  const { secretKey } = getConfig();
  const time = Math.floor(Date.now() / 1000);
  const baseString = [orderReference, "accept", time].join(";");
  const signature = hmacMd5(baseString, secretKey);

  return { orderReference, status: "accept", time, signature };
}
