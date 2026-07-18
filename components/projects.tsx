"use client";

import { Reveal } from "./reveal";
import { projects, pick, profile, type Project } from "@/lib/data";
import { useLang } from "./lang-provider";
import { Showcase } from "./showcase";

function Arrow({ external }: { external?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
      {external ? <path d="M7 17 17 7M8 7h9v9" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}

function ListRow({ p, i }: { p: Project; i: number }) {
  const { t, lang } = useLang();
  const external = !p.internal;
  return (
    <a
      href={p.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group grid items-center gap-4 py-6 sm:grid-cols-12"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <span className="mono text-sm text-[var(--fg-2)] sm:col-span-1">
        {lang === "fa" ? (i + 1).toLocaleString("fa-IR") : String(i + 1).padStart(2, "0")}
      </span>
      <div className="sm:col-span-4">
        <h3 className="font-display text-2xl transition-colors group-hover:text-[var(--accent)]">{pick(p.title, lang)}</h3>
        <span className="mono text-xs text-[var(--fg-2)] force-ltr">{p.year}</span>
      </div>
      <p className="text-[var(--fg-2)] sm:col-span-5">{pick(p.description, lang)}</p>
      <div className="flex items-center justify-between sm:col-span-2 sm:justify-end">
        <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
          {p.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="chip force-ltr">{tag}</span>
          ))}
        </div>
        <span className="ms-3 opacity-60 transition-all group-hover:opacity-100">
          <Arrow external={external} />
        </span>
      </div>
    </a>
  );
}

export function Projects() {
  const { t } = useLang();
  const featured = projects.filter((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);

  return (
    <section id="projects" className="cv-section relative scroll-mt-24 py-24 sm:py-32">
      <div className="wrap">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">{t.projects.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                {t.projects.heading1} <span className="display-italic gradient-text">{t.projects.heading2}</span>
              </h2>
            </div>
            <a href={profile.github} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              {t.projects.all} ↗
            </a>
          </div>
        </Reveal>

        <Showcase items={featured} />

        <div className="mt-16">
          {rest.map((p, i) => (
            <Reveal key={p.name} delay={i * 50}>
              <ListRow p={p} i={i} />
            </Reveal>
          ))}
          <div style={{ borderTop: "1px solid var(--line)" }} />
        </div>
      </div>
    </section>
  );
}
