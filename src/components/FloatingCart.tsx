"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCart } from "./CartProvider";

// Плаваюча кнопка кошика — з'являється щойно в кошику є хоч один товар і
// "слідує" за користувачем по всьому сайту (fixed-позиція, не прив'язана
// до конкретної сторінки чи блоку), на відміну від маленької іконки в
// хедері, яку легко не помітити. Показує кількість товарів і суму,
// відкриває той самий CartDrawer по кліку.
//
// Перетягується пальцем/мишкою — якщо заважає якійсь кнопці під собою,
// користувач просто відсуває її вбік. Позиція запам'ятовується в
// localStorage між візитами (це реальний production-сайт, а не
// Claude-артефакт, тож localStorage тут доречний і безпечний).

const STORAGE_KEY = "mm_floating_cart_pos";
const BUTTON_W = 84; // приблизна ширина пігулки (px) — для обмеження в межах екрана
const BUTTON_H = 44; // приблизна висота
const DRAG_THRESHOLD = 5; // px — менше цього вважаємо кліком, не перетягуванням
const BOTTOM_NAV_CLEARANCE = 64; // висота нижньої навігації + safe-area — кнопка не ховається під нею

// Сайт рендериться як колонка з max-width (480/560/680/820px залежно від
// ширини вікна, див. layout.tsx/Header.tsx/BottomNav.tsx), центрована на
// широких екранах. Раніше межі перетягування рахувались від усього вікна
// браузера (window.innerWidth) — на широкому десктопному моніторі це
// дозволяло затягнути кнопку в сіре поле ПОЗА білою колонкою сайту, де її
// легко "загубити" (вона технічно на екрані, але не на сайті, і очима там
// ніхто не шукає). Тепер межі рахуються від реальної колонки сайту.
function getColumnMaxWidth(viewportWidth: number): number {
  if (viewportWidth >= 1024) return 820;
  if (viewportWidth >= 768) return 680;
  if (viewportWidth >= 640) return 560;
  return 480;
}

function getColumnBounds(): { left: number; right: number } {
  if (typeof window === "undefined") return { left: 0, right: 480 };
  const vw = window.innerWidth;
  const columnWidth = Math.min(getColumnMaxWidth(vw), vw);
  const left = (vw - columnWidth) / 2;
  return { left, right: left + columnWidth };
}

interface Pos {
  x: number;
  y: number;
}

function clampToViewport(x: number, y: number): Pos {
  if (typeof window === "undefined") return { x, y };
  const { left, right } = getColumnBounds();
  const minX = left + 8;
  const maxX = Math.max(minX, right - BUTTON_W - 8);
  const minY = 8;
  const maxY = Math.max(minY, window.innerHeight - BUTTON_H - 8 - BOTTOM_NAV_CLEARANCE);
  return {
    x: Math.min(Math.max(minX, x), maxX),
    y: Math.min(Math.max(minY, y), maxY),
  };
}

function getDefaultPos(): Pos {
  if (typeof window === "undefined") return { x: 16, y: 300 };
  // Той самий орієнтир, що й раніше: близько до лівого краю центрованої
  // на широких екранах колонки шириною 480px, і вище sticky-панелей
  // знизу (bottom nav + sticky "Замовити" на сторінці товару).
  const { left } = getColumnBounds();
  return clampToViewport(left + 16, window.innerHeight - 190);
}

export function FloatingCart() {
  const { totalItems, totalPrice, setIsCartOpen } = useCart();
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Pos;
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPos(clampToViewport(parsed.x, parsed.y));
          return;
        }
      } catch {
        // ігноруємо биті дані в localStorage — просто підставляємо дефолт
      }
    }
    setPos(getDefaultPos());
  }, []);

  // Якщо змінюється розмір вікна (поворот телефона, зміна ширини колонки
  // сайту тощо) — підтягуємо кнопку назад у межі. window.resize не завжди
  // спрацьовує на мобільних, коли ховається/з'являється адресний рядок
  // браузера (саме так висота екрана "на льоту" змінюється найчастіше) —
  // тому додатково слухаємо visualViewport, де він є.
  useEffect(() => {
    const onResize = () => {
      setPos((prev) => (prev ? clampToViewport(prev.x, prev.y) : prev));
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!pos) return;
      draggingRef.current = true;
      movedRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    },
    [pos]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!movedRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      movedRef.current = true;
    }
    if (movedRef.current) {
      setPos(clampToViewport(startRef.current.posX + dx, startRef.current.posY + dy));
    }
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (movedRef.current) {
        // Це було перетягування — зберігаємо нову позицію, кошик НЕ відкриваємо.
        setPos((current) => {
          if (current) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          }
          return current;
        });
      } else {
        // Це був звичайний тап/клік — відкриваємо кошик.
        setIsCartOpen(true);
      }
    },
    [setIsCartOpen]
  );

  if (totalItems === 0 || !pos) return null;

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 45,
        touchAction: "none",
      }}
      className={`flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl pl-3 pr-4 py-2.5 select-none ${
        dragging ? "cursor-grabbing scale-105" : "cursor-grab transition-transform active:scale-95"
      }`}
      aria-label="Кошик — перетягніть, щоб перемістити, або натисніть, щоб відкрити"
    >
      <span className="relative text-lg leading-none">
        🛒
        <span className="absolute -top-2 -right-2.5 bg-red-500 text-white text-[9px] rounded-full min-w-[16px] h-4 px-0.5 flex items-center justify-center font-bold">
          {totalItems}
        </span>
      </span>
      <span className="text-sm font-extrabold">{totalPrice}₴</span>
    </button>
  );
}
