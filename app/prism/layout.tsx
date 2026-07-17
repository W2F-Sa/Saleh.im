import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prism — headless UI kit playground",
  description:
    "Prism is a headless UI kit and design-system playground by Saleh — drive design tokens (accent, radius, density, shadow) and watch a live gallery of accessible components re-theme instantly, then export them as CSS variables or a Tailwind theme.",
  keywords: ["design system", "UI kit", "design tokens", "headless components", "theming", "Tailwind", "accessibility", "Saleh"],
  alternates: { canonical: "https://saleh.im/prism" },
  openGraph: {
    title: "Prism — headless UI kit playground",
    description: "Drive design tokens and watch a live component gallery re-theme instantly. Export CSS variables or a Tailwind theme.",
    url: "https://saleh.im/prism",
    type: "website",
  },
};

export default function PrismLayout({ children }: { children: React.ReactNode }) {
  return children;
}
