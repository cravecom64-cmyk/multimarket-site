"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { getAllProducts, categories } from "@/lib/products";
import { usePopularityMap, rankProducts } from "@/lib/popularityClient";

type SortMode = "popular" | "cheap" | "expensive";
type CategoryFilter = "all" | string;

export function CatalogPageClient() {
  const [sort, setSort] = useState<SortMode>("popular");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  // Живе ранжування "🔥 Популярне" — перегляди/кошик/покупки за 30 днів
  // (Supabase product_events), з фолбеком на orderCount, поки даних немає.
  const popularityMap = usePopularityMap();

  const allProducts = useMemo(() => getAllProducts(), []);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return allProducts;
    return allProducts.filter((p) => p.category === activeCategory);
  }, [allProducts, activeCategory]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "cheap":
        return arr.sort((a, b) => a.price - b.price);
      case "expensive":
        return arr.sort((a, b) => b.price - a.price);
      default:
        return rankProducts(arr, popularityMap);
    }
  }, [filtered, sort, popularityMap]);

  const sortButtons: { mode: SortMode; label: string }[] = [
    { mode: "popular", label: "🔥 Популярне" },
    { mode: "cheap", label: "💰 Дешевше" },
    { mode: "expensive", label: "💎 Дорожче" },
  ];

  const categoryButtons: { slug: CategoryFilter; label: string }[] = [
    { slug: "all", label: "🛍️ Всі" },
    ...categories.map((c) => ({ slug: c.slug, label: `${c.emoji} ${c.name}` })),
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Головна",
        item: "https://www.multi-market.com.ua",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Весь каталог",
        item: "https://www.multi-market.com.ua/catalog",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Catalog Hero */}
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-[#2D3748] to-[#4A5568] px-5 py-6">
        <h1 className="text-[22px] font-extrabold text-white leading-tight">
          🛍️ Весь каталог
        </h1>
        <div className="text-[11px] text-white/60 mt-1.5">
          {allProducts.length} товарів · обирай розділ або дивись все одразу
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex gap-1.5 px-3 mt-3 overflow-x-auto scrollbar-hide">
        {categoryButtons.map((btn) => (
          <button
            key={btn.slug}
            onClick={() => setActiveCategory(btn.slug)}
            className={`px-3.5 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${
              activeCategory === btn.slug
                ? "bg-emerald-500 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Sort Bar */}
      <div className="flex gap-1.5 px-3 mt-2 overflow-x-auto scrollbar-hide">
        {sortButtons.map((btn) => (
          <button
            key={btn.mode}
            onClick={() => setSort(btn.mode)}
            className={`px-3.5 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${
              sort === btn.mode
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 px-3 mt-3">
          {sorted.map((product, i) => (
            <ProductCard
              key={product.id}
              id={product.id}
              slug={product.slug}
              name={product.name}
              category={product.category}
              categoryName={product.categoryName}
              price={product.price}
              oldPrice={product.oldPrice}
              emoji={product.emoji}
              image={product.image}
              rating={product.rating}
              reviewCount={product.reviewCount}
              orderCount={product.orderCount}
              badges={product.badges}
              rank={sort === "popular" ? i + 1 : undefined}
              inStock={product.inStock}
              externalLanding={product.externalLanding}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 py-16 text-center">
          <div className="text-4xl mb-3">😕</div>
          <div className="text-sm font-semibold text-gray-500">
            У цьому розділі пока немає товарів
          </div>
        </div>
      )}

      {/* Categories (explicit section links too) */}
      <div className="px-4 mt-6">
        <h3 className="text-[13px] font-extrabold">📂 Розділи каталогу</h3>
        <div className="mt-2 flex flex-col gap-2">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`bg-gradient-to-r ${cat.gradient} rounded-xl px-4 py-3 flex justify-between items-center`}
            >
              <div>
                <div className="text-sm font-bold text-white">
                  {cat.emoji} {cat.name}
                </div>
                <div className="text-[10px] text-white/50">
                  {cat.productCount} товарів
                </div>
              </div>
              <span className="text-white">→</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <Footer />
      </div>
    </>
  );
}
