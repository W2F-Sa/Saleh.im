import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulse — status page & uptime monitor",
  description:
    "Pulse is a status page and uptime monitor by Saleh — add HTTP monitors and it checks them live from your browser, with real round-trip latency, uptime %, latency sparklines and an auto-generated incident timeline.",
  keywords: ["status page", "uptime monitor", "latency", "incidents", "observability", "monitoring", "Saleh"],
  alternates: { canonical: "https://saleh.im/pulse" },
  openGraph: {
    title: "Pulse — status page & uptime monitor",
    description: "Live uptime checks from your browser — real latency, uptime %, sparklines and an incident timeline.",
    url: "https://saleh.im/pulse",
    type: "website",
  },
};

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
