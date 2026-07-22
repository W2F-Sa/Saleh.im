import type { MetadataRoute } from "next";

const siteUrl = "https://saleh.im";

/**
 * Static route map for the site + its suite of apps. Regenerated on every
 * build so `lastModified` stays fresh.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1.0, freq: "monthly" },
    { path: "/vault", priority: 0.9, freq: "monthly" },
    { path: "/messenger", priority: 0.9, freq: "monthly" },
    { path: "/probe", priority: 0.8, freq: "monthly" },
    { path: "/lumen", priority: 0.8, freq: "monthly" },
    { path: "/forge", priority: 0.8, freq: "monthly" },
    { path: "/rift", priority: 0.7, freq: "monthly" },
    { path: "/aperture", priority: 0.7, freq: "monthly" },
    { path: "/prism", priority: 0.7, freq: "monthly" },
    { path: "/nota", priority: 0.7, freq: "monthly" },
    { path: "/pulse", priority: 0.7, freq: "monthly" },
    { path: "/relay", priority: 0.7, freq: "monthly" },
    { path: "/download", priority: 0.6, freq: "monthly" },
  ];
  return routes.map((r) => ({
    url: `${siteUrl}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
