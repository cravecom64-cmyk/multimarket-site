import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getProductsByCategory } from "@/lib/products";
import { CategoryPageClient } from "./CategoryPageClient";
import { buildMetaDescription, pluralUk } from "@/lib/seo";

type Props = {
  params: Promise<{ slug: string }>;
};

const categoryDescriptions: Record<string, string> = {
  home: "Нічники, LED-стрічки, антимоскітні сітки, органайзери та інші штуки для дому, перевірені в TikTok. Доставка по всій Україні, оплата при отриманні.",
  garden:
    "Solar-ліхтарі, гамаки, шланги для поливу та декор для саду й подвір'я. Доставка по всій Україні, оплата при отриманні.",
  pets: "Годівниці, іграшки, нашийники та грумінг для котів і собак. Доставка по всій Україні, оплата при отриманні.",
  blackout:
    "Павербанки, ліхтарі, зарядні станції та сонячні панелі на випадок відключень світла. Доставка по всій Україні, оплата при отриманні.",
  newyear:
    "Новорічні прикраси, гірлянди, декор та подарунки до Нового року й Різдва. Доставка по всій Україні, оплата при отриманні.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((c) => c.slug === slug);

  if (!category) {
    return { title: "Категорію не знайдено" };
  }

  const products = getProductsByCategory(slug);
  const n = products.length;
  const title = `${category.name} – купити в Україні, ${n} ${pluralUk(n, "товар", "товари", "товарів")}`;
  const description = buildMetaDescription(
    categoryDescriptions[slug] || `${category.name}: товари з доставкою по Україні`,
  );
  const url = `https://www.multi-market.com.ua/category/${slug}`;

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

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  if (!categories.find((c) => c.slug === slug)) notFound();
  return <CategoryPageClient />;
}
