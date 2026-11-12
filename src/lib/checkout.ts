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

export interface PaymentSplit {
  /** Скільки потрібно оплатити онлайн зараз — або депозит, або повна сума. */
  onlineAmount: number;
  /** Залишок, що оплачується накладеним платежем при отриманні. 0 = оплата повна. */
  codRemainder: number;
  /** true — часткова передоплата (онлайн + залишок на Новій Пошті). */
  isDeposit: boolean;
}

export function getPaymentSplit(total: number): PaymentSplit {
  if (total < COD_MIN_TOTAL) {
    return { onlineAmount: total, codRemainder: 0, isDeposit: false };
  }
  return {
    onlineAmount: COD_DEPOSIT_AMOUNT,
    codRemainder: total - COD_DEPOSIT_AMOUNT,
    isDeposit: true,
  };
}
