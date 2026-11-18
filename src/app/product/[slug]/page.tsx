import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { buildMetaDescription } from "@/lib/seo";
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

  // Прихований товар (немає в наявності) не обіцяє "купити за ...₴":
  // чесний заголовок, а на сторінці – схожі товари з наявності.
  // Індексацію не вимикаємо: наявність змінюється автоматично й часто.
  const title = product.isHidden
    ? `${product.name} – тимчасово немає в наявності`
    : `${product.name} купити за ${product.price}₴ в Україні`;
  const description = product.isHidden
    ? `${product.name} тимчасово немає в наявності. На сторінці – схожі товари, які можна замовити зараз.`
    : buildMetaDescription(product.shortDesc || product.name);
  const url = `https://www.multi-market.com.ua/product/${product.slug}`;

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

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  // Removed products must return a real 404 (not a soft 404 with status 200).
  // Hidden products still resolve via getProductBySlug and keep their page.
  if (!getProductBySlug(slug)) notFound();
  return <ProductPageClient />;
}
