"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { Footer } from "@/components/Footer";
import {
  getTopProducts,
  getSaleProducts,
  getAllProducts,
  getTrendingProducts,
  categories,
} from "@/lib/products";

const saleProducts = getSaleProducts();
const topProducts = getTopProducts(4);
const tiktokProducts = getAllProducts().filter((p) => p.hasTiktok);
const trendingProducts = getTrendingProducts();

const reviews = [
  {
    name: "Оксана М.",
    initial: "О",
    color: "bg-emerald-500",
    city: "Київ",
    date: "3 дні тому",
    stars: 5,
    product: "Лизальний килимок для собак",
    text: "Замовляла для лабрадора — тепер годування це не хаос, а спокій на 15 хвилин. Якість силікону супер, присоски тримаються навіть на плитці. Доставка НП за 2 дні, все запаковано акуратно.",
    hasPhotos: true,
    likes: 12,
  },
  {
    name: "Андрій К.",
    initial: "А",
    color: "bg-indigo-500",
    city: "Дніпро",
    date: "5 днів тому",
    stars: 5,
    product: "Solar фонарі-факели (4 шт)",
    text: 'Поставив вздовж доріжки до альтанки — ввечері виглядає просто вау. Жінка каже наче в ресторані. Заряджаються за день, світять до 3-ї ночі. За ці гроші — подарунок.',
    hasPhotos: false,
    likes: 8,
  },
  {
    name: "Марина Т.",
    initial: "М",
    color: "bg-pink-500",
    city: "Одеса",
    date: "тиждень тому",
    stars: 4,
    product: 'LED Нічник "Зоряне небо"',
    text: "Дитина в захваті, засинає за 10 хвилин замість години. Проекція дуже гарна, 16 кольорів реально є. Мінус — кабель коротенький, довелося подовжувач тягнути. Але сам нічник топ, рекомендую.",
    hasPhotos: true,
    likes: 19,
  },
];

const trustItems = [
  {
    emoji: "📦",
    title: "Відправка сьогодні",
    desc: "Замовив до 15:00 — ввечері трекінг",
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
  return (
    <>
      {/* Hero Banner */}
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-[#1E3A5F] to-[#2D5A8E] px-6 py-7 relative overflow-hidden">
        <h1 className="text-xl font-extrabold text-white leading-tight">
          Знайшли в TikTok.
          <br />
          Перевірили.
          <br />
          Відправляємо сьогодні.
        </h1>
        <p className="text-[11px] text-blue-200 mt-2 leading-relaxed">
          Штуки для дому, саду і улюбленців —
          <br />
          тільки те, що реально працює.
        </p>
        <Link
          href="/category/home"
          className="inline-block mt-3.5 bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold"
        >
          Дивитись каталог
        </Link>
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
          Товари які зараз вибухають у TikTok
        </p>
        <div className="flex gap-2.5 mt-2.5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {trendingProducts.map((product) => {
            const gradientParts = product.landing?.gradient
              .replace("from-[", "")
              .replace("] to-[", ",")
              .replace("]", "")
              .split(",") || ["#333", "#555"];
            return (
              <Link
                key={product.id}
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
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
                <div className="text-white/60 text-[9px] mt-1 relative">
                  {product.orderCount} замовлень
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Акції */}
      <section className="mt-5 px-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-extrabold">🔥 Акції та спецціни</h2>
          <span className="text-[11px] text-amber-500 font-semibold">
            Всі акції →
          </span>
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Встигни поки є. Кількість обмежена.
        </p>
        <div className="flex gap-2.5 mt-2.5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {saleProducts.map((product) => (
            <div key={product.id} className="min-w-[155px] snap-start">
              <ProductCard
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
                hasTiktok={product.hasTiktok}
                externalLanding={product.externalLanding}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Топ продажів */}
      <section className="mt-5 px-4">
        <h2 className="text-base font-extrabold">
          🏆 Їх замовляють найчастіше
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
              price={product.price}
              oldPrice={product.oldPrice}
              emoji={product.emoji}
              image={product.image}
              rating={product.rating}
              reviewCount={product.reviewCount}
              orderCount={product.orderCount}
              badges={product.badges}
              rank={i + 1}
              hasTiktok={product.hasTiktok}
              externalLanding={product.externalLanding}
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

      {/* TikTok */}
      <section className="mt-6 px-4">
        <h2 className="text-base font-extrabold">
          📱 Бачив у TikTok? Купуй тут
        </h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Ці товари зараз крутяться у наших відео
        </p>
        <div className="flex gap-2 mt-2.5 overflow-x-auto pb-2 scrollbar-hide">
          {tiktokProducts.slice(0, 5).map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="min-w-[110px] h-[150px] bg-black rounded-xl flex flex-col items-center justify-center relative flex-shrink-0"
            >
              <span className="text-3xl">{product.emoji}</span>
              <div className="absolute bottom-2 text-[9px] text-gray-300 text-center leading-tight px-2">
                {product.name.split(" ").slice(0, 2).join(" ")}
              </div>
              <div className="absolute top-1.5 left-1.5 text-[8px] text-white bg-white/15 px-1.5 py-0.5 rounded">
                ♪ TikTok
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Відгуки */}
      <section className="mt-6 px-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-extrabold">💬 Відгуки покупців</h2>
          <span className="text-[11px] text-amber-500 font-semibold">
            Всі відгуки →
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-lg font-extrabold text-amber-500">4.8</span>
          <span className="text-sm text-amber-500">★★★★★</span>
          <span className="text-[11px] text-gray-400">
            на основі 124 відгуків
          </span>
        </div>

        <div className="mt-2.5 space-y-2">
          {reviews.map((r, i) => (
            <div
              key={i}
              className="bg-gray-50 rounded-xl p-3.5 border border-gray-100"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full ${r.color} flex items-center justify-center text-white text-[13px] font-bold`}
                  >
                    {r.initial}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold">{r.name}</div>
                    <div className="text-[9px] text-gray-400">
                      {r.city} · {r.date}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-amber-500">
                  {"★".repeat(r.stars)}
                  {r.stars < 5 && (
                    <span className="text-gray-300">
                      {"★".repeat(5 - r.stars)}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-[10px] font-semibold text-emerald-500 mt-2">
                {r.product}
              </div>
              <div className="text-[11px] text-gray-700 mt-1 leading-relaxed">
                {r.text}
              </div>
              {r.hasPhotos && (
                <div className="flex gap-1.5 mt-2">
                  <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center text-sm">
                    📷
                  </div>
                  <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center text-sm">
                    📷
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                <span>👍 {r.likes}</span>
                <span className="ml-2 text-emerald-500 font-semibold">
                  ✓ Підтверджена покупка
                </span>
              </div>
            </div>
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
