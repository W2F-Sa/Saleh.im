import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vanguard — browser FPS, online & offline",
  description:
    "Vanguard is a fast, first-person shooter that runs entirely in your browser — a hand-written raycast engine, eleven weapons, eight large maps, a five-mission campaign, bots with five difficulty tiers, an auto-play mode, and true peer-to-peer online matches with no relay server in between. No downloads, no lag.",
  keywords: ["browser FPS", "web game", "raycaster", "multiplayer", "WebRTC", "P2P game", "bots", "campaign", "Saleh"],
  alternates: { canonical: "https://saleh.im/vanguard" },
  openGraph: {
    title: "Vanguard — browser FPS, online & offline",
    description: "A CoD-style first-person shooter in your browser: campaign, skirmish and true peer-to-peer online play, eleven weapons, eight maps, no server in the middle.",
    url: "https://saleh.im/vanguard",
    type: "website",
  },
};

export default function VanguardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
