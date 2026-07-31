import type { Metadata } from "next";
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
  return <SearchPageClient />;
}
