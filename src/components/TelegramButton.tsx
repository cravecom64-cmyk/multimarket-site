"use client";

export function TelegramButton() {
  return (
    <a
      href="https://t.me/multimarket_ua"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 z-30 w-12 h-12 bg-[#0088cc] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
      style={{ right: "max(1rem, calc(50% - 240px + 1rem))" }}
      aria-label="Telegram"
    >
      <span className="text-white text-lg">✈️</span>
    </a>
  );
}