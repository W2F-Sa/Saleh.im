import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Relay — event & webhook router",
  description:
    "Relay is a visual webhook and event router by Saleh — receive a JSON event, transform it through a pipeline (filter, rename, set, delete, delay) and fan it out to destinations with real HMAC-SHA256 signing and automatic retries. Runs entirely in your browser.",
  keywords: ["webhook router", "event pipeline", "automation", "HMAC signing", "integrations", "iPaaS", "Saleh"],
  alternates: { canonical: "https://saleh.im/relay" },
  openGraph: {
    title: "Relay — event & webhook router",
    description: "Build a webhook pipeline: transform a JSON event and fan it out to destinations with HMAC signing and retries.",
    url: "https://saleh.im/relay",
    type: "website",
  },
};

export default function RelayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
