import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Старі static HTML лендинги (blender, ventilyator) лишені у /public/landing/
  // для сумісності зі старими посиланнями, але /product/<slug> для цих товарів
  // більше НЕ підміняється на raw HTML — рендериться звичайним App Router
  // роутом /product/[slug] (LandingProduct для blender, стандартний шаблон
  // для ventilyator), щоб мати спільну шапку/нав/кошик як і решта карток сайту.
  rewrites: async () => ({
    beforeFiles: [
      { source: "/landing/blender", destination: "/landing/blender/index.html" },
      {
        source: "/landing/ventilyator",
        destination: "/landing/ventilyator/index.html",
      },
    ],
  }),
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        // Prevent clickjacking — site cannot be embedded in iframes
        { key: "X-Frame-Options", value: "DENY" },
        // Prevent MIME type sniffing
        { key: "X-Content-Type-Options", value: "nosniff" },
        // XSS protection
        { key: "X-XSS-Protection", value: "1; mode=block" },
        // Referrer policy — don't leak full URL to external sites
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Permissions policy — disable unnecessary browser APIs
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=()",
        },
        // Force HTTPS (Vercel handles this, but belt & suspenders)
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        // Content Security Policy
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self'",
            "connect-src 'self' https://api.telegram.org https://connect.facebook.net https://www.facebook.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
            // Meta Pixel (fbevents.js) інколи використовує прихований iframe/form
            // як резервний спосіб доставки події, якщо fetch/sendBeacon недоступні.
            // Без явного frame-src CSP підставляє default-src 'self' і глушить це
            // мовчки (подія просто губиться, без помилки в мережевій вкладці).
            "frame-src 'self' https://www.facebook.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self' https://www.facebook.com",
          ].join("; "),
        },
      ],
    },
    {
      // Block access to API from external origins
      source: "/api/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        // Cache prevention for API responses
        {
          key: "Cache-Control",
          value: "no-store, no-cache, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Старі static HTML лендинги (blender, ventilyator) лишені у /public/landing/
  // для сумісності зі старими посиланнями, але /product/<slug> для цих товарів
  // більше НЕ підміняється на raw HTML — рендериться звичайним App Router
  // роутом /product/[slug] (LandingProduct для blender, стандартний шаблон
  // для ventilyator), щоб мати спільну шапку/нав/кошик як і решта карток сайту.
  rewrites: async () => ({
    beforeFiles: [
      { source: "/landing/blender", destination: "/landing/blender/index.html" },
      {
        source: "/landing/ventilyator",
        destination: "/landing/ventilyator/index.html",
      },
    ],
  }),
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        // Prevent clickjacking — site cannot be embedded in iframes
        { key: "X-Frame-Options", value: "DENY" },
        // Prevent MIME type sniffing
        { key: "X-Content-Type-Options", value: "nosniff" },
        // XSS protection
        { key: "X-XSS-Protection", value: "1; mode=block" },
        // Referrer policy — don't leak full URL to external sites
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // Permissions policy — disable unnecessary browser APIs
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=()",
        },
        // Force HTTPS (Vercel handles this, but belt & suspenders)
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        // Content Security Policy
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self'",
            "connect-src 'self' https://api.telegram.org https://connect.facebook.net https://www.facebook.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
    {
      // Block access to API from external origins
      source: "/api/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        // Cache prevention for API responses
        {
          key: "Cache-Control",
          value: "no-store, no-cache, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
