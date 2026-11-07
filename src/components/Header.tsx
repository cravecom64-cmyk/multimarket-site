"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { PROMO, isPromoActive } from "@/lib/promo";

export function Header() {
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
        className={`sticky top-0 z-50 bg-white transition-shadow max-w-[480px] sm:max-w-[560px] md:max-w-[680px] lg:max-w-[820px] mx-auto ${
          scrolled ? "shadow-md" : ""
        }`}
      >
        {/* Promo banner — всередині sticky-хедера, тому завжди видима при скролі */}
        {isPromoActive() && (
          <div className="bg-black text-white text-center text-xs font-bold py-2 px-3">
            🖤 {PROMO.name} — знижки на все до {PROMO.endsAtLabel}
          </div>
        )}

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
            <Link href="/search" className="text-lg p-1" aria-label="Пошук">
              🔍
            </Link>
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
                href="/catalog"
                className="text-base font-semibold hover:text-emerald-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                🛍️ Весь каталог
              </Link>
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
                href="/category/blackout"
                className="text-base font-semibold hover:text-emerald-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                🔦 Блекаут
              </Link>
              <Link
                href="/category/newyear"
                className="text-base font-semibold hover:text-emerald-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                🎄 Новорічні товари
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