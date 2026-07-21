"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useMemo } from "react";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { getProductsByCategory, categories, getCrossSellProducts } from "@/lib/products";

type SortMode = "popular" | "cheap" | "expensive";

const categoryMeta: Record<
  string,
  { subtitle: string; promo: string; promoSub: string }
> = {
  home: {
    subtitle: "Нічники, кухня, організація, декор",
    promo: "🎁 3 нічники = знижка -20%",
    promoSub: "Ідеально для дитячої + спальня + коридор",
  },
  garden: {
    subtitle: "Solar фонарі, декор, антимоскітне, меблі",
    promo: "☀️ Solar комплект — знижка -15%",
    promoSub: "Фонарі + фонтан = подвір'я мрії",
  },
  pets: {
    subtitle: "Грумінг, іграшки, гігієна, прогулянки",
    promo: "🐾 2 товари для улюбленця = -10%",
    promoSub: "Обирай будь-які 2 і економ",
  },
};

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [sort, setSort] = useState<SortMode>("popular");

  const category = categories.find((c) => c.slug === slug);
  const meta = categoryMeta[slug];
  const products = getProductsByCategory(slug);

  const sorted = useMemo(() => {
    const arr = [...products];
    switch (sort) {
      case "cheap":
        return arr.sort((a, b) => a.price - b.price);
      case "expensive":
        return arr.sort((a, b) => b.price - a.price);
      default:
        return arr.sort((a, b) => b.orderCount - a.orderCount);
    }
  }, [products, sort]);

  // Cross-sell: products from OTHER categories
  const crossSell = products[0] ? getCrossSellProducts(products[0], 4) : [];

  const totalOrders = products.reduce((s, p) => s + p.orderCount, 0);
  const avgRating =
    products.length > 0
      ? (products.reduce((s, p) => s + p.rating, 0) / products.length).toFixed(1)
      : "0";

  if (!category) {
    return (
      <div className="px-4 py-20 text-center">
        <div className="text-4xl mb-4">😕</div>
        <div className="text-lg font-bold">Категорію не знайдено</div>
        <Link
          href="/"
          className="inline-block mt-4 text-emerald-500 font-semibold text-sm"
        >
          ← На головну
        </Link>
      </div>
    );
  }

  const sortButtons: { mode: SortMode; label: string }[] = [
    { mode: "popular", label: "🔥 Популярне" },
    { mode: "cheap", label: "💰 Дешевше" },
    { mode: "expensive", label: "💎 Дорожче" },
  ];

  return (
    <>
      {/* Category Hero */}
      <div
        className={`mx-3 mt-3 rounded-2xl bg-gradient-to-br ${category.gradient} px-5 py-6`}
      >
        <h1 className="text-[22px] font-extrabold text-white leading-tight">
          {category.emoji} {category.name}
        </h1>
        <div className="text-[11px] text-white/60 mt-1.5">
          {products.length} товарів · {meta?.subtitle}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[10px] text-amber-400">★★★★★</span>
          <span className="text-[10px] text-white/50">
            {avgRating} · {totalOrders} замовлень
          </span>
        </div>
      </div>

      {/* Promo Banner */}
      {meta && (
        <div className="mx-3 mt-3 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl px-4 py-3 flex justify-between items-center">
          <div>
            <div className="text-xs font-extrabold text-white">
              {meta.promo}
            </div>
            <div className="text-[10px] text-white/80 mt-0.5">
              {meta.promoSub}
            </div>
          </div>
          <span className="text-white text-base">→</span>
        </div>
      )}

      {/* Sort Bar */}
      <div className="flex gap-1.5 px-3 mt-3 overflow-x-auto scrollbar-hide">
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
      <div className="grid grid-cols-2 gap-2.5 px-3 mt-3">
        {sorted.map((product, i) => (
          <ProductCard
            key={product.id}
            id={product.id}
            slug={product.slug}
            name={product.name}
            price={product.price}
            oldPrice={product.oldPrice}
            emoji={product.emoji}
            image={product.image}
            rating={product.rating}
            reviewCount={product.reviewCount}
            orderCount={product.orderCount}
            badges={product.badges}
            rank={sort === "popular" ? i + 1 : undefined}
            hasTiktok={product.hasTiktok}
            externalLanding={product.externalLanding}
          />
        ))}
      </div>

      {/* Cross-sell from other categories */}
      {crossSell.length > 0 && (
        <div className="px-4 mt-6">
          <h3 className="text-[13px] font-extrabold">
            🛍 Також дивляться
          </h3>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-2 scrollbar-hide">
            {crossSell.map((p) => (
              <div key={p.id} className="min-w-[140px] flex-shrink-0">
                <ProductCard
                  id={p.id}
                  slug={p.slug}
                  name={p.name}
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
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other categories */}
      <div className="px-4 mt-6">
        <h3 className="text-[13px] font-extrabold">📂 Інші категорії</h3>
        <div className="mt-2 flex flex-col gap-2">
          {categories
            .filter((c) => c.slug !== slug)
            .map((cat) => (
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
