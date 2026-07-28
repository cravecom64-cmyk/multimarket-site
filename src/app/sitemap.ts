import type { MetadataRoute } from "next";
import { getAllProducts, categories } from "@/lib/products";

const BASE_URL = "https://multi-market.com.ua";

export default function sitemap(): MetadataRoute.Sitemap {
  const products = getAllProducts();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/trending`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sale`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${BASE_URL}/category/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((p) => !p.externalLanding)
    .map((p) => ({
      url: `${BASE_URL}/product/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
