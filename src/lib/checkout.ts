import productsData from "@/data/products.json";
// ==================== Модель оплати (Рішення Павла 12.11.2026) ====================
// Чиста "наложка" (оплата при отриманні без жодної онлайн-частини) більше
// НЕ існує як варіант — щоб клієнти не відмовлялись від посилок на пошті,
// частина суми тепер стягується онлайн ЗАВЖДИ:
//
//   - Якщо сума замовлення >= COD_MIN_TOTAL: оплачується COD_DEPOSIT_AMOUNT
//     карткою онлайн (mono/WayForPay) зараз, залишок — накладеним платежем
//     при отриманні на Новій Пошті.
//   - Якщо сума замовлення < COD_MIN_TOTAL: оплачується ПОВНІСТЮ онлайн —
//     дешеві замовлення економічно не мають сенсу по наложці (вартість
//     повернення при відмові від посилки часто перевищує суму замовлення).
//
// Це попередня версія правила (до 12.11.2026 наложка без передоплати була
// дозволена від COD_MIN_TOTAL) — замінено на користь моделі з обов'язковим
// депозитом, щоб зменшити відмови від посилок і для дешевих, і для звичайних
// замовлень.
//
// Єдине джерело цієї логіки — і клієнт (OrderModal.tsx), і сервер
// (api/order/route.ts, api/checkout/monobank/route.ts,
// api/checkout/wayforpay/route.ts) рахують розподіл через getPaymentSplit()
// нижче, а не дублюють арифметику кожен по-своєму.
export const COD_MIN_TOTAL = 300;
export const COD_DEPOSIT_AMOUNT = 200;

// ДОДАНО 13.11.2026 (рішення Павла, «перший варіант»): передоплата не більша
// за маржу ЗАМОВЛЕННЯ. Постачальник (Фантом, Aveopt, LUGI PRO, VIBER-SHOP)
// отримує наложку й рахує нашу націнку як «наложка − дроп» — якщо
// передоплата більша за маржу, наложка не покриває дроп-ціну і постачальник
// таке замовлення не відправить. Маржа = Σ (ціна − закупка) × кількість,
// тож 2 однакові лампи з маржею по 96 ₴ дають ліміт 190 ₴, а товари різних
// постачальників — ліміт на суму, яку при оформленні ділимо між ними не
// більше маржі кожного. Округлюємо вниз до 10 ₴.
// Якщо так виходить менше COD_DEPOSIT_MIN — замовлення лише з повною оплатою
// (передоплата в кілька гривень не захищає від відмови).
export const COD_DEPOSIT_MIN = 50;

type MarginItem = { id?: string; price: number; quantity: number };
type CatalogRow = { id: string; buyPrice?: number; sizes?: { slug: string; buyPrice?: number }[] };
const BUY_BY_ID = new Map((productsData as CatalogRow[]).map((p) => [p.id, p]));

/** Маржа замовлення за закупками з каталогу; null — якщо закупка якогось товару невідома. */
export function orderMargin(items: MarginItem[]): number | null {
  let margin = 0;
  for (const it of items) {
    // id рядка кошика: "<productId>" або "<productId>__<sizeSlug>"
    if (!it.id) return null;
    const [productId, sizeSlug] = it.id.split("__");
    const p = BUY_BY_ID.get(productId);
    if (!p) return null;
    const buy = sizeSlug ? p.sizes?.find((s) => s.slug === sizeSlug)?.buyPrice : p.buyPrice;
    if (typeof buy !== "number" || !(buy > 0)) return null;
    margin += (it.price - buy) * it.quantity;
  }
  return margin;
}

export interface PaymentSplit {
  /** Скільки потрібно оплатити онлайн зараз — або депозит, або повна сума. */
  onlineAmount: number;
  /** Залишок, що оплачується накладеним платежем при отриманні. 0 = оплата повна. */
  codRemainder: number;
  /** true — часткова передоплата (онлайн + залишок на Новій Пошті). */
  isDeposit: boolean;
}

export function getPaymentSplit(total: number, margin: number | null = null): PaymentSplit {
  if (total < COD_MIN_TOTAL) {
    return { onlineAmount: total, codRemainder: 0, isDeposit: false };
  }
  let deposit = COD_DEPOSIT_AMOUNT;
  if (margin !== null) deposit = Math.min(deposit, Math.floor(margin / 10) * 10);
  if (deposit < COD_DEPOSIT_MIN) {
    return { onlineAmount: total, codRemainder: 0, isDeposit: false };
  }
  return {
    onlineAmount: deposit,
    codRemainder: total - deposit,
    isDeposit: true,
  };
}
