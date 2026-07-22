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
  // Реальне фото товару (напр. з готового бренд-лендингу) — якщо задано,
  // картка показує його замість emoji-заглушки
  image?: string;
  rating: number;
  reviewCount: number;
  orderCount: number;
  season: string;
  tiktokHook: string;
  hasTiktok: boolean;
  shortDesc: string;
  description: string;
  features: string[];
  specs: Record<string, string>;
  badges: string[];
  isTrending?: boolean;
  bundleWith?: string[];
  landing?: LandingConfig;
  // Готовий бренд-лендинг товару (окрема сторінка в public/landing) — якщо задано,
  // картка товару і /product/[slug] ведуть туди замість стандартного шаблону
  externalLanding?: string;
  // Реальні написані відгуки — якщо порожньо/немає, сторінка товару показує
  // чесний стан "поки без відгуків" замість фейкового захардкодженого відгуку
  reviews?: ProductReview[];
  // Реальні посилання на TikTok-відео цього товару — якщо порожньо/немає,
  // блок TikTok не рендериться (замість фейкових ▶-плашок що нічого не грають)
  tiktokVideos?: { label: string; url: string }[];
}

const products: Product[] = productsData as unknown as Product[];

export function getAllProducts(): Product[] {
  return products;
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter((p) => p.category === category);
}

export function getTopProducts(limit = 8): Product[] {
  return [...products]
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

export function getSaleProducts(): Product[] {
  return products.filter((p) => p.oldPrice && p.oldPrice > p.price);
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

export function getCrossSellProducts(product: Product, limit = 4): Product[] {
  return products
    .filter((p) => p.category !== product.category)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
}

export function getTrendingProducts(): Product[] {
  return products
    .filter((p) => p.isTrending)
    .sort((a, b) => b.orderCount - a.orderCount);
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
    productCount: products.filter((p) => p.category === "home").length,
  },
  {
    slug: "garden",
    name: "Сад і подвір'я",
    emoji: "🌿",
    gradient: "from-[#1B4332] to-[#2D6A4F]",
    productCount: products.filter((p) => p.category === "garden").length,
  },
  {
    slug: "pets",
    name: "Улюбленцям",
    emoji: "🐾",
    gradient: "from-[#4A1D6A] to-[#7C3AED]",
    productCount: products.filter((p) => p.category === "pets").length,
  },
  {
    slug: "tiktok",
    name: "ТОП TikTok 🔥",
    emoji: "🔥",
    gradient: "from-[#7F1D1D] to-[#DC2626]",
    productCount: products.filter((p) => p.category === "tiktok").length,
  },
];
