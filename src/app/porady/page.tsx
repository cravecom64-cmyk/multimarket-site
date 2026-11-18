import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { articles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Поради",
  description:
    "Корисні поради від Multimarket: як підготуватися до відключень світла, що обрати й на що зважати.",
  alternates: { canonical: "https://www.multi-market.com.ua/porady" },
};

export default function PoradyPage() {
  return (
    <>
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 px-5 py-6">
        <h1 className="text-[20px] font-extrabold text-white leading-tight">Поради</h1>
      </div>
      <div className="px-4 py-6 space-y-3">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/porady/${a.slug}`}
            className="block border border-gray-200 rounded-xl px-4 py-3 hover:border-emerald-400 transition-colors"
          >
            <div className="text-[14px] font-extrabold text-gray-900">{a.title}</div>
            <div className="text-[12px] text-gray-600 mt-1">{a.description}</div>
          </Link>
        ))}
      </div>
      <Footer />
    </>
  );
}
