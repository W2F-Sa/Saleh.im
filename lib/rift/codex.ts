// ============================================================================
//  Rift — the in-game Codex: bestiary and field-manual lore.
//
//  Purely descriptive data consumed by the menu's Codex tab. Kept separate
//  from enemies.ts/heroes.ts/weapons.ts (which are simulation data) so lore
//  copywriting can change freely without touching balance-sensitive numbers.
// ============================================================================

import { EnemyKind } from "./enemies";

export interface CodexEntry {
  kind: EnemyKind;
  flavor: string;
  tacticalNote: string;
  threat: 1 | 2 | 3 | 4 | 5;
}

export const ENEMY_CODEX: CodexEntry[] = [
  { kind: "grunt", flavor: "Mass-produced and disposable — the Rift throws thousands of these before it tries anything clever.", tacticalNote: "No special behaviour. Safe to ignore briefly if something scarier is on screen.", threat: 1 },
  { kind: "swift", flavor: "Barely armoured, built purely for speed — a lone swift is nothing, a pack of them is a real problem.", tacticalNote: "Pierce and multishot upgrades trivialise swift swarms.", threat: 1 },
  { kind: "brute", flavor: "A slab of plating on legs. It doesn't dodge, doesn't retreat, and doesn't care about your hero — only the Core.", tacticalNote: "Prioritise it before it reaches the Core; it deals heavy contact damage per second.", threat: 3 },
  { kind: "shooter", flavor: "Keeps its distance and chips away with ranged fire rather than closing in like the others.", tacticalNote: "Kill on sight — its damage adds up fast if left alone across a wave.", threat: 2 },
  { kind: "bomber", flavor: "A living charge that sprints the moment it spots you and detonates on contact.", tacticalNote: "Kill it from range. Letting it reach you or the Core costs a chunk of health either way.", threat: 3 },
  { kind: "shielded", flavor: "A frontal energy shield deflects anything approaching from directly ahead of it.", tacticalNote: "Shots from the sides or behind ignore the shield entirely — positioning beats damage here.", threat: 3 },
  { kind: "splitter", flavor: "Its death doesn't end the fight — it ends it twice, breaking into a pair of swifts.", tacticalNote: "Don't stand still when one dies; the offspring spawn already moving.", threat: 2 },
  { kind: "sniper", flavor: "Plants itself at range, telegraphs for just over a second, then fires one shot that really hurts.", tacticalNote: "Break line of sight during the telegraph, or simply out-damage it before the shot lands.", threat: 3 },
  { kind: "healer", flavor: "Contributes no damage of its own — it just keeps everything around it alive far longer than it should be.", tacticalNote: "Always the first target in a mixed pack; ignoring it prolongs every fight it's part of.", threat: 3 },
  { kind: "summoner", flavor: "Calls in fresh grunts every few seconds for as long as it's allowed to live.", tacticalNote: "Treat it like a spawner, not a combatant — killing it stops the bleeding immediately.", threat: 4 },
  { kind: "phantom", flavor: "Blinks in short bursts rather than walking, making it a nightmare to lead shots against.", tacticalNote: "Pierce/railgun-style weapons that don't need precise leading handle it far better than hitscan bursts.", threat: 3 },
  { kind: "berserker", flavor: "The lower its own health falls, the faster and angrier it gets — a losing fight can suddenly reverse.", tacticalNote: "Commit to killing it once you've started; disengaging just lets it recover its composure, not its health.", threat: 4 },
  { kind: "turret", flavor: "Doesn't chase — plants itself the instant it lands and starts putting rounds downrange from well outside brawling distance.", tacticalNote: "Its total lack of mobility makes it the easiest kill in its sector once you close the distance or line up a shot.", threat: 2 },
  { kind: "cloaker", flavor: "Spends most of a fight nearly transparent, only becoming visible for the instant it commits to a dash.", tacticalNote: "Listen for its dash cue rather than trying to track it visually — reacting to the dash beats trying to predict it.", threat: 4 },
  { kind: "juggernaut", flavor: "A brute that someone decided wasn't tanky enough, so they welded on more plating and called it a day.", tacticalNote: "Its damage-reduction plating rewards sustained fire over burst — pierce weapons shine here.", threat: 5 },
];

export function codexFor(kind: EnemyKind): CodexEntry {
  return ENEMY_CODEX.find((c) => c.kind === kind) || ENEMY_CODEX[0];
}

export interface BossLore {
  kind: string;
  lore: string;
  strategy: string;
}

export const BOSS_LORE: BossLore[] = [
  {
    kind: "colossus",
    lore: "The first thing the Rift ever built with the sole purpose of ending a defender. Nothing about it is subtle: it walks forward, it slams the ground, and it fires in a wide spread. What it lacks in cleverness it makes up for in raw plating.",
    strategy: "Circle-strafe around its slam radius and keep firing during its volley phase — the pattern repeats on a strict 6-second cycle once you learn it.",
  },
  {
    kind: "hive",
    lore: "Less a single creature than a coordination point — the Hive itself barely fights, but it never stops calling in more bodies to do the fighting for it.",
    strategy: "Focus the Hive over its adds whenever you get a clean window; the adds stop coming the instant it dies.",
  },
  {
    kind: "warden",
    lore: "A shield generator wrapped around something that used to need protecting, and no longer does. It raises its shield on a rhythm, dashes to punish overextension, and volleys in wide, hard-to-dodge spreads.",
    strategy: "Save burst damage and abilities for the windows right after its shield drops — damage during the shield is mostly wasted.",
  },
  {
    kind: "reaper",
    lore: "Faster than anything its size has any right to be. It doesn't out-tank you, it out-positions you, dashing in and out of engagement range before you can react.",
    strategy: "Movement abilities like Blink or Time Dilation swing this fight harder than raw damage upgrades do.",
  },
  {
    kind: "aeon",
    lore: "The Rift's final answer, built from everything it learned watching every defender before you. It shields, it dashes, it volleys in a near-full circle, and by its last phase it's calling in help too.",
    strategy: "Treat each phase as a different boss — the pattern resets and intensifies every time its health crosses a threshold.",
  },
  {
    kind: "eclipse",
    lore: "It shouldn't exist. The Rift only builds this when a defender comes back after already sealing it once, as if daring them to try a second time.",
    strategy: "Every Aeon tactic still applies, faster and with less room for error — this fight punishes greed more than any before it.",
  },
];

export function bossLoreFor(kind: string): BossLore {
  return BOSS_LORE.find((b) => b.kind === kind) || BOSS_LORE[0];
}

/* ------------------------------------------------------------------ */
/*  Hero/weapon synergy notes — shown on the Heroes tab to help players */
/*  build a coherent loadout instead of picking pieces at random.       */
/* ------------------------------------------------------------------ */

export interface SynergyNote {
  heroId: string;
  bestWeapon: string;
  bestAbilities: [string, string];
  reasoning: string;
}

export const SYNERGY_NOTES: SynergyNote[] = [
  {
    heroId: "vanguard",
    bestWeapon: "blaster",
    bestAbilities: ["nova", "blink"],
    reasoning: "No weaknesses to build around — the Pulse Blaster's reliability and a general-purpose ability pair keep every run flexible.",
  },
  {
    heroId: "striker",
    bestWeapon: "chainlaser",
    bestAbilities: ["overdrive", "blink"],
    reasoning: "Her fire-rate ramp and the Chain Laser's damage ramp compound — staying locked onto one target rewards both mechanics at once.",
  },
  {
    heroId: "bastion",
    bestWeapon: "shotgun",
    bestAbilities: ["shieldwall", "turretStorm"],
    reasoning: "Already the tankiest hero — doubling down with Shield Wall and turret support turns the Core's doorstep into a wall no wave gets through.",
  },
  {
    heroId: "prospector",
    bestWeapon: "missiles",
    bestAbilities: ["nova", "timeDilation"],
    reasoning: "Gold gain doesn't help mid-fight, so lean on high-damage tools like Seeker Missiles and crowd-clearing abilities to survive long enough to spend it.",
  },
  {
    heroId: "ghost",
    bestWeapon: "railgun",
    bestAbilities: ["blink", "timeDilation"],
    reasoning: "Extended invulnerability rewards aggressive positioning — the Railgun's pierce lets her line up shots through a whole wave while weaving between hits.",
  },
  {
    heroId: "overclocked",
    bestWeapon: "orbitals",
    bestAbilities: ["overdrive", "turretStorm"],
    reasoning: "Faster ability cooldowns mean Overdrive and Turret Storm are both up far more often — stack cooldown-hungry tools to make the most of the passive.",
  },
];

export function synergyFor(heroId: string): SynergyNote | null {
  return SYNERGY_NOTES.find((s) => s.heroId === heroId) || null;
}

/** Rotating field tips shown on menu load / loading transitions. */
export const FIELD_TIPS: string[] = [
  "Shielded Wardens only block damage from directly ahead — flank them.",
  "The Chain Laser's damage ramps the longer it stays on one target; don't jump between enemies with it.",
  "Seeker Missiles explode on impact or at the end of their life — they always deal splash damage.",
  "A Summoner left alive will keep the wave populated indefinitely. Kill it first.",
  "Orbital Drones deal no bullet damage at all — their radius is your real weapon range.",
  "Berserkers get faster and harder-hitting as their own health drops — finish them quickly once engaged.",
  "Bosses shift their attack pattern at 66% and 33% health — relearn the rhythm each phase.",
  "The Ghost hero's extended invulnerability window rewards trading hits rather than avoiding them entirely.",
  "Salvage Magnet upgrades pull gold from much further away — huge for clearing dense waves fast.",
  "Ability cooldowns are shown on your hotbar — plan Nova Burst or Time Dilation around boss volleys.",
];

export function randomTip(): string {
  return FIELD_TIPS[Math.floor(Math.random() * FIELD_TIPS.length)];
}
