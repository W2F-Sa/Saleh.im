"use client";

import { useEffect, useRef, useState } from "react";
import { profile, marqueeTags, BASE_PATH } from "@/lib/data";
import { useLang } from "./lang-provider";

/* ---- tiny, elegant IP / location chip ---- */
function ConnectionChip() {
  const { lang } = useLang();
  const [info, setInfo] = useState<{ ip?: string; city?: string; cc?: string; country?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let d: any = null;
        try {
          const r = await fetch(`${BASE_PATH}/api/ip`, { cache: "no-store" });
          if (r.ok) d = await r.json();
        } catch {}
        if (!d || !d.ip) {
          const r = await fetch("https://ipwho.is/", { cache: "no-store" });
          const j = await r.json();
          d = { ip: j.ip, city: j.city, countryCode: j.country_code, country: j.country };
        }
        if (alive)
          setInfo({ ip: d.ip, city: d.city, cc: d.countryCode || d.country, country: d.country });
      } catch {
        if (alive) setInfo({ ip: "—" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const flag = info?.cc
    ? String.fromCodePoint(
        ...info.cc.toUpperCase().slice(0, 2).split("").map((c) => 127397 + c.charCodeAt(0))
      )
    : "";
  const place = info?.city ? `${info.city}${info.cc ? " · " + info.cc : ""}` : info?.country || "";

  return (
    <div
      className="force-ltr group inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5"
      style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}
      title="Live edge lookup via /api/ip"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--accent)" }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
      </span>
      <span className="mono text-[11px] tracking-wide text-[var(--fg-2)]">
        {info ? (
          <>
            <span className="text-[var(--fg)]">{info.ip}</span>
            {place && <span className="mx-1 opacity-50">·</span>}
            {place && <span>{flag} {place}</span>}
          </>
        ) : (
          <span className="opacity-70">{lang === "fa" ? "در حال دریافت…" : "resolving…"}</span>
        )}
      </span>
      <span className="mono hidden text-[9px] uppercase tracking-widest text-[var(--fg-2)] opacity-50 sm:inline">
        /api/ip
      </span>
    </div>
  );
}

/* A single seamless marquee row that never stops. The base sequence is
   repeated enough times that one half always exceeds the viewport, so the
   -50% loop never exposes a gap on wide screens — the row simply re-enters
   from the opposite edge in one continuous, unbroken motion. */
function MarqueeRow({ duration = 48 }: { duration?: number }) {
  const base = [...marqueeTags, ...marqueeTags, ...marqueeTags];
  const track = [...base, ...base];
  return (
    <div className="marquee marquee-hero" style={{ animationDuration: `${duration}s` }} aria-hidden>
      {track.map((m, i) => (
        <span key={i} className="mq-item font-display text-2xl sm:text-3xl">
          <span className="mq-word">{m}</span>
          <span className="mq-star">✦</span>
        </span>
      ))}
    </div>
  );
}

export function Hero() {
  const { t, lang } = useLang();
  const [idx, setIdx] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const rotating = t.hero.rotating;

  useEffect(() => {
    const id = setInterval(() => setIdx((v) => (v + 1) % rotating.length), 2600);
    return () => clearInterval(id);
  }, [rotating.length]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 24;
        const y = (e.clientY / window.innerHeight - 0.5) * 24;
        el.style.setProperty("--tx", `${x}px`);
        el.style.setProperty("--ty", `${y}px`);
        raf = 0;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const years = new Date().getFullYear() - profile.activeSince;
  const isFa = lang === "fa";

  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32">
      <div ref={stageRef} className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 dotfield" />
        <div className="aurora left-[8%] top-[14%] h-72 w-72" style={{ background: "var(--accent)", transform: "translate3d(var(--tx,0),var(--ty,0),0)" }} />
        <div className="aurora right-[6%] top-[30%] h-64 w-64" style={{ background: "var(--accent-2)", opacity: 0.28, animationDelay: "-6s" }} />
        <div className="aurora left-[40%] top-[54%] h-52 w-52" style={{ background: "var(--accent)", opacity: 0.16, animationDelay: "-11s" }} />
      </div>

      <div className="wrap relative">
        {/* status strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-4" style={{ borderColor: "var(--line)" }}>
          <span className="tag-dot text-sm text-[var(--fg-2)]">{t.hero.available}</span>
          <ConnectionChip />
          <span className="mono ms-auto hidden text-xs text-[var(--fg-2)] sm:block">
            {t.hero.est} · {profile.handle}
          </span>
        </div>

        {/* headline */}
        <div className="grid gap-8 pt-10 lg:grid-cols-12 lg:gap-6 lg:pt-16">
          <div className="lg:col-span-8">
            <h1 className="display text-[15vw] leading-[0.85] sm:text-8xl lg:text-[8.2rem]">
              {isFa ? (
                <>
                  <span className="fa-accent block">صالح</span>
                  <span className="fa-accent gradient-text block">ثقفیانی</span>
                </>
              ) : (
                <>
                  <span className="block">Saleh</span>
                  <span className="block">
                    <span className="stroke-text">Sagha</span>
                    <span className="display-italic gradient-text inline-block pe-[0.16em]">fiani</span>
                  </span>
                </>
              )}
            </h1>

            <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl sm:text-3xl">
              <span className="font-display">{t.hero.build}</span>
              <span className="relative inline-block">
                <span key={idx} className="accent-text font-display animate-[fadeUp_.5s_ease]">
                  {rotating[idx]}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-end gap-6 lg:col-span-4">
            <p className="max-w-sm text-[var(--fg-2)] sm:text-lg">{t.hero.bio}</p>
            <div className="flex flex-wrap gap-3">
              <a href="#projects" className="btn btn-accent halo">
                {t.hero.seeWork}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </a>
              <a href="#contact" className="btn btn-outline">{t.hero.sayHello}</a>
            </div>
          </div>
        </div>

        {/* stat rail */}
        <div className="stagger mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-4" style={{ borderColor: "var(--line)", background: "var(--line)" }}>
          {[
            { v: `${years}+`, k: t.hero.stats.years },
            { v: "24+", k: t.hero.stats.repos },
            { v: "6", k: t.hero.stats.langs },
            { v: "∞", k: t.hero.stats.curiosity },
          ].map((s) => (
            <div key={s.k} className="group relative overflow-hidden bg-[var(--bg)] p-5 transition-colors duration-300 hover:bg-[var(--bg-2)]">
              <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} aria-hidden />
              <div className="count font-display text-4xl font-semibold transition-transform duration-300 group-hover:-translate-y-0.5 sm:text-5xl">{s.v}</div>
              <div className="label mt-2 transition-colors group-hover:text-[var(--accent)]">{s.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* marquee — one continuous, never-stopping line */}
      <div className="edge-fade relative mt-16 border-y py-5" style={{ borderColor: "var(--line)" }}>
        <MarqueeRow duration={48} />
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </section>
  );
}
