// ============================================================================
//  Rift — a neon arena survival game engine (Canvas 2D).
//
//  Action + strategy + adventure: pilot a hero that auto-fires at the nearest
//  threat, defend the central Core, survive escalating waves across sectors,
//  spend salvage between waves on a branching pool of upgrades, deploy sentry
//  turrets, and topple a boss at the end of every sector.
//
//  The engine is framework-agnostic: give it a <canvas> and a couple of
//  callbacks. It runs a smooth, delta-timed game loop, reads the site's theme
//  colours so it matches whichever palette is active, and cleans itself up.
// ============================================================================

export type GameState = "menu" | "playing" | "paused" | "shop" | "gameover" | "won";

export interface Hud {
  state: GameState;
  wave: number;
  sector: number;
  gold: number;
  score: number;
  hp: number;
  hpMax: number;
  coreHp: number;
  coreHpMax: number;
  enemiesAlive: number;
  waveProgress: number; // 0..1
  level: number;
  kills: number;
  banner: string;
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

type Vec = { x: number; y: number };

interface Bullet extends Vec { vx: number; vy: number; dmg: number; life: number; pierce: number; from: "hero" | "sentry"; r: number; crit: boolean; hit: Set<number> }
interface EBullet extends Vec { vx: number; vy: number; dmg: number; life: number; r: number }
interface Enemy extends Vec { id: number; hp: number; hpMax: number; r: number; speed: number; dmg: number; gold: number; kind: string; color: string; score: number; fireCd: number; hitFlash: number; boss: boolean; ang: number }
interface Sentry extends Vec { cd: number; interval: number; dmg: number; range: number; ang: number }
interface Particle extends Vec { vx: number; vy: number; life: number; maxLife: number; r: number; color: string; text?: string; kind: "spark" | "ring" | "text" | "smoke" }
interface Pickup extends Vec { vx: number; vy: number; value: number; life: number; kind: "gold" | "heal" }

const WAVES_PER_SECTOR = 6;
const SECTORS = 5;

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
];

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function dist2(a: Vec, b: Vec) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

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

  // theme colours
  private col = { accent: "#b9ff3a", accent2: "#67e8f9", bg: "#0b0c0e", fg: "#eef1f4", line: "rgba(255,255,255,.09)" };

  // player
  private p = { x: 0, y: 0, vx: 0, vy: 0, r: 15, hp: 100, hpMax: 100, speed: 265, dmg: 16, fireInt: 0.42, fireCd: 0, projectiles: 1, pierce: 0, crit: 0.05, critMult: 2.2, range: 480, magnet: 95, regen: 0, lifesteal: 0, bulletSpeed: 560, aim: 0, invuln: 0 };
  private core = { x: 0, y: 0, r: 34, hp: 400, hpMax: 400, pulse: 0 };

  private bullets: Bullet[] = [];
  private ebullets: EBullet[] = [];
  private enemies: Enemy[] = [];
  private sentries: Sentry[] = [];
  private particles: Particle[] = [];
  private pickups: Pickup[] = [];
  private enemyId = 0;

  // progression
  gold = 0;
  score = 0;
  kills = 0;
  level = 1;
  private xp = 0;
  private xpNext = 60;
  wave = 0;
  sector = 1;
  private spawnQueue: string[] = [];
  private spawnTimer = 0;
  private spawnEvery = 0.7;
  private waveEnemies = 0;
  private banner = "";
  private bannerT = 0;
  private shake = 0;
  private upLevels: Record<string, number> = {};

  // input
  private keys = new Set<string>();
  private pointer = { x: 0, y: 0, down: false, active: false };
  private hudAcc = 0;

  constructor(canvas: HTMLCanvasElement, opts: { onHud: (h: Hud) => void; onState: (s: GameState) => void }) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.onHud = opts.onHud;
    this.onState = opts.onState;
    this.readTheme();
    this.resize();
    this.bindInput();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

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
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private ptPos(e: PointerEvent) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  private onPointerDown = (e: PointerEvent) => { const p = this.ptPos(e); this.pointer.x = p.x; this.pointer.y = p.y; this.pointer.down = true; this.pointer.active = true; };
  private onPointerMove = (e: PointerEvent) => { const p = this.ptPos(e); this.pointer.x = p.x; this.pointer.y = p.y; if (this.pointer.down) this.pointer.active = true; };
  private onPointerUp = () => { this.pointer.down = false; };

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
  }

  // ---- lifecycle --------------------------------------------------------
  start() {
    this.readTheme();
    this.resize();
    this.p = { ...this.p, x: this.w / 2, y: this.h / 2 + 90, vx: 0, vy: 0, hp: 100, hpMax: 100, speed: 265, dmg: 16, fireInt: 0.42, fireCd: 0, projectiles: 1, pierce: 0, crit: 0.05, critMult: 2.2, range: 480, magnet: 95, regen: 0, lifesteal: 0, bulletSpeed: 560, aim: 0, invuln: 0 };
    this.core = { x: this.w / 2, y: this.h / 2, r: 34, hp: 400, hpMax: 400, pulse: 0 };
    this.bullets = []; this.ebullets = []; this.enemies = []; this.sentries = []; this.particles = []; this.pickups = [];
    this.gold = 0; this.score = 0; this.kills = 0; this.level = 1; this.xp = 0; this.xpNext = 60;
    this.wave = 0; this.sector = 1; this.upLevels = {};
    this.setState("playing");
    this.nextWave();
  }
  restart() { this.start(); }
  togglePause() { if (this.state === "playing") this.setState("paused"); else if (this.state === "paused") { this.setState("playing"); this.last = performance.now(); } }
  resumeFromShop() { if (this.state === "shop") { this.setState("playing"); this.last = performance.now(); this.nextWave(); } }

  private setState(s: GameState) { this.state = s; this.onState(s); this.pushHud(true); }

  // ---- waves ------------------------------------------------------------
  private nextWave() {
    this.wave++;
    if (this.wave > WAVES_PER_SECTOR) {
      this.wave = 1;
      this.sector++;
      if (this.sector > SECTORS) { this.setState("won"); return; }
      this.setBanner(`SECTOR ${this.sector}`);
    } else {
      this.setBanner(this.wave === WAVES_PER_SECTOR ? "⚠ BOSS INCOMING" : `WAVE ${this.wave}`);
    }
    const s = this.sector, w = this.wave;
    const power = (s - 1) * WAVES_PER_SECTOR + w;
    const q: string[] = [];
    if (w === WAVES_PER_SECTOR) {
      // boss wave — a few escorts + the boss (spawned last)
      const escorts = 4 + s * 2;
      for (let i = 0; i < escorts; i++) q.push(Math.random() < 0.5 ? "grunt" : "swift");
      q.push("boss");
    } else {
      const n = 6 + power * 2;
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        if (r < 0.12 + s * 0.03) q.push("brute");
        else if (r < 0.35) q.push("swift");
        else if (r < 0.5 && power > 3) q.push("shooter");
        else q.push("grunt");
      }
    }
    this.spawnQueue = q;
    this.waveEnemies = q.length;
    this.spawnEvery = Math.max(0.28, 0.75 - power * 0.02);
    this.spawnTimer = 0.4;
  }

  private enemyStats(kind: string): Omit<Enemy, "x" | "y" | "id" | "fireCd" | "hitFlash" | "ang"> {
    const s = this.sector;
    const scale = 1 + (s - 1) * 0.35 + this.wave * 0.04;
    switch (kind) {
      case "swift": return { hp: 14 * scale, hpMax: 14 * scale, r: 11, speed: 128, dmg: 8, gold: 4, kind, color: this.col.accent2, score: 12, boss: false };
      case "brute": return { hp: 70 * scale, hpMax: 70 * scale, r: 26, speed: 44, dmg: 22, gold: 12, kind, color: "#f97316", score: 30, boss: false };
      case "shooter": return { hp: 26 * scale, hpMax: 26 * scale, r: 15, speed: 58, dmg: 10, gold: 9, kind, color: "#c084fc", score: 24, boss: false };
      case "boss": { const hp = (900 + s * 700) * (1 + this.wave * 0.02); return { hp, hpMax: hp, r: 60, speed: 40, dmg: 34, gold: 220 + s * 60, kind, color: "#ff5f6d", score: 500, boss: true }; }
      default: return { hp: 30 * scale, hpMax: 30 * scale, r: 15, speed: 70, dmg: 12, gold: 6, kind: "grunt", color: this.col.accent, score: 15, boss: false };
    }
  }

  private spawnEnemy(kind: string) {
    const st = this.enemyStats(kind);
    const edge = Math.floor(rand(0, 4));
    let x = 0, y = 0;
    if (edge === 0) { x = rand(0, this.w); y = -40; }
    else if (edge === 1) { x = this.w + 40; y = rand(0, this.h); }
    else if (edge === 2) { x = rand(0, this.w); y = this.h + 40; }
    else { x = -40; y = rand(0, this.h); }
    if (kind === "boss") { x = this.w / 2; y = -70; }
    this.enemies.push({ ...st, x, y, id: this.enemyId++, fireCd: rand(1, 2.5), hitFlash: 0, ang: 0 });
  }

  private setBanner(t: string) { this.banner = t; this.bannerT = 2.2; }

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
    this.pushHud(true);
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
      case "sentry": {
        const a = this.sentries.length * (Math.PI * 2 / 6) + 0.4;
        const rr = this.core.r + 46;
        this.sentries.push({ x: this.core.x + Math.cos(a) * rr, y: this.core.y + Math.sin(a) * rr, cd: 0, interval: 0.6, dmg: 12, range: 340, ang: 0 });
        break;
      }
    }
  }

  /** Offer three affordable-ish, non-maxed upgrades for the shop. */
  shopOffer(): string[] {
    const pool = UPGRADES.filter((u) => !this.maxedOf(u.id));
    const weight = (t: string) => (t === "common" ? 3 : t === "rare" ? 2 : 1);
    const bag: string[] = [];
    pool.forEach((u) => { for (let i = 0; i < weight(u.tier); i++) bag.push(u.id); });
    const out: string[] = [];
    while (out.length < 3 && bag.length) {
      const pick = bag[Math.floor(Math.random() * bag.length)];
      if (!out.includes(pick)) out.push(pick);
      if (new Set(bag).size <= out.length) break;
    }
    return out;
  }

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
    if (this.hudAcc > 0.1) { this.pushHud(false); this.hudAcc = 0; }
    this.raf = requestAnimationFrame(this.loop);
  }

  private update(dt: number) {
    const p = this.p;
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
    p.x += mx * p.speed * dt;
    p.y += my * p.speed * dt;
    p.x = Math.max(p.r, Math.min(this.w - p.r, p.x));
    p.y = Math.max(p.r, Math.min(this.h - p.r, p.y));
    if (p.regen > 0 && p.hp < p.hpMax) p.hp = Math.min(p.hpMax, p.hp + p.regen * dt);
    if (p.invuln > 0) p.invuln -= dt;
    this.core.pulse += dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);

    // ---- spawning ----
    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnEnemy(this.spawnQueue.shift()!); this.spawnTimer = this.spawnEvery; }
    } else if (this.enemies.length === 0) {
      // wave cleared
      this.setState("shop");
      return;
    }

    // ---- hero auto-fire ----
    p.fireCd -= dt;
    const target = this.nearestEnemy(p.x, p.y, p.range);
    if (target && p.fireCd <= 0) {
      p.fireCd = p.fireInt;
      const baseAng = Math.atan2(target.y - p.y, target.x - p.x);
      p.aim = baseAng;
      const spread = 0.16;
      const n = p.projectiles;
      for (let i = 0; i < n; i++) {
        const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
        const a = baseAng + off;
        const crit = Math.random() < p.crit;
        const dmg = p.dmg * (crit ? p.critMult : 1);
        this.bullets.push({ x: p.x + Math.cos(a) * p.r, y: p.y + Math.sin(a) * p.r, vx: Math.cos(a) * p.bulletSpeed, vy: Math.sin(a) * p.bulletSpeed, dmg, life: 1.4, pierce: p.pierce, from: "hero", r: crit ? 5.5 : 4, crit, hit: new Set() });
      }
      this.spawnParticles(p.x + Math.cos(baseAng) * p.r, p.y + Math.sin(baseAng) * p.r, 3, this.col.accent, "spark", 60);
    }

    // ---- sentries ----
    for (const s of this.sentries) {
      s.cd -= dt;
      const tgt = this.nearestEnemy(s.x, s.y, s.range);
      if (tgt) {
        s.ang = Math.atan2(tgt.y - s.y, tgt.x - s.x);
        if (s.cd <= 0) {
          s.cd = s.interval;
          this.bullets.push({ x: s.x, y: s.y, vx: Math.cos(s.ang) * 620, vy: Math.sin(s.ang) * 620, dmg: s.dmg, life: 1.2, pierce: 0, from: "sentry", r: 3.5, crit: false, hit: new Set() });
        }
      }
    }

    // ---- bullets ----
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.w + 20 || b.y < -20 || b.y > this.h + 20) { this.bullets.splice(i, 1); continue; }
      for (const e of this.enemies) {
        if (b.hit.has(e.id)) continue;
        const rr = e.r + b.r;
        if (dist2(b, e) <= rr * rr) {
          this.damageEnemy(e, b.dmg, b.crit);
          b.hit.add(e.id);
          this.spawnParticles(b.x, b.y, 4, e.color, "spark", 90);
          if (b.pierce <= 0) { this.bullets.splice(i, 1); break; }
          b.pierce--;
        }
      }
    }

    // ---- enemies ----
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;
      // target: brutes & boss go for the core; others weave toward the player
      const goCore = e.kind === "brute" || e.boss || (e.kind === "grunt" && (e.id % 2 === 0));
      const tx = goCore ? this.core.x : p.x;
      const ty = goCore ? this.core.y : p.y;
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.ang = Math.atan2(dy, dx);
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
      // shooter / boss ranged fire
      if (e.kind === "shooter" || e.boss) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = e.boss ? 0.55 : rand(1.6, 2.6);
          const aim = Math.atan2(p.y - e.y, p.x - e.x);
          const shots = e.boss ? 5 : 1;
          for (let s = 0; s < shots; s++) {
            const a = aim + (e.boss ? (s - 2) * 0.22 : 0);
            this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, dmg: e.boss ? 16 : 9, life: 4, r: 6 });
          }
        }
      }
      // contact with core
      if (dist2(e, this.core) <= (e.r + this.core.r) * (e.r + this.core.r)) {
        this.core.hp -= e.dmg * dt * 2.2;
        if (this.core.hp <= 0) { this.core.hp = 0; this.spawnParticles(this.core.x, this.core.y, 40, this.col.accent, "spark", 240); this.gameOver(); return; }
      }
      // contact with player
      if (p.invuln <= 0 && dist2(e, p) <= (e.r + p.r) * (e.r + p.r)) {
        p.hp -= e.dmg; p.invuln = 0.6; this.shake = Math.min(14, this.shake + 7);
        this.spawnParticles(p.x, p.y, 10, "#ff5f6d", "spark", 150);
        if (p.hp <= 0) { p.hp = 0; this.gameOver(); return; }
      }
    }

    // ---- enemy bullets ----
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > this.w + 20 || b.y < -20 || b.y > this.h + 20) { this.ebullets.splice(i, 1); continue; }
      if (p.invuln <= 0 && dist2(b, p) <= (b.r + p.r) * (b.r + p.r)) {
        p.hp -= b.dmg; p.invuln = 0.35; this.shake = Math.min(12, this.shake + 5);
        this.spawnParticles(p.x, p.y, 8, "#ff5f6d", "spark", 130);
        this.ebullets.splice(i, 1);
        if (p.hp <= 0) { p.hp = 0; this.gameOver(); return; }
      }
    }

    // ---- pickups ----
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
          if (g.kind === "gold") { this.gold += g.value; this.score += g.value; }
          else { p.hp = Math.min(p.hpMax, p.hp + g.value); }
        }
        this.pickups.splice(i, 1);
      }
    }

    // ---- particles ----
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92;
      if (q.kind === "text") q.y -= 26 * dt;
      if (q.life <= 0) this.particles.splice(i, 1);
    }
  }

  private nearestEnemy(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null, bd = range * range;
    for (const e of this.enemies) { const d = dist2({ x, y } as Vec, e); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean) {
    e.hp -= dmg; e.hitFlash = 0.12;
    if (this.p.lifesteal > 0) this.p.hp = Math.min(this.p.hpMax, this.p.hp + dmg * this.p.lifesteal);
    this.particles.push({ x: e.x, y: e.y - e.r - 4, vx: rand(-14, 14), vy: -30, life: 0.7, maxLife: 0.7, r: crit ? 16 : 12, color: crit ? "#ffd84d" : this.col.fg, text: (crit ? "★" : "") + Math.round(dmg), kind: "text" });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.kills++; this.score += e.score;
    this.addXp(e.boss ? 120 : Math.max(3, Math.round(e.score / 3)));
    this.spawnParticles(e.x, e.y, e.boss ? 60 : 14, e.color, "spark", e.boss ? 260 : 150);
    this.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, r: e.r, color: e.color, kind: "ring" });
    if (e.boss) { this.shake = 22; this.setBanner("SECTOR CLEARED"); }
    // drops
    const drops = e.boss ? 14 : e.kind === "brute" ? 3 : 1;
    for (let i = 0; i < drops; i++) this.pickups.push({ x: e.x + rand(-e.r, e.r), y: e.y + rand(-e.r, e.r), vx: rand(-60, 60), vy: rand(-60, 60), value: Math.max(1, Math.round(e.gold / drops)), life: 12, kind: "gold" });
    if (Math.random() < (e.boss ? 1 : 0.06)) this.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, value: e.boss ? 60 : 20, life: 12, kind: "heal" });
  }

  private addXp(n: number) {
    this.xp += n;
    while (this.xp >= this.xpNext) { this.xp -= this.xpNext; this.level++; this.xpNext = Math.round(this.xpNext * 1.25 + 20); this.p.hp = Math.min(this.p.hpMax, this.p.hp + 8); }
  }

  private spawnParticles(x: number, y: number, n: number, color: string, kind: Particle["kind"], speed: number) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.25, 0.6), maxLife: 0.6, r: rand(1.5, 3.5), color, kind });
    }
  }

  private gameOver() { this.setState("gameover"); }

  private pushHud(force: boolean) {
    this.onHud({
      state: this.state, wave: this.wave, sector: this.sector, gold: Math.floor(this.gold), score: Math.floor(this.score),
      hp: Math.ceil(this.p.hp), hpMax: this.p.hpMax, coreHp: Math.ceil(this.core.hp), coreHpMax: this.core.hpMax,
      enemiesAlive: this.enemies.length, waveProgress: this.waveEnemies ? 1 - (this.spawnQueue.length + this.enemies.length) / this.waveEnemies : 0,
      level: this.level, kills: this.kills, banner: this.bannerT > 0 ? this.banner : "",
    });
  }

  // ---- render -----------------------------------------------------------
  private render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.w, this.h);
    // background
    ctx.fillStyle = this.col.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    this.drawGrid(ctx);
    this.drawCore(ctx);
    // pickups
    for (const g of this.pickups) {
      ctx.globalAlpha = Math.min(1, g.life);
      ctx.fillStyle = g.kind === "gold" ? this.col.accent : "#4ade80";
      ctx.shadowColor = ctx.fillStyle as string; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.kind === "gold" ? 4 : 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // sentries
    for (const s of this.sentries) this.drawSentry(ctx, s);
    // enemies
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    // enemy bullets
    ctx.shadowBlur = 8;
    for (const b of this.ebullets) { ctx.fillStyle = "#ff8a4c"; ctx.shadowColor = "#ff8a4c"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    // hero bullets
    for (const b of this.bullets) { const c = b.from === "sentry" ? this.col.accent2 : b.crit ? "#ffd84d" : this.col.accent; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;
    // player
    if (this.state !== "menu") this.drawPlayer(ctx);
    // particles
    this.drawParticles(ctx);
    ctx.restore();
    // vignette
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
    // core hp ring
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = frac > 0.5 ? this.col.accent : frac > 0.25 ? "#eab308" : "#ff5f6d";
    ctx.lineWidth = 3; ctx.shadowBlur = 0; ctx.stroke();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.p;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    ctx.shadowColor = this.col.accent2; ctx.shadowBlur = 18;
    ctx.fillStyle = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 ? "rgba(255,255,255,0.6)" : this.col.accent2;
    ctx.beginPath();
    ctx.moveTo(p.r, 0); ctx.lineTo(-p.r * 0.7, p.r * 0.7); ctx.lineTo(-p.r * 0.4, 0); ctx.lineTo(-p.r * 0.7, -p.r * 0.7);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // hp ring
    const frac = Math.max(0, p.hp / p.hpMax);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = frac > 0.5 ? this.col.accent2 : frac > 0.25 ? "#eab308" : "#ff5f6d";
    ctx.lineWidth = 2.5; ctx.shadowBlur = 0; ctx.stroke();
  }

  private drawSentry(ctx: CanvasRenderingContext2D, s: Sentry) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang);
    ctx.shadowColor = this.col.accent; ctx.shadowBlur = 10;
    ctx.fillStyle = this.col.accent;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = this.col.bg; ctx.fillRect(2, -2.5, 12, 5);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.ang + Math.PI / 2);
    ctx.shadowColor = e.color; ctx.shadowBlur = e.boss ? 30 : 12;
    ctx.fillStyle = e.hitFlash > 0 ? "#ffffff" : e.color;
    ctx.beginPath();
    if (e.kind === "brute" || e.boss) { const n = e.boss ? 8 : 6; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const rr = e.r * (i % 2 ? 0.7 : 1); const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); }
    else if (e.kind === "swift") { ctx.moveTo(0, -e.r); ctx.lineTo(e.r * 0.85, e.r); ctx.lineTo(-e.r * 0.85, e.r); ctx.closePath(); }
    else if (e.kind === "shooter") { ctx.rect(-e.r, -e.r, e.r * 2, e.r * 2); }
    else { ctx.arc(0, 0, e.r, 0, Math.PI * 2); }
    ctx.fill();
    ctx.restore();
    if (e.boss || e.hp < e.hpMax) {
      const w = e.r * 2, frac = Math.max(0, e.hp / e.hpMax);
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
      ctx.fillStyle = e.boss ? "#ff5f6d" : this.col.accent; ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * frac, 4);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const q of this.particles) {
      const a = Math.max(0, q.life / q.maxLife);
      if (q.kind === "text") {
        ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.font = `700 ${q.r}px ui-monospace, monospace`; ctx.textAlign = "center";
        ctx.fillText(q.text || "", q.x, q.y);
      } else if (q.kind === "ring") {
        ctx.globalAlpha = a * 0.7; ctx.strokeStyle = q.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1.4 - a) + 4, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = q.color; ctx.shadowColor = q.color; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
}
