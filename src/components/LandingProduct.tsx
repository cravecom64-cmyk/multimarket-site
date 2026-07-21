"use client";

import { useState } from "react";
import { Product, getBundleProducts } from "@/lib/products";
import { useCart } from "./CartProvider";
import { ProductCard } from "./ProductCard";

interface LandingProductProps {
  product: Product;
}

export function LandingProduct({ product }: LandingProductProps) {
  const { addItem, totalPrice } = useCart();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const landing = product.landing!;
  const bundleProducts = getBundleProducts(landing.bundleWith);

  const savings = product.oldPrice ? product.oldPrice - product.price : 0;
  const freeShipLeft = Math.max(0, 800 - product.price);
  const freeShipProgress = Math.min(100, (product.price / 800) * 100);

  // Dynamic gradient style from landing config
  const gradientParts = landing.gradient
    .replace("from-[", "")
    .replace("] to-[", ",")
    .replace("]", "")
    .split(",");
  const gradientStyle = {
    background: `linear-gradient(135deg, ${gradientParts[0]} 0%, ${gradientParts[1]} 100%)`,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden" style={gradientStyle}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 text-[120px] leading-none select-none">
            {product.emoji}
          </div>
        </div>
        <div className="relative px-5 pt-8 pb-10">
          {/* Back link */}
          <a href="/" className="inline-flex items-center text-white/70 text-xs mb-6 hover:text-white">
            ← Головна
          </a>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-4"
            style={{ backgroundColor: `${landing.accentColor}33`, color: "white" }}>
            🔥 ТРЕНД
          </div>

          {/* Hero title */}
          <h1 className="text-2xl font-black text-white leading-tight mb-3">
            {landing.heroTitle}
          </h1>
          <p className="text-sm text-white/80 leading-relaxed mb-6">
            {landing.heroSubtitle}
          </p>

          {/* Product visual */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center mb-6">
            <div className="text-7xl mb-3">{product.emoji}</div>
            <div className="text-white font-bold text-lg">{product.name}</div>
          </div>

          {/* Price block */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-white">{product.price}₴</span>
              {product.oldPrice && (
                <span className="text-lg text-white/50 line-through">{product.oldPrice}₴</span>
              )}
              {savings > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  −{savings}₴
                </span>
              )}
            </div>
            {landing.urgency && (
              <div className="text-xs text-amber-300 font-semibold mt-2">
                ⚡ {landing.urgency}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== PROBLEM → SOLUTION ===== */}
      <section className="px-5 py-8">
        {/* Problem */}
        <div className="bg-red-50 border border-red-100 rounded-xl p-5 mb-4">
          <div className="text-sm font-bold text-red-700 mb-2">😤 Знайома ситуація?</div>
          <p className="text-sm text-red-800 leading-relaxed">{landing.problem}</p>
        </div>

        {/* Arrow */}
        <div className="text-center text-2xl my-2">↓</div>

        {/* Solution */}
        <div className="border-2 rounded-xl p-5" style={{ borderColor: landing.accentColor, backgroundColor: `${landing.accentColor}08` }}>
          <div className="text-sm font-bold mb-2" style={{ color: landing.accentColor }}>
            ✅ Рішення
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{landing.solution}</p>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="px-5 pb-8">
        <h2 className="text-lg font-black mb-4">Що всередині</h2>
        <div className="grid grid-cols-2 gap-3">
          {product.features.map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3.5 text-center">
              <div className="text-2xl mb-1">{["✨", "💪", "🎯", "⚡", "🛡️", "🎨"][i % 6]}</div>
              <div className="text-xs font-semibold text-gray-700">{f}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== SOCIAL PROOF ===== */}
      <section className="px-5 pb-8">
        <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg, ${landing.accentColor}10, ${landing.accentColor}05)` }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-yellow-500 text-sm">{"★".repeat(5)}</span>
            <span className="text-sm font-bold text-gray-700">{product.rating}</span>
            <span className="text-xs text-gray-400">({product.reviewCount} відгуків)</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{landing.socialProof}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <span>📦 {product.orderCount} замовлень</span>
            <span>·</span>
            <span>🔥 Тренд TikTok</span>
          </div>
        </div>
      </section>

      {/* ===== SPECS ===== */}
      {Object.keys(product.specs).length > 0 && (
        <section className="px-5 pb-8">
          <h2 className="text-lg font-black mb-4">Характеристики</h2>
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            {Object.entries(product.specs).map(([key, val], i) => (
              <div key={key} className={`flex justify-between px-4 py-3 text-sm ${i > 0 ? "border-t border-gray-100" : ""}`}>
                <span className="text-gray-500">{key}</span>
                <span className="font-semibold text-gray-800">{val}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== BUNDLE / UPSELL ===== */}
      {bundleProducts.length > 0 && (
        <section className="px-5 pb-8">
          <h2 className="text-lg font-black mb-2">Часто беруть разом</h2>
          {freeShipLeft > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              Додай ще на {freeShipLeft}₴ — доставка безкоштовна 🚚
            </p>
          )}

          {/* Free shipping progress bar */}
          <div className="bg-gray-100 rounded-full h-2 mb-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${freeShipProgress}%`,
                backgroundColor: freeShipProgress >= 100 ? "#10B981" : landing.accentColor,
              }}
            />
          </div>

          <div className="space-y-3">
            {bundleProducts.map((bp) => (
              <div key={bp.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="text-3xl">{bp.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{bp.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black" style={{ color: landing.accentColor }}>{bp.price}₴</span>
                    {bp.oldPrice && (
                      <span className="text-xs text-gray-400 line-through">{bp.oldPrice}₴</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => addItem({
                    id: bp.id,
                    name: bp.name,
                    price: bp.price,
                    emoji: bp.emoji,
                  })}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: landing.accentColor }}
                >
                  + Додати
                </button>
              </div>
            ))}
          </div>

          {/* Bundle deal */}
          <button
            onClick={() => {
              addItem({
                id: product.id,
                name: product.name,
                price: product.price,
                emoji: product.emoji,
              });
              bundleProducts.forEach((bp) =>
                addItem({
                  id: bp.id,
                  name: bp.name,
                  price: bp.price,
                  emoji: bp.emoji,
                })
              );
            }}
            className="w-full mt-4 py-3.5 rounded-xl text-sm font-bold text-white transition-transform active:scale-[0.98]"
            style={{ backgroundColor: landing.accentColor }}
          >
            🎁 Взяти все разом — {product.price + bundleProducts.reduce((s, p) => s + p.price, 0)}₴
          </button>
        </section>
      )}

      {/* ===== FAQ ===== */}
      {landing.faq.length > 0 && (
        <section className="px-5 pb-8">
          <h2 className="text-lg font-black mb-4">Питання та відповіді</h2>
          <div className="space-y-2">
            {landing.faq.map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-4 py-3.5 text-left flex justify-between items-center"
                >
                  <span className="text-sm font-semibold text-gray-800 pr-4">{item.q}</span>
                  <span className="text-gray-400 text-lg shrink-0">
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== TRUST ===== */}
      <section className="px-5 pb-8">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-lg mb-0.5">📦</div>
            <div className="text-[11px] font-semibold text-gray-600">Нова Пошта 1-2 дні</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-lg mb-0.5">💰</div>
            <div className="text-[11px] font-semibold text-gray-600">Оплата при отриманні</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-lg mb-0.5">↩️</div>
            <div className="text-[11px] font-semibold text-gray-600">Повернення 14 днів</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-lg mb-0.5">💬</div>
            <div className="text-[11px] font-semibold text-gray-600">Підтримка в Telegram</div>
          </div>
        </div>
      </section>

      {/* ===== STICKY CTA ===== */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50">
        <div className="mx-3 rounded-2xl shadow-2xl p-3 text-white"
          style={{ backgroundColor: landing.accentColor }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-black">{product.price}₴</div>
              {product.oldPrice && (
                <div className="text-xs text-white/60 line-through">{product.oldPrice}₴</div>
              )}
            </div>
            <button
              onClick={() => addItem({
                id: product.id,
                name: product.name,
                price: product.price,
                emoji: product.emoji,
              })}
              className="bg-white text-gray-900 px-6 py-3 rounded-xl text-sm font-extrabold active:scale-[0.97] transition-transform"
            >
              🛒 Замовити
            </button>
          </div>
        </div>
      </div>

      {/* Bottom spacer for sticky CTA */}
      <div className="h-24" />
    </div>
  );
}
