"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { trackAddToCart } from "@/lib/pixel";
import { trackAddToCart as trackAddToCartGA4 } from "@/lib/ga4";
import { trackAddToCartEvent } from "@/lib/analytics";

export interface CartItem {
  // Унікальний ключ рядка кошика. Для звичайного товару = product.id.
  // Для товару з розмірним варіантом (product.sizes) = `${productId}__${sizeSlug}`,
  // щоб різні розміри одного товару не зливались в один рядок з чужою ціною.
  id: string;
  name: string;
  price: number;
  emoji: string;
  quantity: number;
  // Реальне фото товару і slug для посилання на картку — опціональні, щоб
  // не ламати старі/невикористані місця додавання в кошик, які їх ще не
  // передають (напр. legacy LandingProduct.tsx).
  image?: string;
  slug?: string;
  // Категорія товару — потрібна для content_category в подіях Pixel/GA4
  // (вимога ТЗ трекінгу). Опціональна з тих самих причин, що image/slug.
  category?: string;
  categoryName?: string;
  // Справжній id товару в каталозі (products.json) — для варіантних рядків
  // кошика `id` вище є складеним ключем, тут завжди чистий product.id
  // (потрібно для аналітики/трекінгу, які очікують реальний id товару).
  productId?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    // Для трекінгу завжди використовуємо реальний id товару з каталогу
    // (productId), а не складений ключ рядка кошика id__sizeSlug —
    // аналітика має бачити один і той самий товар незалежно від розміру.
    const trackId = item.productId ?? item.id;
    trackAddToCart({
      id: trackId,
      name: item.name,
      price: item.price,
      category: item.categoryName ?? item.category,
    });
    trackAddToCartGA4({
      id: trackId,
      name: item.name,
      price: item.price,
      category: item.categoryName ?? item.category,
    });
    trackAddToCartEvent(trackId);
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
