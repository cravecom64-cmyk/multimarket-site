"use client";

import { Fragment, useCallback, useLayoutEffect, useRef, useState } from "react";

interface InfiniteScrollRowProps<T> {
  items: T[];
  keyFn: (item: T, index: number) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Класи для скрол-контейнера (той самий overflow-x-auto flex ряд, що й раніше). */
  className: string;
}

/**
 * Горизонтальний ряд карток, що зациклюється при ручному скролі —
 * дійшовши до кінця, плавно (без видимого стрибка) продовжується з
 * початку, і навпаки. Працює навіть коли товарів мало: контент
 * дублюється стільки разів, скільки потрібно, щоб кожен "блок" був
 * ширшим за ~1.5 екрана — тоді користувач фізично не встигає
 * доскролити до кінця дубльованого блоку раніше, ніж спрацює
 * непомітний reset scrollLeft на еквівалентну позицію в сусідньому
 * (пікселя-в-піксель ідентичному) блоці.
 *
 * Технічна нотатка (17.09.2026, запит Павла "зроби нескінченний скрол
 * у каруселях товарів"): рендеримо контент трьома блоками
 * (prev/middle/next), кожен блок — це N копій items, де N підібрано
 * так, щоб blockWidth >= 1.5 * ширини видимої області. Стартуємо
 * проскролений у middle-блок. Обробник onScroll стежить, чи
 * користувач переліз у prev/next блок, і миттєво (без анімації,
 * непомітно) зсуває scrollLeft на ±blockWidth назад у middle-блок.
 *
 * blockWidth округлюється до цілого пікселя й саме це округлене
 * значення використовується і для встановлення scrollLeft, і для
 * порівнянь у onScroll — інакше (перевірено на карусельці з малою
 * к-стю товарів) дробове blockWidth проти цілого el.scrollLeft іноді
 * різняться на частку пікселя, onScroll одразу бачить "ми в
 * попередньому блоці" і зайвий раз перестрибує на блок вперед.
 */
export function InfiniteScrollRow<T>({
  items,
  keyFn,
  renderItem,
  className,
}: InfiniteScrollRowProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiesPerBlock, setCopiesPerBlock] = useState(1);
  const blockWidthRef = useRef(0);
  const initializedRef = useRef(false);

  const recalc = useCallback(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;

    const totalCopies = copiesPerBlock * 3;
    const naturalSetWidth = el.scrollWidth / totalCopies;
    const viewport = el.clientWidth || 1;

    if (naturalSetWidth <= 0) return;

    const needed = Math.max(1, Math.ceil((viewport * 1.5) / naturalSetWidth));

    if (needed !== copiesPerBlock) {
      initializedRef.current = false;
      setCopiesPerBlock(needed);
      return;
    }

    const blockWidth = Math.round(naturalSetWidth * copiesPerBlock);
    blockWidthRef.current = blockWidth;

    if (!initializedRef.current) {
      el.scrollLeft = blockWidth;
      initializedRef.current = true;
    }
  }, [items, copiesPerBlock]);

  useLayoutEffect(() => {
    recalc();
  }, [recalc]);

  // Перерахунок при зміні ширини вікна (поворот екрана/ресайз) — блок
  // міг перестати покривати 1.5 екрана. copiesPerBlock може лишитись
  // тим самим числом, тому просто повторно міряємо й переставляємо
  // scrollLeft напряму, не покладаючись на React re-render.
  useLayoutEffect(() => {
    const handleResize = () => {
      initializedRef.current = false;
      recalc();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [recalc]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    const blockWidth = blockWidthRef.current;
    if (!el || !blockWidth) return;

    if (el.scrollLeft < blockWidth) {
      el.scrollLeft += blockWidth;
    } else if (el.scrollLeft > blockWidth * 2) {
      el.scrollLeft -= blockWidth;
    }
  }, []);

  if (items.length === 0) return null;

  const blocks = [0, 1, 2];

  return (
    <div ref={scrollRef} onScroll={handleScroll} className={className}>
      {blocks.map((blockIndex) =>
        Array.from({ length: copiesPerBlock }).map((_, copyIndex) =>
          items.map((item, i) => (
            <Fragment key={`${blockIndex}-${copyIndex}-${String(keyFn(item, i))}`}>
              {renderItem(item, i)}
            </Fragment>
          ))
        )
      )}
    </div>
  );
}
