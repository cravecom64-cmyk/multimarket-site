"use client";

// Живе ранжування карток товару на основі власної аналітики (Supabase
// product_popularity: перегляди + додавання в кошик + покупки за 30 днів,
// GET /api/popularity). Паралельно до GA4/Meta Pixel — ті лишаються для
// реклами/атрибуції, тут — джерело правди для сортування на сайті.
//
// Формула: popularity_score * 1000 + orderCount. Поки подій немає (score=0
// для всіх, напр. одразу після підключення) сортування збігається з тим,
// що було раніше (просто по orderCount) — жодного регресу в перший день.
// Як тільки з'являється реальний трафік, score швидко домінує над
// статичним orderCount (діапазон orderCount ~0-500, тому вага 1000 більш
// ніж достатня, щоб навіть 1 реальний перегляд переважив).

import { useEffect, useState } from "react";

export type PopularityMap = Record<string, number>;

let cache: PopularityMap | null = null;
let inflight: Promise<PopularityMap> | null = null;

async function fetchPopularity(): Promise<PopularityMap> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/popularity")
    .then((res) => (res.ok ? res.json() : {}))
    .then((data) => {
      cache = (data && typeof data === "object" ? data : {}) as PopularityMap;
      return cache;
    })
    .catch(() => ({}) as PopularityMap)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const POPULARITY_WEIGHT = 1000;

export function popularityRank(
  productId: string,
  orderCount: number,
  map: PopularityMap | null
): number {
  const score = map?.[productId] ?? 0;
  return score * POPULARITY_WEIGHT + orderCount;
}

// Хук — повертає null, поки дані ще не прийшли (перший рендер працює на
// фолбеку orderCount через popularityRank вище), потім карту product_id → score.
export function usePopularityMap(): PopularityMap | null {
  const [map, setMap] = useState<PopularityMap | null>(cache);

  useEffect(() => {
    let cancelled = false;
    fetchPopularity().then((data) => {
      if (!cancelled) setMap(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return map;
}

export function rankProducts<T extends { id: string; orderCount: number }>(
  products: T[],
  map: PopularityMap | null
): T[] {
  return [...products].sort(
    (a, b) => popularityRank(b.id, b.orderCount, map) - popularityRank(a.id, a.orderCount, map)
  );
}
