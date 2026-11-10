"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { getActiveHeroScenario, formatCountdown } from "@/lib/promo";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroScenario = getActiveHeroScenario();
  const promoActive = heroScenario !== null;
  // Бігучий рядок — замість однієї статичної фрази ротація 2 коротких
  // повідомлень через плавний fade (не "біжучий" зліва-направо текст, той
  // погано читається на ходу). Рішення Павла 10.11.2026. Додаючи новий
  // сезон у HERO_SCENARIOS (src/lib/promo.ts) — tickerMessages підхопиться
  // сам, нічого тут міняти не треба.
  const tickerMessages = heroScenario
    ? (() => {
        const countdown = formatCountdown(heroScenario.countdownTargetIso);
        return countdown
          ? [...heroScenario.tickerMessages, `⏳ Залишилось: ${countdown}`]
          : heroScenario.tickerMessages;
      })()
    : [];
  const [tickerIndex, setTickerIndex] = useState(0);
  const [tickerVisible, setTickerVisible] = useState(true);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerHeight, setBannerHeight] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Ротація фраз бігучого рядка: fade-out, зміна тексту, fade-in.
  useEffect(() => {
    if (tickerMessages.length <= 1) return;
    const interval = setInterval(() => {
      setTickerVisible(false);
      setTimeout(() => {
        setTickerIndex((i) => (i + 1) % tickerMessages.length);
        setTickerVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, [tickerMessages.length]);

  // Банер — position: fixed до вікна (а не sticky до хедера), тому він
  // лишається видимим зверху екрана завжди, незалежно від скролу чи
  // будь-яких обгорток. Висоту міряємо реально (текст може перенестись
  // на 2 рядки на вузьких екранах), щоб контент під банером і сам
  // хедер (sticky, з відступом top = висота банера) не стрибали.
  useEffect(() => {
    if (!promoActive) {
      setBannerHeight(0);
      return;
    }
    const measure = () => {
      if (bannerRef.current) setBannerHeight(bannerRef.current.offsetHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [promoActive]);

  return (
    <>
      {promoActive && (
        <>
          <div
            ref={bannerRef}
            className="fixed top-0 left-0 right-0 z-[65] bg-black text-white text-center text-xs font-bold py-2 px-3 max-w-[480px] sm:max-w-[560px] md:max-w-[680px] lg:max-w-[820px] mx-auto"
          >
            <span
              className="ticker-fade inline-block"
              style={{ opacity: tickerVisible ? 1 : 0 }}
            >
              {tickerMessages[tickerIndex] ?? ""}
            </span>
          </div>
          {/* Розпірка — займає місце банера в потоці, бо сам банер fixed і з потоку вийнятий */}
          <div style={{ height: bannerHeight }} aria-hidden />
        </>
      )}
      <header
        className={`sticky z-50 bg-white transition-shadow max-w-[480px] sm:max-w-[560px] md:max-w-[680px] lg:max-w-[820px] mx-auto ${
          scrolled ? "shadow-md" : ""
        }`}
        style={{ top: bannerHeight }}
      >
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