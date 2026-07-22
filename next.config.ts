import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Брендовані сторінки товару (blender, ventilyator) — той самий static HTML,
  // що і в /landing/*, тепер віддається напряму з канонічного /product/<slug>,
  // щоб не було зовнішнього редіректу і дублю URL для Meta-фіда/реклами.
  // beforeFiles — щоб перебити динамічний App Router роут /product/[slug].
  rewrites: async () => ({
    beforeFiles: [
      { source: "/landing/blender", destination: "/landing/blender/index.html" },
      {
        source: "/landing/ventilyator",
        destination: "/landing/ventilyator/index.html",
      },
      {
        source: "/product/blender-fresh-juice-portatyvnyy",
        destination: "/landing/blender/index.html",
      },
      {
        source: "/product/ventilyator-crownberg-sv413",
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
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self'",
            "connect-src 'self' https://api.telegram.org",
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
