"use client";

import { useCart } from "./CartProvider";

// Плаваюча кнопка кошика — з'являється щойно в кошику є хоч один товар і
// "слідує" за користувачем по всьому сайту (fixed-позиція, не прив'язана
// до конкретної сторінки чи блоку), на відміну від маленької іконки в
// хедері, яку легко не помітити. Показує кількість товарів і суму,
// відкриває той самий CartDrawer по кліку.
export function FloatingCart() {
  const { totalItems, totalPrice, setIsCartOpen } = useCart();

  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => setIsCartOpen(true)}
      // bottom-36 (не bottom-20!) — на сторінці товару внизу вже є власна
      // sticky-панель "Замовити" (bottom-16, z-40, на всю ширину), яка на
      // тій самій висоті що й bottom-20 повністю перекривала б цю кнопку.
      // Піднімаємо вище неї і ставимо z-45, щоб кошик завжди лишався
      // видимим поверх будь-яких sticky-елементів на будь-якій сторінці.
      className="fixed bottom-36 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl pl-3 pr-4 py-2.5 transition-transform hover:scale-105 active:scale-95"
      style={{ left: "max(1rem, calc(50% - 240px + 1rem))", zIndex: 45 }}
      aria-label="Відкрити кошик"
    >
      <span className="relative text-lg leading-none">
        🛒
        <span className="absolute -top-2 -right-2.5 bg-red-500 text-white text-[9px] rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center font-bold">
          {totalItems}
        </span>
      </span>
      <span className="text-sm font-extrabold">{totalPrice}₴</span>
    </button>
  );
}
