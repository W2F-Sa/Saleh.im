// ============================================================================
//  Rift — weapon archetypes.
//
//  The hero always auto-fires at the nearest threat (Rift's signature "point
//  and defend" feel) but *what* leaves the barrel is now a real choice: five
//  archetypes with distinct emission patterns, unlocked by score milestones
//  and swappable from the shop between waves. Each interacts with the shared
//  upgrade pool (damage/fire-rate/pierce/crit/multishot) differently so
//  switching weapons meaningfully changes a build, not just its icon.
// ============================================================================

export type WeaponKind = "blaster" | "shotgun" | "railgun" | "chainlaser" | "missiles" | "orbitals";

export interface WeaponDef {
  id: WeaponKind;
  name: string;
  desc: string;
  icon: string;
  color: string;
  baseDmgMult: number;      // multiplier applied on top of hero dmg
  baseFireIntMult: number;  // multiplier on the fire interval (<1 = faster)
  projectileSpeedMult: number;
  pelletsPerShot: number;   // shotgun-style multi-pellet base (before multishot upgrade)
  spreadRad: number;        // cone half-angle for pellets/multishot
  pierceBonus: number;      // innate pierce before upgrades
  special: string;          // human-readable mechanical note for the shop tooltip
  unlockScore: number;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: "blaster",
    name: "Pulse Blaster",
    desc: "A reliable single-bolt sidearm. No surprises, no weaknesses.",
    icon: "•",
    color: "#b9ff3a",
    baseDmgMult: 1,
    baseFireIntMult: 1,
    projectileSpeedMult: 1,
    pelletsPerShot: 1,
    spreadRad: 0,
    pierceBonus: 0,
    special: "Balanced — the default loadout.",
    unlockScore: 0,
  },
  {
    id: "shotgun",
    name: "Flak Shotgun",
    desc: "Three-pellet burst with a wide cone. Devastating up close, weak at range.",
    icon: "※",
    color: "#f97316",
    baseDmgMult: 0.62,
    baseFireIntMult: 1.35,
    projectileSpeedMult: 0.92,
    pelletsPerShot: 3,
    spreadRad: 0.34,
    pierceBonus: 0,
    special: "Fires 3 pellets in a wide cone; each pellet rolls its own crit.",
    unlockScore: 1500,
  },
  {
    id: "railgun",
    name: "Railgun",
    desc: "A single, near-instant beam-shot that always pierces everything in its path.",
    icon: "➹",
    color: "#67e8f9",
    baseDmgMult: 2.1,
    baseFireIntMult: 1.7,
    projectileSpeedMult: 2.4,
    pelletsPerShot: 1,
    spreadRad: 0,
    pierceBonus: 99,
    special: "Innately pierces the entire line — great against clustered waves.",
    unlockScore: 6000,
  },
  {
    id: "chainlaser",
    name: "Chain Laser",
    desc: "A thin continuous beam that ramps damage the longer it stays locked on one target.",
    icon: "≋",
    color: "#22d3ee",
    baseDmgMult: 0.34,
    baseFireIntMult: 0.22,
    projectileSpeedMult: 3.2,
    pelletsPerShot: 1,
    spreadRad: 0.02,
    pierceBonus: 0,
    special: "Very fast, low per-hit damage — ramps up to +150% on a sustained target.",
    unlockScore: 14000,
  },
  {
    id: "missiles",
    name: "Seeker Missiles",
    desc: "Slow-launching homing missiles that curve toward the nearest threat and explode on impact.",
    icon: "🚀",
    color: "#fb7185",
    baseDmgMult: 2.6,
    baseFireIntMult: 1.9,
    projectileSpeedMult: 0.7,
    pelletsPerShot: 1,
    spreadRad: 0,
    pierceBonus: 0,
    special: "Homes in on targets and explodes for splash damage on impact.",
    unlockScore: 26000,
  },
  {
    id: "orbitals",
    name: "Orbital Drones",
    desc: "Two drones orbit the hero, striking anything that gets close instead of firing forward.",
    icon: "◐",
    color: "#c084fc",
    baseDmgMult: 1.4,
    baseFireIntMult: 1,
    projectileSpeedMult: 1,
    pelletsPerShot: 0, // orbitals don't fire bullets — handled as melee contact in the engine
    spreadRad: 0,
    pierceBonus: 0,
    special: "No bullets — orbiting drones deal contact damage on a short cooldown per hit.",
    unlockScore: 40000,
  },
];

export function weaponById(id: WeaponKind): WeaponDef {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}

export function isWeaponUnlocked(w: WeaponDef, lifetimeScore: number): boolean {
  return lifetimeScore >= w.unlockScore;
}

/** Damage ramp curve used by the chain laser while it stays on one target. */
export function chainLaserRampMultiplier(secondsOnTarget: number): number {
  return 1 + Math.min(1.5, secondsOnTarget * 0.5);
}
