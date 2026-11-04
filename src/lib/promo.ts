// Акція Black Friday: знижки на весь каталог до 30.11.2026 включно (Київ).
// Після дати: плашка й підпис «акція до …» зникають самі, priceValidUntil
// прибирається з розмітки. Ціни НЕ змінюються автоматично — це рішення Павла.
export const PROMO = {
  name: "Black Friday",
  endsAtIso: "2026-11-30T23:59:59+02:00",
  endsAtDate: "2026-11-30", // для schema.org priceValidUntil
  endsAtLabel: "30.11",
};

export function isPromoActive(now: Date = new Date()): boolean {
  return now.getTime() <= new Date(PROMO.endsAtIso).getTime();
}
