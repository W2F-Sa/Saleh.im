/** @type {import('next').NextConfig} */

/**
 * Built for Cloudflare Workers via @opennextjs/cloudflare.
 * (No `output: export` — OpenNext needs the full Next server build.)
 * Aggressive, safe caching is applied to immutable build assets so the site
 * loads instantly on repeat visits, including on mobile.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Never ship readable source maps to the browser — the production bundle is
  // minified by SWC and no original source is exposed. This is the single most
  // effective (and performance-safe) way to keep the code from being read.
  productionBrowserSourceMaps: false,
  images: {
    // The Cloudflare image optimizer isn't wired up; keep images raw & fast.
    unoptimized: true,
  },
  // Production hardening: strip all console.* (except errors) and React dev-only
  // props (data-testid, etc.) so the shipped JS is smaller, faster and harder to
  // read — without the runtime cost of heavy source obfuscation.
  compiler: {
    removeConsole: isProd ? { exclude: ["error"] } : false,
    reactRemoveProperties: isProd,
  },
  // Trim the client bundle a touch.
  experimental: {
    optimizePackageImports: ["peerjs"],
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      {
        source: "/favicon.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|woff2|woff)",
        headers: [{ key: "Cache-Control", value: IMMUTABLE }],
      },
      {
        // The live IP endpoint must never be cached.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
