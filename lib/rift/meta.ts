// ============================================================================
//  Rift — meta-progression: achievements, difficulty modes, persisted stats.
//
//  Everything here is pure data + pure functions (no DOM/localStorage side
//  effects) so it's trivially testable and the page component owns all I/O.
// ============================================================================

export type DifficultyId = "cadet" | "veteran" | "nightmare";

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  desc: string;
  enemyHpMult: number;
  enemyDmgMult: number;
  enemySpeedMult: number;
  goldMult: number;
  scoreMult: number;
  color: string;
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: "cadet", name: "Cadet", desc: "A relaxed run — great for learning builds.", enemyHpMult: 0.75, enemyDmgMult: 0.75, enemySpeedMult: 0.92, goldMult: 0.9, scoreMult: 0.8, color: "#4ade80" },
  { id: "veteran", name: "Veteran", desc: "The intended, balanced challenge.", enemyHpMult: 1, enemyDmgMult: 1, enemySpeedMult: 1, goldMult: 1, scoreMult: 1, color: "#67e8f9" },
  { id: "nightmare", name: "Nightmare", desc: "Tougher, faster, meaner enemies — and it pays out.", enemyHpMult: 1.55, enemyDmgMult: 1.4, enemySpeedMult: 1.12, goldMult: 1.4, scoreMult: 1.75, color: "#ff5f6d" },
];

export function difficultyById(id: DifficultyId): DifficultyDef {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

/* ------------------------------------------------------------------ */
/*  Achievements                                                       */
/* ------------------------------------------------------------------ */

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  goal: number;
  metric: "kills" | "bossKills" | "runsWon" | "score" | "sectorReached" | "goldEarned" | "levelReached" | "critKills";
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_blood", name: "First Blood", desc: "Land your first kill.", icon: "🩸", goal: 1, metric: "kills" },
  { id: "hundred_kills", name: "Centurion", desc: "Reach 100 lifetime kills.", icon: "⚔", goal: 100, metric: "kills" },
  { id: "thousand_kills", name: "Exterminator", desc: "Reach 1,000 lifetime kills.", icon: "☠", goal: 1000, metric: "kills" },
  { id: "first_boss", name: "Wall Breaker", desc: "Defeat your first boss.", icon: "◈", goal: 1, metric: "bossKills" },
  { id: "five_bosses", name: "Boss Hunter", desc: "Defeat 5 bosses total.", icon: "👑", goal: 5, metric: "bossKills" },
  { id: "first_win", name: "Rift Sealed", desc: "Win a run — clear all five sectors.", icon: "🏆", goal: 1, metric: "runsWon" },
  { id: "five_wins", name: "Legend of the Rift", desc: "Win 5 runs.", icon: "🌟", goal: 5, metric: "runsWon" },
  { id: "score_10k", name: "Salvager", desc: "Earn 10,000 score in a single run.", icon: "◆", goal: 10000, metric: "score" },
  { id: "score_50k", name: "Hoarder", desc: "Earn 50,000 score in a single run.", icon: "💎", goal: 50000, metric: "score" },
  { id: "sector_3", name: "Deep Rift", desc: "Reach sector 3 in a single run.", icon: "🌀", goal: 3, metric: "sectorReached" },
  { id: "sector_5", name: "Edge of the Rift", desc: "Reach sector 5 in a single run.", icon: "🌌", goal: 5, metric: "sectorReached" },
  { id: "gold_5k", name: "Gilded", desc: "Earn 5,000 lifetime gold.", icon: "🪙", goal: 5000, metric: "goldEarned" },
  { id: "level_10", name: "Veteran Pilot", desc: "Reach hero level 10 in a single run.", icon: "🎓", goal: 10, metric: "levelReached" },
  { id: "level_20", name: "Ace Pilot", desc: "Reach hero level 20 in a single run.", icon: "🥇", goal: 20, metric: "levelReached" },
  { id: "crit_100", name: "Precision", desc: "Land 100 lifetime critical hits.", icon: "🎯", goal: 100, metric: "critKills" },
];

/* ------------------------------------------------------------------ */
/*  Run history — a rolling log of recent runs for the Stats tab       */
/* ------------------------------------------------------------------ */

export interface RunLogEntry {
  t: number; // Date.now() at completion
  won: boolean;
  score: number;
  kills: number;
  sectorReached: number;
  levelReached: number;
  heroId: string;
  weaponId: string;
  difficultyId: DifficultyId;
}

const MAX_RUN_LOG = 25;

export function pushRunLog(log: RunLogEntry[], entry: RunLogEntry): RunLogEntry[] {
  const next = [entry, ...log];
  return next.slice(0, MAX_RUN_LOG);
}

export function averageScore(log: RunLogEntry[]): number {
  if (!log.length) return 0;
  return Math.round(log.reduce((s, r) => s + r.score, 0) / log.length);
}

export function winRate(log: RunLogEntry[]): number {
  if (!log.length) return 0;
  return log.filter((r) => r.won).length / log.length;
}

export function favoriteHero(log: RunLogEntry[]): string | null {
  if (!log.length) return null;
  const counts = new Map<string, number>();
  for (const r of log) counts.set(r.heroId, (counts.get(r.heroId) || 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) if (count > bestCount) { best = id; bestCount = count; }
  return best;
}

/* ------------------------------------------------------------------ */
/*  Loadout presets — up to 3 saved hero/weapon/ability combinations   */
/* ------------------------------------------------------------------ */

export interface LoadoutPreset {
  name: string;
  heroId: string;
  weaponId: string;
  abilities: [string | null, string | null];
}

export function emptyPresetSlots(): (LoadoutPreset | null)[] {
  return [null, null, null];
}

/* ------------------------------------------------------------------ */
/*  Persisted profile — the shape stored in localStorage               */
/* ------------------------------------------------------------------ */

export interface RiftProfile {
  lifetimeKills: number;
  lifetimeBossKills: number;
  lifetimeGold: number;
  lifetimeCrits: number;
  runsPlayed: number;
  runsWon: number;
  bestScore: number;
  bestSector: number;
  lifetimeScore: number; // sum of best-score-per-run-ish counter used for hero/weapon unlocks
  unlockedAchievements: string[];
  selectedHero: string;
  selectedWeapon: string;
  selectedDifficulty: DifficultyId;
  selectedAbilities: [string | null, string | null];
  soundOn: boolean;
  musicOn: boolean;
  screenShakeOn: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  runLog: RunLogEntry[];
  presets: (LoadoutPreset | null)[];
  colorblindShapes: boolean;
  bestScoreByDifficulty: Record<DifficultyId, number>;
  bestComboEver: number;
  showDpsMeter: boolean;
}

export function defaultProfile(): RiftProfile {
  return {
    lifetimeKills: 0,
    lifetimeBossKills: 0,
    lifetimeGold: 0,
    lifetimeCrits: 0,
    runsPlayed: 0,
    runsWon: 0,
    bestScore: 0,
    bestSector: 1,
    lifetimeScore: 0,
    unlockedAchievements: [],
    selectedHero: "vanguard",
    selectedWeapon: "blaster",
    selectedDifficulty: "veteran",
    selectedAbilities: ["nova", "blink"],
    soundOn: true,
    musicOn: true,
    screenShakeOn: true,
    masterVolume: 0.85,
    sfxVolume: 0.9,
    musicVolume: 0.3,
    runLog: [],
    presets: emptyPresetSlots(),
    colorblindShapes: true,
    bestScoreByDifficulty: { cadet: 0, veteran: 0, nightmare: 0 },
    bestComboEver: 0,
    showDpsMeter: false,
  };
}

/** Wipes all progress back to a fresh profile — used by the Settings "reset" action. */
export function resetProfile(): RiftProfile {
  return defaultProfile();
}

/** A short, copy-pasteable summary of a run for sharing outside the game. */
export function formatShareText(result: { won: boolean; score: number; kills: number; sectorReached: number; levelReached: number; bestCombo: number }, heroName: string, weaponName: string, difficultyName: string): string {
  const outcome = result.won ? "sealed the Rift" : `fell in sector ${result.sectorReached}`;
  return [
    `I ${outcome} in Rift 🌀`,
    `Hero: ${heroName} · Weapon: ${weaponName} · Difficulty: ${difficultyName}`,
    `Score: ${result.score.toLocaleString()} · Kills: ${result.kills} · Level: ${result.levelReached} · Best combo: ×${result.bestCombo}`,
    `Play at saleh.im/rift`,
  ].join("\n");
}

const STORAGE_KEY = "rift.profile.v2";

export function loadProfile(): RiftProfile {
  if (typeof window === "undefined") return defaultProfile();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    return { ...defaultProfile(), ...JSON.parse(raw) };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: RiftProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode / storage disabled — progress just won't persist */
  }
}

/** Evaluate which new achievements should unlock given end-of-run stats. */
export function evaluateAchievements(profile: RiftProfile, runStats: { score: number; sectorReached: number; levelReached: number }): string[] {
  const newly: string[] = [];
  const metricValue = (m: AchievementDef["metric"]): number => {
    switch (m) {
      case "kills": return profile.lifetimeKills;
      case "bossKills": return profile.lifetimeBossKills;
      case "runsWon": return profile.runsWon;
      case "score": return runStats.score;
      case "sectorReached": return runStats.sectorReached;
      case "goldEarned": return profile.lifetimeGold;
      case "levelReached": return runStats.levelReached;
      case "critKills": return profile.lifetimeCrits;
      default: return 0;
    }
  };
  for (const a of ACHIEVEMENTS) {
    if (profile.unlockedAchievements.includes(a.id)) continue;
    if (metricValue(a.metric) >= a.goal) newly.push(a.id);
  }
  return newly;
}
