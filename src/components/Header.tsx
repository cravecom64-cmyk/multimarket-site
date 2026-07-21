"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { useState, useEffect } from "react";

export function Header() {
  const { totalItems, setIsCartOpen } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 bg-white transition-shadow max-w-[480px] mx-auto ${
          scrolled ? "shadow-md" : ""
        }`}
      >
        {/* Marquee */}
        <div className="bg-amber-500 overflow-hidden whitespace-nowrap py-1.5">
          <div className="inline-block animate-marquee text-[11px] text-white font-medium">
            &nbsp;&nbsp;📦 Безкоштовна доставка НП від 800₴ &nbsp;&nbsp;·&nbsp;&nbsp;
            💰 Оплата при отриманні — нічим не ризикуєш &nbsp;&nbsp;·&nbsp;&nbsp;
            ⚡ Замовляй до 15:00 — відправимо сьогодні &nbsp;&nbsp;·&nbsp;&nbsp;
            🔥 Знижки до -25% на товари для саду &nbsp;&nbsp;·&nbsp;&nbsp;
            📦 Безкоштовна доставка НП від 800₴ &nbsp;&nbsp;·&nbsp;&nbsp;
            💰 Оплата при отриманні — нічим не ризикуєш &nbsp;&nbsp;·&nbsp;&nbsp;
            ⚡ Замовляй до 15:00 — відправимо сьогодні &nbsp;&nbsp;·&nbsp;&nbsp;
            🔥 Знижки до -25% на товари для саду
          </div>
        </div>

        {/* Nav bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <button
            onClick={() => setMenuOpen(true)}
            className="text-lg p-1"
            aria-label="Меню"
          >
            ☰
          </button>
          <Link href="/" className="text-[17px] font-extrabold tracking-wider">
            MULTIMARKET
          </Link>
          <div className="flex gap-3.5 items-center">
            <Link href="/" className="text-lg p-1" aria-label="Пошук">
              🔍
            </Link>
            <button
              onClick={() => setIsCartOpen(true)}
              className="text-lg p-1 relative"
              aria-label="Кошик"
            >
              🛒
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] overlay" onClick={() => setMenuOpen(false)}>
          <div
            className="bg-white w-72 h-full shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-4 right-4 text-2xl text-gray-400"
            >
              ✕
            </button>
            <div className="text-lg font-extrabold tracking-wider mb-8">MULTIMARKET</div>
            <nav className="flex flex-col gap-4">
              <Link
                href="/category/home"
                className="text-base font-semibold hover:text-emerald-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                🏠 Дім і затишок
              </Link>
              <Link
                href="/category/garden"
                className="text-base font-semibold hover:text-emerald-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                🌿 Сад і подвір&apos;я
              </Link>
              <Link
                href="/category/pets"
                className="text-base font-semibold hover:text-emerald-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                🐾 Улюбленцям
              </Link>
              <Link
                href="/trending"
                className="text-base font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                🔥 Зараз у тренді
              </Link>
              <hr className="my-2" />
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-gray-800"
                onClick={() => setMenuOpen(false)}
              >
                📦 Доставка і оплата
              </Link>
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-gray-800"
                onClick={() => setMenuOpen(false)}
              >
                ↩️ Повернення
              </Link>
              <Link
                href="/"
                className="text-sm text-gray-500 hover:text-gray-800"
                onClick={() => setMenuOpen(false)}
              >
                ❓ FAQ
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}