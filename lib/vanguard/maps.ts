// ============================================================================
//  Vanguard — battle maps.
//
//  Maps are authored as ASCII art for readability and parsed into numeric
//  grids the raycaster consumes. Each glyph maps to a wall material (with a
//  distinct procedural texture + colour) or to a floor feature such as a spawn
//  point or a pickup. Several sizes are provided, from tight arenas to sprawl-
//  ing multi-lane battlegrounds, so both single-player skirmishes and online
//  team matches have room to breathe.
// ============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

export type MapTheme = "facility" | "urban" | "desert" | "harbor" | "arctic" | "temple";

export type PickupKind = "health" | "armor" | "ammo";

export interface ItemSpawn {
  x: number;
  y: number;
  kind: PickupKind;
}

export interface GameMap {
  id: string;
  name: string;
  theme: MapTheme;
  description: string;
  size: "small" | "medium" | "large";
  grid: number[][]; // [y][x]; 0 = floor, >0 = wall material id
  width: number;
  height: number;
  spawns: Vec2[];
  items: ItemSpawn[];
  ceilingColor: string;
  floorColor: string;
  fogColor: string;
  ambient: number; // 0..1 base brightness
}

// Material palette keyed by wall id. Index 0 is unused (floor).
export interface WallMaterial {
  id: number;
  name: string;
  base: string;   // primary colour
  shade: string;  // darker edge colour
  texture: "brick" | "panel" | "concrete" | "crate" | "glass" | "rock" | "hedge" | "tech";
}

export const WALL_MATERIALS: WallMaterial[] = [
  { id: 0, name: "floor", base: "#000000", shade: "#000000", texture: "concrete" },
  { id: 1, name: "concrete", base: "#5b6472", shade: "#3a4150", texture: "concrete" },
  { id: 2, name: "metal", base: "#7c8794", shade: "#4b535e", texture: "panel" },
  { id: 3, name: "brick", base: "#9c5b45", shade: "#61382a", texture: "brick" },
  { id: 4, name: "crate", base: "#b98a4b", shade: "#7c5a2e", texture: "crate" },
  { id: 5, name: "glass", base: "#5fd0e6", shade: "#2f8fa6", texture: "glass" },
  { id: 6, name: "rock", base: "#8a7f70", shade: "#564f45", texture: "rock" },
  { id: 7, name: "hedge", base: "#3f7d43", shade: "#255029", texture: "hedge" },
  { id: 8, name: "tech", base: "#6d5bd0", shade: "#3c3178", texture: "tech" },
  { id: 9, name: "hazard", base: "#d1a33a", shade: "#8a6a1f", texture: "panel" },
];

export function materialById(id: number): WallMaterial {
  return WALL_MATERIALS[id] || WALL_MATERIALS[1];
}

// Glyph -> wall material id.
const GLYPH_WALL: Record<string, number> = {
  "#": 1, // concrete
  "=": 2, // metal
  B: 3,   // brick
  C: 4,   // crate
  G: 5,   // glass
  R: 6,   // rock
  H: 7,   // hedge (H reused as hedge in outdoor maps)
  T: 8,   // tech
  Z: 9,   // hazard
};

// Glyph -> floor feature.
// s = spawn, h = health, a = armor, m = ammo, "." or space = empty floor
interface ParseResult {
  grid: number[][];
  spawns: Vec2[];
  items: ItemSpawn[];
  width: number;
  height: number;
}

function parseAscii(rows: string[]): ParseResult {
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const grid: number[][] = [];
  const spawns: Vec2[] = [];
  const items: ItemSpawn[] = [];
  for (let y = 0; y < height; y++) {
    const line = rows[y].padEnd(width, "#");
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const ch = line[x];
      const wall = GLYPH_WALL[ch];
      if (wall) {
        row.push(wall);
        continue;
      }
      row.push(0);
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (ch === "s") spawns.push({ x: cx, y: cy });
      else if (ch === "h") items.push({ x: cx, y: cy, kind: "health" });
      else if (ch === "a") items.push({ x: cx, y: cy, kind: "armor" });
      else if (ch === "m") items.push({ x: cx, y: cy, kind: "ammo" });
    }
    grid.push(row);
  }
  return { grid, spawns, items, width, height };
}

// ---------------------------------------------------------------------------
//  Map 1 — Blacksite (facility, medium)
// ---------------------------------------------------------------------------
const BLACKSITE = [
  "########################################",
  "#s...........#=======#...........h....s#",
  "#....CCC.....#..m....=....CCC..........#",
  "#....C.C.....=.......=....C.C....=====.#",
  "#....CCC.....=..###..=....CCC....=...=.#",
  "#............=..#a#..=...........=.m.=.#",
  "#....########....#...........#####...=.#",
  "#....#......#........s.......#.......=.#",
  "#....#..GG..#....#######.....#..CCC..=.#",
  "#....#..GG..#....#.....#.....#..C.C..=.#",
  "#....#......#....#..h..#.....#..CCC....#",
  "#....########....#.....#.....#####.....#",
  "#................#######...............#",
  "#..======..................======..m..#",
  "#..=....=....CCC....s....CCC....=....=..#",
  "#..=.a..=....C.C.........C.C....=.a..=..#",
  "#..=....=....CCC....#....CCC....=....=..#",
  "#..======..........#.........======....#",
  "#..................#...................#",
  "#s....h....========#========....h....s.#",
  "########################################",
];

// ---------------------------------------------------------------------------
//  Map 2 — Downtown (urban, large)
// ---------------------------------------------------------------------------
const DOWNTOWN = [
  "##################################################",
  "#s....BBBB....BBBB......BBBB....BBBB....BBBB....s.#",
  "#.....B..B....B..B......B..B....B..B....B..B......#",
  "#.....B..B..m.B..B..h...B..B....B..B..a.B..B......#",
  "#.....BBBB....BBBB......BBBB....BBBB....BBBB......#",
  "#................................................#",
  "#..CC....CC....CC.........CC....CC....CC....CC....#",
  "#..CC....CC....CC....s....CC....CC....CC....CC....#",
  "#................................................#",
  "#..BBBBBB....========....BBBBBB....========.......#",
  "#..B....B....=......=....B....B....=......=..h....#",
  "#..B.hh.B....=..GG..=....B.mm.B....=..GG..=.......#",
  "#..B....B....=..GG..=....B....B....=..GG..=.......#",
  "#..BBBBBB....=......=....BBBBBB....=......=.......#",
  "#............=......=..............=......=.......#",
  "#..s.........========....s........========....s..#",
  "#................................................#",
  "#..CCCC....BBBB....CCCC.......CCCC....BBBB........#",
  "#..C..C....B..B....C..C...a...C..C....B..B..m.....#",
  "#..C..C....B..B....C..C.......C..C....B..B........#",
  "#..CCCC....BBBB....CCCC.......CCCC....BBBB........#",
  "#................................................#",
  "#........========........========........h.......#",
  "#..h.....=......=...s....=......=.....s...........#",
  "#........=.mm...=........=..aa..=.................#",
  "#........=......=........=......=.................#",
  "#........========........========................#",
  "#s..............................................s#",
  "##################################################",
];

// ---------------------------------------------------------------------------
//  Map 3 — Dust Bowl (desert, large)
// ---------------------------------------------------------------------------
const DUSTBOWL = [
  "##################################################",
  "#s........RR........RR........RR........RR.....s.#",
  "#.........RR....h...RR....m...RR....a...RR.......#",
  "#................................................#",
  "#..CCCC..............RRRR..............CCCC......#",
  "#..C..C....RR........R..R........RR....C..C......#",
  "#..C..C....RR....s...R..R...s....RR....C..C......#",
  "#..CCCC..............RRRR..............CCCC......#",
  "#................................................#",
  "#....RRRRRR..........h..........RRRRRR...........#",
  "#....R....R.....CCCC.....CCCC....R....R....a.....#",
  "#....R.mm.R.....C..C.....C..C....R.hh.R..........#",
  "#....R....R.....C..C.....C..C....R....R..........#",
  "#....RRRRRR.....CCCC.....CCCC....RRRRRR...........#",
  "#................................................#",
  "#..s.......RR.................RR.........s........#",
  "#..........RR.......ZZZZ......RR..................#",
  "#..CCCC.............Z..Z.............CCCC...m.....#",
  "#..C..C....a........Z..Z........h....C..C........#",
  "#..C..C.............ZZZZ.............C..C.........#",
  "#..CCCC..............................CCCC........#",
  "#................................................#",
  "#....RR........RR........RR........RR.............#",
  "#....RR....s...RR...h....RR...m....RR....s........#",
  "#s..............................................s#",
  "##################################################",
];

// ---------------------------------------------------------------------------
//  Map 4 — Cargo (harbor, medium)
// ---------------------------------------------------------------------------
const CARGO = [
  "########################################",
  "#s....CCCC....CCCC....CCCC....CCCC....s.#",
  "#.....C..C....C..C....C..C....C..C......#",
  "#..m..C..C.h..C..C....C..C..a.C..C......#",
  "#.....CCCC....CCCC....CCCC....CCCC......#",
  "#......................................#",
  "#..======..............======..........#",
  "#..=....=....CCCCCC....=....=....s......#",
  "#..=.hh.=....C....C....=.mm.=...........#",
  "#..=....=....C.ss.C....=....=...........#",
  "#..======....C....C....======....a.....#",
  "#............CCCCCC....................#",
  "#......................................#",
  "#..CCCC....========....CCCC....CCCC....#",
  "#..C..C....=......=....C..C....C..C....#",
  "#..C..C..m.=..GG..=.h..C..C..a.C..C....#",
  "#..CCCC....=..GG..=....CCCC....CCCC....#",
  "#..........=......=....................#",
  "#s.........========....s............s..#",
  "########################################",
];

// ---------------------------------------------------------------------------
//  Map 5 — Whiteout (arctic, medium)
// ---------------------------------------------------------------------------
const WHITEOUT = [
  "########################################",
  "#s.....RR......RR......RR......RR.....s.#",
  "#......RR..h...RR..m...RR..a...RR......#",
  "#......................................#",
  "#..CCCC......======......CCCC..........#",
  "#..C..C......=....=......C..C....s.....#",
  "#..C..C..s...=.GG.=..h...C..C..........#",
  "#..CCCC......=.GG.=......CCCC...........#",
  "#............=....=.....................#",
  "#..RR........======.......RR....a......#",
  "#..RR...CCCC.........CCCC..RR...........#",
  "#.......C..C....s....C..C................#",
  "#..a....C..C.........C..C.......h.......#",
  "#.......CCCC.........CCCC...............#",
  "#......................................#",
  "#..======......RR......RR......======..#",
  "#..=....=..m...RR..h...RR..m...=....=..#",
  "#..=.hh.=......................=.aa.=..#",
  "#..======......s......s........======..#",
  "#s....................................s#",
  "########################################",
];

// ---------------------------------------------------------------------------
//  Map 6 — Sanctum (temple, large)
// ---------------------------------------------------------------------------
const SANCTUM = [
  "##################################################",
  "#s......BB........TT........TT........BB.......s.#",
  "#.......BB....h...TT....m...TT....a...BB.........#",
  "#................................................#",
  "#..TTTT..............BBBB..............TTTT......#",
  "#..T..T....BB........B..B........BB....T..T......#",
  "#..T..T....BB....s...B..B...s....BB....T..T......#",
  "#..TTTT..............BBBB..............TTTT......#",
  "#................................................#",
  "#....BBBBBB..........h..........BBBBBB...........#",
  "#....B....B.....TTTT.....TTTT....B....B....a.....#",
  "#....B.mm.B.....T..T.....T..T....B.hh.B..........#",
  "#....B....B.....T..T.....T..T....B....B..........#",
  "#....BBBBBB.....TTTT.....TTTT....BBBBBB...........#",
  "#................................................#",
  "#..s.......BB.................BB.........s........#",
  "#..........BB.......TTTT......BB..................#",
  "#..TTTT.............T..T.............TTTT...m.....#",
  "#..T..T....a........T..T........h....T..T........#",
  "#..T..T.............TTTT.............T..T.........#",
  "#..TTTT..............................TTTT........#",
  "#................................................#",
  "#....TT........TT........TT........TT.............#",
  "#....TT....s...TT...h....TT...m....TT....s........#",
  "#s..............................................s#",
  "##################################################",
];

// ---------------------------------------------------------------------------
//  Map 7 — Killhouse (facility, small — fast, close-quarters)
// ---------------------------------------------------------------------------
const KILLHOUSE = [
  "############################",
  "#s....CC........CC.....s...#",
  "#.....CC...mm...CC..........#",
  "#..........................#",
  "#..====......h......====...#",
  "#..=..=..CC.....CC..=..=....#",
  "#..=..=..CC..s..CC..=..=....#",
  "#..====......a......====....#",
  "#..........................#",
  "#.....CC...mm...CC.........#",
  "#s....CC........CC.....s...#",
  "############################",
];

// ---------------------------------------------------------------------------
//  Map 8 — Overgrowth (urban ruins with hedges, large)
// ---------------------------------------------------------------------------
const OVERGROWTH = [
  "##################################################",
  "#s....HHHH....BBBB......HHHH....BBBB....HHHH....s.#",
  "#.....H..H....B..B......H..H....B..B....H..H......#",
  "#.....H..H..m.B..B..h...H..H....B..B..a.H..H......#",
  "#.....HHHH....BBBB......HHHH....BBBB....HHHH......#",
  "#................................................#",
  "#..CC....HH....CC.........CC....HH....CC....CC....#",
  "#..CC....HH....CC....s....CC....HH....CC....CC....#",
  "#................................................#",
  "#..HHHHHH....BBBBBB......HHHHHH....BBBBBB.........#",
  "#..H....H....B....B......H....H....B....B..h......#",
  "#..H.hh.H....B.mm.B......H....H....B.mm.B.........#",
  "#..H....H....B....B......H....H....B....B.........#",
  "#..HHHHHH....BBBBBB......HHHHHH....BBBBBB.........#",
  "#................................................#",
  "#..s.........HHHH........s........HHHH........s...#",
  "#............H..H.................H..H............#",
  "#..BBBB......H..H....CCCC.....BBBB.H..H..m........#",
  "#..B..B..a...HHHH....C..C.....B..B.HHHH...........#",
  "#..B..B.............C..C.....B..B................#",
  "#..BBBB.............CCCC.....BBBB................#",
  "#................................................#",
  "#........HHHH............HHHH............h........#",
  "#..h.....H..H......s.....H..H......s.............#",
  "#........H..H............H..H....................#",
  "#........HHHH............HHHH....................#",
  "#s..............................................s#",
  "##################################################",
];

function buildMap(
  id: string,
  name: string,
  theme: MapTheme,
  description: string,
  size: GameMap["size"],
  rows: string[],
  visuals: { ceilingColor: string; floorColor: string; fogColor: string; ambient: number },
): GameMap {
  const parsed = parseAscii(rows);
  return {
    id,
    name,
    theme,
    description,
    size,
    grid: parsed.grid,
    width: parsed.width,
    height: parsed.height,
    spawns: parsed.spawns.length ? parsed.spawns : [{ x: 2.5, y: 2.5 }],
    items: parsed.items,
    ...visuals,
  };
}

export const MAPS: GameMap[] = [
  buildMap("blacksite", "Blacksite", "facility", "A buried research complex of tight corridors and crate stacks.", "medium", BLACKSITE, {
    ceilingColor: "#1c2230", floorColor: "#2a303c", fogColor: "#0b0e15", ambient: 0.55,
  }),
  buildMap("downtown", "Downtown", "urban", "Bombed-out city blocks with long sightlines and cover.", "large", DOWNTOWN, {
    ceilingColor: "#26303f", floorColor: "#333b47", fogColor: "#10151f", ambient: 0.62,
  }),
  buildMap("dustbowl", "Dust Bowl", "desert", "Sun-baked ruins and boulders across an open bowl.", "large", DUSTBOWL, {
    ceilingColor: "#c9a86b", floorColor: "#b8965a", fogColor: "#d9c08a", ambient: 0.8,
  }),
  buildMap("cargo", "Cargo", "harbor", "A container yard of stacked crates and shipping lanes.", "medium", CARGO, {
    ceilingColor: "#1f2a33", floorColor: "#2c3a44", fogColor: "#0d1519", ambient: 0.58,
  }),
  buildMap("whiteout", "Whiteout", "arctic", "A frozen outpost swallowed by drifting snow.", "medium", WHITEOUT, {
    ceilingColor: "#c7d6e3", floorColor: "#d7e4ef", fogColor: "#e8f1f8", ambient: 0.9,
  }),
  buildMap("sanctum", "Sanctum", "temple", "Sunlit stone halls and pillars of an ancient sanctum.", "large", SANCTUM, {
    ceilingColor: "#3a2f24", floorColor: "#5a4a38", fogColor: "#2a2118", ambient: 0.7,
  }),
  buildMap("killhouse", "Killhouse", "facility", "A cramped training shell built for relentless close combat.", "small", KILLHOUSE, {
    ceilingColor: "#22282f", floorColor: "#30373f", fogColor: "#0c1013", ambient: 0.6,
  }),
  buildMap("overgrowth", "Overgrowth", "urban", "Reclaimed streets where hedgerows split the ruins.", "large", OVERGROWTH, {
    ceilingColor: "#233026", floorColor: "#2f3d31", fogColor: "#111b13", ambient: 0.64,
  }),
];

export function mapById(id: string): GameMap {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

// Solid test used by the raycaster + AI: is the given tile a wall / out of bounds?
export function isWall(map: GameMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return true;
  return map.grid[ty][tx] > 0;
}

// Pick a spawn point far from a list of positions (used to avoid spawn camping).
export function pickSpawn(map: GameMap, avoid: Vec2[], minDist = 6): Vec2 {
  let best = map.spawns[0];
  let bestScore = -Infinity;
  for (const s of map.spawns) {
    let score = Infinity;
    for (const a of avoid) {
      const d = Math.hypot(s.x - a.x, s.y - a.y);
      if (d < score) score = d;
    }
    if (avoid.length === 0) score = Math.random() * 100;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  // If everything is crowded, jitter around the best.
  if (bestScore < minDist && avoid.length > 0) {
    return { x: best.x, y: best.y };
  }
  return { x: best.x, y: best.y };
}
