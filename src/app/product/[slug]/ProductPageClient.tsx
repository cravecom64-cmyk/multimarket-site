"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useCart } from "@/components/CartProvider";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { trackViewContent } from "@/lib/pixel";
import { trackViewContent as trackViewContentGA4 } from "@/lib/ga4";
import {
  getProductBySlug,
  getRelatedProducts,
  getCrossSellProducts,
  getBundleProducts,
} from "@/lib/products";

export function ProductPageClient() {
  const params = useParams();
  const slug = params.slug as string;
  const product = getProductBySlug(slug);
  const { addItem, setIsCartOpen } = useCart();
  const [specsOpen, setSpecsOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  // ViewContent для будь-якого варіанту сторінки товару (включно з
  // externalLanding — трекаємо ПЕРЕД редіректом, нижче).
  useEffect(() => {
    if (!product) return;
    trackViewContent({ id: product.id, name: product.name, price: product.price, category: product.categoryName });
    trackViewContentGA4({ id: product.id, name: product.name, price: product.price, category: product.categoryName });
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

  const related = getRelatedProducts(product, 4);
  const crossSell = getCrossSellProducts(product, 4);
  const bundleItems = product.bundleWith ? getBundleProducts(product.bundleWith) : [];
  const discount = product.oldPrice
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;
  const savings = product.oldPrice ? product.oldPrice - product.price : 0;
  const FREE_SHIPPING = 2000;
  const remaining = Math.max(0, FREE_SHIPPING - product.price);
  const hasColors = product.colors && product.colors.length > 0;
  const activeImage = hasColors ? product.colors![selectedColor].image : product.image;
  // Галерея з декількох фото — тільки коли є images[] і нема вибору кольору
  // (колір і так перемикає фото, поєднувати з галереєю поки не потрібно).
  const galleryImages =
    !hasColors && product.images && product.images.length > 0
      ? [product.image, ...product.images].filter((img): img is string => Boolean(img))
      : undefined;

  const scrollToImage = (i: number) => {
    setSelectedImage(i);
    galleryScrollRef.current?.scrollTo({
      left: i * galleryScrollRef.current.clientWidth,
      behavior: "smooth",
    });
  };

  const handleGalleryScroll = () => {
    const el = galleryScrollRef.current;
    if (!el || el.clientWidth === 0) return;
    setSelectedImage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const orderName = hasColors
    ? `${product.name} (${product.colors![selectedColor].name})`
    : product.name;
  const inStock = product.inStock !== false;
  // Колишні tiktok-лендинги мали власний фірмовий градієнт під фото —
  // залишаємо його тут (тільки як фон галереї), решта структури тепер
  // ідентична звичайній картці товару. Tailwind не вміє статично
  // проаналізувати динамічний arbitrary-value клас із JSON, тому парсимо
  // рядок "from-[#xxx] to-[#yyy]" вручну і застосовуємо як inline style
  // (той самий підхід, що раніше був у LandingProduct.tsx).
  let galleryBgStyle: { background: string } | undefined;
  if (product.landing) {
    const gradientParts = product.landing.gradient
      .replace("from-[", "")
      .replace("] to-[", ",")
      .replace("]", "")
      .split(",");
    galleryBgStyle = {
      background: `linear-gradient(135deg, ${gradientParts[0]} 0%, ${gradientParts[1]} 100%)`,
    };
  }

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

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image ? `https://multi-market.com.ua${product.image}` : undefined,
    description: product.shortDesc,
    sku: `MM-${product.id.toUpperCase()}`,
    brand: { "@type": "Brand", name: "Multimarket" },
    offers: {
      "@type": "Offer",
      url: `https://multi-market.com.ua/product/${product.slug}`,
      priceCurrency: "UAH",
      price: product.price,
      availability:
        product.inStock === false
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

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
        {galleryImages ? (
          <div
            ref={galleryScrollRef}
            onScroll={handleGalleryScroll}
            className="aspect-square flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          >
            {galleryImages.map((img, i) => (
              <div key={i} className="w-full h-full flex-shrink-0 snap-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`${product.name} — фото ${i + 1}`}
                  className={`w-full h-full object-cover ${!inStock ? "grayscale opacity-60" : ""}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`aspect-square flex items-center justify-center relative overflow-hidden ${
              galleryBgStyle ? "" : "bg-gradient-to-br from-gray-800 to-gray-900"
            }`}
            style={galleryBgStyle}
          >
            {activeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeImage}
                alt={product.name}
                className={`w-full h-full object-cover ${!inStock ? "grayscale opacity-60" : ""}`}
              />
            ) : (
              <span className="text-6xl">{product.emoji}</span>
            )}
          </div>
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

        {!inStock && (
          <span className="absolute top-3 right-3 bg-gray-900/85 text-white text-[10px] px-2.5 py-1 rounded-full font-bold">
            Немає в наявності
          </span>
        )}

        {/* Крапки-індикатори поверх галереї (тільки коли більше 1 фото) */}
        {galleryImages && galleryImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {galleryImages.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === selectedImage ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Мініатюри під галереєю */}
        {galleryImages && galleryImages.length > 1 ? (
          <div className="flex gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide">
            {galleryImages.map((img, i) => (
              <button
                key={i}
                onClick={() => scrollToImage(i)}
                aria-label={`Фото ${i + 1}`}
                className={`w-14 h-14 rounded-md flex-shrink-0 overflow-hidden border-2 ${
                  i === selectedImage ? "border-emerald-500" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          !product.image && (
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
          )
        )}
      </div>

      {/* Color swatches */}
      {hasColors && (
        <div className="flex items-center gap-2.5 px-4 mt-3">
          <span className="text-gray-400 text-xs font-semibold">Колір:</span>
          {product.colors!.map((c, i) => (
            <button
              key={c.name}
              onClick={() => setSelectedColor(i)}
              aria-label={c.name}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${
                i === selectedColor
                  ? "border-gray-900 scale-110"
                  : "border-gray-200"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
          <span className="text-gray-700 text-xs font-semibold ml-0.5">
            {product.colors![selectedColor].name}
          </span>
        </div>
      )}

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

      {/* Як користуватися — тільки факти з опису постачальника, завжди видимо (не в акордеоні) */}
      {product.usageTips && product.usageTips.length > 0 && (
        <div className="mx-4 mt-4 bg-sky-50 border border-sky-200 rounded-xl p-3.5">
          <h3 className="text-[12px] font-bold text-sky-900">🔧 Як користуватися</h3>
          <ul className="mt-1.5 space-y-1">
            {product.usageTips.map((tip, i) => (
              <li key={i} className="text-[11px] text-sky-900/80 leading-relaxed flex gap-1.5">
                <span className="text-sky-500">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Техніка безпеки — тільки факти з опису постачальника, завжди видимо */}
      {product.safetyNotes && product.safetyNotes.length > 0 && (
        <div className="mx-4 mt-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
          <h3 className="text-[12px] font-bold text-amber-900">⚠️ Техніка безпеки</h3>
          <ul className="mt-1.5 space-y-1">
            {product.safetyNotes.map((note, i) => (
              <li key={i} className="text-[11px] text-amber-900/80 leading-relaxed flex gap-1.5">
                <span className="text-amber-500">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Характеристики + Відгуки — одна під одною, обидві згорнуті за замовчуванням */}
      <div className="mx-4 mt-4 space-y-2">
        {/* Specs Accordion */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setSpecsOpen(!specsOpen)}
            className="w-full px-3.5 py-3 flex justify-between items-center"
          >
            <span className="text-[12px] font-bold">📋 Характеристики</span>
            <span className="text-sm text-gray-400">
              {specsOpen ? "▴" : "▾"}
            </span>
          </button>
          {specsOpen && (
            <div className="px-3.5 pb-3 text-[11px] text-gray-600 space-y-1.5">
              {Object.entries(product.specs).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-400">{key}</span>
                  <span className="font-semibold text-gray-700">{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviews Accordion — реальні написані відгуки; згорнуті за
            замовчуванням, розкриваються по кнопці, щоб не перевантажувати сторінку */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setReviewsOpen(!reviewsOpen)}
            className="w-full px-3.5 py-3 flex justify-between items-center"
          >
            <span className="text-[12px] font-bold">
              💬 Відгуки ({product.reviews?.length ?? 0})
            </span>
            <span className="text-sm text-gray-400">
              {reviewsOpen ? "▴" : "▾"}
            </span>
          </button>
          {reviewsOpen && (
            product.reviews && product.reviews.length > 0 ? (
              <div className="px-3.5 pb-3 space-y-2">
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
              <div className="px-3.5 pb-3">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center">
                  <div className="text-[11px] text-gray-500">
                    Поки без відгуків — будьте першим, хто розповість про цей товар!
                  </div>
                </div>
              </div>
            )
          )}
        </div>
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
                <div className="w-11 h-11 rounded-lg bg-white border border-emerald-100 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                  {activeImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={activeImage} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    product.emoji
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-gray-700 truncate">{product.name}</div>
                  <div className="text-[10px] text-gray-400">Обраний товар</div>
                </div>
                <span className="text-sm font-black text-gray-800">{product.price}₴</span>
              </div>
              {bundleItems.map((bp) => (
                <div key={bp.id} className="flex items-center gap-3 border-t border-emerald-100 pt-2.5">
                  <Link
                    href={bp.externalLanding || `/product/${bp.slug}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="w-11 h-11 rounded-lg bg-white border border-emerald-100 flex items-center justify-center text-xl overflow-hidden flex-shrink-0">
                      {bp.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bp.image} alt={bp.name} className="w-full h-full object-cover" />
                      ) : (
                        bp.emoji
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-gray-700 truncate">{bp.name}</div>
                      {bp.oldPrice && (
                        <div className="text-[9px] text-gray-400 line-through">{bp.oldPrice}₴</div>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-sm font-black text-emerald-600">{bp.price}₴</span>
                    <button
                      onClick={() => addItem({ id: bp.id, name: bp.name, price: bp.price, emoji: bp.emoji, image: bp.image, slug: bp.slug, category: bp.category, categoryName: bp.categoryName })}
                      className="w-6 h-6 bg-emerald-500 text-white rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  if (!inStock) return;
                  addItem({ id: product.id, name: orderName, price: product.price, emoji: product.emoji, image: product.image, slug: product.slug, category: product.category, categoryName: product.categoryName });
                  bundleItems.forEach((bp) => addItem({ id: bp.id, name: bp.name, price: bp.price, emoji: bp.emoji, image: bp.image, slug: bp.slug, category: bp.category, categoryName: bp.categoryName }));
                  setIsCartOpen(true);
                }}
                disabled={!inStock}
                className={`w-full mt-1 py-3 rounded-xl text-xs font-extrabold tracking-wide ${
                  inStock
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {inStock ? `🎁 Взяти все разом — ${bundleTotal}₴` : "Немає в наявності"}
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

      {/* Cross-sell */}
      {crossSell.length > 0 && (
        <div className="px-4 mt-5">
          <h3 className="text-[13px] font-extrabold">🛍 З цим купують</h3>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-2 scrollbar-hide">
            {crossSell.map((p) => (
              <div key={p.id} className="w-[140px] flex-shrink-0">
                <ProductCard
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
          onClick={() => {
            if (!inStock) return;
            addItem({
              id: product.id,
              name: orderName,
              price: product.price,
              emoji: product.emoji,
              image: product.image,
              slug: product.slug,
              category: product.category,
              categoryName: product.categoryName,
            });
            setIsCartOpen(true);
          }}
          disabled={!inStock}
          className={`flex-1 py-3.5 rounded-xl text-sm font-extrabold transition-colors ${
            inStock
              ? "bg-emerald-500 hover:bg-emerald-600 text-white"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {inStock ? "Замовити" : "Немає в наявності"}
        </button>
        <button className="w-10 h-10 border-2 border-gray-200 rounded-lg flex items-center justify-center text-lg flex-shrink-0">
          ♡
        </button>
      </div>
    </>
  );
}
