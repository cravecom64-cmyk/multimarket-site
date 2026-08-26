"use client";

// Пише page_view у власну аналітику (Supabase product_events) на кожну
// зміну маршруту — та сама подія покриває і "заходи на сайт" загалом
// (для розділу "Аналітика" в командному центрі), і перегляди конкретної
// картки товару (product_id, коли шлях відповідає /product/[slug]) —
// звідси рахується popularity_score для живого ранжування карток.
// Працює паралельно з GoogleAnalytics/MetaPixel, нічого в них не міняє.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { trackPageView } from "@/lib/analytics";

export function SiteAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    const slugMatch = pathname.match(/^\/product\/([^/]+)/);
    const product = slugMatch ? getProductBySlug(slugMatch[1]) : undefined;
    trackPageView(pathname, product?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
