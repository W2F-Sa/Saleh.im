"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemePicker } from "@/components/theme-picker";
import {
  ActorSnapshot,
  GameMode,
  HudState,
  MatchConfig,
  MatchPhase,
  MISSIONS,
  MissionDef,
  VanguardEngine,
  missionById,
} from "@/lib/vanguard/engine";
import { DIFFICULTIES, Difficulty } from "@/lib/vanguard/ai";
import { MAPS, GameMap } from "@/lib/vanguard/maps";
import { PERKS, WEAPONS } from "@/lib/vanguard/weapons";
import { NetSession, roomCodeToPeerId } from "@/lib/vanguard/net";

type Screen = "main" | "campaign" | "skirmish" | "multiplayer" | "settings" | "playing";

const INITIAL_HUD: HudState = {
  phase: "lobby",
  countdown: 3,
  health: 100,
  maxHealth: 100,
  armor: 0,
  weaponName: "M4 Carbine",
  weaponIcon: "🗡",
  ammoInMag: 30,
  ammoReserve: 210,
  reloading: false,
  ads: false,
  crosshairSpread: 0.03,
  hitMarker: 0,
  damageFlash: 0,
  lowHealth: false,
  killFeed: [],
  scoreboard: [],
  timeLeftSec: 0,
  redScore: 0,
  blueScore: 0,
  localScore: 0,
  objective: "",
  objectiveProgress: 0,
  compassAngle: 0,
  minimapActors: [],
  bannerText: "",
  bannerT: 0,
};

const STORAGE_KEY = "vanguard.settings.v1";

interface StoredSettings {
  sensitivity: number;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  unlockedLevel: number;
  unlockedMissions: string[];
}

function loadSettings(): StoredSettings {
  const defaults: StoredSettings = { sensitivity: 1, masterVolume: 0.8, sfxVolume: 0.9, musicVolume: 0.35, unlockedLevel: 12, unlockedMissions: ["m1"] };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function saveSettings(s: StoredSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage may be unavailable (private mode) — settings simply won't persist */
  }
}

/* -------------------------------------------------------------------- */
/*  Small presentational bits                                           */
/* -------------------------------------------------------------------- */

function StatBar({ value, max, color, icon }: { value: number; max: number; color: string; icon: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>{icon}</span>
      <div className="h-2 w-28 overflow-hidden rounded-full sm:w-40" style={{ background: "rgba(0,0,0,0.4)" }}>
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
      <span className="mono w-8 text-right text-xs text-white/80">{Math.ceil(value)}</span>
    </div>
  );
}

function MapCard({ map, selected, onSelect }: { map: GameMap; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="group sheen glow-border relative overflow-hidden rounded-2xl border p-4 text-left transition-all"
      style={{ borderColor: selected ? "var(--accent)" : "var(--line)", background: selected ? "color-mix(in srgb, var(--accent) 10%, var(--bg-3))" : "var(--bg-3)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{map.name}</span>
        <span className="mono rounded-full px-2 py-0.5 text-[10px] uppercase" style={{ background: "var(--bg-2)", color: "var(--fg-2)" }}>{map.size}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--fg-2)]">{map.description}</p>
      <div className="mt-3 grid grid-cols-8 gap-[1.5px] overflow-hidden rounded-lg" style={{ aspectRatio: `${map.width}/${map.height}` }}>
        <svg viewBox={`0 0 ${map.width} ${map.height}`} className="col-span-8 h-full w-full" style={{ background: map.floorColor }}>
          {map.grid.map((row, y) =>
            row.map((cell, x) => (cell > 0 ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" opacity={0.55} style={{ color: selected ? "var(--accent)" : "var(--fg-2)" }} /> : null)),
          )}
        </svg>
      </div>
    </button>
  );
}

function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {DIFFICULTIES.map((d) => (
        <button
          key={d.id}
          onClick={() => onChange(d.id)}
          className="rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition-all"
          style={{
            borderColor: value === d.id ? d.color : "var(--line)",
            background: value === d.id ? `color-mix(in srgb, ${d.color} 16%, var(--bg-3))` : "var(--bg-3)",
            color: value === d.id ? d.color : "var(--fg-2)",
          }}
        >
          {d.name}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/*  Page                                                                 */
/* -------------------------------------------------------------------- */

export default function VanguardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VanguardEngine | null>(null);
  const netRef = useRef<NetSession | null>(null);

  const [screen, setScreen] = useState<Screen>("main");
  const [phase, setPhase] = useState<MatchPhase>("lobby");
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [settings, setSettings] = useState<StoredSettings>(() => loadSettings());
  const [matchOver, setMatchOver] = useState<{ winner: number | null; mvp: string } | null>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showWeaponWheel, setShowWeaponWheel] = useState(false);

  // Skirmish setup state
  const [selMapId, setSelMapId] = useState(MAPS[0].id);
  const [selMode, setSelMode] = useState<GameMode>("ffa");
  const [selBots, setSelBots] = useState(7);
  const [selDifficulty, setSelDifficulty] = useState<Difficulty>("regular");
  const [selAutoPlay, setSelAutoPlay] = useState(false);
  const [selUndead, setSelUndead] = useState(false);
  const [selScoreLimit, setSelScoreLimit] = useState(30);
  const [selTimeLimit, setSelTimeLimit] = useState(600);

  // Campaign
  const [selMission, setSelMission] = useState<MissionDef>(MISSIONS[0]);

  // Multiplayer
  const [mpMode, setMpMode] = useState<"host" | "join">("host");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mpStatus, setMpStatus] = useState("");
  const [mpPeers, setMpPeers] = useState<{ id: number; name: string }[]>([]);
  const [ping, setPing] = useState<number | null>(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const isUnlocked = useCallback((missionIndex: number) => settings.unlockedMissions.includes(MISSIONS[missionIndex].id), [settings.unlockedMissions]);

  const teardown = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    netRef.current?.dispose();
    netRef.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const launch = useCallback((config: MatchConfig, net?: NetSession) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    teardown();
    setMatchOver(null);
    setShowScoreboard(false);
    setShowWeaponWheel(false);

    const engine = new VanguardEngine(canvas, config, {
      onHud: setHud,
      onPhase: (p) => setPhase(p),
      onMatchOver: (winner, mvp) => {
        setMatchOver({ winner, mvp });
        if (config.mode === "campaign" && config.missionId) {
          const mission = missionById(config.missionId);
          setSettings((s) => {
            const idx = MISSIONS.findIndex((m) => m.id === mission.id);
            const next = MISSIONS[idx + 1];
            const unlockedMissions = next && !s.unlockedMissions.includes(next.id) ? [...s.unlockedMissions, next.id] : s.unlockedMissions;
            return { ...s, unlockedMissions, unlockedLevel: Math.max(s.unlockedLevel, idx + 4) };
          });
        }
      },
      net: net
        ? {
            isHost: net.isHost,
            localId: net.myId,
            sendShot: (ox, oy, angle, weaponId, t) => net.sendShot(ox, oy, angle, weaponId, t),
          }
        : undefined,
    });
    engineRef.current = engine;
    if (net) net.attachEngine(engine);

    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);
    (engine as unknown as { __ro?: ResizeObserver }).__ro = ro;

    engine.startCountdown();
    setScreen("playing");
  }, [teardown]);

  useEffect(() => {
    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // -- start flows ---------------------------------------------------------

  const startCampaign = (mission: MissionDef) => {
    launch({
      mapId: mission.mapId,
      mode: "campaign",
      botCount: mission.botCount,
      difficulty: mission.difficulty,
      scoreLimit: 9999,
      timeLimitSec: 0,
      missionId: mission.id,
      autoPlay: false,
      teams: false,
    });
  };

  const startSkirmish = () => {
    launch({
      mapId: selMapId,
      mode: selMode,
      botCount: selBots,
      difficulty: selDifficulty,
      scoreLimit: selScoreLimit,
      timeLimitSec: selTimeLimit,
      autoPlay: selAutoPlay,
      teams: selMode === "tdm",
      undead: selUndead && selMode !== "tdm",
    });
  };

  const hostOnline = async () => {
    setMpStatus("Opening peer connection…");
    const net = new NetSession({
      onPeerId: () => setMpStatus("Room ready — share the code below"),
      onPeerJoined: (id, name) => setMpPeers((p) => [...p, { id, name }]),
      onPeerLeft: (id) => setMpPeers((p) => p.filter((x) => x.id !== id)),
      onError: (msg) => setMpStatus(`Error: ${msg}`),
    });
    netRef.current = net;
    try {
      const code = await net.hostMatch();
      setRoomCode(code);
      launch(
        { mapId: selMapId, mode: "ffa", botCount: Math.max(0, selBots - 2), difficulty: selDifficulty, scoreLimit: selScoreLimit, timeLimitSec: selTimeLimit, autoPlay: false, teams: selMode === "tdm" },
        net,
      );
    } catch {
      setMpStatus("Could not open a peer connection. Check your network and try again.");
    }
  };

  const joinOnline = async () => {
    if (!joinCode.trim()) {
      setMpStatus("Enter a room code first.");
      return;
    }
    setMpStatus("Connecting…");
    const net = new NetSession({
      onConnected: () => setMpStatus("Connected — synchronising…"),
      onDisconnected: () => setMpStatus("Disconnected from host."),
      onError: (msg) => setMpStatus(`Error: ${msg}`),
      onPing: (ms) => setPing(ms),
      onPeerJoined: (id, name) => setMpPeers((p) => [...p, { id, name }]),
    });
    netRef.current = net;
    try {
      await net.joinMatch(joinCode, "Player");
      launch({ mapId: selMapId, mode: "ffa", botCount: 0, difficulty: selDifficulty, scoreLimit: selScoreLimit, timeLimitSec: selTimeLimit, autoPlay: false, teams: false }, net);
    } catch {
      setMpStatus("Could not reach that room. Double-check the code.");
    }
  };

  const backToMenu = () => {
    teardown();
    setScreen("main");
    setPhase("lobby");
    setMatchOver(null);
    setMpPeers([]);
    setRoomCode("");
    setMpStatus("");
  };

  const restartSame = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const cfg = engine.config;
    launch(cfg);
  };

  // -- weapon wheel toggle (Tab) --------------------------------------------
  useEffect(() => {
    if (screen !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setShowScoreboard(true);
      }
      if (e.key.toLowerCase() === "b") setShowWeaponWheel((v) => !v);
      if (e.key.toLowerCase() === "m") setSettings((s) => ({ ...s })); // no-op placeholder for map key
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Tab") setShowScoreboard(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [screen]);

  const inMatch = screen === "playing";
  const playing = phase === "playing";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden select-none" style={{ background: "#05070a" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ display: inMatch ? "block" : "none", cursor: playing ? "none" : "default" }}
        onClick={() => engineRef.current?.requestPointer()}
      />

      {/* ============================ TOP BAR (always) ============================ */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link href="/" className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/80 hover:text-white" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            saleh.im
          </Link>
          <span className="glass rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>▲ Vanguard</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {inMatch && (
            <button
              onClick={() => (phase === "playing" ? engineRef.current?.pause() : engineRef.current?.resumeFromPause())}
              className="glass grid h-9 w-9 place-items-center rounded-full text-white"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              aria-label="Pause"
            >
              {phase === "playing" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
          )}
          {!inMatch && <ThemePicker />}
        </div>
      </header>

      {/* ============================ MAIN MENU ============================ */}
      {screen === "main" && (
        <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto p-5" style={{ background: "radial-gradient(circle at 50% 20%, #12213a, #05070a 70%)" }}>
          <div className="w-full max-w-lg py-16 text-center">
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl text-4xl text-black" style={{ background: "linear-gradient(135deg,#fbbf24,#f97316)", boxShadow: "0 14px 40px -10px rgba(249,115,22,0.6)" }}>▲</div>
            <h1 className="display text-5xl text-white sm:text-6xl">Vanguard</h1>
            <p className="mx-auto mt-3 max-w-md text-white/60">A first-person shooter that lives entirely in your browser — faster movement, detailed weapon models, an undead horde alongside armed soldiers, ten maps, an eight-mission campaign, skirmish vs bots, and true peer-to-peer online play with no server in between.</p>
            <div className="mt-8 grid gap-2.5">
              <button onClick={() => setScreen("campaign")} className="btn btn-accent halo w-full text-base">Campaign — 8 missions</button>
              <button onClick={() => setScreen("skirmish")} className="btn btn-outline w-full border-white/20 text-white">Skirmish vs Bots</button>
              <button onClick={() => setScreen("multiplayer")} className="btn btn-outline w-full border-white/20 text-white">Online — Peer to Peer</button>
              <button onClick={() => setScreen("settings")} className="btn btn-outline w-full border-white/20 text-white/70">Settings</button>
            </div>
            <div className="mt-8 grid grid-cols-4 gap-2 text-left text-[11px] text-white/50">
              <div className="rounded-lg border border-white/10 p-2">WASD — move</div>
              <div className="rounded-lg border border-white/10 p-2">Mouse — aim/fire</div>
              <div className="rounded-lg border border-white/10 p-2">R — reload</div>
              <div className="rounded-lg border border-white/10 p-2">1-9 / Q — weapons</div>
            </div>
          </div>
        </div>
      )}

      {/* ============================ CAMPAIGN SELECT ============================ */}
      {screen === "campaign" && (
        <div className="absolute inset-0 z-20 overflow-y-auto p-5 pt-24" style={{ background: "radial-gradient(circle at 50% 0%, #12213a, #05070a 70%)" }}>
          <div className="mx-auto max-w-3xl">
            <button onClick={() => setScreen("main")} className="mb-4 text-sm text-white/60 hover:text-white">← Back</button>
            <h2 className="display text-3xl text-white">Campaign</h2>
            <p className="mt-1 text-sm text-white/50">Eight sequential missions of escalating difficulty. Complete one to unlock the next and earn a new weapon.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {MISSIONS.map((m, i) => {
                const unlocked = isUnlocked(i);
                return (
                  <button
                    key={m.id}
                    disabled={!unlocked}
                    onClick={() => setSelMission(m)}
                    className="sheen glow-border rounded-2xl border p-4 text-left transition-all disabled:opacity-40"
                    style={{ borderColor: selMission.id === m.id ? "#fbbf24" : "rgba(255,255,255,0.12)", background: selMission.id === m.id ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.03)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{i + 1}. {m.name}</span>
                      {!unlocked && <span className="text-xs">🔒</span>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">{m.briefing}</p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-white/40">
                      <span className="rounded-full bg-white/10 px-2 py-0.5">{m.objective}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5">{DIFFICULTIES.find((d) => d.id === m.difficulty)?.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="sticky bottom-5 mt-6 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{selMission.name}</div>
                  <div className="text-xs text-white/50">Reward: {selMission.reward}</div>
                </div>
                <button disabled={!isUnlocked(MISSIONS.indexOf(selMission))} onClick={() => startCampaign(selMission)} className="btn btn-accent halo shrink-0 disabled:opacity-40">Deploy →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================ SKIRMISH SETUP ============================ */}
      {screen === "skirmish" && (
        <div className="absolute inset-0 z-20 overflow-y-auto p-5 pt-24" style={{ background: "radial-gradient(circle at 50% 0%, #12213a, #05070a 70%)" }}>
          <div className="mx-auto max-w-3xl pb-10">
            <button onClick={() => setScreen("main")} className="mb-4 text-sm text-white/60 hover:text-white">← Back</button>
            <h2 className="display text-3xl text-white">Skirmish vs Bots</h2>
            <p className="mt-1 text-sm text-white/50">Free-for-all or team deathmatch against AI opponents. Toggle auto-play to watch — or let the bot brain pilot you.</p>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {(["ffa", "tdm", "campaign"] as GameMode[]).filter((m) => m !== "campaign").map((m) => (
                <button key={m} onClick={() => setSelMode(m)} className="rounded-xl border px-4 py-3 text-sm font-semibold text-white transition-all" style={{ borderColor: selMode === m ? "#fbbf24" : "rgba(255,255,255,0.12)", background: selMode === m ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.03)" }}>
                  {m === "ffa" ? "Free-for-all" : "Team Deathmatch"}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Map</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {MAPS.map((m) => (
                  <MapCard key={m.id} map={m} selected={selMapId === m.id} onSelect={() => setSelMapId(m.id)} />
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/40">
                  <span>Bot count</span><span className="mono text-white/70">{selBots}</span>
                </div>
                <input type="range" min={1} max={15} value={selBots} onChange={(e) => setSelBots(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/40">
                  <span>Score limit</span><span className="mono text-white/70">{selScoreLimit}</span>
                </div>
                <input type="range" min={10} max={100} step={5} value={selScoreLimit} onChange={(e) => setSelScoreLimit(Number(e.target.value))} className="w-full" />
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Bot difficulty</div>
              <DifficultyPicker value={selDifficulty} onChange={setSelDifficulty} />
            </div>

            <label className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white">
              <input type="checkbox" checked={selAutoPlay} onChange={(e) => setSelAutoPlay(e.target.checked)} className="h-4 w-4" />
              <span>
                <b>Auto-play</b>
                <span className="block text-xs text-white/50">The bot brain pilots your slot too — sit back and watch, or take over any time by moving the mouse.</span>
              </span>
            </label>

            <label className="mt-3 flex items-center gap-3 rounded-xl border p-4 text-sm text-white" style={{ borderColor: selMode === "tdm" ? "rgba(255,255,255,0.06)" : "rgba(220,38,38,0.4)", background: selMode === "tdm" ? "rgba(255,255,255,0.03)" : "rgba(220,38,38,0.08)", opacity: selMode === "tdm" ? 0.5 : 1 }}>
              <input type="checkbox" disabled={selMode === "tdm"} checked={selUndead && selMode !== "tdm"} onChange={(e) => setSelUndead(e.target.checked)} className="h-4 w-4" />
              <span>
                <b>🧟 Undead horde</b>
                <span className="block text-xs text-white/50">Replace the armed soldiers with a relentless swarm of fast, melee zombies. {selMode === "tdm" ? "(Free-for-all only.)" : "Otherwise you face a mix of soldiers and undead."}</span>
              </span>
            </label>

            <button onClick={startSkirmish} className="btn btn-accent halo mt-8 w-full text-base">Deploy →</button>
          </div>
        </div>
      )}

      {/* ============================ MULTIPLAYER ============================ */}
      {screen === "multiplayer" && (
        <div className="absolute inset-0 z-20 overflow-y-auto p-5 pt-24" style={{ background: "radial-gradient(circle at 50% 0%, #12213a, #05070a 70%)" }}>
          <div className="mx-auto max-w-xl pb-10">
            <button onClick={() => setScreen("main")} className="mb-4 text-sm text-white/60 hover:text-white">← Back</button>
            <h2 className="display text-3xl text-white">Online — Peer to Peer</h2>
            <p className="mt-1 text-sm text-white/50">A signaling handshake finds the other player; all gameplay then flows directly between browsers over WebRTC — there is no relay/game server in the middle.</p>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button onClick={() => setMpMode("host")} className="rounded-xl border px-4 py-3 text-sm font-semibold text-white" style={{ borderColor: mpMode === "host" ? "#fbbf24" : "rgba(255,255,255,0.12)", background: mpMode === "host" ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.03)" }}>Host a match</button>
              <button onClick={() => setMpMode("join")} className="rounded-xl border px-4 py-3 text-sm font-semibold text-white" style={{ borderColor: mpMode === "join" ? "#fbbf24" : "rgba(255,255,255,0.12)", background: mpMode === "join" ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.03)" }}>Join a match</button>
            </div>

            {mpMode === "host" ? (
              <div className="mt-6 space-y-4">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Map</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {MAPS.slice(0, 4).map((m) => (
                      <MapCard key={m.id} map={m} selected={selMapId === m.id} onSelect={() => setSelMapId(m.id)} />
                    ))}
                  </div>
                </div>
                {!roomCode ? (
                  <button onClick={hostOnline} className="btn btn-accent halo w-full text-base">Open room →</button>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                    <div className="text-xs uppercase tracking-widest text-white/40">Share this code</div>
                    <div className="mono mt-2 text-3xl font-bold text-[#fbbf24]">{roomCode}</div>
                    <div className="mt-3 text-xs text-white/50">{mpPeers.length} peer(s) connected</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FOX-1234"
                  className="mono w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-lg text-white outline-none focus:border-[#fbbf24]"
                />
                <button onClick={joinOnline} className="btn btn-accent halo w-full text-base">Connect →</button>
                {ping !== null && <div className="text-center text-xs text-white/50">Ping: {ping}ms</div>}
              </div>
            )}
            {mpStatus && <p className="mt-4 text-center text-sm text-white/60">{mpStatus}</p>}
          </div>
        </div>
      )}

      {/* ============================ SETTINGS ============================ */}
      {screen === "settings" && (
        <div className="absolute inset-0 z-20 overflow-y-auto p-5 pt-24" style={{ background: "radial-gradient(circle at 50% 0%, #12213a, #05070a 70%)" }}>
          <div className="mx-auto max-w-md pb-10">
            <button onClick={() => setScreen("main")} className="mb-4 text-sm text-white/60 hover:text-white">← Back</button>
            <h2 className="display text-3xl text-white">Settings</h2>
            <div className="mt-6 space-y-5">
              {([
                ["Mouse sensitivity", "sensitivity", 0.2, 3],
                ["Master volume", "masterVolume", 0, 1],
                ["Sound effects", "sfxVolume", 0, 1],
                ["Music", "musicVolume", 0, 1],
              ] as [string, keyof StoredSettings, number, number][]).map(([label, key, min, max]) => (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-white/40">
                    <span>{label}</span><span className="mono text-white/70">{(settings[key] as number).toFixed(2)}</span>
                  </div>
                  <input type="range" min={min} max={max} step={0.05} value={settings[key] as number} onChange={(e) => setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))} className="w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================ COUNTDOWN OVERLAY ============================ */}
      {inMatch && phase === "countdown" && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
          <span className="display text-8xl text-white" style={{ textShadow: "0 0 40px rgba(251,191,36,0.6)" }}>{hud.countdown}</span>
        </div>
      )}

      {/* ============================ IN-MATCH HUD ============================ */}
      {inMatch && playing && (
        <>
          {/* top objective / timer strip */}
          <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex flex-col items-center gap-1">
            {hud.objective && (
              <div className="glass rounded-full px-4 py-1.5 text-xs text-white" style={{ border: "1px solid rgba(255,255,255,0.14)" }}>
                {hud.objective}
                <span className="ms-2 inline-block h-1.5 w-24 overflow-hidden rounded-full align-middle" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${hud.objectiveProgress * 100}%`, background: "#fbbf24" }} />
                </span>
              </div>
            )}
            {hud.timeLeftSec > 0 && <div className="mono glass rounded-full px-3 py-1 text-[11px] text-white/70">{Math.floor(hud.timeLeftSec / 60)}:{String(hud.timeLeftSec % 60).padStart(2, "0")}</div>}
            {(hud.redScore > 0 || hud.blueScore > 0) && (
              <div className="mono flex gap-2 text-xs">
                <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-red-300">RED {hud.redScore}</span>
                <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-sky-300">BLUE {hud.blueScore}</span>
              </div>
            )}
          </div>

          {/* banner */}
          {hud.bannerText && (
            <div className="pointer-events-none absolute inset-x-0 top-[30%] z-20 text-center">
              <span className="display text-4xl text-white" style={{ textShadow: "0 0 24px rgba(0,0,0,0.6)" }}>{hud.bannerText}</span>
            </div>
          )}

          {/* kill feed */}
          <div className="pointer-events-none absolute right-3 top-24 z-20 flex flex-col items-end gap-1 sm:right-4">
            {hud.killFeed.map((k) => (
              <div key={k.id} className="glass rounded-lg px-2.5 py-1 text-[11px] text-white" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ color: k.killerTeam === 0 ? "#7dd3fc" : "#fca5a5" }}>{k.killer}</span>
                <span className="mx-1.5 text-white/50">{k.headshot ? "☆" : "✕"} {k.weapon}</span>
                <span style={{ color: k.victimTeam === 0 ? "#7dd3fc" : "#fca5a5" }}>{k.victim}</span>
              </div>
            ))}
          </div>

          {/* crosshair */}
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
            <div className="relative h-10 w-10">
              {[0, 90, 180, 270].map((deg) => (
                <span
                  key={deg}
                  className="absolute left-1/2 top-1/2 h-3 w-[2px] -translate-x-1/2 rounded-full bg-white/85"
                  style={{ transform: `translate(-50%, ${-6 - hud.crosshairSpread * 90}px) rotate(${deg}deg)`, transformOrigin: "50% 26px" }}
                />
              ))}
              {hud.hitMarker > 0 && (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-bold text-[#fbbf24]" style={{ opacity: hud.hitMarker }}>✕</span>
              )}
            </div>
          </div>

          {/* minimap */}
          <div className="pointer-events-none absolute right-3 top-3 z-20 h-32 w-32 overflow-hidden rounded-xl border border-white/15 bg-black/50 sm:h-36 sm:w-36">
            <svg viewBox={`0 0 ${engineRef.current?.map.width ?? 40} ${engineRef.current?.map.height ?? 40}`} className="h-full w-full">
              {engineRef.current?.map.grid.map((row, y) => row.map((cell, x) => (cell > 0 ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="rgba(255,255,255,0.25)" /> : null)))}
              {hud.minimapActors.filter((m) => m.alive).map((m, i) => (
                <circle key={i} cx={m.x} cy={m.y} r={m.isLocal ? 1.3 : 1} fill={m.isLocal ? "#fbbf24" : m.team === 0 ? "#38bdf8" : "#f87171"} />
              ))}
            </svg>
          </div>

          {/* bottom-left health/armor */}
          <div className="pointer-events-none absolute bottom-4 left-3 z-20 flex flex-col gap-1.5 sm:left-4">
            <StatBar value={hud.health} max={hud.maxHealth} color={hud.lowHealth ? "#f87171" : "#4ade80"} icon="♥" />
            <StatBar value={hud.armor} max={100} color="#60a5fa" icon="◈" />
          </div>

          {/* bottom-right weapon/ammo */}
          <div className="pointer-events-none absolute bottom-4 right-3 z-20 text-right sm:right-4">
            <div className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2" style={{ border: "1px solid rgba(255,255,255,0.14)" }}>
              <span className="text-lg">{hud.weaponIcon}</span>
              <span>
                <span className="block text-xs font-semibold text-white">{hud.weaponName}</span>
                <span className="mono block text-sm text-white/70">{hud.reloading ? "reloading…" : `${hud.ammoInMag} / ${hud.ammoReserve}`}</span>
              </span>
            </div>
          </div>

          {/* damage flash */}
          {hud.damageFlash > 0 && (
            <div className="pointer-events-none absolute inset-0 z-10" style={{ boxShadow: `inset 0 0 160px rgba(220,30,30,${0.5 * hud.damageFlash})` }} />
          )}

          {/* weapon wheel (B) */}
          {showWeaponWheel && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-black/60" onClick={() => setShowWeaponWheel(false)}>
              <div className="grid max-w-lg grid-cols-4 gap-2 p-6" onClick={(e) => e.stopPropagation()}>
                {WEAPONS.filter((w) => w.category !== "melee").map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      engineRef.current?.selectWeapon(w.id);
                      setShowWeaponWheel(false);
                    }}
                    className="flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-white/5 p-3 text-white hover:border-[#fbbf24]"
                  >
                    <span className="text-2xl">{w.icon}</span>
                    <span className="text-[11px] font-semibold">{w.name}</span>
                    <span className="mono text-[9px] text-white/50">{w.category}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* scoreboard (Tab hold) */}
          {showScoreboard && (
            <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/50">
              <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/80 p-4">
                <div className="mb-2 grid grid-cols-4 text-[10px] uppercase tracking-widest text-white/40">
                  <span>Player</span><span className="text-right">K</span><span className="text-right">D</span><span className="text-right">Score</span>
                </div>
                {hud.scoreboard.map((s) => (
                  <div key={s.id} className="grid grid-cols-4 py-1 text-sm text-white">
                    <span style={{ color: s.isLocal ? "#fbbf24" : s.team === 0 ? "#7dd3fc" : "#fca5a5" }}>{s.name}{s.isBot ? " 🤖" : ""}</span>
                    <span className="text-right">{s.kills}</span>
                    <span className="text-right">{s.deaths}</span>
                    <span className="text-right">{s.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================ PAUSE ============================ */}
      {inMatch && phase === "roundover" && !matchOver && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-5">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b0f16] p-8 text-center">
            <h2 className="display text-3xl text-white">Paused</h2>
            <div className="mt-6 grid gap-2">
              <button onClick={() => engineRef.current?.resumeFromPause()} className="btn btn-accent halo">Resume</button>
              <button
                onClick={() => {
                  const on = !engineRef.current?.config.autoPlay;
                  engineRef.current?.setAutoPlay(on);
                }}
                className="btn btn-outline border-white/20 text-white"
              >
                Toggle auto-play
              </button>
              <button onClick={backToMenu} className="btn btn-outline border-white/20 text-white/70">Exit to menu</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================ MATCH OVER ============================ */}
      {inMatch && matchOver && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/75 p-5">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0b0f16] p-8 text-center">
            <h2 className="display gradient-text text-4xl">{matchOver.winner === null ? "Match Complete" : "Victory"}</h2>
            <p className="mt-2 text-white/60">MVP: {matchOver.mvp}</p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[["Kills", hud.scoreboard.find((s) => s.isLocal)?.kills ?? 0], ["Deaths", hud.scoreboard.find((s) => s.isLocal)?.deaths ?? 0], ["Score", hud.localScore]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="font-display text-2xl text-white">{v}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-white/40">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-7 grid gap-2">
              <button onClick={restartSame} className="btn btn-accent halo">Play again</button>
              <button onClick={backToMenu} className="btn btn-outline border-white/20 text-white">Back to menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
