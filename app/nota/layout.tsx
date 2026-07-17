import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nota — offline-first knowledge base",
  description:
    "Nota is an offline-first, markdown-native notes app by Saleh — instant full-text search, [[wiki links]] with automatic backlinks, tags and a live preview. Everything is stored locally in your browser.",
  keywords: ["notes app", "markdown", "knowledge base", "offline-first", "wiki links", "backlinks", "zettelkasten", "Saleh"],
  alternates: { canonical: "https://saleh.im/nota" },
  openGraph: {
    title: "Nota — offline-first knowledge base",
    description: "Markdown notes with wiki links, backlinks, tags and instant search — stored locally in your browser.",
    url: "https://saleh.im/nota",
    type: "website",
  },
};

export default function NotaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
