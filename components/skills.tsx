import { Reveal } from "./reveal";
import { skills } from "@/lib/data";

export function Skills() {
  return (
    <section id="skills" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <span className="section-label">02 — Skills</span>
          <h2 className="heading-lg">Tools I build with</h2>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {skills.map((group, i) => (
            <Reveal key={group.label} delay={i * 70}>
              <div className="card group h-full p-6 transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{group.label}</h3>
                  <span className="font-mono text-xs text-[var(--fg-muted)]">
                    0{i + 1}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border px-3 py-1.5 text-sm text-[var(--fg-muted)] transition-colors group-hover:text-[var(--fg)]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
