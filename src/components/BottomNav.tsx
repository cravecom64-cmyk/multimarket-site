"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";

const navItems = [
  { href: "/", icon: "🏠", label: "Головна" },
  { href: "/category/home", icon: "📂", label: "Каталог" },
  { href: "/", icon: "🔍", label: "Пошук" },
  { href: "/", icon: "❤️", label: "Обране" },
  { href: "#cart", icon: "🛒", label: "Кошик" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { setIsCartOpen, totalItems } = useCart();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-100 z-40 flex justify-around items-center py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {navItems.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        if (item.href === "#cart") {
          return (
            <button
              key={item.label}
              onClick={() => setIsCartOpen(true)}
              className="flex flex-col items-center relative"
            >
              <span className="text-base">{item.icon}</span>
              {totalItems > 0 && (
                <span className="absolute -top-1 right-0 bg-red-500 text-white text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
              <span className="text-[8px] text-gray-400 mt-0.5">
                {item.label}
              </span>
            </button>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            className="flex flex-col items-center"
          >
            <span className="text-base">{item.icon}</span>
            <span
              className={`text-[8px] mt-0.5 ${
                isActive
                  ? "text-emerald-500 font-semibold"
                  : "text-gray-400"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}