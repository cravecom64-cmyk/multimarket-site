import Script from "next/script";

// Google Analytics 4 (GA4) — property "Multimarket", підключено 2026-08-03.
// Measurement ID видано Google Analytics, змінюється рідко — тримаємо як
// константу (як і офіційний сніпет з Google), без env var.
const GA_MEASUREMENT_ID = "G-FZDD4K8SFP";

export function GoogleAnalytics() {
  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
