"use client";

import { pick, type Project } from "@/lib/data";
import { useLang } from "./lang-provider";

/* Small decorative preview per project type */
function Preview({ name, accent }: { name: string; accent: boolean }) {
  const stroke = accent ? "var(--on-accent)" : "var(--accent)";
  if (name === "Cipher")
    return (
      <div className="flex flex-col gap-2">
        {[["70%", true], ["55%", false], ["80%", true], ["45%", false]].map(([w, mine], i) => (
          <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className="h-6 rounded-full" style={{ width: w as string, background: mine ? stroke : "color-mix(in srgb, currentColor 12%, transparent)", opacity: mine ? 0.9 : 1 }} />
          </div>
        ))}
      </div>
    );
  if (name === "Lumen")
    return (
      <svg viewBox="0 0 100 60" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="scf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.4" />
            <stop offset="1" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 45 L15 38 L30 42 L45 25 L60 30 L75 14 L100 20 L100 60 L0 60 Z" fill="url(#scf)" />
        <path d="M0 45 L15 38 L30 42 L45 25 L60 30 L75 14 L100 20" fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (name === "Forge")
    return (
      <div className="grid h-full grid-cols-3 grid-rows-3 gap-2.5">
        {["{ }", "⧉", "🔗", "#", "◐", ".*", "🎫", "M↓", "⚇"].map((g, i) => (
          <div
            key={i}
            className="mono grid place-items-center rounded-xl text-sm"
            style={{
              color: stroke,
              background: "color-mix(in srgb, currentColor 8%, transparent)",
              border: `1px solid color-mix(in srgb, currentColor 16%, transparent)`,
            }}
          >
            {g}
          </div>
        ))}
      </div>
    );
  if (name === "Vault")
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2.5" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1.4" fill={stroke} />
        </svg>
        <div className="flex flex-col gap-2 self-stretch px-4">
          {["82%", "64%", "73%"].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="mono text-[9px]" style={{ color: stroke, opacity: 0.6 }}>••••</span>
              <div className="h-2 rounded-full" style={{ width: w, background: stroke, opacity: 0.55 - i * 0.12 }} />
            </div>
          ))}
        </div>
      </div>
    );
  if (name === "Vanguard")
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full">
        {/* first-person raycast corridor: converging wall lines toward a vanishing point */}
        <defs>
          <linearGradient id="vgFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={stroke} stopOpacity="0.05" />
            <stop offset="1" stopColor={stroke} stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <polygon points="0,100 100,100 62,52 38,52" fill="url(#vgFloor)" />
        <polygon points="0,0 100,0 62,48 38,48" fill={stroke} opacity="0.08" />
        {[[0, 0, 38, 48], [100, 0, 62, 48], [0, 100, 38, 52], [100, 100, 62, 52]].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth="1.2" opacity="0.5" vectorEffect="non-scaling-stroke" />
        ))}
        <rect x="38" y="48" width="24" height="4" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.6" vectorEffect="non-scaling-stroke" />
        {/* crosshair */}
        <g stroke={stroke} strokeWidth="1.4" vectorEffect="non-scaling-stroke">
          <line x1="50" y1="42" x2="50" y2="48" />
          <line x1="50" y1="58" x2="50" y2="52" />
          <line x1="42" y1="50" x2="48" y2="50" />
          <line x1="58" y1="50" x2="52" y2="50" />
        </g>
      </svg>
    );
  if (name === "Rift")
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full">
        {/* incoming enemies */}
        {[[18, 20], [82, 26], [24, 78], [80, 74], [50, 12]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0,-5 L4.5,4 L-4.5,4 Z" fill={stroke} opacity={0.55} />
          </g>
        ))}
        {/* projectiles */}
        {[[40, 40], [58, 46], [46, 60]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill={stroke} />
        ))}
        {/* core hexagon */}
        <g transform="translate(50 50)">
          <polygon points="0,-13 11,-6.5 11,6.5 0,13 -11,6.5 -11,-6.5" fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <circle cx="0" cy="0" r="4" fill={stroke} />
        </g>
      </svg>
    );
  // Probe — concentric rings
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      {[40, 28, 16].map((r, i) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="1.4" strokeOpacity={0.3 + i * 0.25} vectorEffect="non-scaling-stroke" strokeDasharray={i === 0 ? "4 4" : undefined} />
      ))}
      <circle cx="50" cy="50" r="4" fill={stroke} />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function Showcase({ items }: { items: Project[] }) {
  const { lang, t } = useLang();
  return (
    <div className="mt-12 space-y-5">
      {items.map((p, i) => {
        const accent = !!p.accent;
        return (
          <div key={p.name} className="sticky" style={{ top: `calc(5.5rem + ${i * 1.5}rem)` }}>
            <a
              href={p.href}
              target={p.internal ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="group elev glow-border shine relative grid overflow-hidden rounded-[1.75rem] p-7 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:gap-8"
              style={{
                background: accent ? "var(--accent)" : "var(--bg-2)",
                color: accent ? "var(--on-accent)" : "var(--fg)",
                border: "1px solid var(--line)",
                minHeight: "22rem",
              }}
            >
              <div className="flex flex-col justify-between gap-6">
                <div className="flex items-center justify-between">
                  <span className="mono text-sm" style={{ opacity: 0.6 }}>{String(i + 1).padStart(2, "0")} — {t.projects.live}</span>
                  <Arrow />
                </div>
                <div>
                  <h3 className="display text-4xl sm:text-5xl">{pick(p.title, lang)}</h3>
                  <p className="mt-4 max-w-md leading-relaxed" style={{ opacity: 0.82 }}>{pick(p.description, lang)}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {p.tags.map((tag) => (
                      <span key={tag} className="rounded-full px-3 py-1 mono text-[11px] force-ltr" style={{ border: `1px solid ${accent ? "rgba(0,0,0,0.22)" : "var(--line-2)"}` }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              {/* preview panel */}
              <div className="mt-8 hidden overflow-hidden rounded-2xl lg:mt-0 lg:block" style={{ background: accent ? "rgba(0,0,0,0.08)" : "var(--bg-3)", border: `1px solid ${accent ? "rgba(0,0,0,0.15)" : "var(--line)"}` }}>
                <div className="flex items-center gap-1.5 border-b px-3 py-2" style={{ borderColor: accent ? "rgba(0,0,0,0.12)" : "var(--line)" }}>
                  {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />)}
                  <span className="mono ms-2 text-[10px] force-ltr" style={{ opacity: 0.55 }}>saleh.im/{p.href.split("/").filter(Boolean).pop()}</span>
                </div>
                <div className="grid h-[15rem] place-items-stretch p-6">
                  <Preview name={p.name} accent={accent} />
                </div>
              </div>
            </a>
          </div>
        );
      })}
    </div>
  );
}
