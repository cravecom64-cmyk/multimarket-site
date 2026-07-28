import type { Metadata } from "next";
import { getProductBySlug } from "@/lib/products";
import { ProductPageClient } from "./ProductPageClient";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    return {
      title: "Товар не знайдено",
    };
  }

  const title = `${product.name} купити за ${product.price}₴ в Україні`;
  const description =
    product.shortDesc ||
    `${product.name} з доставкою по Україні. Оплата при отриманні, відправка сьогодні. ${product.price}₴.`;
  const url = `https://multi-market.com.ua/product/${product.slug}`;

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
      images: product.image ? [{ url: product.image }] : undefined,
    },
  };
}

export default function ProductPage() {
  return <ProductPageClient />;
}
