"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemePicker } from "@/components/theme-picker";
import { RiftGame, UPGRADES, type GameState, type Hud } from "@/lib/rift/engine";

const INITIAL_HUD: Hud = {
  state: "menu", wave: 0, sector: 1, gold: 0, score: 0, hp: 100, hpMax: 100,
  coreHp: 400, coreHpMax: 400, enemiesAlive: 0, waveProgress: 0, level: 1, kills: 0, banner: "",
};

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      {label && <div className="mb-1 flex items-center justify-between text-[10px] tracking-widest text-[var(--fg-2)]"><span>{label}</span><span className="mono">{Math.ceil(value)}/{max}</span></div>}
      <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
        <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
    </div>
  );
}

export default function RiftPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RiftGame | null>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [gs, setGs] = useState<GameState>("menu");
  const [, force] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new RiftGame(canvas, { onHud: setHud, onState: setGs });
    gameRef.current = g;
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(canvas);
    const onResize = () => g.resize();
    window.addEventListener("resize", onResize);
    return () => { ro.disconnect(); window.removeEventListener("resize", onResize); g.destroy(); gameRef.current = null; };
  }, []);

  const g = () => gameRef.current;
  const playing = gs === "playing" || gs === "paused" || gs === "shop";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden select-none" style={{ background: "var(--bg)" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {/* top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/" className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--fg-2)] hover:text-[var(--fg)]" style={{ border: "1px solid var(--line)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            saleh.im
          </Link>
          <span className="glass rounded-full px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--line)" }}>◈ Rift</span>
        </div>
        {playing && (
          <div className="pointer-events-none flex items-center gap-2 text-xs">
            <span className="glass rounded-full px-3 py-1.5 mono" style={{ border: "1px solid var(--line)" }}>Sector {hud.sector} · Wave {hud.wave}/6</span>
            <span className="glass rounded-full px-3 py-1.5 mono" style={{ border: "1px solid var(--line)", color: "var(--accent)" }}>◆ {hud.gold}</span>
            <span className="glass hidden rounded-full px-3 py-1.5 mono sm:block" style={{ border: "1px solid var(--line)" }}>Lv {hud.level}</span>
          </div>
        )}
        <div className="pointer-events-auto flex items-center gap-2">
          {gs === "playing" && <button onClick={() => g()?.togglePause()} className="glass grid h-9 w-9 place-items-center rounded-full" style={{ border: "1px solid var(--line)" }} aria-label="Pause"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg></button>}
          <ThemePicker />
        </div>
      </header>

      {/* bottom HUD bars */}
      {playing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 p-3 sm:p-5">
          <div className="w-40 sm:w-56"><Bar value={hud.hp} max={hud.hpMax} color="var(--accent-2)" label="HULL" /></div>
          <div className="hidden flex-1 px-8 sm:block">
            <div className="mb-1 text-center text-[10px] tracking-widest text-[var(--fg-2)]">WAVE PROGRESS</div>
            <div className="mx-auto h-1.5 max-w-md overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
              <div className="h-full rounded-full" style={{ width: `${hud.waveProgress * 100}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-2))", transition: "width .3s" }} />
            </div>
          </div>
          <div className="w-40 text-right sm:w-56"><Bar value={hud.coreHp} max={hud.coreHpMax} color="var(--accent)" label="CORE" /></div>
        </div>
      )}

      {/* center banner */}
      {hud.banner && playing && (
        <div className="pointer-events-none absolute inset-x-0 top-[22%] z-20 text-center">
          <span key={hud.banner} className="gradient-text font-display text-4xl font-bold sm:text-6xl" style={{ animation: "riftBanner 2.2s ease forwards" }}>{hud.banner}</span>
        </div>
      )}

      {/* ---- MENU ---- */}
      {gs === "menu" && (
        <div className="absolute inset-0 z-30 grid place-items-center p-5">
          <div className="panel elev sheen glow-border w-full max-w-lg p-8 text-center" style={{ animation: "tabIn .5s ease" }}>
            <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl text-4xl" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)", boxShadow: "0 14px 40px -10px var(--glow)" }}>◈</div>
            <h1 className="display gradient-text text-5xl sm:text-6xl">Rift</h1>
            <p className="mt-3 text-[var(--fg-2)]">A neon arena survival. Defend the <b style={{ color: "var(--accent)" }}>Core</b>, auto-blast waves of intruders, spend salvage on upgrades and deploy sentries across five sectors — each ending in a boss.</p>
            <div className="mt-6 grid grid-cols-2 gap-2 text-left text-sm text-[var(--fg-2)]">
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><b className="text-[var(--fg)]">Move</b><br />WASD / arrows — or drag</div>
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><b className="text-[var(--fg)]">Fire</b><br />Automatic — aim by moving</div>
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><b className="text-[var(--fg)]">Salvage ◆</b><br />Collect to buy upgrades</div>
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}><b className="text-[var(--fg)]">Pause</b><br />P key or the ⏸ button</div>
            </div>
            <button onClick={() => g()?.start()} className="btn btn-accent halo mt-7 w-full text-base">Launch ◈</button>
          </div>
        </div>
      )}

      {/* ---- PAUSE ---- */}
      {gs === "paused" && (
        <div className="absolute inset-0 z-30 grid place-items-center p-5" style={{ background: "color-mix(in srgb,var(--bg) 70%,transparent)", backdropFilter: "blur(6px)" }}>
          <div className="panel elev w-full max-w-sm p-8 text-center">
            <h2 className="display text-3xl">Paused</h2>
            <p className="mt-2 text-sm text-[var(--fg-2)]">Score {hud.score.toLocaleString()} · {hud.kills} kills</p>
            <div className="mt-6 grid gap-2">
              <button onClick={() => g()?.togglePause()} className="btn btn-accent">Resume</button>
              <button onClick={() => g()?.restart()} className="btn btn-outline">Restart</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- SHOP ---- */}
      {gs === "shop" && (
        <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto p-5" style={{ background: "color-mix(in srgb,var(--bg) 72%,transparent)", backdropFilter: "blur(8px)" }}>
          <div className="panel elev my-8 w-full max-w-2xl p-6 sm:p-8" style={{ animation: "tabIn .4s ease" }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="label">Armory · between waves</p>
                <h2 className="display text-3xl">Upgrade</h2>
              </div>
              <span className="rounded-full px-4 py-2 mono text-lg font-bold" style={{ background: "color-mix(in srgb,var(--accent) 16%,transparent)", color: "var(--accent)" }}>◆ {hud.gold}</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {UPGRADES.map((u) => {
                const gg = g();
                const lvl = gg?.levelOf(u.id) ?? 0;
                const maxed = gg?.maxedOf(u.id) ?? false;
                const cost = gg?.costOf(u.id) ?? u.baseCost;
                const afford = hud.gold >= cost && !maxed;
                const tierCol = u.tier === "epic" ? "#c084fc" : u.tier === "rare" ? "var(--accent-2)" : "var(--fg-2)";
                return (
                  <button key={u.id} disabled={!afford} onClick={() => { if (g()?.buyUpgrade(u.id)) force((n) => n + 1); }}
                    className="group flex items-center gap-3 rounded-2xl border p-3 text-left transition-all enabled:hover:-translate-y-0.5 disabled:opacity-45"
                    style={{ borderColor: afford ? "color-mix(in srgb,var(--accent) 30%,var(--line))" : "var(--line)", background: "var(--bg-3)" }}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `color-mix(in srgb,${tierCol} 16%,transparent)`, color: tierCol }}>{u.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2"><b className="text-sm">{u.name}</b>{lvl > 0 && <span className="mono text-[10px] text-[var(--fg-2)]">Lv {lvl}/{u.max}</span>}</span>
                      <span className="block text-xs text-[var(--fg-2)]">{u.desc}</span>
                    </span>
                    <span className="mono shrink-0 text-sm font-bold" style={{ color: maxed ? "var(--fg-2)" : afford ? "var(--accent)" : "var(--fg-2)" }}>{maxed ? "MAX" : `◆${cost}`}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => g()?.resumeFromShop()} className="btn btn-accent halo mt-5 w-full text-base">Deploy — next wave →</button>
          </div>
        </div>
      )}

      {/* ---- GAME OVER / WON ---- */}
      {(gs === "gameover" || gs === "won") && (
        <div className="absolute inset-0 z-30 grid place-items-center p-5" style={{ background: "color-mix(in srgb,var(--bg) 78%,transparent)", backdropFilter: "blur(8px)" }}>
          <div className="panel elev w-full max-w-md p-8 text-center" style={{ animation: "tabIn .5s ease" }}>
            <h2 className="display gradient-text text-4xl">{gs === "won" ? "Rift Sealed" : "Core Breached"}</h2>
            <p className="mt-2 text-[var(--fg-2)]">{gs === "won" ? "You cleared all five sectors. Legendary." : "The arena fell — but the salvage remembers you."}</p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[["Score", hud.score.toLocaleString()], ["Kills", hud.kills], ["Sector", hud.sector]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                  <div className="font-display text-2xl">{v}</div>
                  <div className="label mt-1">{l}</div>
                </div>
              ))}
            </div>
            <button onClick={() => g()?.restart()} className="btn btn-accent halo mt-7 w-full text-base">Play again ◈</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes riftBanner { 0% { opacity: 0; transform: scale(.8) translateY(10px); } 15% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; transform: scale(1.05); } }
      `}</style>
    </div>
  );
}
