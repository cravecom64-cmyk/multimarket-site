import productsData from "@/data/products.json";

export interface LandingFaq {
  q: string;
  a: string;
}

export interface LandingConfig {
  gradient: string;
  accentColor: string;
  heroTitle: string;
  heroSubtitle: string;
  problem: string;
  solution: string;
  socialProof: string;
  faq: LandingFaq[];
  bundleWith: string[];
  urgency: string;
}

export interface ProductReview {
  name: string;
  city: string;
  daysAgo: number;
  rating: number;
  text: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  price: number;
  oldPrice: number | null;
  buyPrice: number;
  emoji: string;
  // Якщо false — товару немає в наявності у постачальника,
  // сайт показує позначку "Немає в наявності" і блокує замовлення
  inStock?: boolean;
  // Реальне фото товару (напр. з готового бренд-лендингу) — якщо задано,
  // картка показує його замість emoji-заглушки. Це ЗАВЖДИ перше/головне
  // фото каталогу (ProductCard, кошик тощо) — незалежно від images[] нижче.
  image?: string;
  // Додаткові фото для галереї на сторінці товару (свайп + мініатюри).
  // Показуються ТІЛЬКИ на /product/[slug], НЕ в картках каталогу. Якщо не
  // задано — сторінка товару показує один image, як і раніше. Порядок
  // важливий: перше зображення показується першим у галереї. Не дублюй
  // сюди сам image — компонент сам додає його першим слайдом.
  images?: string[];
  rating: number;
  reviewCount: number;
  orderCount: number;
  season: string;
  shortDesc: string;
  description: string;
  features: string[];
  specs: Record<string, string>;
  // Приховане службове поле для пошуку (НЕ показується покупцю ніде на
  // сайті) — старі/знайомі покупцям назви чи коди моделі, щоб пошук за
  // ними теж знаходив картку, навіть якщо в тексті картки їх більше немає.
  searchKeywords?: string;
  // Практичні поради з використання (комплектація, що треба докупити окремо,
  // як заряджати/підключати) — тільки факти з опису постачальника, без
  // вигадування. Рендериться окремим видимим блоком на сторінці товару.
  usageTips?: string[];
  // Техніка безпеки / застереження (захист від перевантаження, КЗ,
  // перегріву; вимоги до газового балона; батарейки не в комплекті тощо) —
  // теж тільки з опису постачальника. Показується з іконкою попередження.
  safetyNotes?: string[];
  // Розгорнуті розділи опису (SEO + відповіді покупцю), згорнуті за
  // замовчуванням через <details> — текст завжди є в HTML для Google.
  // body: міні-markdown — **жирний**, [текст](/внутрішнє-посилання),
  // рядки "• " = список, порожній рядок = новий абзац.
  details?: { title: string; body: string }[];
  // Вага з упаковкою, кг (для доставки в Merchant Center). Якщо нема — береться specs["Вага"].
  weightKg?: number;
  badges: string[];
  bundleWith?: string[];
  // Вручну підібрані СПРАВДІ схожі товари (той самий тип продукту чи
  // пряма альтернатива) — використовується в блоці "Схожі товари" замість
  // випадкового топу по замовленнях у категорії
  similarWith?: string[];
  // Кольорові варіанти товару — якщо задано, на сторінці товару показуються
  // свотчі вибору кольору, що перемикають фото. hex — колір кружечка-свотча,
  // image — головне (hero) фото товару саме в цьому кольорі. images —
  // опційна міні-галерея ЦЬОГО кольору (hero + спільні банери/деталі товару);
  // якщо не задано, використовується лише image. Масиви всіх кольорів мають
  // бути однакової довжини й порядку слайдів — інакше перемикання кольору
  // може "стрибнути" на інший слайд галереї.
  // soldOut — колір закінчився в постачальника (ставить і знімає щоранкова
  // перевірка /api/cron/check-suppliers). Такий колір не показується на
  // сайті; щойно він знову є — повертається сам.
  colors?: { name: string; hex: string; image: string; images?: string[]; soldOut?: boolean }[];
  // Розмірні варіанти товару з РІЗНОЮ ціною (напр. довжина шланга, розмір
  // гамака) — якщо задано, на сторінці товару показується селектор розміру,
  // що перемикає price/oldPrice/buyPrice. Верхньорівневі price/oldPrice/
  // buyPrice товару завжди дублюють варіант з default:true (для каталогу,
  // ProductCard, схема.org — вони показують один товар без варіантів).
  // slug — унікальний суфікс варіанту для id товару в кошику
  // (`${product.id}__${slug}`), щоб різні розміри не зливались в один
  // рядок кошика.
  sizes?: {
    slug: string;
    label: string;
    price: number;
    oldPrice: number | null;
    buyPrice: number;
    default?: boolean;
  }[];
  landing?: LandingConfig;
  // Готовий бренд-лендинг товару (окрема сторінка в public/landing) — якщо задано,
  // картка товару і /product/[slug] ведуть туди замість стандартного шаблону
  externalLanding?: string;
  // Реальні написані відгуки — якщо порожньо/немає, сторінка товару показує
  // чесний стан "поки без відгуків" замість фейкового захардкодженого відгуку
  reviews?: ProductReview[];
  // "М'яке приховування" — товар прибирається з каталогу/категорій/головної/
  // sitemap/товарного фіда (Meta/Google), але залишається в products.json і
  // його сторінка /product/[slug] і далі відкривається за прямим посиланням
  // (щоб не втрачати індексацію Google). Використовується для сезонних
  // товарів поза сезоном (07.10.2026, запит Павла: влітку "вентилятор/
  // кондиціонер/комарі" актуальні, взимку — ні, а показувати їх у каталозі
  // поза сезоном штучно роздуває кількість товарів). Той самий прапорець
  // виключає товар і з щоденного моніторингу наявності/цін у постачальників
  // (/api/cron/check-suppliers) — немає сенсу перевіряти те, чого немає на
  // вітрині. Щоб повернути товар навесні — просто прибрати isHidden.
  isHidden?: boolean;
}

// Рейтинг і кількість оцінок рахуються ТІЛЬКИ з реальних відгуків (reviews[]).
// Статичні rating/reviewCount у products.json ігноруються (були вигадані).
// Немає відгуків → reviewCount = 0, і вітрина не показує зірки взагалі.
const products: Product[] = (productsData as unknown as Product[]).map((p) => {
  const real = p.reviews ?? [];
  const count = real.length;
  const avg = count
    ? Math.round((real.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : 0;
  // Кольори, що закінчились, прибираємо з вибору. Якщо закінчився перший
  // (головний) колір — головним фото картки стає перший доступний.
  let colors = p.colors;
  let image = p.image;
  if (colors && colors.some((c) => c.soldOut)) {
    const available = colors.filter((c) => !c.soldOut);
    if (available.length > 0) {
      if (image === colors[0].image) image = available[0].image;
      colors = available;
    }
  }
  return { ...p, colors, image, rating: avg, reviewCount: count };
});

// Товари, видимі на вітрині (каталог/категорії/головна/sitemap/фід) —
// isHidden-товари виключені звідусіль, КРІМ прямого доступу за slug
// (getProductBySlug нижче навмисно читає сирий products[], а не цю
// функцію) — сторінка товару лишається доступною за посиланням.
function visibleProducts(): Product[] {
  return products.filter((p) => !p.isHidden);
}

export function getAllProducts(): Product[] {
  return visibleProducts();
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return visibleProducts().filter((p) => p.category === category);
}

export function getTopProducts(limit = 8): Product[] {
  return [...visibleProducts()]
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

export function getSaleProducts(): Product[] {
  return visibleProducts().filter((p) => p.oldPrice && p.oldPrice > p.price);
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  // Пріоритет — вручну підібрані справді схожі товари (той самий тип
  // продукту: інший гамак, інший вентилятор, інший блендер тощо), а не
  // просто топ-продажі в тій самій категорії.
  const curated = (product.similarWith ?? [])
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => !!p && p.id !== product.id && !p.isHidden);

  if (curated.length >= limit) return curated.slice(0, limit);

  // Якщо є хоча б один кураторський збіг — довіряємо йому і НЕ розбавляємо
  // випадковим топ-продажем з категорії: деякі категорії (напр. "home")
  // містять товари абсолютно різних типів (кондиціонер, блендер, лампа...),
  // тож "топ по замовленнях у категорії" може підсунути зовсім не схожий
  // товар (напр. блендер під кондиціонером). Добираємо філлером лише коли
  // куратор взагалі нічого не задав для цього товару.
  if (curated.length > 0) return curated;

  // similarWith: [] (порожній масив, а не відсутнє поле) означає "куратор
  // свідомо перевірив і не знайшов жодного справді схожого товару в
  // каталозі" (напр. останній товар свого типу лишився сам) — тоді чесно
  // не показуємо блок "Схожі товари" замість того, щоб підсовувати
  // випадковий топ-продаж з категорії.
  if (product.similarWith && product.similarWith.length === 0) return [];

  const filler = visibleProducts()
    .filter((p) => p.id !== product.id && p.category === product.category)
    .sort((a, b) => b.orderCount - a.orderCount);

  return filler.slice(0, limit);
}

export function getCrossSellProducts(product: Product, limit = 4): Product[] {
  // Пріоритет — вручну підібрані логічно сумісні товари (bundleWith):
  // те, що реально доповнює обраний товар, а не випадковий топ з інших категорій.
  const curated = (product.bundleWith ?? [])
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => !!p && p.id !== product.id && !p.isHidden);

  if (curated.length >= limit) return curated.slice(0, limit);

  // Так само як у getRelatedProducts — якщо куратор щось задав, це і
  // показуємо. Раніше філлер завжди добивав список до 4 товарів топ-продажем
  // з інших категорій, тому майже кожна картка рекомендувала купити разом
  // один і той самий хітовий товар (напр. міні-кондиціонер) незалежно від
  // того, чи має це сенс.
  if (curated.length > 0) return curated;

  const filler = visibleProducts()
    .filter((p) => p.id !== product.id && p.category !== product.category)
    .sort((a, b) => b.orderCount - a.orderCount);

  return filler.slice(0, limit);
}

export function getBundleProducts(ids: string[]): Product[] {
  return ids
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => !!p);
}

export const categories = [
  {
    slug: "home",
    name: "Дім і затишок",
    emoji: "🏠",
    gradient: "from-[#2D3748] to-[#4A5568]",
    productCount: visibleProducts().filter((p) => p.category === "home").length,
  },
  {
    slug: "garden",
    name: "Сад і подвір'я",
    emoji: "🌿",
    gradient: "from-[#1B4332] to-[#2D6A4F]",
    productCount: visibleProducts().filter((p) => p.category === "garden").length,
  },
  {
    slug: "pets",
    name: "Улюбленцям",
    emoji: "🐾",
    gradient: "from-[#4A1D6A] to-[#7C3AED]",
    productCount: visibleProducts().filter((p) => p.category === "pets").length,
  },
  {
    slug: "blackout",
    name: "Блекаут",
    emoji: "🔦",
    gradient: "from-[#18181B] to-[#F59E0B]",
    productCount: visibleProducts().filter((p) => p.category === "blackout").length,
  },
  {
    slug: "newyear",
    name: "Новорічні товари",
    emoji: "🎄",
    gradient: "from-[#14532D] to-[#B91C1C]",
    productCount: visibleProducts().filter((p) => p.category === "newyear").length,
  },
];

// Вага товару в кг: явне поле weightKg або розбір specs["Вага"]
// ("270 г", "1,9 кг", "456 г (з упаковкою)"). null — якщо невідомо.
export function getWeightKg(p: Product): number | null {
  if (typeof p.weightKg === "number") return p.weightKg;
  const raw = p.specs?.["Вага"];
  if (!raw) return null;
  const m = String(raw).replace(",", ".").match(/([\d.]+)\s*(кг|г)/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!isFinite(v)) return null;
  return m[2].toLowerCase() === "кг" ? v : v / 1000;
}
