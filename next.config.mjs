/** @type {import('next').NextConfig} */

// When building for GitHub Pages (a project site served from
// https://<user>.github.io/<repo>/) we need a base path. The workflow sets
// NEXT_PUBLIC_BASE_PATH=/Saleh.im. For Cloudflare Pages / local dev it stays
// empty so the site is served from the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  // Static HTML export — served by Cloudflare Pages/Workers or GitHub Pages
  // with zero server runtime.
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
