// ============================================================================
//  Rift — daily challenge modifiers.
//
//  A deterministic, date-seeded set of run modifiers that rotate once per
//  day (UTC) — the same "daily seed" produces the same three modifiers for
//  every player on a given date, so scores are comparable without needing a
//  server: everyone who opens Rift on the same day sees the same challenge.
// ============================================================================

export type ModifierId =
  | "glassCannon" | "ironWill" | "swarmMode" | "richHarvest" | "slowBurn"
  | "berserkCore" | "fragileCore" | "sniperNest" | "goldRush" | "bulletStorm"
  | "oneLife" | "doubleXp" | "miniBosses" | "healScarcity" | "adrenalineRun";

export interface ModifierDef {
  id: ModifierId;
  name: string;
  desc: string;
  icon: string;
  scoreMult: number; // multiplier applied to final score when active
  // Numeric knobs the engine reads at run start; 1 = no change.
  enemyDmgMult: number;
  enemyHpMult: number;
  enemySpeedMult: number;
  playerDmgMult: number;
  playerHpMult: number;
  goldMult: number;
  fireRateMult: number;
}

const baseModifier = (over: Partial<ModifierDef> & { id: ModifierId; name: string; desc: string; icon: string }): ModifierDef => ({
  scoreMult: 1, enemyDmgMult: 1, enemyHpMult: 1, enemySpeedMult: 1,
  playerDmgMult: 1, playerHpMult: 1, goldMult: 1, fireRateMult: 1, ...over,
});

export const MODIFIERS: ModifierDef[] = [
  baseModifier({ id: "glassCannon", name: "Glass Cannon", desc: "+60% damage dealt, -35% max HP.", icon: "💎", scoreMult: 1.3, playerDmgMult: 1.6, playerHpMult: 0.65 }),
  baseModifier({ id: "ironWill", name: "Iron Will", desc: "+40% max HP, -20% damage dealt.", icon: "🛡", scoreMult: 0.9, playerHpMult: 1.4, playerDmgMult: 0.8 }),
  baseModifier({ id: "swarmMode", name: "Swarm Mode", desc: "Enemies have -30% HP but the waves are noticeably denser.", icon: "🐝", scoreMult: 1.2, enemyHpMult: 0.7, enemySpeedMult: 1.1 }),
  baseModifier({ id: "richHarvest", name: "Rich Harvest", desc: "+50% gold from every source.", icon: "🪙", scoreMult: 1.0, goldMult: 1.5 }),
  baseModifier({ id: "slowBurn", name: "Slow Burn", desc: "Enemies are 20% slower but hit 25% harder.", icon: "🐌", scoreMult: 1.1, enemySpeedMult: 0.8, enemyDmgMult: 1.25 }),
  baseModifier({ id: "berserkCore", name: "Berserk Tempo", desc: "+35% fire rate for everyone — you and every enemy.", icon: "⚡", scoreMult: 1.15, fireRateMult: 0.74, enemyDmgMult: 1.1 }),
  baseModifier({ id: "fragileCore", name: "Fragile Core", desc: "The Core has 30% less HP — no room for error.", icon: "◈", scoreMult: 1.4, playerHpMult: 1 }),
  baseModifier({ id: "sniperNest", name: "Sniper's Nest", desc: "Ranged enemies appear far more often this run.", icon: "🎯", scoreMult: 1.25, enemyDmgMult: 1.15 }),
  baseModifier({ id: "goldRush", name: "Gold Rush", desc: "+80% gold, but enemies also hit 20% harder.", icon: "🏆", scoreMult: 1.1, goldMult: 1.8, enemyDmgMult: 1.2 }),
  baseModifier({ id: "bulletStorm", name: "Bullet Storm", desc: "Enemy projectiles move 30% faster.", icon: "🌩", scoreMult: 1.3, enemyDmgMult: 1.05 }),
  baseModifier({ id: "oneLife", name: "One Life", desc: "No personal shield abilities may be selected this run.", icon: "☠", scoreMult: 1.5 }),
  baseModifier({ id: "doubleXp", name: "Double XP", desc: "Level up roughly twice as fast this run.", icon: "🎓", scoreMult: 1.0 }),
  baseModifier({ id: "miniBosses", name: "Elite Escorts", desc: "Regular waves occasionally include a tougher elite variant.", icon: "👑", scoreMult: 1.3, enemyHpMult: 1.15 }),
  baseModifier({ id: "healScarcity", name: "Heal Scarcity", desc: "Health pickups are 60% rarer this run.", icon: "🩹", scoreMult: 1.2 }),
  baseModifier({ id: "adrenalineRun", name: "Adrenaline Run", desc: "Everyone moves 15% faster — you and every enemy.", icon: "🏃", scoreMult: 1.15, enemySpeedMult: 1.15 }),
];

export function modifierById(id: ModifierId): ModifierDef {
  return MODIFIERS.find((m) => m.id === id) || MODIFIERS[0];
}

/** A tiny deterministic hash so the same date always yields the same seed. */
function seedFromDate(date: Date): number {
  const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** A minimal seeded PRNG (mulberry32) so picks are reproducible per seed. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's three challenge modifiers — identical for every player on this UTC date. */
export function dailyChallengeModifiers(date: Date = new Date()): ModifierDef[] {
  const rng = mulberry32(seedFromDate(date));
  const pool = [...MODIFIERS];
  const picked: ModifierDef[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

export function dailyChallengeLabel(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Combine a set of active modifiers into one net multiplier bundle. */
export function combineModifiers(active: ModifierDef[]) {
  return active.reduce(
    (acc, m) => ({
      scoreMult: acc.scoreMult * m.scoreMult,
      enemyDmgMult: acc.enemyDmgMult * m.enemyDmgMult,
      enemyHpMult: acc.enemyHpMult * m.enemyHpMult,
      enemySpeedMult: acc.enemySpeedMult * m.enemySpeedMult,
      playerDmgMult: acc.playerDmgMult * m.playerDmgMult,
      playerHpMult: acc.playerHpMult * m.playerHpMult,
      goldMult: acc.goldMult * m.goldMult,
      fireRateMult: acc.fireRateMult * m.fireRateMult,
    }),
    { scoreMult: 1, enemyDmgMult: 1, enemyHpMult: 1, enemySpeedMult: 1, playerDmgMult: 1, playerHpMult: 1, goldMult: 1, fireRateMult: 1 },
  );
}
