"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Окрема сторінка невдалої оплати — навмисно інша URL-адреса, ніж
// /order/success, щоб можна було окремо рахувати/ретаргетити невдалі
// оплати в Pixel/GA4 (по шляху сторінки, а не по внутрішньому стану).
function FailedContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  return (
    <div className="text-center">
      <div className="text-5xl mb-4">❌</div>
      <div className="text-xl font-extrabold mb-2">Оплата не пройшла</div>
      {ref && (
        <div className="text-xs text-gray-400 mb-2">Замовлення {ref}</div>
      )}
      <div className="text-sm text-gray-500 mb-6">
        Спробуй оформити замовлення ще раз або обери оплату при отриманні.
        Якщо гроші списались — вони автоматично повернуться протягом кількох днів.
      </div>
      <div className="flex flex-col gap-3 items-center">
        <Link href="/" className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold inline-block w-full max-w-xs">
          Спробувати ще раз
        </Link>
        <a
          href="https://t.me/multimarket_ua"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-gray-600 underline"
        >
          Написати нам у Telegram
        </a>
      </div>
    </div>
  );
}

export default function OrderFailedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-center text-lg font-bold">Завантаження...</div>}>
        <FailedContent />
      </Suspense>
    </div>
  );
}
