"use client";

import { PROMO, isPromoActive } from "@/lib/promo";

export function PromoBanner() {
  if (!isPromoActive()) return null;
  return (
    <div className="bg-black text-white text-center text-xs font-bold py-2 px-3">
      🖤 {PROMO.name} — знижки на все до {PROMO.endsAtLabel}
    </div>
  );
}
