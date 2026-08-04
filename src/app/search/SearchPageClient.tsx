"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getAllProducts, getTopProducts, type Product } from "@/lib/products";
import { trackSearch } from "@/lib/pixel";
import { trackSearch as trackSearchGA4 } from "@/lib/ga4";

const allProducts = getAllProducts();

function searchProducts(query: string): Product[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return allProducts.filter((p) => {
    const haystack = `${p.name} ${p.shortDesc} ${p.categoryName}`.toLowerCase();
    return haystack.includes(q);
  });
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
                hasTiktok={p.hasTiktok}
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
                hasTiktok={p.hasTiktok}
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
