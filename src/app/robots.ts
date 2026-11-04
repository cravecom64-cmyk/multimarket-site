import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://www.multi-market.com.ua/sitemap.xml",
    host: "https://www.multi-market.com.ua",
  };
}
