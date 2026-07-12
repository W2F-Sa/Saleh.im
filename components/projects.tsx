import { Reveal } from "./reveal";
import { projects, type Project } from "@/lib/data";

function ArrowIcon({ external }: { external?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
    >
      {external ? <path d="M7 17 17 7M8 7h9v9" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  );
}

function ProjectCard({ p, featured }: { p: Project; featured?: boolean }) {
  const external = !p.internal;
  return (
    <a
      href={p.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`card group relative flex flex-col overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1 ${
        featured ? "sm:p-7" : ""
      }`}
    >
      {p.internal && (
        <span className="absolute right-5 top-5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500">
          Live demo
        </span>
      )}
      <div className="flex items-center gap-2 font-mono text-xs text-[var(--fg-muted)]">
        <span>{p.year}</span>
      </div>
      <h3 className="mt-3 flex items-center gap-2 text-xl font-semibold">
        {p.title}
        <ArrowIcon external={external} />
      </h3>
      <p className="mt-2 flex-1 text-[var(--fg-muted)]">{p.description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {p.tags.map((t) => (
          <span
            key={t}
            className="rounded-md border px-2 py-1 font-mono text-[11px] text-[var(--fg-muted)]"
            style={{ borderColor: "var(--border)" }}
          >
            {t}
          </span>
        ))}
      </div>
    </a>
  );
}

export function Projects() {
  const featured = projects.filter((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);

  return (
    <section id="projects" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="section-label">04 — Projects</span>
              <h2 className="heading-lg">Selected work</h2>
            </div>
            <a
              href="https://github.com/W2F-Sa?tab=repositories"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              All repositories
              <ArrowIcon external />
            </a>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {featured.map((p, i) => (
            <Reveal key={p.name} delay={i * 60}>
              <ProjectCard p={p} featured />
            </Reveal>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {rest.map((p, i) => (
            <Reveal key={p.name} delay={i * 60}>
              <ProjectCard p={p} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
