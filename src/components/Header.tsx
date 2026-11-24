"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { getActiveHeroScenario, formatCountdown } from "@/lib/promo";
import { searchProducts, trackSearchQuery } from "@/lib/search";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // ДОДАНО 24.11.2026 (запит Павла — хоче "випереджувальну" підказку прямо з
  // іконки пошуку в шапці, як на великих маркетплейсах, а не лише на окремій
  // сторінці /search). Логіка пошуку й трекінгу запитів винесена в
  // @/lib/search, щоб тут і на /search вона не розбігалась.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchLastTrackedRef = useRef<string>("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Той самий debounce-трекінг (900мс), що й на сторінці /search — щоб
  // пошуки з шапки так само потрапляли в аналітику Павла.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) return;

    searchDebounceRef.current = setTimeout(() => {
      const normalized = q.toLowerCase();
      if (searchLastTrackedRef.current === normalized) return;
      searchLastTrackedRef.current = normalized;
      trackSearchQuery(q, searchProducts(q).length);
    }, 900);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const trimmedSearch = searchQuery.trim();
  const searchMatches = trimmedSearch ? searchProducts(trimmedSearch) : [];
  const searchResults = searchMatches.slice(0, 5);
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
        className={`sticky z-50 bg-white transition-shadow max-w-[480px] sm:max-w-[560px] md:max-w-[680px] lg:max-w-[820px] mx-auto relative ${
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
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="text-lg p-1"
              aria-label="Пошук"
            >
              {searchOpen ? "✕" : "🔍"}
            </button>
          </div>
        </div>

        {/* Випадаюча підказка пошуку — результати з'являються одразу під час
            набору (без Enter, без переходу на окрему сторінку), як на
            великих маркетплейсах. Повний список з усіма фільтрами й блоком
            "Популярні товари" лишається на /search — тут лише швидкий
            перегляд перших 5 збігів. */}
        {searchOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg px-4 py-3 z-10">
            <div className="relative mb-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                🔍
              </span>
              <input
                ref={searchInputRef}
                type="text"
                inputMode="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Що шукаємо? Напр. нічник, гамак, вентилятор..."
                className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
                  aria-label="Очистити пошук"
                >
                  ✕
                </button>
              )}
            </div>

            {trimmedSearch && searchResults.length > 0 && (
              <div className="flex flex-col gap-1">
                {searchResults.map((p) => (
                  <Link
                    key={p.id}
                    href={`/product/${p.slug}`}
                    onClick={closeSearch}
                    className="flex items-center gap-2.5 py-1.5 hover:bg-gray-50 rounded-lg px-1 -mx-1"
                  >
                    <div className="text-xl w-9 h-9 relative flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        p.emoji
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{p.name}</div>
                      <div className="text-xs font-extrabold text-emerald-600">{p.price}₴</div>
                    </div>
                  </Link>
                ))}
                {searchMatches.length > searchResults.length && (
                  <Link
                    href={`/search?q=${encodeURIComponent(trimmedSearch)}`}
                    onClick={closeSearch}
                    className="text-center text-xs font-semibold text-emerald-600 py-2 mt-1 border-t border-gray-100"
                  >
                    Переглянути всі {searchMatches.length} результатів
                  </Link>
                )}
              </div>
            )}

            {trimmedSearch && searchResults.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-3">
                Нічого не знайшли за &quot;{trimmedSearch}&quot;
              </div>
            )}
          </div>
        )}
      </header>

      {/* Бекдроп — клік поза підказкою закриває її. z-40, нижче за z-50
          хедера, щоб саме поле пошуку й іконка лишались клікабельними. */}
      {searchOpen && (
        <div className="fixed inset-0 z-40 overlay" onClick={closeSearch} />
      )}

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