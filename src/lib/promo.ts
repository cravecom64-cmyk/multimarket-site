// Акція Black Friday: знижки на весь каталог до 30.11.2026 включно (Київ).
// Після дати: плашка й підпис «акція до …» зникають самі, priceValidUntil
// прибирається з розмітки. Ціни НЕ змінюються автоматично — це рішення Павла.
export const PROMO = {
  name: "Black Friday",
  endsAtIso: "2026-11-30T23:59:59+02:00",
  endsAtDate: "2026-11-30", // для schema.org priceValidUntil
  endsAtLabel: "30.11",
};

export function isPromoActive(now: Date = new Date()): boolean {
  return now.getTime() <= new Date(PROMO.endsAtIso).getTime();
}


// --- "Розумний" хіро-банер на головній: текст/чип/бігучий рядок самі
// перемикаються під інфопривід за датою, без ручних правок коду щосезону.
// Якщо жоден період не активний — getActiveHeroScenario() поверне null,
// і хіро на головній покаже нейтральний варіант без лічильника/чипа.
// Додаючи новий сезон — просто додай ще один об'єкт у HERO_SCENARIOS.
export interface HeroScenario {
  id: string;
  startIso: string;
  endIso: string;
  // Дедлайн для лічильника-чипа може відрізнятись від endIso періоду
  // (напр. новорічний період тягнеться до 08.01, а лічильник — до 31.12).
  countdownTargetIso: string;
  chipEmoji: string;
  headlinePrefix: string;
  headlineAccent: string;
  tickerMessages: string[];
}

export const HERO_SCENARIOS: HeroScenario[] = [
  {
    id: "blackfriday",
    startIso: "2026-11-01T00:00:00+02:00",
    endIso: "2026-11-30T23:59:59+02:00",
    countdownTargetIso: "2026-11-30T23:59:59+02:00",
    chipEmoji: "🖤",
    headlinePrefix: "Black Friday — знижки до ",
    headlineAccent: "-50%",
    tickerMessages: ["🖤 Чорна п'ятниця — знижки до -50%"],
  },
  {
    id: "newyear",
    startIso: "2026-12-01T00:00:00+02:00",
    endIso: "2027-01-08T23:59:59+02:00",
    countdownTargetIso: "2026-12-31T23:59:59+02:00",
    chipEmoji: "🎄",
    headlinePrefix: "Новорічні знижки до ",
    headlineAccent: "-50%",
    tickerMessages: ["🎄 Новий рік — знижки до -50%"],
  },
];

export function getActiveHeroScenario(now: Date = new Date()): HeroScenario | null {
  const t = now.getTime();
  return (
    HERO_SCENARIOS.find(
      (s) => t >= new Date(s.startIso).getTime() && t <= new Date(s.endIso).getTime()
    ) ?? null
  );
}

// "N днів" / "N днів Nг" до дедлайну — для чипа й для другого
// повідомлення бігучого рядка. Повертає null, якщо дедлайн вже минув.
export function formatCountdown(targetIso: string, now: Date = new Date()): string | null {
  const diffMs = new Date(targetIso).getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  if (days > 0) return `${days} ${pluralDays(days)}`;
  return `${hours} год`;
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дні";
  return "днів";
}
