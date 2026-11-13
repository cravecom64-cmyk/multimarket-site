import type { Metadata } from "next";
import { getAllProducts } from "@/lib/products";
import { CatalogPageClient } from "./CatalogPageClient";

export async function generateMetadata(): Promise<Metadata> {
  const products = getAllProducts();
  const title = `Весь каталог — купити в Україні, ${products.length} товарів`;
  const description =
    "Повний каталог товарів Multimarket: дім і затишок, сад і подвір'я, товари для улюбленців, блекаут-набори. Фільтр по розділах, сортування за популярністю та ціною. Доставка по всій Україні, оплата карткою онлайн.";
  const url = "https://www.multi-market.com.ua/catalog";

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

export default function CatalogPage() {
  return <CatalogPageClient />;
}
