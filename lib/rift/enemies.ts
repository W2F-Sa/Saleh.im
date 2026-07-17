// ============================================================================
//  Rift — enemy roster & boss roster.
//
//  Twelve regular enemy kinds (up from four) plus five unique sector bosses,
//  each with its own attack pattern function so the engine can stay generic:
//  it just asks "what does this boss do right now" and gets back a list of
//  intents (spawn adds, fire a volley, dash, shield up, etc).
// ============================================================================

export type EnemyKind =
  | "grunt" | "swift" | "brute" | "shooter" | "bomber" | "shielded"
  | "splitter" | "sniper" | "healer" | "summoner" | "phantom" | "berserker"
  | "turret" | "cloaker" | "juggernaut";

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  color: string;
  baseHp: number;
  baseSpeed: number;
  baseDmg: number;
  baseGold: number;
  baseScore: number;
  radius: number;
  behavior: string; // human-readable, used nowhere but kept for clarity/debug
  minSector: number; // first sector this kind can appear in
}

export const ENEMIES: EnemyDef[] = [
  { kind: "grunt", name: "Grunt", color: "#b9ff3a", baseHp: 30, baseSpeed: 70, baseDmg: 12, baseGold: 6, baseScore: 15, radius: 15, behavior: "Walks straight at the Core or hero.", minSector: 1 },
  { kind: "swift", name: "Swift", color: "#67e8f9", baseHp: 14, baseSpeed: 128, baseDmg: 8, baseGold: 4, baseScore: 12, radius: 11, behavior: "Fast, fragile, swarms in numbers.", minSector: 1 },
  { kind: "brute", name: "Brute", color: "#f97316", baseHp: 70, baseSpeed: 44, baseDmg: 22, baseGold: 12, baseScore: 30, radius: 26, behavior: "Slow tank that beelines for the Core.", minSector: 1 },
  { kind: "shooter", name: "Shooter", color: "#c084fc", baseHp: 26, baseSpeed: 58, baseDmg: 10, baseGold: 9, baseScore: 24, radius: 15, behavior: "Keeps range and peppers the hero.", minSector: 1 },
  { kind: "bomber", name: "Bomber", color: "#ef4444", baseHp: 20, baseSpeed: 96, baseDmg: 46, baseGold: 10, baseScore: 26, radius: 13, behavior: "Rushes in and detonates on contact.", minSector: 2 },
  { kind: "shielded", name: "Shielded Warden", color: "#38bdf8", baseHp: 55, baseSpeed: 52, baseDmg: 16, baseGold: 14, baseScore: 34, radius: 18, behavior: "Frontal energy shield blocks bullets from ahead.", minSector: 2 },
  { kind: "splitter", name: "Splitter", color: "#a3e635", baseHp: 40, baseSpeed: 64, baseDmg: 12, baseGold: 10, baseScore: 22, radius: 17, behavior: "Breaks into two swifts on death.", minSector: 2 },
  { kind: "sniper", name: "Sniper", color: "#f472b6", baseHp: 22, baseSpeed: 40, baseDmg: 30, baseGold: 13, baseScore: 32, radius: 14, behavior: "Long telegraph, one heavy shot, then repositions.", minSector: 3 },
  { kind: "healer", name: "Medic Drone", color: "#4ade80", baseHp: 24, baseSpeed: 62, baseDmg: 4, baseGold: 12, baseScore: 28, radius: 13, behavior: "Passively heals nearby enemies — kill it first.", minSector: 3 },
  { kind: "summoner", name: "Summoner", color: "#facc15", baseHp: 46, baseSpeed: 48, baseDmg: 8, baseGold: 16, baseScore: 40, radius: 17, behavior: "Periodically calls in extra grunts.", minSector: 3 },
  { kind: "phantom", name: "Phantom", color: "#e2e8f0", baseHp: 18, baseSpeed: 100, baseDmg: 14, baseGold: 11, baseScore: 30, radius: 12, behavior: "Blinks short distances, hard to pin down.", minSector: 4 },
  { kind: "berserker", name: "Berserker", color: "#dc2626", baseHp: 60, baseSpeed: 60, baseDmg: 20, baseGold: 15, baseScore: 36, radius: 19, behavior: "Gains speed and damage as its own HP drops.", minSector: 4 },
  { kind: "turret", name: "Deployed Turret", color: "#94a3b8", baseHp: 50, baseSpeed: 0, baseDmg: 14, baseGold: 12, baseScore: 30, radius: 16, behavior: "Stationary once placed; fires steadily at long range.", minSector: 4 },
  { kind: "cloaker", name: "Cloaker", color: "#818cf8", baseHp: 26, baseSpeed: 74, baseDmg: 18, baseGold: 14, baseScore: 34, radius: 13, behavior: "Turns nearly invisible between short, sudden dashes.", minSector: 5 },
  { kind: "juggernaut", name: "Juggernaut", color: "#7c2d12", baseHp: 160, baseSpeed: 34, baseDmg: 30, baseGold: 24, baseScore: 55, radius: 30, behavior: "A rare, heavily armoured brute variant with a damage-reduction plating.", minSector: 5 },
];

export function enemyDef(kind: EnemyKind): EnemyDef {
  return ENEMIES.find((e) => e.kind === kind) || ENEMIES[0];
}

/** Weighted spawn table per sector — used to build each wave's spawn queue. */
export function spawnTableForSector(sector: number): { kind: EnemyKind; weight: number }[] {
  const table: { kind: EnemyKind; weight: number }[] = [
    { kind: "grunt", weight: 30 },
    { kind: "swift", weight: 24 },
    { kind: "brute", weight: 10 + sector },
  ];
  if (sector >= 1) table.push({ kind: "shooter", weight: 12 });
  if (sector >= 2) {
    table.push({ kind: "bomber", weight: 10 });
    table.push({ kind: "shielded", weight: 9 });
    table.push({ kind: "splitter", weight: 10 });
  }
  if (sector >= 3) {
    table.push({ kind: "sniper", weight: 9 });
    table.push({ kind: "healer", weight: 7 });
    table.push({ kind: "summoner", weight: 6 });
  }
  if (sector >= 4) {
    table.push({ kind: "phantom", weight: 8 });
    table.push({ kind: "berserker", weight: 8 });
    table.push({ kind: "turret", weight: 6 });
  }
  if (sector >= 5) {
    table.push({ kind: "cloaker", weight: 7 });
    table.push({ kind: "juggernaut", weight: 4 });
  }
  return table;
}

export function pickWeightedKind(table: { kind: EnemyKind; weight: number }[]): EnemyKind {
  const total = table.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of table) {
    if (r < t.weight) return t.kind;
    r -= t.weight;
  }
  return table[0].kind;
}

/* ------------------------------------------------------------------ */
/*  Bosses — one unique fight per sector, five in total.               */
/* ------------------------------------------------------------------ */

export type BossKind = "colossus" | "hive" | "warden" | "reaper" | "aeon" | "eclipse";

export interface BossDef {
  kind: BossKind;
  name: string;
  title: string;
  color: string;
  baseHp: number;
  baseSpeed: number;
  baseDmg: number;
  radius: number;
  phases: number;
  intro: string;
}

export const BOSSES: BossDef[] = [
  { kind: "colossus", name: "Colossus", title: "The First Wall", color: "#ff5f6d", baseHp: 900, baseSpeed: 40, baseDmg: 34, radius: 60, phases: 2, intro: "A wall of plating grinds toward the Core." },
  { kind: "hive", name: "The Hive", title: "Swarm Mother", color: "#a3e635", baseHp: 1300, baseSpeed: 34, baseDmg: 20, radius: 58, phases: 2, intro: "It doesn't fight alone — it never has to." },
  { kind: "warden", name: "Warden Prime", color: "#38bdf8", title: "The Shielded Throne", baseHp: 1900, baseSpeed: 30, baseDmg: 28, radius: 62, phases: 3, intro: "Its shield has never dropped. Today it will." },
  { kind: "reaper", name: "The Reaper", title: "Null Vector", color: "#c084fc", baseHp: 2500, baseSpeed: 52, baseDmg: 38, radius: 56, phases: 3, intro: "It moves faster than anything this size should." },
  { kind: "aeon", name: "Aeon", title: "The Last Rift", color: "#fde68a", baseHp: 3600, baseSpeed: 36, baseDmg: 44, radius: 68, phases: 3, intro: "Everything before this was a rehearsal." },
  { kind: "eclipse", name: "Eclipse", title: "The Endless Prestige", color: "#0ea5e9", baseHp: 5200, baseSpeed: 44, baseDmg: 50, radius: 70, phases: 3, intro: "For those who sealed the Rift once and came back for more." },
];

export function bossForSector(sector: number): BossDef {
  if (sector >= 6) return BOSSES.find((b) => b.kind === "eclipse") || BOSSES[BOSSES.length - 1];
  return BOSSES[Math.min(BOSSES.length - 2, sector - 1)] || BOSSES[0];
}

/** A boss "intent" the engine executes for one tick of its attack pattern. */
export interface BossIntent {
  kind: "volley" | "summon" | "dash" | "shield" | "slam" | "none";
  count?: number;
  spreadRad?: number;
  shieldSeconds?: number;
}

/**
 * Pure function describing what a boss wants to do at a given elapsed time
 * and phase. The engine samples this on a cooldown and turns the intent into
 * concrete bullets/spawns/state changes — keeping the pattern data separate
 * from simulation.
 */
export function bossIntent(kind: BossKind, phase: number, elapsed: number): BossIntent {
  const t = elapsed % 6;
  switch (kind) {
    case "colossus":
      if (t < 2.4) return { kind: "volley", count: phase >= 2 ? 7 : 5, spreadRad: 0.9 };
      if (t < 4) return { kind: "slam" };
      return { kind: "none" };
    case "hive":
      if (t < 1.6) return { kind: "summon", count: phase >= 2 ? 4 : 2 };
      if (t < 3.6) return { kind: "volley", count: 3, spreadRad: 0.4 };
      return { kind: "none" };
    case "warden":
      if (phase === 1 && t < 2) return { kind: "shield", shieldSeconds: 2.5 };
      if (t < 3) return { kind: "volley", count: 6, spreadRad: 1.1 };
      if (t < 4.4) return { kind: "dash" };
      return { kind: "none" };
    case "reaper":
      if (t < 1.2) return { kind: "dash" };
      if (t < 3) return { kind: "volley", count: phase >= 2 ? 9 : 6, spreadRad: 1.4 };
      if (phase >= 3 && t < 4.2) return { kind: "summon", count: 2 };
      return { kind: "none" };
    case "aeon":
      if (t < 1) return { kind: "shield", shieldSeconds: 1.6 };
      if (t < 2.6) return { kind: "volley", count: 10, spreadRad: Math.PI * 1.4 };
      if (t < 3.6) return { kind: "dash" };
      if (phase >= 3 && t < 5) return { kind: "summon", count: 3 };
      return { kind: "none" };
    case "eclipse":
      if (t < 0.8) return { kind: "shield", shieldSeconds: 1.4 };
      if (t < 2.2) return { kind: "volley", count: phase >= 2 ? 12 : 8, spreadRad: Math.PI * 1.6 };
      if (t < 3) return { kind: "slam" };
      if (t < 4) return { kind: "dash" };
      if (phase >= 3 && t < 5.2) return { kind: "summon", count: 4 };
      return { kind: "none" };
    default:
      return { kind: "none" };
  }
}
