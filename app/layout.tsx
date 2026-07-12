import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { NO_FLASH_SCRIPT } from "@/lib/themes";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
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
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="grain antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
