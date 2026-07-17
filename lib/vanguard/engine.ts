// ============================================================================
//  Vanguard — core engine.
//
//  A first-person raycaster (classic DDA grid-march, à la Wolfenstein/DOOM)
//  rendered on a single <canvas> with 2D context — no WebGL, no textures to
//  download, everything procedural. It drives:
//    • movement + collision with sliding along walls
//    • hitscan weapon fire against walls, bots and remote players
//    • a rocket projectile with splash damage
//    • bot actors driven by lib/vanguard/ai.ts (also used for "auto-play")
//    • pickups (health/armor/ammo), respawns, kill feed, scoring
//    • campaign missions (objectives) and skirmish/deathmatch/TDM modes
//    • a thin hook surface for lib/vanguard/net.ts to drive online play
//
//  The class never touches React — it takes a canvas + callbacks and reports
//  state through them, exactly like the existing Rift engine, so the page
//  component stays a thin shell around it.
// ============================================================================

import { AudioEngine } from "./audio";
import { AiActor, BotMemory, DifficultyProfile, bfsNextStep, botName, difficultyById, newBotMemory, think } from "./ai";
import { GameMap, ItemSpawn, Vec2, isWall, mapById, materialById, pickSpawn } from "./maps";
import { PerkDef, WeaponDef, damageAtRange, perkById, weaponById } from "./weapons";
import { drawWeaponViewModel } from "./viewmodels";

// ---------------------------------------------------------------------------
//  Public types
// ---------------------------------------------------------------------------

export type GameMode = "campaign" | "skirmish" | "tdm" | "ffa";
export type MatchPhase = "lobby" | "countdown" | "playing" | "roundover" | "matchover";

export interface MatchConfig {
  mapId: string;
  mode: GameMode;
  botCount: number;
  difficulty: DifficultyProfile["id"];
  scoreLimit: number;   // kills (ffa/skirmish) or team score (tdm)
  timeLimitSec: number; // 0 = no limit
  missionId?: string;   // campaign only
  autoPlay: boolean;    // human slot is bot-piloted
  teams: boolean;       // whether actors are split red/blue
  undead?: boolean;     // when true the entire enemy force is the undead horde
}

// Enemies come in two flavours: armed human soldiers (ranged) and the undead
// horde (fast melee rushers). The mix per match is decided at spawn time.
export type EnemyKind = "human" | "zombie";

export interface ActorSnapshot {
  id: number;
  name: string;
  team: number;
  x: number;
  y: number;
  angle: number;
  health: number;
  armor: number;
  alive: boolean;
  kills: number;
  deaths: number;
  score: number;
  weaponId: string;
  isBot: boolean;
  isLocal: boolean;
}

export interface KillFeedEntry {
  id: number;
  killer: string;
  killerTeam: number;
  victim: string;
  victimTeam: number;
  weapon: string;
  headshot: boolean;
  t: number;
}

export interface HudState {
  phase: MatchPhase;
  countdown: number;
  health: number;
  maxHealth: number;
  armor: number;
  weaponName: string;
  weaponIcon: string;
  ammoInMag: number;
  ammoReserve: number;
  reloading: boolean;
  ads: boolean;
  crosshairSpread: number;
  hitMarker: number;       // fades from 1 -> 0
  damageFlash: number;     // fades from 1 -> 0
  lowHealth: boolean;
  killFeed: KillFeedEntry[];
  scoreboard: ActorSnapshot[];
  timeLeftSec: number;
  redScore: number;
  blueScore: number;
  localScore: number;
  objective: string;
  objectiveProgress: number; // 0..1
  compassAngle: number;
  minimapActors: { x: number; y: number; angle: number; team: number; isLocal: boolean; alive: boolean }[];
  bannerText: string;
  bannerT: number;
}

// ---------------------------------------------------------------------------
//  Internal actor model
// ---------------------------------------------------------------------------

interface Actor {
  id: number;
  name: string;
  team: number; // 0 = red/solo, 1 = blue
  x: number;
  y: number;
  angle: number;
  velX: number;
  velY: number;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  alive: boolean;
  respawnTimer: number;
  kills: number;
  deaths: number;
  score: number;
  weaponId: string;
  secondaryId: string;
  perk: string;
  magAmmo: Record<string, number>;
  reserveAmmo: Record<string, number>;
  reloadTimer: number;
  fireCooldown: number;
  bobPhase: number;
  isBot: boolean;
  isLocal: boolean;
  isRemote: boolean;
  mem: BotMemory;
  hurtFlash: number;
  ads: boolean;
  sprinting: boolean;
  recoilKick: number;
  lastDamager: number | null;
  radius: number;
  kind: EnemyKind;        // "human" soldier or "zombie" rusher
  attackCooldown: number; // zombie melee swing timer
  lungeT: number;         // 0..1 zombie attack-lunge animation
  gaitPhase: number;      // sprite limb-animation phase
  z: number;              // vertical height off the ground (jumping)
  velZ: number;           // vertical velocity
  crouch: number;         // 0 = standing, 1 = fully crouched (smoothed)
  landT: number;          // brief landing-dip animation timer
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: number;
  weapon: WeaponDef;
  life: number;
}

interface Decal {
  x: number;
  y: number;
  wallSide: "ns" | "ew";
  life: number;
  kind: "bullet" | "blood";
}

interface Particle {
  x: number;
  y: number;
  z: number; // height, purely cosmetic for muzzle sparks
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface PickupState extends ItemSpawn {
  taken: boolean;
  respawnTimer: number;
}

interface DroppedWeapon {
  id: number;
  x: number;
  y: number;
  weaponId: string;
  life: number;
}

export interface MissionDef {
  id: string;
  name: string;
  mapId: string;
  briefing: string;
  objective: string;
  kind: "eliminate" | "survive" | "hold";
  target: number; // kills needed / seconds to survive
  botCount: number;
  difficulty: DifficultyProfile["id"];
  reward: string;
}

export const MISSIONS: MissionDef[] = [
  { id: "m1", name: "First Contact", mapId: "killhouse", briefing: "A hostile cell has seized the Killhouse training shell. Clear it.", objective: "Eliminate 6 hostiles", kind: "eliminate", target: 6, botCount: 5, difficulty: "recruit", reward: "M4 Carbine unlocked" },
  { id: "m2", name: "Blacksite Breach", mapId: "blacksite", briefing: "Insert into the buried facility and neutralise the garrison.", objective: "Eliminate 10 hostiles", kind: "eliminate", target: 10, botCount: 7, difficulty: "regular", reward: "SPAS-12 unlocked" },
  { id: "m3", name: "Hold Downtown", mapId: "downtown", briefing: "Reinforcements are inbound. Survive the counter-attack.", objective: "Survive 180 seconds", kind: "survive", target: 180, botCount: 8, difficulty: "hardened", reward: "AK-74 unlocked" },
  { id: "m4", name: "Cargo Run", mapId: "cargo", briefing: "Hostiles guard the container yard. Take it back.", objective: "Eliminate 12 hostiles", kind: "eliminate", target: 12, botCount: 8, difficulty: "hardened", reward: "Barrett .50 unlocked" },
  { id: "m5", name: "Whiteout Siege", mapId: "whiteout", briefing: "A blizzard covers their approach — hold the line.", objective: "Survive 240 seconds", kind: "survive", target: 240, botCount: 9, difficulty: "veteran", reward: "M249 SAW unlocked" },
  { id: "m6", name: "Dust to Dust", mapId: "dustbowl", briefing: "Open ground, long sightlines. Push and clear.", objective: "Eliminate 14 hostiles", kind: "eliminate", target: 14, botCount: 10, difficulty: "veteran", reward: "SR-25 DMR unlocked" },
  { id: "m7", name: "Sanctum's Fall", mapId: "sanctum", briefing: "The final stronghold. Show no mercy.", objective: "Eliminate 18 hostiles", kind: "eliminate", target: 18, botCount: 12, difficulty: "nightmare", reward: "RPG-7 unlocked" },
  { id: "m8", name: "Overgrown", mapId: "overgrowth", briefing: "Reclaim the ruins street by street.", objective: "Survive 300 seconds", kind: "survive", target: 300, botCount: 12, difficulty: "nightmare", reward: "Vanguard Medal" },
];

export function missionById(id: string): MissionDef {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const FOV = Math.PI / 2.7;
// v2 — a much snappier, more aggressive base tempo than the original build.
const MOVE_SPEED = 4.6;
const SPRINT_MULT = 1.7;
const STRAFE_MULT = 0.94;
const PLAYER_RADIUS = 0.22;
const RESPAWN_TIME = 3.0;
const COUNTDOWN_TIME = 3;
const PICKUP_RESPAWN = 16;
const MAX_RENDER_DIST = 30;
const ARMOR_ABSORB = 0.5; // armor absorbs 50% of incoming damage until depleted

// --- Movement feel (v3): momentum + jumping + crouch --------------------
// Velocity is no longer snapped instantly to the input direction; instead the
// player accelerates toward a "wish" velocity and coasts to a stop, which
// gives real weight and lets you carry speed around corners.
const GROUND_ACCEL = 24;     // how fast we approach the wish velocity on foot (snappy)
const GROUND_FRICTION = 18;  // how fast we bleed speed when there's no input
const AIR_ACCEL = 6;         // limited air control while jumping
const GRAVITY = 20;          // world units / s^2 applied to the jump arc
const JUMP_VELOCITY = 6.6;   // initial upward velocity of a jump
const CROUCH_SPEED_MULT = 0.52;
const CROUCH_EYE_DROP = 0.34; // how far the camera lowers when fully crouched
const JUMP_EYE_RISE = 0.9;    // camera-height → screen-pitch scale while airborne

// Undead horde tuning.
const ZOMBIE_HEALTH = 70;
const ZOMBIE_SPEED_MULT = 1.12;   // relative to MOVE_SPEED — they are relentless
const ZOMBIE_MELEE_RANGE = 1.15;
const ZOMBIE_MELEE_DAMAGE = 26;
const ZOMBIE_MELEE_COOLDOWN = 0.9;

const ZOMBIE_NAMES = [
  "Walker", "Ghoul", "Rotter", "Husk", "Crawler", "Shambler", "Revenant", "Lurker",
  "Feral", "Gnasher", "Stalker", "Wretch", "Devourer", "Creeper", "Maw", "Cadaver",
];

// ---------------------------------------------------------------------------
//  Utility
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function normalizeAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

// ---------------------------------------------------------------------------
//  Net hook surface — implemented concretely by net.ts, kept optional here so
//  the engine runs perfectly well single-player with no network module at all.
// ---------------------------------------------------------------------------

export interface NetHooks {
  isHost: boolean;
  localId: number;
  sendShot?: (ox: number, oy: number, angle: number, weaponId: string, t: number) => void;
  sendState?: (snap: ActorSnapshot[]) => void;
  onRemoteMove?: (fn: (id: number, x: number, y: number, angle: number) => void) => void;
}

// ---------------------------------------------------------------------------
//  Engine
// ---------------------------------------------------------------------------

export interface EngineOptions {
  onHud: (h: HudState) => void;
  onPhase?: (p: MatchPhase) => void;
  onMatchOver?: (winnerTeam: number | null, mvpName: string) => void;
  net?: NetHooks;
}

export class VanguardEngine {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private lastT = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;

  private audio = new AudioEngine();
  private onHud: (h: HudState) => void;
  private onPhase?: (p: MatchPhase) => void;
  private onMatchOver?: (winnerTeam: number | null, mvpName: string) => void;
  private net?: NetHooks;

  map: GameMap;
  config: MatchConfig;
  mission: MissionDef | null = null;

  phase: MatchPhase = "lobby";
  private countdown = COUNTDOWN_TIME;
  private matchTime = 0;
  private missionTimer = 0;
  private missionKills = 0;

  private actors: Actor[] = [];
  private nextActorId = 1;
  private local: Actor;

  private projectiles: Projectile[] = [];
  private decals: Decal[] = [];
  private particles: Particle[] = [];
  private pickups: PickupState[] = [];
  private drops: DroppedWeapon[] = [];
  private nextDropId = 1;
  private nextProjId = 1;

  private keys = new Set<string>();
  private mouseDown = false;
  private rightDown = false;
  private mouseDX = 0;
  private pointerLocked = false;
  private sensitivity = 0.0022;
  // Forgiving jump timers so jumping feels responsive instead of dropping
  // inputs: coyote-time lets you still jump a beat after walking off an edge,
  // and the jump buffer fires a jump you pressed just before landing.
  private coyoteT = 0;
  private jumpBufferT = 0;

  private killFeed: KillFeedEntry[] = [];
  private nextKillId = 1;

  private hitMarker = 0;
  private damageFlash = 0;
  private zbuffer: Float64Array;
  private cols = 1;          // number of raycast columns (device-resolution)
  private wallX = new Float64Array(1); // per-column texture coordinate (0..1)
  private wallMat = new Int16Array(1); // per-column hit material id
  private wallSide = new Int8Array(1); // per-column wall side (0/1)

  private redScore = 0;
  private blueScore = 0;

  private bannerText = "";
  private bannerT = 0;

  private hudAcc = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, config: MatchConfig, opts: EngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.onHud = opts.onHud;
    this.onPhase = opts.onPhase;
    this.onMatchOver = opts.onMatchOver;
    this.net = opts.net;
    this.config = config;
    this.map = mapById(config.mapId);
    if (config.missionId) this.mission = missionById(config.missionId);
    this.zbuffer = new Float64Array(1);

    this.local = this.makeActor({
      name: "You",
      team: 0,
      isBot: !!config.autoPlay,
      isLocal: true,
      isRemote: false,
    });
    this.actors.push(this.local);

    this.spawnBotsAndPickups();
    this.resize();
    this.bindInput();

    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // -- setup ------------------------------------------------------------

  private makeActor(opts: { name: string; team: number; isBot: boolean; isLocal: boolean; isRemote: boolean; id?: number; kind?: EnemyKind }): Actor {
    const spawn = pickSpawn(this.map, this.actors.map((a) => ({ x: a.x, y: a.y })));
    const kind: EnemyKind = opts.kind ?? "human";
    const isZombie = kind === "zombie";
    // Zombies fight with their claws (the melee slot); humans carry a rifle.
    const primary = isZombie ? "knife" : opts.isBot ? this.pickBotWeapon() : "m4";
    const secondary = "sidearm";
    const maxHealth = isZombie ? ZOMBIE_HEALTH : 100;
    return {
      id: opts.id ?? this.nextActorId++,
      name: opts.name,
      team: opts.team,
      x: spawn.x,
      y: spawn.y,
      angle: rand(-Math.PI, Math.PI),
      velX: 0,
      velY: 0,
      health: maxHealth,
      maxHealth,
      armor: 0,
      maxArmor: 100,
      alive: true,
      respawnTimer: 0,
      kills: 0,
      deaths: 0,
      score: 0,
      weaponId: primary,
      secondaryId: secondary,
      perk: opts.isBot ? "" : "steady",
      magAmmo: { [primary]: weaponById(primary).magazine, [secondary]: weaponById(secondary).magazine },
      reserveAmmo: { [primary]: weaponById(primary).reserve, [secondary]: weaponById(secondary).reserve },
      reloadTimer: 0,
      fireCooldown: 0,
      bobPhase: Math.random() * 10,
      isBot: opts.isBot,
      isLocal: opts.isLocal,
      isRemote: opts.isRemote,
      mem: newBotMemory(),
      hurtFlash: 0,
      ads: false,
      sprinting: false,
      recoilKick: 0,
      lastDamager: null,
      radius: PLAYER_RADIUS,
      kind,
      attackCooldown: 0,
      lungeT: 0,
      gaitPhase: Math.random() * Math.PI * 2,
      z: 0,
      velZ: 0,
      crouch: 0,
      landT: 0,
    };
  }

  private pickBotWeapon(): string {
    const pool = ["m4", "ak", "vector", "mp5", "spas", "lmg"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private spawnBotsAndPickups() {
    let zi = 0;
    for (let i = 0; i < this.config.botCount; i++) {
      const team = this.config.teams ? i % 2 : 1;
      // Team modes stay human-vs-human; free-for-all / campaign fields a mix of
      // armed soldiers and the undead horde (all of them, if "undead" is set).
      const isZombie = !this.config.teams && (this.config.undead || Math.random() < 0.45);
      const name = isZombie ? ZOMBIE_NAMES[zi++ % ZOMBIE_NAMES.length] : botName(i);
      const bot = this.makeActor({ name, team, isBot: true, isLocal: false, isRemote: false, kind: isZombie ? "zombie" : "human" });
      this.actors.push(bot);
    }
    this.pickups = this.map.items.map((it) => ({ ...it, taken: false, respawnTimer: 0 }));
  }

  // -- resize / input -----------------------------------------------------

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // Render at true device resolution (capped at 2×) for a crisp image, and
    // cast one ray per *device* column rather than per CSS pixel so the world
    // is far sharper than the previous build.
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, Math.round(rect.width));
    this.h = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Cast one ray per device column, capped so very large / high-DPI screens
    // stay at a smooth frame-rate (still far sharper than the old CSS-pixel cast).
    this.cols = Math.max(1, Math.min(2048, Math.round(this.w * this.dpr)));
    this.zbuffer = new Float64Array(this.cols);
    this.wallX = new Float64Array(this.cols);
    this.wallMat = new Int16Array(this.cols);
    this.wallSide = new Int8Array(this.cols);
  }

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    // If focus is lost (alt-tab) a keyup may never arrive, which would leave a
    // movement key "stuck". Clear all held input whenever we lose focus.
    window.addEventListener("blur", this.onBlur);
  }

  private unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("blur", this.onBlur);
  }

  private onContextMenu = (e: Event) => e.preventDefault();
  private onBlur = () => { this.keys.clear(); this.mouseDown = false; this.rightDown = false; };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    // Space (jump) and the arrow keys would otherwise scroll the page.
    if (k === " " || k === "spacebar" || k.startsWith("arrow")) e.preventDefault();
    // Buffer the jump on the key event itself so a jump pressed a hair before
    // landing still fires the instant we touch down.
    if (k === " " || k === "spacebar") this.jumpBufferT = 0.14;
    if (k === "r") this.requestReload();
    if (k === "q") this.swapWeapon();
    if (k === "escape") this.releasePointer();
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  private onMouseDown = (e: MouseEvent) => {
    if (!this.pointerLocked) {
      this.requestPointer();
      return;
    }
    if (e.button === 0) this.mouseDown = true;
    if (e.button === 2) this.rightDown = true;
  };
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightDown = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseDX += e.movementX || 0;
  };
  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  requestPointer() {
    try {
      this.canvas.requestPointerLock();
    } catch {
      /* ignored — some browsers require a user gesture, retried on next click */
    }
  }
  releasePointer() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  // -- lifecycle ----------------------------------------------------------

  startCountdown() {
    this.phase = "countdown";
    this.countdown = COUNTDOWN_TIME;
    this.onPhase?.(this.phase);
    this.audio.init();
    this.audio.play("countdown");
  }

  private beginPlay() {
    this.phase = "playing";
    this.matchTime = 0;
    this.onPhase?.(this.phase);
    this.audio.startMusic();
  }

  pause() {
    if (this.phase === "playing") {
      this.phase = "roundover"; // reuse roundover visuals for a soft pause overlay
      this.onPhase?.(this.phase);
    }
  }
  resumeFromPause() {
    if (this.phase === "roundover" && this.matchTime > 0) {
      this.phase = "playing";
      this.onPhase?.(this.phase);
    }
  }

  setAutoPlay(on: boolean) {
    this.config.autoPlay = on;
    this.local.isBot = on;
    if (on) this.releasePointer();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
    this.audio.dispose();
    this.releasePointer();
  }

  // -- weapon control -------------------------------------------------------

  private requestReload() {
    const a = this.local;
    if (!a.alive || a.reloadTimer > 0) return;
    const w = weaponById(a.weaponId);
    if (a.magAmmo[a.weaponId] >= w.magazine) return;
    if ((a.reserveAmmo[a.weaponId] || 0) <= 0) return;
    a.reloadTimer = w.reloadTime * (a.perk === "quickhands" ? 0.7 : 1);
    this.audio.play("reload");
  }

  private swapWeapon() {
    const a = this.local;
    const tmp = a.weaponId;
    a.weaponId = a.secondaryId;
    a.secondaryId = tmp;
    a.reloadTimer = 0;
    a.fireCooldown = Math.max(a.fireCooldown, 0.25);
  }

  selectWeapon(id: string) {
    const a = this.local;
    if (a.weaponId === id) return;
    if (a.secondaryId === id) {
      this.swapWeapon();
      return;
    }
    a.secondaryId = a.weaponId;
    a.weaponId = id;
    if (a.magAmmo[id] === undefined) {
      const w = weaponById(id);
      a.magAmmo[id] = w.magazine;
      a.reserveAmmo[id] = w.reserve;
    }
    a.reloadTimer = 0;
  }

  setPerk(id: string) {
    this.local.perk = id;
  }

  // -- main loop ------------------------------------------------------------

  private loop(t: number) {
    if (this.disposed) return;
    if (!this.lastT) this.lastT = t;
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (dt > 0.05) dt = 0.05;

    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) this.beginPlay();
    } else if (this.phase === "playing") {
      this.update(dt);
    }

    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.hitMarker > 0) this.hitMarker = Math.max(0, this.hitMarker - dt * 2.6);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);

    this.render();

    this.hudAcc += dt;
    if (this.hudAcc > 0.05) {
      this.pushHud();
      this.hudAcc = 0;
    }

    this.raf = requestAnimationFrame(this.loop);
  }

  private setBanner(text: string, dur = 2.4) {
    this.bannerText = text;
    this.bannerT = dur;
  }

  // -- update ---------------------------------------------------------------

  private update(dt: number) {
    this.matchTime += dt;

    for (const actor of this.actors) {
      if (actor.respawnTimer > 0) {
        actor.respawnTimer -= dt;
        if (actor.respawnTimer <= 0) this.respawn(actor);
        continue;
      }
      if (!actor.alive) continue;

      if (actor.isLocal && !actor.isBot) this.updateLocalInput(actor, dt);
      else if (actor.isBot) this.updateBot(actor, dt);
      // remote actors are moved directly by net.ts via applyRemoteState()

      this.integrateActor(actor, dt);

      if (actor.reloadTimer > 0) {
        actor.reloadTimer -= dt;
        if (actor.reloadTimer <= 0) this.finishReload(actor);
      }
      if (actor.fireCooldown > 0) actor.fireCooldown -= dt;
      if (actor.recoilKick > 0) actor.recoilKick = Math.max(0, actor.recoilKick - dt * 4);
      if (actor.hurtFlash > 0) actor.hurtFlash -= dt;

      const perk = perkById(actor.perk);
      if (perk.id === "medic" && actor.health < actor.maxHealth) {
        actor.health = Math.min(actor.maxHealth, actor.health + dt * 6);
      } else if (actor.health < actor.maxHealth) {
        actor.health = Math.min(actor.maxHealth, actor.health + dt * 1.2);
      }
    }

    this.updateProjectiles(dt);
    this.updateParticles(dt);
    this.updatePickups(dt);
    this.updateDrops(dt);
    this.checkMissionProgress();
    this.checkMatchEnd();
  }

  private updateLocalInput(a: Actor, dt: number) {
    let mx = 0;
    let my = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) my += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) my -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) mx += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) mx -= 1;

    a.angle = normalizeAngle(a.angle + this.mouseDX * this.sensitivity);
    this.mouseDX = 0;

    const onGround = a.z <= 1e-4;
    const wantsCrouch = this.keys.has("control") || this.keys.has("c");
    // Smoothly blend the crouch pose so the camera glides down/up.
    a.crouch += (( wantsCrouch ? 1 : 0) - a.crouch) * Math.min(1, dt * 12);

    a.ads = this.rightDown;
    a.sprinting = this.keys.has("shift") && my > 0 && !a.ads && !wantsCrouch && onGround;

    const speedMult =
      weaponById(a.weaponId).moveMult *
      (a.sprinting ? SPRINT_MULT : 1) *
      (a.ads ? 0.55 : 1) *
      (a.crouch > 0.5 ? CROUCH_SPEED_MULT : 1);

    // Build the desired ("wish") velocity from input, then accelerate toward
    // it instead of snapping — this is what gives the movement momentum.
    let wishX = 0;
    let wishY = 0;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      const forward = { x: Math.cos(a.angle), y: Math.sin(a.angle) };
      const right = { x: Math.cos(a.angle + Math.PI / 2), y: Math.sin(a.angle + Math.PI / 2) };
      const dirX = forward.x * my + right.x * mx * STRAFE_MULT;
      const dirY = forward.y * my + right.y * mx * STRAFE_MULT;
      const dl = Math.hypot(dirX, dirY) || 1;
      wishX = (dirX / dl) * MOVE_SPEED * speedMult;
      wishY = (dirY / dl) * MOVE_SPEED * speedMult;
    }

    const rate = onGround ? (len > 0 ? GROUND_ACCEL : GROUND_FRICTION) : AIR_ACCEL;
    const k = Math.min(1, rate * dt);
    a.velX += (wishX - a.velX) * k;
    a.velY += (wishY - a.velY) * k;

    // Jump — with coyote-time + input buffering so it never feels dropped.
    if (onGround) this.coyoteT = 0.1; else this.coyoteT = Math.max(0, this.coyoteT - dt);
    if (this.jumpBufferT > 0) this.jumpBufferT = Math.max(0, this.jumpBufferT - dt);
    const holdingJump = this.keys.has(" ") || this.keys.has("spacebar");
    if ((this.jumpBufferT > 0 || holdingJump) && this.coyoteT > 0 && a.velZ <= 0) {
      a.velZ = JUMP_VELOCITY;
      this.coyoteT = 0;
      this.jumpBufferT = 0;
      this.audio.play("pickup", 0.25);
    }

    // Head-bob speed scales with how fast we're actually moving.
    const speed = Math.hypot(a.velX, a.velY);
    a.bobPhase += dt * (speed > 0.2 ? (a.sprinting ? 12 : 8) * (0.4 + speed / (MOVE_SPEED * 1.7)) : 3);
    if (a.landT > 0) a.landT = Math.max(0, a.landT - dt * 4);

    if (this.mouseDown) this.tryFire(a);
    if (a.magAmmo[a.weaponId] <= 0 && this.mouseDown) this.requestReload();
  }

  private updateBot(a: Actor, dt: number) {
    if (a.kind === "zombie") {
      this.updateZombie(a, dt);
      return;
    }
    const profile = difficultyById(this.config.difficulty);
    const w = weaponById(a.weaponId);
    const aiActors: AiActor[] = this.actors
      .filter((o) => o !== a && o.alive)
      .map((o) => ({ x: o.x, y: o.y, angle: o.angle, health: o.health, maxHealth: o.maxHealth, alive: o.alive, team: o.team }));

    const intent = think({
      map: this.map,
      self: { x: a.x, y: a.y, angle: a.angle, health: a.health, maxHealth: a.maxHealth, alive: a.alive, team: a.team },
      mem: a.mem,
      actors: aiActors,
      profile,
      dt,
      magEmpty: a.magAmmo[a.weaponId] <= 0,
      reserveEmpty: (a.reserveAmmo[a.weaponId] || 0) <= 0,
      preferredRange: Math.min(w.falloffEnd, 14),
    });

    a.angle = intent.aim;
    const speedMult = w.moveMult * (intent.wantsSprint ? 1.25 : 1) * profile.aggression * 0.4 + w.moveMult * 0.6;
    const len = Math.hypot(intent.moveX, intent.moveY);
    if (len > 0.01) {
      a.velX = (intent.moveX / len) * MOVE_SPEED * speedMult;
      a.velY = (intent.moveY / len) * MOVE_SPEED * speedMult;
      a.bobPhase += dt * 8;
    } else {
      a.velX = 0;
      a.velY = 0;
    }

    if (intent.wantsReload) this.reloadActor(a);
    if (intent.wantsFire && a.fireCooldown <= 0 && a.magAmmo[a.weaponId] > 0) this.fireWeapon(a);
  }

  // Undead brain: no guns, no cover, no restraint — pathfind straight to the
  // nearest living enemy and claw at it on a short cooldown.
  private updateZombie(a: Actor, dt: number) {
    if (a.attackCooldown > 0) a.attackCooldown -= dt;
    if (a.lungeT > 0) a.lungeT = Math.max(0, a.lungeT - dt * 3);

    let target: Actor | null = null;
    let best = Infinity;
    for (const o of this.actors) {
      if (o === a || !o.alive || o.team === a.team) continue;
      const d = Math.hypot(o.x - a.x, o.y - a.y);
      if (d < best) { best = d; target = o; }
    }
    if (!target) {
      a.velX = 0;
      a.velY = 0;
      return;
    }

    const desired = Math.atan2(target.y - a.y, target.x - a.x);
    a.angle = normalizeAngle(a.angle + normalizeAngle(desired - a.angle) * 0.2);

    if (best > ZOMBIE_MELEE_RANGE * 0.85) {
      a.mem.repathTimer -= dt;
      if (a.mem.repathTimer <= 0 || !a.mem.path) {
        a.mem.path = bfsNextStep(this.map, { x: a.x, y: a.y }, { x: target.x, y: target.y });
        a.mem.repathTimer = 0.3;
      }
      const step = a.mem.path || { x: target.x, y: target.y };
      const moveAng = Math.atan2(step.y - a.y, step.x - a.x);
      const spd = MOVE_SPEED * ZOMBIE_SPEED_MULT;
      a.velX = Math.cos(moveAng) * spd;
      a.velY = Math.sin(moveAng) * spd;
      a.gaitPhase += dt * 11;
    } else {
      a.velX = 0;
      a.velY = 0;
      if (a.attackCooldown <= 0) {
        a.attackCooldown = ZOMBIE_MELEE_COOLDOWN;
        a.lungeT = 1;
        this.applyDamage(target, ZOMBIE_MELEE_DAMAGE, a, false, "Claws");
        this.spawnBlood(target.x, target.y);
        if (target.isLocal) this.audio.play("hurt", 0.95);
        this.audio.play("knife", 0.35);
      }
    }
  }

  private integrateActor(a: Actor, dt: number) {
    if (a.isRemote) return; // net.ts positions remote actors directly
    // Defensive: a stray NaN in velocity/height would otherwise freeze the
    // actor in place forever (onGround compares against NaN). Scrub it.
    if (!Number.isFinite(a.velX)) a.velX = 0;
    if (!Number.isFinite(a.velY)) a.velY = 0;
    if (!Number.isFinite(a.velZ)) a.velZ = 0;
    if (!Number.isFinite(a.z)) a.z = 0;
    const nx = a.x + a.velX * dt;
    const ny = a.y + a.velY * dt;

    // Axis-separated collision so the actor slides along walls instead of
    // sticking when moving diagonally into a corner.
    if (!this.solidCircle(nx, a.y, a.radius)) a.x = nx;
    if (!this.solidCircle(a.x, ny, a.radius)) a.y = ny;

    // Vertical motion (jump arc). Only the human/bots with velZ ever leave the
    // floor; everyone else keeps z pinned at 0 with no cost.
    if (a.z > 0 || a.velZ !== 0) {
      a.velZ -= GRAVITY * dt;
      a.z += a.velZ * dt;
      if (a.z <= 0) {
        if (a.velZ < -3) a.landT = 1; // trigger a small landing dip
        a.z = 0;
        a.velZ = 0;
      }
    }
  }

  private solidCircle(x: number, y: number, r: number): boolean {
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const minY = Math.floor(y - r);
    const maxY = Math.floor(y + r);
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (!isWall(this.map, tx, ty)) continue;
        const cx = clamp(x, tx, tx + 1);
        const cy = clamp(y, ty, ty + 1);
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  }

  // -- combat -----------------------------------------------------------------

  private tryFire(a: Actor) {
    if (a.fireCooldown > 0) return;
    const w = weaponById(a.weaponId);
    if (a.magAmmo[a.weaponId] <= 0) {
      if (a.isLocal) this.audio.play("empty", 0.6);
      return;
    }
    if (!w.auto && this.mouseDown && a.fireCooldown > -0.001 && a.lastDamager === -999) return;
    this.fireWeapon(a);
    if (!w.auto) {
      // semi-auto: consume the click so holding doesn't full-auto it
      a.lastDamager = -999;
    }
  }

  private reloadActor(a: Actor) {
    if (a.reloadTimer > 0) return;
    const w = weaponById(a.weaponId);
    if (a.magAmmo[a.weaponId] >= w.magazine) return;
    if ((a.reserveAmmo[a.weaponId] || 0) <= 0) return;
    a.reloadTimer = w.reloadTime;
  }

  private finishReload(a: Actor) {
    const w = weaponById(a.weaponId);
    const need = w.magazine - a.magAmmo[a.weaponId];
    const take = Math.min(need, a.reserveAmmo[a.weaponId] || 0);
    a.magAmmo[a.weaponId] += take;
    a.reserveAmmo[a.weaponId] = (a.reserveAmmo[a.weaponId] || 0) - take;
  }

  private fireWeapon(a: Actor) {
    const w = weaponById(a.weaponId);
    a.magAmmo[a.weaponId] -= 1;
    const rate = w.auto ? 60 / w.rpm : 60 / w.rpm;
    a.fireCooldown = rate;
    a.recoilKick = Math.min(1, a.recoilKick + w.recoil * 20);

    if (a.isLocal) {
      this.audio.play(w.sound, 0.9);
      this.hitMarker = 0; // reset; set again below if we actually connect
    }

    if (w.category === "melee") {
      this.meleeAttack(a, w);
      return;
    }
    if (w.category === "launcher") {
      this.launchProjectile(a, w);
      return;
    }

    const spread = a.ads ? w.adsSpread : w.spread;
    const steady = a.perk === "steady" ? 0.65 : 1;
    for (let p = 0; p < w.pellets; p++) {
      const jitter = (Math.random() - 0.5) * spread * 2 * steady;
      const angle = a.angle + jitter;
      this.hitscan(a, angle, w);
    }

    if (this.net?.sendShot && a.isLocal) {
      this.net.sendShot(a.x, a.y, a.angle, w.id, this.matchTime);
    }
  }

  private meleeAttack(a: Actor, w: WeaponDef) {
    for (const target of this.actors) {
      if (target === a || !target.alive) continue;
      const dx = target.x - a.x;
      const dy = target.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist > w.range) continue;
      const ang = Math.abs(normalizeAngle(Math.atan2(dy, dx) - a.angle));
      if (ang > 0.9) continue;
      this.applyDamage(target, w.damage, a, false, w.name);
      if (a.isLocal) this.hitMarker = 1;
    }
    if (a.isLocal) this.audio.play("knife", 0.9);
  }

  private launchProjectile(a: Actor, w: WeaponDef) {
    this.projectiles.push({
      id: this.nextProjId++,
      x: a.x + Math.cos(a.angle) * 0.35,
      y: a.y + Math.sin(a.angle) * 0.35,
      vx: Math.cos(a.angle) * 14,
      vy: Math.sin(a.angle) * 14,
      ownerId: a.id,
      weapon: w,
      life: 6,
    });
    if (a.isLocal) this.audio.play("rocket", 0.9);
  }

  // Cast a ray from `a` and resolve the first hit — wall or actor — applying
  // damage/decal accordingly. Uses simple fixed-step marching (cheap and
  // accurate enough at these ranges; the DDA version is used for rendering).
  private hitscan(a: Actor, angle: number, w: WeaponDef) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const step = 0.04;
    const maxDist = w.range;
    let dist = 0;
    let hitActor: Actor | null = null;

    while (dist < maxDist) {
      dist += step;
      const px = a.x + dirX * dist;
      const py = a.y + dirY * dist;
      if (isWall(this.map, Math.floor(px), Math.floor(py))) {
        this.decals.push({ x: px, y: py, wallSide: Math.abs(dirX) > Math.abs(dirY) ? "ew" : "ns", life: 14, kind: "bullet" });
        this.spawnSpark(px, py);
        break;
      }
      for (const target of this.actors) {
        if (target === a || !target.alive) continue;
        const ddx = px - target.x;
        const ddy = py - target.y;
        if (ddx * ddx + ddy * ddy <= target.radius * target.radius) {
          hitActor = target;
          break;
        }
      }
      if (hitActor) break;
    }

    if (hitActor) {
      const headshot = Math.random() < 0.16 * (a.isBot ? 0.6 : 1);
      const dmg = damageAtRange(w, dist) * (headshot ? w.headMult : 1);
      this.applyDamage(hitActor, dmg, a, headshot, w.name);
      this.spawnBlood(hitActor.x, hitActor.y);
      if (a.isLocal) {
        this.hitMarker = 1;
        this.audio.play(headshot ? "headshot" : "hit", 0.8);
      }
    }
  }

  private spawnSpark(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(0.6, 2.2);
      this.particles.push({ x, y, z: 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(0.2, 1), life: rand(0.15, 0.4), maxLife: 0.4, color: "#ffd76b", size: 3 });
    }
  }
  private spawnBlood(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(0.4, 1.6);
      this.particles.push({ x, y, z: 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(0.1, 0.7), life: rand(0.3, 0.7), maxLife: 0.7, color: "#e0393f", size: 3.4 });
    }
  }
  private spawnExplosion(x: number, y: number) {
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(1.5, 5);
      this.particles.push({ x, y, z: 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(0.5, 2.5), life: rand(0.4, 0.9), maxLife: 0.9, color: Math.random() < 0.5 ? "#f97316" : "#fde68a", size: rand(3, 6) });
    }
  }

  private applyDamage(target: Actor, dmg: number, from: Actor, headshot: boolean, weaponName: string) {
    if (!target.alive) return;
    let remaining = dmg;
    if (target.armor > 0) {
      const absorbed = Math.min(target.armor, remaining * ARMOR_ABSORB);
      target.armor -= absorbed;
      remaining -= absorbed;
    }
    target.health -= remaining;
    target.hurtFlash = 0.35;
    target.lastDamager = from.id;
    if (target.isLocal) {
      this.damageFlash = 1;
      this.audio.play("hurt", 0.7);
    }
    if (target.health <= 0) this.killActor(target, from, headshot, weaponName);
  }

  private killActor(target: Actor, killer: Actor, headshot: boolean, weaponName: string) {
    target.alive = false;
    target.health = 0;
    target.deaths += 1;
    target.respawnTimer = RESPAWN_TIME;

    if (killer !== target) {
      killer.kills += 1;
      killer.score += headshot ? 150 : 100;
      if (killer.perk === "scavenger") {
        const w = weaponById(killer.weaponId);
        killer.reserveAmmo[killer.weaponId] = Math.min(w.reserve, (killer.reserveAmmo[killer.weaponId] || 0) + Math.round(w.magazine * 0.3));
      }
      if (this.config.teams) {
        if (killer.team === 0) this.redScore += 1;
        else this.blueScore += 1;
      }
      if (killer.isLocal) {
        this.missionKills += 1;
        this.audio.play("kill", 0.8);
      }
    }

    this.killFeed.unshift({
      id: this.nextKillId++,
      killer: killer.name,
      killerTeam: killer.team,
      victim: target.name,
      victimTeam: target.team,
      weapon: weaponName,
      headshot,
      t: this.matchTime,
    });
    if (this.killFeed.length > 6) this.killFeed.pop();

    // Drop the victim's current weapon on the floor if it isn't a starter.
    if (target.weaponId !== "sidearm" && target.weaponId !== "knife") {
      this.drops.push({ id: this.nextDropId++, x: target.x, y: target.y, weaponId: target.weaponId, life: 30 });
    }
  }

  private respawn(a: Actor) {
    const spawn = pickSpawn(this.map, this.actors.filter((o) => o !== a && o.alive).map((o) => ({ x: o.x, y: o.y })));
    a.x = spawn.x;
    a.y = spawn.y;
    a.angle = rand(-Math.PI, Math.PI);
    a.health = a.maxHealth;
    a.armor = 0;
    a.alive = true;
    a.velX = 0;
    a.velY = 0;
    if (a.isLocal) this.audio.play("spawn", 0.6);
  }

  // -- projectiles / pickups / drops ------------------------------------------

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      let exploded = false;
      if (isWall(this.map, Math.floor(nx), Math.floor(ny))) exploded = true;
      p.x = nx;
      p.y = ny;

      if (!exploded) {
        for (const target of this.actors) {
          if (target.id === p.ownerId || !target.alive) continue;
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          if (dx * dx + dy * dy <= target.radius * target.radius) {
            exploded = true;
            break;
          }
        }
      }

      if (exploded || p.life <= 0) {
        this.explodeProjectile(p);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private explodeProjectile(p: Projectile) {
    this.spawnExplosion(p.x, p.y);
    const owner = this.actors.find((a) => a.id === p.ownerId);
    if (!owner) return;
    if (owner.isLocal) this.audio.play("explosion", 1);
    const splash = p.weapon.splash || 0;
    for (const target of this.actors) {
      if (!target.alive) continue;
      const dist = Math.hypot(target.x - p.x, target.y - p.y);
      if (dist > splash) continue;
      // Simple line-of-sight-free splash (walls do partially block irl, but a
      // soft falloff keeps rocket duels readable and fun rather than punishing).
      const falloff = 1 - dist / splash;
      const dmg = p.weapon.damage * falloff;
      if (dmg > 1) this.applyDamage(target, dmg, owner, false, p.weapon.name);
    }
  }

  private updatePickups(dt: number) {
    for (const pk of this.pickups) {
      if (!pk.taken) {
        for (const a of this.actors) {
          if (!a.alive) continue;
          const dist = Math.hypot(a.x - pk.x, a.y - pk.y);
          if (dist < 0.5) {
            this.collectPickup(a, pk);
          }
        }
      } else {
        pk.respawnTimer -= dt;
        if (pk.respawnTimer <= 0) pk.taken = false;
      }
    }
  }

  private collectPickup(a: Actor, pk: PickupState) {
    let took = false;
    if (pk.kind === "health" && a.health < a.maxHealth) {
      a.health = Math.min(a.maxHealth, a.health + 50);
      took = true;
    } else if (pk.kind === "armor" && a.armor < a.maxArmor) {
      a.armor = Math.min(a.maxArmor, a.armor + 50);
      took = true;
    } else if (pk.kind === "ammo") {
      const w = weaponById(a.weaponId);
      a.reserveAmmo[a.weaponId] = Math.min(w.reserve, (a.reserveAmmo[a.weaponId] || 0) + Math.round(w.reserve * 0.5));
      took = true;
    }
    if (took) {
      pk.taken = true;
      pk.respawnTimer = PICKUP_RESPAWN;
      if (a.isLocal) this.audio.play("pickup", 0.7);
    }
  }

  private updateDrops(dt: number) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      let consumed = false;
      for (const a of this.actors) {
        if (!a.alive) continue;
        const dist = Math.hypot(a.x - d.x, a.y - d.y);
        if (dist < 0.5) {
          this.pickWeaponFromDrop(a, d);
          consumed = true;
          break;
        }
      }
      if (consumed || d.life <= 0) this.drops.splice(i, 1);
    }
  }

  private pickWeaponFromDrop(a: Actor, d: DroppedWeapon) {
    if (a.weaponId === d.weaponId) return;
    a.secondaryId = a.weaponId;
    a.weaponId = d.weaponId;
    const w = weaponById(d.weaponId);
    if (a.magAmmo[d.weaponId] === undefined) {
      a.magAmmo[d.weaponId] = w.magazine;
      a.reserveAmmo[d.weaponId] = w.reserve;
    }
    if (a.isLocal) this.audio.play("pickup", 0.7);
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= dt * 3;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      this.decals[i].life -= dt;
      if (this.decals[i].life <= 0) this.decals.splice(i, 1);
    }
  }

  // -- mission / match progress -------------------------------------------

  private checkMissionProgress() {
    if (this.config.mode !== "campaign" || !this.mission) return;
    if (this.mission.kind === "survive") {
      this.missionTimer += 0; // matchTime already tracks this
      if (this.matchTime >= this.mission.target) this.finishMission(true);
    } else if (this.mission.kind === "eliminate") {
      if (this.missionKills >= this.mission.target) this.finishMission(true);
    }
    if (!this.local.alive && this.local.respawnTimer > 0 && this.mission.kind === "survive") {
      // dying during a survive mission simply respawns — no fail state, keeps
      // the "self-play" loop friendly for spectating.
    }
  }

  private missionDone = false;
  private finishMission(success: boolean) {
    if (this.missionDone) return;
    this.missionDone = true;
    this.phase = "matchover";
    this.onPhase?.(this.phase);
    this.audio.stopMusic();
    this.audio.play(success ? "victory" : "defeat");
    this.onMatchOver?.(success ? this.local.team : null, this.local.name);
  }

  private matchDone = false;
  private checkMatchEnd() {
    if (this.config.mode === "campaign" || this.matchDone) return;
    let over = false;
    let winner: number | null = null;

    if (this.config.teams) {
      if (this.redScore >= this.config.scoreLimit) { over = true; winner = 0; }
      else if (this.blueScore >= this.config.scoreLimit) { over = true; winner = 1; }
    } else {
      const top = [...this.actors].sort((a, b) => b.kills - a.kills)[0];
      if (top && top.kills >= this.config.scoreLimit) { over = true; winner = top.team; }
    }
    if (this.config.timeLimitSec > 0 && this.matchTime >= this.config.timeLimitSec) {
      over = true;
      if (winner === null) {
        if (this.config.teams) winner = this.redScore === this.blueScore ? null : this.redScore > this.blueScore ? 0 : 1;
        else {
          const top = [...this.actors].sort((a, b) => b.kills - a.kills)[0];
          winner = top ? top.team : null;
        }
      }
    }
    if (over) {
      this.matchDone = true;
      this.phase = "matchover";
      this.onPhase?.(this.phase);
      this.audio.stopMusic();
      const mvp = [...this.actors].sort((a, b) => b.score - a.score)[0];
      const localWon = this.config.teams ? winner === this.local.team : mvp === this.local;
      this.audio.play(localWon ? "victory" : "defeat");
      this.onMatchOver?.(winner, mvp ? mvp.name : "—");
    }
  }

  // -- net integration ---------------------------------------------------

  applyRemoteShot(x: number, y: number, angle: number, weaponId: string, ownerId: number) {
    const owner = this.actors.find((a) => a.id === ownerId);
    if (!owner) return;
    const w = weaponById(weaponId);
    this.hitscan(owner, angle, w);
  }

  registerRemoteActor(id: number, name: string, team: number): void {
    const existing = this.actors.find((a) => a.id === id);
    if (existing) return;
    const a = this.makeActor({ name, team, isBot: false, isLocal: false, isRemote: true, id });
    this.actors.push(a);
  }

  removeActor(id: number) {
    this.actors = this.actors.filter((a) => a.id !== id);
  }

  applyRemoteState(id: number, x: number, y: number, angle: number, health: number, alive: boolean) {
    const a = this.actors.find((act) => act.id === id);
    if (!a) return;
    a.x = x;
    a.y = y;
    a.angle = angle;
    a.health = health;
    a.alive = alive;
  }

  getLocalSnapshot(): ActorSnapshot {
    return this.snapshotOf(this.local);
  }

  private snapshotOf(a: Actor): ActorSnapshot {
    return {
      id: a.id, name: a.name, team: a.team, x: a.x, y: a.y, angle: a.angle,
      health: a.health, armor: a.armor, alive: a.alive, kills: a.kills, deaths: a.deaths,
      score: a.score, weaponId: a.weaponId, isBot: a.isBot, isLocal: a.isLocal,
    };
  }

  // -- HUD push -----------------------------------------------------------

  private pushHud() {
    const a = this.local;
    const w = weaponById(a.weaponId);
    const spread = (a.ads ? w.adsSpread : w.spread) * (1 + a.recoilKick * 0.6);

    let objective = "";
    let objectiveProgress = 0;
    if (this.config.mode === "campaign" && this.mission) {
      objective = this.mission.objective;
      objectiveProgress = this.mission.kind === "survive"
        ? clamp(this.matchTime / this.mission.target, 0, 1)
        : clamp(this.missionKills / this.mission.target, 0, 1);
    } else if (this.config.teams) {
      objective = `First to ${this.config.scoreLimit}`;
      objectiveProgress = clamp(Math.max(this.redScore, this.blueScore) / this.config.scoreLimit, 0, 1);
    } else {
      const top = Math.max(0, ...this.actors.map((x) => x.kills));
      objective = `First to ${this.config.scoreLimit} kills`;
      objectiveProgress = clamp(top / this.config.scoreLimit, 0, 1);
    }

    const timeLeft = this.config.timeLimitSec > 0 ? Math.max(0, this.config.timeLimitSec - this.matchTime) : 0;

    this.onHud({
      phase: this.phase,
      countdown: Math.max(0, Math.ceil(this.countdown)),
      health: Math.max(0, Math.ceil(a.health)),
      maxHealth: a.maxHealth,
      armor: Math.ceil(a.armor),
      weaponName: w.name,
      weaponIcon: w.icon,
      ammoInMag: Math.max(0, a.magAmmo[a.weaponId] ?? 0),
      ammoReserve: Math.max(0, a.reserveAmmo[a.weaponId] ?? 0),
      reloading: a.reloadTimer > 0,
      ads: a.ads,
      crosshairSpread: spread,
      hitMarker: this.hitMarker,
      damageFlash: this.damageFlash,
      lowHealth: a.health < a.maxHealth * 0.3,
      killFeed: this.killFeed,
      scoreboard: [...this.actors].sort((x, y) => y.score - x.score).map((x) => this.snapshotOf(x)),
      timeLeftSec: Math.ceil(timeLeft),
      redScore: this.redScore,
      blueScore: this.blueScore,
      localScore: a.score,
      objective,
      objectiveProgress,
      compassAngle: a.angle,
      minimapActors: this.actors.map((x) => ({ x: x.x, y: x.y, angle: x.angle, team: x.team, isLocal: x.isLocal, alive: x.alive })),
      bannerText: this.bannerT > 0 ? this.bannerText : "",
      bannerT: Math.max(0, this.bannerT),
    });
  }

  // -- render ---------------------------------------------------------------

  private render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.save();
    ctx.clearRect(0, 0, w, h);

    const a = this.local;
    const bobY = Math.sin(a.bobPhase) * (Math.hypot(a.velX, a.velY) > 0.1 ? 3.5 : 0.6);
    // Camera pitch shifts the horizon: jumping raises the eye (see more floor),
    // crouching lowers it, and a fresh landing gives a short downward dip.
    const camZ = a.z * JUMP_EYE_RISE - a.crouch * CROUCH_EYE_DROP;
    const landDip = a.landT > 0 ? Math.sin(a.landT * Math.PI) * 12 : 0;
    const horizon = h / 2 + bobY - camZ * (h * 0.26) + landDip;

    // sky/ceiling — a vertical gradient adds real depth vs the old flat fill.
    const ceil = ctx.createLinearGradient(0, 0, 0, horizon);
    ceil.addColorStop(0, shadeColor(this.map.ceilingColor, 1.18));
    ceil.addColorStop(1, shadeColor(this.map.ceilingColor, 0.66));
    ctx.fillStyle = ceil;
    ctx.fillRect(0, 0, w, horizon);
    // floor — brightest underfoot, fading toward the fogged horizon.
    const floor = ctx.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, shadeColor(this.map.floorColor, 0.6));
    floor.addColorStop(1, shadeColor(this.map.floorColor, 1.12));
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, w, h - horizon);

    this.castWalls(ctx, a, w, horizon, h);
    this.drawSprites(ctx, a, w, horizon, h);

    // fog vignette
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
    grad.addColorStop(0, "transparent");
    grad.addColorStop(1, this.map.fogColor + "");
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;

    // First-person weapon viewmodel (hidden while scoped in).
    if (a.alive && !a.ads) this.drawViewModel(ctx, a, w, h);

    if (a.ads) {
      const wpn = weaponById(a.weaponId);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      const zoom = wpn.adsZoom;
      const scopeR = Math.min(w, h) * 0.42 / Math.sqrt(zoom);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(w / 2, h / 2, scopeR, 0, Math.PI * 2);
      ctx.fill("evenodd");
    }

    if (this.damageFlash > 0) {
      ctx.fillStyle = `rgba(220,30,30,${0.28 * this.damageFlash})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  // DOOM-style DDA raycaster: march a ray per screen column through the grid,
  // stepping to the next vertical/horizontal grid line each iteration and
  // taking whichever is closer, until a wall tile is hit.
  private castWalls(ctx: CanvasRenderingContext2D, a: Actor, w: number, horizon: number, h: number) {
    const map = this.map;
    const dirX = Math.cos(a.angle);
    const dirY = Math.sin(a.angle);
    const planeX = Math.cos(a.angle + Math.PI / 2) * Math.tan(FOV / 2);
    const planeY = Math.sin(a.angle + Math.PI / 2) * Math.tan(FOV / 2);
    const cols = this.cols;
    const colW = w / cols;

    for (let c = 0; c < cols; c++) {
      const camX = (2 * c) / cols - 1;
      const rayDirX = dirX + planeX * camX;
      const rayDirY = dirY + planeY * camX;

      let mapX = Math.floor(a.x);
      let mapY = Math.floor(a.y);

      const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1 / rayDirX);
      const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1 / rayDirY);

      let stepX: number;
      let stepY: number;
      let sideDistX: number;
      let sideDistY: number;

      if (rayDirX < 0) { stepX = -1; sideDistX = (a.x - mapX) * deltaDistX; }
      else { stepX = 1; sideDistX = (mapX + 1 - a.x) * deltaDistX; }
      if (rayDirY < 0) { stepY = -1; sideDistY = (a.y - mapY) * deltaDistY; }
      else { stepY = 1; sideDistY = (mapY + 1 - a.y) * deltaDistY; }

      let hit = false;
      let side = 0; // 0 = vertical (x-side), 1 = horizontal (y-side)
      let material = 1;
      let guard = 0;

      while (!hit && guard++ < 128) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (isWall(map, mapX, mapY)) {
          hit = true;
          material = map.grid[mapY]?.[mapX] || 1;
        }
      }

      const perpDist = side === 0 ? (mapX - a.x + (1 - stepX) / 2) / (rayDirX || 1e-9) : (mapY - a.y + (1 - stepY) / 2) / (rayDirY || 1e-9);
      const dist = Math.max(0.05, Math.abs(perpDist));
      this.zbuffer[c] = dist;
      this.wallMat[c] = material;
      this.wallSide[c] = side as 0 | 1;

      // Exact hit point along the wall face → texture coordinate 0..1.
      let wx = side === 0 ? a.y + perpDist * rayDirY : a.x + perpDist * rayDirX;
      wx -= Math.floor(wx);
      this.wallX[c] = wx;

      const lineHeight = Math.min(h * 4, h / dist);
      const drawStart = horizon - lineHeight / 2;
      const sx = c * colW;

      const mat = materialById(material);
      // Distance fog + side shading + a vertical grain that varies with the
      // exact hit coordinate so flat fills read as a real, lit surface.
      const shade = clamp(this.map.ambient - dist / MAX_RENDER_DIST, 0.08, 1);
      const base = side === 1 ? mat.shade : mat.base;
      const freq = mat.texture === "brick" ? 9 : mat.texture === "panel" ? 6 : mat.texture === "tech" ? 14 : mat.texture === "crate" ? 4 : 10;
      const grain = 0.85 + 0.15 * Math.sin(wx * Math.PI * 2 * freq);
      ctx.fillStyle = shadeColor(base, clamp(shade * grain, 0.06, 1));
      ctx.fillRect(sx, drawStart, colW + 0.7, lineHeight);

      // Surface detail — only worth drawing when the wall is tall enough on
      // screen (i.e. reasonably close), which also keeps the cost bounded.
      const detailed = mat.texture === "brick" || mat.texture === "panel" || mat.texture === "crate" || mat.texture === "tech" || mat.texture === "concrete";
      if (detailed && lineHeight > 46) {
        const rows = mat.texture === "crate" ? 3 : mat.texture === "tech" ? 6 : 5;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = shadeColor(mat.shade, shade * 0.62);
        for (let b = 1; b < rows; b++) {
          const by = drawStart + (lineHeight * b) / rows;
          ctx.fillRect(sx, by, colW + 0.7, Math.max(1, lineHeight * 0.02));
        }
        // Vertical mortar / seam lines at the tile edges.
        if ((mat.texture === "brick" || mat.texture === "crate" || mat.texture === "panel") && (wx < 0.05 || wx > 0.95)) {
          ctx.fillRect(sx, drawStart, colW + 0.7, lineHeight);
        }
        ctx.globalAlpha = 1;
      }

      // A subtle contact-shadow at the very base of the wall grounds it.
      if (lineHeight > 30) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#000";
        ctx.fillRect(sx, drawStart + lineHeight - Math.max(1, lineHeight * 0.03), colW + 0.7, Math.max(1, lineHeight * 0.03));
        ctx.globalAlpha = 1;
      }
    }
  }

  // Sort and draw all "sprites" (actors, drops, pickups, particles) as
  // camera-facing billboards using the same perspective math as the walls,
  // depth-tested per-column against the z-buffer produced above.
  private drawSprites(ctx: CanvasRenderingContext2D, a: Actor, w: number, horizon: number, h: number) {
    type Sprite = { x: number; y: number; height: number; width: number; color: string; kind: string; glow?: string; alpha?: number; z?: number; ref?: Actor };
    const sprites: Sprite[] = [];

    for (const other of this.actors) {
      if (other === a || !other.alive) continue;
      const zombie = other.kind === "zombie";
      sprites.push({
        x: other.x, y: other.y, height: zombie ? 1.62 : 1.74, width: 0.98,
        color: "#000", kind: "actor",
        glow: zombie ? "#7f1d1d" : other.team === 0 ? "#38bdf8" : "#f87171",
        ref: other,
      });
    }
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      sprites.push({ x: pk.x, y: pk.y, height: 0.4, width: 0.4, color: pk.kind === "health" ? "#4ade80" : pk.kind === "armor" ? "#60a5fa" : "#facc15", kind: "pickup" });
    }
    for (const d of this.drops) {
      sprites.push({ x: d.x, y: d.y, height: 0.3, width: 0.5, color: "#cbd5e1", kind: "drop" });
    }
    for (const p of this.particles) {
      sprites.push({ x: p.x, y: p.y, height: p.size / 40, width: p.size / 40, color: p.color, kind: "particle", alpha: Math.max(0, p.life / p.maxLife), z: p.z });
    }

    const withDist = sprites.map((s) => ({ s, dist: Math.hypot(s.x - a.x, s.y - a.y) }));
    withDist.sort((x, y) => y.dist - x.dist);

    const dirAngle = a.angle;
    for (const { s, dist } of withDist) {
      if (dist < 0.15 || dist > MAX_RENDER_DIST) continue;
      const rel = normalizeAngle(Math.atan2(s.y - a.y, s.x - a.x) - dirAngle);
      if (Math.abs(rel) > FOV * 0.75) continue;

      const screenX = (0.5 + Math.tan(rel) / (2 * Math.tan(FOV / 2))) * w;
      const spriteH = Math.min(h * 3, (h / dist) * s.height);
      const spriteW = Math.min(h * 3, (h / dist) * s.width);
      const zOffset = s.z ? (h / dist) * s.z : 0;
      const top = horizon - spriteH / 2 - zOffset + (s.kind === "actor" ? 0 : spriteH * 0.9);

      // occlusion: sample the z-buffer (device-resolution) under the sprite's
      // screen columns — screenX/spriteW are in CSS px, so map into columns.
      const cScale = this.cols / w;
      const colStart = Math.max(0, Math.floor((screenX - spriteW / 2) * cScale));
      const colEnd = Math.min(this.cols - 1, Math.ceil((screenX + spriteW / 2) * cScale));
      if (colEnd < 0 || colStart >= this.cols) continue;
      let visibleCols = 0;
      let sampleCount = 0;
      const stepC = Math.max(1, Math.floor((colEnd - colStart) / 6) || 1);
      for (let c = colStart; c <= colEnd; c += stepC) {
        sampleCount++;
        if (this.zbuffer[c] === undefined || dist < this.zbuffer[c] + 0.15) visibleCols++;
      }
      if (sampleCount > 0 && visibleCols === 0) continue;

      if (s.kind === "actor" && s.ref) {
        this.drawActorSprite(ctx, s.ref, screenX, top, spriteW, spriteH, s.glow || "#f87171");
        continue;
      }

      ctx.save();
      ctx.globalAlpha = s.alpha ?? 1;
      if (s.glow) {
        ctx.shadowColor = s.glow;
        ctx.shadowBlur = 12;
      }
      ctx.fillStyle = s.color;
      if (s.kind === "particle") {
        ctx.beginPath();
        ctx.arc(screenX, top, Math.max(1, spriteW / 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(screenX, top, spriteW / 2, spriteH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // (The muzzle flash is now drawn by the detailed weapon viewmodel so it
    //  lines up with the barrel instead of the screen centre.)
  }

  // Draw a single enemy as an animated, shaded humanoid — an armed soldier or
  // a shambling zombie — with a ground shadow and a floating health bar. Far
  // richer than the old rectangle-plus-circle so the world reads like a game.
  private drawActorSprite(ctx: CanvasRenderingContext2D, actor: Actor, cx: number, top: number, sw: number, sh: number, glow: string) {
    const zombie = actor.kind === "zombie";
    const moving = Math.hypot(actor.velX, actor.velY) > 0.1;
    const phase = zombie ? actor.gaitPhase : actor.bobPhase;
    const swing = moving ? Math.sin(phase) : 0;
    const swing2 = moving ? Math.sin(phase + Math.PI) : 0; // opposite leg/arm
    const feetY = top + sh;
    const hurt = actor.hurtFlash > 0;
    // Airborne height in "sprite units" so a jumping actor lifts off the floor
    // and casts a smaller, fainter shadow beneath its feet.
    const air = (actor.z || 0);
    const near = sh > 150; // draw extra fine detail only when the sprite is big

    // rounded-rect helper (kept local so the sprite stays self-contained)
    const rr = (x: number, y: number, ww: number, hh: number, r: number) => {
      const rad = Math.min(r, ww / 2, hh / 2);
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + ww, y, x + ww, y + hh, rad);
      ctx.arcTo(x + ww, y + hh, x, y + hh, rad);
      ctx.arcTo(x, y + hh, x, y, rad);
      ctx.arcTo(x, y, x + ww, y, rad);
      ctx.closePath();
    };

    ctx.save();

    // ground shadow — shrinks + fades as the actor rises into a jump
    const shadowScale = 1 / (1 + air * 1.6);
    ctx.globalAlpha = 0.32 * shadowScale;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(cx, feetY, sw * 0.55 * shadowScale, Math.max(1.5, sh * 0.05 * shadowScale), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // soft rim glow behind the body (team / undead colour)
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.shadowColor = glow;
    ctx.shadowBlur = Math.min(24, sh * 0.2);
    ctx.fillStyle = glow;
    rr(cx - sw * 0.26, top + sh * 0.18, sw * 0.52, sh * 0.64, sw * 0.2);
    ctx.fill();
    ctx.restore();

    const skin = hurt ? "#ffffff" : zombie ? "#93a86a" : "#caa574";
    const skinDark = shadeColor(skin, 0.72);
    const cloth = hurt ? "#ffffff" : zombie ? "#415836" : actor.team === 0 ? "#2f5fd0" : "#b23029";
    const clothMid = shadeColor(cloth, 0.82);
    const clothDark = shadeColor(cloth, 0.55);
    const gear = zombie ? "#26331f" : "#191d24";

    const legTop = top + sh * 0.6;
    const legLen = sh * 0.4;
    const thighLen = legLen * 0.52;
    const legW = sw * 0.17;
    const torsoW = sw * (zombie ? 0.44 : 0.52);
    const torsoTop = top + sh * (zombie ? 0.28 : 0.24);
    const torsoBot = legTop + 1;
    const torsoH = torsoBot - torsoTop;
    const headR = sh * (zombie ? 0.088 : 0.092);
    const lean = zombie ? sw * 0.1 * (1 + 0.2 * Math.sin(phase * 0.7)) : 0;
    const headCX = cx + lean;
    const headCY = top + sh * (zombie ? 0.2 : 0.125);

    // ---- LEGS: thigh + shin with a bent knee, so the stride reads as walking
    const drawLeg = (footOff: number, s: number) => {
      const hipX = cx + footOff;
      const kneeX = hipX + s * sw * 0.05;
      const kneeY = legTop + thighLen;
      const footX = hipX - s * sw * 0.03;
      const bootY = legTop + legLen;
      ctx.strokeStyle = clothDark;
      ctx.lineWidth = legW;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(hipX, legTop);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, bootY - sh * 0.03);
      ctx.stroke();
      // combat boot
      ctx.fillStyle = "#0d1015";
      rr(footX - legW * 0.62, bootY - sh * 0.045, legW * 1.35, sh * 0.05, sh * 0.015);
      ctx.fill();
    };
    drawLeg(-torsoW * 0.26, swing);
    drawLeg(torsoW * 0.26, swing2);

    // ---- TORSO with vertical + side-light gradient for volume
    const tg = ctx.createLinearGradient(cx - torsoW / 2, 0, cx + torsoW / 2, 0);
    tg.addColorStop(0, clothDark);
    tg.addColorStop(0.5, cloth);
    tg.addColorStop(1, clothMid);
    ctx.fillStyle = tg;
    if (zombie) {
      // hunched, slightly narrower torso leaning toward the viewer
      ctx.save();
      ctx.translate(cx, torsoTop + torsoH / 2);
      ctx.rotate(0.06 * Math.sin(phase * 0.5));
      rr(-torsoW / 2, -torsoH / 2, torsoW, torsoH, sw * 0.06);
      ctx.fill();
      ctx.restore();
    } else {
      rr(cx - torsoW / 2, torsoTop, torsoW, torsoH, sw * 0.08);
      ctx.fill();
    }
    // subtle top-down ambient shade on the torso
    const ao = ctx.createLinearGradient(0, torsoTop, 0, torsoBot);
    ao.addColorStop(0, "rgba(255,255,255,0.12)");
    ao.addColorStop(0.35, "rgba(255,255,255,0)");
    ao.addColorStop(1, "rgba(0,0,0,0.28)");
    ctx.fillStyle = ao;
    rr(cx - torsoW / 2, torsoTop, torsoW, torsoH, sw * 0.08);
    ctx.fill();

    if (zombie) {
      // torn shirt flaps + exposed ribs + dark blood soak
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      for (let i = 0; i < 4; i++) {
        const rx = cx - torsoW / 2 + torsoW * (0.12 + i * 0.24);
        ctx.beginPath();
        ctx.moveTo(rx, torsoTop + torsoH * 0.45);
        ctx.lineTo(rx + torsoW * 0.05, torsoBot);
        ctx.lineTo(rx - torsoW * 0.05, torsoBot);
        ctx.fill();
      }
      // pale ribs peeking through a gash
      ctx.strokeStyle = "rgba(210,205,180,0.5)";
      ctx.lineWidth = Math.max(1, sh * 0.006);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - torsoW * 0.12, torsoTop + torsoH * (0.35 + i * 0.12));
        ctx.lineTo(cx + torsoW * 0.16, torsoTop + torsoH * (0.32 + i * 0.12));
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(90,12,12,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx - torsoW * 0.05, torsoTop + torsoH * 0.5, torsoW * 0.22, torsoH * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // plate carrier + magazine pouches + team belt
      ctx.fillStyle = gear;
      rr(cx - torsoW * 0.42, torsoTop + torsoH * 0.12, torsoW * 0.84, torsoH * 0.5, sw * 0.04);
      ctx.fill();
      ctx.fillStyle = shadeColor(gear, 1.5);
      for (let i = 0; i < 3; i++) {
        rr(cx - torsoW * 0.3 + i * torsoW * 0.22, torsoTop + torsoH * 0.2, torsoW * 0.16, torsoH * 0.24, sw * 0.02);
        ctx.fill();
      }
      // team armband
      ctx.fillStyle = actor.team === 0 ? "#7dd3fc" : "#fca5a5";
      rr(cx - torsoW / 2 - sw * 0.02, torsoTop + torsoH * 0.06, sw * 0.06, torsoH * 0.18, sw * 0.02);
      ctx.fill();
    }

    // ---- ARMS + weapon
    const armW = sw * 0.14;
    if (zombie) {
      const reachSway = Math.sin(phase) * sw * 0.06;
      const drawArm = (baseAng: number, off: number) => {
        ctx.save();
        ctx.translate(cx + off, torsoTop + torsoH * 0.14);
        ctx.rotate(baseAng + 0.12 * Math.sin(phase + off));
        ctx.strokeStyle = clothMid;
        ctx.lineWidth = armW;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, sh * 0.2);
        ctx.lineTo(sw * 0.04, sh * 0.36);
        ctx.stroke();
        // rotting hand / claw
        ctx.fillStyle = skinDark;
        ctx.beginPath();
        ctx.arc(sw * 0.04, sh * 0.37, armW * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      drawArm(0.55, -torsoW * 0.12 + reachSway);
      drawArm(-0.4, torsoW * 0.12 + reachSway);
    } else {
      // both arms hold a rifle levelled toward the viewer; recoil jitters it
      const kick = clamp(actor.recoilKick, 0, 1);
      const gunY = torsoTop + torsoH * 0.2;
      const gunLen = sw * 0.62;
      ctx.save();
      ctx.translate(cx, gunY);
      ctx.rotate(-0.04 + kick * 0.05 * Math.sin(this.matchTime * 40));
      // back arm
      ctx.strokeStyle = clothMid;
      ctx.lineWidth = armW;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-torsoW * 0.34, -torsoH * 0.02);
      ctx.lineTo(sw * 0.04, sh * 0.02);
      ctx.stroke();
      // rifle body
      ctx.fillStyle = "#15181d";
      rr(-sw * 0.04, -sh * 0.02 - kick * sh * 0.01, gunLen, sh * 0.045, sh * 0.01);
      ctx.fill();
      ctx.fillStyle = "#0b0d10";
      rr(-sw * 0.02, sh * 0.02, sw * 0.06, sh * 0.09, sh * 0.008); ctx.fill(); // magazine
      rr(-sw * 0.06, -sh * 0.05, sw * 0.05, sh * 0.05, sh * 0.006); ctx.fill(); // stock
      // front hand on the foregrip
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(gunLen * 0.55, sh * 0.01, armW * 0.6, 0, Math.PI * 2);
      ctx.fill();
      // muzzle flash at the barrel tip while firing
      if (actor.fireCooldown > 0 && kick > 0.04) {
        const mzx = gunLen + sw * 0.02;
        ctx.globalAlpha = kick;
        const mg = ctx.createRadialGradient(mzx, sh * 0.005, 1, mzx, sh * 0.005, sh * 0.11);
        mg.addColorStop(0, "#fffdf0"); mg.addColorStop(0.45, "#ffbe2e"); mg.addColorStop(1, "transparent");
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(mzx, sh * 0.005, sh * 0.11, 0, Math.PI * 2); ctx.fill();
        // star spikes
        ctx.strokeStyle = "#fff2c0";
        ctx.lineWidth = Math.max(1, sh * 0.01);
        for (let i = 0; i < 4; i++) {
          const an = i * Math.PI / 2 + 0.4;
          ctx.beginPath();
          ctx.moveTo(mzx, sh * 0.005);
          ctx.lineTo(mzx + Math.cos(an) * sh * 0.13, sh * 0.005 + Math.sin(an) * sh * 0.13);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // ---- HEAD
    const hg = ctx.createRadialGradient(headCX - headR * 0.35, headCY - headR * 0.35, headR * 0.2, headCX, headCY, headR * 1.1);
    hg.addColorStop(0, shadeColor(skin, 1.12));
    hg.addColorStop(1, skinDark);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    if (zombie) {
      // gaunt shading + asymmetric glowing eyes + open, drooling jaw
      ctx.fillStyle = "rgba(40,60,25,0.55)";
      ctx.beginPath();
      ctx.arc(headCX + headR * 0.3, headCY + headR * 0.1, headR * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e6ff5a";
      ctx.shadowColor = "#eaff6b";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(headCX - headR * 0.36, headCY - headR * 0.08, headR * 0.2, 0, Math.PI * 2);
      ctx.arc(headCX + headR * 0.32, headCY - headR * 0.02, headR * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // jaw + a thread of drool
      ctx.fillStyle = "#2a0f0f";
      rr(headCX - headR * 0.42, headCY + headR * 0.3, headR * 0.84, headR * 0.5, headR * 0.12);
      ctx.fill();
      ctx.fillStyle = "#cdd6a0";
      for (let i = 0; i < 3; i++) ctx.fillRect(headCX - headR * 0.32 + i * headR * 0.28, headCY + headR * 0.3, headR * 0.12, headR * 0.16);
      if (near) {
        ctx.strokeStyle = "rgba(180,220,120,0.5)";
        ctx.lineWidth = Math.max(1, sh * 0.004);
        ctx.beginPath();
        ctx.moveTo(headCX, headCY + headR * 0.7);
        ctx.lineTo(headCX + Math.sin(this.matchTime * 3) * headR * 0.1, headCY + headR * 1.3);
        ctx.stroke();
      }
    } else {
      // combat helmet, brim, visor band + chin strap, subtle face
      ctx.fillStyle = shadeColor(cloth, 0.42);
      ctx.beginPath();
      ctx.arc(headCX, headCY - headR * 0.18, headR * 1.16, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shadeColor(cloth, 0.32);
      rr(headCX - headR * 1.14, headCY - headR * 0.28, headR * 2.28, headR * 0.28, headR * 0.1);
      ctx.fill();
      // visor / eye band
      ctx.fillStyle = "rgba(8,12,18,0.92)";
      rr(headCX - headR * 0.92, headCY - headR * 0.1, headR * 1.84, headR * 0.4, headR * 0.12);
      ctx.fill();
      // faint NVG mount glow
      ctx.fillStyle = "rgba(120,200,255,0.5)";
      ctx.fillRect(headCX - headR * 0.12, headCY - headR * 0.05, headR * 0.24, headR * 0.12);
      // chin strap
      ctx.strokeStyle = "rgba(10,14,20,0.8)";
      ctx.lineWidth = Math.max(1, sh * 0.006);
      ctx.beginPath();
      ctx.arc(headCX, headCY + headR * 0.2, headR * 0.9, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // shoulder pads sit above the arms
      ctx.fillStyle = shadeColor(cloth, 0.7);
      rr(cx - torsoW / 2 - armW * 0.3, torsoTop - sh * 0.006, torsoW * 0.32, sh * 0.055, sw * 0.03); ctx.fill();
      rr(cx + torsoW / 2 - torsoW * 0.32 + armW * 0.3, torsoTop - sh * 0.006, torsoW * 0.32, sh * 0.055, sw * 0.03); ctx.fill();
    }

    // hit whiteout flash on top of everything
    if (hurt) {
      ctx.globalAlpha = clamp(actor.hurtFlash, 0, 0.7);
      ctx.fillStyle = "#ffffff";
      rr(cx - torsoW / 2, torsoTop, torsoW, torsoH, sw * 0.08);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ---- health bar (only when damaged)
    const hp = clamp(actor.health / actor.maxHealth, 0, 1);
    if (hp < 0.999) {
      const bw = sw * 0.72;
      const bh = Math.max(2.5, sh * 0.022);
      const bx = cx - bw / 2;
      const by = top - bh * 2.6;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      rr(bx - 1, by - 1, bw + 2, bh + 2, 2); ctx.fill();
      ctx.fillStyle = hp > 0.5 ? "#4ade80" : hp > 0.25 ? "#facc15" : "#f87171";
      rr(bx, by, bw * hp, bh, 1.5); ctx.fill();
    }

    // ---- name tag for nearby human soldiers
    if (!zombie && near) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = actor.team === 0 ? "#bae6fd" : "#fecaca";
      ctx.font = `${Math.round(sh * 0.05)}px ui-sans-serif, system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(actor.name, cx, top - sh * 0.1);
      ctx.globalAlpha = 1;
      ctx.textAlign = "start";
    }

    ctx.restore();
  }

  // First-person weapon viewmodel — delegates to the dedicated high-detail
  // vector renderer in viewmodels.ts, feeding it the current animation state
  // (sway, recoil kick, reload progress and muzzle-flash intensity).
  private drawViewModel(ctx: CanvasRenderingContext2D, a: Actor, w: number, h: number) {
    const wpn = weaponById(a.weaponId);
    const moving = Math.hypot(a.velX, a.velY) > 0.15;
    const bobY = Math.sin(a.bobPhase) * (moving ? 9 : 3);
    const bobX = Math.cos(a.bobPhase * 0.5) * (moving ? 8 : 2);
    const recoil = clamp(a.recoilKick, 0, 1);
    const reloadTime = wpn.reloadTime || 1;
    const reloadProgress = a.reloadTimer > 0 ? clamp(1 - a.reloadTimer / reloadTime, 0, 1) : 0;
    // The flash is brightest in the first instant after firing.
    const fire = a.fireCooldown > 0 && recoil > 0.05 ? clamp(recoil * 1.5, 0, 1) : 0;

    drawWeaponViewModel(ctx, {
      weaponId: wpn.id,
      category: wpn.category,
      color: wpn.color,
      w,
      h,
      bobX,
      bobY,
      recoil,
      reloadProgress,
      ads: a.ads,
      fire,
      time: this.matchTime,
    });
  }
}

function shadeColor(hex: string, factor: number): string {
  const c = hex.replace("#", "");
  const bigint = parseInt(c.length === 3 ? c.split("").map((ch) => ch + ch).join("") : c, 16);
  const r = clamp(Math.round(((bigint >> 16) & 255) * factor), 0, 255);
  const g = clamp(Math.round(((bigint >> 8) & 255) * factor), 0, 255);
  const b = clamp(Math.round((bigint & 255) * factor), 0, 255);
  return `rgb(${r},${g},${b})`;
}
