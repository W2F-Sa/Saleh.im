"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";
import { RiftGame, RunConfig, RunResult, UPGRADES, type GameState, type Hud } from "@/lib/rift/engine";
import { ABILITIES, AbilityId } from "@/lib/rift/abilities";
import {
  ACHIEVEMENTS, DIFFICULTIES, DifficultyId, LoadoutPreset, RiftProfile, RunLogEntry,
  averageScore, defaultProfile, evaluateAchievements, favoriteHero, formatShareText, loadProfile, pushRunLog, resetProfile, saveProfile, winRate,
} from "@/lib/rift/meta";
import { HEROES, HeroDef, heroById, isHeroUnlocked } from "@/lib/rift/heroes";
import { WEAPONS, WeaponKind, isWeaponUnlocked, weaponById } from "@/lib/rift/weapons";
import { BOSS_LORE, ENEMY_CODEX, FIELD_TIPS, synergyFor } from "@/lib/rift/codex";
import { BOSSES } from "@/lib/rift/enemies";
import { ModifierDef, dailyChallengeLabel, dailyChallengeModifiers } from "@/lib/rift/challenges";
import { useLang } from "@/components/lang-provider";
import { riftDict } from "@/lib/rift/i18n";
import type { Lang } from "@/lib/i18n";
import {
  trHero, trWeapon, trWeaponName, trAbility, trAbilityName, trUpgrade,
  trEnemyName, trCodex, trBoss, trBossLore, trAchievement, trDifficulty,
  trModifier, trSynergyReasoning, trHudBossName, trHudBossTitle, FIELD_TIPS_FA,
} from "@/lib/rift/fa";

const INITIAL_HUD: Hud = {
  state: "menu", wave: 0, sector: 1, gold: 0, score: 0, hp: 100, hpMax: 100, shield: 0,
  coreHp: 400, coreHpMax: 400, enemiesAlive: 0, waveProgress: 0, level: 1, xp: 0, xpNext: 60, kills: 0, banner: "",
  heroName: "Vanguard", heroIcon: "◈", heroColor: "#67e8f9", weaponName: "Pulse Blaster", weaponIcon: "•",
  abilities: [
    { id: null, name: "", icon: "", color: "var(--fg-2)", cooldownFrac: 0, activeFrac: 0, ready: false },
    { id: null, name: "", icon: "", color: "var(--fg-2)", cooldownFrac: 0, activeFrac: 0, ready: false },
  ],
  boss: { visible: false, name: "", title: "", hp: 0, hpMax: 0, phase: 1, phases: 1, shieldActive: false, color: "#ff5f6d" },
  difficulty: "veteran", toast: "", combo: 0, comboFrac: 0, modifierIcons: [], dps: 0,
};

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div>
      {label && <div className="mb-1 flex items-center justify-between text-[10px] tracking-widest text-[var(--fg-2)]"><span>{label}</span><span className="mono">{Math.ceil(value)}/{max}</span></div>}
      <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
        <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
    </div>
  );
}

function HeroCard({ hero, selected, unlocked, onSelect, lang, unlocksAt }: { hero: HeroDef; selected: boolean; unlocked: boolean; onSelect: () => void; lang: Lang; unlocksAt: (s: string) => string }) {
  const t = trHero(lang, hero);
  return (
    <button
      onClick={onSelect}
      disabled={!unlocked}
      className="sheen glow-border relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all disabled:opacity-40"
      style={{ borderColor: selected ? hero.color : "var(--line)", background: selected ? `color-mix(in srgb, ${hero.color} 10%, var(--bg-3))` : "var(--bg-3)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `color-mix(in srgb, ${hero.color} 20%, transparent)`, color: hero.color }}>{hero.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">{t.name}{!unlocked && <span className="text-xs">🔒</span>}</div>
          <div className="text-[11px] text-[var(--fg-2)]">{t.title}</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--fg-2)]">{unlocked ? t.passiveDesc : unlocksAt(hero.unlockScore.toLocaleString())}</p>
    </button>
  );
}

function WeaponCard({ weapon, selected, unlocked, onSelect, lang, unlocksAt }: { weapon: ReturnType<typeof weaponById>; selected: boolean; unlocked: boolean; onSelect: () => void; lang: Lang; unlocksAt: (s: string) => string }) {
  const t = trWeapon(lang, weapon);
  return (
    <button
      onClick={onSelect}
      disabled={!unlocked}
      className="sheen glow-border relative overflow-hidden rounded-2xl border p-3.5 text-left transition-all disabled:opacity-40"
      style={{ borderColor: selected ? weapon.color : "var(--line)", background: selected ? `color-mix(in srgb, ${weapon.color} 10%, var(--bg-3))` : "var(--bg-3)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `color-mix(in srgb, ${weapon.color} 20%, transparent)`, color: weapon.color }}>{weapon.icon}</span>
        <div className="min-w-0 text-sm font-semibold">{t.name}{!unlocked && <span className="ms-1.5 text-xs">🔒</span>}</div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--fg-2)]">{unlocked ? t.special : unlocksAt(weapon.unlockScore.toLocaleString())}</p>
    </button>
  );
}

function VolumeSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-[var(--fg-2)]">{label}</span>
        <span className="mono text-[var(--fg-2)]">{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
      <div className="font-display text-xl">{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}

function RunLogRow({ entry }: { entry: RunLogEntry }) {
  const hero = heroById(entry.heroId);
  const weapon = weaponById(entry.weaponId as WeaponKind);
  const date = new Date(entry.t);
  return (
    <div className="flex items-center gap-3 rounded-xl border p-2.5 text-xs" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
      <span className="text-base" style={{ color: hero.color }}>{hero.icon}</span>
      <span className="text-base" style={{ color: weapon.color }}>{weapon.icon}</span>
      <span className={`rounded-full px-2 py-0.5 font-semibold ${entry.won ? "text-[var(--accent)]" : "text-[var(--fg-2)]"}`} style={{ background: entry.won ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--bg-2)" }}>
        {entry.won ? "WON" : `S${entry.sectorReached}`}
      </span>
      <span className="mono flex-1 text-[var(--fg-2)]">{entry.score.toLocaleString()} pts · Lv {entry.levelReached}</span>
      <span className="mono text-[10px] text-[var(--fg-2)] opacity-60">{date.toLocaleDateString()}</span>
    </div>
  );
}

export default function RiftPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RiftGame | null>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [gs, setGs] = useState<GameState>("menu");
  const [, force] = useState(0);
  const [profile, setProfile] = useState<RiftProfile>(() => (typeof window === "undefined" ? defaultProfile() : loadProfile()));
  const [menuTab, setMenuTab] = useState<"play" | "heroes" | "weapons" | "codex" | "achievements" | "stats" | "settings" | "guide">("play");
  const { lang } = useLang();
  const T = riftDict[lang];
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [toast, setToast] = useState("");
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);
  const [tipIndex] = useState(() => Math.floor(Math.random() * FIELD_TIPS.length));
  const fieldTip = (lang === "fa" ? FIELD_TIPS_FA : FIELD_TIPS)[tipIndex] ?? FIELD_TIPS[tipIndex];
  const [presetNameInput, setPresetNameInput] = useState("");
  const [dailyModifiers] = useState<ModifierDef[]>(() => dailyChallengeModifiers());
  const [challengeMode, setChallengeMode] = useState(false);
  const [prestigeMode, setPrestigeMode] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [shopOfferIds, setShopOfferIds] = useState<string[]>([]);

  useEffect(() => saveProfile(profile), [profile]);

  const lifetimeScore = profile.bestScore; // used to gate hero/weapon unlocks — grows with best single-run score

  const onRunEnd = useCallback((result: RunResult) => {
    setRunResult(result);
    if (result.practice) return; // practice runs never touch saved progress/achievements
    setProfile((prev) => {
      const next: RiftProfile = {
        ...prev,
        lifetimeKills: prev.lifetimeKills + result.kills,
        lifetimeBossKills: prev.lifetimeBossKills + result.bossKills,
        lifetimeGold: prev.lifetimeGold + result.goldEarned,
        lifetimeCrits: prev.lifetimeCrits + result.critKills,
        runsPlayed: prev.runsPlayed + 1,
        runsWon: prev.runsWon + (result.won ? 1 : 0),
        bestScore: Math.max(prev.bestScore, result.score),
        bestSector: Math.max(prev.bestSector, result.sectorReached),
        bestComboEver: Math.max(prev.bestComboEver, result.bestCombo),
        bestScoreByDifficulty: {
          ...prev.bestScoreByDifficulty,
          [prev.selectedDifficulty]: Math.max(prev.bestScoreByDifficulty[prev.selectedDifficulty] ?? 0, result.score),
        },
        runLog: pushRunLog(prev.runLog, {
          t: Date.now(), won: result.won, score: result.score, kills: result.kills,
          sectorReached: result.sectorReached, levelReached: result.levelReached,
          heroId: prev.selectedHero, weaponId: prev.selectedWeapon, difficultyId: prev.selectedDifficulty,
        }),
      };
      const unlocked = evaluateAchievements(next, { score: result.score, sectorReached: result.sectorReached, levelReached: result.levelReached });
      if (unlocked.length) {
        next.unlockedAchievements = [...next.unlockedAchievements, ...unlocked];
        setNewlyUnlocked(unlocked);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new RiftGame(canvas, { onHud: setHud, onState: setGs, onRunEnd, onToast: setToast });
    g.setSoundOn(profile.soundOn);
    g.setMusicOn(profile.musicOn);
    g.setMasterVolume(profile.masterVolume);
    g.setSfxVolume(profile.sfxVolume);
    g.setMusicVolume(profile.musicVolume);
    g.setColorblindMode(profile.colorblindShapes);
    g.setLang(lang);
    gameRef.current = g;
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(canvas);
    const onResize = () => g.resize();
    window.addEventListener("resize", onResize);
    return () => { ro.disconnect(); window.removeEventListener("resize", onResize); g.destroy(); gameRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = () => gameRef.current;
  const playing = gs === "playing" || gs === "paused" || gs === "shop";

  // Keep the engine's on-canvas banner language in sync with the site toggle.
  useEffect(() => { gameRef.current?.setLang(lang); }, [lang]);

  useEffect(() => {
    if (gs === "shop") setShopOfferIds(g()?.shopOffer() ?? []);
  }, [gs]);

  const selectedHero = heroById(profile.selectedHero);
  const selectedWeapon = weaponById(profile.selectedWeapon as WeaponKind);
  const abilitySlots = useMemo(() => profile.selectedAbilities as [AbilityId | null, AbilityId | null], [profile.selectedAbilities]);

  const launchRun = () => {
    const config: RunConfig = {
      heroId: profile.selectedHero,
      weaponId: profile.selectedWeapon as WeaponKind,
      difficultyId: profile.selectedDifficulty,
      abilities: abilitySlots,
      modifiers: challengeMode ? dailyModifiers : [],
      prestige: prestigeMode,
      practice: practiceMode,
    };
    setRunResult(null);
    setNewlyUnlocked([]);
    g()?.start(config);
  };

  const toggleAbility = (id: AbilityId) => {
    setProfile((prev) => {
      const cur = [...prev.selectedAbilities] as [string | null, string | null];
      if (cur[0] === id) { cur[0] = null; return { ...prev, selectedAbilities: cur }; }
      if (cur[1] === id) { cur[1] = null; return { ...prev, selectedAbilities: cur }; }
      if (!cur[0]) cur[0] = id; else if (!cur[1]) cur[1] = id; else cur[0] = id;
      return { ...prev, selectedAbilities: cur };
    });
  };

  const achievementCount = profile.unlockedAchievements.length;

  const savePreset = (slot: number) => {
    if (!presetNameInput.trim()) return;
    const preset: LoadoutPreset = { name: presetNameInput.trim().slice(0, 18), heroId: profile.selectedHero, weaponId: profile.selectedWeapon, abilities: abilitySlots };
    setProfile((p) => {
      const presets = [...p.presets];
      presets[slot] = preset;
      return { ...p, presets };
    });
    setPresetNameInput("");
  };
  const loadPreset = (preset: LoadoutPreset) => {
    setProfile((p) => ({ ...p, selectedHero: preset.heroId, selectedWeapon: preset.weaponId, selectedAbilities: preset.abilities }));
  };
  const clearPreset = (slot: number) => {
    setProfile((p) => {
      const presets = [...p.presets];
      presets[slot] = null;
      return { ...p, presets };
    });
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden select-none" style={{ background: "var(--bg)" }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {/* In-game status pills (only while playing). Kept below the menu
          overlays so they never fight for clicks. */}
      {playing && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 p-3 text-xs sm:p-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {practiceMode && <span className="glass rounded-full px-3 py-1.5 mono font-bold" style={{ border: "1px solid var(--accent)", color: "var(--accent)" }}>{T.practice}</span>}
            <span className="glass rounded-full px-3 py-1.5 mono" style={{ border: "1px solid var(--line)" }}>{T.sector} {hud.sector} · {T.wave} {hud.wave}/6</span>
            <span className="glass rounded-full px-3 py-1.5 mono" style={{ border: "1px solid var(--line)", color: "var(--accent)" }}>◆ {hud.gold}</span>
            <span className="glass hidden rounded-full px-3 py-1.5 mono sm:block" style={{ border: "1px solid var(--line)" }}>{T.lv} {hud.level}</span>
          </div>
        </div>
      )}

      {/* Top-bar controls — a dedicated cluster at the highest z-index so the
          back link, pause, language, dark/light and theme controls are ALWAYS
          clickable, even above the menu / shop / pause / game-over overlays
          (which sit at z-30). This was the bug: the old header was z-20 and got
          covered by those overlays, so the toggles did nothing on the menu. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[70] flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/" className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[var(--fg-2)] hover:text-[var(--fg)]" style={{ border: "1px solid var(--line)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            saleh.im
          </Link>
          <span className="glass hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline" style={{ border: "1px solid var(--line)" }}>◈ Rift</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {gs === "playing" && <button onClick={() => g()?.togglePause()} className="glass grid h-9 w-9 place-items-center rounded-full" style={{ border: "1px solid var(--line)" }} aria-label="Pause"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg></button>}
          <LangToggle />
          <ThemePicker />
        </div>
      </div>

      {/* bottom HUD bars */}
      {playing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 p-3 sm:p-5">
          <div className="w-40 space-y-1.5 sm:w-56">
            <Bar value={hud.hp} max={hud.hpMax} color={hud.heroColor} label={T.hull} />
            {hud.shield > 0 && <Bar value={hud.shield} max={Math.max(hud.shield, 40)} color="#60a5fa" />}
          </div>
          <div className="hidden flex-1 flex-col items-center gap-2 px-8 sm:flex">
            {hud.boss.visible ? (
              <div className="w-full max-w-md">
                <div className="mb-1 flex items-center justify-between text-[10px] tracking-widest" style={{ color: hud.boss.color }}>
                  <span>{trHudBossName(lang, hud.boss.name)} — {trHudBossTitle(lang, hud.boss.title)}{hud.boss.shieldActive ? ` · ${T.shielded}` : ""}</span>
                  <span>{T.phase} {hud.boss.phase}/{hud.boss.phases}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                  <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${(hud.boss.hp / Math.max(1, hud.boss.hpMax)) * 100}%`, background: hud.boss.color, boxShadow: `0 0 10px ${hud.boss.color}` }} />
                </div>
              </div>
            ) : (
              <>
                <div className="text-center text-[10px] tracking-widest text-[var(--fg-2)]">{T.waveProgress}</div>
                <div className="mx-auto h-1.5 w-full max-w-md overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                  <div className="h-full rounded-full" style={{ width: `${hud.waveProgress * 100}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-2))", transition: "width .3s" }} />
                </div>
              </>
            )}
          </div>
          <div className="w-40 text-right sm:w-56"><Bar value={hud.coreHp} max={hud.coreHpMax} color="var(--accent)" label={T.core} /></div>
        </div>
      )}

      {/* ability slots */}
      {playing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center gap-3 sm:bottom-28">
          {hud.abilities.map((a, i) => a.id ? (
            <div key={i} className="glass relative h-14 w-14 overflow-hidden rounded-2xl" style={{ border: `1.5px solid ${a.ready ? a.color : "var(--line)"}` }}>
              <div className="absolute inset-0 grid place-items-center text-xl" style={{ color: a.color, opacity: a.ready ? 1 : 0.35 }}>{a.icon}</div>
              {!a.ready && <div className="absolute inset-x-0 bottom-0 bg-black/50" style={{ height: `${a.cooldownFrac * 100}%` }} />}
              {a.activeFrac > 0 && <div className="absolute inset-0 animate-pulse" style={{ boxShadow: `inset 0 0 0 2px ${a.color}` }} />}
              <span className="absolute bottom-0.5 right-1 mono text-[9px] text-white/70">{i === 0 ? "1" : "2"}</span>
            </div>
          ) : null)}
        </div>
      )}

      {/* combo streak + active modifiers + optional DPS meter */}
      {playing && (hud.combo > 1 || hud.modifierIcons.length > 0 || (profile.showDpsMeter && hud.dps > 0)) && (
        <div className="pointer-events-none absolute right-3 top-16 z-20 flex flex-col items-end gap-1.5 sm:right-4">
          {profile.showDpsMeter && hud.dps > 0 && (
            <div className="glass rounded-full px-3 py-1" style={{ border: "1px solid var(--line)" }}>
              <span className="mono text-xs" style={{ color: "var(--accent-2)" }}>{hud.dps.toLocaleString()} {T.dps}</span>
            </div>
          )}
          {hud.combo > 1 && (
            <div className="glass overflow-hidden rounded-full px-3 py-1" style={{ border: "1px solid var(--line)" }}>
              <span className="mono text-xs font-bold" style={{ color: "var(--accent)" }}>×{hud.combo} {T.comboSuffix}</span>
              <div className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                <div className="h-full rounded-full" style={{ width: `${hud.comboFrac * 100}%`, background: "var(--accent)" }} />
              </div>
            </div>
          )}
          {hud.modifierIcons.length > 0 && (
            <div className="glass flex gap-1 rounded-full px-2 py-1" style={{ border: "1px solid var(--line)" }}>
              {hud.modifierIcons.map((icon, i) => <span key={i} className="text-sm">{icon}</span>)}
            </div>
          )}
        </div>
      )}

      {/* toast (achievements etc) */}
      {playing && hud.toast && (
        <div className="pointer-events-none absolute inset-x-0 top-[10%] z-20 text-center">
          <span className="glass inline-block rounded-full px-4 py-2 text-sm" style={{ border: "1px solid var(--line)", color: "var(--accent)" }}>{hud.toast}</span>
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
        <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto p-5 py-20">
          <div className="w-full max-w-3xl">
            <div className="panel elev sheen glow-border p-6 sm:p-8" style={{ animation: "tabIn .5s ease" }}>
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 grid h-16 w-16 place-items-center rounded-3xl text-3xl" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)", boxShadow: "0 14px 40px -10px var(--glow)" }}>◈</div>
                <h1 className="display gradient-text text-4xl sm:text-5xl">Rift</h1>
                <p className="mt-2 max-w-xl text-sm text-[var(--fg-2)]">{T.menuSubA}<b style={{ color: "var(--accent)" }}>{T.menuSubCore}</b>{T.menuSubB}</p>
              </div>

              <p className="mx-auto mt-3 max-w-md text-center text-[11px] text-[var(--fg-2)] opacity-70">💡 {fieldTip}</p>

              <div className="mt-6 flex justify-center gap-1.5 overflow-x-auto">
                {(["play", "guide", "heroes", "weapons", "codex", "achievements", "stats", "settings"] as const).map((tab) => (
                  <button key={tab} onClick={() => setMenuTab(tab)} className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors"
                    style={{ background: menuTab === tab ? "var(--accent)" : "var(--bg-3)", color: menuTab === tab ? "var(--on-accent)" : "var(--fg-2)" }}>
                    {tab === "achievements" ? `${T.achievements} (${achievementCount}/${ACHIEVEMENTS.length})` : T[tab]}
                  </button>
                ))}
              </div>

              {menuTab === "play" && (
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 label">{T.difficulty}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {DIFFICULTIES.map((d) => {
                        const dt = trDifficulty(lang, d);
                        return (
                        <button key={d.id} onClick={() => setProfile((p) => ({ ...p, selectedDifficulty: d.id as DifficultyId }))}
                          className="rounded-xl border p-3 text-left transition-all"
                          style={{ borderColor: profile.selectedDifficulty === d.id ? d.color : "var(--line)", background: profile.selectedDifficulty === d.id ? `color-mix(in srgb, ${d.color} 10%, var(--bg-3))` : "var(--bg-3)" }}>
                          <div className="text-sm font-semibold" style={{ color: d.color }}>{dt.name}</div>
                          <div className="mt-0.5 text-[11px] text-[var(--fg-2)]">{dt.desc}</div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 label">{T.abilitiesPick}</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ABILITIES.map((a) => {
                        const picked = abilitySlots.includes(a.id);
                        const bannedByOneLife = challengeMode && dailyModifiers.some((m) => m.id === "oneLife") && a.id === "shieldwall";
                        return (
                          <button key={a.id} disabled={bannedByOneLife} onClick={() => toggleAbility(a.id)} className="flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all disabled:opacity-30"
                            style={{ borderColor: picked ? a.color : "var(--line)", background: picked ? `color-mix(in srgb, ${a.color} 12%, var(--bg-3))` : "var(--bg-3)" }}>
                            <span className="text-lg">{a.icon}</span>
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold">{trAbility(lang, a).name}{bannedByOneLife && " 🚫"}</span>
                              <span className="block text-[10px] text-[var(--fg-2)]">{bannedByOneLife ? T.bannedByOneLife : `${a.cooldown}${T.cooldownSuffix}`}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-xl border p-3 text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)" }}>
                    {T.flyingAs(trHero(lang, selectedHero).name, trWeaponName(lang, selectedWeapon))}
                  </div>
                  <div>
                    <div className="mb-2 label">{T.loadoutPresets}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {profile.presets.map((preset, i) => (
                        <div key={i} className="rounded-xl border p-2 text-center" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                          {preset ? (
                            <>
                              <button onClick={() => loadPreset(preset)} className="w-full text-xs font-semibold">{preset.name}</button>
                              <button onClick={() => clearPreset(i)} className="mt-1 text-[10px] text-[var(--fg-2)] hover:text-[var(--fg)]">{T.clear}</button>
                            </>
                          ) : (
                            <button
                              onClick={() => { const name = presetNameInput || `Slot ${i + 1}`; setPresetNameInput(name); savePreset(i); }}
                              className="w-full text-[11px] text-[var(--fg-2)]"
                            >
                              {T.saveHere}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <input
                      value={presetNameInput}
                      onChange={(e) => setPresetNameInput(e.target.value)}
                      placeholder={T.presetPlaceholder}
                      className="mt-2 w-full rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none"
                      style={{ borderColor: "var(--line)" }}
                    />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="label">{T.dailyChallenge} — {dailyChallengeLabel()}</span>
                      <label className="flex items-center gap-1.5 text-[11px] text-[var(--fg-2)]">
                        <input type="checkbox" checked={challengeMode} onChange={(e) => setChallengeMode(e.target.checked)} className="h-3.5 w-3.5" />
                        {T.enable}
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {dailyModifiers.map((m) => {
                        const mt = trModifier(lang, m);
                        return (
                        <div key={m.id} className="rounded-xl border p-2.5 text-center transition-all" style={{ borderColor: challengeMode ? "var(--accent)" : "var(--line)", background: challengeMode ? "color-mix(in srgb, var(--accent) 8%, var(--bg-3))" : "var(--bg-3)", opacity: challengeMode ? 1 : 0.6 }}>
                          <div className="text-lg">{m.icon}</div>
                          <div className="mt-0.5 text-[11px] font-semibold">{mt.name}</div>
                          <div className="mt-0.5 text-[9px] leading-tight text-[var(--fg-2)]">{mt.desc}</div>
                        </div>
                        );
                      })}
                    </div>
                    {challengeMode && <p className="mt-2 text-[11px] text-[var(--accent)]">{T.challengeNote}</p>}
                  </div>
                  {profile.runsWon > 0 && (
                    <label className="flex items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)" }}>
                      <span>
                        <b>{T.prestige}</b>
                        <span className="block text-[11px] text-[var(--fg-2)]">{T.prestigeDesc}</span>
                      </span>
                      <input type="checkbox" checked={prestigeMode} onChange={(e) => setPrestigeMode(e.target.checked)} className="h-4 w-4" />
                    </label>
                  )}
                  <label className="flex items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)" }}>
                    <span>
                      <b>{T.practiceMode}</b>
                      <span className="block text-[11px] text-[var(--fg-2)]">{T.practiceDesc}</span>
                    </span>
                    <input type="checkbox" checked={practiceMode} onChange={(e) => setPracticeMode(e.target.checked)} className="h-4 w-4" />
                  </label>
                  <button onClick={launchRun} className="btn btn-accent halo w-full text-base">{T.launch}</button>
                </div>
              )}

              {menuTab === "guide" && (
                <div className="mt-6 max-h-[26rem] space-y-4 overflow-y-auto pe-1 text-sm leading-relaxed text-[var(--fg-2)]">
                  <div>
                    <div className="mb-1 label">{T.guideTitle}</div>
                    <p>{T.guideIntro}</p>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                    <div className="mb-1.5 font-semibold text-[var(--fg)]">🎯 {T.guideGoalT}</div>
                    <p>{T.guideGoal}</p>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                    <div className="mb-2 font-semibold text-[var(--fg)]">🎮 {T.guideControlsT}</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {[
                        ["WASD / ←↑↓→", T.cMove],
                        [lang === "fa" ? "موس / کشیدن با لمس" : "Mouse / touch drag", T.cAim],
                        ["1", T.cAbility1],
                        ["2", T.cAbility2],
                        ["P", T.cPause],
                      ].map(([key, action]) => (
                        <div key={key} className="rounded-lg border p-2 text-[11px]" style={{ borderColor: "var(--line)" }}>
                          <span className="mono text-[var(--fg)]">{key}</span>
                          <span className="block">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                    <div className="mb-1.5 font-semibold text-[var(--fg)]">🔁 {T.guideLoopT}</div>
                    <p>{T.guideLoop}</p>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                    <div className="mb-1.5 font-semibold text-[var(--fg)]">🛡 {T.guideHeroesT}</div>
                    <p>{T.guideHeroes}</p>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                    <div className="mb-2 font-semibold text-[var(--fg)]">💡 {T.guideTipsT}</div>
                    <ul className="space-y-1.5">
                      {T.guideTips.map((tip, i) => (
                        <li key={i} className="flex gap-2">
                          <span style={{ color: "var(--accent)" }}>◆</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button onClick={() => setMenuTab("play")} className="btn btn-accent halo w-full">{T.launch}</button>
                </div>
              )}

              {menuTab === "heroes" && (
                <div className="mt-6 space-y-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {HEROES.map((h) => (
                      <HeroCard key={h.id} hero={h} lang={lang} unlocksAt={T.unlocksAt} selected={profile.selectedHero === h.id} unlocked={isHeroUnlocked(h, lifetimeScore)}
                        onSelect={() => isHeroUnlocked(h, lifetimeScore) && setProfile((p) => ({ ...p, selectedHero: h.id }))} />
                    ))}
                  </div>
                  {(() => {
                    const synergy = synergyFor(selectedHero.id);
                    if (!synergy) return null;
                    const bestWeapon = weaponById(synergy.bestWeapon as WeaponKind);
                    return (
                      <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--accent) 6%, var(--bg-3))" }}>
                        <div className="label mb-1.5">{T.suggestedBuild(trHero(lang, selectedHero).name)}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span style={{ color: bestWeapon.color }}>{bestWeapon.icon} {trWeaponName(lang, bestWeapon)}</span>
                          <span className="text-[var(--fg-2)]">+</span>
                          {synergy.bestAbilities.map((id) => {
                            const a = ABILITIES.find((x) => x.id === id);
                            return a ? <span key={id} style={{ color: a.color }}>{a.icon} {trAbility(lang, a).name}</span> : null;
                          })}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fg-2)]">{trSynergyReasoning(lang, selectedHero.id, synergy.reasoning)}</p>
                        {isWeaponUnlocked(bestWeapon, lifetimeScore) ? (
                          <button
                            onClick={() => setProfile((p) => ({ ...p, selectedWeapon: synergy.bestWeapon, selectedAbilities: synergy.bestAbilities as [string, string] }))}
                            className="mt-2 text-[11px] font-semibold" style={{ color: "var(--accent)" }}
                          >
                            {T.applyBuild}
                          </button>
                        ) : (
                          <p className="mt-2 text-[11px] text-[var(--fg-2)]">{T.unlockToUse(trWeaponName(lang, bestWeapon))}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {menuTab === "weapons" && (
                <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {WEAPONS.map((w) => (
                    <WeaponCard key={w.id} weapon={w} lang={lang} unlocksAt={T.unlocksAt} selected={profile.selectedWeapon === w.id} unlocked={isWeaponUnlocked(w, lifetimeScore)}
                      onSelect={() => isWeaponUnlocked(w, lifetimeScore) && setProfile((p) => ({ ...p, selectedWeapon: w.id }))} />
                  ))}
                </div>
              )}

              {menuTab === "codex" && (
                <div className="mt-6 max-h-[24rem] space-y-4 overflow-y-auto pe-1">
                  <div>
                    <div className="mb-2 label">{T.bestiary}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ENEMY_CODEX.map((c) => {
                        const ct = trCodex(lang, c);
                        return (
                        <div key={c.kind} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                          <div className="flex items-center justify-between">
                            <b className="text-xs capitalize">{trEnemyName(lang, c.kind, c.kind)}</b>
                            <span className="mono text-[10px] text-[var(--fg-2)]">{"⚠".repeat(c.threat)}</span>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fg-2)]">{ct.flavor}</p>
                          <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--accent)" }}>{ct.tacticalNote}</p>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 label">{T.bossManual}</div>
                    <div className="grid gap-2">
                      {BOSSES.map((b) => {
                        const lore = BOSS_LORE.find((l) => l.kind === b.kind);
                        const bt = trBoss(lang, b);
                        const lt = lore ? trBossLore(lang, lore) : null;
                        return (
                          <div key={b.kind} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ background: b.color, boxShadow: `0 0 8px ${b.color}` }} />
                              <b className="text-sm">{bt.name}</b><span className="text-[11px] text-[var(--fg-2)]">— {bt.title}</span>
                            </div>
                            {lt && <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fg-2)]">{lt.lore}</p>}
                            {lt && <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--accent)" }}>{lt.strategy}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {menuTab === "achievements" && (
                <div className="mt-6 grid max-h-[22rem] gap-2 overflow-y-auto pe-1 sm:grid-cols-2">
                  {ACHIEVEMENTS.map((a) => {
                    const unlocked = profile.unlockedAchievements.includes(a.id);
                    const at = trAchievement(lang, a);
                    return (
                      <div key={a.id} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--line)", background: unlocked ? "color-mix(in srgb, var(--accent) 8%, var(--bg-3))" : "var(--bg-3)", opacity: unlocked ? 1 : 0.55 }}>
                        <span className="text-lg">{unlocked ? a.icon : "🔒"}</span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold">{at.name}</span>
                          <span className="block text-[10px] text-[var(--fg-2)]">{at.desc}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {menuTab === "stats" && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    <StatCard label={T.bestScore} value={profile.bestScore.toLocaleString()} />
                    <StatCard label={T.runsWon} value={profile.runsWon} />
                    <StatCard label={T.winRate} value={`${Math.round(winRate(profile.runLog) * 100)}%`} />
                    <StatCard label={T.avgScore} value={averageScore(profile.runLog).toLocaleString()} />
                    <StatCard label={T.bestSector} value={profile.bestSector} />
                    <StatCard label={T.lifetimeKills} value={profile.lifetimeKills.toLocaleString()} />
                    <StatCard label={T.bossKills} value={profile.lifetimeBossKills} />
                    <StatCard label={T.lifetimeGold} value={profile.lifetimeGold.toLocaleString()} />
                    <StatCard label={T.critKills} value={profile.lifetimeCrits} />
                    <StatCard label={T.favoriteHero} value={favoriteHero(profile.runLog) ? trHero(lang, heroById(favoriteHero(profile.runLog)!)).name : "—"} />
                  </div>
                  <div>
                    <div className="mb-2 label">{T.recentRuns}</div>
                    {profile.runLog.length === 0 ? (
                      <p className="text-xs text-[var(--fg-2)]">{T.noRuns}</p>
                    ) : (
                      <div className="max-h-52 space-y-1.5 overflow-y-auto pe-1">
                        {profile.runLog.map((r, i) => <RunLogRow key={i} entry={r} />)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {menuTab === "settings" && (
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
                    <div className="label mb-2">{T.controls}</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[var(--fg-2)] sm:grid-cols-3">
                      {[
                        ["WASD / ←↑↓→", T.cMove],
                        [lang === "fa" ? "موس / کشیدن با لمس" : "Mouse / touch drag", T.cAim],
                        ["1", T.cAbility1],
                        ["2", T.cAbility2],
                        ["P", T.cPause],
                      ].map(([key, action]) => (
                        <div key={key} className="rounded-lg border p-2" style={{ borderColor: "var(--line)" }}>
                          <span className="mono text-[var(--fg)]">{key}</span>
                          <span className="block">{action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {[
                    [T.soundEffects, "soundOn"],
                    [T.music, "musicOn"],
                    [T.screenShake, "screenShakeOn"],
                    [T.colorblind, "colorblindShapes"],
                    [T.showDps, "showDpsMeter"],
                  ].map(([label, key]) => (
                    <label key={key} className="flex items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)" }}>
                      {label}
                      <input type="checkbox" checked={profile[key as keyof RiftProfile] as boolean}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setProfile((p) => ({ ...p, [key as string]: checked }));
                          if (key === "soundOn") g()?.setSoundOn(checked);
                          if (key === "musicOn") g()?.setMusicOn(checked);
                          if (key === "colorblindShapes") g()?.setColorblindMode(checked);
                        }} className="h-4 w-4" />
                    </label>
                  ))}
                  <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
                    <VolumeSlider label={T.masterVolume} value={profile.masterVolume} onChange={(v) => { setProfile((p) => ({ ...p, masterVolume: v })); g()?.setMasterVolume(v); }} />
                    <VolumeSlider label={T.soundEffects} value={profile.sfxVolume} onChange={(v) => { setProfile((p) => ({ ...p, sfxVolume: v })); g()?.setSfxVolume(v); }} />
                    <VolumeSlider label={T.music} value={profile.musicVolume} onChange={(v) => { setProfile((p) => ({ ...p, musicVolume: v })); g()?.setMusicVolume(v); }} />
                  </div>
                  <div className="rounded-xl border p-3 text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)" }}>
                    Best score: <b className="text-[var(--fg)]">{profile.bestScore.toLocaleString()}</b> · Runs won: <b className="text-[var(--fg)]">{profile.runsWon}</b> · Lifetime kills: <b className="text-[var(--fg)]">{profile.lifetimeKills.toLocaleString()}</b>
                  </div>
                  <div className="grid gap-1.5 rounded-xl border p-3 text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)" }}>
                    <div className="label mb-1">{T.bestByDifficulty}</div>
                    {DIFFICULTIES.map((d) => (
                      <div key={d.id} className="flex items-center justify-between">
                        <span style={{ color: d.color }}>{trDifficulty(lang, d).name}</span>
                        <span className="mono text-[var(--fg)]">{(profile.bestScoreByDifficulty[d.id] ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(T.resetConfirm)) {
                        setProfile(resetProfile());
                      }
                    }}
                    className="btn btn-outline w-full text-xs text-[var(--fg-2)] hover:text-[#ff5f6d]"
                  >
                    {T.resetProgress}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- PAUSE ---- */}
      {gs === "paused" && (
        <div className="absolute inset-0 z-30 grid place-items-center p-5" style={{ background: "color-mix(in srgb,var(--bg) 70%,transparent)", backdropFilter: "blur(6px)" }}>
          <div className="panel elev w-full max-w-sm p-8 text-center">
            <h2 className="display text-3xl">{T.paused}</h2>
            <p className="mt-2 text-sm text-[var(--fg-2)]">{T.scoreKills(hud.score.toLocaleString(), hud.kills)}</p>
            <div className="mt-6 grid gap-2">
              <button onClick={() => g()?.togglePause()} className="btn btn-accent">{T.resume}</button>
              <button onClick={launchRun} className="btn btn-outline">{T.restart}</button>
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
                <p className="label">{T.armory}</p>
                <h2 className="display text-3xl">{T.upgrade}</h2>
              </div>
              <div className="flex items-center gap-2">
                {(g()?.rerollsLeft() ?? 0) > 0 && (
                  <button
                    onClick={() => { const offer = g()?.rerollShop(); if (offer) { setShopOfferIds(offer); force((n) => n + 1); } }}
                    disabled={hud.gold < (g()?.rerollCost() ?? 0)}
                    className="btn btn-outline text-xs disabled:opacity-40"
                  >
                    {T.rerollLabel(g()?.rerollCost() ?? 0, g()?.rerollsLeft() ?? 0)}
                  </button>
                )}
                <span className="rounded-full px-4 py-2 mono text-lg font-bold" style={{ background: "color-mix(in srgb,var(--accent) 16%,transparent)", color: "var(--accent)" }}>◆ {hud.gold}</span>
              </div>
            </div>

            {g()?.canSwapWeapon() && (
              <div className="mb-5">
                <div className="mb-2 label">{T.swapWeapon}</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {WEAPONS.filter((w) => isWeaponUnlocked(w, lifetimeScore)).map((w) => {
                    const active = g()?.currentWeaponId() === w.id;
                    return (
                      <button key={w.id} onClick={() => { g()?.swapWeapon(w.id); force((n) => n + 1); }}
                        className="grid place-items-center gap-1 rounded-xl border p-2 text-center transition-all"
                        style={{ borderColor: active ? w.color : "var(--line)", background: active ? `color-mix(in srgb, ${w.color} 14%, var(--bg-3))` : "var(--bg-3)" }}>
                        <span className="text-lg" style={{ color: w.color }}>{w.icon}</span>
                        <span className="text-[10px]">{trWeaponName(lang, w)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-2 flex items-center justify-between">
              <span className="label">{T.featuredOffer}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {shopOfferIds.map((id) => {
                const u = UPGRADES.find((x) => x.id === id);
                if (!u) return null;
                const ut = trUpgrade(lang, u);
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
                      <span className="flex items-center gap-2"><b className="text-sm">{ut.name}</b>{lvl > 0 && <span className="mono text-[10px] text-[var(--fg-2)]">Lv {lvl}/{u.max}</span>}</span>
                      <span className="block text-xs text-[var(--fg-2)]">{ut.desc}</span>
                    </span>
                    <span className="mono shrink-0 text-sm font-bold" style={{ color: maxed ? "var(--fg-2)" : afford ? "var(--accent)" : "var(--fg-2)" }}>{maxed ? T.max : `◆${cost}`}</span>
                  </button>
                );
              })}
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-[var(--fg-2)] hover:text-[var(--fg)]">{T.showAll}</summary>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                {UPGRADES.map((u) => {
                  const ut = trUpgrade(lang, u);
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
                      <span className="mono shrink-0 text-sm font-bold" style={{ color: maxed ? "var(--fg-2)" : afford ? "var(--accent)" : "var(--fg-2)" }}>{maxed ? T.max : `◆${cost}`}</span>
                    </button>
                  );
                })}
              </div>
            </details>
            <button onClick={() => g()?.resumeFromShop()} className="btn btn-accent halo mt-5 w-full text-base">{T.deployNext}</button>
          </div>
        </div>
      )}

      {/* ---- GAME OVER / WON ---- */}
      {(gs === "gameover" || gs === "won") && (
        <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto p-5" style={{ background: "color-mix(in srgb,var(--bg) 78%,transparent)", backdropFilter: "blur(8px)" }}>
          {toast && <div className="absolute top-6 rounded-full px-4 py-2 text-xs" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{toast}</div>}
          <div className="panel elev my-8 w-full max-w-md p-8 text-center" style={{ animation: "tabIn .5s ease" }}>
            <h2 className="display gradient-text text-4xl">{gs === "won" ? T.wonTitle : T.lostTitle}</h2>
            <p className="mt-2 text-[var(--fg-2)]">{gs === "won" ? T.wonSub : T.lostSub}</p>
            <div className="mt-6 grid grid-cols-4 gap-2">
              {[[T.score, hud.score.toLocaleString()], [T.kills, hud.kills], [T.sectorLabel, hud.sector], [T.bestCombo, `×${Math.max(hud.combo, runResult?.bestCombo ?? 0)}`]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                  <div className="font-display text-2xl">{v}</div>
                  <div className="label mt-1">{l}</div>
                </div>
              ))}
            </div>
            {newlyUnlocked.length > 0 && (
              <div className="mt-5 space-y-1.5 rounded-xl border p-3 text-left" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-3))" }}>
                <div className="label mb-1">{T.newAchievements}</div>
                {newlyUnlocked.map((id) => {
                  const a = ACHIEVEMENTS.find((x) => x.id === id);
                  if (!a) return null;
                  return <div key={id} className="flex items-center gap-2 text-sm"><span>{a.icon}</span><span>{trAchievement(lang, a).name}</span></div>;
                })}
              </div>
            )}
            <div className="mt-7 grid gap-2">
              <button onClick={launchRun} className="btn btn-accent halo w-full text-base">{T.playAgain}</button>
              <button
                onClick={() => {
                  if (!runResult) return;
                  const text = formatShareText(runResult, selectedHero.name, selectedWeapon.name, DIFFICULTIES.find((d) => d.id === profile.selectedDifficulty)?.name ?? "");
                  void navigator.clipboard?.writeText(text);
                  setToast(T.resultCopied);
                  window.setTimeout(() => setToast(""), 2000);
                }}
                className="btn btn-outline w-full text-sm"
              >
                {T.copyResult}
              </button>
              <button onClick={() => setGs("menu")} className="btn btn-outline w-full text-sm">{T.backToMenu}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes riftBanner { 0% { opacity: 0; transform: scale(.8) translateY(10px); } 15% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; transform: scale(1.05); } }
      `}</style>
    </div>
  );
}
