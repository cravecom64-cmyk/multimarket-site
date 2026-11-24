import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchPageClient } from "./SearchPageClient";

export const metadata: Metadata = {
  title: "Пошук товарів",
  description: "Пошук товарів на Multimarket — дім, сад і улюбленці з доставкою по Україні.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function SearchPage() {
  // Suspense потрібен Next.js для useSearchParams() всередині SearchPageClient
  // (читання ?q=... з посилання "Переглянути всі результати" у Header) —
  // без цього білд падає з "useSearchParams() should be wrapped in a suspense
  // boundary". Фолбек порожній — сторінка статична, рендериться миттєво.
  return (
    <Suspense fallback={null}>
      <SearchPageClient />
    </Suspense>
  );
}
