"use client";

import Link from "next/link";
import { getTrendingProducts } from "@/lib/products";
import { Footer } from "@/components/Footer";

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
      <div className="px-4 mt-5 space-y-4">
        {trending.map((product, i) => {
          const landing = product.landing!;
          const gradientParts = landing.gradient
            .replace("from-[", "")
            .replace("] to-[", ",")
            .replace("]", "")
            .split(",");
          const savings = product.oldPrice ? product.oldPrice - product.price : 0;

          return (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="block rounded-2xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${gradientParts[0]} 0%, ${gradientParts[1]} 100%)`,
              }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-1 bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-full mb-2">
                      🔥 #{i + 1} ТРЕНД
                    </div>
                    <h2 className="text-[15px] font-extrabold text-white leading-tight">
                      {landing.heroTitle}
                    </h2>
                    <p className="text-[11px] text-white/70 mt-1 leading-relaxed line-clamp-2">
                      {landing.heroSubtitle}
                    </p>
                  </div>
                  <div className="text-5xl ml-3 shrink-0">{product.emoji}</div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <span className="text-xl font-black text-white">{product.price}₴</span>
                  {product.oldPrice && (
                    <span className="text-sm text-white/50 line-through">{product.oldPrice}₴</span>
                  )}
                  {savings > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      −{savings}₴
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-2 text-[10px] text-white/60">
                  <span>📦 {product.orderCount} замовлень</span>
                  <span>⭐ {product.rating}</span>
                  <span className="ml-auto text-white/80 font-semibold text-[11px]">
                    Детальніше →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        <Footer />
      </div>
    </>
  );
}
