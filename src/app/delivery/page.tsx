import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Доставка і оплата",
  description:
    "Доставка Новою Поштою по всій Україні 1-3 дні, безкоштовно від 2000₴. Оплата при отриманні або карткою онлайн.",
  alternates: {
    canonical: "https://multi-market.com.ua/delivery",
  },
};

export default function DeliveryPage() {
  return (
    <>
      <div className="mx-3 mt-3 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 px-5 py-6">
        <h1 className="text-[20px] font-extrabold text-white leading-tight">
          Доставка і оплата
        </h1>
      </div>

      <div className="px-4 py-6 text-[13px] text-gray-700 leading-relaxed space-y-6">
        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            📦 Доставка
          </div>
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-gray-900">
                Нова Пошта — самовивіз з відділення
              </div>
              <div className="text-gray-600">
                Термін: 1-3 робочих дні по Україні
                <br />
                Вартість: за тарифами НП (зазвичай 60-80₴)
                <br />
                Безкоштовно при замовленні від 2000₴
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                Нова Пошта — кур&apos;єр додому
              </div>
              <div className="text-gray-600">
                Термін: 1-3 робочих дні
                <br />
                Вартість: за тарифами НП + послуга кур&apos;єра
              </div>
            </div>
          </div>
          <p className="mt-3">
            Замовлення, оформлені до 15:00, відправляємо того ж дня.
            Трекінг-номер надсилаємо у SMS одразу після відправки.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            💰 Оплата
          </div>
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-gray-900">
                Наложний платіж
              </div>
              <div className="text-gray-600">
                Оплата при отриманні на пошті. Ти спочатку бачиш товар,
                потім платиш. Комісія НП за переказ — 20₴ + 2% від суми.
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                Оплата карткою онлайн
              </div>
              <div className="text-gray-600">
                Visa, Mastercard. Списується одразу при оформленні. Без
                комісії.
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
