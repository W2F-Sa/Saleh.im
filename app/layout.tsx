import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { LangProvider } from "@/components/lang-provider";
import { NO_FLASH_SCRIPT } from "@/lib/themes";
import { NO_FLASH_LANG } from "@/lib/i18n";
import { PwaRegister } from "@/components/pwa-register";

/* ---- Latin type system ---- */
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

/* ---- Persian UI face (numbers, labels). The soft display/body/quote faces
       (Gandom, Shabnam, Samim) load from a CDN below and only download when
       Farsi is active. ---- */
const vazir = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-fa-ui",
  display: "swap",
  preload: false,
});

const siteUrl = "https://saleh.im";
const DESCRIPTION =
  "Portfolio & resume of Saleh Saghafiani (Saleh). Software engineer crafting fast, elegant products for the web — real-time tools, network utilities and zero-knowledge encrypted apps. Shipping since 2022.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Saleh Saghafiani — Software Engineer",
    template: "%s — Saleh Saghafiani",
  },
  description: DESCRIPTION,
  keywords: [
    "Saleh Saghafiani",
    "Saleh",
    "صالح ثقفیانی",
    "software engineer",
    "network engineer",
    "React",
    "Next.js",
    "TypeScript",
    "portfolio",
    "resume",
    "im-saleh",
    "salehcodez",
    "encrypted password manager",
    "end-to-end encrypted messenger",
  ],
  authors: [{ name: "Saleh Saghafiani", url: "https://github.com/im-saleh" }],
  creator: "Saleh Saghafiani",
  publisher: "Saleh Saghafiani",
  category: "technology",
  alternates: {
    canonical: siteUrl,
    languages: { "en-US": siteUrl, "fa-IR": siteUrl },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "Saleh Saghafiani — Software Engineer",
    description: "Software engineer crafting fast, elegant products for the web. Shipping since 2022.",
    url: siteUrl,
    siteName: "saleh.im",
    type: "website",
    locale: "en_US",
    alternateLocale: ["fa_IR"],
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: "Saleh Saghafiani" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Saleh Saghafiani — Software Engineer",
    description: "Software engineer crafting fast, elegant products for the web. Shipping since 2022.",
    creator: "@salehcodez",
    images: ["/icon.svg"],
  },
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`,
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/icon.svg`,
  },
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Vault", statusBarStyle: "black-translucent" },
  applicationName: "Vault — by Saleh",
};

/* JSON-LD structured data — Person + WebSite + the suite of apps. Helps search
   engines and rich results understand who Saleh is and what the site offers. */
/* The full suite of apps, described once and reused for both the structured
   data below and (implicitly) the sitemap. Each is a free SoftwareApplication
   authored by Saleh. */
const FREE_OFFER = { "@type": "Offer", price: "0", priceCurrency: "USD" };
const SUITE: { name: string; category: string; os: string; path: string; description: string; downloadUrl?: string }[] = [
  { name: "Vault", category: "SecurityApplication", os: "Web, Linux", path: "/vault", description: "Zero-knowledge password & secrets manager encrypted with Argon2id + XChaCha20-Poly1305. Web app and native Linux (Qt6 + libsodium) build.", downloadUrl: "https://cdn.saleh.im/valut.deb" },
  { name: "Messenger", category: "CommunicationApplication", os: "Web", path: "/messenger", description: "Serverless, end-to-end encrypted peer-to-peer messenger over WebRTC — keys never leave the device." },
  { name: "Forge", category: "DeveloperApplication", os: "Web", path: "/forge", description: "A private developer toolbox with 70+ tools — encoders, formatters, generators, converters and crypto utilities — all running locally in the browser." },
  { name: "Lumen", category: "BusinessApplication", os: "Web", path: "/lumen", description: "A real-time markets dashboard with live data, animated charts, KPI counters and sortable tables." },
  { name: "Probe", category: "UtilitiesApplication", os: "Web", path: "/probe", description: "A live connection & privacy inspector: public IP, geolocation, real WebRTC candidate gathering and a device fingerprint surface." },
  { name: "Vanguard", category: "GameApplication", os: "Web", path: "/vanguard", description: "A browser first-person shooter on a hand-written raycast engine — an eight-mission campaign, ten maps, eleven weapons, an undead horde and true peer-to-peer online play." },
  { name: "Rift", category: "GameApplication", os: "Web", path: "/rift", description: "A 60fps neon arena-survival game on a hand-written Canvas engine — escalating waves, deep upgrades, sentries and sector bosses." },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${siteUrl}/#person`,
      name: "Saleh Saghafiani",
      alternateName: ["Saleh", "صالح ثقفیانی", "im-saleh", "salehcodez"],
      url: siteUrl,
      jobTitle: "Software & Network Engineer",
      email: "mailto:salehcodez@gmail.com",
      sameAs: ["https://github.com/im-saleh", "https://t.me/dm_saleh"],
      knowsAbout: [
        "Software Engineering",
        "Web Development",
        "React",
        "Next.js",
        "TypeScript",
        "Node.js",
        "WebRTC",
        "Applied Cryptography",
        "Computer Networks",
        "Game Development",
        "Linux",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "saleh.im",
      alternateName: "Saleh Saghafiani",
      description: DESCRIPTION,
      inLanguage: ["en", "fa"],
      publisher: { "@id": `${siteUrl}/#person` },
      author: { "@id": `${siteUrl}/#person` },
    },
    {
      "@type": "ProfilePage",
      "@id": `${siteUrl}/#profilepage`,
      url: siteUrl,
      name: "Saleh Saghafiani — Software Engineer",
      inLanguage: "en",
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: { "@id": `${siteUrl}/#person` },
    },
    {
      "@type": "ItemList",
      name: "Projects by Saleh Saghafiani",
      numberOfItems: SUITE.length,
      itemListElement: SUITE.map((app, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "SoftwareApplication",
          name: app.name,
          applicationCategory: app.category,
          operatingSystem: app.os,
          url: `${siteUrl}${app.path}`,
          description: app.description,
          offers: FREE_OFFER,
          author: { "@id": `${siteUrl}/#person` },
          ...(app.downloadUrl ? { downloadUrl: app.downloadUrl } : {}),
        },
      })),
    },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
    { media: "(prefers-color-scheme: light)", color: "#f2eee4" },
  ],
};

const FA_FONTS = [
  "https://cdn.jsdelivr.net/gh/rastikerdar/shabnam-font@v5.0.1/dist/font-face.css",
  "https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/font-face.css",
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [inter.variable, display.variable, mono.variable, vazir.variable].join(" ");

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={fontVars}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_LANG }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        {FA_FONTS.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className="grain antialiased">
        <LangProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LangProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
