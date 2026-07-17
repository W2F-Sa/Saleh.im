// ============================================================================
//  Rift — a neon arena survival game engine (Canvas 2D).
//
//  Action + strategy + adventure: pick a hero and a weapon archetype, pilot
//  a ship that auto-fires at the nearest threat, defend the central Core,
//  survive escalating waves across five sectors — each stocked with a wider
//  roster of enemy behaviours (shielded frontals, splitters, snipers,
//  summoners, phantoms, berserkers...) — spend salvage between waves on a
//  deep upgrade pool or a weapon swap, trigger up to two active abilities on
//  cooldown, deploy sentry turrets, and topple one of five unique bosses at
//  the end of every sector. A small meta layer (achievements, difficulty
//  modes, hero/weapon unlocks) lives in meta.ts/heroes.ts/weapons.ts and is
//  read by the page component; this engine only reports the stats it needs.
//
//  The engine is framework-agnostic: give it a <canvas> and a few callbacks.
//  It runs a smooth, delta-timed game loop, reads the site's theme colours so
//  it matches whichever palette is active, and cleans itself up on destroy.
// ============================================================================

import { AbilityId, abilityById } from "./abilities";
import { RiftAudio } from "./audio";
import { ModifierDef, combineModifiers } from "./challenges";
import { BossDef, BossIntent, BossKind, EnemyKind, bossForSector, bossIntent, enemyDef, pickWeightedKind, spawnTableForSector } from "./enemies";
import { HeroDef, heroById } from "./heroes";
import { DifficultyDef, DifficultyId, difficultyById } from "./meta";
import { WeaponDef, WeaponKind, chainLaserRampMultiplier, weaponById } from "./weapons";

export type GameState = "menu" | "playing" | "paused" | "shop" | "gameover" | "won";

export interface AbilityHudSlot {
  id: AbilityId | null;
  name: string;
  icon: string;
  color: string;
  cooldownFrac: number; // 0 = ready, 1 = just used
  activeFrac: number;   // 0 = inactive, >0 while an active effect is running
  ready: boolean;
}

export interface BossHud {
  visible: boolean;
  name: string;
  title: string;
  hp: number;
  hpMax: number;
  phase: number;
  phases: number;
  shieldActive: boolean;
  color: string;
}

export interface Hud {
  state: GameState;
  wave: number;
  sector: number;
  gold: number;
  score: number;
  hp: number;
  hpMax: number;
  shield: number;
  coreHp: number;
  coreHpMax: number;
  enemiesAlive: number;
  waveProgress: number; // 0..1
  level: number;
  xp: number;
  xpNext: number;
  kills: number;
  banner: string;
  heroName: string;
  heroIcon: string;
  heroColor: string;
  weaponName: string;
  weaponIcon: string;
  abilities: [AbilityHudSlot, AbilityHudSlot];
  boss: BossHud;
  difficulty: DifficultyId;
  toast: string; // achievement / notable-event toast text
  combo: number;
  comboFrac: number; // 0..1 fraction of the combo window remaining, for a decay bar
  modifierIcons: string[]; // icons of active daily-challenge modifiers, if any
  dps: number; // rolling damage-per-second dealt by the hero, over the last few seconds
}

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  tier: "common" | "rare" | "epic";
  baseCost: number;
  max: number;
}

export interface RunConfig {
  heroId: string;
  weaponId: WeaponKind;
  difficultyId: DifficultyId;
  abilities: [AbilityId | null, AbilityId | null];
  modifiers?: ModifierDef[]; // active daily-challenge modifiers, if any
  prestige?: boolean; // if true, a win doesn't end the run — it continues into an endless sector 6+
  practice?: boolean; // if true, the Core/hero can't actually die — for learning boss patterns risk-free
}

export interface RunResult {
  won: boolean;
  score: number;
  kills: number;
  bossKills: number;
  critKills: number;
  goldEarned: number;
  sectorReached: number;
  levelReached: number;
  bestCombo: number;
  practice: boolean;
}

type Vec = { x: number; y: number };

interface Bullet extends Vec {
  vx: number; vy: number; dmg: number; life: number; pierce: number;
  from: "hero" | "sentry" | "missile"; r: number; crit: boolean; hit: Set<number>;
  homing?: boolean; targetId?: number; color?: string;
}
interface EBullet extends Vec { vx: number; vy: number; dmg: number; life: number; r: number; color?: string }
interface Enemy extends Vec {
  id: number; hp: number; hpMax: number; r: number; speed: number; dmg: number; gold: number;
  kind: EnemyKind; color: string; score: number; fireCd: number; hitFlash: number; ang: number;
  shieldFacing?: number;      // "shielded" — angle (radians) the frontal shield faces
  splitOnDeath?: boolean;     // "splitter"
  summonCd?: number;          // "summoner"
  blinkCd?: number;           // "phantom"
  telegraph?: number;         // "sniper" — >0 while winding up a shot
  rageMult?: number;          // "berserker" — grows as hp drops
  isAdd?: boolean;            // spawned by a boss/summoner rather than the wave queue
  planted?: boolean;          // "turret" — stops moving once true
  cloakLevel?: number;        // "cloaker" — 0 = fully visible, 1 = fully cloaked
  cloakDashCd?: number;       // "cloaker" — cooldown before its next dash
  armorPlate?: number;        // "juggernaut" — flat damage reduction per hit, in percent (0..1)
  elite?: boolean;            // "Elite Escorts" challenge modifier — buffed variant with a gold ring
}
interface Boss extends Vec {
  kind: BossKind;
  def: BossDef;
  hp: number; hpMax: number; r: number; speed: number; dmg: number; ang: number;
  phase: number; elapsed: number; intentCd: number; shieldLeft: number; dashCd: number;
  dashTx: number; dashTy: number; hitFlash: number;
}
interface Sentry extends Vec { cd: number; interval: number; dmg: number; range: number; ang: number; life: number }
interface Orbital { angle: number; dist: number; cd: number }
interface Particle extends Vec { vx: number; vy: number; life: number; maxLife: number; r: number; color: string; text?: string; kind: "spark" | "ring" | "text" | "smoke" | "beam" }
interface Pickup extends Vec { vx: number; vy: number; value: number; life: number; kind: "gold" | "heal" }

const WAVES_PER_SECTOR = 6;
const SECTORS = 5;
const ABILITY_KEYS = ["1", "2"] as const;

export const UPGRADES: UpgradeDef[] = [
  { id: "damage", name: "Overcharge", desc: "+25% projectile damage", icon: "⚔", tier: "common", baseCost: 40, max: 12 },
  { id: "firerate", name: "Rapid Coils", desc: "+18% fire rate", icon: "⚡", tier: "common", baseCost: 45, max: 12 },
  { id: "speed", name: "Thrusters", desc: "+12% move speed", icon: "🚀", tier: "common", baseCost: 35, max: 8 },
  { id: "maxhp", name: "Plating", desc: "+25 max HP & full heal", icon: "🛡", tier: "common", baseCost: 50, max: 10 },
  { id: "multishot", name: "Split Barrel", desc: "+1 projectile", icon: "🔱", tier: "rare", baseCost: 120, max: 6 },
  { id: "pierce", name: "Rail Rounds", desc: "Shots pierce +1 enemy", icon: "➹", tier: "rare", baseCost: 90, max: 6 },
  { id: "crit", name: "Focus Lens", desc: "+8% critical chance", icon: "🎯", tier: "rare", baseCost: 80, max: 8 },
  { id: "core", name: "Core Shield", desc: "+120 Core HP & repair", icon: "◈", tier: "common", baseCost: 55, max: 12 },
  { id: "sentry", name: "Deploy Sentry", desc: "An auto-turret guards the Core", icon: "🗼", tier: "epic", baseCost: 150, max: 6 },
  { id: "magnet", name: "Salvage Magnet", desc: "+40% pickup range", icon: "🧲", tier: "common", baseCost: 40, max: 6 },
  { id: "regen", name: "Nanoweave", desc: "Regenerate +1.5 HP/s", icon: "✚", tier: "rare", baseCost: 100, max: 6 },
  { id: "lifesteal", name: "Siphon", desc: "Heal 4% of damage dealt", icon: "🩸", tier: "epic", baseCost: 160, max: 4 },
  { id: "bulletspeed", name: "Accelerator", desc: "+20% projectile speed", icon: "💨", tier: "common", baseCost: 30, max: 6 },
  { id: "haste", name: "Ability Capacitor", desc: "-12% ability cooldowns", icon: "⏱", tier: "rare", baseCost: 110, max: 6 },
  { id: "shieldcap", name: "Barrier Cell", desc: "+40 max personal shield", icon: "◇", tier: "epic", baseCost: 140, max: 5 },
  { id: "goldgain", name: "Salvage Rig", desc: "+15% gold from all sources", icon: "🪙", tier: "common", baseCost: 45, max: 8 },
];

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function dist2(a: Vec, b: Vec) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
function normAngle(a: number) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

export class RiftGame {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  state: GameState = "menu";
  private onHud: (h: Hud) => void;
  private onState: (s: GameState) => void;
  private onRunEnd?: (r: RunResult) => void;
  private onToast?: (text: string) => void;

  private audio = new RiftAudio();

  // theme colours
  private col = { accent: "#b9ff3a", accent2: "#67e8f9", bg: "#0b0c0e", fg: "#eef1f4", line: "rgba(255,255,255,.09)" };

  // run configuration
  private hero: HeroDef = heroById("vanguard");
  private weapon: WeaponDef = weaponById("blaster");
  private difficulty: DifficultyDef = difficultyById("veteran");
  private abilitySlots: [AbilityId | null, AbilityId | null] = [null, null];
  private abilityCd: [number, number] = [0, 0];
  private abilityActive: [number, number] = [0, 0];

  // player
  private p = {
    x: 0, y: 0, vx: 0, vy: 0, r: 15, hp: 100, hpMax: 100, shield: 0, shieldMax: 0,
    speed: 265, dmg: 16, fireInt: 0.42, fireCd: 0, projectiles: 1, pierce: 0, crit: 0.05,
    critMult: 2.2, range: 480, magnet: 95, regen: 0, lifesteal: 0, bulletSpeed: 560, aim: 0,
    invuln: 0, adrenalineHeat: 0, chainTargetId: -1, chainTime: 0, overdriveLeft: 0, goldGainMult: 1,
  };
  private core = { x: 0, y: 0, r: 34, hp: 400, hpMax: 400, pulse: 0 };
  private orbitals: Orbital[] = [];

  private bullets: Bullet[] = [];
  private ebullets: EBullet[] = [];
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private sentries: Sentry[] = [];
  private tempTurrets: Sentry[] = [];
  private particles: Particle[] = [];
  private pickups: Pickup[] = [];
  private enemyId = 0;

  // progression
  gold = 0;
  score = 0;
  kills = 0;
  bossKills = 0;
  critKills = 0;
  goldEarned = 0;
  level = 1;
  private xp = 0;
  private xpNext = 60;
  wave = 0;
  sector = 1;
  private spawnQueue: EnemyKind[] = [];
  private spawnTimer = 0;
  private spawnEvery = 0.7;
  private waveEnemies = 0;
  private banner = "";
  private bannerT = 0;
  private toast = "";
  private toastT = 0;
  private shake = 0;
  private upLevels: Record<string, number> = {};
  private timeSlowLeft = 0; // Time Dilation ability effect

  // kill combo / streak: consecutive kills within a short window multiply score
  private combo = 0;
  private comboTimer = 0;
  private bestCombo = 0;
  private static readonly COMBO_WINDOW = 2.2;

  // active daily-challenge modifiers for this run, pre-combined into multipliers
  private modifiers: ModifierDef[] = [];
  private modMult = combineModifiers([]);

  // prestige / endless mode: past sector 5, the Rift keeps generating sectors
  // with the Eclipse boss and ever-scaling stats instead of ending the run
  private prestige = false;
  private bossDefeatedThisWave = false;

  // practice mode: the hero and Core are kept from ever actually dying, so a
  // player can learn a boss's attack pattern (or a tough wave composition)
  // without it costing a real run. Progress/achievements still don't record
  // for practice runs — this is purely a learning sandbox.
  private practiceMode = false;

  // rolling DPS meter: a short log of (timestamp, damage) pairs dealt by the
  // hero (not sentries/turrets), summed over a trailing window for the HUD.
  private damageLog: { t: number; dmg: number }[] = [];
  private static readonly DPS_WINDOW = 3;
  private runClock = 0;

  private logHeroDamage(dmg: number) {
    this.damageLog.push({ t: this.runClock, dmg });
    const cutoff = this.runClock - RiftGame.DPS_WINDOW;
    while (this.damageLog.length && this.damageLog[0].t < cutoff) this.damageLog.shift();
  }

  private currentDps(): number {
    if (!this.damageLog.length) return 0;
    const span = Math.min(RiftGame.DPS_WINDOW, this.runClock - this.damageLog[0].t) || RiftGame.DPS_WINDOW;
    const total = this.damageLog.reduce((s, e) => s + e.dmg, 0);
    return total / Math.max(0.5, span);
  }

  // input
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0, down: false, active: false };
  private hudAcc = 0;

  constructor(canvas: HTMLCanvasElement, opts: { onHud: (h: Hud) => void; onState: (s: GameState) => void; onRunEnd?: (r: RunResult) => void; onToast?: (text: string) => void }) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.onHud = opts.onHud;
    this.onState = opts.onState;
    this.onRunEnd = opts.onRunEnd;
    this.onToast = opts.onToast;
    this.readTheme();
    this.resize();
    this.bindInput();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // -- audio passthroughs used by the settings panel -----------------------
  setSoundOn(on: boolean) { this.audio.setEnabled(on); }
  setMusicOn(on: boolean) { this.audio.setMusicEnabled(on); if (on && this.state === "playing") this.audio.startMusic(); }
  setMasterVolume(v: number) { this.audio.setMaster(v); }
  setSfxVolume(v: number) { this.audio.setSfx(v); }
  setMusicVolume(v: number) { this.audio.setMusicVolume(v); }

  // -- accessibility --------------------------------------------------------
  // When enabled, every enemy/boss/bullet gets a crisp white outline on top
  // of its usual colour+shape so distinguishing threats never depends on
  // colour perception alone.
  private colorblindMode = false;
  setColorblindMode(on: boolean) { this.colorblindMode = on; }

  private readTheme() {
    try {
      const cs = getComputedStyle(document.documentElement);
      const g = (k: string, f: string) => (cs.getPropertyValue(k).trim() || f);
      this.col = {
        accent: g("--accent", "#b9ff3a"),
        accent2: g("--accent-2", "#67e8f9"),
        bg: g("--bg", "#0b0c0e"),
        fg: g("--fg", "#eef1f4"),
        line: g("--line", "rgba(255,255,255,.09)"),
      };
    } catch {}
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.core.x = this.w / 2;
    this.core.y = this.h / 2;
    if (this.state === "menu") { this.p.x = this.w / 2; this.p.y = this.h / 2 + 90; }
  }

  private bindInput() {
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    this.keys.add(k);
    if (k === "p" && (this.state === "playing" || this.state === "paused")) this.togglePause();
    if (this.state === "playing") {
      if (k === ABILITY_KEYS[0]) this.activateAbility(0);
      if (k === ABILITY_KEYS[1]) this.activateAbility(1);
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private ptPos(e: PointerEvent) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  private onPointerDown = (e: PointerEvent) => { const pt = this.ptPos(e); this.pointer.x = pt.x; this.pointer.y = pt.y; this.pointer.down = true; this.pointer.active = true; };
  private onPointerMove = (e: PointerEvent) => { const pt = this.ptPos(e); this.pointer.x = pt.x; this.pointer.y = pt.y; if (this.pointer.down) this.pointer.active = true; };
  private onPointerUp = () => { this.pointer.down = false; };

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.audio.dispose();
  }

  // ---- lifecycle --------------------------------------------------------

  /** Begin a fresh run with the chosen hero/weapon/difficulty/abilities. */
  start(config: RunConfig) {
    this.readTheme();
    this.resize();
    this.audio.init();
    this.hero = heroById(config.heroId);
    this.weapon = weaponById(config.weaponId);
    this.difficulty = difficultyById(config.difficultyId);
    this.abilitySlots = config.abilities;
    this.abilityCd = [0, 0];
    this.abilityActive = [0, 0];
    this.modifiers = config.modifiers ?? [];
    this.modMult = combineModifiers(this.modifiers);
    this.combo = 0; this.comboTimer = 0; this.bestCombo = 0;
    this.prestige = config.prestige ?? false;
    this.practiceMode = config.practice ?? false;
    this.bossDefeatedThisWave = false;
    this.rerollsUsedThisShop = 0;
    this.damageLog = [];
    this.runClock = 0;

    const hpMax = Math.round(100 * this.hero.baseHpMult * this.modMult.playerHpMult);
    this.p = {
      x: this.w / 2, y: this.h / 2 + 90, vx: 0, vy: 0, r: 15, hp: hpMax, hpMax,
      shield: 0, shieldMax: 0, speed: 265 * this.hero.baseSpeedMult, dmg: 16 * this.hero.baseDmgMult * this.modMult.playerDmgMult,
      fireInt: 0.42 * this.hero.baseFireRateMult * this.modMult.fireRateMult, fireCd: 0, projectiles: 1, pierce: 0, crit: 0.05,
      critMult: 2.2, range: 480, magnet: 95, regen: 0, lifesteal: 0, bulletSpeed: 560, aim: 0, invuln: 0,
      adrenalineHeat: 0, chainTargetId: -1, chainTime: 0, overdriveLeft: 0,
      goldGainMult: (this.hero.passive === "salvageHound" ? 1.35 : 1) * this.modMult.goldMult,
    };
    this.core = { x: this.w / 2, y: this.h / 2, r: 34, hp: 400, hpMax: 400, pulse: 0 };
    this.orbitals = this.weapon.id === "orbitals" ? [{ angle: 0, dist: 60, cd: 0 }, { angle: Math.PI, dist: 60, cd: 0 }] : [];
    this.bullets = []; this.ebullets = []; this.enemies = []; this.boss = null;
    this.sentries = []; this.tempTurrets = []; this.particles = []; this.pickups = [];
    this.gold = 0; this.score = 0; this.kills = 0; this.bossKills = 0; this.critKills = 0; this.goldEarned = 0;
    this.level = 1; this.xp = 0; this.xpNext = 60;
    this.wave = 0; this.sector = 1; this.upLevels = {};
    this.timeSlowLeft = 0;
    this.setState("playing");
    this.nextWave();
    this.audio.startMusic();
  }

  restart(config?: RunConfig) {
    this.start(config ?? { heroId: this.hero.id, weaponId: this.weapon.id, difficultyId: this.difficulty.id, abilities: this.abilitySlots });
  }

  togglePause() { if (this.state === "playing") this.setState("paused"); else if (this.state === "paused") { this.setState("playing"); this.last = performance.now(); } }
  resumeFromShop() { if (this.state === "shop") { this.setState("playing"); this.last = performance.now(); this.nextWave(); } }

  private setState(s: GameState) { this.state = s; this.onState(s); this.pushHud(); }

  // ---- abilities ----------------------------------------------------------

  activateAbility(slot: 0 | 1) {
    if (this.state !== "playing") return;
    const id = this.abilitySlots[slot];
    if (!id || this.abilityCd[slot] > 0) return;
    const def = abilityById(id);
    const hasteMult = 1 - (this.upLevels.haste || 0) * 0.12 - (this.hero.passive === "overclock" ? 0.25 : 0);
    this.abilityCd[slot] = def.cooldown * Math.max(0.35, hasteMult);
    this.audio.play("abilityUse");
    switch (id) {
      case "nova": {
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - this.p.x, e.y - this.p.y);
          if (d < 260) {
            this.damageEnemy(e, this.p.dmg * 3.5, false);
            const push = Math.max(0, (260 - d) / 260) * 220;
            const a = Math.atan2(e.y - this.p.y, e.x - this.p.x);
            e.x += Math.cos(a) * push * 0.12;
            e.y += Math.sin(a) * push * 0.12;
          }
        }
        if (this.boss && Math.hypot(this.boss.x - this.p.x, this.boss.y - this.p.y) < 260) {
          this.damageBoss(this.p.dmg * 3.5);
        }
        this.spawnParticles(this.p.x, this.p.y, 40, "#ffd84d", "spark", 320);
        this.shake = Math.max(this.shake, 10);
        break;
      }
      case "overdrive":
        this.p.overdriveLeft = 6;
        this.abilityActive[slot] = 6;
        break;
      case "shieldwall":
        if (this.modifiers.some((m) => m.id === "oneLife")) break; // One Life challenge forbids personal shields
        this.p.shield = Math.min(this.p.shieldMax + 120, this.p.shield + 120);
        this.p.shieldMax = Math.max(this.p.shieldMax, 120);
        this.abilityActive[slot] = 8;
        this.audio.play("shieldUp");
        break;
      case "blink": {
        const a = Math.hypot(this.p.vx, this.p.vy) > 1 ? Math.atan2(this.p.vy, this.p.vx) : this.p.aim;
        this.p.x = clamp(this.p.x + Math.cos(a) * 220, this.p.r, this.w - this.p.r);
        this.p.y = clamp(this.p.y + Math.sin(a) * 220, this.p.r, this.h - this.p.r);
        this.p.invuln = Math.max(this.p.invuln, 1);
        this.spawnParticles(this.p.x, this.p.y, 16, "#c084fc", "ring", 120);
        break;
      }
      case "turretStorm": {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          this.tempTurrets.push({ x: this.p.x + Math.cos(a) * 70, y: this.p.y + Math.sin(a) * 70, cd: 0, interval: 0.35, dmg: this.p.dmg * 0.7, range: 380, ang: 0, life: 12 });
        }
        break;
      }
      case "timeDilation":
        this.timeSlowLeft = 5;
        this.abilityActive[slot] = 5;
        break;
    }
  }

  // ---- waves ------------------------------------------------------------

  private nextWave() {
    this.bossDefeatedThisWave = false;
    this.wave++;
    if (this.wave > WAVES_PER_SECTOR) {
      this.wave = 1;
      this.sector++;
      if (this.sector > SECTORS) {
        if (!this.prestige) { this.finishRun(true); return; }
        this.setBanner(`ENDLESS — SECTOR ${this.sector}`, 2.6);
      } else {
        this.setBanner(`SECTOR ${this.sector}`);
      }
    } else {
      this.setBanner(this.wave === WAVES_PER_SECTOR ? "⚠ BOSS INCOMING" : `WAVE ${this.wave}`);
    }
    const s = this.sector, w = this.wave;
    const power = (s - 1) * WAVES_PER_SECTOR + w;
    const q: EnemyKind[] = [];
    if (w === WAVES_PER_SECTOR) {
      const escorts = 4 + s * 2;
      const table = spawnTableForSector(s);
      for (let i = 0; i < escorts; i++) q.push(pickWeightedKind(table));
      this.spawnQueue = q;
      this.waveEnemies = q.length;
      this.spawnEvery = Math.max(0.24, 0.7 - power * 0.02);
      this.spawnTimer = 0.4;
      // the boss itself spawns once the escort queue is drained
      return;
    }
    const n = 6 + power * 2;
    const table = spawnTableForSector(s);
    for (let i = 0; i < n; i++) q.push(pickWeightedKind(table));
    this.spawnQueue = q;
    this.waveEnemies = q.length;
    this.spawnEvery = Math.max(0.22, 0.72 - power * 0.02);
    this.spawnTimer = 0.4;
  }

  private enemyStats(kind: EnemyKind) {
    const def = enemyDef(kind);
    const s = this.sector;
    const scale = (1 + (s - 1) * 0.35 + this.wave * 0.04) * this.difficulty.enemyHpMult * this.modMult.enemyHpMult;
    const dmgScale = this.difficulty.enemyDmgMult * this.modMult.enemyDmgMult;
    const spdScale = this.difficulty.enemySpeedMult * this.modMult.enemySpeedMult;
    return {
      hp: def.baseHp * scale, hpMax: def.baseHp * scale, r: def.radius,
      speed: def.baseSpeed * spdScale, dmg: def.baseDmg * dmgScale,
      gold: def.baseGold, kind, color: def.color, score: def.baseScore,
    };
  }

  private spawnEnemy(kind: EnemyKind, isAdd = false) {
    const st = this.enemyStats(kind);
    const edge = Math.floor(rand(0, 4));
    let x = 0, y = 0;
    if (isAdd) {
      const a = rand(0, Math.PI * 2);
      x = clamp(this.p.x + Math.cos(a) * rand(140, 260), 0, this.w);
      y = clamp(this.p.y + Math.sin(a) * rand(140, 260), 0, this.h);
    } else if (edge === 0) { x = rand(0, this.w); y = -40; }
    else if (edge === 1) { x = this.w + 40; y = rand(0, this.h); }
    else if (edge === 2) { x = rand(0, this.w); y = this.h + 40; }
    else { x = -40; y = rand(0, this.h); }
    const e: Enemy = { ...st, x, y, id: this.enemyId++, fireCd: rand(1, 2.5), hitFlash: 0, ang: 0, isAdd };
    if (kind === "shielded") e.shieldFacing = Math.atan2(this.core.y - y, this.core.x - x);
    if (kind === "splitter") e.splitOnDeath = true;
    if (kind === "summoner") e.summonCd = rand(3, 5);
    if (kind === "phantom") e.blinkCd = rand(1.5, 3);
    if (kind === "sniper") e.telegraph = 0;
    if (kind === "berserker") e.rageMult = 1;
    if (kind === "turret") e.planted = false;
    if (kind === "cloaker") { e.cloakLevel = 0; e.cloakDashCd = rand(1.5, 3); }
    if (kind === "juggernaut") e.armorPlate = 0.3;
    // "Elite Escorts" challenge modifier: a small chance for any regular spawn
    // (never an add) to roll as a tougher, gold-ringed elite variant.
    if (!isAdd && this.modifiers.some((m) => m.id === "miniBosses") && Math.random() < 0.12) {
      e.elite = true;
      e.hp *= 1.8; e.hpMax = e.hp; e.dmg *= 1.4; e.gold *= 2.5; e.score *= 2;
    }
    this.enemies.push(e);
  }

  private spawnBoss() {
    const def = bossForSector(this.sector);
    const scale = this.difficulty.enemyHpMult;
    this.boss = {
      kind: def.kind, def, x: this.w / 2, y: -80, hp: def.baseHp * scale, hpMax: def.baseHp * scale,
      r: def.radius, speed: def.baseSpeed, dmg: def.baseDmg * this.difficulty.enemyDmgMult,
      ang: Math.PI / 2, phase: 1, elapsed: 0, intentCd: 1.2, shieldLeft: 0, dashCd: 0, dashTx: this.w / 2, dashTy: this.h / 2, hitFlash: 0,
    };
    this.setBanner(def.intro, 3.2);
    this.audio.play("bossIntro");
  }

  private setBanner(t: string, dur = 2.2) { this.banner = t; this.bannerT = dur; }
  private setToast(t: string) { this.toast = t; this.toastT = 3.4; this.onToast?.(t); }

  // ---- upgrades ---------------------------------------------------------

  costOf(id: string) { const def = UPGRADES.find((u) => u.id === id)!; const lv = this.upLevels[id] || 0; return Math.round(def.baseCost * Math.pow(1.5, lv)); }
  levelOf(id: string) { return this.upLevels[id] || 0; }
  maxedOf(id: string) { const def = UPGRADES.find((u) => u.id === id)!; return (this.upLevels[id] || 0) >= def.max; }

  buyUpgrade(id: string): boolean {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def || this.maxedOf(id)) return false;
    const cost = this.costOf(id);
    if (this.gold < cost) return false;
    this.gold -= cost;
    this.upLevels[id] = (this.upLevels[id] || 0) + 1;
    this.applyUpgrade(id);
    this.pushHud();
    return true;
  }

  private applyUpgrade(id: string) {
    const p = this.p;
    switch (id) {
      case "damage": p.dmg *= 1.25; break;
      case "firerate": p.fireInt *= 0.82; break;
      case "speed": p.speed *= 1.12; break;
      case "maxhp": p.hpMax += 25; p.hp = p.hpMax; break;
      case "multishot": p.projectiles += 1; break;
      case "pierce": p.pierce += 1; break;
      case "crit": p.crit = Math.min(0.85, p.crit + 0.08); break;
      case "core": this.core.hpMax += 120; this.core.hp = this.core.hpMax; break;
      case "magnet": p.magnet *= 1.4; break;
      case "regen": p.regen += 1.5; break;
      case "lifesteal": p.lifesteal += 0.04; break;
      case "bulletspeed": p.bulletSpeed *= 1.2; break;
      case "shieldcap":
        if (this.modifiers.some((m) => m.id === "oneLife")) break;
        p.shieldMax += 40; p.shield = p.shieldMax;
        break;
      case "goldgain": p.goldGainMult *= 1.15; break;
      case "haste": /* consumed live via upLevels.haste lookups */ break;
      case "sentry": {
        const a = this.sentries.length * (Math.PI * 2 / 6) + 0.4;
        const rr = this.core.r + 46;
        this.sentries.push({ x: this.core.x + Math.cos(a) * rr, y: this.core.y + Math.sin(a) * rr, cd: 0, interval: 0.6, dmg: 12, range: 340, ang: 0, life: Infinity });
        break;
      }
    }
  }

  /** Offer four affordable-ish, non-maxed upgrades for the shop. */
  shopOffer(): string[] {
    const pool = UPGRADES.filter((u) => !this.maxedOf(u.id));
    const weight = (t: string) => (t === "common" ? 3 : t === "rare" ? 2 : 1);
    const bag: string[] = [];
    pool.forEach((u) => { for (let i = 0; i < weight(u.tier); i++) bag.push(u.id); });
    const out: string[] = [];
    while (out.length < 4 && bag.length) {
      const pick = bag[Math.floor(Math.random() * bag.length)];
      if (!out.includes(pick)) out.push(pick);
      if (new Set(bag).size <= out.length) break;
    }
    return out;
  }

  private rerollsUsedThisShop = 0;
  private static readonly MAX_REROLLS_PER_SHOP = 2;

  rerollsLeft(): number {
    return RiftGame.MAX_REROLLS_PER_SHOP - this.rerollsUsedThisShop;
  }

  rerollCost(): number {
    return 25 + this.rerollsUsedThisShop * 20;
  }

  /** Spend gold to reroll the current shop offer — capped per visit so it stays a choice, not a grind. */
  rerollShop(): string[] | null {
    if (this.rerollsUsedThisShop >= RiftGame.MAX_REROLLS_PER_SHOP) return null;
    const cost = this.rerollCost();
    if (this.gold < cost) return null;
    this.gold -= cost;
    this.rerollsUsedThisShop++;
    return this.shopOffer();
  }

  /** Whether the shop should offer a weapon swap this visit (every other sector-end). */
  canSwapWeapon(): boolean {
    return this.wave === 1 && this.sector > 1;
  }
  swapWeapon(id: WeaponKind) {
    this.weapon = weaponById(id);
    this.orbitals = this.weapon.id === "orbitals" ? [{ angle: 0, dist: 60, cd: 0 }, { angle: Math.PI, dist: 60, cd: 0 }] : [];
  }
  currentWeaponId(): WeaponKind { return this.weapon.id; }

  // ---- loop -------------------------------------------------------------

  private loop(t: number) {
    if (!this.last) this.last = t;
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.05) dt = 0.05;
    if (this.state === "playing") this.update(dt);
    else { this.core.pulse += dt; if (this.bannerT > 0) this.bannerT -= dt; }
    this.render();
    this.hudAcc += dt;
    if (this.hudAcc > 0.1) { this.pushHud(); this.hudAcc = 0; }
    this.raf = requestAnimationFrame(this.loop);
  }

  private update(dt: number) {
    const p = this.p;
    this.runClock += dt;
    const slowMult = this.timeSlowLeft > 0 ? 0.4 : 1;
    if (this.timeSlowLeft > 0) this.timeSlowLeft -= dt;

    // ---- ability cooldown/duration ticking ----
    for (let i = 0 as 0 | 1; i < 2; i = (i + 1) as 0 | 1) {
      if (this.abilityCd[i] > 0) this.abilityCd[i] = Math.max(0, this.abilityCd[i] - dt);
      if (this.abilityActive[i] > 0) this.abilityActive[i] = Math.max(0, this.abilityActive[i] - dt);
    }
    if (p.overdriveLeft > 0) p.overdriveLeft = Math.max(0, p.overdriveLeft - dt);

    // ---- input → movement ----
    let mx = 0, my = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) my -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) my += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) mx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) mx += 1;
    if (mx === 0 && my === 0 && this.pointer.down) {
      const dx = this.pointer.x - p.x, dy = this.pointer.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) { mx = dx / d; my = dy / d; }
    } else if (mx || my) { const d = Math.hypot(mx, my); mx /= d; my /= d; }
    const speedMult = (p.overdriveLeft > 0 ? 2 : 1);
    p.vx = mx * p.speed * speedMult; p.vy = my * p.speed * speedMult;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(p.r, Math.min(this.w - p.r, p.x));
    p.y = Math.max(p.r, Math.min(this.h - p.r, p.y));
    if (p.regen > 0 && p.hp < p.hpMax) p.hp = Math.min(p.hpMax, p.hp + p.regen * dt);
    const invulnMult = this.hero.passive === "phaseWalker" ? 1.6 : 1;
    if (p.invuln > 0) p.invuln -= dt;
    this.core.pulse += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.toastT > 0) this.toastT -= dt; else this.toast = "";
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }

    // ---- boss spawn once escort queue is drained on a boss wave ----
    if (this.wave === WAVES_PER_SECTOR && !this.boss && !this.bossDefeatedThisWave && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.spawnBoss();
    }

    // ---- spawning ----
    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnEnemy(this.spawnQueue.shift()!); this.spawnTimer = this.spawnEvery; }
    } else if (this.enemies.length === 0 && !this.boss && this.wave !== WAVES_PER_SECTOR) {
      this.rerollsUsedThisShop = 0;
      this.setState("shop");
      return;
    } else if (this.enemies.length === 0 && this.wave === WAVES_PER_SECTOR && this.bossDefeatedThisWave) {
      // the boss is dead and the arena is clear — move on to the shop/next sector
      this.bossDefeatedThisWave = false;
      this.rerollsUsedThisShop = 0;
      this.setState("shop");
      return;
    }

    // ---- hero auto-fire ----
    this.updateWeaponFire(dt);

    // ---- orbitals (contact damage, no bullets) ----
    if (this.weapon.id === "orbitals") this.updateOrbitals(dt);

    // ---- sentries + temp turrets ----
    this.updateSentries(dt, this.sentries);
    for (let i = this.tempTurrets.length - 1; i >= 0; i--) {
      this.tempTurrets[i].life -= dt;
      if (this.tempTurrets[i].life <= 0) this.tempTurrets.splice(i, 1);
    }
    this.updateSentries(dt, this.tempTurrets);

    // ---- bullets ----
    this.updateBullets(dt);

    // ---- enemies ----
    this.updateEnemies(dt, slowMult);

    // ---- boss ----
    if (this.boss) this.updateBoss(dt, slowMult);

    // ---- enemy bullets ----
    this.updateEnemyBullets(dt, slowMult, invulnMult);

    // ---- pickups ----
    this.updatePickups(dt);

    // ---- particles ----
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92;
      if (q.kind === "text") q.y -= 26 * dt;
      if (q.life <= 0) this.particles.splice(i, 1);
    }
  }

  // -- weapon firing per archetype -----------------------------------------

  private updateWeaponFire(dt: number) {
    const p = this.p;
    if (this.weapon.id === "orbitals") return; // handled by updateOrbitals
    p.fireCd -= dt;
    const target = this.nearestThreat(p.x, p.y, p.range);
    if (!target) { p.adrenalineHeat = Math.max(0, p.adrenalineHeat - dt * 2); return; }

    const overdriveFireMult = p.overdriveLeft > 0 ? 0.5 : 1;
    let fireInt = p.fireInt * this.weapon.baseFireIntMult * overdriveFireMult;
    if (this.hero.passive === "adrenaline") {
      p.adrenalineHeat = Math.min(1, p.adrenalineHeat + dt * 0.35);
      fireInt *= 1 - p.adrenalineHeat * 0.4;
    }

    if (p.fireCd > 0) return;
    p.fireCd = fireInt;

    const baseAng = Math.atan2(target.y - p.y, target.x - p.x);
    p.aim = baseAng;
    const dmgBase = p.dmg * this.weapon.baseDmgMult;

    if (this.weapon.id === "chainlaser") {
      // continuous thin beam: instant hit on the current target, ramping.
      const targetId = "id" in target ? (target as Enemy).id : -2; // -2 = boss sentinel id
      if (p.chainTargetId === targetId) p.chainTime += fireInt; else { p.chainTime = 0; p.chainTargetId = targetId; }
      const ramp = chainLaserRampMultiplier(p.chainTime);
      const dmg = dmgBase * ramp;
      const crit = Math.random() < p.crit;
      const finalDmg = dmg * (crit ? p.critMult : 1);
      if ("id" in target) this.damageEnemy(target as Enemy, finalDmg, crit); else this.damageBoss(finalDmg);
      this.logHeroDamage(finalDmg);
      this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.08, maxLife: 0.08, r: 0, color: this.weapon.color, kind: "beam", text: `${target.x},${target.y}` });
      this.audio.play("laserTick", 0.5);
      return;
    }

    if (this.weapon.id === "missiles") {
      const crit = Math.random() < p.crit;
      const dmg = dmgBase * (crit ? p.critMult : 1);
      this.bullets.push({
        x: p.x, y: p.y, vx: Math.cos(baseAng) * p.bulletSpeed * 0.35, vy: Math.sin(baseAng) * p.bulletSpeed * 0.35,
        dmg, life: 3.5, pierce: 0, from: "missile", r: 6, crit, hit: new Set(),
        homing: true, targetId: "id" in target ? (target as Enemy).id : -2, color: this.weapon.color,
      });
      this.audio.play("missileLaunch", 0.6);
      return;
    }

    // blaster / shotgun / railgun: instantiate `pelletsPerShot` (or projectiles-upgraded) bolts
    const n = Math.max(1, this.weapon.pelletsPerShot) + (p.projectiles - 1);
    const spread = Math.max(this.weapon.spreadRad, n > 1 ? 0.16 : 0);
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * (spread / Math.max(1, n - 1) * 2 || spread);
      const a = baseAng + off;
      const crit = Math.random() < p.crit;
      const dmg = dmgBase * (crit ? p.critMult : 1);
      this.bullets.push({
        x: p.x + Math.cos(a) * p.r, y: p.y + Math.sin(a) * p.r,
        vx: Math.cos(a) * p.bulletSpeed * this.weapon.projectileSpeedMult,
        vy: Math.sin(a) * p.bulletSpeed * this.weapon.projectileSpeedMult,
        dmg, life: 1.4, pierce: p.pierce + this.weapon.pierceBonus, from: "hero",
        r: crit ? 5.5 : 4, crit, hit: new Set(), color: this.weapon.color,
      });
    }
    const sound = this.weapon.id === "shotgun" ? "shotgunBlast" : this.weapon.id === "railgun" ? "railShot" : "shoot";
    this.audio.play(sound, 0.55);
    this.spawnParticles(p.x + Math.cos(baseAng) * p.r, p.y + Math.sin(baseAng) * p.r, 3, this.weapon.color, "spark", 60);
  }

  private updateOrbitals(dt: number) {
    const p = this.p;
    for (const o of this.orbitals) {
      o.angle += dt * 2.6;
      o.cd = Math.max(0, o.cd - dt);
      const ox = p.x + Math.cos(o.angle) * o.dist;
      const oy = p.y + Math.sin(o.angle) * o.dist;
      if (o.cd > 0) continue;
      const dmg = p.dmg * this.weapon.baseDmgMult;
      for (const e of this.enemies) {
        if (dist2({ x: ox, y: oy }, e) <= (e.r + 10) * (e.r + 10)) {
          this.damageEnemy(e, dmg, Math.random() < p.crit);
          this.logHeroDamage(dmg);
          o.cd = 0.35;
          this.audio.play("orbitalHit", 0.4);
          break;
        }
      }
      if (this.boss && dist2({ x: ox, y: oy }, this.boss) <= (this.boss.r + 10) * (this.boss.r + 10)) {
        this.damageBoss(dmg);
        this.logHeroDamage(dmg);
        o.cd = 0.35;
      }
    }
  }

  private updateSentries(dt: number, list: Sentry[]) {
    for (const s of list) {
      s.cd -= dt;
      const tgt = this.nearestThreat(s.x, s.y, s.range);
      if (tgt) {
        s.ang = Math.atan2(tgt.y - s.y, tgt.x - s.x);
        if (s.cd <= 0) {
          s.cd = s.interval;
          this.bullets.push({ x: s.x, y: s.y, vx: Math.cos(s.ang) * 620, vy: Math.sin(s.ang) * 620, dmg: s.dmg, life: 1.2, pierce: 0, from: "sentry", r: 3.5, crit: false, hit: new Set() });
        }
      }
    }
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.homing && b.targetId !== undefined) {
        const target = b.targetId === -2 ? this.boss : this.enemies.find((e) => e.id === b.targetId);
        if (target) {
          const desired = Math.atan2(target.y - b.y, target.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          const turned = cur + normAngle(desired - cur) * Math.min(1, dt * 6);
          const speed = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(turned) * speed; b.vy = Math.sin(turned) * speed;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > this.w + 40 || b.y < -40 || b.y > this.h + 40) {
        if (b.from === "missile") this.explode(b.x, b.y, b.dmg, 90);
        this.bullets.splice(i, 1);
        continue;
      }
      let consumed = false;
      for (const e of this.enemies) {
        if (b.hit.has(e.id)) continue;
        // shielded frontal block: bullets from within ~100° of the shield facing are absorbed
        if (e.shieldFacing !== undefined) {
          const toBullet = Math.atan2(b.y - e.y, b.x - e.x);
          if (Math.abs(normAngle(toBullet - e.shieldFacing)) < (Math.PI * 0.55)) continue;
        }
        const rr = e.r + b.r;
        if (dist2(b, e) <= rr * rr) {
          if (b.from === "missile") { this.explode(b.x, b.y, b.dmg, 90); this.bullets.splice(i, 1); consumed = true; break; }
          this.damageEnemy(e, b.dmg, b.crit);
          if (b.from === "hero") this.logHeroDamage(b.dmg);
          b.hit.add(e.id);
          this.spawnParticles(b.x, b.y, 4, e.color, "spark", 90);
          if (b.pierce <= 0) { this.bullets.splice(i, 1); consumed = true; break; }
          b.pierce--;
        }
      }
      if (consumed) continue;
      if (this.boss && !b.hit.has(-2)) {
        const rr = this.boss.r + b.r;
        if (dist2(b, this.boss) <= rr * rr) {
          if (b.from === "missile") { this.explode(b.x, b.y, b.dmg, 90); this.bullets.splice(i, 1); continue; }
          this.damageBoss(b.dmg);
          if (b.from === "hero") this.logHeroDamage(b.dmg);
          this.spawnParticles(b.x, b.y, 4, this.boss.def.color, "spark", 90);
          b.hit.add(-2);
          if (b.pierce <= 0) { this.bullets.splice(i, 1); continue; }
          b.pierce--;
        }
      }
    }
  }

  private explode(x: number, y: number, dmg: number, radius: number) {
    this.spawnParticles(x, y, 22, "#ffb347", "spark", 220);
    this.shake = Math.max(this.shake, 6);
    this.audio.play("explosion", 0.6);
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius) this.damageEnemy(e, dmg * (1 - d / radius), false);
    }
    if (this.boss) {
      const d = Math.hypot(this.boss.x - x, this.boss.y - y);
      if (d < radius) this.damageBoss(dmg * (1 - d / radius));
    }
  }

  private updateEnemies(dt: number, slowMult: number) {
    const p = this.p;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;

      // healer aura: passively top up nearby enemies
      if (e.kind === "healer") {
        for (const other of this.enemies) {
          if (other === e) continue;
          if (Math.hypot(other.x - e.x, other.y - e.y) < 90 && other.hp < other.hpMax) {
            other.hp = Math.min(other.hpMax, other.hp + 6 * dt);
          }
        }
      }
      // summoner: periodically calls in a grunt
      if (e.kind === "summoner" && e.summonCd !== undefined) {
        e.summonCd -= dt;
        if (e.summonCd <= 0) { e.summonCd = rand(4, 6.5); this.spawnEnemy("grunt", true); }
      }
      // phantom: short blink toward the hero
      if (e.kind === "phantom" && e.blinkCd !== undefined) {
        e.blinkCd -= dt;
        if (e.blinkCd <= 0) {
          e.blinkCd = rand(2, 3.5);
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.x = clamp(e.x + Math.cos(a) * 140, 0, this.w);
          e.y = clamp(e.y + Math.sin(a) * 140, 0, this.h);
          this.spawnParticles(e.x, e.y, 8, e.color, "ring", 80);
        }
      }
      // berserker: enrages as its own HP drops
      if (e.kind === "berserker") {
        e.rageMult = 1 + (1 - e.hp / e.hpMax) * 1.2;
      }
      // cloaker: cycles between nearly invisible and a sudden close-range dash
      if (e.kind === "cloaker" && e.cloakDashCd !== undefined) {
        e.cloakDashCd -= dt;
        const distToPlayer = Math.hypot(p.x - e.x, p.y - e.y);
        e.cloakLevel = distToPlayer < 90 ? 0 : Math.min(0.82, (e.cloakLevel ?? 0) + dt * 0.6);
        if (e.cloakDashCd <= 0 && distToPlayer < 260) {
          e.cloakDashCd = rand(1.8, 3.2);
          e.cloakLevel = 0;
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          e.x = clamp(e.x + Math.cos(a) * 90, 0, this.w);
          e.y = clamp(e.y + Math.sin(a) * 90, 0, this.h);
          this.spawnParticles(e.x, e.y, 6, e.color, "spark", 90);
        }
      }

      const speedMult = (e.rageMult ?? 1) * slowMult;
      const goCore = e.kind === "brute" || e.kind === "juggernaut" || (e.kind === "grunt" && e.id % 2 === 0) || e.isAdd === false && e.kind === "shielded";
      const tx = goCore ? this.core.x : p.x;
      const ty = goCore ? this.core.y : p.y;
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.ang = Math.atan2(dy, dx);

      if (e.kind === "sniper") {
        const dist = Math.hypot(p.x - e.x, p.y - e.y);
        if (dist < 260) {
          // stand, telegraph, fire a heavy shot, then reposition
          e.telegraph = (e.telegraph ?? 0) + dt;
          if (e.telegraph > 1.1) {
            e.telegraph = -1.2; // cooldown before next telegraph (negative = resting)
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, dmg: e.dmg, life: 3, r: 6, color: "#f472b6" });
          }
          if (e.telegraph < 0) e.telegraph += dt;
        } else {
          e.x += (dx / d) * e.speed * speedMult * dt;
          e.y += (dy / d) * e.speed * speedMult * dt;
        }
      } else if (e.kind === "bomber") {
        e.x += (dx / d) * e.speed * speedMult * dt;
        e.y += (dy / d) * e.speed * speedMult * dt;
        if (d < e.r + p.r + 6) {
          this.explode(e.x, e.y, e.dmg, 70);
          this.damageEnemyDirect(e, e.hp + 1);
        }
      } else if (e.kind === "turret") {
        // plants itself the first time it gets within firing range, then never moves again
        if (!e.planted) {
          if (d < 320) e.planted = true;
          else { e.x += (dx / d) * e.speed * speedMult * dt; e.y += (dy / d) * e.speed * speedMult * dt; }
        }
      } else {
        e.x += (dx / d) * e.speed * speedMult * dt;
        e.y += (dy / d) * e.speed * speedMult * dt;
      }

      // shooter / turret ranged fire
      if (e.kind === "shooter" || (e.kind === "turret" && e.planted)) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = e.kind === "turret" ? rand(1.1, 1.7) : rand(1.6, 2.6);
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, dmg: e.dmg, life: 4, r: 6, color: e.kind === "turret" ? "#94a3b8" : undefined });
        }
      }

      // contact with core
      if (dist2(e, this.core) <= (e.r + this.core.r) * (e.r + this.core.r)) {
        this.core.hp -= e.dmg * dt * 2.2;
        this.audio.play("coreHurt", 0.15);
        if (this.core.hp <= 0) {
          if (this.practiceMode) { this.core.hp = 1; continue; }
          this.core.hp = 0; this.spawnParticles(this.core.x, this.core.y, 40, this.col.accent, "spark", 240); this.finishRun(false); return;
        }
      }
      // contact with player
      if (p.invuln <= 0 && dist2(e, p) <= (e.r + p.r) * (e.r + p.r)) {
        this.dealDamageToPlayer(e.dmg * (e.rageMult ?? 1));
        p.invuln = 0.6;
        this.shake = Math.min(14, this.shake + 7);
        this.spawnParticles(p.x, p.y, 10, "#ff5f6d", "spark", 150);
      }
    }
  }

  private dealDamageToPlayer(dmg: number) {
    const p = this.p;
    const bastionMult = this.hero.passive === "juggernautHide" ? 0.8 : 1;
    let remaining = dmg * bastionMult;
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, remaining);
      p.shield -= absorbed;
      remaining -= absorbed;
      if (p.shield <= 0) this.audio.play("shieldBreak", 0.5);
    }
    if (remaining > 0) {
      p.hp -= remaining;
      this.audio.play("hurt", 0.5);
    }
    if (p.hp <= 0) {
      if (this.practiceMode) { p.hp = 1; return; }
      p.hp = 0; this.finishRun(false);
    }
  }

  private updateBoss(dt: number, slowMult: number) {
    const boss = this.boss!;
    const p = this.p;
    boss.elapsed += dt;
    if (boss.hitFlash > 0) boss.hitFlash -= dt;
    if (boss.shieldLeft > 0) boss.shieldLeft -= dt;

    // phase transitions based on remaining HP fraction
    const frac = boss.hp / boss.hpMax;
    const targetPhase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (targetPhase > boss.phase && targetPhase <= boss.def.phases) {
      boss.phase = targetPhase;
      this.setBanner(`${boss.def.name} — PHASE ${boss.phase}`, 1.8);
    }

    // movement: drift toward the Core unless mid-dash
    if (boss.dashCd > 0) {
      boss.dashCd -= dt;
      const dx = boss.dashTx - boss.x, dy = boss.dashTy - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      boss.x += (dx / d) * boss.speed * 5 * slowMult * dt;
      boss.y += (dy / d) * boss.speed * 5 * slowMult * dt;
      boss.ang = Math.atan2(dy, dx);
    } else {
      const dx = this.core.x - boss.x, dy = this.core.y - boss.y;
      const d = Math.hypot(dx, dy) || 1;
      const holdRadius = 160;
      if (d > holdRadius) { boss.x += (dx / d) * boss.speed * slowMult * dt; boss.y += (dy / d) * boss.speed * slowMult * dt; }
      boss.ang = Math.atan2(this.p.y - boss.y, this.p.x - boss.x);
    }

    boss.intentCd -= dt;
    if (boss.intentCd <= 0) {
      const intent = bossIntent(boss.kind, boss.phase, boss.elapsed);
      this.executeBossIntent(boss, intent);
      boss.intentCd = 0.5;
    }

    // contact with core / player
    if (dist2(boss, this.core) <= (boss.r + this.core.r) * (boss.r + this.core.r)) {
      this.core.hp -= boss.dmg * dt * 1.6;
      if (this.core.hp <= 0) {
        if (this.practiceMode) { this.core.hp = 1; }
        else { this.core.hp = 0; this.finishRun(false); return; }
      }
    }
    if (p.invuln <= 0 && dist2(boss, p) <= (boss.r + p.r) * (boss.r + p.r)) {
      this.dealDamageToPlayer(boss.dmg * 0.6);
      p.invuln = 0.6;
      this.shake = Math.min(16, this.shake + 8);
    }
  }

  private executeBossIntent(boss: Boss, intent: BossIntent) {
    switch (intent.kind) {
      case "volley": {
        const count = intent.count ?? 5;
        const spread = intent.spreadRad ?? 0.8;
        const base = Math.atan2(this.p.y - boss.y, this.p.x - boss.x);
        for (let i = 0; i < count; i++) {
          const a = base + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
          this.ebullets.push({ x: boss.x, y: boss.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, dmg: boss.dmg * 0.55, life: 4, r: 7, color: boss.def.color });
        }
        this.audio.play("bossHit", 0.4);
        break;
      }
      case "summon": {
        const count = intent.count ?? 2;
        const table = spawnTableForSector(this.sector);
        for (let i = 0; i < count; i++) this.spawnEnemy(pickWeightedKind(table), true);
        break;
      }
      case "dash": {
        boss.dashCd = 0.5;
        boss.dashTx = clamp(this.p.x + rand(-60, 60), boss.r, this.w - boss.r);
        boss.dashTy = clamp(this.p.y + rand(-60, 60), boss.r, this.h - boss.r);
        break;
      }
      case "shield":
        boss.shieldLeft = intent.shieldSeconds ?? 2;
        this.audio.play("shieldUp", 0.4);
        break;
      case "slam":
        this.explode(boss.x, boss.y, boss.dmg * 1.4, 160);
        this.audio.play("bossSlam", 0.6);
        break;
    }
  }

  private updateEnemyBullets(dt: number, slowMult: number, invulnMult: number) {
    const p = this.p;
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt * slowMult; b.y += b.vy * dt * slowMult; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.w + 20 || b.y < -20 || b.y > this.h + 20) { this.ebullets.splice(i, 1); continue; }
      if (p.invuln <= 0 && dist2(b, p) <= (b.r + p.r) * (b.r + p.r)) {
        this.dealDamageToPlayer(b.dmg);
        p.invuln = 0.35 * invulnMult;
        this.shake = Math.min(12, this.shake + 5);
        this.spawnParticles(p.x, p.y, 8, "#ff5f6d", "spark", 130);
        this.ebullets.splice(i, 1);
      }
    }
  }

  private updatePickups(dt: number) {
    const p = this.p;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const g = this.pickups[i];
      g.life -= dt;
      const dx = p.x - g.x, dy = p.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.magnet) { const pull = Math.min(560, 60 + (p.magnet - d) * 6); g.vx += (dx / d) * pull * dt; g.vy += (dy / d) * pull * dt; }
      g.vx *= 0.9; g.vy *= 0.9;
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < p.r + 8 || g.life <= 0) {
        if (d < p.r + 12) {
          if (g.kind === "gold") { const amt = g.value * p.goldGainMult; this.gold += amt; this.score += amt; this.goldEarned += amt; this.audio.play("pickupGold", 0.4); }
          else { p.hp = Math.min(p.hpMax, p.hp + g.value); this.audio.play("pickupHeal", 0.5); }
        }
        this.pickups.splice(i, 1);
      }
    }
  }

  private nearestThreat(x: number, y: number, range: number): Enemy | Boss | null {
    let best: Enemy | Boss | null = null, bd = range * range;
    for (const e of this.enemies) { const d = dist2({ x, y } as Vec, e); if (d < bd) { bd = d; best = e; } }
    if (this.boss) { const d = dist2({ x, y } as Vec, this.boss); if (d < bd) { bd = d; best = this.boss; } }
    return best;
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean) {
    const mitigated = e.armorPlate ? dmg * (1 - e.armorPlate) : dmg;
    e.hp -= mitigated; e.hitFlash = 0.12;
    if (this.p.lifesteal > 0) this.p.hp = Math.min(this.p.hpMax, this.p.hp + dmg * this.p.lifesteal);
    if (crit) { this.critKills++; this.audio.play("crit", 0.3); } else this.audio.play("hit", 0.15);
    this.particles.push({ x: e.x, y: e.y - e.r - 4, vx: rand(-14, 14), vy: -30, life: 0.7, maxLife: 0.7, r: crit ? 16 : 12, color: crit ? "#ffd84d" : this.col.fg, text: (crit ? "★" : "") + Math.round(dmg), kind: "text" });
    if (e.hp <= 0) this.killEnemy(e);
  }
  private damageEnemyDirect(e: Enemy, dmg: number) { e.hp -= dmg; if (e.hp <= 0) this.killEnemy(e); }

  private damageBoss(dmg: number) {
    const boss = this.boss;
    if (!boss) return;
    const mitigated = boss.shieldLeft > 0 ? dmg * 0.15 : dmg;
    boss.hp -= mitigated;
    boss.hitFlash = 0.12;
    this.audio.play("bossHit", 0.25);
    if (boss.hp <= 0) this.killBoss(boss);
  }

  /** Registers a kill toward the combo streak and returns the score multiplier it earned. */
  private registerComboKill(): number {
    this.combo++;
    this.comboTimer = RiftGame.COMBO_WINDOW;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    return 1 + Math.min(2, (this.combo - 1) * 0.08); // up to 3x at a 25+ streak
  }

  private killEnemy(e: Enemy) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    const comboMult = this.registerComboKill();
    this.kills++; this.score += e.score * comboMult * this.modMult.scoreMult;
    this.addXp(Math.max(3, Math.round(e.score / 3)));
    this.spawnParticles(e.x, e.y, 14, e.color, "spark", 150);
    this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, r: e.r, color: e.color, kind: "ring" });
    this.audio.play("kill", 0.3);
    if (e.splitOnDeath) {
      for (let i = 0; i < 2; i++) {
        const a = rand(0, Math.PI * 2);
        this.spawnEnemy("swift", true);
        const spawned = this.enemies[this.enemies.length - 1];
        spawned.x = clamp(e.x + Math.cos(a) * 20, 0, this.w);
        spawned.y = clamp(e.y + Math.sin(a) * 20, 0, this.h);
      }
    }
    const drops = e.kind === "brute" ? 3 : 1;
    for (let i = 0; i < drops; i++) this.pickups.push({ x: e.x + rand(-e.r, e.r), y: e.y + rand(-e.r, e.r), vx: rand(-60, 60), vy: rand(-60, 60), value: Math.max(1, Math.round(e.gold / drops)), life: 12, kind: "gold" });
    const healChance = 0.06 * (this.modifiers.some((m) => m.id === "healScarcity") ? 0.4 : 1);
    if (Math.random() < healChance) this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, value: 20, life: 12, kind: "heal" });
  }

  private killBoss(boss: Boss) {
    this.boss = null;
    this.bossDefeatedThisWave = true;
    this.bossKills++;
    this.kills++;
    const comboMult = this.registerComboKill();
    this.score += 500 * this.difficulty.scoreMult * comboMult * this.modMult.scoreMult;
    this.addXp(150);
    this.spawnParticles(boss.x, boss.y, 70, boss.def.color, "spark", 280);
    this.shake = 24;
    this.setBanner("SECTOR CLEARED", 2.4);
    this.audio.play("kill", 0.5);
    const drops = 16;
    for (let i = 0; i < drops; i++) this.pickups.push({ x: boss.x + rand(-boss.r, boss.r), y: boss.y + rand(-boss.r, boss.r), vx: rand(-60, 60), vy: rand(-60, 60), value: Math.max(1, Math.round((220 + this.sector * 60) / drops)), life: 14, kind: "gold" });
    this.pickups.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, value: 60, life: 14, kind: "heal" });
  }

  private addXp(n: number) {
    const xpMult = this.modifiers.some((m) => m.id === "doubleXp") ? 2 : 1;
    this.xp += n * xpMult;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext; this.level++; this.xpNext = Math.round(this.xpNext * 1.25 + 20);
      this.p.hp = Math.min(this.p.hpMax, this.p.hp + 8);
      this.audio.play("levelUp", 0.4);
    }
  }

  private spawnParticles(x: number, y: number, n: number, color: string, kind: Particle["kind"], speed: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, 0.6), maxLife: 0.6, r: rand(1.5, 3.5), color, kind });
    }
  }

  private finishRun(won: boolean) {
    this.audio.stopMusic();
    this.audio.play(won ? "victory" : "defeat");
    this.setState(won ? "won" : "gameover");
    this.onRunEnd?.({
      won, score: Math.floor(this.score), kills: this.kills, bossKills: this.bossKills,
      critKills: this.critKills, goldEarned: Math.floor(this.goldEarned), sectorReached: this.sector, levelReached: this.level,
      bestCombo: this.bestCombo, practice: this.practiceMode,
    });
  }

  private pushHud() {
    const abilitySlot = (i: 0 | 1): AbilityHudSlot => {
      const id = this.abilitySlots[i];
      if (!id) return { id: null, name: "", icon: "", color: "var(--fg-2)", cooldownFrac: 0, activeFrac: 0, ready: false };
      const def = abilityById(id);
      return {
        id, name: def.name, icon: def.icon, color: def.color,
        cooldownFrac: clamp(this.abilityCd[i] / def.cooldown, 0, 1),
        activeFrac: this.abilityActive[i],
        ready: this.abilityCd[i] <= 0,
      };
    };
    const boss = this.boss;
    this.onHud({
      state: this.state, wave: this.wave, sector: this.sector, gold: Math.floor(this.gold), score: Math.floor(this.score),
      hp: Math.ceil(this.p.hp), hpMax: this.p.hpMax, shield: Math.ceil(this.p.shield),
      coreHp: Math.ceil(this.core.hp), coreHpMax: this.core.hpMax,
      enemiesAlive: this.enemies.length + (boss ? 1 : 0),
      waveProgress: this.waveEnemies ? 1 - (this.spawnQueue.length + this.enemies.length) / this.waveEnemies : 0,
      level: this.level, xp: this.xp, xpNext: this.xpNext, kills: this.kills,
      banner: this.bannerT > 0 ? this.banner : "",
      heroName: this.hero.name, heroIcon: this.hero.icon, heroColor: this.hero.color,
      weaponName: this.weapon.name, weaponIcon: this.weapon.icon,
      abilities: [abilitySlot(0), abilitySlot(1)],
      boss: {
        visible: !!boss, name: boss?.def.name ?? "", title: boss?.def.title ?? "",
        hp: boss ? Math.ceil(boss.hp) : 0, hpMax: boss?.hpMax ?? 0, phase: boss?.phase ?? 1, phases: boss?.def.phases ?? 1,
        shieldActive: (boss?.shieldLeft ?? 0) > 0, color: boss?.def.color ?? this.col.accent,
      },
      difficulty: this.difficulty.id,
      toast: this.toastT > 0 ? this.toast : "",
      combo: this.combo,
      comboFrac: clamp(this.comboTimer / RiftGame.COMBO_WINDOW, 0, 1),
      modifierIcons: this.modifiers.map((m) => m.icon),
      dps: Math.round(this.currentDps()),
    });
  }

  // ---- render -----------------------------------------------------------

  private render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = this.col.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    this.drawGrid(ctx);
    this.drawCore(ctx);
    for (const g of this.pickups) {
      ctx.globalAlpha = Math.min(1, g.life);
      ctx.fillStyle = g.kind === "gold" ? this.col.accent : "#4ade80";
      ctx.shadowColor = ctx.fillStyle as string; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.kind === "gold" ? 4 : 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    for (const s of this.sentries) this.drawSentry(ctx, s, this.col.accent);
    for (const s of this.tempTurrets) this.drawSentry(ctx, s, "#c084fc");
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    if (this.boss) this.drawBoss(ctx, this.boss);
    if (this.weapon.id === "orbitals") this.drawOrbitals(ctx);
    ctx.shadowBlur = 8;
    for (const b of this.ebullets) { const c = b.color || "#ff8a4c"; ctx.fillStyle = c; ctx.shadowColor = c; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    for (const b of this.bullets) { const c = b.color || (b.from === "sentry" ? this.col.accent2 : b.crit ? "#ffd84d" : this.col.accent); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;
    if (this.state !== "menu") this.drawPlayer(ctx);
    this.drawParticles(ctx);
    ctx.restore();
    const vg = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.3, this.w / 2, this.h / 2, this.h * 0.75);
    vg.addColorStop(0, "transparent");
    vg.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, this.w, this.h);
  }

  private drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = this.col.line; ctx.lineWidth = 1;
    const step = 46;
    ctx.beginPath();
    for (let x = (this.core.x % step); x < this.w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
    for (let y = (this.core.y % step); y < this.h; y += step) { ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
    ctx.stroke();
  }

  private drawCore(ctx: CanvasRenderingContext2D) {
    const c = this.core, pulse = 1 + Math.sin(c.pulse * 2) * 0.06;
    const frac = Math.max(0, c.hp / c.hpMax);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.pulse * 0.3);
    ctx.shadowColor = this.col.accent; ctx.shadowBlur = 26;
    ctx.strokeStyle = this.col.accent; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const rr = c.r * pulse; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.stroke();
    ctx.rotate(-c.pulse * 0.6);
    ctx.fillStyle = this.col.accent; ctx.globalAlpha = 0.18 + 0.1 * Math.sin(c.pulse * 3);
    ctx.beginPath(); ctx.arc(0, 0, c.r * 0.6 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = frac > 0.5 ? this.col.accent : frac > 0.25 ? "#eab308" : "#ff5f6d";
    ctx.lineWidth = 3; ctx.shadowBlur = 0; ctx.stroke();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.p;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    ctx.shadowColor = this.hero.colorSecondary; ctx.shadowBlur = 18;
    ctx.fillStyle = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 ? "rgba(255,255,255,0.6)" : this.hero.color;
    ctx.beginPath();
    ctx.moveTo(p.r, 0); ctx.lineTo(-p.r * 0.7, p.r * 0.7); ctx.lineTo(-p.r * 0.4, 0); ctx.lineTo(-p.r * 0.7, -p.r * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    if (p.shield > 0) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 10, 0, Math.PI * 2);
      ctx.strokeStyle = "#60a5fa"; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.shadowBlur = 0; ctx.stroke(); ctx.globalAlpha = 1;
    }
    const frac = Math.max(0, p.hp / p.hpMax);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = frac > 0.5 ? this.hero.colorSecondary : frac > 0.25 ? "#eab308" : "#ff5f6d";
    ctx.lineWidth = 2.5; ctx.shadowBlur = 0; ctx.stroke();
  }

  private drawOrbitals(ctx: CanvasRenderingContext2D) {
    for (const o of this.orbitals) {
      const ox = this.p.x + Math.cos(o.angle) * o.dist;
      const oy = this.p.y + Math.sin(o.angle) * o.dist;
      ctx.shadowColor = this.weapon.color; ctx.shadowBlur = 12;
      ctx.fillStyle = this.weapon.color;
      ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  private drawSentry(ctx: CanvasRenderingContext2D, s: Sentry, color: string) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang);
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = this.col.bg; ctx.fillRect(2, -2.5, 12, 5);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.ang + Math.PI / 2);
    ctx.shadowColor = e.color; ctx.shadowBlur = 12;
    ctx.globalAlpha = e.kind === "cloaker" ? 1 - (e.cloakLevel ?? 0) : 1;
    ctx.fillStyle = e.hitFlash > 0 ? "#ffffff" : e.color;
    ctx.beginPath();
    if (e.kind === "brute" || e.kind === "juggernaut") { const n = e.kind === "juggernaut" ? 7 : 6; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const rr = e.r * (i % 2 ? 0.7 : 1); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); }
    else if (e.kind === "swift" || e.kind === "phantom" || e.kind === "cloaker") { ctx.moveTo(0, -e.r); ctx.lineTo(e.r * 0.85, e.r); ctx.lineTo(-e.r * 0.85, e.r); ctx.closePath(); }
    else if (e.kind === "shooter" || e.kind === "sniper" || e.kind === "turret") { ctx.rect(-e.r, -e.r, e.r * 2, e.r * 2); }
    else if (e.kind === "bomber") { for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? e.r * 0.5 : e.r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); }
    else { ctx.arc(0, 0, e.r, 0, Math.PI * 2); }
    ctx.fill();
    if (this.colorblindMode) { ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.shadowBlur = 0; ctx.stroke(); }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (e.shieldFacing !== undefined) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.shieldFacing);
      ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(0, 0, e.r + 6, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
      ctx.restore();
    }
    if (e.kind === "sniper" && (e.telegraph ?? 0) > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (e.telegraph ?? 0) / 1.1);
      ctx.strokeStyle = "#f472b6"; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(this.p.x, this.p.y); ctx.stroke();
      ctx.restore();
    }
    if (e.elite) {
      ctx.save();
      ctx.strokeStyle = "#facc15"; ctx.lineWidth = 2; ctx.globalAlpha = 0.75; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (e.hp < e.hpMax) {
      const w = e.r * 2, frac = Math.max(0, e.hp / e.hpMax);
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
      ctx.fillStyle = e.elite ? "#facc15" : this.col.accent; ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * frac, 4);
    }
  }

  private drawBoss(ctx: CanvasRenderingContext2D, b: Boss) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.ang + Math.PI / 2);
    ctx.shadowColor = b.def.color; ctx.shadowBlur = 32;
    ctx.fillStyle = b.hitFlash > 0 ? "#ffffff" : b.def.color;
    const n = 8;
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const rr = b.r * (i % 2 ? 0.72 : 1); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill();
    if (this.colorblindMode) { ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 0; ctx.stroke(); }
    ctx.restore();
    if (b.shieldLeft > 0) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 14, 0, Math.PI * 2);
      ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 4; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(b.elapsed * 8); ctx.shadowBlur = 0; ctx.stroke(); ctx.globalAlpha = 1;
    }
    const w = b.r * 2.4, frac = Math.max(0, b.hp / b.hpMax);
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(b.x - w / 2, b.y - b.r - 16, w, 6);
    ctx.fillStyle = "#ff5f6d"; ctx.fillRect(b.x - w / 2, b.y - b.r - 16, w * frac, 6);
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const q of this.particles) {
      const a = Math.max(0, q.life / q.maxLife);
      if (q.kind === "text") {
        ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.font = `700 ${q.r}px ui-monospace, monospace`; ctx.textAlign = "center";
        ctx.fillText(q.text || "", q.x, q.y);
      } else if (q.kind === "ring") {
        ctx.globalAlpha = a * 0.7; ctx.strokeStyle = q.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1.4 - a) + 4, 0, Math.PI * 2); ctx.stroke();
      } else if (q.kind === "beam") {
        // chain-laser tick: a thin line from the hero to the (encoded) target point
        if (q.text) {
          const [tx, ty] = q.text.split(",").map(Number);
          ctx.globalAlpha = a; ctx.strokeStyle = this.weapon.color; ctx.lineWidth = 2; ctx.shadowColor = this.weapon.color; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(this.p.x, this.p.y); ctx.lineTo(tx, ty); ctx.stroke();
        }
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.shadowColor = q.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}
