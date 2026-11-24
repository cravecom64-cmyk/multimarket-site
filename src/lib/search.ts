import { getAllProducts, type Product } from "@/lib/products";
import { isInternalVisit } from "@/lib/analytics";
import { trackSearch } from "@/lib/pixel";
import { trackSearch as trackSearchGA4 } from "@/lib/ga4";

// ВИНЕСЕНО 24.11.2026 з SearchPageClient.tsx (запит Павла — хоче таку саму
// "випереджувальну" підказку прямо з іконки пошуку в шапці сайту, а не лише
// на окремій сторінці /search). Щоб логіка пошуку (і трекінг запитів) не
// розбігалась у двох місцях, уся відповідна логіка живе тут — і сторінка
// /search, і випадаюча підказка в Header.tsx імпортують звідси те саме.

const allProducts = getAllProducts();

// ДОДАНО 24.11.2026 (запит Павла — покупець шукав "гірлянди", хоча товари в
// каталозі є, і нічого не знайшов). Стара реалізація шукала всю фразу запиту
// одним суцільним підрядком у тексті товару — і ламалась у двох типових
// випадках: (1) українські слова відмінюються/мають множину ("гірлянди" НЕ є
// підрядком "гірлянда" — рядки відрізняються лише останньою літерою), і
// (2) покупець вставляє в пошук цілу фразу з реклами на кшталт "Гірлянда 6 за
// 69 грн" — жоден товар не містить цю фразу дослівно, хоча "гірлянда" там є.
// Нова версія розбиває запит на слова, рахує скільки слів знайшлось (а не
// вимагає збігу всієї фрази), і для кожного слова, крім точного підрядка,
// пробує "нечіткий" збіг по спільному префіксу — щоб "гірлянди"/"гірлянда",
// "лампи"/"лампа", "ліхтарик"/"ліхтар" вважались тим самим словом. Це проста
// евристика (без лематизації/стемера чи зовнішніх бібліотек), а не повноцінна
// мовна обробка — працює через те, що українські словоформи зазвичай
// відрізняються лише останніми 1-2 літерами. Короткі службові слова (за, та,
// і, для, з...) ігноруються — інакше вони "роздмухують" кількість збігів для
// будь-якого товару і псують сортування за релевантністю.
const SEARCH_STOPWORDS = new Set([
  "за", "та", "і", "й", "в", "у", "на", "до", "від", "або", "це", "що", "як",
  "для", "з", "із", "зі", "не", "по", "під", "над", "при", "без", "же", "чи",
  "и", "но", "или", "от",
]);

function tokenize(text: string, dropStopwords = false): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-zа-яіїєґ0-9]+/)
    .filter((w) => w.length >= 2);
  return dropStopwords ? words.filter((w) => !SEARCH_STOPWORDS.has(w)) : words;
}

// ДОДАНО 24.11.2026 (запит Павла — "а якщо люди пишуть з помилкою?"):
// wordMatch() нижче ловить лише відмінювання в КІНЦІ слова (спільний
// префікс) — одрук посередині чи на початку слова ("гилянда" замість
// "гірлянда", "лмапа" замість "лампа") він не впіймає. Для цього — відстань
// Дамерау-Левенштейна (OSA-варіант): мінімальна кількість вставок/видалень/
// замін ОДНІЄЇ літери чи переставлення двох сусідніх літер, щоб перетворити
// одне слово на інше. Без зовнішніх бібліотек — каталог невеликий (сотня
// товарів × кілька слів у описі), рахувати це на кожен символ запиту
// недорого навіть у браузері.
function osaDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Два слова вважаються збігом, якщо одне містить інше підрядком (типовий
// випадок — "лампа" входить у "лампочка"), або — для слів від 4 літер — якщо
// в них спільний префікс довжиною "довжина мінус 2 літери" (щонайменше 4):
// так "гірлянди" і "гірлянда" (різняться лише останньою літерою) чи "лампи" і
// "лампа" визнаються тим самим словом, не потребуючи точного відмінка. Якщо
// й це не збіглось — для слів від 5 літер пробуємо допустиму кількість
// одруків (1 для слів 5-7 літер, 2 для довших — довші слова "витримують"
// більше випадкових відмінностей, не стаючи схожими на щось зовсім інше).
// Короткі слова (менше 4-5 літер) лишаються точним підрядком без жодної
// нечіткості — інакше короткі непов'язані слова (напр. "пила"/"вила")
// почнуть випадково збігатись між собою.
function wordMatch(queryWord: string, haystackWord: string): boolean {
  if (queryWord.length < 2 || haystackWord.length < 2) return false;
  if (haystackWord.includes(queryWord)) return true;
  const minLen = Math.min(queryWord.length, haystackWord.length);
  if (minLen >= 4) {
    const prefixLen = Math.max(4, minLen - 2);
    if (queryWord.slice(0, prefixLen) === haystackWord.slice(0, prefixLen)) return true;
  }
  if (minLen >= 5) {
    const maxTypos = minLen <= 7 ? 1 : 2;
    if (osaDistance(queryWord, haystackWord) <= maxTypos) return true;
  }
  return false;
}

export function searchProducts(query: string): Product[] {
  const withoutStopwords = tokenize(query, true);
  // Якщо запит складався ЛИШЕ зі службових слів — не ріжемо все до нуля,
  // шукаємо по них як є (краще щось, ніж пустий результат на порожньому
  // масиві слів).
  const queryWords = withoutStopwords.length > 0 ? withoutStopwords : tokenize(query);
  if (queryWords.length === 0) return [];

  const scored = allProducts
    .map((p) => {
      const haystack = `${p.name} ${p.shortDesc} ${p.categoryName} ${p.searchKeywords ?? ""}`;
      const haystackWords = tokenize(haystack);
      const matchedCount = queryWords.filter((qw) =>
        haystackWords.some((hw) => wordMatch(qw, hw))
      ).length;
      return { product: p, matchedCount };
    })
    .filter((r) => r.matchedCount > 0);

  // Товари, де збіглося більше слів запиту — вище; при рівності — популярніші
  // (orderCount) вище, той самий принцип "найкраще спочатку", що й в інших
  // місцях каталогу (напр. філлер у getRelatedProducts).
  scored.sort(
    (a, b) => b.matchedCount - a.matchedCount || b.product.orderCount - a.product.orderCount
  );
  return scored.map((r) => r.product);
}

// Трекінг пошукових запитів — щоб Павло міг швидко бачити що люди шукають на
// сайті (і чого бракує в каталозі). Викликається з debounce ~900мс в обох
// місцях, де є поле пошуку (SearchPageClient і випадаюча підказка в Header).
export function trackSearchQuery(query: string, resultsCount: number): void {
  trackSearch(query, resultsCount);
  trackSearchGA4(query, resultsCount);
  // Внутрішні пошуки (Павел, перевірки) не пишемо в базу й не шлемо в Telegram
  if (isInternalVisit()) return;
  fetch("/api/track-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, resultsCount }),
  }).catch(() => {
    // мовчки ігноруємо — трекінг не має заважати самому пошуку
  });
}
