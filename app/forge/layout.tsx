import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forge — developer toolbox",
  description:
    "Forge is a fast, private developer toolbox by Saleh with 70+ tools — JSON/CSV/TypeScript, Base64/Base58/URL/HTML/JWT, AES encryption, hashing, UUID/ULID/password/mock-data generators, a colour studio, regex tester, cron explainer, diff, markdown, unit/base/number converters, CSS gradient/shadow/bezier generators, HTTP status reference and more. Everything runs in your browser.",
  keywords: [
    "developer tools",
    "json formatter",
    "base64",
    "jwt decoder",
    "regex tester",
    "hash generator",
    "uuid generator",
    "color contrast",
    "cron",
    "diff",
    "Saleh",
  ],
  alternates: { canonical: "https://saleh.im/forge" },
  openGraph: {
    title: "Forge — developer toolbox",
    description: "70+ fast, private developer tools in one place. Everything runs in your browser.",
    url: "https://saleh.im/forge",
    type: "website",
  },
};

export default function ForgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
