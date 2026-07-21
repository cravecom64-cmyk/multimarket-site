"use client";

import { useCart } from "./CartProvider";
import { useState } from "react";
import { OrderModal } from "./OrderModal";

export function CartDrawer() {
  const {
    items,
    removeItem,
    updateQuantity,
    totalPrice,
    totalItems,
    isCartOpen,
    setIsCartOpen,
  } = useCart();
  const [showOrder, setShowOrder] = useState(false);

  const FREE_SHIPPING = 800;
  const remaining = Math.max(0, FREE_SHIPPING - totalPrice);

  if (!isCartOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[70] overlay" onClick={() => setIsCartOpen(false)}>
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex justify-between items-center px-4 pb-3">
            <h2 className="text-lg font-extrabold">
              🛒 Кошик {totalItems > 0 && `(${totalItems})`}
            </h2>
            <button
              onClick={() => setIsCartOpen(false)}
              className="text-gray-400 text-xl"
            >
              ✕
            </button>
          </div>

          {/* Empty state */}
          {items.length === 0 && (
            <div className="px-4 py-12 text-center">
              <div className="text-4xl mb-3">🛒</div>
              <div className="text-sm font-semibold text-gray-500">
                Кошик порожній
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Але це легко виправити — каталог чекає 😉
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="mt-4 bg-emerald-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold"
              >
                Дивитись каталог
              </button>
            </div>
          )}

          {/* Items */}
          {items.length > 0 && (
            <>
              <div className="flex-1 overflow-y-auto px-4 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100"
                  >
                    <div className="text-2xl w-10 h-10 flex items-center justify-center bg-gray-200 rounded-lg flex-shrink-0">
                      {item.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">
                        {item.name}
                      </div>
                      <div className="text-sm font-extrabold mt-0.5">
                        {item.price * item.quantity}₴
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        className="w-7 h-7 rounded-full bg-gray-200 text-sm font-bold flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="text-sm font-bold w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="w-7 h-7 rounded-full bg-gray-200 text-sm font-bold flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-300 hover:text-red-400 text-lg flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Free shipping bar */}
              <div className="px-4 pt-3">
                {remaining > 0 ? (
                  <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
                    <div className="flex justify-between text-[10px] text-gray-600">
                      <span>📦 До безкоштовної доставки</span>
                      <span className="font-bold text-emerald-600">
                        ще {remaining}₴
                      </span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (totalPrice / FREE_SHIPPING) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-200 text-center">
                    <span className="text-xs font-semibold text-emerald-600">
                      ✅ Безкоштовна доставка!
                    </span>
                  </div>
                )}
              </div>

              {/* Total + CTA */}
              <div className="px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-500">Разом:</span>
                  <span className="text-xl font-extrabold">{totalPrice}₴</span>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setShowOrder(true);
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl text-base font-extrabold transition-colors"
                >
                  Оформити замовлення
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showOrder && <OrderModal onClose={() => setShowOrder(false)} />}
    </>
  );
}