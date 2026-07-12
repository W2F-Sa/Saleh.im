import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl = "https://saleh.im";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Saleh Saghafiani — Software & Network Engineer",
  description:
    "Portfolio & resume of Saleh Saghafiani (Saleh). Self-taught software and network engineer building fast, resilient systems at the edge since 2022.",
  keywords: [
    "Saleh Saghafiani",
    "Saleh",
    "software engineer",
    "network engineer",
    "Cloudflare Workers",
    "portfolio",
    "developer",
    "W2F-Sa",
  ],
  authors: [{ name: "Saleh Saghafiani", url: "https://github.com/W2F-Sa" }],
  creator: "Saleh Saghafiani",
  openGraph: {
    title: "Saleh Saghafiani — Software & Network Engineer",
    description:
      "Self-taught software and network engineer building fast, resilient systems at the edge since 2022.",
    url: siteUrl,
    siteName: "saleh.im",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Saleh Saghafiani — Software & Network Engineer",
    description:
      "Self-taught software and network engineer building fast, resilient systems at the edge since 2022.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#060606" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body className="noise antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
