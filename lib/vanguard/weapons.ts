// ============================================================================
//  Vanguard — weapon definitions.
//
//  Every weapon is hitscan (instant ray) for crisp, lag-free feel, with
//  per-weapon damage falloff, spread, recoil, magazine/reserve, reload and a
//  synthesized report. Categories gate the loadout and unlocks progress with
//  the player's account level.
// ============================================================================

export type WeaponCategory = "pistol" | "smg" | "shotgun" | "rifle" | "sniper" | "lmg" | "launcher" | "melee";

export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  icon: string;                 // short glyph for HUD chips
  auto: boolean;                // hold-to-fire
  damage: number;               // per pellet / hit at close range
  falloffStart: number;         // tiles before damage begins to drop
  falloffEnd: number;           // tiles at which damage reaches minMult
  minMult: number;              // damage multiplier at max range
  headMult: number;             // headshot multiplier
  rpm: number;                  // rounds per minute
  pellets: number;              // >1 for shotguns
  magazine: number;
  reserve: number;              // spare rounds carried
  reloadTime: number;           // seconds
  spread: number;               // hip-fire cone half-angle (radians)
  adsSpread: number;            // aim-down-sights cone
  adsZoom: number;              // FOV multiplier when aiming
  recoil: number;               // vertical kick (radians)
  moveMult: number;             // movement speed multiplier while equipped
  range: number;                // max effective tiles
  splash?: number;              // explosion radius (launcher)
  sound: "pistol" | "smg" | "shotgun" | "rifle" | "sniper" | "lmg" | "rocket" | "knife";
  unlockLevel: number;
  color: string;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: "sidearm", name: "M9 Sidearm", category: "pistol", icon: "🔫", auto: false,
    damage: 26, falloffStart: 6, falloffEnd: 18, minMult: 0.6, headMult: 1.8, rpm: 340, pellets: 1,
    magazine: 15, reserve: 90, reloadTime: 1.1, spread: 0.02, adsSpread: 0.008, adsZoom: 1.15,
    recoil: 0.012, moveMult: 1.08, range: 24, sound: "pistol", unlockLevel: 0, color: "#cbd5e1",
  },
  {
    id: "vector", name: "Vector SMG", category: "smg", icon: "🔩", auto: true,
    damage: 18, falloffStart: 4, falloffEnd: 14, minMult: 0.45, headMult: 1.5, rpm: 1050, pellets: 1,
    magazine: 33, reserve: 198, reloadTime: 1.5, spread: 0.045, adsSpread: 0.02, adsZoom: 1.2,
    recoil: 0.01, moveMult: 1.05, range: 18, sound: "smg", unlockLevel: 0, color: "#67e8f9",
  },
  {
    id: "mp5", name: "MP5", category: "smg", icon: "🔩", auto: true,
    damage: 22, falloffStart: 5, falloffEnd: 16, minMult: 0.5, headMult: 1.5, rpm: 800, pellets: 1,
    magazine: 30, reserve: 180, reloadTime: 1.4, spread: 0.035, adsSpread: 0.015, adsZoom: 1.2,
    recoil: 0.012, moveMult: 1.04, range: 20, sound: "smg", unlockLevel: 2, color: "#a3e635",
  },
  {
    id: "m4", name: "M4 Carbine", category: "rifle", icon: "🗡", auto: true,
    damage: 30, falloffStart: 10, falloffEnd: 28, minMult: 0.6, headMult: 1.7, rpm: 720, pellets: 1,
    magazine: 30, reserve: 210, reloadTime: 1.7, spread: 0.028, adsSpread: 0.006, adsZoom: 1.4,
    recoil: 0.015, moveMult: 1.0, range: 34, sound: "rifle", unlockLevel: 0, color: "#b9ff3a",
  },
  {
    id: "ak", name: "AK-74", category: "rifle", icon: "🗡", auto: true,
    damage: 36, falloffStart: 9, falloffEnd: 26, minMult: 0.6, headMult: 1.7, rpm: 600, pellets: 1,
    magazine: 30, reserve: 180, reloadTime: 2.0, spread: 0.032, adsSpread: 0.01, adsZoom: 1.4,
    recoil: 0.02, moveMult: 0.98, range: 34, sound: "rifle", unlockLevel: 4, color: "#f59e0b",
  },
  {
    id: "spas", name: "SPAS-12", category: "shotgun", icon: "🧨", auto: false,
    damage: 13, falloffStart: 3, falloffEnd: 10, minMult: 0.15, headMult: 1.3, rpm: 90, pellets: 9,
    magazine: 7, reserve: 42, reloadTime: 2.6, spread: 0.12, adsSpread: 0.08, adsZoom: 1.05,
    recoil: 0.03, moveMult: 1.02, range: 12, sound: "shotgun", unlockLevel: 3, color: "#ef4444",
  },
  {
    id: "barrett", name: "Barrett .50", category: "sniper", icon: "🎯", auto: false,
    damage: 145, falloffStart: 20, falloffEnd: 60, minMult: 0.85, headMult: 2.5, rpm: 45, pellets: 1,
    magazine: 7, reserve: 35, reloadTime: 3.0, spread: 0.03, adsSpread: 0.0005, adsZoom: 3.0,
    recoil: 0.06, moveMult: 0.9, range: 80, sound: "sniper", unlockLevel: 6, color: "#c084fc",
  },
  {
    id: "dmr", name: "SR-25 DMR", category: "sniper", icon: "🎯", auto: false,
    damage: 62, falloffStart: 16, falloffEnd: 44, minMult: 0.75, headMult: 2.0, rpm: 200, pellets: 1,
    magazine: 20, reserve: 120, reloadTime: 2.2, spread: 0.02, adsSpread: 0.002, adsZoom: 2.2,
    recoil: 0.03, moveMult: 0.96, range: 60, sound: "sniper", unlockLevel: 8, color: "#38bdf8",
  },
  {
    id: "lmg", name: "M249 SAW", category: "lmg", icon: "⚙", auto: true,
    damage: 28, falloffStart: 12, falloffEnd: 32, minMult: 0.6, headMult: 1.4, rpm: 760, pellets: 1,
    magazine: 100, reserve: 300, reloadTime: 4.2, spread: 0.05, adsSpread: 0.02, adsZoom: 1.3,
    recoil: 0.014, moveMult: 0.85, range: 36, sound: "lmg", unlockLevel: 10, color: "#fb7185",
  },
  {
    id: "rpg", name: "RPG-7", category: "launcher", icon: "🚀", auto: false,
    damage: 130, falloffStart: 0, falloffEnd: 0, minMult: 1, headMult: 1, rpm: 30, pellets: 1,
    magazine: 1, reserve: 5, reloadTime: 3.4, spread: 0.005, adsSpread: 0.005, adsZoom: 1.2,
    recoil: 0.05, moveMult: 0.9, range: 60, splash: 3.2, sound: "rocket", unlockLevel: 12, color: "#f97316",
  },
  {
    id: "knife", name: "Combat Knife", category: "melee", icon: "🔪", auto: false,
    damage: 135, falloffStart: 0, falloffEnd: 0, minMult: 1, headMult: 1, rpm: 120, pellets: 1,
    magazine: 1, reserve: 0, reloadTime: 0, spread: 0, adsSpread: 0, adsZoom: 1,
    recoil: 0, moveMult: 1.15, range: 1.6, sound: "knife", unlockLevel: 0, color: "#94a3b8",
  },
];

export function weaponById(id: string): WeaponDef {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}

export function damageAtRange(w: WeaponDef, tiles: number): number {
  if (tiles <= w.falloffStart || w.falloffEnd <= w.falloffStart) return w.damage;
  if (tiles >= w.falloffEnd) return w.damage * w.minMult;
  const t = (tiles - w.falloffStart) / (w.falloffEnd - w.falloffStart);
  return w.damage * (1 - t * (1 - w.minMult));
}

export interface Loadout {
  primary: string;
  secondary: string;
  perk: string;
}

export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export const PERKS: PerkDef[] = [
  { id: "juggernaut", name: "Juggernaut", desc: "+40 max armour plating", icon: "🛡" },
  { id: "lightweight", name: "Lightweight", desc: "+12% move speed", icon: "🏃" },
  { id: "scavenger", name: "Scavenger", desc: "Kills refill spare ammo", icon: "🎒" },
  { id: "medic", name: "Combat Medic", desc: "Faster health regen", icon: "✚" },
  { id: "steady", name: "Steady Aim", desc: "−35% weapon spread", icon: "🎯" },
  { id: "quickhands", name: "Quick Hands", desc: "−30% reload time", icon: "🖐" },
];

export function perkById(id: string): PerkDef {
  return PERKS.find((p) => p.id === id) || PERKS[0];
}
