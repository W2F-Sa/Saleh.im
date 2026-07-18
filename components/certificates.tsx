"use client";

import { Reveal } from "./reveal";
import { certificates, pick } from "@/lib/data";
import { useLang } from "./lang-provider";

export function Certificates() {
  const { t, lang } = useLang();

  return (
    <section id="certificates" className="cv-section relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <span className="section-index pointer-events-none absolute start-2 top-10 select-none sm:start-6" aria-hidden>04</span>
      <div className="absolute inset-0 blueprint opacity-40" aria-hidden />
      <div className="pointer-events-none absolute -start-24 top-1/4 h-72 w-72 rounded-full aurora floaty-slow" style={{ background: "var(--accent)", opacity: 0.07 }} aria-hidden />

      <div className="wrap relative">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label">{t.certs.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                {t.certs.heading1}
                <br />
                <span className="display-italic gradient-text">{t.certs.heading2}</span>
              </h2>
            </div>
            <p className="max-w-xs text-[var(--fg-2)]">{t.certs.sub}</p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((c, i) => (
            <Reveal key={c.title.en} delay={(i % 3) * 80} variant="scale">
              <article className="cert-card card-lift sheen glow-border group relative flex h-full flex-col overflow-hidden p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="cert-mark h-12 w-12 shrink-0 font-display text-2xl"
                    style={c.accent ? { color: "var(--accent)" } : undefined}
                  >
                    {c.mark}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium cert-verified">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {t.certs.verified}
                  </span>
                </div>

                <h3 className="mt-5 font-display text-xl leading-snug transition-colors group-hover:text-[var(--accent)]">
                  {pick(c.title, lang)}
                </h3>

                <div className="mt-2 flex items-center gap-2 text-sm text-[var(--fg-2)]">
                  <span className="font-medium">{c.issuer}</span>
                  <span aria-hidden>·</span>
                  <span className="mono force-ltr">{c.date}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.skills.map((s) => (
                    <span key={s} className="chip force-ltr text-[11px]">{s}</span>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--line)" }}>
                  <span className="label text-[10px]">{t.certs.issued} · {c.issuer}</span>
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-sweep inline-flex items-center gap-1.5 text-sm font-medium"
                      style={{ color: "var(--accent)" }}
                    >
                      {t.certs.verify}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17 17 7M8 7h9v9" />
                      </svg>
                    </a>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
