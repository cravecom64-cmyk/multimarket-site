"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  oldPrice?: number | null;
  emoji: string;
  rating: number;
  reviewCount: number;
  orderCount: number;
  badges: string[];
  rank?: number;
  hasTiktok?: boolean;
  externalLanding?: string;
}

export function ProductCard({
  id,
  slug,
  name,
  price,
  oldPrice,
  emoji,
  rating,
  reviewCount,
  orderCount,
  badges,
  rank,
  hasTiktok,
  externalLanding,
}: ProductCardProps) {
  const { addItem } = useCart();

  const discount = oldPrice
    ? Math.round(((oldPrice - price) / oldPrice) * 100)
    : 0;

  const href = externalLanding || `/product/${slug}`;

  return (
    <div className="product-card bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
      <Link href={href}>
        <div className="h-[130px] bg-gray-200 relative flex items-center justify-center text-3xl">
          {emoji}

          {/* Rank badge */}
          {rank && rank <= 4 && (
            <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded font-bold">
              #{rank}
            </span>
          )}
          {rank && rank > 4 && (
            <span className="absolute top-1.5 left-1.5 bg-gray-400 text-white text-[8px] px-1.5 py-0.5 rounded font-bold">
              #{rank}
            </span>
          )}

          {/* Sale badge */}
          {discount > 0 && (
            <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded font-bold badge-pulse">
              -{discount}%
            </span>
          )}

          {/* TikTok badge */}
          {hasTiktok && (
            <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[7px] px-1.5 py-0.5 rounded">
              ♪ є в TikTok
            </span>
          )}
        </div>
      </Link>

      <div className="p-2 px-2.5">
        <Link href={href}>
          <div className="text-[10px] font-semibold leading-tight line-clamp-2 min-h-[26px]">
            {name}
          </div>
        </Link>
        <div className="text-[8px] text-gray-400 mt-1">
          ⭐ {rating} ({reviewCount}) · {orderCount} замовл.
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          {oldPrice && (
            <span className="text-[9px] text-gray-400 line-through">
              {oldPrice}₴
            </span>
          )}
          <span
            className={`text-sm font-extrabold ${
              oldPrice ? "text-red-500" : ""
            }`}
          >
            {price}₴
          </span>
        </div>
        <button
          onClick={() =>
            addItem({ id, name, price, emoji })
          }
          className="mt-1.5 w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-semibold py-1.5 rounded-md transition-colors"
        >
          Замовити
        </button>
      </div>
    </div>
  );
}