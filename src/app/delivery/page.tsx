import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Доставка і оплата",
  description:
    "Доставка Новою Поштою по всій Україні 1-3 дні, безкоштовно від 2000₴. Оплата карткою онлайн зі знижкою 5% або при отриманні (від 300₴).",
  alternates: {
    canonical: "https://www.multi-market.com.ua/delivery",
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
                Вартість: за тарифами НП (від 90₴, до 2 кг)
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
            Відправляємо замовлення протягом 1-3 днів після підтвердження.
            Номер накладної повідомляємо одразу, як тільки товар передано перевізнику.
          </p>
        </div>

        <div>
          <div className="font-extrabold text-gray-900 text-[14px] mb-2">
            💰 Оплата
          </div>
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-gray-900">
                Повна оплата карткою онлайн – знижка 5%
              </div>
              <div className="text-gray-600">
                Visa, Mastercard, Apple Pay, Google Pay через mono або
                WayForPay. Знижка 5% рахується автоматично при оформленні.
                Без накладного платежу та комісії на пошті.
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                Оплата при отриманні
              </div>
              <div className="text-gray-600">
                Для замовлень від 300₴: передоплата до 100₴ карткою (точну суму
                видно при оформленні), решту – при отриманні на пошті. Комісія
                НП за переказ – 20₴ + 2% від суми. Таке замовлення підтверджуємо
                дзвінком.
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
