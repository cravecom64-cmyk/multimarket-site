import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { articles, getArticle } from "@/lib/articles";
import { parseFaq, renderDetailBody } from "@/lib/detailBody";

const BASE = "https://www.multi-market.com.ua";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return { title: "Статтю не знайдено" };
  const url = `${BASE}/porady/${a.slug}`;
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: url },
    openGraph: { title: a.title, description: a.description, url, type: "article" },
  };
}

// Стаття: розділи видно одразу, але короткі й з підзаголовками (без "простирадла").
// Посилання лише зі статті на товари; з карток на статтю не ведемо.
export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  const url = `${BASE}/porady/${a.slug}`;
  const faq = a.sections
    .filter((s) => /Часті запитання/i.test(s.title))
    .flatMap((s) => parseFaq(s.body));
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.description,
      datePublished: a.published,
      dateModified: a.updated,
      inLanguage: "uk",
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: "Multimarket", url: BASE },
      publisher: { "@type": "Organization", name: "Multimarket", url: BASE },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Головна", item: BASE },
        { "@type": "ListItem", position: 2, name: "Поради", item: `${BASE}/porady` },
        { "@type": "ListItem", position: 3, name: a.title, item: url },
      ],
    },
    ...(faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="px-4 pt-3 text-[11px] text-gray-500">
        <Link href="/" className="hover:text-gray-800">Головна</Link> ›{" "}
        <Link href="/porady" className="hover:text-gray-800">Поради</Link>
      </div>
      <article className="px-4 pt-2 pb-6">
        <h1 className="text-[20px] font-extrabold text-gray-900 leading-tight">{a.title}</h1>
        <p className="mt-2 text-[13px] text-gray-700 leading-relaxed">{a.intro}</p>
        <nav className="mt-3 flex flex-wrap gap-1.5">
          {a.sections.map((s, i) => (
            <a
              key={i}
              href={`#s${i + 1}`}
              className="text-[11px] bg-gray-100 rounded-full px-2.5 py-1 text-gray-700 hover:bg-emerald-50"
            >
              {s.title}
            </a>
          ))}
        </nav>
        {a.sections.map((s, i) => (
          <section key={i} id={`s${i + 1}`} className="mt-5 scroll-mt-20">
            <h2 className="text-[15px] font-extrabold text-gray-900">{s.title}</h2>
            <div
              className="mt-1.5 text-[13px] text-gray-700 leading-relaxed [&_strong]:font-bold [&_strong]:text-gray-900 [&_p]:mt-2 [&_ul]:mt-2 [&_li]:mt-1.5 [&_a]:text-emerald-600 [&_a]:font-semibold"
              dangerouslySetInnerHTML={{ __html: renderDetailBody(s.body) }}
            />
          </section>
        ))}
        <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-3">
          <Link href="/category/blackout" className="text-[13px] font-extrabold text-emerald-700">
            🔋 Усі товари для відключень світла →
          </Link>
        </div>
      </article>
      <Footer />
    </>
  );
}
