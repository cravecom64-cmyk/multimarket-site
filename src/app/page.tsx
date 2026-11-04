"use client";

import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { InfiniteScrollRow } from "@/components/InfiniteScrollRow";
import {
  getSaleProducts,
  getAllProducts,
  getTrendingProducts,
  categories,
} from "@/lib/products";
import { usePopularityMap, rankProducts } from "@/lib/popularityClient";

const saleProducts = getSaleProducts();
const trendingProducts = getTrendingProducts();

// Реальні відгуки, скопійовані з products.json (той самий текст, що й на
// сторінках товарів) — щоб на головній не було фейкових відгуків під
// товари, яких у каталозі взагалі нема.

const trustItems = [
  {
    emoji: "📦",
    title: "Відправка 1-3 дні",
    desc: "Новою Поштою по всій Україні",
  },
  {
    emoji: "💰",
    title: "Наложка НП",
    desc: "Спочатку бачиш — потім платиш",
  },
  {
    emoji: "↩️",
    title: "Повернення 14 днів",
    desc: "Без зайвих питань",
  },
  {
    emoji: "✅",
    title: "Перевіряємо кожен",
    desc: "Контроль якості до відправки",
  },
];

export default function HomePage() {
  // Живе ранжування "Топ продажів" — переглядів/кошика/покупок за 30 днів
  // (product_events у Supabase), з фолбеком на orderCount, поки даних
  // немає. Див. lib/popularityClient.ts.
  const popularityMap = usePopularityMap();
  const topProducts = rankProducts(getAllProducts(), popularityMap).slice(0, 4);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Organization",
                name: "Multimarket",
                url: "https://www.multi-market.com.ua",
                sameAs: ["https://t.me/multimarket_ua"],
              },
              {
                "@type": "WebSite",
                name: "Multimarket",
                url: "https://www.multi-market.com.ua",
              },
            ],
          }),
        }}
      />
      {/* Hero Banner */}
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8E] px-6 py-7 relative overflow-hidden">
        <h1 className="text-xl font-extrabold text-white leading-tight">
          Перевіряємо товар.
          <br />
          Оплата при отриманні.
          <br />
          Відправка 1-3 дні.
        </h1>
        <p className="text-[11px] text-blue-200 mt-2 leading-relaxed">
          Товари для дому, саду й тварин — і все необхідне
          <br />
          на випадок відключень світла. Готуйся заздалегідь.
        </p>
        <div className="flex items-center gap-2 mt-3.5 flex-wrap">
          <Link
            href="/category/home"
            className="inline-block bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold"
          >
            Дивитись каталог
          </Link>
          <Link
            href="/category/blackout"
            className="inline-block bg-white/15 text-white px-4 py-2.5 rounded-lg text-xs font-bold border border-white/30"
          >
            🔦 На випадок блекауту
          </Link>
        </div>
      </div>

      {/* 🔥 Зараз у тренді */}
      <section className="mt-5 px-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-extrabold">🔥 Зараз у тренді</h2>
          <Link href="/trending" className="text-[11px] text-amber-500 font-semibold">
            Всі тренди →
          </Link>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Топ-8 популярних — переважно блекаут-набір
        </p>
        <InfiniteScrollRow
          items={trendingProducts}
          keyFn={(product) => product.id}
          className="flex gap-2.5 mt-2.5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
          renderItem={(product) => {
            const gradientParts = product.landing?.gradient
              .replace("from-[", "")
              .replace("] to-[", ",")
              .replace("]", "")
              .split(",") || ["#333", "#555"];
            return (
              <Link
                href={product.externalLanding || `/product/${product.slug}`}
                className="min-w-[160px] h-[200px] rounded-xl flex flex-col items-center justify-center relative flex-shrink-0 snap-start overflow-hidden"
                style={
                  product.image
                    ? undefined
                    : {
                        background: `linear-gradient(135deg, ${gradientParts[0]} 0%, ${gradientParts[1]} 100%)`,
                      }
                }
              >
                {product.image && (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                )}
                {product.image && (
                  <div className="absolute inset-0 bg-black/35" />
                )}
                <div className="absolute top-2 left-2 bg-white/20 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
                  🔥 ТРЕНД
                </div>
                {!product.image && (
                  <span className="text-4xl mb-2">{product.emoji}</span>
                )}
                <div className="text-white text-[11px] font-bold text-center leading-tight px-3 relative">
                  {product.name}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 relative">
                  <span className="text-white text-sm font-black">{product.price}₴</span>
                  {product.oldPrice && (
                    <span className="text-white/50 text-[10px] line-through">{product.oldPrice}₴</span>
                  )}
                </div>
              </Link>
            );
          }}
        />
      </section>

      {/* Акції */}
      <section className="mt-5 px-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-extrabold">🔥 Акції та спецціни</h2>
          <Link href="/sale" className="text-[11px] text-amber-500 font-semibold">
            Всі акції →
          </Link>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Встигни поки є. Кількість обмежена.
        </p>
        <InfiniteScrollRow
          items={saleProducts}
          keyFn={(product) => product.id}
          className="flex gap-2.5 mt-2.5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
          renderItem={(product) => (
            <div className="w-[155px] flex-shrink-0 snap-start">
              <ProductCard
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
                externalLanding={product.externalLanding}
                inStock={product.inStock}
              />
            </div>
          )}
        />
      </section>

      {/* Топ продажів */}
      <section className="mt-5 px-4">
        <h2 className="text-base font-extrabold">
          🏆 Найпопулярніше
        </h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Перевірено сотнями покупців. Ці товари не повертають.
        </p>
        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          {topProducts.map((product, i) => (
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
              externalLanding={product.externalLanding}
              inStock={product.inStock}
            />
          ))}
        </div>
      </section>

      {/* Каталог */}
      <section className="mt-6 px-4">
        <h2 className="text-base font-extrabold">📂 Каталог</h2>
        <div className="mt-2.5 flex flex-col gap-2">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`bg-gradient-to-r ${cat.gradient} rounded-xl px-5 py-4 flex justify-between items-center`}
            >
              <div>
                <div className="text-[15px] font-bold text-white">
                  {cat.emoji} {cat.name}
                </div>
                <div className="text-[10px] text-white/60 mt-0.5">
                  {cat.productCount} товарів
                </div>
              </div>
              <span className="text-white text-lg">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trust Bar */}
      <div className="mx-3 mt-5 grid grid-cols-2 gap-2">
        {trustItems.map((item, i) => (
          <div
            key={i}
            className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100"
          >
            <div className="text-lg">{item.emoji}</div>
            <div className="text-[10px] font-bold mt-1">{item.title}</div>
            <div className="text-[9px] text-gray-400">{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-5">
        <Footer />
      </div>
    </>
  );
}
