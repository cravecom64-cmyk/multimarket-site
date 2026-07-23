"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useCart } from "@/components/CartProvider";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { LandingProduct } from "@/components/LandingProduct";
import { trackViewContent } from "@/lib/pixel";
import {
  getProductBySlug,
  getRelatedProducts,
  getCrossSellProducts,
  getBundleProducts,
} from "@/lib/products";

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const product = getProductBySlug(slug);
  const { addItem } = useCart();
  const [specsOpen, setSpecsOpen] = useState(true);
  const [reviewsOpen, setReviewsOpen] = useState(false);

  // ViewContent для будь-якого варіанту сторінки товару (включно з
  // externalLanding — трекаємо ПЕРЕД редіректом, нижче).
  useEffect(() => {
    if (!product) return;
    trackViewContent({ id: product.id, name: product.name, price: product.price });
    if (product.externalLanding) {
      window.location.href = product.externalLanding;
    }
  }, [product]);

  if (!product) {
    return (
      <div className="px-4 py-20 text-center">
        <div className="text-4xl mb-4">😕</div>
        <div className="text-lg font-bold">Товар не знайдено</div>
        <Link
          href="/"
          className="inline-block mt-4 text-emerald-500 font-semibold text-sm"
        >
          ← На головну
        </Link>
      </div>
    );
  }

  // Готовий бренд-лендинг (окрема сторінка) — редірект виконує useEffect
  // вище (після трекінгу ViewContent), тут просто нічого не рендеримо.
  if (product.externalLanding) {
    return null;
  }

  // Trending products get a unique landing page
  if (product.isTrending && product.landing) {
    return <LandingProduct product={product} />;
  }

  const related = getRelatedProducts(product, 4);
  const crossSell = getCrossSellProducts(product, 4);
  const bundleItems = product.bundleWith ? getBundleProducts(product.bundleWith) : [];
  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;
  const savings = product.oldPrice ? product.oldPrice - product.price : 0;
  const FREE_SHIPPING = 800;
  const remaining = Math.max(0, FREE_SHIPPING - product.price);

  // Parse description markdown (simplified)
  const descHtml = product.description
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, "<br>");

  const featureColors = [
    "bg-emerald-50 text-emerald-600",
    "bg-sky-50 text-sky-600",
    "bg-amber-50 text-amber-600",
    "bg-pink-50 text-pink-600",
  ];

  return (
    <>
      {/* Sub-header with breadcrumb */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <Link href={`/category/${product.category}`} className="text-lg">
          ←
        </Link>
        <span className="text-xs text-gray-400">{product.categoryName}</span>
        <div className="w-5" />
      </div>

      {/* Gallery area */}
      <div className="relative">
        <div className="h-[340px] bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl">{product.emoji}</span>
          )}

          {discount > 0 && (
            <span className="absolute top-3 left-3 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded font-bold">
              -{discount}%
            </span>
          )}

          {product.hasTiktok && (
            <div className="absolute bottom-3 left-3 bg-black/50 text-white text-[9px] px-2 py-1 rounded">
              ♪ Є в TikTok
            </div>
          )}
        </div>

        {/* Thumbnail strip — тільки коли нема реального фото (fallback на emoji-заглушку) */}
        {!product.image && (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide">
            {[product.emoji, product.emoji, product.emoji, "📦"].map((e, i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-md flex-shrink-0 flex items-center justify-center text-lg ${
                  i === 0
                    ? "border-2 border-emerald-500 bg-gray-100"
                    : "border-2 border-transparent bg-gray-100"
                }`}
              >
                {e}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Title & Price */}
      <div className="px-4 mt-1">
        <h1 className="text-[17px] font-extrabold leading-tight">
          {product.name}
        </h1>
        <div className="text-[11px] text-gray-400 mt-1">
          Арт. MM-{product.id.toUpperCase()} · ⭐ {product.rating} (
          {product.reviewCount} відгуків) · {product.orderCount} замовлень
        </div>
        <div className="flex items-center gap-2.5 mt-2">
          <span
            className={`text-2xl font-black ${
              product.oldPrice ? "text-red-500" : ""
            }`}
          >
            {product.price}₴
          </span>
          {product.oldPrice && (
            <>
              <span className="text-sm text-gray-400 line-through">
                {product.oldPrice}₴
              </span>
              <span className="bg-amber-50 text-amber-600 text-[10px] px-2 py-0.5 rounded font-bold">
                Економія {savings}₴
              </span>
            </>
          )}
        </div>
      </div>

      {/* Free shipping progress */}
      <div className="mx-4 mt-3 bg-emerald-50 rounded-lg p-2.5 border border-emerald-200">
        {remaining > 0 ? (
          <>
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>📦 До безкоштовної доставки</span>
              <span className="font-bold text-emerald-600">ще {remaining}₴</span>
            </div>
            <div className="bg-gray-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-full rounded-full"
                style={{
                  width: `${Math.min(100, (product.price / FREE_SHIPPING) * 100)}%`,
                }}
              />
            </div>
            <div className="text-[9px] text-gray-400 mt-1">
              {product.price}₴ з {FREE_SHIPPING}₴ · Додай ще 1 товар!
            </div>
          </>
        ) : (
          <div className="text-center">
            <span className="text-xs font-semibold text-emerald-600">
              ✅ Безкоштовна доставка!
            </span>
          </div>
        )}
      </div>

      {/* Quick features */}
      <div className="flex gap-1.5 px-4 mt-3 flex-wrap">
        {product.features.slice(0, 4).map((f, i) => (
          <span
            key={i}
            className={`text-[9px] px-2 py-1 rounded-full font-semibold ${
              featureColors[i % featureColors.length]
            }`}
          >
            ✓ {f}
          </span>
        ))}
      </div>

      {/* PAS Description */}
      <div className="px-4 mt-4">
        <h3 className="text-[13px] font-extrabold">Опис</h3>
        <div
          className="text-xs leading-relaxed mt-1.5 text-gray-700 [&_strong]:font-bold [&_p]:mt-2"
          dangerouslySetInnerHTML={{ __html: `<p>${descHtml}</p>` }}
        />
      </div>

      {/* Specs Accordion */}
      <div className="mx-4 mt-4 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setSpecsOpen(!specsOpen)}
          className="w-full px-3.5 py-3 flex justify-between items-center"
        >
          <span className="text-xs font-bold">📋 Характеристики</span>
          <span className="text-sm text-gray-400">
            {specsOpen ? "▴" : "▾"}
          </span>
        </button>
        {specsOpen && (
          <div className="px-3.5 pb-3 text-[11px] text-gray-600 space-y-1.5">
            {Object.entries(product.specs).map(([key, val]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-400">{key}</span>
                <span>{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bundle / Upsell */}
      {bundleItems.length > 0 && (() => {
        const bundleTotal = product.price + bundleItems.reduce((s, p) => s + p.price, 0);
        return (
          <div className="mx-4 mt-5 border-2 border-emerald-200 rounded-2xl overflow-hidden">
            <div className="bg-emerald-500 px-4 py-2.5 flex items-center gap-2">
              <span className="text-white text-xs font-bold">🛒 Часто купують разом</span>
              <span className="ml-auto text-white/80 text-[10px]">Одна доставка — менша ціна</span>
            </div>
            <div className="px-4 py-3 space-y-2.5 bg-emerald-50/50">
              {/* Current product */}
              <div className="flex items-center gap-3">
                <span className="text-2xl">{product.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-gray-700 truncate">{product.name}</div>
                  <div className="text-[10px] text-gray-400">Обраний товар</div>
                </div>
                <span className="text-sm font-black text-gray-800">{product.price}₴</span>
              </div>
              {bundleItems.map((bp) => (
                <div key={bp.id} className="flex items-center gap-3 border-t border-emerald-100 pt-2.5">
                  <span className="text-2xl">{bp.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-gray-700 truncate">{bp.name}</div>
                    {bp.oldPrice && (
                      <div className="text-[9px] text-gray-400 line-through">{bp.oldPrice}₴</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-emerald-600">{bp.price}₴</span>
                    <button
                      onClick={() => addItem({ id: bp.id, name: bp.name, price: bp.price, emoji: bp.emoji })}
                      className="w-6 h-6 bg-emerald-500 text-white rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  addItem({ id: product.id, name: product.name, price: product.price, emoji: product.emoji });
                  bundleItems.forEach((bp) => addItem({ id: bp.id, name: bp.name, price: bp.price, emoji: bp.emoji }));
                }}
                className="w-full mt-1 bg-emerald-500 text-white py-3 rounded-xl text-xs font-extrabold tracking-wide"
              >
                🎁 Взяти все разом — {bundleTotal}₴
              </button>
            </div>
          </div>
        );
      })()}

      {/* TikTok Videos — тільки реальні відео, без фейкових ▶-плашок */}
      {product.tiktokVideos && product.tiktokVideos.length > 0 && (
        <div className="px-4 mt-5">
          <h3 className="text-[13px] font-extrabold">📱 Цей товар у TikTok</h3>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
            {product.tiktokVideos.map((v, i) => (
              <a
                key={i}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-[100px] h-[140px] bg-black rounded-xl flex flex-col items-center justify-center relative flex-shrink-0"
              >
                <span className="text-xl opacity-90">▶</span>
                <div className="absolute bottom-2 text-[8px] text-gray-300 text-center">
                  {v.label}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Reviews — реальні написані відгуки; згорнуті за замовчуванням,
          розкриваються по кнопці, щоб не перевантажувати сторінку */}
      <div className="px-4 mt-5">
        <button
          onClick={() => setReviewsOpen(!reviewsOpen)}
          className="w-full flex justify-between items-center"
        >
          <h3 className="text-[13px] font-extrabold">
            💬 Відгуки ({product.reviews?.length ?? 0})
          </h3>
          {product.reviews && product.reviews.length > 0 && (
            <span className="text-[11px] text-amber-500 font-semibold">
              {reviewsOpen ? "Згорнути ▴" : "Показати ▾"}
            </span>
          )}
        </button>
        {reviewsOpen && (
          product.reviews && product.reviews.length > 0 ? (
            <div className="space-y-2 mt-2">
              {product.reviews.map((r, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[11px] font-bold">
                        {r.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold">{r.name}</div>
                        <div className="text-[8px] text-gray-400">
                          {r.city} · {r.daysAgo === 0 ? "сьогодні" : `${r.daysAgo} дні тому`}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-amber-500">
                      {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-700 mt-1.5 leading-relaxed">
                    {r.text}
                  </div>
                  <div className="text-[9px] text-emerald-500 font-semibold mt-1.5">
                    ✓ Підтверджена покупка
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 mt-2 border border-gray-100 text-center">
              <div className="text-[11px] text-gray-500">
                Поки без відгуків — будьте першим, хто розповість про цей товар!
              </div>
            </div>
          )
        )}
      </div>

      {/* Cross-sell */}
      {crossSell.length > 0 && (
        <div className="px-4 mt-5">
          <h3 className="text-[13px] font-extrabold">🛍 З цим купують</h3>
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

      {/* Related */}
      {related.length > 0 && (
        <div className="px-4 mt-5">
          <h3 className="text-[13px] font-extrabold">👀 Схожі товари</h3>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {related.slice(0, 2).map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                slug={p.slug}
                name={p.name}
                price={p.price}
                oldPrice={p.oldPrice}
                emoji={p.emoji}
                rating={p.rating}
                reviewCount={p.reviewCount}
                orderCount={p.orderCount}
                badges={p.badges}
                hasTiktok={p.hasTiktok}
                externalLanding={p.externalLanding}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <Footer />
      </div>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 px-4 py-2.5 flex items-center gap-3 z-40">
        <div className="flex-shrink-0">
          {product.oldPrice && (
            <div className="text-[9px] text-gray-400 line-through">
              {product.oldPrice}₴
            </div>
          )}
          <div
            className={`text-lg font-black ${
              product.oldPrice ? "text-red-500" : ""
            }`}
          >
            {product.price}₴
          </div>
        </div>
        <button
          onClick={() =>
            addItem({
              id: product.id,
              name: product.name,
              price: product.price,
              emoji: product.emoji,
            })
          }
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl text-sm font-extrabold transition-colors"
        >
          Замовити
        </button>
        <button className="w-10 h-10 border-2 border-gray-200 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
          ♡
        </button>
      </div>
    </>
  );
}
