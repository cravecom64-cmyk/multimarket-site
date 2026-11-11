"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useCart } from "./CartProvider";
import { trackPurchase, trackInitiateCheckout } from "@/lib/pixel";
import {
  trackPurchase as trackPurchaseGA4,
  trackInitiateCheckout as trackInitiateCheckoutGA4,
} from "@/lib/ga4";
import { trackCheckoutEvent } from "@/lib/analytics";
import { COD_MIN_TOTAL } from "@/lib/checkout";

interface OrderModalProps {
  onClose: () => void;
}

type PaymentMethod = "card_mono" | "card_wfp" | "cod";

// Онлайн-оплата (mono, WayForPay) увімкнена поряд з оплатою при отриманні.
// Потрібна як альтернатива для замовлень дешевших за COD_MIN_TOTAL, які не
// можна відправити по накладеному платежу (див. нижче, requiresPrepayment).
// Рішення Павла 10.11.2026.
const ONLINE_PAYMENTS_ENABLED = true;

// Той самий формат, що й на сервері (src/app/api/order/route.ts) — приймає
// +380XXXXXXXXX, 380XXXXXXXXX, 0XXXXXXXXX (пробіли/дужки/дефіси прибираються).
const UA_PHONE_REGEX = /^(?:\+?38)?0\d{9}$/;
function isValidPhone(phone: string): boolean {
  return UA_PHONE_REGEX.test(phone.replace(/[\s()-]/g, ""));
}

// Поле "Ім'я та прізвище" — одне поле, але має містити хоча б два слова.
// До 10.11.2026 перевірялась лише довжина (>=2 символи), тому "тест" чи
// будь-яке одне слово проходило валідацію — форма йшла далі, а кол-центру
// потім доводилось самим перепитувати прізвище під час дзвінка.
function isValidFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}

// Автозаповнення міста/відділення Нової Пошти (05.11.2026) — аналіз воронки
// (product_events у Supabase) показав, що з усіх, хто дійшов до форми
// оформлення, більшість покидає її одразу, ще до заповнення жодного поля.
// Найімовірніша причина — поле "Відділення Нової Пошти" вимагало вручну
// набрати точну адресу, яку рідко хто пам'ятає напам'ять. Тепер поля
// підказують варіанти з реального довідника НП (API v2.0, ключ
// NOVA_POSHTA_API_KEY лише на сервері — див. /api/nova-poshta/*), і
// покупець просто впізнає своє відділення зі списку замість того, щоб
// згадувати чи йти шукати адресу деінде. Поля лишаються звичайними
// текстовими — якщо підказки не завантажились (НП API недоступне/ключ не
// налаштований), все працює так само, як і раніше, нічого не блокується.
interface NpCityOption {
  ref: string;
  name: string;
  area: string;
}
interface NpWarehouseOption {
  ref: string;
  number: string;
  description: string;
  shortAddress: string;
}

export function OrderModal({ onClose }: OrderModalProps) {
  const { items, totalPrice, clearCart } = useCart();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    branch: "",
    comment: "",
    confirmCall: true, // чекбокс "зв'язатись для підтвердження" — за замовчуванням увімкнено
    website: "", // honeypot — hidden from users, bots fill it
  });

  // Стан автозаповнення міста/відділення НП — див. коментар над компонентом.
  const [cityOptions, setCityOptions] = useState<NpCityOption[]>([]);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityRef, setCityRef] = useState<string | null>(null);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextCityFetchRef = useRef(false);

  const [branchOptions, setBranchOptions] = useState<NpWarehouseOption[]>([]);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const branchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextBranchFetchRef = useRef(false);

  async function fetchWarehouses(ref: string, q: string) {
    try {
      const res = await fetch(
        `/api/nova-poshta/warehouses?cityRef=${encodeURIComponent(ref)}&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      const list: NpWarehouseOption[] = data?.warehouses ?? [];
      setBranchOptions(list);
      setBranchDropdownOpen(list.length > 0);
    } catch {
      // тихо ігноруємо — поле "Відділення" лишається звичайним текстовим
    }
  }

  function handleCityChange(value: string) {
    setForm((prev) => ({ ...prev, city: value, branch: "" }));
    setCityRef(null);
    setBranchOptions([]);
    setBranchDropdownOpen(false);

    if (skipNextCityFetchRef.current) {
      skipNextCityFetchRef.current = false;
      setCityDropdownOpen(false);
      return;
    }

    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    const query = value.trim();
    if (query.length < 2) {
      setCityOptions([]);
      setCityDropdownOpen(false);
      return;
    }
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nova-poshta/cities?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const list: NpCityOption[] = data?.cities ?? [];
        setCityOptions(list);
        setCityDropdownOpen(list.length > 0);
      } catch {
        // тихо ігноруємо — поле "Місто" лишається звичайним текстовим
      }
    }, 300);
  }

  function selectCity(opt: NpCityOption) {
    skipNextCityFetchRef.current = true;
    setForm((prev) => ({ ...prev, city: opt.name, branch: "" }));
    setCityRef(opt.ref);
    setCityOptions([]);
    setCityDropdownOpen(false);
    // Одразу підвантажуємо перші відділення цього міста — щоб у полі
    // "Відділення" було що показати одразу на фокусі, без набору тексту.
    fetchWarehouses(opt.ref, "");
  }

  function handleBranchChange(value: string) {
    setForm((prev) => ({ ...prev, branch: value }));

    if (skipNextBranchFetchRef.current) {
      skipNextBranchFetchRef.current = false;
      setBranchDropdownOpen(false);
      return;
    }

    if (!cityRef) return; // місто ще не обране зі списку — поле звичайне текстове

    if (branchDebounceRef.current) clearTimeout(branchDebounceRef.current);
    branchDebounceRef.current = setTimeout(() => {
      fetchWarehouses(cityRef, value.trim());
    }, 300);
  }

  function selectBranch(opt: NpWarehouseOption) {
    skipNextBranchFetchRef.current = true;
    setForm((prev) => ({ ...prev, branch: opt.description }));
    setBranchOptions([]);
    setBranchDropdownOpen(false);
  }

  function handleBranchFocus() {
    if (cityRef && branchOptions.length > 0) {
      setBranchDropdownOpen(true);
    } else if (cityRef && !form.branch) {
      fetchWarehouses(cityRef, "");
    }
  }

  // InitiateCheckout — момент відкриття форми оформлення (між AddToCart і
  // Purchase). Раніше функція була написана в pixel.ts, але ніде не
  // викликалась — Meta не бачила цей крок воронки взагалі.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    trackCheckoutEvent("begin_checkout");
    trackInitiateCheckout(
      items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        category: i.categoryName ?? i.category,
      })),
      totalPrice
    );
    trackInitiateCheckoutGA4(
      items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        category: i.categoryName ?? i.category,
      })),
      totalPrice
    );
  }, []);
  // Два онлайн-еквайринги (mono і WayForPay) + оплата при отриманні. mono —
  // пріоритетний варіант за замовчуванням (перевірений першим, надійніший
  // за досвідом). Назви без логотипів — за брендбуком monobank для сайтів
  // з кількома еквайрингами (monobank.ua/knowledge-base/acquiring/online/brandbook):
  // "назва без лого" — валідний варіант поряд з варіантом із лого.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  // Замовлення дешевші за COD_MIN_TOTAL не можна відправити по накладеному
  // платежу — тільки повна передоплата карткою онлайн.
  const requiresPrepayment = totalPrice < COD_MIN_TOTAL;
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Чи покупець вже вийшов з поля телефону хоч раз — щоб не показувати
  // помилку одразу при відкритті форми, коли поле ще порожнє.
  const [phoneTouched, setPhoneTouched] = useState(false);
  const formLoadedAt = useRef(Date.now());

  // Серверні коди валідації → людське повідомлення українською. Раніше при
  // будь-якій 400-помилці (напр. закоротке поле) показувався загальний
  // "Щось пішло не так" — покупець не розумів що саме виправити.
  const VALIDATION_MESSAGES: Record<string, string> = {
    "Invalid name": "Вкажи ім'я та прізвище повністю — одного слова недостатньо.",
    "Invalid phone number": "Перевір номер телефону — формат +380XXXXXXXXX.",
    "Invalid city": "Перевір поле «Місто» — має бути мінімум 2 символи.",
    "Invalid NP branch": "Вкажи відділення Нової Пошти детальніше (мінімум 3 символи, напр. «Відділення №5»).",
    "Invalid cart": "Кошик порожній або некоректний — онови сторінку і спробуй ще раз.",
    "Invalid cart item": "Один з товарів у кошику некоректний — онови сторінку і спробуй ще раз.",
    "Too many requests": "Забагато спроб поспіль — зачекай хвилину і спробуй ще раз.",
    "cod_min_total": `Замовлення до ${COD_MIN_TOTAL}₴ відправляються лише з повною оплатою — обери оплату карткою вище.`,
  };

  async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
    try {
      const data = await res.json();
      trackCheckoutEvent("checkout_error", String(data?.error ?? `http_${res.status}`).slice(0, 60));
      if (data?.error && VALIDATION_MESSAGES[data.error]) {
        return VALIDATION_MESSAGES[data.error];
      }
    } catch {
      // не JSON — ігноруємо, повертаємо fallback
    }
    return fallback;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneTouched(true);
    // Обидві перевірки нижче лише виставляли errorMessage, але банер помилки
    // рендериться за умовою status === "error" — без setStatus("error") текст
    // ніколи не показувався (ні для імені, ні раніше для телефону), форма
    // просто мовчки "зависала". Виявлено 10.11.2026 під час перевірки фіксу
    // валідації імені.
    if (!isValidFullName(form.name)) {
      setErrorMessage("Вкажи ім'я та прізвище повністю — одного слова недостатньо.");
      setStatus("error");
      return;
    }
    if (!isValidPhone(form.phone)) {
      setErrorMessage("Перевір номер телефону — формат +380XXXXXXXXX.");
      setStatus("error");
      return;
    }
    if (paymentMethod === "cod" && requiresPrepayment) {
      setErrorMessage(`Замовлення до ${COD_MIN_TOTAL}₴ відправляються лише з повною оплатою — обери оплату карткою вище.`);
      setStatus("error");
      return;
    }
    setStatus("sending");
    setErrorMessage(null);

    // Спільний ID замовлення — йде і в Telegram-заявку, і в інвойс/платіж
    // конкретного еквайрингу (як reference), щоб продавець міг зіставити
    // заявку з оплатою за одним номером незалежно від того, який гейтвей
    // клієнт обрав.
    const orderId = `MM${Date.now().toString(36).toUpperCase()}`;

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          name: form.name,
          phone: form.phone,
          city: form.city,
          branch: form.branch,
          comment: form.comment,
          confirmCall: form.confirmCall,
          website: form.website,
          _t: formLoadedAt.current,
          paymentMethod,
          items: items.map((i) => ({
            id: i.id, // для командного центру (Supabase) — зіставлення з поставщиками
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          totalPrice,
        }),
      });

      if (!res.ok) {
        setErrorMessage(await extractErrorMessage(res, "Не вдалося відправити заявку. Спробуй ще раз."));
        setStatus("error");
        return;
      }
      trackCheckoutEvent("order_submitted");

      if (paymentMethod === "card_mono") {
        // Онлайн-оплата Monobank — створюємо інвойс і редіректимо на
        // сторінку оплати. Purchase-подія летить НЕ тут, а на /order/success
        // після підтвердження реальної оплати (див. pixel.ts/ga4.ts).
        const invoiceRes = await fetch("/api/checkout/monobank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              image: i.image,
            })),
            totalPrice,
            // Йде тільки в невидиме клієнту поле reference — щоб у сповіщенні
            // про відмову оплати одразу було видно кому телефонувати.
            customerPhone: form.phone,
          }),
        });

        if (!invoiceRes.ok) {
          setErrorMessage("Не вдалося створити оплату mono. Спробуй ще раз або обери інший спосіб оплати.");
          setStatus("error");
          return;
        }

        const { invoiceId, pageUrl } = await invoiceRes.json();

        // Зберігаємо дані для пікселя/GA4, які вистрелять на сторінці
        // успіху ПІСЛЯ підтвердження оплати, а не зараз.
        localStorage.setItem(
          "mm_pending_order",
          JSON.stringify({
            orderId,
            gateway: "monobank",
            invoiceId,
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              category: i.categoryName ?? i.category,
            })),
            totalPrice,
          })
        );

        clearCart();
        window.location.href = pageUrl;
        return;
      }

      if (paymentMethod === "card_wfp") {
        // WayForPay працює через класичний POST-редирект форми (не JSON-
        // редирект як у Monobank) — сервер віддає готові поля з підписом,
        // ми збираємо приховану форму і сабмітимо її на secure.wayforpay.com.
        const purchaseRes = await fetch("/api/checkout/wayforpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })),
            customerPhone: form.phone,
          }),
        });

        if (!purchaseRes.ok) {
          setErrorMessage("Не вдалося створити оплату WayForPay. Спробуй ще раз або обери інший спосіб оплати.");
          setStatus("error");
          return;
        }

        const { actionUrl, fields } = await purchaseRes.json();

        localStorage.setItem(
          "mm_pending_order",
          JSON.stringify({
            orderId,
            gateway: "wayforpay",
            // Технічний orderReference, який реально пішов у WayForPay (може
            // містити телефон-суфікс) — саме його треба слати в CHECK_STATUS
            // на /order/success, а не "чистий" orderId.
            wfpRef: fields.orderReference,
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              category: i.categoryName ?? i.category,
            })),
            totalPrice,
          })
        );

        clearCart();

        const wfpForm = document.createElement("form");
        wfpForm.method = "POST";
        wfpForm.action = actionUrl;
        for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
          if (Array.isArray(value)) {
            for (const v of value) {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = key;
              input.value = String(v);
              wfpForm.appendChild(input);
            }
          } else {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = String(value);
            wfpForm.appendChild(input);
          }
        }
        document.body.appendChild(wfpForm);
        wfpForm.submit();
        return;
      }

      // Оплата при отриманні — Purchase шлемо в момент прийняття заявки,
      // а не реальної оплати (для card-оплати перенесено на /order/success).
      trackPurchase(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          category: i.categoryName ?? i.category,
        })),
        totalPrice
      );
      trackPurchaseGA4(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          category: i.categoryName ?? i.category,
        })),
        totalPrice
      );
      setStatus("success");
      clearCart();
    } catch {
      trackCheckoutEvent("checkout_error", "network");
      setErrorMessage("Не вдалося з'єднатися з сервером. Перевір інтернет і спробуй ще раз.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="fixed inset-0 z-[80] overlay flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-lg font-extrabold mb-2">Замовлення прийнято!</div>
          <div className="text-sm text-gray-500 mb-1">
            {form.confirmCall
              ? "Ми зв'яжемося з тобою протягом 30 хвилин для підтвердження."
              : "Обробимо без дзвінка — якщо щось потрібно уточнити, напишемо в SMS."}
          </div>
          <div className="text-xs text-gray-400 mb-6">
            Відправка Новою Поштою · Оплата при отриманні
          </div>
          <button
            onClick={onClose}
            className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold"
          >
            Супер!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] overlay flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-extrabold">📋 Оформлення</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ✕
          </button>
        </div>

        {/* Order summary */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-100">
          {items.map((item) => {
            const thumb = (
              <div className="w-7 h-7 relative rounded-md bg-gray-200 flex items-center justify-center text-sm overflow-hidden flex-shrink-0">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                ) : (
                  item.emoji
                )}
              </div>
            );
            return (
              <div
                key={item.id}
                className="flex justify-between items-center gap-2 text-xs py-1"
              >
                {item.slug ? (
                  // Відкриваємо в новій вкладці — щоб не втратити заповнену
                  // форму замовлення, якщо покупець хоче ще раз глянути товар.
                  <Link
                    href={`/product/${item.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 min-w-0 hover:underline"
                  >
                    {thumb}
                    <span className="truncate">
                      {item.name} ×{item.quantity}
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 min-w-0">
                    {thumb}
                    <span className="truncate">
                      {item.name} ×{item.quantity}
                    </span>
                  </span>
                )}
                <span className="font-bold flex-shrink-0">
                  {item.price * item.quantity}₴
                </span>
              </div>
            );
          })}
          <hr className="my-2" />
          <div className="flex justify-between text-sm font-extrabold">
            <span>Разом</span>
            <span>{totalPrice}₴</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {totalPrice >= 2000
              ? "✅ Безкоштовна доставка"
              : `📦 Доставка НП від 90₴`}
          </div>
        </div>

        {/* Payment method — картка онлайн пріоритетна: менше повернень і відмов при курєрі */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
            Спосіб оплати
          </label>
          <div className="space-y-2">
            {ONLINE_PAYMENTS_ENABLED && (
            <button
              type="button"
              onClick={() => setPaymentMethod("card_mono")}
              className={`w-full flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                paymentMethod === "card_mono"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200"
              }`}
            >
              <span className="text-xl">💳</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-bold">Оплата mono</span>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                    Рекомендуємо
                  </span>
                </span>
                <span className="block text-[11px] text-gray-500">
                  Швидше обробимо і відправимо замовлення
                </span>
              </span>
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  paymentMethod === "card_mono"
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-gray-300"
                }`}
              />
            </button>
            )}
            {ONLINE_PAYMENTS_ENABLED && (
            <button
              type="button"
              onClick={() => setPaymentMethod("card_wfp")}
              className={`w-full flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                paymentMethod === "card_wfp"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200"
              }`}
            >
              <span className="text-xl">💳</span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-bold">Оплата WayForPay</span>
                <span className="block text-[11px] text-gray-500">
                  Картка, Apple Pay, Google Pay
                </span>
              </span>
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  paymentMethod === "card_wfp"
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-gray-300"
                }`}
              />
            </button>
            )}
            <button
              type="button"
              onClick={() => setPaymentMethod("cod")}
              className={`w-full flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                paymentMethod === "cod"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200"
              }`}
            >
              <span className="text-xl">💰</span>
              <span className="flex-1 min-w-0">
                <span className="text-sm font-bold">Оплата при отриманні</span>
                <span className="block text-[11px] text-gray-500">
                  Готівкою або карткою на Новій Пошті
                </span>
              </span>
              <span
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  paymentMethod === "cod"
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-gray-300"
                }`}
              />
            </button>
            {paymentMethod === "cod" && requiresPrepayment && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                ⚠️ Замовлення до {COD_MIN_TOTAL}₴ відправляються лише з повною оплатою. Обери оплату карткою вище, щоб оформити замовлення.
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Honeypot — invisible to users, bots auto-fill it */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Ім&apos;я та прізвище *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Олена Коваленко"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Телефон *
            </label>
            <input
              type="tel"
              inputMode="tel"
              required
              value={form.phone}
              onChange={(e) => {
                // Лишаємо тільки цифри, пробіли, +, дужки й дефіс — решту (літери
                // й усе інше) відкидаємо одразу, щоб у полі фізично не можна
                // було набрати щось не схоже на номер телефону.
                const filtered = e.target.value.replace(/[^\d\s()+-]/g, "").slice(0, 20);
                setForm({ ...form, phone: filtered });
              }}
              onBlur={() => setPhoneTouched(true)}
              placeholder="+380 __ ___ __ __"
              aria-invalid={phoneTouched && form.phone.length > 0 && !isValidPhone(form.phone)}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 ${
                phoneTouched && form.phone.length > 0 && !isValidPhone(form.phone)
                  ? "border-red-400 focus:border-red-500 focus:ring-red-400"
                  : "border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
              }`}
            />
            {phoneTouched && form.phone.length > 0 && !isValidPhone(form.phone) && (
              <p className="text-[11px] text-red-500 mt-1">Формат: +380XXXXXXXXX або 0XXXXXXXXX</p>
            )}
          </div>
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Місто *
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              value={form.city}
              onChange={(e) => handleCityChange(e.target.value)}
              onFocus={() => {
                if (cityOptions.length > 0) setCityDropdownOpen(true);
              }}
              onBlur={() => {
                setTimeout(() => setCityDropdownOpen(false), 150);
              }}
              placeholder="Київ"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {cityDropdownOpen && cityOptions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {cityOptions.map((opt) => (
                  <button
                    key={opt.ref}
                    type="button"
                    onMouseDown={() => selectCity(opt)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-gray-50 last:border-b-0"
                  >
                    <span className="font-medium">{opt.name}</span>
                    {opt.area && (
                      <span className="text-gray-400 text-xs"> · {opt.area}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Відділення Нової Пошти *
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              value={form.branch}
              onChange={(e) => handleBranchChange(e.target.value)}
              onFocus={handleBranchFocus}
              onBlur={() => {
                setTimeout(() => setBranchDropdownOpen(false), 150);
              }}
              placeholder="Відділення №5, вул. Хрещатик, 1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {branchDropdownOpen && branchOptions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {branchOptions.map((opt) => (
                  <button
                    key={opt.ref}
                    type="button"
                    onMouseDown={() => selectBranch(opt)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b border-gray-50 last:border-b-0"
                  >
                    {opt.description}
                  </button>
                ))}
              </div>
            )}
            {!cityRef && (
              <p className="text-[11px] text-gray-400 mt-1">
                Обери місто зі списку — побачиш список відділень
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Коментар
            </label>
            <textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Колір, розмір або побажання..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.confirmCall}
              onChange={(e) => setForm({ ...form, confirmCall: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 flex-shrink-0"
            />
            <span className="text-xs text-gray-600">
              Зв&apos;язатися зі мною для підтвердження замовлення
            </span>
          </label>

          {status === "error" && (
            <div className="text-xs text-red-500 text-center">
              {errorMessage || "Щось пішло не так. Спробуй ще раз."}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "sending" || (paymentMethod === "cod" && requiresPrepayment)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white py-3.5 rounded-xl text-base font-extrabold transition-colors"
          >
            {status === "sending"
              ? "Відправляю..."
              : paymentMethod === "cod"
              ? "Замовити · Оплата при отриманні"
              : "Замовити · Оплата карткою"}
          </button>

          <div className="text-[10px] text-gray-400 text-center">
            {paymentMethod === "cod"
              ? "💰 Оплата при отриманні на Новій Пошті"
              : "💳 Перейдеш на захищену сторінку оплати"}
          </div>
        </form>
      </div>
    </div>
  );
}
