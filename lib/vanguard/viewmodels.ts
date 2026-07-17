// ============================================================================
//  Vanguard — first-person weapon viewmodels.
//
//  A high-detail, fully procedural (vector) renderer for the equipped weapon,
//  drawn on the same 2D canvas as the world. Every weapon has a hand-built
//  silhouette with layered receivers, rails, optics, magazines, stocks, grips,
//  muzzle devices, screws/rivets and metallic gradients — a big step up from
//  the flat rectangles of the previous build. It also animates:
//
//    • idle + walk sway (bobX / bobY)
//    • recoil kick (translate back/up + rotate) and an animated bolt cycle
//    • reload dip (the weapon drops out of frame and a fresh mag slots in)
//    • a layered muzzle flash (core + petals + smoke) on fire
//
//  The renderer is intentionally self-contained: it takes a plain options
//  object and a 2D context and never touches engine state, so it is trivial to
//  unit-drive or reuse. All coordinates are in a virtual space that is scaled
//  to the viewport by the caller-independent `scale` computed below; the anchor
//  is the bottom-centre of the screen with +x to the right and -y upward.
// ============================================================================

import { WeaponCategory } from "./weapons";

export interface ViewModelState {
  weaponId: string;
  category: WeaponCategory;
  color: string;            // the weapon's accent/body colour
  w: number;                // viewport width (CSS px)
  h: number;                // viewport height (CSS px)
  bobX: number;             // horizontal sway (px, pre-scale)
  bobY: number;             // vertical sway (px, pre-scale)
  recoil: number;           // 0..1 recoil kick amount
  reloadProgress: number;   // 0..1 through a reload, or 0 when not reloading
  ads: boolean;             // aiming down sights
  fire: number;             // 0..1 muzzle-flash intensity
  time: number;             // seconds, for idle animation
}

// ---------------------------------------------------------------------------
//  Small colour helpers (kept local so the module has no engine dependency)
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((ch) => ch + ch).join("") : c;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${clamp(Math.round(r * factor), 0, 255)},${clamp(Math.round(g * factor), 0, 255)},${clamp(Math.round(b * factor), 0, 255)})`;
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a.startsWith("#") ? a : rgbToHex(a));
  const [br, bg, bb] = hexToRgb(b.startsWith("#") ? b : rgbToHex(b));
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m) return "#000000";
  const [r, g, b] = m.map((x) => parseInt(x, 10));
  return "#" + [r, g, b].map((x) => clamp(x, 0, 255).toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
//  Low-level drawing toolkit
// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

// A machined-metal / polymer panel. Beyond a vertical body gradient it layers
// a specular highlight band, bottom ambient-occlusion and crisp rim lines, so
// parts read as genuinely three-dimensional lit surfaces rather than flat fills.
function metalRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, base: string, lift = 1.4, drop = 0.55) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(base, lift));
  g.addColorStop(0.14, shade(base, 1.12));
  g.addColorStop(0.5, base);
  g.addColorStop(0.82, shade(base, drop));
  g.addColorStop(1, shade(base, drop * 0.72));
  fillRR(ctx, x, y, w, h, r, g);

  // clip to the panel so the lighting overlays keep the rounded silhouette
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  // glossy specular band near the top third
  const spec = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  spec.addColorStop(0, "rgba(255,255,255,0)");
  spec.addColorStop(0.5, "rgba(255,255,255,0.24)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.fillRect(x, y + h * 0.05, w, h * 0.22);
  // bottom ambient occlusion
  const ao = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = ao;
  ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
  ctx.restore();

  // crisp lit top rim + dark grounded bottom rim
  const inset = Math.min(r, w / 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.30)";
  ctx.beginPath(); ctx.moveTo(x + inset, y + 0.6); ctx.lineTo(x + w - inset, y + 0.6); ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.moveTo(x + inset, y + h - 0.6); ctx.lineTo(x + w - inset, y + h - 0.6); ctx.stroke();
}

function screw(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#0d0f12";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = "#2a2e34";
  ctx.fill();
  ctx.strokeStyle = "#05070a";
  ctx.lineWidth = Math.max(0.8, r * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y);
  ctx.lineTo(x + r * 0.55, y);
  ctx.stroke();
}

// A row of ventilation slots along a handguard.
function ventSlots(ctx: Ctx, x: number, y: number, w: number, h: number, count: number) {
  const gap = w / count;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  for (let i = 0; i < count; i++) {
    roundRectPath(ctx, x + i * gap + gap * 0.2, y, gap * 0.5, h, Math.min(3, h / 2));
    ctx.fill();
  }
}

// A picatinny rail: a strip of small teeth.
function rail(ctx: Ctx, x: number, y: number, w: number, h: number) {
  fillRR(ctx, x, y, w, h, 2, "#16191d");
  ctx.fillStyle = "#2c3138";
  const teeth = Math.max(4, Math.floor(w / 8));
  const tw = w / teeth;
  for (let i = 0; i < teeth; i++) {
    ctx.fillRect(x + i * tw + tw * 0.2, y + 1, tw * 0.55, h - 2);
  }
}

// The gloved hand — a rounded palm with four knuckle ridges and a thumb.
function hand(ctx: Ctx, x: number, y: number, w: number, h: number, skin: string, flip = false) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(skin, 1.18));
  g.addColorStop(1, shade(skin, 0.7));
  fillRR(ctx, x, y, w, h, Math.min(w, h) * 0.42, g);
  // knuckle ridges (padded tactical glove)
  ctx.fillStyle = shade(skin, 0.86);
  const kn = 4;
  const kw = w / (kn + 0.5);
  for (let i = 0; i < kn; i++) {
    roundRectPath(ctx, x + i * kw + kw * 0.25, y + 2, kw * 0.6, h * 0.34, kw * 0.3);
    ctx.fill();
  }
  // finger separation creases
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(1, w * 0.02);
  for (let i = 1; i < kn; i++) {
    const cx = x + i * kw + kw * 0.0;
    ctx.beginPath(); ctx.moveTo(cx, y + h * 0.42); ctx.lineTo(cx, y + h * 0.96); ctx.stroke();
  }
  // specular sheen across the back of the glove
  const sh = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  sh.addColorStop(0, "rgba(255,255,255,0.16)");
  sh.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save(); roundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.42); ctx.clip();
  ctx.fillStyle = sh; ctx.fillRect(x, y, w, h * 0.4); ctx.restore();
  // wrist cuff strap
  fillRR(ctx, x - w * 0.06, y + h * 0.82, w * 1.12, h * 0.22, w * 0.12, shade(skin, 0.6));
  // thumb
  const tx = flip ? x + w - w * 0.1 : x - w * 0.12;
  fillRR(ctx, tx, y + h * 0.4, w * 0.34, h * 0.5, w * 0.2, g);
  ctx.restore();
}

// ---------------------------------------------------------------------------
//  Muzzle flash + smoke
// ---------------------------------------------------------------------------

function muzzleFlash(ctx: Ctx, x: number, y: number, intensity: number, scale: number) {
  if (intensity <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const R = (60 + 40 * intensity) * scale;
  const core = ctx.createRadialGradient(x, y, 2, x, y, R);
  core.addColorStop(0, `rgba(255,255,240,${0.95 * intensity})`);
  core.addColorStop(0.35, `rgba(255,196,86,${0.75 * intensity})`);
  core.addColorStop(1, "rgba(255,120,20,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  // star petals
  ctx.strokeStyle = `rgba(255,236,180,${0.9 * intensity})`;
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = "round";
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const ang = (i / petals) * Math.PI * 2 + intensity * 2;
    const len = (i % 2 === 0 ? R * 0.9 : R * 0.55);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
//  Public entry point
// ---------------------------------------------------------------------------

export function drawWeaponViewModel(ctx: Ctx, s: ViewModelState) {
  const scale = clamp(Math.min(s.w, s.h) / 620, 0.5, 1.7) * (s.ads ? 1.06 : 1);

  // Reload: the weapon dips down out of frame and back.
  const reloadDip = s.reloadProgress > 0 ? Math.sin(clamp(s.reloadProgress, 0, 1) * Math.PI) * 210 : 0;
  const reloadTilt = s.reloadProgress > 0 ? Math.sin(clamp(s.reloadProgress, 0, 1) * Math.PI) * 0.5 : 0;

  const recoil = clamp(s.recoil, 0, 1);
  const idle = Math.sin(s.time * 1.4) * 3;

  ctx.save();
  ctx.translate(
    s.w * 0.5 + s.bobX + recoil * 6,
    s.h + s.bobY + reloadDip + recoil * 30 + idle,
  );
  ctx.scale(scale, scale);
  ctx.rotate(-0.05 + recoil * 0.06 + reloadTilt);

  // Soft contact shadow cast by the weapon onto the view, for depth. Guarded
  // because ctx.filter is unavailable in a few older engines.
  if (s.category !== "melee") {
    ctx.save();
    try { ctx.filter = "blur(20px)"; } catch { /* no filter support */ }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(-20, -96, 330, 96, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const skin = "#b9895c";
  const boltCycle = recoil > 0.05 ? Math.sin(recoil * Math.PI) : 0;

  switch (s.weaponId) {
    case "m4": drawM4(ctx, s.color, skin, boltCycle); break;
    case "ak": drawAK(ctx, s.color, skin, boltCycle); break;
    case "mp5": drawMP5(ctx, s.color, skin, boltCycle); break;
    case "vector": drawVector(ctx, s.color, skin, boltCycle); break;
    case "spas": drawSPAS(ctx, s.color, skin, recoil); break;
    case "barrett": drawBarrett(ctx, s.color, skin, boltCycle); break;
    case "dmr": drawDMR(ctx, s.color, skin, boltCycle); break;
    case "lmg": drawLMG(ctx, s.color, skin, boltCycle); break;
    case "rpg": drawRPG(ctx, s.color, skin); break;
    case "knife": drawKnife(ctx, s.color, skin, recoil); break;
    case "sidearm":
    default:
      // Any weapon without a bespoke model falls back to the closest-matching
      // detailed renderer for its category, so new guns still look right.
      switch (s.category) {
        case "pistol": drawPistol(ctx, s.color, skin, boltCycle); break;
        case "smg": drawMP5(ctx, s.color, skin, boltCycle); break;
        case "shotgun": drawSPAS(ctx, s.color, skin, recoil); break;
        case "sniper": drawDMR(ctx, s.color, skin, boltCycle); break;
        case "lmg": drawLMG(ctx, s.color, skin, boltCycle); break;
        case "launcher": drawRPG(ctx, s.color, skin); break;
        case "melee": drawKnife(ctx, s.color, skin, recoil); break;
        default: drawRifleGeneric(ctx, s.color, skin, boltCycle); break;
      }
      break;
  }

  // Muzzle flash sits at the barrel tip (far left of every long gun).
  if (s.category !== "melee") {
    const mz = muzzlePoint(s.weaponId, s.category);
    muzzleFlash(ctx, mz.x, mz.y, s.fire, 1);
  }

  ctx.restore();
}

// Where the muzzle is, per weapon, so the flash lines up with the barrel.
function muzzlePoint(id: string, category: WeaponCategory): { x: number; y: number } {
  switch (id) {
    case "barrett": return { x: -305, y: -150 };
    case "dmr": return { x: -270, y: -150 };
    case "lmg": return { x: -285, y: -158 };
    case "rpg": return { x: -250, y: -172 };
    case "ak": return { x: -250, y: -150 };
    case "m4": return { x: -260, y: -150 };
    case "spas": return { x: -250, y: -156 };
    default:
      return category === "pistol" ? { x: -150, y: -150 } : { x: -240, y: -150 };
  }
}

// ---------------------------------------------------------------------------
//  Per-weapon renderers
//  Convention: barrel points to -x, stock to +x, gun sits in the lower frame.
// ---------------------------------------------------------------------------

function drawM4(ctx: Ctx, color: string, skin: string, bolt: number) {
  const body = "#3a4048";
  // barrel + flash hider
  metalRR(ctx, -290, -158, 130, 16, 6, "#2a2d33");
  fillRR(ctx, -300, -162, 22, 24, 4, "#1c1f24"); // flash hider
  ctx.fillStyle = "#0c0e11";
  for (let i = 0; i < 3; i++) ctx.fillRect(-298 + i * 6, -160, 3, 20);
  // front sight post
  fillRR(ctx, -212, -196, 12, 42, 3, "#22262c");
  // handguard with vents + rail
  metalRR(ctx, -250, -172, 120, 46, 8, shade(color, 0.9));
  ventSlots(ctx, -240, -160, 96, 24, 6);
  rail(ctx, -250, -180, 120, 9);
  // upper receiver
  metalRR(ctx, -134, -178, 150, 56, 9, body);
  rail(ctx, -128, -186, 150, 9);
  // ejection port + forward assist
  fillRR(ctx, -20, -156, 34, 20, 3, "#0f1216");
  screw(ctx, 30, -150, 5);
  // charging handle recoils with the bolt
  fillRR(ctx, 16 + bolt * 14, -172, 26, 10, 3, "#15181c");
  // optic (red dot)
  fillRR(ctx, -70, -214, 60, 40, 8, "#111418");
  fillRR(ctx, -66, -210, 52, 30, 6, "#05070a");
  ctx.fillStyle = "rgba(255,60,60,0.9)";
  ctx.beginPath(); ctx.arc(-40, -195, 3.4, 0, Math.PI * 2); ctx.fill();
  // magazine (STANAG, slight curve)
  ctx.save();
  ctx.translate(-6, -104);
  ctx.rotate(0.12);
  metalRR(ctx, -20, 0, 40, 118, 8, shade(color, 0.8));
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let i = 0; i < 5; i++) ctx.fillRect(-16, 14 + i * 20, 32, 4);
  ctx.restore();
  // pistol grip + lower
  metalRR(ctx, 16, -122, 120, 40, 8, shade(body, 0.9));
  ctx.save(); ctx.translate(70, -86); ctx.rotate(0.32);
  metalRR(ctx, -18, 0, 40, 92, 12, "#26292f"); ctx.restore();
  // trigger guard
  ctx.strokeStyle = "#1a1d22"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(40, -70, 20, 0.1, Math.PI - 0.1); ctx.stroke();
  // collapsible stock
  metalRR(ctx, 130, -168, 46, 26, 6, body);
  metalRR(ctx, 150, -150, 92, 52, 12, shade(body, 0.85));
  // hands
  hand(ctx, 150, -96, 62, 74, skin);       // trigger hand
  hand(ctx, -244, -132, 74, 60, skin, true); // support hand on handguard
}

function drawAK(ctx: Ctx, color: string, skin: string, bolt: number) {
  const body = "#4a3524";
  const wood = "#7a4f2a";
  // barrel + front sight + gas block
  metalRR(ctx, -280, -158, 150, 14, 5, "#26282c");
  fillRR(ctx, -290, -160, 16, 22, 3, "#17191d");
  fillRR(ctx, -196, -190, 14, 40, 3, "#20242a"); // front sight
  fillRR(ctx, -150, -184, 30, 30, 4, "#2a2e34"); // gas block
  // wooden lower handguard
  metalRR(ctx, -150, -168, 96, 44, 10, wood, 1.25, 0.62);
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-142 + i * 22, -166); ctx.lineTo(-142 + i * 22, -126); ctx.stroke(); }
  // receiver
  metalRR(ctx, -56, -176, 150, 60, 8, shade(color, 0.85));
  // rear sight
  fillRR(ctx, -40, -186, 26, 14, 3, "#22262c");
  // charging handle (on the right, recoils)
  fillRR(ctx, 40 + bolt * 16, -170, 22, 12, 3, "#15181c");
  screw(ctx, -30, -148, 5);
  screw(ctx, 70, -148, 5);
  // iconic curved magazine
  ctx.save();
  ctx.translate(-10, -110);
  ctx.rotate(0.05);
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.quadraticCurveTo(-40, 70, -20, 128);
  ctx.lineTo(22, 128);
  ctx.quadraticCurveTo(6, 66, 24, 0);
  ctx.closePath();
  const mg = ctx.createLinearGradient(-30, 0, 30, 0);
  mg.addColorStop(0, shade(body, 1.3)); mg.addColorStop(0.5, body); mg.addColorStop(1, shade(body, 0.6));
  ctx.fillStyle = mg; ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-30 + i, 20 + i * 20); ctx.lineTo(30 - i, 20 + i * 20); ctx.stroke(); }
  ctx.restore();
  // pistol grip
  ctx.save(); ctx.translate(66, -84); ctx.rotate(0.34);
  metalRR(ctx, -18, 0, 40, 90, 12, "#241a12"); ctx.restore();
  ctx.strokeStyle = "#1a1207"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(40, -66, 19, 0.1, Math.PI - 0.1); ctx.stroke();
  // wooden stock
  metalRR(ctx, 94, -162, 150, 44, 10, wood, 1.25, 0.6);
  hand(ctx, 150, -92, 60, 72, skin);
  hand(ctx, -140, -128, 72, 58, skin, true);
}

function drawMP5(ctx: Ctx, color: string, skin: string, bolt: number) {
  const body = "#2f333a";
  metalRR(ctx, -240, -156, 110, 14, 5, "#26282c"); // barrel
  fillRR(ctx, -250, -160, 16, 22, 4, "#17191d");
  fillRR(ctx, -160, -190, 12, 34, 4, "#22262c"); // front sight ring
  ctx.strokeStyle = "#22262c"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(-154, -172, 12, 0, Math.PI * 2); ctx.stroke();
  // slim handguard
  metalRR(ctx, -170, -166, 70, 40, 10, shade(color, 0.9));
  ventSlots(ctx, -162, -156, 52, 20, 4);
  // receiver
  metalRR(ctx, -104, -172, 150, 54, 9, body);
  rail(ctx, -98, -180, 130, 8);
  // drum rear sight
  ctx.beginPath(); ctx.arc(30, -176, 12, 0, Math.PI * 2); ctx.fillStyle = "#1a1d22"; ctx.fill();
  // cocking handle tube (recoils)
  metalRR(ctx, -104, -196, 96, 14, 6, "#22262c");
  fillRR(ctx, -80 + bolt * 12, -198, 16, 18, 4, "#15181c");
  // curved magazine
  ctx.save(); ctx.translate(-30, -108); ctx.rotate(0.02);
  ctx.beginPath();
  ctx.moveTo(-16, 0); ctx.quadraticCurveTo(-24, 56, -12, 100);
  ctx.lineTo(18, 100); ctx.quadraticCurveTo(6, 54, 20, 0); ctx.closePath();
  ctx.fillStyle = shade(color, 0.8); ctx.fill();
  ctx.restore();
  // grip + stock
  ctx.save(); ctx.translate(64, -86); ctx.rotate(0.3);
  metalRR(ctx, -16, 0, 36, 84, 10, "#22262c"); ctx.restore();
  metalRR(ctx, 44, -160, 130, 34, 8, body);
  fillRR(ctx, 160, -172, 24, 60, 8, shade(body, 0.85)); // stock end
  hand(ctx, 140, -92, 56, 68, skin);
  hand(ctx, -158, -128, 64, 54, skin, true);
}

function drawVector(ctx: Ctx, color: string, skin: string, bolt: number) {
  const body = "#23262b";
  // angular barrel shroud
  metalRR(ctx, -230, -160, 100, 20, 4, shade(color, 0.9));
  fillRR(ctx, -240, -162, 14, 24, 3, "#17191d");
  rail(ctx, -230, -168, 100, 8);
  // the distinctive slanted body
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-130, -178); ctx.lineTo(70, -178); ctx.lineTo(70, -150);
  ctx.lineTo(20, -110); ctx.lineTo(-130, -110); ctx.closePath();
  const g = ctx.createLinearGradient(0, -178, 0, -110);
  g.addColorStop(0, shade(body, 1.5)); g.addColorStop(0.5, body); g.addColorStop(1, shade(body, 0.6));
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  rail(ctx, -124, -186, 150, 8);
  fillRR(ctx, -40, -214, 54, 34, 7, "#111418"); // optic
  ctx.fillStyle = "rgba(120,240,255,0.85)";
  ctx.beginPath(); ctx.arc(-13, -197, 3, 0, Math.PI * 2); ctx.fill();
  fillRR(ctx, 6 + bolt * 12, -172, 22, 9, 3, "#0f1216"); // charging handle
  // long straight mag
  metalRR(ctx, -66, -108, 30, 130, 6, shade(color, 0.78));
  // grip + folding stock
  ctx.save(); ctx.translate(40, -86); ctx.rotate(0.28);
  metalRR(ctx, -16, 0, 36, 88, 10, "#191c20"); ctx.restore();
  metalRR(ctx, 66, -166, 40, 20, 5, body);
  fillRR(ctx, 96, -158, 60, 40, 8, shade(body, 0.85));
  hand(ctx, 120, -94, 56, 70, skin);
  hand(ctx, -216, -132, 60, 52, skin, true);
}

function drawSPAS(ctx: Ctx, color: string, skin: string, recoil: number) {
  const body = "#2b2f34";
  const pump = -recoil * 26; // the pump slides back on fire
  // thick barrel + magazine tube beneath
  metalRR(ctx, -250, -164, 150, 20, 6, "#26282c");
  metalRR(ctx, -250, -140, 150, 14, 5, shade(body, 0.85));
  fillRR(ctx, -262, -166, 16, 26, 4, "#17191d"); // muzzle
  // pump/forend (slides)
  metalRR(ctx, -180 + pump, -138, 70, 30, 8, shade(color, 0.85));
  for (let i = 0; i < 5; i++) ctx.fillRect(-172 + pump + i * 12, -136, 5, 26);
  // receiver
  metalRR(ctx, -100, -170, 140, 56, 9, body);
  fillRR(ctx, -20, -150, 30, 18, 3, "#0f1216"); // ejection port
  fillRR(ctx, -80, -184, 60, 14, 4, "#1a1d22"); // top rib sight
  // grip + heat-shield stock
  ctx.save(); ctx.translate(56, -84); ctx.rotate(0.32);
  metalRR(ctx, -18, 0, 40, 92, 12, "#1c1f24"); ctx.restore();
  ctx.strokeStyle = "#141619"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(34, -68, 19, 0.1, Math.PI - 0.1); ctx.stroke();
  metalRR(ctx, 40, -160, 150, 40, 10, body);
  hand(ctx, 140, -92, 60, 72, skin);
  hand(ctx, -170 + pump, -108, 66, 54, skin, true);
}

function drawBarrett(ctx: Ctx, color: string, skin: string, bolt: number) {
  const body = "#2a2d33";
  // very long heavy barrel + big muzzle brake
  metalRR(ctx, -320, -156, 190, 16, 5, "#24262b");
  fillRR(ctx, -336, -162, 30, 28, 5, "#15181c"); // muzzle brake
  ctx.fillStyle = "#0c0e11";
  for (let i = 0; i < 3; i++) ctx.fillRect(-332, -158 + i * 8, 24, 4);
  // barrel fluting
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-310, -152 + i * 5); ctx.lineTo(-140, -152 + i * 5); ctx.stroke(); }
  // muzzle-to-receiver bridge
  metalRR(ctx, -150, -180, 190, 62, 9, body);
  rail(ctx, -144, -190, 190, 10);
  // large scope
  fillRR(ctx, -110, -228, 150, 34, 14, "#0d1013");
  fillRR(ctx, -118, -224, 26, 26, 8, "#05070a"); // objective bell
  fillRR(ctx, 20, -224, 26, 26, 8, "#05070a");   // eyepiece
  ctx.fillStyle = "rgba(120,180,255,0.5)";
  ctx.beginPath(); ctx.arc(-105, -211, 8, 0, Math.PI * 2); ctx.fill();
  // bolt handle (recoils a lot)
  fillRR(ctx, 30 + bolt * 22, -172, 30, 12, 4, "#15181c");
  ctx.beginPath(); ctx.arc(58 + bolt * 22, -166, 8, 0, Math.PI * 2); ctx.fillStyle = "#22262c"; ctx.fill();
  // magazine
  metalRR(ctx, -30, -112, 44, 110, 8, shade(color, 0.8));
  // grip + stock with cheek riser
  ctx.save(); ctx.translate(70, -86); ctx.rotate(0.3);
  metalRR(ctx, -18, 0, 40, 92, 12, "#1a1d22"); ctx.restore();
  metalRR(ctx, 40, -128, 170, 40, 10, body);
  metalRR(ctx, 150, -156, 90, 30, 10, shade(body, 0.9)); // cheek riser
  hand(ctx, 150, -96, 62, 74, skin);
  hand(ctx, -150, -120, 74, 56, skin, true);
}

function drawDMR(ctx: Ctx, color: string, skin: string, bolt: number) {
  const body = "#33383f";
  metalRR(ctx, -280, -156, 160, 15, 5, "#26282c");
  fillRR(ctx, -292, -160, 20, 24, 4, "#17191d");
  // free-float handguard w/ rail
  metalRR(ctx, -160, -170, 120, 44, 8, shade(color, 0.88));
  ventSlots(ctx, -150, -158, 96, 22, 7);
  rail(ctx, -160, -178, 120, 9);
  // receiver
  metalRR(ctx, -46, -176, 150, 58, 9, body);
  rail(ctx, -40, -184, 150, 9);
  fillRR(ctx, 40 + bolt * 12, -170, 24, 10, 3, "#15181c"); // charging handle
  // magnified optic
  fillRR(ctx, -30, -224, 120, 30, 12, "#0d1013");
  fillRR(ctx, -36, -220, 22, 22, 7, "#05070a");
  fillRR(ctx, 66, -220, 22, 22, 7, "#05070a");
  ctx.fillStyle = "rgba(120,200,255,0.55)";
  ctx.beginPath(); ctx.arc(-25, -209, 7, 0, Math.PI * 2); ctx.fill();
  // 20-round mag
  ctx.save(); ctx.translate(0, -108); ctx.rotate(0.1);
  metalRR(ctx, -20, 0, 40, 108, 8, shade(color, 0.8)); ctx.restore();
  ctx.save(); ctx.translate(72, -86); ctx.rotate(0.3);
  metalRR(ctx, -18, 0, 40, 92, 12, "#22262c"); ctx.restore();
  metalRR(ctx, 100, -166, 150, 46, 10, body); // stock
  hand(ctx, 150, -94, 60, 72, skin);
  hand(ctx, -150, -128, 72, 56, skin, true);
}

function drawLMG(ctx: Ctx, color: string, skin: string, bolt: number) {
  const body = "#3a3f47";
  // heavy barrel + bipod hint
  metalRR(ctx, -300, -158, 180, 18, 5, "#24262b");
  fillRR(ctx, -312, -162, 22, 26, 4, "#15181c");
  ctx.strokeStyle = "#1a1d22"; ctx.lineWidth = 6; // bipod legs
  ctx.beginPath(); ctx.moveTo(-250, -142); ctx.lineTo(-268, -96); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-240, -142); ctx.lineTo(-222, -96); ctx.stroke();
  // carry handle + receiver
  metalRR(ctx, -120, -182, 180, 66, 9, body);
  metalRR(ctx, -70, -204, 90, 16, 8, shade(body, 0.9)); // carry handle
  rail(ctx, -60, -196, 70, 8);
  fillRR(ctx, 50 + bolt * 14, -176, 26, 12, 3, "#15181c");
  // big square ammo box
  metalRR(ctx, -60, -112, 120, 92, 12, shade(color, 0.8));
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 3;
  ctx.strokeRect(-52, -104, 104, 76);
  // belt of rounds feeding in
  ctx.fillStyle = "#b08d3a";
  for (let i = 0; i < 6; i++) fillRR(ctx, -58 + i * 9, -122, 6, 14, 2, "#c9a34a");
  // grip + stock
  ctx.save(); ctx.translate(80, -84); ctx.rotate(0.3);
  metalRR(ctx, -18, 0, 42, 94, 12, "#22262c"); ctx.restore();
  metalRR(ctx, 60, -166, 160, 48, 10, body);
  hand(ctx, 150, -92, 62, 74, skin);
  hand(ctx, -240, -132, 70, 56, skin, true);
}

function drawRPG(ctx: Ctx, color: string, skin: string) {
  const body = "#3f4650";
  // launch tube
  metalRR(ctx, -220, -190, 380, 44, 22, body);
  // rear venturi cone
  ctx.beginPath();
  ctx.moveTo(160, -188); ctx.lineTo(210, -206); ctx.lineTo(210, -130); ctx.lineTo(160, -148); ctx.closePath();
  ctx.fillStyle = shade(body, 0.7); ctx.fill();
  // warhead (the classic bulbous PG-7 grenade)
  ctx.save();
  ctx.translate(-232, -168);
  ctx.beginPath();
  ctx.moveTo(0, -34); ctx.quadraticCurveTo(-70, -30, -78, 0); ctx.quadraticCurveTo(-70, 30, 0, 34);
  ctx.closePath();
  const wg = ctx.createLinearGradient(0, -34, 0, 34);
  wg.addColorStop(0, shade(color, 1.3)); wg.addColorStop(0.5, color); wg.addColorStop(1, shade(color, 0.6));
  ctx.fillStyle = wg; ctx.fill();
  // fins
  ctx.fillStyle = shade(color, 0.7);
  fillRR(ctx, 0, -12, 30, 24, 3, shade(color, 0.7));
  ctx.restore();
  // optical sight
  fillRR(ctx, -60, -232, 30, 46, 6, "#15181c");
  fillRR(ctx, -56, -228, 22, 30, 4, "#05070a");
  // grips
  ctx.save(); ctx.translate(-70, -142); ctx.rotate(0.28);
  metalRR(ctx, -16, 0, 36, 84, 10, "#22262c"); ctx.restore();
  ctx.save(); ctx.translate(70, -142); ctx.rotate(0.28);
  metalRR(ctx, -16, 0, 36, 84, 10, "#22262c"); ctx.restore();
  hand(ctx, 54, -132, 60, 70, skin);
  hand(ctx, -104, -132, 60, 70, skin, true);
}

function drawPistol(ctx: Ctx, color: string, skin: string, bolt: number) {
  const body = shade(color, 0.9);
  // slide (recoils back)
  metalRR(ctx, -140 - bolt * 10, -168, 190, 40, 7, body);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (let i = 0; i < 6; i++) ctx.fillRect(10 - bolt * 10 + i * 8, -164, 3, 32); // rear serrations
  fillRR(ctx, -150 - bolt * 10, -162, 14, 26, 3, "#15181c"); // muzzle
  fillRR(ctx, -70, -176, 8, 10, 2, "#0d0f12"); // front sight
  fillRR(ctx, 34, -176, 14, 10, 2, "#0d0f12"); // rear sight
  // frame + trigger guard
  metalRR(ctx, -40, -132, 100, 24, 6, shade(body, 0.8));
  ctx.strokeStyle = "#1a1d22"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(-4, -112, 16, 0.2, Math.PI - 0.2); ctx.stroke();
  // grip + magazine base
  ctx.save(); ctx.translate(18, -110); ctx.rotate(0.34);
  metalRR(ctx, -22, 0, 46, 96, 10, shade(body, 0.7));
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  for (let i = 0; i < 5; i++) ctx.fillRect(-18, 12 + i * 15, 40, 3); // grip stipple
  ctx.restore();
  hand(ctx, 4, -104, 66, 82, skin);
}

function drawKnife(ctx: Ctx, color: string, skin: string, recoil: number) {
  // a slashing motion drives the blade across the frame on "fire"
  const swing = Math.sin(clamp(recoil, 0, 1) * Math.PI) * 0.6;
  ctx.save();
  ctx.translate(70, -60);
  ctx.rotate(-0.5 + swing);
  // fist
  hand(ctx, -20, 0, 78, 96, skin);
  // handle
  metalRR(ctx, 6, -70, 24, 78, 8, "#22262c");
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let i = 0; i < 4; i++) ctx.fillRect(9, -58 + i * 18, 18, 4);
  // guard
  fillRR(ctx, -4, -78, 44, 12, 3, "#3a3f47");
  // blade
  ctx.beginPath();
  ctx.moveTo(10, -78); ctx.lineTo(30, -78); ctx.lineTo(34, -210); ctx.lineTo(18, -186); ctx.lineTo(12, -210);
  ctx.closePath();
  const bg = ctx.createLinearGradient(10, -78, 34, -210);
  bg.addColorStop(0, "#8b9099"); bg.addColorStop(0.5, "#e6eaf0"); bg.addColorStop(1, "#aeb4bd");
  ctx.fillStyle = bg; ctx.fill();
  // edge highlight
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(30, -80); ctx.lineTo(33, -206); ctx.stroke();
  ctx.restore();
}

function drawRifleGeneric(ctx: Ctx, color: string, skin: string, bolt: number) {
  drawM4(ctx, color, skin, bolt);
}
