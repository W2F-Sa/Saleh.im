// ============================================================================
//  Rift — selectable heroes.
//
//  Five pilots, each with a distinct base statline and a unique passive that
//  changes how a run plays out. Heroes are unlocked by reaching milestones
//  (tracked in meta.ts) so a first-time player always has Vanguard available
//  and has something concrete to work toward.
// ============================================================================

export type PassiveId =
  | "none"
  | "adrenaline"    // fire rate ramps up the longer you hold fire without stopping
  | "juggernautHide" // takes 20% less contact damage, moves 8% slower
  | "salvageHound"   // +35% gold from all sources
  | "phaseWalker"    // brief invulnerability window is 60% longer
  | "overclock";     // abilities recharge 25% faster

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  bio: string;
  color: string;
  colorSecondary: string;
  icon: string;
  baseHpMult: number;
  baseSpeedMult: number;
  baseDmgMult: number;
  baseFireRateMult: number; // <1 = faster
  passive: PassiveId;
  passiveDesc: string;
  startWeapon: string;
  unlockScore: number; // total lifetime score required to unlock; 0 = always available
}

export const HEROES: HeroDef[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    title: "The Line Holder",
    bio: "A balanced frontline pilot with no weaknesses and no particular edge — the safest bet for a first run.",
    color: "#67e8f9",
    colorSecondary: "#b9ff3a",
    icon: "◈",
    baseHpMult: 1,
    baseSpeedMult: 1,
    baseDmgMult: 1,
    baseFireRateMult: 1,
    passive: "none",
    passiveDesc: "No passive — a clean, balanced statline.",
    startWeapon: "blaster",
    unlockScore: 0,
  },
  {
    id: "striker",
    name: "Striker",
    title: "Adrenaline Cell",
    bio: "Every uninterrupted second of fire ramps her weapons hotter — devastating in long fights, sluggish out of them.",
    color: "#fb7185",
    colorSecondary: "#ffd84d",
    icon: "⚡",
    baseHpMult: 0.85,
    baseSpeedMult: 1.05,
    baseDmgMult: 0.95,
    baseFireRateMult: 1,
    passive: "adrenaline",
    passiveDesc: "Fire rate climbs up to +40% the longer you sustain fire.",
    startWeapon: "blaster",
    unlockScore: 4000,
  },
  {
    id: "bastion",
    name: "Bastion",
    title: "The Immovable",
    bio: "A walking bunker. Slow, tanky, and nearly impossible to burst down at the Core's doorstep.",
    color: "#f97316",
    colorSecondary: "#fde68a",
    icon: "🛡",
    baseHpMult: 1.4,
    baseSpeedMult: 0.86,
    baseDmgMult: 0.9,
    baseFireRateMult: 1.08,
    passive: "juggernautHide",
    passiveDesc: "Takes 20% less contact damage; moves 8% slower.",
    startWeapon: "shotgun",
    unlockScore: 12000,
  },
  {
    id: "prospector",
    name: "Prospector",
    title: "Salvage Hound",
    bio: "Cares less about the fight than the loot. Every kill and crate pays out noticeably more.",
    color: "#facc15",
    colorSecondary: "#84cc16",
    icon: "🧲",
    baseHpMult: 0.95,
    baseSpeedMult: 1.1,
    baseDmgMult: 0.9,
    baseFireRateMult: 1,
    passive: "salvageHound",
    passiveDesc: "+35% gold from every source.",
    startWeapon: "blaster",
    unlockScore: 20000,
  },
  {
    id: "ghost",
    name: "Ghost",
    title: "Phase Walker",
    bio: "Slips through danger rather than tanking it — a much longer window of grace after every hit.",
    color: "#c084fc",
    colorSecondary: "#67e8f9",
    icon: "👻",
    baseHpMult: 0.75,
    baseSpeedMult: 1.18,
    baseDmgMult: 1,
    baseFireRateMult: 0.96,
    passive: "phaseWalker",
    passiveDesc: "Post-hit invulnerability window is 60% longer.",
    startWeapon: "railgun",
    unlockScore: 32000,
  },
  {
    id: "overclocked",
    name: "Overclocked",
    title: "The Glass Cannon",
    bio: "Every ability and upgrade path bends around abilities recharging faster — high risk, high tempo.",
    color: "#22d3ee",
    colorSecondary: "#f472b6",
    icon: "🌀",
    baseHpMult: 0.8,
    baseSpeedMult: 1.08,
    baseDmgMult: 1.08,
    baseFireRateMult: 0.98,
    passive: "overclock",
    passiveDesc: "Abilities recharge 25% faster.",
    startWeapon: "chainlaser",
    unlockScore: 48000,
  },
];

export function heroById(id: string): HeroDef {
  return HEROES.find((h) => h.id === id) || HEROES[0];
}

export function isHeroUnlocked(hero: HeroDef, lifetimeScore: number): boolean {
  return lifetimeScore >= hero.unlockScore;
}
