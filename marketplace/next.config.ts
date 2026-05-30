import type { NextConfig } from "next";

// Production CSP: 'unsafe-inline' required for Next.js hydration scripts.
// 'unsafe-eval' kept for React Compiler dev mode only — Vercel strips in prod via nonces.
// When migrating to nonce-based CSP, use next.config.ts experimental.appDir csp support.
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob: data:",
  "connect-src 'self' https://api.valueskins.io http://localhost:8080 https://localhost:8080 wss: https://*.firebaseio.com https://*.googleapis.com https://*.firebasedatabase.app",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // "upgrade-insecure-requests", // DEV ONLY — commented to prevent HTTPS redirect on localhost
].join("; ");

const nextConfig: NextConfig = {
  output: 'standalone',
  reactCompiler: false,
  turbopack: {
    root: __dirname,
  },

  // Performance: compress responses
  compress: true,

  // Security headers — applied to all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "0" }, // Deprecated header — modern browsers ignore it; disabled to avoid edge-case XSS via auditor
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // Only set HSTS in production (Vercel handles it); dev on localhost causes Chrome HTTPS cache
          ...(process.env.NODE_ENV === 'production' ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      // Static assets — long cache, immutable
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // API routes — no cache
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },

  // Image optimization: modern formats
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60,
  },

  // Production performance
  poweredByHeader: false,

  // Strict mode for catching bugs
  reactStrictMode: true,
};

export default nextConfig;
