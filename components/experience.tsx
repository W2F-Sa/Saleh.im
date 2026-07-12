import { Reveal } from "./reveal";
import { timeline } from "@/lib/data";

export function Experience() {
  return (
    <section id="work" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <span className="section-label">03 — Journey</span>
          <h2 className="heading-lg">
            The road so far{" "}
            <span className="text-[var(--fg-muted)]">— since 2022</span>
          </h2>
        </Reveal>

        <ol className="mt-12 relative border-l pl-6 sm:pl-8" style={{ borderColor: "var(--border)" }}>
          {timeline.map((item, i) => (
            <li key={item.period} className="mb-10 last:mb-0">
              <Reveal delay={i * 60}>
                <span
                  className="absolute -left-[7px] mt-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-[var(--bg)]"
                  style={{ borderColor: "var(--fg)" }}
                  aria-hidden
                />
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-sm text-emerald-500">{item.period}</span>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="max-w-2xl text-[var(--fg-muted)]">{item.description}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
