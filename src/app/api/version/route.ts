import { NextResponse } from "next/server";

// Яка версія сайту зараз опублікована (коміт, з якого зібрано цей деплой).
// Командний центр опитує цю адресу після публікації змін з адмінки, щоб
// показати "Готово", щойно зміни реально на живому сайті. Без даних про
// клієнтів чи секретів — лише короткий хеш коміту.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
