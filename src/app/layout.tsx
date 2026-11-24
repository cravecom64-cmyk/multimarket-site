import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CartDrawer } from "@/components/CartDrawer";
import { FloatingCart } from "@/components/FloatingCart";
import { MetaPixel } from "@/components/MetaPixel";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SiteAnalytics } from "@/components/SiteAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.multi-market.com.ua"),
  title: {
    default:
      "Multimarket – товари для дому, саду та на випадок відключень світла | Купити в Україні",
    template: "%s | Multimarket",
  },
  description:
    "Товари для дому, саду та на випадок відключень світла: аварійні LED-лампи, повербанки, ліхтарі. Відправка Новою поштою за 1-3 дні, безкоштовна доставка від 2000₴.",
  keywords: [
    "товари для дому купити",
    "товари з тік ток купити",
    "аварійна лампа з акумулятором купити",
    "товари для блекауту",
    "інтернет магазин товарів для дому",
    "товари для тварин купити Україна",
    "садовий інвентар купити",
    "накладений платіж товари",
    "доставка Новою Поштою",
  ],
  alternates: {
    canonical: "https://www.multi-market.com.ua",
  },
  openGraph: {
    title: "Multimarket – товари для дому, саду та на випадок відключень світла",
    description:
      "Знайшли в TikTok. Перевірили. Відправка 1-3 дні, доставка Новою поштою по всій Україні.",
    type: "website",
    locale: "uk_UA",
    url: "https://www.multi-market.com.ua",
    siteName: "Multimarket",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  verification: {
    // Google Search Console — підтвердження власності сайту (2026-08-03)
    google: "wOJayGkxAUsqIJZgRFD5ctTYULnA3ny3axYZU1Xhmjw",
    // Bing Webmaster Tools (2026-11-18) – ChatGPT шукає через індекс Bing
    // Facebook Business – підтвердження домену (2026-11-24, аудит сайту п.5)
    other: {
      "msvalidate.01": "17E31766D7877E8FB802BBD445AB3713",
      "facebook-domain-verification": "35y7qddu5ezjggxypokfu2wj65gpex",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
          document.addEventListener('keydown', function(e) {
            if (e.key === 'PrintScreen') { e.preventDefault(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'j' || e.key === 'J' || e.key === 'c' || e.key === 'C')) { e.preventDefault(); }
            if (e.key === 'F12') { e.preventDefault(); }
          });
          document.addEventListener('dragstart', function(e) {
            if (e.target.tagName === 'IMG') { e.preventDefault(); }
          });
        `}} />
      </head>
      <body className="font-sans bg-gray-50 text-gray-900 antialiased select-none">
        <GoogleAnalytics />
        <MetaPixel />
        <SiteAnalytics />
        <CartProvider>
          <div className="max-w-[480px] sm:max-w-[560px] md:max-w-[680px] lg:max-w-[820px] mx-auto bg-white min-h-screen shadow-sm lg:shadow-lg">
            <Header />
            <main className="pb-16">{children}</main>
            <BottomNav />
          </div>
          <CartDrawer />
          <FloatingCart />
        </CartProvider>
      </body>
    </html>
  );
}
