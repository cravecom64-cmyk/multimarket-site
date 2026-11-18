import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getProductsByCategory } from "@/lib/products";
import { CategoryPageClient } from "./CategoryPageClient";
import { buildMetaDescription, pluralUk } from "@/lib/seo";
import { parseFaq } from "@/lib/detailBody";
import categoryGuides from "@/data/category-guides.json";

type Props = {
  params: Promise<{ slug: string }>;
};

const categoryDescriptions: Record<string, string> = {
  home: "Нічники, LED-стрічки, антимоскітні сітки, органайзери та інші штуки для дому, перевірені в TikTok. Доставка по всій Україні, оплата карткою онлайн.",
  garden:
    "Solar-ліхтарі, гамаки, шланги для поливу та декор для саду й подвір'я. Доставка по всій Україні, оплата карткою онлайн.",
  pets: "Годівниці, іграшки, нашийники та грумінг для котів і собак. Доставка по всій Україні, оплата карткою онлайн.",
  blackout:
    "Аварійні LED-лампи E27, що самі вмикаються при відключенні, переносні лампи, ліхтарі, повербанки та газова плита. Відправка Новою поштою за 1-3 дні.",
  newyear:
    "Гірлянди роса, нитка, бахрома й штори, вуличні гірлянди IP65, LED-декор і подарунки до Нового року й Різдва. Відправка Новою поштою за 1-3 дні.",
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
  const guide = (categoryGuides as Record<string, { sections: { title: string; body: string }[] }>)[slug];
  const faq = (guide?.sections ?? [])
    .filter((s) => /Часті запитання/i.test(s.title))
    .flatMap((s) => parseFaq(s.body));
  const faqJsonLd =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;
  return (
    <>
      {faqJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <CategoryPageClient />
    </>
  );
}
