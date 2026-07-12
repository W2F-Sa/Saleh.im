import { Reveal } from "./reveal";
import { profile } from "@/lib/data";

const channels = [
  {
    label: "Email",
    value: profile.email,
    href: `mailto:${profile.email}`,
    icon: (
      <path d="M4 4h16v16H4zM4 6l8 6 8-6" />
    ),
  },
  {
    label: "Telegram",
    value: `@${profile.telegram}`,
    href: profile.telegramUrl,
    icon: <path d="m22 3-9 9M22 3l-6.5 18-4-8-8-4L22 3z" />,
  },
  {
    label: "GitHub",
    value: profile.handle,
    href: profile.github,
    icon: <path d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />,
  },
];

export function Contact() {
  return (
    <section id="contact" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <div className="card relative overflow-hidden p-8 sm:p-12">
            <div className="pointer-events-none absolute inset-0 grid-backdrop opacity-60" aria-hidden />
            <div className="relative">
              <span className="section-label">07 — Contact</span>
              <h2 className="heading-lg max-w-2xl">
                Let&apos;s build something{" "}
                <span className="text-[var(--fg-muted)]">fast and beautiful.</span>
              </h2>
              <p className="mt-4 max-w-xl text-[var(--fg-muted)]">
                Open to freelance projects and collaboration. The quickest way to reach me
                is Telegram or email — I usually reply within a day.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {channels.map((c) => (
                  <a
                    key={c.label}
                    href={c.href}
                    target={c.label !== "Email" ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--bg-soft)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border" style={{ borderColor: "var(--border)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        {c.icon}
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs uppercase tracking-widest text-[var(--fg-muted)]">
                        {c.label}
                      </span>
                      <span className="block truncate text-sm font-medium">{c.value}</span>
                    </span>
                  </a>
                ))}
              </div>

              <div className="mt-8">
                <a href={`mailto:${profile.email}`} className="btn-primary">
                  Say hello
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
