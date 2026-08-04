"use client";

import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { getSaleProducts } from "@/lib/products";

export default function SalePage() {
  const products = [...getSaleProducts()].sort((a, b) => {
    const discountA = a.oldPrice ? (a.oldPrice - a.price) / a.oldPrice : 0;
    const discountB = b.oldPrice ? (b.oldPrice - b.price) / b.oldPrice : 0;
    return discountB - discountA;
  });

  return (
    <>
      {/* Hero */}
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#F59E0B] px-6 py-7 relative overflow-hidden">
        <div className="absolute top-3 right-4 text-[80px] leading-none opacity-20 select-none">
          🔥
        </div>
        <h1 className="text-xl font-extrabold text-white leading-tight relative">
          Акції та спецціни
        </h1>
        <p className="text-[11px] text-white/80 mt-2 leading-relaxed relative">
          {products.length} товарів зі знижкою прямо зараз.
          <br />
          Кількість обмежена.
        </p>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-2.5 px-3 mt-5">
        {products.map((product, i) => (
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
