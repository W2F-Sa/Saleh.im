"use client";

import { Reveal } from "./reveal";
import { timeline, pick } from "@/lib/data";
import { useLang } from "./lang-provider";

export function Experience() {
  const { t, lang } = useLang();

  return (
    <section id="work" className="cv-section relative scroll-mt-24 py-24 sm:py-32">
      <div className="absolute inset-0 blueprint opacity-60" aria-hidden />
      <div className="wrap relative">
        <Reveal>
          <div className="flex items-end justify-between">
            <div>
              <p className="label">{t.journey.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">{t.journey.heading}</h2>
            </div>
            <span className="mono hidden text-sm text-[var(--fg-2)] sm:block">{t.journey.range}</span>
          </div>
        </Reveal>

        <div className="mt-16 space-y-0">
          {timeline.map((item, i) => (
            <Reveal key={item.period} delay={i * 70}>
              <div className="group grid gap-4 py-8 sm:grid-cols-12 sm:gap-8" style={{ borderTop: "1px solid var(--line)" }}>
                <div className="sm:col-span-3">
                  <span className="display gradient-text block text-5xl leading-none opacity-70 transition-opacity duration-300 group-hover:opacity-100 sm:text-6xl force-ltr">
                    {item.period}
                  </span>
                </div>
                <div className="sm:col-span-9 sm:ps-8" style={{ borderInlineStart: "1px solid var(--line)" }}>
                  <div className="flex items-center gap-3">
                    <span className="pulse-ring relative h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent)", boxShadow: "0 0 12px var(--glow)" }} />
                    <h3 className="font-display text-2xl transition-colors group-hover:text-[var(--accent)]">{pick(item.title, lang)}</h3>
                  </div>
                  <p className="mt-3 max-w-2xl leading-relaxed text-[var(--fg-2)]">{pick(item.description, lang)}</p>
                </div>
              </div>
            </Reveal>
          ))}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </div>
      </div>
    </section>
  );
}
