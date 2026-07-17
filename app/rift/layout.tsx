import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rift — neon arena survival game",
  description:
    "Rift is a fast, smooth browser game by Saleh — a neon arena survival where you defend the Core, auto-blast escalating waves, spend salvage on upgrades, deploy sentries and topple a boss in every sector. Action + strategy, 60fps Canvas, no downloads.",
  keywords: ["browser game", "canvas game", "arena survival", "action", "strategy", "roguelite", "Saleh"],
  alternates: { canonical: "https://saleh.im/rift" },
  openGraph: {
    title: "Rift — neon arena survival game",
    description: "Defend the Core, survive escalating waves, upgrade and deploy sentries across five sectors. 60fps, in your browser.",
    url: "https://saleh.im/rift",
    type: "website",
  },
};

export default function RiftLayout({ children }: { children: React.ReactNode }) {
  return children;
}
