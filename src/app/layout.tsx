import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { TelegramButton } from "@/components/TelegramButton";
import { CartDrawer } from "@/components/CartDrawer";
import { MetaPixel } from "@/components/MetaPixel";

export const metadata: Metadata = {
  title: "Multimarket — Штуки для дому, саду і улюбленців",
  description:
    "Знайшли в TikTok. Перевірили. Відправляємо сьогодні. Тільки те, що реально працює — з безкоштовною доставкою від 800₴.",
  openGraph: {
    title: "Multimarket — Штуки для дому, саду і улюбленців",
    description:
      "Знайшли в TikTok. Перевірили. Відправляємо сьогодні.",
    type: "website",
    locale: "uk_UA",
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
        <MetaPixel />
        <CartProvider>
          <div className="max-w-[480px] mx-auto bg-white min-h-screen shadow-sm lg:shadow-lg">
            <Header />
            <main className="pb-16">{children}</main>
            <BottomNav />
          </div>
          <CartDrawer />
          <TelegramButton />
        </CartProvider>
      </body>
    </html>
  );
}