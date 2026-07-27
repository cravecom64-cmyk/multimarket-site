"use client";

import { getTrendingProducts } from "@/lib/products";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";

const trending = getTrendingProducts();

export default function TrendingPage() {
  return (
    <>
      {/* Hero */}
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#F59E0B] px-6 py-7 relative overflow-hidden">
        <div className="absolute top-3 right-4 text-[80px] leading-none opacity-20 select-none">
          🔥
        </div>
        <h1 className="text-xl font-extrabold text-white leading-tight relative">
          Зараз у тренді
        </h1>
        <p className="text-[11px] text-white/80 mt-2 leading-relaxed relative">
          Товари які вибухають у TikTok прямо зараз.
          <br />
          Кожен — перевірений і з реальними відгуками.
        </p>
      </div>

      {/* Trending Grid */}
      <div className="grid grid-cols-2 gap-2.5 px-3 mt-5">
        {trending.map((product, i) => (
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
            rank={i + 1}
            inStock={product.inStock}
            hasTiktok={product.hasTiktok}
            externalLanding={product.externalLanding}
          />
        ))}
      </div>

      <div className="mt-6">
        <Footer />
      </div>
    </>
  );
}
