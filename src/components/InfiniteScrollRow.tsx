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
 *
 * Виправлення 07.10.2026 (знайдено Павлом — "товари як дублюються"
 * в секції "З цим купують" на сторінці товару з лише 2 bundleWith):
 * коли ОДНА копія items уже вміщується в видиму область без скролу
 * взагалі (напр. 2 товари на широкому екрані), дублювання для
 * безкінечного скролу не просто зайве — воно відразу видиме як
 * повторювані картки, бо користувачу нема куди скролити, щоб "не
 * побачити" дублі. В такому разі рендеримо items один раз, без
 * потрійного блоку й без scroll-обробника — секція коротша за екран,
 * тож нескінченний скрол їй і не потрібен.
 */
export function InfiniteScrollRow<T>({
  items,
  keyFn,
  renderItem,
  className,
}: InfiniteScrollRowProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiesPerBlock, setCopiesPerBlock] = useState(1);
  const [isStatic, setIsStatic] = useState(false);
  const blockWidthRef = useRef(0);
  const initializedRef = useRef(false);

  const recalc = useCallback(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;

    const totalCopies = copiesPerBlock * (isStatic ? 1 : 3);
    const naturalSetWidth = el.scrollWidth / totalCopies;
    const viewport = el.clientWidth || 1;

    if (naturalSetWidth <= 0) return;

    // Один комплект items уже вміщується без скролу — переходимо (або
    // лишаємось) у статичний режим: без дублювання, без зациклення.
    if (naturalSetWidth <= viewport) {
      if (!isStatic) {
        initializedRef.current = false;
        setIsStatic(true);
      }
      return;
    }

    if (isStatic) {
      // Контент виріс (напр. resize вікна) і більше не вміщується —
      // повертаємось у режим нескінченного скролу.
      initializedRef.current = false;
      setIsStatic(false);
      return;
    }

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
  }, [items, copiesPerBlock, isStatic]);

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
    if (isStatic) return;
    const el = scrollRef.current;
    const blockWidth = blockWidthRef.current;
    if (!el || !blockWidth) return;

    if (el.scrollLeft < blockWidth) {
      el.scrollLeft += blockWidth;
    } else if (el.scrollLeft > blockWidth * 2) {
      el.scrollLeft -= blockWidth;
    }
  }, [isStatic]);

  if (items.length === 0) return null;

  if (isStatic) {
    return (
      <div ref={scrollRef} className={className}>
        {items.map((item, i) => (
          <Fragment key={String(keyFn(item, i))}>{renderItem(item, i)}</Fragment>
        ))}
      </div>
    );
  }

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
