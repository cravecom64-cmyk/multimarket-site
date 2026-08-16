import type { Metadata } from "next";
import { categories, getProductsByCategory } from "@/lib/products";
import { CategoryPageClient } from "./CategoryPageClient";

type Props = {
  params: Promise<{ slug: string }>;
};

const categoryDescriptions: Record<string, string> = {
  home: "Нічники, LED-стрічки, антимоскітні сітки, органайзери та інші штуки для дому, перевірені в TikTok. Доставка по всій Україні, оплата при отриманні.",
  garden:
    "Solar-ліхтарі, гамаки, шланги для поливу та декор для саду й подвір'я. Доставка по всій Україні, оплата при отриманні.",
  pets: "Годівниці, іграшки, нашийники та грумінг для котів і собак. Доставка по всій Україні, оплата при отриманні.",
  tiktok:
    "Товари, які зараз у тренді в TikTok — перевірені і з реальними відгуками. Доставка по всій Україні, оплата при отриманні.",
  blackout:
    "Павербанки, ліхтарі, зарядні станції та сонячні панелі на випадок відключень світла. Доставка по всій Україні, оплата при отриманні.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((c) => c.slug === slug);

  if (!category) {
    return { title: "Категорію не знайдено" };
  }

  const products = getProductsByCategory(slug);
  const title = `${category.name} — купити в Україні, ${products.length} товарів`;
  const description =
    categoryDescriptions[slug] ||
    `${category.name}: ${products.length} товарів з доставкою по Україні.`;
  const url = `https://multi-market.com.ua/category/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
  };
}

export default function CategoryPage() {
  return <CategoryPageClient />;
}
