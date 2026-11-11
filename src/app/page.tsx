"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import { InfiniteScrollRow } from "@/components/InfiniteScrollRow";
import {
  getHomepageSaleProducts,
  getSaleProducts,
  getAllProducts,
  categories,
} from "@/lib/products";
import { usePopularityMap, rankProducts } from "@/lib/popularityClient";
import { getActiveHeroScenario, formatCountdown } from "@/lib/promo";

const saleProducts = getHomepageSaleProducts();
// Для підзаголовка хіро — загальна кількість товарів зі знижкою по всьому
// сайту (а не лише ті, що потрапили у звужений ряд "Акції та спецціни" на
// головній), щоб цифра відповідала дійсності ("обирай, поки в наявності").
const heroSaleCount = getSaleProducts().length;

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
  const heroScenario = getActiveHeroScenario();
  const heroCountdown = heroScenario ? formatCountdown(heroScenario.countdownTargetIso) : null;

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
      {/* Hero Banner — "розумний" під інфопривід: Black Friday (01.11-30.11),
          Новий рік (01.12-08.01), поза цими періодами — нейтральний дефолт.
          Конфіг періодів: src/lib/promo.ts (HERO_SCENARIOS). Рішення Павла
          10.11.2026: підзаголовок — жива цифра товарів зі знижкою (не
          перелік розділів), фон — ледь помітний CSS-відблиск (.hero-sheen),
          чип з лічильником пульсує (.badge-pulse), кнопки без змін. */}
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8E] px-6 py-7 relative overflow-hidden">
        <div className="hero-sheen" aria-hidden />
        <div className="relative z-10">
          {heroScenario ? (
            <>
              <h1 className="text-xl font-extrabold text-white leading-tight">
                🔥 {heroScenario.headlinePrefix}
                <span className="text-amber-400">{heroScenario.headlineAccent}</span>
              </h1>
              {heroCountdown && (
                <span className="badge-pulse inline-flex items-center gap-1 mt-2 bg-white/15 border border-white/30 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {heroScenario.chipEmoji} Залишилось: {heroCountdown}
                </span>
              )}
            </>
          ) : (
            <h1 className="text-xl font-extrabold text-white leading-tight">
              Перевіряємо товар.
              <br />
              Оплата при отриманні.
              <br />
              Відправка 1-3 дні.
            </h1>
          )}
          <p className="text-[11px] text-blue-200 mt-2 leading-relaxed">
            {heroSaleCount} товарів зі знижкою — обирай, поки в наявності
          </p>
          <div className="flex items-center gap-2 mt-3.5 flex-wrap">
            <Link
              href="/catalog"
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
      </div>

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
