import { profile } from "@/lib/data";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t py-10" style={{ borderColor: "var(--border)" }}>
      <div className="container-page flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-[var(--fg-muted)]">
          © {year} {profile.name}. Built with Next.js &amp; deployed on the edge.
        </p>
        <div className="flex items-center gap-5 text-sm text-[var(--fg-muted)]">
          <a href={`mailto:${profile.email}`} className="hover:text-[var(--fg)]">
            Email
          </a>
          <a href={profile.telegramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)]">
            Telegram
          </a>
          <a href={profile.github} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)]">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
