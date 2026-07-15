"use client";

import { Reveal } from "./reveal";
import { profile, pick } from "@/lib/data";
import { useLang } from "./lang-provider";

export function About() {
  const { t, lang } = useLang();

  return (
    <section id="about" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <span className="section-index pointer-events-none absolute end-2 top-10 select-none sm:end-6" aria-hidden>01</span>
      <div className="pointer-events-none absolute -end-24 top-1/4 h-72 w-72 rounded-full aurora floaty-slow" style={{ background: "var(--accent)", opacity: 0.08 }} aria-hidden />
      <div className="wrap relative">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Reveal>
              <p className="label">{t.about.eyebrow}</p>
              <div className="mt-6 panel elev sheen glow-border relative overflow-hidden p-6">
                <div className="conic-sheen" aria-hidden style={{ opacity: 0.12 }} />
                <div className="relative flex items-center gap-4">
                  <span className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl font-display text-3xl" style={{ background: "var(--accent)", color: "var(--on-accent)", boxShadow: "0 10px 30px -8px var(--glow)" }}>
                    <span className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6), transparent 60%)" }} aria-hidden />
                    <span className="relative">S</span>
                  </span>
                  <div>
                    <p className="font-display text-2xl leading-tight">{pick(profile.name, lang)}</p>
                    <p className="mono text-xs text-[var(--fg-2)] force-ltr">{profile.handle}</p>
                  </div>
                </div>
                <dl className="relative mt-6 space-y-0">
                  {[
                    [t.about.glance.role, pick(profile.role, lang)],
                    [t.about.glance.focus, t.about.glance.focusVal],
                    [t.about.glance.since, String(profile.activeSince)],
                    [t.about.glance.based, pick(profile.location, lang)],
                    [t.about.glance.status, t.about.glance.open],
                  ].map(([k, v], i) => (
                    <div key={k} className="group/row flex items-center justify-between gap-3 py-3 transition-colors" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
                      <dt className="label transition-colors group-hover/row:text-[var(--accent)]">{k}</dt>
                      <dd className="text-end text-sm font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-8 lg:ps-8">
            <Reveal delay={60}>
              <p className="display text-3xl leading-[1.15] sm:text-[2.6rem]">
                {t.about.lead1}
                <span className="accent-text">{t.about.leadAccent}</span>
                {t.about.lead2}
                <span className="display-italic">{t.about.lead3}</span>
              </p>
            </Reveal>

            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <Reveal delay={120}>
                <p className="leading-relaxed text-[var(--fg-2)]">{t.about.p1}</p>
              </Reveal>
              <Reveal delay={180}>
                <p className="leading-relaxed text-[var(--fg-2)]">{t.about.p2}</p>
              </Reveal>
            </div>

            <Reveal delay={220}>
              <div className="mt-10 flex flex-wrap items-center gap-6 border-t pt-8" style={{ borderColor: "var(--line)" }}>
                <span className="fa-quote font-display text-xl italic text-[var(--fg-2)]">— {t.about.since}</span>
                <a href={profile.github} target="_blank" rel="noopener noreferrer" className="link-sweep mono text-sm force-ltr">
                  {profile.handle} ↗
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
