"use client";

import { useState } from "react";
import { Reveal } from "./reveal";
import { domains, pick } from "@/lib/data";
import { useLang } from "./lang-provider";

export function Skills() {
  const { t, lang } = useLang();
  const [activeDomain, setActiveDomain] = useState(0);
  const [openSkill, setOpenSkill] = useState<string>(domains[0].skills[0].name.en);

  const domain = domains[activeDomain];
  const faDigit = (n: number) =>
    lang === "fa" ? n.toLocaleString("fa-IR") : String(n);

  return (
    <section id="skills" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <span className="section-index pointer-events-none absolute end-2 top-10 select-none sm:end-6" aria-hidden>02</span>
      <div className="pointer-events-none absolute -start-24 top-1/3 h-72 w-72 rounded-full aurora floaty-slow" style={{ background: "var(--accent)", opacity: 0.08 }} aria-hidden />
      <div className="wrap relative">
        <Reveal>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label">{t.skills.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                {t.skills.heading1}
                <br />
                <span className="display-italic accent-text">{t.skills.heading2}</span>
              </h2>
            </div>
            <p className="max-w-xs text-[var(--fg-2)]">{t.skills.sub}</p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-12 flex flex-wrap gap-2">
            {domains.map((d, i) => (
              <button
                key={d.key}
                onClick={() => {
                  setActiveDomain(i);
                  setOpenSkill(d.skills[0].name.en);
                }}
                className="rounded-full border px-4 py-2 text-sm transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  borderColor: i === activeDomain ? "transparent" : "var(--line-2)",
                  background: i === activeDomain ? "var(--accent)" : "transparent",
                  color: i === activeDomain ? "var(--on-accent)" : "var(--fg)",
                  boxShadow: i === activeDomain ? "0 10px 26px -8px var(--glow)" : "none",
                }}
              >
                {pick(d.title, lang)}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <p className="fa-quote mt-6 max-w-xl font-display text-xl italic text-[var(--fg-2)]">
            “{pick(domain.tagline, lang)}”
          </p>
        </Reveal>

        <div className="mt-8 grid gap-3">
          {domain.skills.map((s, i) => {
            const open = openSkill === s.name.en;
            return (
              <Reveal key={s.name.en} delay={i * 60}>
                <div className={`panel sheen glow-border relative overflow-hidden ${open ? "elev" : "lift"}`} style={{ borderColor: open ? "var(--line-2)" : "var(--line)" }}>
                  <span className="absolute inset-y-3 start-0 w-[3px] rounded-full transition-transform duration-500" style={{ background: "var(--accent)", transform: open ? "scaleY(1)" : "scaleY(0)", transformOrigin: "center", boxShadow: "0 0 12px var(--glow)" }} aria-hidden />
                  <button onClick={() => setOpenSkill(open ? "" : s.name.en)} className="flex w-full items-center gap-4 p-5 text-start sm:p-6">
                    <span className="mono text-xs text-[var(--fg-2)]">{faDigit(i + 1).padStart(2, lang === "fa" ? "۰" : "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-display text-2xl sm:text-3xl">{pick(s.name, lang)}</span>
                        <span className="mono text-xs text-[var(--fg-2)]">{pick(s.years, lang)}</span>
                      </span>
                      {!open && <span className="mt-1 block text-sm text-[var(--fg-2)]">{pick(s.summary, lang)}</span>}
                    </span>
                    <span className="hidden items-center gap-2 sm:flex force-ltr">
                      <span className="mono text-sm" style={{ color: "var(--accent)" }}>{s.level}</span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                        <span className="block h-full rounded-full transition-all duration-700" style={{ width: open ? `${s.level}%` : "0%", background: "var(--accent)" }} />
                      </span>
                    </span>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-transform duration-300" style={{ borderColor: "var(--line-2)", transform: open ? "rotate(45deg)" : "none" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                    </span>
                  </button>

                  <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <div className="border-t px-5 pb-6 pt-5 sm:px-6" style={{ borderColor: "var(--line)" }}>
                        <p className="max-w-2xl leading-relaxed text-[var(--fg-2)]">{pick(s.detail, lang)}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {s.tags.map((tag) => (
                            <span key={tag} className="chip force-ltr">{tag}</span>
                          ))}
                        </div>
                        <div className="mt-4 flex items-center gap-3 sm:hidden force-ltr">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                            <span className="block h-full rounded-full" style={{ width: `${s.level}%`, background: "var(--accent)" }} />
                          </span>
                          <span className="mono text-sm" style={{ color: "var(--accent)" }}>{s.level}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
