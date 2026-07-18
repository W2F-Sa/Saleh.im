import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forge — developer toolbox",
  description:
    "Forge is a fast, private developer toolbox by Saleh with 170+ tools organised into tabs — JSON/CSV/YAML/XML/TypeScript, Base64/Base58/Ascii85/URL/HTML/JWT, AES/XOR/Vigenère ciphers, HMAC & TOTP, hashing, UUID/ULID/password/mock-data generators, a colour studio with harmonies and palettes, regex tester, cron scheduler, diff, markdown, maths & statistics, unit/base/number converters, network utilities (CIDR, IPv6, MAC), date & time calculators, CSS generators and more. Everything runs in your browser.",
  keywords: [
    "developer tools",
    "json formatter",
    "yaml converter",
    "base64",
    "jwt decoder",
    "regex tester",
    "hash generator",
    "hmac totp",
    "uuid generator",
    "color harmonies palette",
    "unit converter",
    "math calculator",
    "cron",
    "diff",
    "Saleh",
  ],
  alternates: { canonical: "https://saleh.im/forge" },
  openGraph: {
    title: "Forge — developer toolbox",
    description: "170+ fast, private developer tools in one place, organised into tabs. Everything runs in your browser.",
    url: "https://saleh.im/forge",
    type: "website",
  },
};

export default function ForgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
