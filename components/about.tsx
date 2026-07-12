import { Reveal } from "./reveal";
import { profile, skills } from "@/lib/data";

const marqueeItems = skills.flatMap((g) => g.items);

export function About() {
  return (
    <section id="about" className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <span className="section-label">01 — About</span>
          <h2 className="heading-lg max-w-3xl">
            A teenage engineer obsessed with{" "}
            <span className="text-[var(--fg-muted)]">
              performance, networks and clean systems.
            </span>
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Reveal delay={80}>
            <div className="space-y-5 text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">
              <p>
                I&apos;m <span className="text-[var(--fg)]">Saleh Saghafiani</span> — a{" "}
                {profile.age}-year-old self-taught software and network engineer from{" "}
                {profile.location}. I&apos;ve been shipping open-source code on GitHub since{" "}
                <span className="text-[var(--fg)]">{profile.activeSince}</span>.
              </p>
              <p>
                My playground is the network edge: Cloudflare Workers, serverless runtimes,
                tunneling and proxy infrastructure. I love turning low-level networking
                problems into fast, reliable products — and wrapping them in interfaces
                that feel effortless.
              </p>
              <p>
                From native Android apps in Kotlin to TypeScript dashboards and encrypted
                peer-to-peer messengers, I build across the whole stack and care deeply
                about the details: speed, resilience and craft.
              </p>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="card p-6">
              <h3 className="font-mono text-sm uppercase tracking-widest text-[var(--fg-muted)]">
                At a glance
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  ["Role", profile.role],
                  ["Focus", "Edge · Networking · Full-stack"],
                  ["Experience", `Active since ${profile.activeSince}`],
                  ["Location", profile.location],
                  ["Open to", "Freelance & collaboration"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: "var(--border)" }}>
                    <span className="text-[var(--fg-muted)]">{k}</span>
                    <span className="text-right font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Tech marquee */}
      <div className="marquee-mask mt-16 overflow-hidden py-2">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, idx) => (
            <span
              key={idx}
              className="mx-3 whitespace-nowrap font-mono text-2xl font-semibold text-[var(--fg-muted)] opacity-50 sm:text-3xl"
            >
              {item} <span className="mx-3 opacity-40">/</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
