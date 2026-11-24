"use client";

import { useState, useEffect, useRef } from "react";
import { isInternalVisit } from "@/lib/analytics";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getAllProducts, getTopProducts, type Product } from "@/lib/products";
import { trackSearch } from "@/lib/pixel";
import { trackSearch as trackSearchGA4 } from "@/lib/ga4";

const allProducts = getAllProducts();

// ДОДАНО 24.11.2026 (запит Павла — покупець шукав "гірлянди", хоча товари в
// каталозі є, і нічого не знайшов). Стара реалізація шукала всю фразу запиту
// одним суцільним підрядком у тексті товару — і ламалась у двох типових
// випадках: (1) українські слова відмінюються/мають множину ("гірлянди" НЕ є
// підрядком "гірлянда" — рядки відрізняються лише останньою літерою), і
// (2) покупець вставляє в пошук цілу фразу з реклами на кшталт "Гірлянда 6 за
// 69 грн" — жоден товар не містить цю фразу дослівно, хоча "гірлянда" там є.
// Нова версія розбиває запит на слова, рахує скільки слів знайшлось (а не
// вимагає збігу всієї фрази), і для кожного слова, крім точного підрядка,
// пробує "нечіткий" збіг по спільному префіксу — щоб "гірлянди"/"гірлянда",
// "лампи"/"лампа", "ліхтарик"/"ліхтар" вважались тим самим словом. Це проста
// евристика (без лематизації/стемера чи зовнішніх бібліотек), а не повноцінна
// мовна обробка — працює через те, що українські словоформи зазвичай
// відрізняються лише останніми 1-2 літерами. Короткі службові слова (за, та,
// і, для, з...) ігноруються — інакше вони "роздмухують" кількість збігів для
// будь-якого товару і псують сортування за релевантністю.
const SEARCH_STOPWORDS = new Set([
  "за", "та", "і", "й", "в", "у", "на", "до", "від", "або", "це", "що", "як",
  "для", "з", "із", "зі", "не", "по", "під", "над", "при", "без", "же", "чи",
  "и", "но", "или", "от",
]);

function tokenize(text: string, dropStopwords = false): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-zа-яіїєґ0-9]+/)
    .filter((w) => w.length >= 2);
  return dropStopwords ? words.filter((w) => !SEARCH_STOPWORDS.has(w)) : words;
}

// Два слова вважаються збігом, якщо одне містить інше підрядком (типовий
// випадок — "лампа" входить у "лампочка"), або — для слів від 4 літер — якщо
// в них спільний префікс довжиною "довжина мінус 2 літери" (щонайменше 4):
// так "гірлянди" і "гірлянда" (різняться лише останньою літерою) чи "лампи" і
// "лампа" визнаються тим самим словом, не потребуючи точного відмінка.
// Короткі слова (менше 4 літер) порівнюються лише точним підрядком — без
// цього захисту фрагмент на кшталт "мА" (од. виміру, мАг) в описі товару міг
// би випадково "зійтись" з початком геть не пов'язаного слова.
function wordMatch(queryWord: string, haystackWord: string): boolean {
  if (queryWord.length < 2 || haystackWord.length < 2) return false;
  if (haystackWord.includes(queryWord)) return true;
  const minLen = Math.min(queryWord.length, haystackWord.length);
  if (minLen < 4) return false;
  const prefixLen = Math.max(4, minLen - 2);
  return queryWord.slice(0, prefixLen) === haystackWord.slice(0, prefixLen);
}

function searchProducts(query: string): Product[] {
  const withoutStopwords = tokenize(query, true);
  // Якщо запит складався ЛИШЕ зі службових слів — не ріжемо все до нуля,
  // шукаємо по них як є (краще щось, ніж пустий результат на порожньому
  // масиві слів).
  const queryWords = withoutStopwords.length > 0 ? withoutStopwords : tokenize(query);
  if (queryWords.length === 0) return [];

  const scored = allProducts
    .map((p) => {
      const haystack = `${p.name} ${p.shortDesc} ${p.categoryName} ${p.searchKeywords ?? ""}`;
      const haystackWords = tokenize(haystack);
      const matchedCount = queryWords.filter((qw) =>
        haystackWords.some((hw) => wordMatch(qw, hw))
      ).length;
      return { product: p, matchedCount };
    })
    .filter((r) => r.matchedCount > 0);

  // Товари, де збіглося більше слів запиту — вище; при рівності — популярніші
  // (orderCount) вище, той самий принцип "найкраще спочатку", що й в інших
  // місцях каталогу (напр. філлер у getRelatedProducts).
  scored.sort(
    (a, b) => b.matchedCount - a.matchedCount || b.product.orderCount - a.product.orderCount
  );
  return scored.map((r) => r.product);
}

export function SearchPageClient() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTrackedRef = useRef<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Трекінг пошукових запитів — щоб Павло міг швидко бачити що люди шукають
  // на сайті (і чого бракує в каталозі). Шлемо тільки коли користувач
  // перестав друкувати на ~900мс і запит ще не був відправлений цього разу
  // (lastTrackedRef захищає від повторної відправки того самого запиту,
  // напр. при видаленні пробілу в кінці чи повторному фокусі поля).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) return;

    debounceRef.current = setTimeout(() => {
      const normalized = q.toLowerCase();
      if (lastTrackedRef.current === normalized) return;
      lastTrackedRef.current = normalized;

      const count = searchProducts(q).length;
      trackSearch(q, count);
      trackSearchGA4(q, count);
      // Внутрішні пошуки (Павел, перевірки) не пишемо в базу й не шлемо в Telegram
      if (isInternalVisit()) return;
      fetch("/api/track-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, resultsCount: count }),
      }).catch(() => {
        // мовчки ігноруємо — трекінг не має заважати самому пошуку
      });
    }, 900);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const trimmed = query.trim();
  const results = trimmed ? searchProducts(trimmed) : [];
  const popular = getTopProducts(6);

  return (
    <div className="px-4 py-4">
      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          🔍
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Що шукаємо? Напр. нічник, гамак, вентилятор..."
          className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-3 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
            aria-label="Очистити пошук"
          >
            ✕
          </button>
        )}
      </div>

      {!trimmed && (
        <>
          <div className="text-xs font-semibold text-gray-500 mb-2.5">
            🔥 Популярні товари
          </div>
          <div className="grid grid-cols-2 gap-3">
            {popular.map((p, i) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                category={p.category}
                categoryName={p.categoryName}
                price={p.price}
                oldPrice={p.oldPrice}
                emoji={p.emoji}
                image={p.image}
                rating={p.rating}
                reviewCount={p.reviewCount}
                orderCount={p.orderCount}
                badges={p.badges}
                rank={i + 1}
                externalLanding={p.externalLanding}
                inStock={p.inStock}
              />
            ))}
          </div>
        </>
      )}

      {trimmed && results.length > 0 && (
        <>
          <div className="text-xs font-semibold text-gray-500 mb-2.5">
            Знайдено {results.length}{" "}
            {results.length === 1 ? "товар" : "товарів"}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {results.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                category={p.category}
                categoryName={p.categoryName}
                price={p.price}
                oldPrice={p.oldPrice}
                emoji={p.emoji}
                image={p.image}
                rating={p.rating}
                reviewCount={p.reviewCount}
                orderCount={p.orderCount}
                badges={p.badges}
                externalLanding={p.externalLanding}
                inStock={p.inStock}
              />
            ))}
          </div>
        </>
      )}

      {trimmed && results.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-sm font-semibold mb-1">
            Нічого не знайшли за &quot;{trimmed}&quot;
          </div>
          <div className="text-xs text-gray-400 mb-5">
            Спробуй інше слово або переглянь каталог
          </div>
          <Link
            href="/category/home"
            className="inline-block bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
          >
            Переглянути каталог
          </Link>
        </div>
      )}
    </div>
  );
}
