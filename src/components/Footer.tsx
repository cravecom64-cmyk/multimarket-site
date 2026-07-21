import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 text-[10px]">
      <div className="px-4 py-6">
        <div className="text-sm font-extrabold text-white mb-4">MULTIMARKET</div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <div className="font-bold text-gray-300 mb-2">Каталог</div>
            <div className="space-y-1.5">
              <Link href="/category/home" className="block hover:text-white transition-colors">
                Дім і затишок
              </Link>
              <Link href="/category/garden" className="block hover:text-white transition-colors">
                Сад і подвір&apos;я
              </Link>
              <Link href="/category/pets" className="block hover:text-white transition-colors">
                Улюбленцям
              </Link>
            </div>
          </div>
          <div>
            <div className="font-bold text-gray-300 mb-2">Інформація</div>
            <div className="space-y-1.5">
              <span className="block">Доставка і оплата</span>
              <span className="block">Повернення</span>
              <span className="block">Про нас</span>
              <span className="block">FAQ</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 mb-4 text-xs">
          <a href="https://tiktok.com/@multimarket_ua" target="_blank" rel="noopener noreferrer" className="hover:text-white">
            ♪ TikTok
          </a>
          <a href="https://instagram.com/multimarket_ua" target="_blank" rel="noopener noreferrer" className="hover:text-white">
            📸 Instagram
          </a>
          <a href="https://t.me/multimarket_ua" target="_blank" rel="noopener noreferrer" className="hover:text-white">
            ✈️ Telegram
          </a>
        </div>
        <div className="border-t border-gray-700 pt-3 text-[9px] text-gray-600">
          © 2026 Multimarket · Всі права захищені
        </div>
      </div>
    </footer>
  );
}