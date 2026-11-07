import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // HTTP -> HTTPS for every path (pages, /api, /_next/static), before the proxy runs. HSTS (below) only takes effect once
  // a browser has been on HTTPS, so this redirect covers the first visit. TLS is terminated by the host / reverse proxy,
  // which must send `X-Forwarded-Proto: https` (Vercel and most platforms do). If it doesn't, Next fills the header in as
  // "http" and this loops: fix the proxy, don't remove the redirect.
  // Production builds only, and never for localhost, so `next dev` / a local `next start` keep working over plain HTTP.
  async redirects() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/:path*",
        has: [
          { type: "header", key: "x-forwarded-proto", value: "http" },
          { type: "host", value: "(?<host>.+)" },
        ],
        // Next strips the port before matching, so "[::1]:3000" arrives here as "[".
        missing: [{ type: "host", value: "(localhost|127(\\.\\d{1,3}){3}|\\[)" }],
        destination: "https://:host/:path*",
        permanent: true, // 308: keeps the method and body, unlike 301
      },
    ];
  },
  // cacheComponents / partialPrefetching are off: the strict nonce-based CSP (proxy.ts) needs every page rendered per request,
  // and prerendered shells can't carry a per-request nonce.
  async headers() {
    const baseline = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // payment=(self) so a provider's hosted fields / Payment Request can be added later; everything else off.
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
      // No other site may frame any of our pages (clickjacking). The full Content-Security-Policy is set per request in proxy.ts.
      { key: "X-Frame-Options", value: "DENY" },
    ];
    const noStore = [{ key: "Cache-Control", value: "no-store, max-age=0" }];
    return [
      { source: "/:path*", headers: baseline },
      // Signed-in pages with personal data: never stored by the browser or shared caches.
      { source: "/learn/:path*", headers: noStore },
      { source: "/my-courses", headers: noStore },
      { source: "/admin/:path*", headers: noStore },
      { source: "/instructor/:path*", headers: noStore },
      {
        // Payment pages: never cached, can't be framed (clickjacking), no plugins, no base-tag hijacking.
        source: "/checkout/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
