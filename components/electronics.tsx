"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";
import { electronics, pick } from "@/lib/data";
import { useLang } from "./lang-provider";

/* Tiny inline glyphs for each hardware skill. */
function SkillIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "pcb":
      return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.3" /><circle cx="16" cy="16" r="1.3" /><path d="M8 9.3V13h4M16 14.7V11h-4" /></svg>);
    case "chip":
      return (<svg {...common}><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v2M14 3v2M10 19v2M14 19v2M3 10h2M3 14h2M19 10h2M19 14h2" /></svg>);
    case "iron":
      return (<svg {...common}><path d="M3 21c3-1 5-3 6-5" /><path d="M9 16l6-9a2.5 2.5 0 0 1 4 3l-9 6z" /><path d="M13 6l3 3" /></svg>);
    default: // circuit
      return (<svg {...common}><circle cx="5" cy="12" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 12h6M13 12l4-5M13 12l4 5" /></svg>);
  }
}

export function Electronics() {
  const { t, lang } = useLang();
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const nextPose = useRef<{ rx: number; ry: number } | null>(null);
  const [paused, setPaused] = useState(false);

  const faDigit = (n: number | string) =>
    lang === "fa" ? String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]) : String(n);

  /* Pause the board's animation whenever it scrolls out of view (perf). */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setPaused(!e.isIntersecting),
      { rootMargin: "120px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const reduced = () =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const applyPose = () => {
    rafRef.current = 0;
    const p = nextPose.current;
    const b = boardRef.current;
    if (!p || !b) return;
    b.style.setProperty("--rx", `${p.rx.toFixed(2)}deg`);
    b.style.setProperty("--ry", `${p.ry.toFixed(2)}deg`);
  };

  const onMove = (e: React.PointerEvent) => {
    if (reduced()) return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    // gentle, pleasing range; keeps a slight resting tilt
    nextPose.current = {
      rx: (0.5 - py) * 24 + 9,
      ry: (px - 0.5) * 36 - 6,
    };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(applyPose);
  };

  const onEnter = () => boardRef.current?.classList.add("dragging");
  const onLeave = () => {
    const b = boardRef.current;
    if (!b) return;
    b.classList.remove("dragging");
    b.style.removeProperty("--rx");
    b.style.removeProperty("--ry");
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <section id="electronics" className="cv-section relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <span className="section-index pointer-events-none absolute end-2 top-10 select-none sm:end-6" aria-hidden>03</span>
      <div className="pointer-events-none absolute -end-24 top-1/3 h-72 w-72 rounded-full aurora floaty-slow" style={{ background: "var(--accent-2)", opacity: 0.08 }} aria-hidden />
      <div className="wrap relative">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* ---- Left: copy + honest skill meters ---- */}
          <div>
            <Reveal>
              <p className="label">{t.electronics.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                {t.electronics.heading1}
                <br />
                <span className="display-italic gradient-text">{t.electronics.heading2}</span>
              </h2>
              <p className="mt-6 max-w-md leading-relaxed text-[var(--fg-2)]">{t.electronics.sub}</p>
              <p className="fa-quote mt-4 max-w-md text-sm italic text-[var(--fg-2)]">{pick(electronics.note, lang)}</p>
            </Reveal>

            <div className="mt-10 grid gap-4">
              {electronics.skills.map((s, i) => (
                <Reveal key={s.name.en} delay={i * 70}>
                  <div className="card-lift sheen glow-border group relative overflow-hidden p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors group-hover:text-[var(--accent)]" style={{ borderColor: "var(--line-2)", color: "var(--fg-2)", background: "var(--bg-3)" }}>
                        <SkillIcon name={s.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-display text-lg leading-tight">{pick(s.name, lang)}</span>
                          <span className="mono text-xs force-ltr" style={{ color: "var(--accent)" }}>{faDigit(s.level)}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                          <MeterBar level={s.level} />
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--fg-2)]">{pick(s.blurb, lang)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* ---- Right: the live 3D board ---- */}
          <Reveal variant="scale" delay={80}>
            <div className="relative">
              <div
                ref={stageRef}
                className="pcb-stage select-none"
                onPointerMove={onMove}
                onPointerEnter={onEnter}
                onPointerLeave={onLeave}
                style={{ touchAction: "pan-y" }}
              >
                <div ref={boardRef} className={`pcb-board ${paused ? "pcb-paused" : ""}`} role="img" aria-label="Interactive 3D printed circuit board">
                  {/* copper traces + flowing current */}
                  <svg className="pcb-traces" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden>
                    {TRACES.map((d, i) => (
                      <path key={`t${i}`} className="pcb-trace" d={d} />
                    ))}
                    {TRACES.map((d, i) => (
                      <path key={`f${i}`} className="pcb-flow" d={d} style={{ animationDelay: `${(i * 0.42).toFixed(2)}s`, animationDuration: `${2.4 + (i % 3) * 0.5}s` }} />
                    ))}
                  </svg>

                  {/* parts on real depth layers */}
                  <div className="pcb-part pcb-chip" style={{ left: "37%", top: "39%", width: "26%", height: "27%" }}>MCU</div>
                  <span className="pcb-label" style={{ left: "37%", top: "34%" }}>U1 · ESP32</span>

                  <div className="pcb-part pcb-elec" style={{ left: "9%", top: "13%", width: "13%", aspectRatio: "1" }} />
                  <span className="pcb-label" style={{ left: "9%", top: "31%" }}>C1</span>

                  <div className="pcb-part pcb-led" style={{ left: "80%", top: "12%", width: "5%", aspectRatio: "1" }} />
                  <span className="pcb-label" style={{ left: "74%", top: "20%" }}>D1</span>

                  <div className="pcb-part pcb-cap" style={{ left: "68%", top: "60%", width: "10%", height: "6%", background: "linear-gradient(#3b4550,#20272e)" }} />

                  <div className="pcb-part pcb-res" style={{ left: "62%", top: "44%", width: "13%", height: "5.5%" }}>
                    <i style={{ background: "#8a5a2b" }} /><i style={{ background: "#111" }} /><i style={{ background: "#c22" }} /><i style={{ background: "#d4af37" }} />
                  </div>

                  <div className="pcb-part pcb-header" style={{ left: "30%", top: "84%", width: "40%", height: "9%" }}>
                    {Array.from({ length: 8 }).map((_, i) => <i key={i} />)}
                  </div>
                  <span className="pcb-label" style={{ left: "30%", top: "79%" }}>J1 · GPIO</span>

                  {/* gold pads */}
                  {PADS.map((p, i) => (
                    <div key={i} className="pcb-part pcb-pad" style={{ left: p[0], top: p[1], width: "2.4%", aspectRatio: "1" }} />
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between px-1">
                <span className="mono text-[11px] text-[var(--fg-2)]">{t.electronics.hint}</span>
                <span className="chip force-ltr text-[10px]">{t.electronics.poweredBy}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* Bar that fills once revealed into view. */
function MeterBar({ level }: { level: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span
      ref={ref}
      className="block h-full rounded-full"
      style={{
        width: on ? `${level}%` : "0%",
        background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
        boxShadow: "0 0 10px var(--glow)",
        transition: "width 1.1s cubic-bezier(0.22,1,0.36,1)",
      }}
    />
  );
}

/* Hand-routed copper traces (viewBox 400×300). */
const TRACES = [
  "M244 150 H300 V60 H312",
  "M196 192 V250",
  "M148 158 H92 V70 H70",
  "M214 114 V92 H300 V96",
  "M244 168 H288",
  "M180 192 V235 H150",
  "M256 178 V250",
  "M148 140 H120 V120",
];

/* Gold solder-pad coordinates (as % of the board). */
const PADS: [string, string][] = [
  ["30%", "22%"],
  ["74%", "78%"],
  ["18%", "68%"],
  ["86%", "44%"],
  ["50%", "14%"],
];
