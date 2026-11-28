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
export const COD_DEPOSIT_AMOUNT = 100; // 200 → 100 з 28.11.2026 (рішення Павла)

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
type CatalogRow = { id: string; buyPrice?: number; supplier?: string; sizes?: { slug: string; buyPrice?: number }[] };
const BUY_BY_ID = new Map((productsData as CatalogRow[]).map((p) => [p.id, p]));

// ДОДАНО 14.11.2026 (рішення Павла): VIBER-SHOP не може переадресувати
// накладений платіж на нашу картку після нашої передоплати їм — для товарів
// цього постачальника модель "депозит + наложка" працює некоректно (клієнт
// ризикує заплатити двічі). Тому такі товари — ЗАВЖДИ повна оплата онлайн,
// незалежно від суми замовлення й маржі. Позначаються `supplier: "viber-shop"`
// у products.json (зараз: bk31, bk32, bk33, g12) — додаючи новий товар від
// VIBER-SHOP, не забути поставити це поле.
export function hasViberShopItem(items: MarginItem[]): boolean {
  for (const it of items) {
    if (!it.id) continue;
    const [productId] = it.id.split("__");
    const p = BUY_BY_ID.get(productId);
    if (p?.supplier === "viber-shop") return true;
  }
  return false;
}

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

// ==================== Схема оплати з 28.11.2026 (рішення Павла) ====================
// Клієнт САМ обирає спосіб оплати:
//   1) "full" — повна оплата онлайн зі знижкою FULL_PAY_DISCOUNT (5%). Головний
//      варіант за замовчуванням, доступний для будь-якої суми й будь-якого
//      постачальника (включно з VIBER-SHOP). Такі замовлення не обдзвонюються.
//   2) "cod" — оплата при отриманні: передоплата COD_DEPOSIT_AMOUNT (100₴, але не
//      більше маржі, див. вище) онлайн зараз, залишок — накладеним платежем.
//      Лише від COD_MIN_TOTAL і не для VIBER-SHOP. Такі замовлення ЗАВЖДИ
//      підтверджуються дзвінком (confirm_call = true примусово).
// Знижка рахується від ЦІНИ ОДИНИЦІ (округлення до гривні), а не від суми, щоб
// фіскальний кошик mono/WayForPay (ціна × кількість) збігався з сумою оплати
// до копійки. Маржа кожного видимого товару більша за 5% ціни (перевірено 28.11).
export const FULL_PAY_DISCOUNT = 0.05;
export const FULL_PAY_DISCOUNT_LABEL = "-5%";
export type PayMode = "full" | "cod";

export function discountedUnitPrice(price: number): number {
  return Math.round(price * (1 - FULL_PAY_DISCOUNT));
}

export function goodsTotal(items: MarginItem[]): number {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

/** Сума передоплати для "оплати при отриманні"; null — цей спосіб для кошика недоступний. */
export function codDeposit(items: MarginItem[]): number | null {
  const total = goodsTotal(items);
  if (total < COD_MIN_TOTAL || hasViberShopItem(items)) return null;
  let deposit = COD_DEPOSIT_AMOUNT;
  const margin = orderMargin(items);
  if (margin !== null) deposit = Math.min(deposit, Math.floor(margin / 10) * 10);
  return deposit >= COD_DEPOSIT_MIN ? deposit : null;
}

/** Чому "оплата при отриманні" недоступна (для підказки в UI); null — доступна. */
export function codUnavailableReason(items: MarginItem[]): "min_total" | "viber" | "margin" | null {
  if (hasViberShopItem(items)) return "viber";
  if (goodsTotal(items) < COD_MIN_TOTAL) return "min_total";
  return codDeposit(items) === null ? "margin" : null;
}

export interface PaymentSplit {
  /** Обраний (фактичний) спосіб — "cod" падає у "full", якщо недоступний. */
  mode: PayMode;
  /** Сума товарів за цінами каталогу. */
  goodsTotal: number;
  /** Знижка за повну онлайн-оплату (0 для "cod"). */
  discount: number;
  /** Скільки клієнт платить загалом (товари − знижка). */
  payTotal: number;
  /** Скільки потрібно оплатити онлайн зараз — або передоплата, або повна сума зі знижкою. */
  onlineAmount: number;
  /** Залишок, що оплачується накладеним платежем при отриманні. 0 = оплата повна. */
  codRemainder: number;
  /** true — часткова передоплата (онлайн + залишок на Новій Пошті). */
  isDeposit: boolean;
}

export function getPaymentSplit(items: MarginItem[], mode: PayMode = "full"): PaymentSplit {
  const total = goodsTotal(items);
  if (mode === "cod") {
    const deposit = codDeposit(items);
    if (deposit !== null) {
      return { mode: "cod", goodsTotal: total, discount: 0, payTotal: total, onlineAmount: deposit, codRemainder: total - deposit, isDeposit: true };
    }
  }
  const payTotal = items.reduce((s, i) => s + discountedUnitPrice(i.price) * i.quantity, 0);
  return { mode: "full", goodsTotal: total, discount: total - payTotal, payTotal, onlineAmount: payTotal, codRemainder: 0, isDeposit: false };
}
