import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aperture — collaborative canvas",
  description:
    "Aperture is a real-time collaborative whiteboard by Saleh — a pen, shapes, arrows, sticky notes and text with select/move, undo/redo and PNG export, plus live collaborator cursors. Draw, think and sketch together in the browser.",
  keywords: ["whiteboard", "collaborative canvas", "drawing", "sticky notes", "diagram", "WebRTC", "CRDT", "Saleh"],
  alternates: { canonical: "https://saleh.im/aperture" },
  openGraph: {
    title: "Aperture — collaborative canvas",
    description: "A real-time whiteboard: pen, shapes, sticky notes and text with undo/redo, PNG export and live cursors.",
    url: "https://saleh.im/aperture",
    type: "website",
  },
};

export default function ApertureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
