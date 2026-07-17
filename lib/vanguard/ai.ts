// ============================================================================
//  Vanguard — bot intelligence.
//
//  Bots share one brain that also drives the optional "auto-play" mode for the
//  human slot. The brain runs a small state machine (spawn → hunt → engage →
//  reposition → retreat) on top of a breadth-first pathfinder over the tile
//  grid, with line-of-sight checks against walls. Five difficulty tiers scale
//  reaction time, aim jitter, accuracy and aggression so matches feel fair from
//  Recruit up to Nightmare.
// ============================================================================

import { GameMap, isWall, Vec2 } from "./maps";

export type Difficulty = "recruit" | "regular" | "hardened" | "veteran" | "nightmare";

export interface DifficultyProfile {
  id: Difficulty;
  name: string;
  reaction: number;      // seconds before reacting to a spotted enemy
  aimError: number;      // radians of random aim jitter
  aimSpeed: number;      // how fast aim converges (0..1 per tick)
  accuracy: number;      // chance a shot is "committed" rather than suppressive
  aggression: number;    // 0..1 tendency to push vs hold
  reactionFireRate: number; // multiplier on fire cadence
  hearing: number;       // tiles at which gunfire is noticed
  health: number;        // bot base health
  color: string;
}

export const DIFFICULTIES: DifficultyProfile[] = [
  { id: "recruit",   name: "Recruit",   reaction: 0.75, aimError: 0.22, aimSpeed: 0.05, accuracy: 0.45, aggression: 0.3, reactionFireRate: 0.6, hearing: 6,  health: 100, color: "#4ade80" },
  { id: "regular",   name: "Regular",   reaction: 0.5,  aimError: 0.14, aimSpeed: 0.09, accuracy: 0.6,  aggression: 0.5, reactionFireRate: 0.8, hearing: 9,  health: 100, color: "#38bdf8" },
  { id: "hardened",  name: "Hardened",  reaction: 0.32, aimError: 0.08, aimSpeed: 0.14, accuracy: 0.72, aggression: 0.65, reactionFireRate: 1.0, hearing: 12, health: 110, color: "#facc15" },
  { id: "veteran",   name: "Veteran",   reaction: 0.2,  aimError: 0.045, aimSpeed: 0.2,  accuracy: 0.85, aggression: 0.8, reactionFireRate: 1.2, hearing: 16, health: 120, color: "#fb923c" },
  { id: "nightmare", name: "Nightmare", reaction: 0.1,  aimError: 0.02, aimSpeed: 0.3,  accuracy: 0.95, aggression: 0.95, reactionFireRate: 1.4, hearing: 22, health: 130, color: "#f43f5e" },
];

export function difficultyById(id: Difficulty): DifficultyProfile {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

export type BotState = "spawn" | "patrol" | "hunt" | "engage" | "reposition" | "retreat";

// The minimal actor shape the AI reads/writes. The engine's full Actor is a
// superset of this, so it can be passed directly.
export interface AiActor {
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  team: number;
}

export interface AiIntent {
  moveX: number;   // world-space desired velocity direction (unit-ish)
  moveY: number;
  aim: number;     // desired facing angle
  wantsFire: boolean;
  wantsReload: boolean;
  wantsSprint: boolean;
}

const NEIGHBORS: Vec2[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
];

// Breadth-first search returning the next waypoint (tile centre) toward the goal.
export function bfsNextStep(map: GameMap, from: Vec2, to: Vec2): Vec2 | null {
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const gx = Math.floor(to.x);
  const gy = Math.floor(to.y);
  if (sx === gx && sy === gy) return { x: to.x, y: to.y };
  if (isWall(map, gx, gy)) return null;

  const w = map.width;
  const key = (x: number, y: number) => y * w + x;
  const visited = new Set<number>();
  const cameFrom = new Map<number, number>();
  const queue: number[] = [key(sx, sy)];
  visited.add(key(sx, sy));
  let found = false;
  let guard = 0;
  const maxNodes = w * map.height;

  while (queue.length && guard++ < maxNodes) {
    const cur = queue.shift()!;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    if (cx === gx && cy === gy) {
      found = true;
      break;
    }
    for (const n of NEIGHBORS) {
      const nx = cx + n.x;
      const ny = cy + n.y;
      if (isWall(map, nx, ny)) continue;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      visited.add(k);
      cameFrom.set(k, cur);
      queue.push(k);
    }
  }

  if (!found) return null;

  // Walk back from goal to the step right after the start.
  let cur = key(gx, gy);
  let prev = cur;
  while (cur !== key(sx, sy)) {
    prev = cur;
    const p = cameFrom.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  return { x: (prev % w) + 0.5, y: Math.floor(prev / w) + 0.5 };
}

// Digital differential ray test — is there an unobstructed line between a and b?
export function lineOfSight(map: GameMap, a: Vec2, b: Vec2): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return true;
  const steps = Math.ceil(dist * 8);
  const stepX = dx / steps;
  const stepY = dy / steps;
  let px = a.x;
  let py = a.y;
  for (let i = 0; i < steps; i++) {
    px += stepX;
    py += stepY;
    if (isWall(map, Math.floor(px), Math.floor(py))) return false;
  }
  return true;
}

export interface BotMemory {
  state: BotState;
  target: AiActor | null;
  lastSeen: Vec2 | null;
  reactionTimer: number;
  stateTimer: number;
  path: Vec2 | null;
  repathTimer: number;
  strafeDir: number;
  wanderGoal: Vec2 | null;
  fireHeld: number;
  ammoInMag: number;
}

export function newBotMemory(): BotMemory {
  return {
    state: "spawn",
    target: null,
    lastSeen: null,
    reactionTimer: 0,
    stateTimer: 0,
    path: null,
    repathTimer: 0,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    wanderGoal: null,
    fireHeld: 0,
    ammoInMag: 30,
  };
}

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Choose the closest visible enemy on another team.
function acquireTarget(map: GameMap, self: AiActor, actors: AiActor[]): AiActor | null {
  let best: AiActor | null = null;
  let bestDist = Infinity;
  for (const a of actors) {
    if (!a.alive || a.team === self.team) continue;
    const d = Math.hypot(a.x - self.x, a.y - self.y);
    if (d < bestDist && lineOfSight(map, self, a)) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

export interface ThinkParams {
  map: GameMap;
  self: AiActor;
  mem: BotMemory;
  actors: AiActor[];
  profile: DifficultyProfile;
  dt: number;
  magEmpty: boolean;
  reserveEmpty: boolean;
  preferredRange: number; // ideal engage distance for equipped weapon
}

// The core per-tick brain. Returns an intent the engine translates into motion
// and shooting. Pure w.r.t. the world apart from mutating its own memory.
export function think(p: ThinkParams): AiIntent {
  const { map, self, mem, actors, profile, dt } = p;
  const intent: AiIntent = { moveX: 0, moveY: 0, aim: self.angle, wantsFire: false, wantsReload: false, wantsSprint: false };
  mem.stateTimer += dt;
  mem.repathTimer -= dt;

  const pos: Vec2 = { x: self.x, y: self.y };
  const visible = acquireTarget(map, self, actors);

  if (visible) {
    mem.lastSeen = { x: visible.x, y: visible.y };
    if (mem.target !== visible) {
      mem.target = visible;
      mem.reactionTimer = profile.reaction;
    }
  } else if (mem.target && !lineOfSight(map, pos, mem.target)) {
    // Lost sight — remember last known position for a short hunt.
    mem.target = null;
  }

  // Reload logic — bots reload when out of sight or empty.
  if (p.magEmpty && !p.reserveEmpty) {
    intent.wantsReload = true;
  }

  // -- State transitions -----------------------------------------------------
  switch (mem.state) {
    case "spawn":
      if (mem.stateTimer > 0.4) {
        mem.state = "patrol";
        mem.stateTimer = 0;
      }
      break;
    case "patrol":
      if (visible) {
        mem.state = "engage";
        mem.stateTimer = 0;
      } else if (mem.lastSeen) {
        mem.state = "hunt";
        mem.stateTimer = 0;
      }
      break;
    case "hunt":
      if (visible) {
        mem.state = "engage";
        mem.stateTimer = 0;
      } else if (!mem.lastSeen || mem.stateTimer > 6) {
        mem.state = "patrol";
        mem.lastSeen = null;
        mem.stateTimer = 0;
      }
      break;
    case "engage":
      if (!visible) {
        mem.state = "hunt";
        mem.stateTimer = 0;
      } else if (self.health < self.maxHealth * 0.25 && Math.random() < 0.02) {
        mem.state = "retreat";
        mem.stateTimer = 0;
      } else if (mem.stateTimer > 1.6 && Math.random() < profile.aggression * 0.3) {
        mem.state = "reposition";
        mem.stateTimer = 0;
      }
      break;
    case "reposition":
      if (mem.stateTimer > 1.2) {
        mem.state = visible ? "engage" : "hunt";
        mem.stateTimer = 0;
      }
      break;
    case "retreat":
      if (self.health > self.maxHealth * 0.55 || mem.stateTimer > 4) {
        mem.state = visible ? "engage" : "patrol";
        mem.stateTimer = 0;
      }
      break;
  }

  // -- State behaviour -------------------------------------------------------
  const seekTo = (goal: Vec2, sprint: boolean) => {
    if (mem.repathTimer <= 0 || !mem.path) {
      mem.path = bfsNextStep(map, pos, goal);
      mem.repathTimer = 0.35;
    }
    const step = mem.path || goal;
    const a = angleTo(pos, step);
    intent.moveX = Math.cos(a);
    intent.moveY = Math.sin(a);
    intent.wantsSprint = sprint;
  };

  if (mem.state === "patrol") {
    if (!mem.wanderGoal || Math.hypot(mem.wanderGoal.x - self.x, mem.wanderGoal.y - self.y) < 1.2) {
      mem.wanderGoal = randomFloor(map);
    }
    if (mem.wanderGoal) seekTo(mem.wanderGoal, false);
    intent.aim = normalizeAngle(self.angle + Math.sin(mem.stateTimer) * 0.02);
  } else if (mem.state === "hunt" && mem.lastSeen) {
    seekTo(mem.lastSeen, profile.aggression > 0.6);
    if (Math.hypot(mem.lastSeen.x - self.x, mem.lastSeen.y - self.y) < 1) {
      mem.lastSeen = null;
    }
  } else if (mem.state === "engage" && mem.target) {
    const tgt = mem.target;
    const desiredAngle = angleTo(pos, tgt);
    // Converge aim with jitter based on difficulty.
    const jitter = (Math.random() - 0.5) * profile.aimError * 2;
    const goalAim = desiredAngle + jitter;
    intent.aim = normalizeAngle(self.angle + normalizeAngle(goalAim - self.angle) * profile.aimSpeed);

    const dist = Math.hypot(tgt.x - self.x, tgt.y - self.y);
    // Maintain preferred range: advance if far, back off if very close.
    if (dist > p.preferredRange * 1.3) {
      seekTo({ x: tgt.x, y: tgt.y }, profile.aggression > 0.5);
    } else if (dist < p.preferredRange * 0.5) {
      const away = angleTo(tgt, pos);
      intent.moveX = Math.cos(away);
      intent.moveY = Math.sin(away);
    } else {
      // Strafe around the target.
      const strafe = desiredAngle + (Math.PI / 2) * mem.strafeDir;
      intent.moveX = Math.cos(strafe) * 0.8;
      intent.moveY = Math.sin(strafe) * 0.8;
      if (Math.random() < 0.01) mem.strafeDir *= -1;
    }

    // Fire when aim is close enough and reaction has elapsed.
    mem.reactionTimer -= dt;
    const aimErr = Math.abs(normalizeAngle(desiredAngle - self.angle));
    if (mem.reactionTimer <= 0 && aimErr < 0.12 && !p.magEmpty) {
      if (Math.random() < profile.accuracy) intent.wantsFire = true;
    }
  } else if (mem.state === "reposition") {
    // Break contact and flank.
    if (mem.target) {
      const flank = angleTo(pos, mem.target) + (Math.PI / 2) * mem.strafeDir;
      intent.moveX = Math.cos(flank);
      intent.moveY = Math.sin(flank);
      intent.aim = normalizeAngle(self.angle + normalizeAngle(angleTo(pos, mem.target) - self.angle) * profile.aimSpeed);
    }
    intent.wantsSprint = true;
  } else if (mem.state === "retreat") {
    const threat = mem.target || (mem.lastSeen ? { x: mem.lastSeen.x, y: mem.lastSeen.y, angle: 0, health: 0, maxHealth: 1, alive: true, team: -1 } : null);
    if (threat) {
      const away = angleTo(threat, pos);
      const goal: Vec2 = { x: self.x + Math.cos(away) * 4, y: self.y + Math.sin(away) * 4 };
      seekTo(clampToFloor(map, goal), true);
    }
  }

  return intent;
}

function randomFloor(map: GameMap): Vec2 {
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(Math.random() * map.width);
    const y = Math.floor(Math.random() * map.height);
    if (!isWall(map, x, y)) return { x: x + 0.5, y: y + 0.5 };
  }
  return { x: map.width / 2, y: map.height / 2 };
}

function clampToFloor(map: GameMap, v: Vec2): Vec2 {
  if (!isWall(map, Math.floor(v.x), Math.floor(v.y))) return v;
  return randomFloor(map);
}

// Roster of themed bot callsigns for the scoreboard.
export const BOT_NAMES = [
  "Reaper", "Ghost", "Viper", "Hawk", "Wraith", "Blaze", "Frost", "Titan",
  "Nomad", "Raven", "Cobra", "Onyx", "Falcon", "Rogue", "Havoc", "Specter",
  "Diesel", "Talon", "Echo", "Vandal", "Slayer", "Karma", "Jester", "Mako",
];

export function botName(index: number): string {
  return BOT_NAMES[index % BOT_NAMES.length] + (index >= BOT_NAMES.length ? `-${Math.floor(index / BOT_NAMES.length)}` : "");
}
