import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Сторінку не знайдено",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="text-5xl font-extrabold mb-3">404</div>
      <h1 className="text-xl font-bold mb-2">Цієї сторінки вже немає</h1>
      <p className="text-gray-500 mb-6">
        Можливо, товар закінчився або змінилося посилання. Подивіться схожі товари в каталозі.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className="rounded-xl bg-black px-5 py-3 font-semibold text-white">
          На головну
        </Link>
        <Link href="/category/blackout" className="rounded-xl border px-5 py-3 font-semibold">
          Блекаут
        </Link>
        <Link href="/category/home" className="rounded-xl border px-5 py-3 font-semibold">
          Для дому
        </Link>
        <Link href="/category/pets" className="rounded-xl border px-5 py-3 font-semibold">
          Для тварин
        </Link>
        <Link href="/category/garden" className="rounded-xl border px-5 py-3 font-semibold">
          Сад
        </Link>
      </div>
    </div>
  );
}
