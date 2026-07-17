// ============================================================================
//  Rift — active abilities.
//
//  Beyond the passive upgrade pool, a run now has room for up to two active
//  abilities, bound to keys 1/2, each with its own cooldown. They're offered
//  in the shop alongside upgrades (as "epic"-tier one-offs) so a build can
//  meaningfully diverge run to run.
// ============================================================================

export type AbilityId = "nova" | "overdrive" | "shieldwall" | "blink" | "turretStorm" | "timeDilation";

export interface AbilityDef {
  id: AbilityId;
  name: string;
  desc: string;
  icon: string;
  cooldown: number; // seconds
  color: string;
}

export const ABILITIES: AbilityDef[] = [
  {
    id: "nova",
    name: "Nova Burst",
    desc: "Releases a shockwave that damages and knocks back every enemy on screen.",
    icon: "☀",
    cooldown: 18,
    color: "#ffd84d",
  },
  {
    id: "overdrive",
    name: "Overdrive",
    desc: "For 6 seconds, fire rate and move speed are both doubled.",
    icon: "⚡",
    cooldown: 26,
    color: "#67e8f9",
  },
  {
    id: "shieldwall",
    name: "Shield Wall",
    desc: "Grants a shield that absorbs the next 120 damage, or fades after 8 seconds.",
    icon: "🛡",
    cooldown: 22,
    color: "#38bdf8",
  },
  {
    id: "blink",
    name: "Blink",
    desc: "Instantly teleport to the tapped/aimed direction and gain 1s of invulnerability.",
    icon: "✦",
    cooldown: 10,
    color: "#c084fc",
  },
  {
    id: "turretStorm",
    name: "Turret Storm",
    desc: "Deploys three temporary turrets around the hero for 12 seconds.",
    icon: "🗼",
    cooldown: 30,
    color: "#b9ff3a",
  },
  {
    id: "timeDilation",
    name: "Time Dilation",
    desc: "Slows every enemy and enemy projectile to 40% speed for 5 seconds.",
    icon: "⏳",
    cooldown: 28,
    color: "#f472b6",
  },
];

export function abilityById(id: AbilityId): AbilityDef {
  return ABILITIES.find((a) => a.id === id) || ABILITIES[0];
}

export interface AbilitySlotState {
  id: AbilityId | null;
  cooldownLeft: number;
  activeLeft: number; // remaining duration of an active effect, 0 if inactive
}

export function newAbilitySlot(): AbilitySlotState {
  return { id: null, cooldownLeft: 0, activeLeft: 0 };
}
