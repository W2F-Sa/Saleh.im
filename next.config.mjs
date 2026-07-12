/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export so the whole site can be served from Cloudflare
  // Pages / Workers (and GitHub Pages) with zero server runtime.
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    // The Next image optimizer needs a server; disable it for static export.
    unoptimized: true,
  },
};

export default nextConfig;
