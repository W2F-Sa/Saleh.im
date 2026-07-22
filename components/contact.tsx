"use client";

import { Reveal } from "./reveal";
import { profile } from "@/lib/data";
import { useLang } from "./lang-provider";

export function Contact() {
  const { t } = useLang();

  const channels = [
    { label: t.contact.email, value: profile.email, href: `mailto:${profile.email}`, cta: t.contact.write, ext: false },
    { label: t.contact.telegram, value: `@${profile.telegram}`, href: profile.telegramUrl, cta: t.contact.message, ext: true },
    { label: t.contact.github, value: profile.handle, href: profile.github, cta: t.contact.follow, ext: true },
  ];

  return (
    <section id="contact" className="cv-section relative scroll-mt-24 py-24 sm:py-32">
      <div className="wrap">
        <Reveal>
          <div className="panel elev frame-grad relative overflow-hidden p-8 sm:p-14">
            <div className="conic-sheen" aria-hidden style={{ opacity: 0.16 }} />
            <div className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full aurora floaty" style={{ background: "var(--accent)", opacity: 0.28 }} aria-hidden />
            <div className="pointer-events-none absolute -start-16 bottom-0 h-56 w-56 rounded-full aurora floaty-slow" style={{ background: "var(--accent-2)", opacity: 0.16 }} aria-hidden />
            <span className="section-index pointer-events-none absolute end-4 top-2 select-none sm:end-8" aria-hidden>06</span>
            <div className="relative">
              <p className="label">{t.contact.eyebrow}</p>
              <h2 className="display mt-4 max-w-3xl text-5xl leading-tight sm:text-7xl">
                {t.contact.heading1}
                <br />
                <span className="display-italic gradient-text">{t.contact.heading2}</span>
              </h2>
              <p className="mt-6 max-w-xl text-lg text-[var(--fg-2)]">{t.contact.sub}</p>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {channels.map((c, i) => (
                  <a
                    key={c.label}
                    href={c.href}
                    target={c.ext ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="group relative flex flex-col gap-2 rounded-2xl border p-6 card-lift glow-border sheen shine"
                    style={{ background: "var(--bg-3)", borderColor: "var(--line)", animation: "popIn .5s cubic-bezier(.22,1,.36,1) both", animationDelay: `${i * 80}ms` }}
                  >
                    <span className="label">{c.label}</span>
                    <span className="font-display text-xl force-ltr transition-colors group-hover:text-[var(--accent)]">{c.value}</span>
                    <span className="mono mt-2 flex items-center justify-between text-sm text-[var(--fg-2)]">
                      <span className="transition-colors group-hover:text-[var(--fg)]">{c.cta}</span>
                      <span className="grid h-8 w-8 place-items-center rounded-full border transition-all duration-300 group-hover:border-transparent group-hover:bg-[var(--accent)] group-hover:text-[var(--on-accent)]" style={{ borderColor: "var(--line-2)" }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                          <path d={c.ext ? "M7 17 17 7M8 7h9v9" : "M5 12h14M13 6l6 6-6 6"} />
                        </svg>
                      </span>
                    </span>
                  </a>
                ))}
              </div>

              <div className="mt-10">
                <a href={`mailto:${profile.email}`} className="btn btn-accent text-base">
                  {t.contact.cta}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
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
