/* ================================================================== *
 * Aperture — geometry, drawing & data library
 * ------------------------------------------------------------------
 * Pure, framework-free helpers shared by the canvas, the minimap and
 * the side panels. Keeping the drawing here means the layers panel and
 * minimap render exactly what the board renders.
 * ================================================================== */

import type { Shape, Tool, Box, Point, TemplateDef, Camera } from "./types";

export const GRID = 40;
export const STORE = "aperture:board:v2";
export const PREFS = "aperture:prefs:v1";

export const PALETTE = ["#111827", "#ffffff", "#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#78716c"];
export const NOTE_COLORS = ["#fde68a", "#fca5a5", "#a7f3d0", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#fed7aa", "#e2e8f0"];

export const STROKE_TOOLS: Tool[] = ["pen", "marker", "highlighter", "neon", "spray"];
export const SHAPE_TOOLS: Tool[] = ["line", "arrow", "connector", "rect", "ellipse", "diamond", "triangle", "star", "polygon", "hexagon", "parallelogram", "cloud", "cylinder"];
export const CLOSED_SHAPES: Tool[] = ["rect", "ellipse", "diamond", "triangle", "star", "polygon", "hexagon", "parallelogram", "cloud", "cylinder", "frame"];

export const STAMPS = ["✅", "❌", "⭐", "🔥", "💡", "❤️", "👍", "👎", "⚠️", "🎯", "🚀", "📌", "❓", "💬", "🏆", "🐞", "🎉", "🔔", "📎", "✔️"];

export const NAMES = ["Falcon", "Nova", "Echo", "Vega", "Onyx", "Iris", "Zephyr", "Lumen", "Koi", "Sable", "Wren", "Atlas", "Pixel", "Cobalt", "Juno"];
export const CURSOR_COLORS = ["#f59e0b", "#22c55e", "#ec4899", "#3b82f6", "#a855f7", "#06b6d4", "#ef4444", "#84cc16"];

export const SHORTCUTS: Record<string, Tool> = {
  v: "select", h: "pan", i: "eyedropper", b: "pen", m: "marker", g: "highlighter",
  n: "neon", k: "spray", e: "eraser", x: "laser", l: "line", a: "arrow", c: "connector",
  r: "rect", o: "ellipse", d: "diamond", y: "triangle", s: "star", p: "polygon", t: "text",
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */
export function bbox(s: Shape): Box {
  if (s.pts && s.pts.length) {
    const xs = s.pts.map((p) => p.x), ys = s.pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }
  if (s.kind === "note" || s.kind === "image") return { x: s.x!, y: s.y!, w: s.w!, h: s.h! };
  if (s.kind === "comment") { const lines = Math.max(1, Math.ceil((s.text?.length || 1) / 26)); return { x: s.x! - 11, y: s.y! - 11, w: 211, h: 27 + Math.max(40, 20 + lines * 16) }; }
  if (s.kind === "text") return { x: s.x!, y: s.y! - 22, w: Math.max(60, (s.text?.length || 4) * ((s.fontSize ?? 4) + 9)), h: 30 };
  const x = Math.min(s.x0!, s.x1!), y = Math.min(s.y0!, s.y1!);
  return { x, y, w: Math.abs(s.x1! - s.x0!), h: Math.abs(s.y1! - s.y0!) };
}

export function shapeCenter(s: Shape): Point {
  const b = bbox(s);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export function rotatePoint(p: Point, c: Point, ang: number): Point {
  if (!ang) return p;
  const cos = Math.cos(ang), sin = Math.sin(ang), dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

export function translate(s: Shape, dx: number, dy: number) {
  if (s.pts) s.pts = s.pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  if (s.x0 != null) { s.x0 += dx; s.x1! += dx; s.y0! += dy; s.y1! += dy; }
  if (s.x != null) { s.x += dx; s.y! += dy; }
}

/* Resize a shape so its bounding box matches the given box. */
export function setShapeBox(s: Shape, box: Box) {
  const cur = bbox(s);
  const sx = cur.w ? box.w / cur.w : 1;
  const sy = cur.h ? box.h / cur.h : 1;
  const map = (p: Point): Point => ({ x: box.x + (p.x - cur.x) * sx, y: box.y + (p.y - cur.y) * sy });
  if (s.pts) s.pts = s.pts.map(map);
  if (s.x0 != null) { const a = map({ x: s.x0, y: s.y0! }), b = map({ x: s.x1!, y: s.y1! }); s.x0 = a.x; s.y0 = a.y; s.x1 = b.x; s.y1 = b.y; }
  if (s.x != null) { s.x = box.x; s.y = box.y; s.w = box.w; s.h = box.h; }
}

export function hitTest(shapes: Shape[], px: number, py: number): Shape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.hidden || s.locked) continue;
    const b = bbox(s);
    let qx = px, qy = py;
    if (s.rotation) { const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; const r = rotatePoint({ x: px, y: py }, c, -s.rotation); qx = r.x; qy = r.y; }
    if (qx >= b.x - 8 && qx <= b.x + b.w + 8 && qy >= b.y - 8 && qy <= b.y + b.h + 8) return s;
  }
  return null;
}

export function marqueeHit(shapes: Shape[], box: Box): Shape[] {
  const x0 = Math.min(box.x, box.x + box.w), y0 = Math.min(box.y, box.y + box.h);
  const x1 = Math.max(box.x, box.x + box.w), y1 = Math.max(box.y, box.y + box.h);
  return shapes.filter((s) => {
    if (s.hidden || s.locked) return false;
    const b = bbox(s);
    return b.x >= x0 && b.y >= y0 && b.x + b.w <= x1 && b.y + b.h <= y1;
  });
}

export function unionBox(shapes: Shape[]): Box | null {
  if (!shapes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) { const b = bbox(s); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* ------------------------------------------------------------------ *
 * Alignment & distribution — return {id: {dx,dy}} translation maps
 * ------------------------------------------------------------------ */
export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

export function alignShapes(shapes: Shape[], mode: AlignMode): Record<string, Point> {
  const u = unionBox(shapes); if (!u) return {};
  const out: Record<string, Point> = {};
  for (const s of shapes) {
    const b = bbox(s); let dx = 0, dy = 0;
    if (mode === "left") dx = u.x - b.x;
    else if (mode === "right") dx = u.x + u.w - (b.x + b.w);
    else if (mode === "hcenter") dx = u.x + u.w / 2 - (b.x + b.w / 2);
    else if (mode === "top") dy = u.y - b.y;
    else if (mode === "bottom") dy = u.y + u.h - (b.y + b.h);
    else if (mode === "vcenter") dy = u.y + u.h / 2 - (b.y + b.h / 2);
    out[s.id] = { x: dx, y: dy };
  }
  return out;
}

export function distributeShapes(shapes: Shape[], axis: "h" | "v"): Record<string, Point> {
  if (shapes.length < 3) return {};
  const items = shapes.map((s) => ({ s, b: bbox(s) }));
  items.sort((a, b) => (axis === "h" ? a.b.x - b.b.x : a.b.y - b.b.y));
  const first = items[0].b, last = items[items.length - 1].b;
  const span = axis === "h" ? (last.x + last.w / 2) - (first.x + first.w / 2) : (last.y + last.h / 2) - (first.y + first.h / 2);
  const step = span / (items.length - 1);
  const out: Record<string, Point> = {};
  items.forEach((it, i) => {
    if (i === 0 || i === items.length - 1) { out[it.s.id] = { x: 0, y: 0 }; return; }
    if (axis === "h") { const target = (first.x + first.w / 2) + step * i; out[it.s.id] = { x: target - (it.b.x + it.b.w / 2), y: 0 }; }
    else { const target = (first.y + first.h / 2) + step * i; out[it.s.id] = { x: 0, y: target - (it.b.y + it.b.h / 2) }; }
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * Drawing
 * ------------------------------------------------------------------ */
type ImgGetter = (src: string) => HTMLImageElement;

function polygonPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, sides: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, points = 5) {
  const oR = Math.max(rx, ry), iR = oR * 0.44; let rot = -Math.PI / 2;
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(rot) * oR, cy + Math.sin(rot) * oR);
  for (let i = 0; i < points; i++) { rot += Math.PI / points; ctx.lineTo(cx + Math.cos(rot) * iR, cy + Math.sin(rot) * iR); rot += Math.PI / points; ctx.lineTo(cx + Math.cos(rot) * oR, cy + Math.sin(rot) * oR); }
  ctx.closePath();
}

function cloudPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(w, h) / 4;
  ctx.beginPath();
  ctx.moveTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI * 1.5);
  ctx.arc(x + w * 0.32, y + r, r * 1.1, Math.PI, Math.PI * 1.85);
  ctx.arc(x + w * 0.66, y + r * 0.9, r * 1.2, Math.PI * 1.25, Math.PI * 2);
  ctx.arc(x + w - r, y + h - r, r, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
}

function cylinderPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const ry = Math.min(h * 0.16, w * 0.4);
  ctx.beginPath();
  ctx.moveTo(x, y + ry);
  ctx.bezierCurveTo(x, y - ry * 0.6, x + w, y - ry * 0.6, x + w, y + ry);
  ctx.lineTo(x + w, y + h - ry);
  ctx.bezierCurveTo(x + w, y + h + ry * 0.6, x, y + h + ry * 0.6, x, y + h - ry);
  ctx.closePath();
}

/* Smoothed freehand path — quadratic curves through midpoints. */
function strokePath(ctx: CanvasRenderingContext2D, pts: Point[]) {
  if (pts.length < 3) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke(); return; }
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my); }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let yy = y;
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/); let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
    ctx.fillText(line, x, yy); yy += lh;
  }
}

export function drawShape(ctx: CanvasRenderingContext2D, s: Shape, getImg: ImgGetter) {
  if (s.hidden) return;
  ctx.save();
  // rotation about the bounding-box centre
  if (s.rotation) { const c = shapeCenter(s); ctx.translate(c.x, c.y); ctx.rotate(s.rotation); ctx.translate(-c.x, -c.y); }
  ctx.globalAlpha = s.alpha ?? 1;
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (s.dash === "dashed") ctx.setLineDash([s.width * 3, s.width * 2.5]);
  else if (s.dash === "dotted") ctx.setLineDash([1, s.width * 2]);

  const fillShape = () => {
    if (!s.fill) return;
    ctx.save();
    ctx.globalAlpha = (s.alpha ?? 1) * (s.fillAlpha ?? 0.32);
    ctx.fillStyle = s.fillColor || s.color;
    ctx.fill();
    ctx.restore();
  };

  if (s.kind === "image" && s.src) { const im = getImg(s.src); try { ctx.drawImage(im, s.x!, s.y!, s.w!, s.h!); } catch {} ctx.restore(); return; }

  if (s.kind === "stroke" && s.pts && s.pts.length) {
    if (s.tool === "spray") { for (const p of s.pts) ctx.fillRect(p.x, p.y, 1.5, 1.5); }
    else {
      if (s.tool === "neon") { ctx.shadowColor = s.color; ctx.shadowBlur = s.width * 3; }
      if (s.tool === "highlighter") ctx.lineCap = "butt";
      strokePath(ctx, s.pts);
      if (s.tool === "neon") { ctx.shadowBlur = 0; ctx.strokeStyle = "#ffffff"; ctx.globalAlpha = (s.alpha ?? 1) * 0.7; ctx.lineWidth = Math.max(1, s.width * 0.35); strokePath(ctx, s.pts); }
    }
  } else if (s.kind === "shape") {
    const x0 = s.x0!, y0 = s.y0!, x1 = s.x1!, y1 = s.y1!;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    const bx = Math.min(x0, x1), by = Math.min(y0, y1), bw = Math.abs(x1 - x0), bh = Math.abs(y1 - y0);
    if (s.shadow && s.tool !== "line" && s.tool !== "arrow" && s.tool !== "connector" && s.tool !== "frame") { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; }
    if (s.tool === "line" || s.tool === "arrow") {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (s.tool === "arrow") { const a = Math.atan2(y1 - y0, x1 - x0), hd = 10 + s.width * 2.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(a - 0.4), y1 - hd * Math.sin(a - 0.4)); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(a + 0.4), y1 - hd * Math.sin(a + 0.4)); ctx.stroke(); }
    } else if (s.tool === "connector") {
      const midX = (x0 + x1) / 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(midX, y0); ctx.lineTo(midX, y1); ctx.lineTo(x1, y1); ctx.stroke();
      const a = x1 >= midX ? 0 : Math.PI, hd = 9 + s.width * 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(a - 0.4), y1 - hd * Math.sin(a - 0.4)); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(a + 0.4), y1 - hd * Math.sin(a + 0.4)); ctx.stroke();
    } else {
      if (s.tool === "rect") { const r = clamp(s.radius ?? 0, 0, Math.min(bw, bh) / 2); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, r); }
      else if (s.tool === "ellipse") { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); }
      else if (s.tool === "diamond") { ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(bx + bw, cy); ctx.lineTo(cx, by + bh); ctx.lineTo(bx, cy); ctx.closePath(); }
      else if (s.tool === "triangle") { ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath(); }
      else if (s.tool === "parallelogram") { const off = bw * 0.22; ctx.beginPath(); ctx.moveTo(bx + off, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw - off, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath(); }
      else if (s.tool === "star") starPath(ctx, cx, cy, rx, ry, 5);
      else if (s.tool === "polygon") polygonPath(ctx, cx, cy, rx, ry, s.sides ?? 6);
      else if (s.tool === "hexagon") polygonPath(ctx, cx, cy, rx, ry, 6, 0);
      else if (s.tool === "cloud") cloudPath(ctx, bx, by, bw, bh);
      else if (s.tool === "cylinder") cylinderPath(ctx, bx, by, bw, bh);
      else if (s.tool === "frame") {
        ctx.save(); ctx.setLineDash([]);
        ctx.fillStyle = s.color; ctx.font = "600 13px ui-sans-serif, system-ui"; ctx.textBaseline = "bottom"; ctx.fillText(s.text || "Frame", bx + 2, by - 5);
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6);
        if (s.fill) { ctx.save(); ctx.globalAlpha = (s.alpha ?? 1) * (s.fillAlpha ?? 0.06); ctx.fillStyle = s.fillColor || s.color; ctx.fill(); ctx.restore(); }
        ctx.stroke(); ctx.restore();
        ctx.restore(); return;
      }
      fillShape();
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      // centered label
      if (s.text) {
        ctx.save(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.font = `${s.bold ? "700 " : "600 "}${13 + (s.fontSize ?? 2) * 2}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const lines = s.text.split("\n"); const lh = 15 + (s.fontSize ?? 2) * 2; const startY = cy - ((lines.length - 1) * lh) / 2;
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.fillStyle = "#ffffff";
        lines.forEach((ln, i) => { ctx.strokeText(ln, cx, startY + i * lh); ctx.fillText(ln, cx, startY + i * lh); });
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.restore();
      }
    }
  } else if (s.kind === "note") {
    ctx.save(); ctx.setLineDash([]); ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.roundRect(s.x!, s.y!, s.w!, s.h!, s.radius ?? 8); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#1a1a1a"; ctx.font = `${s.bold ? "700 " : ""}${s.italic ? "italic " : ""}${14 + (s.fontSize ?? 4)}px ui-sans-serif, system-ui`; ctx.textBaseline = "top"; ctx.globalAlpha = 1;
    wrapText(ctx, s.text || "", s.x! + 12, s.y! + 12, s.w! - 24, 18 + (s.fontSize ?? 4));
  } else if (s.kind === "comment") {
    ctx.save(); ctx.setLineDash([]); ctx.globalAlpha = s.alpha ?? 1;
    const px = s.x!, py = s.y!, bw = 200;
    const lines = Math.max(1, Math.ceil((s.text?.length || 1) / 26)); const bh = Math.max(40, 20 + lines * 16);
    ctx.fillStyle = "rgba(24,28,38,0.96)"; ctx.strokeStyle = s.by || s.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(px, py + 16, bw, bh, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#e5e7eb"; ctx.font = "12px ui-sans-serif, system-ui"; ctx.textBaseline = "top";
    wrapText(ctx, s.text || "…", px + 10, py + 24, bw - 20, 16);
    ctx.fillStyle = s.by || s.color; ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "11px ui-sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("💬", px, py + 0.5); ctx.textAlign = "left";
    ctx.restore(); ctx.restore(); return;
  } else if (s.kind === "text") {
    ctx.fillStyle = s.color; ctx.font = `${s.italic ? "italic " : ""}${s.bold ? "800" : "600"} ${14 + (s.fontSize ?? 4) * 3}px ui-sans-serif, system-ui`; ctx.textBaseline = "alphabetic";
    ctx.textAlign = s.align ?? "left";
    (s.text || "").split("\n").forEach((ln, i) => ctx.fillText(ln, s.x!, s.y! + i * (18 + (s.fontSize ?? 4) * 3)));
    ctx.textAlign = "left";
  }
  ctx.restore();
}

/* Render a whole board into an offscreen 2d context (used by minimap). */
export function renderThumb(ctx: CanvasRenderingContext2D, shapes: Shape[], getImg: ImgGetter, box: Box, out: { w: number; h: number }, bgColor: string) {
  ctx.save();
  ctx.fillStyle = bgColor; ctx.fillRect(0, 0, out.w, out.h);
  if (box.w > 0 && box.h > 0) {
    const scale = Math.min(out.w / box.w, out.h / box.h) * 0.9;
    ctx.translate((out.w - box.w * scale) / 2, (out.h - box.h * scale) / 2);
    ctx.scale(scale, scale);
    ctx.translate(-box.x, -box.y);
    for (const s of shapes) drawShape(ctx, s, getImg);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Templates — starter diagrams inserted around a centre point
 * ------------------------------------------------------------------ */
const mk = (partial: Partial<Shape>): Shape => ({ id: uid(), kind: "shape", tool: "rect", color: "#3b82f6", width: 3, ...partial } as Shape);
const box = (x: number, y: number, w: number, h: number, color: string, tool: Tool = "rect", fillColor?: string): Shape =>
  mk({ kind: "shape", tool, color, width: 3, x0: x, y0: y, x1: x + w, y1: y + h, fill: !!fillColor, fillColor, fillAlpha: 0.18, radius: 12 });
const label = (x: number, y: number, text: string, color = "#e5e7eb", fontSize = 3): Shape =>
  mk({ kind: "text", tool: "text", color, width: 2, x, y, text, fontSize, bold: true });
const link = (x0: number, y0: number, x1: number, y1: number, color = "#94a3b8"): Shape =>
  mk({ kind: "shape", tool: "arrow", color, width: 2.5, x0, y0, x1, y1 });
const note = (x: number, y: number, text: string, color = "#fde68a"): Shape =>
  mk({ kind: "note", tool: "note", color, width: 1, x, y, w: 190, h: 130, text, fontSize: 3 });

export const TEMPLATES: TemplateDef[] = [
  {
    id: "flowchart", name: "Flowchart", faName: "فلوچارت", icon: "▭",
    build: (cx, cy) => {
      const x = cx - 90;
      return [
        box(x, cy - 240, 180, 70, "#22c55e", "ellipse", "#22c55e"), label(x + 52, cy - 200, "Start", "#dcfce7"),
        link(cx, cy - 170, cx, cy - 120),
        box(x, cy - 120, 180, 80, "#3b82f6", "rect", "#3b82f6"), label(x + 40, cy - 74, "Process", "#dbeafe"),
        link(cx, cy - 40, cx, cy + 10),
        box(x, cy + 10, 180, 100, "#f59e0b", "diamond", "#f59e0b"), label(x + 46, cy + 66, "Decision?", "#0b0c0e"),
        link(cx, cy + 110, cx, cy + 160),
        box(x, cy + 160, 180, 70, "#ef4444", "ellipse", "#ef4444"), label(x + 56, cy + 200, "End", "#fee2e2"),
      ];
    },
  },
  {
    id: "kanban", name: "Kanban", faName: "کانبان", icon: "▤",
    build: (cx, cy) => {
      const cols = [["To do", "#64748b"], ["In progress", "#3b82f6"], ["Done", "#22c55e"]];
      const out: Shape[] = [];
      cols.forEach(([title, color], i) => {
        const x = cx - 330 + i * 230;
        out.push(box(x, cy - 200, 200, 380, color, "rect"));
        out.push(label(x + 16, cy - 172, title, color, 3));
        for (let j = 0; j < 2; j++) out.push(note(x + 12, cy - 140 + j * 150, i === 0 ? "New task" : i === 1 ? "Working…" : "Shipped ✓", NOTE_COLORS[(i + j) % NOTE_COLORS.length]));
      });
      return out;
    },
  },
  {
    id: "mindmap", name: "Mind map", faName: "نقشه ذهنی", icon: "❋",
    build: (cx, cy) => {
      const out: Shape[] = [box(cx - 80, cy - 35, 160, 70, "#a855f7", "ellipse", "#a855f7"), label(cx - 30, cy + 5, "Idea", "#f3e8ff")];
      const spokes = [[-260, -140], [260, -140], [-280, 60], [280, 60], [0, 200]];
      spokes.forEach(([dx, dy], i) => {
        const nx = cx + dx, ny = cy + dy;
        out.push(link(cx + (dx > 0 ? 70 : dx < 0 ? -70 : 0), cy + (dy > 0 ? 20 : 0), nx, ny, "#c084fc"));
        out.push(box(nx - 70, ny - 28, 140, 56, "#6366f1", "rect", "#6366f1"));
        out.push(label(nx - 46, ny + 6, "Branch " + (i + 1), "#e0e7ff", 2));
      });
      return out;
    },
  },
  {
    id: "swot", name: "SWOT", faName: "تحلیل SWOT", icon: "田",
    build: (cx, cy) => {
      const cells: [number, number, string, string][] = [[-210, -160, "Strengths", "#22c55e"], [10, -160, "Weaknesses", "#ef4444"], [-210, 20, "Opportunities", "#3b82f6"], [10, 20, "Threats", "#f59e0b"]];
      const out: Shape[] = [];
      for (const [dx, dy, title, color] of cells) { out.push(box(cx + dx, cy + dy, 200, 160, color, "rect", color)); out.push(label(cx + dx + 16, cy + dy + 30, title, color, 3)); }
      return out;
    },
  },
  {
    id: "timeline", name: "Timeline", faName: "خط زمانی", icon: "↔",
    build: (cx, cy) => {
      const out: Shape[] = [mk({ kind: "shape", tool: "line", color: "#94a3b8", width: 3, x0: cx - 360, y0: cy, x1: cx + 360, y1: cy })];
      for (let i = 0; i < 4; i++) { const x = cx - 300 + i * 200; out.push(box(x - 20, cy - 20, 40, 40, "#06b6d4", "ellipse", "#06b6d4")); out.push(label(x - 24, cy + (i % 2 ? 60 : -40), "Phase " + (i + 1), "#cffafe", 2)); }
      return out;
    },
  },
  {
    id: "grid2", name: "2×2 Matrix", faName: "ماتریس ۲×۲", icon: "▦",
    build: (cx, cy) => [
      mk({ kind: "shape", tool: "line", color: "#94a3b8", width: 2, x0: cx, y0: cy - 200, x1: cx, y1: cy + 200 }),
      mk({ kind: "shape", tool: "line", color: "#94a3b8", width: 2, x0: cx - 200, y0: cy, x1: cx + 200, y1: cy }),
      label(cx - 190, cy - 170, "Quadrant I", "#e5e7eb", 2), label(cx + 60, cy - 170, "Quadrant II", "#e5e7eb", 2),
      label(cx - 190, cy + 190, "Quadrant III", "#e5e7eb", 2), label(cx + 60, cy + 190, "Quadrant IV", "#e5e7eb", 2),
    ],
  },
  {
    id: "orgchart", name: "Org chart", faName: "چارت سازمانی", icon: "⤵",
    build: (cx, cy) => {
      const out: Shape[] = [box(cx - 80, cy - 200, 160, 60, "#6366f1", "rect", "#6366f1"), label(cx - 40, cy - 165, "CEO", "#e0e7ff", 2)];
      const kids = [-220, 0, 220];
      kids.forEach((dx, i) => {
        const nx = cx + dx;
        out.push(link(cx, cy - 140, nx, cy - 60, "#94a3b8"));
        out.push(box(nx - 75, cy - 60, 150, 56, "#3b82f6", "rect", "#3b82f6"));
        out.push(label(nx - 50, cy - 26, "Lead " + (i + 1), "#dbeafe", 2));
        for (let j = 0; j < 2; j++) { const ky = cy + 60 + j * 80; out.push(link(nx, cy - 4, nx, ky, "#94a3b8")); out.push(box(nx - 70, ky, 140, 50, "#64748b", "rect")); out.push(label(nx - 44, ky + 30, "Member", "#e5e7eb", 1)); }
      });
      return out;
    },
  },
  {
    id: "journey", name: "User journey", faName: "سفر کاربر", icon: "↝",
    build: (cx, cy) => {
      const stages = ["Aware", "Consider", "Decide", "Onboard", "Advocate"];
      const out: Shape[] = [mk({ kind: "shape", tool: "line", color: "#94a3b8", width: 3, x0: cx - 420, y0: cy, x1: cx + 420, y1: cy })];
      stages.forEach((st, i) => { const x = cx - 380 + i * 190; out.push(box(x, cy - 90, 150, 60, "#06b6d4", "rect", "#06b6d4")); out.push(label(x + 20, cy - 55, st, "#cffafe", 2)); out.push(box(x + 55, cy - 12, 40, 40, "#06b6d4", "ellipse", "#06b6d4")); out.push(note(x, cy + 40, "Feeling / pain point", NOTE_COLORS[i % NOTE_COLORS.length])); });
      return out;
    },
  },
  {
    id: "retro", name: "Retro board", faName: "تخته رتروسپکتیو", icon: "☰",
    build: (cx, cy) => {
      const cols: [string, string][] = [["Went well 🎉", "#22c55e"], ["To improve 🛠", "#f59e0b"], ["Action items ✅", "#3b82f6"]];
      const out: Shape[] = [];
      cols.forEach(([title, color], i) => { const x = cx - 340 + i * 235; out.push(box(x, cy - 210, 210, 400, color, "rect")); out.push(label(x + 16, cy - 180, title, color, 3)); for (let j = 0; j < 2; j++) out.push(note(x + 12, cy - 140 + j * 150, "…", NOTE_COLORS[(i * 2 + j) % NOTE_COLORS.length])); });
      return out;
    },
  },
  {
    id: "sequence", name: "Sequence", faName: "توالی", icon: "⇅",
    build: (cx, cy) => {
      const actors = ["User", "App", "API", "DB"];
      const out: Shape[] = [];
      actors.forEach((a, i) => { const x = cx - 300 + i * 200; out.push(box(x - 55, cy - 220, 110, 46, "#6366f1", "rect", "#6366f1")); out.push(label(x - 30, cy - 190, a, "#e0e7ff", 2)); out.push(mk({ kind: "shape", tool: "line", color: "#94a3b8", width: 1.5, dash: "dashed", x0: x, y0: cy - 174, x1: x, y1: cy + 220 })); });
      for (let i = 0; i < 3; i++) { const y = cy - 120 + i * 90; const x0 = cx - 300 + i * 200, x1 = x0 + 200; out.push(link(x0, y, x1, y, "#22d3ee")); out.push(label((x0 + x1) / 2 - 30, y - 10, "message", "#a5f3fc", 1)); }
      return out;
    },
  },
  {
    id: "wireframe", name: "Wireframe", faName: "وایرفریم", icon: "▚",
    build: (cx, cy) => [
      box(cx - 220, cy - 200, 440, 400, "#94a3b8", "rect"),
      box(cx - 200, cy - 180, 400, 44, "#64748b", "rect", "#64748b"), label(cx - 188, cy - 158, "Navbar", "#e5e7eb", 2),
      box(cx - 200, cy - 120, 400, 120, "#3b82f6", "rect", "#3b82f6"), label(cx - 40, cy - 66, "Hero", "#dbeafe", 3),
      box(cx - 200, cy + 12, 190, 100, "#64748b", "rect"), box(cx + 10, cy + 12, 190, 100, "#64748b", "rect"),
      box(cx - 200, cy + 126, 400, 56, "#475569", "rect", "#475569"), label(cx - 176, cy + 158, "Footer", "#e5e7eb", 2),
    ],
  },
  {
    id: "fishbone", name: "Fishbone", faName: "استخوان ماهی", icon: "⋔",
    build: (cx, cy) => {
      const out: Shape[] = [mk({ kind: "shape", tool: "arrow", color: "#94a3b8", width: 3, x0: cx - 380, y0: cy, x1: cx + 360, y1: cy })];
      out.push(box(cx + 320, cy - 34, 150, 68, "#ef4444", "rect", "#ef4444"), label(cx + 350, cy + 4, "Effect", "#fee2e2", 2));
      const causes = ["People", "Process", "Machine", "Material"];
      causes.forEach((c, i) => { const top = i % 2 === 0; const x = cx - 300 + Math.floor(i / 2) * 260; const y = top ? cy - 150 : cy + 150; out.push(link(x, y, x + 90, cy, "#64748b")); out.push(box(x - 60, top ? y - 50 : y + 6, 140, 44, "#3b82f6", "rect", "#3b82f6")); out.push(label(x - 40, top ? y - 22 : y + 34, c, "#dbeafe", 2)); });
      return out;
    },
  },
  {
    id: "roadmap", name: "Roadmap", faName: "نقشه‌راه", icon: "▬",
    build: (cx, cy) => {
      const out: Shape[] = [];
      const rows = ["Now", "Next", "Later"]; const colors = ["#22c55e", "#f59e0b", "#64748b"];
      rows.forEach((r, i) => { const y = cy - 130 + i * 100; out.push(label(cx - 420, y + 30, r, "#e5e7eb", 2)); for (let j = 0; j < 3 - i + 1; j++) { const x = cx - 320 + j * 200; out.push(box(x, y, 180, 60, colors[i], "rect", colors[i])); out.push(label(x + 16, y + 36, "Feature", "#0b0c0e", 1)); } });
      return out;
    },
  },
  {
    id: "calendar", name: "Week", faName: "هفته", icon: "▤",
    build: (cx, cy) => {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const out: Shape[] = []; const cw = 120;
      days.forEach((d, i) => { const x = cx - 420 + i * cw; out.push(box(x, cy - 220, cw - 6, 40, "#6366f1", "rect", "#6366f1")); out.push(label(x + 12, cy - 192, d, "#e0e7ff", 2)); for (let r = 0; r < 4; r++) out.push(box(x, cy - 172 + r * 96, cw - 6, 90, "#334155", "rect")); });
      return out;
    },
  },
  {
    id: "funnel", name: "Funnel", faName: "قیف", icon: "▽",
    build: (cx, cy) => {
      const stages: [string, string][] = [["Visitors", "#3b82f6"], ["Leads", "#06b6d4"], ["Trials", "#f59e0b"], ["Customers", "#22c55e"]];
      const out: Shape[] = [];
      stages.forEach(([name, color], i) => { const w = 360 - i * 70; const y = cy - 180 + i * 90; out.push(box(cx - w / 2, y, w, 70, color, "rect", color)); out.push(label(cx - 40, y + 42, name, "#0b0c0e", 2)); });
      return out;
    },
  },
  {
    id: "venn", name: "Venn", faName: "ون", icon: "◍",
    build: (cx, cy) => [
      { id: uid(), kind: "shape", tool: "ellipse", color: "#3b82f6", width: 3, x0: cx - 200, y0: cy - 120, x1: cx + 40, y1: cy + 120, fill: true, fillColor: "#3b82f6", fillAlpha: 0.25 } as Shape,
      { id: uid(), kind: "shape", tool: "ellipse", color: "#ec4899", width: 3, x0: cx - 40, y0: cy - 120, x1: cx + 200, y1: cy + 120, fill: true, fillColor: "#ec4899", fillAlpha: 0.25 } as Shape,
      label(cx - 150, cy, "A", "#dbeafe", 4), label(cx + 110, cy, "B", "#fbcfe8", 4), label(cx - 20, cy, "A∩B", "#e5e7eb", 2),
    ],
  },
  {
    id: "bmc", name: "Business Model", faName: "بوم مدل کسب‌وکار", icon: "▦",
    build: (cx, cy) => {
      const out: Shape[] = []; const x = cx - 450, y = cy - 180; const cw = 180, ch = 170; const gap = 6;
      const cells: [number, number, number, number, string][] = [
        [0, 0, 1, 1, "Partners"], [1, 0, 1, 0.5, "Activities"], [1, 0.5, 1, 0.5, "Resources"],
        [2, 0, 1, 1, "Value"], [3, 0, 1, 0.5, "Relationships"], [3, 0.5, 1, 0.5, "Channels"], [4, 0, 1, 1, "Segments"],
      ];
      cells.forEach(([col, rowOff, , hMul, name]) => { const bx = x + col * (cw + gap); const by = y + rowOff * (ch * 2 + gap); out.push(box(bx, by, cw, ch * (hMul * 2) - (hMul < 1 ? gap : 0) + (hMul === 1 ? ch : 0), "#64748b", "rect")); out.push(label(bx + 12, by + 26, name, "#e5e7eb", 2)); });
      out.push(box(x, y + ch * 2 + gap, cw * 2.5 + gap * 2, ch, "#475569", "rect")); out.push(label(x + 12, y + ch * 2 + gap + 26, "Cost structure", "#e5e7eb", 2));
      out.push(box(x + (cw + gap) * 2.5, y + ch * 2 + gap, cw * 2.5, ch, "#475569", "rect")); out.push(label(x + (cw + gap) * 2.5 + 12, y + ch * 2 + gap + 26, "Revenue streams", "#e5e7eb", 2));
      return out;
    },
  },
  {
    id: "gantt", name: "Gantt", faName: "گانت", icon: "▬",
    build: (cx, cy) => {
      const out: Shape[] = []; const x = cx - 400, y = cy - 150;
      out.push(mk({ kind: "shape", tool: "line", color: "#64748b", width: 2, x0: x, y0: y - 10, x1: x + 760, y1: y - 10 }));
      for (let w = 0; w < 8; w++) out.push(label(x + w * 95 + 4, y - 20, "W" + (w + 1), "#94a3b8", 1));
      const tasks: [string, number, number, string][] = [["Research", 0, 2, "#3b82f6"], ["Design", 1, 3, "#a855f7"], ["Build", 3, 4, "#22c55e"], ["Test", 6, 2, "#f59e0b"], ["Launch", 7, 1, "#ef4444"]];
      tasks.forEach(([name, start, dur, color], i) => { const ty = y + i * 46; out.push(label(x - 90, ty + 26, name, "#e5e7eb", 1)); out.push(box(x + start * 95, ty, dur * 95 - 8, 32, color, "rect", color)); });
      return out;
    },
  },
  {
    id: "cornell", name: "Cornell notes", faName: "یادداشت کورنل", icon: "▥",
    build: (cx, cy) => [
      box(cx - 260, cy - 200, 520, 40, "#6366f1", "rect", "#6366f1"), label(cx - 246, cy - 172, "Topic / date", "#e0e7ff", 2),
      box(cx - 260, cy - 155, 160, 300, "#334155", "rect"), label(cx - 246, cy - 128, "Cues", "#e5e7eb", 2),
      box(cx - 95, cy - 155, 355, 300, "#334155", "rect"), label(cx - 80, cy - 128, "Notes", "#e5e7eb", 2),
      box(cx - 260, cy + 150, 520, 70, "#475569", "rect"), label(cx - 246, cy + 178, "Summary", "#e5e7eb", 2),
    ],
  },
  {
    id: "storymap", name: "Story map", faName: "نقشه داستان", icon: "▤",
    build: (cx, cy) => {
      const out: Shape[] = []; const cols = ["Browse", "Search", "Checkout", "Support"];
      cols.forEach((c, i) => { const x = cx - 380 + i * 200; out.push(box(x, cy - 200, 170, 50, "#3b82f6", "rect", "#3b82f6")); out.push(label(x + 14, cy - 172, c, "#dbeafe", 2)); for (let r = 0; r < 3; r++) out.push(note(x - 10, cy - 130 + r * 130, "story", NOTE_COLORS[(i + r) % NOTE_COLORS.length])); });
      return out;
    },
  },
  {
    id: "prioritylist", name: "Priorities", faName: "اولویت‌ها", icon: "≣",
    build: (cx, cy) => {
      const out: Shape[] = [box(cx - 160, cy - 210, 320, 44, "#6366f1", "rect", "#6366f1"), label(cx - 146, cy - 182, "Priorities", "#e0e7ff", 2)];
      const items: [string, string][] = [["P0 · Critical", "#ef4444"], ["P1 · High", "#f59e0b"], ["P2 · Medium", "#3b82f6"], ["P3 · Low", "#64748b"]];
      items.forEach(([name, color], i) => { const y = cy - 150 + i * 80; out.push(box(cx - 160, y, 320, 64, color, "rect", color)); out.push(label(cx - 144, y + 38, name, "#0b0c0e", 2)); });
      return out;
    },
  },
  {
    id: "empathy", name: "Empathy map", faName: "نقشه همدلی", icon: "◔",
    build: (cx, cy) => {
      const out: Shape[] = [box(cx - 70, cy - 60, 140, 120, "#a855f7", "ellipse", "#a855f7"), label(cx - 30, cy, "User", "#f3e8ff", 2)];
      const quad: [number, number, string, string][] = [[-320, -200, "Says", "#3b82f6"], [40, -200, "Thinks", "#06b6d4"], [-320, 60, "Does", "#22c55e"], [40, 60, "Feels", "#ec4899"]];
      for (const [dx, dy, name, color] of quad) { out.push(box(cx + dx, cy + dy, 280, 140, color, "rect", color)); out.push(label(cx + dx + 16, cy + dy + 30, name, color, 3)); }
      return out;
    },
  },
  {
    id: "leancanvas", name: "Lean canvas", faName: "بوم ناب", icon: "▦",
    build: (cx, cy) => {
      const out: Shape[] = []; const x = cx - 450, y = cy - 170; const cw = 178, ch = 150;
      const labels = ["Problem", "Solution", "Value prop", "Advantage", "Segments", "Metrics", "Channels"];
      labels.forEach((name, i) => { const col = i % 5; const bx = x + col * (cw + 6); const by = y + (i >= 5 ? ch + 6 : 0); out.push(box(bx, by, cw, ch, "#64748b", "rect")); out.push(label(bx + 12, by + 26, name, "#e5e7eb", 2)); });
      out.push(box(x, y + ch * 2 + 12, cw * 2.5 + 12, ch * 0.6, "#475569", "rect")); out.push(label(x + 12, y + ch * 2 + 38, "Cost", "#e5e7eb", 2));
      out.push(box(x + cw * 2.5 + 18, y + ch * 2 + 12, cw * 2.5, ch * 0.6, "#475569", "rect")); out.push(label(x + cw * 2.5 + 30, y + ch * 2 + 38, "Revenue", "#e5e7eb", 2));
      return out;
    },
  },
  {
    id: "swimlanes", name: "Swimlanes", faName: "خطوط شنا", icon: "☰",
    build: (cx, cy) => {
      const out: Shape[] = []; const lanes = ["Customer", "Sales", "Ops", "Finance"]; const laneH = 110; const y0 = cy - (lanes.length * laneH) / 2;
      lanes.forEach((name, i) => { const ly = y0 + i * laneH; out.push(box(cx - 460, ly, 120, laneH - 6, "#334155", "rect")); out.push(label(cx - 448, ly + laneH / 2, name, "#e5e7eb", 2)); out.push(box(cx - 330, ly, 780, laneH - 6, "#1e293b", "rect")); for (let s = 0; s < 3; s++) { const sx = cx - 300 + s * 250; out.push(box(sx, ly + 20, 150, laneH - 46, "#3b82f6", "rect", "#3b82f6")); if (s < 2) out.push(link(sx + 150, ly + laneH / 2, sx + 250, ly + laneH / 2, "#94a3b8")); } });
      return out;
    },
  },
];

/* ------------------------------------------------------------------ *
 * Keyboard-shortcut reference (for the help overlay)
 * ------------------------------------------------------------------ */
export const SHORTCUT_HELP: { keys: string; en: string; fa: string }[] = [
  { keys: "V", en: "Select tool", fa: "ابزار انتخاب" },
  { keys: "H / Space", en: "Pan the canvas", fa: "جابه‌جایی بوم" },
  { keys: "B / M / G", en: "Pen / Marker / Highlighter", fa: "قلم / ماژیک / هایلایتر" },
  { keys: "N / K", en: "Neon / Spray", fa: "نئون / اسپری" },
  { keys: "R / O / D", en: "Rectangle / Ellipse / Diamond", fa: "مستطیل / بیضی / لوزی" },
  { keys: "Y / S / P", en: "Triangle / Star / Polygon", fa: "مثلث / ستاره / چندضلعی" },
  { keys: "L / A / C", en: "Line / Arrow / Connector", fa: "خط / پیکان / اتصال" },
  { keys: "T", en: "Text", fa: "متن" },
  { keys: "E / X", en: "Eraser / Laser", fa: "پاک‌کن / لیزر" },
  { keys: "Ctrl/⌘ + Z", en: "Undo", fa: "واگرد" },
  { keys: "Ctrl/⌘ + Shift + Z", en: "Redo", fa: "ازنو" },
  { keys: "Ctrl/⌘ + C / V", en: "Copy / Paste", fa: "کپی / چسباندن" },
  { keys: "Ctrl/⌘ + D", en: "Duplicate", fa: "تکثیر" },
  { keys: "Ctrl/⌘ + Shift + D", en: "Duplicate in place", fa: "تکثیر در جا" },
  { keys: "0", en: "Reset zoom", fa: "بازنشانی بزرگ‌نمایی" },
  { keys: "M", en: "Marker · Measure via toolbar", fa: "ماژیک · اندازه از نوار ابزار" },
  { keys: "Ctrl/⌘ + A", en: "Select all", fa: "انتخاب همه" },
  { keys: "Ctrl/⌘ + G", en: "Group / Ungroup", fa: "گروه / لغو گروه" },
  { keys: "Delete / Backspace", en: "Delete selection", fa: "حذف انتخاب" },
  { keys: "Arrow keys", en: "Nudge selection", fa: "جابه‌جایی جزئی" },
  { keys: "[ / ]", en: "Send back / Bring front", fa: "به عقب / به جلو" },
  { keys: "1 – 9", en: "Pick a palette colour", fa: "انتخاب رنگ پالت" },
  { keys: "Double-click", en: "Edit label / note / comment", fa: "ویرایش برچسب / یادداشت / کامنت" },
  { keys: "Right-click", en: "Context menu", fa: "منوی راست‌کلیک" },
  { keys: "?", en: "Toggle this help", fa: "نمایش این راهنما" },
  { keys: "Wheel / trackpad", en: "Zoom to cursor", fa: "بزرگ‌نمایی روی نشانگر" },
  { keys: "Drag on empty", en: "Marquee-select", fa: "انتخاب کادری" },
];

/* Screen ↔ world transform helpers (kept here so panels/minimap agree). */
export function worldToScreen(p: Point, cam: Camera, rect: { width: number; height: number }): Point {
  return { x: (p.x - cam.x) * cam.zoom + rect.width / 2, y: (p.y - cam.y) * cam.zoom + rect.height / 2 };
}
export function screenToWorld(p: Point, cam: Camera, rect: { width: number; height: number }): Point {
  return { x: (p.x - rect.width / 2) / cam.zoom + cam.x, y: (p.y - rect.height / 2) / cam.zoom + cam.y };
}


/* ================================================================== *
 * Transform handles (resize + rotate for a single selected shape)
 * ================================================================== */
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate";

export function handlePoints(b: Box, rotOffset: number): Record<Handle, Point> {
  const { x, y, w, h } = b, mx = x + w / 2, my = y + h / 2;
  return {
    nw: { x, y }, n: { x: mx, y }, ne: { x: x + w, y },
    e: { x: x + w, y: my }, se: { x: x + w, y: y + h }, s: { x: mx, y: y + h },
    sw: { x, y: y + h }, w: { x, y: my }, rotate: { x: mx, y: y - rotOffset },
  };
}

export function hitHandle(b: Box, px: number, py: number, tol: number, rotOffset: number): Handle | null {
  const pts = handlePoints(b, rotOffset);
  for (const key of Object.keys(pts) as Handle[]) {
    const p = pts[key];
    if (Math.abs(px - p.x) <= tol && Math.abs(py - p.y) <= tol) return key;
  }
  return null;
}

export function resizeBox(start: Box, handle: Handle, px: number, py: number, square: boolean): Box {
  let { x, y, w, h } = start;
  const right = x + w, bottom = y + h;
  if (handle.includes("e")) w = Math.max(8, px - x);
  if (handle.includes("s")) h = Math.max(8, py - y);
  if (handle.includes("w")) { const nx = Math.min(px, right - 8); w = right - nx; x = nx; }
  if (handle.includes("n")) { const ny = Math.min(py, bottom - 8); h = bottom - ny; y = ny; }
  if (square) { const side = Math.max(w, h); if (handle.includes("w")) x = right - side; if (handle.includes("n")) y = bottom - side; w = side; h = side; }
  return { x, y, w, h };
}

export const cursorForHandle: Record<Handle, string> = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", rotate: "grab",
};

/* ================================================================== *
 * Smart alignment guides — snap a moving box to nearby shape edges
 * ================================================================== */
export function computeSnap(moving: Box, others: Shape[], threshold: number): { dx: number; dy: number; vx: number | null; hy: number | null } {
  const mLeft = moving.x, mCX = moving.x + moving.w / 2, mRight = moving.x + moving.w;
  const mTop = moving.y, mCY = moving.y + moving.h / 2, mBottom = moving.y + moving.h;
  let bestX = threshold, bestY = threshold, dx = 0, dy = 0, vx: number | null = null, hy: number | null = null;
  for (const s of others) {
    const b = bbox(s);
    const xs = [b.x, b.x + b.w / 2, b.x + b.w];
    const ys = [b.y, b.y + b.h / 2, b.y + b.h];
    for (const gx of xs) {
      for (const me of [mLeft, mCX, mRight]) { const d = Math.abs(gx - me); if (d < bestX) { bestX = d; dx = gx - me; vx = gx; } }
    }
    for (const gy of ys) {
      for (const me of [mTop, mCY, mBottom]) { const d = Math.abs(gy - me); if (d < bestY) { bestY = d; dy = gy - me; hy = gy; } }
    }
  }
  return { dx, dy, vx, hy };
}

/* ================================================================== *
 * Stencils — single ready-made diagram nodes to click-insert
 * ================================================================== */
const stencilBox = (cx: number, cy: number, w: number, h: number, color: string, tool: Tool): Shape =>
  ({ id: uid(), kind: "shape", tool, color, width: 3, x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, fill: true, fillColor: color, fillAlpha: 0.16, radius: 10 } as Shape);
const stencilText = (cx: number, cy: number, text: string): Shape =>
  ({ id: uid(), kind: "text", tool: "text", color: "#e5e7eb", width: 2, x: cx - text.length * 4, y: cy + 5, text, fontSize: 2, bold: true, align: "left" } as Shape);

export const STENCILS: { id: string; name: string; faName: string; icon: string; build: (cx: number, cy: number) => Shape[] }[] = [
  { id: "process", name: "Process", faName: "فرایند", icon: "▭", build: (x, y) => [stencilBox(x, y, 150, 64, "#3b82f6", "rect"), stencilText(x, y, "Process")] },
  { id: "decision", name: "Decision", faName: "تصمیم", icon: "◆", build: (x, y) => [stencilBox(x, y, 150, 100, "#f59e0b", "diamond"), stencilText(x, y, "Decision?")] },
  { id: "terminator", name: "Start / End", faName: "شروع/پایان", icon: "⬭", build: (x, y) => [stencilBox(x, y, 150, 60, "#22c55e", "ellipse"), stencilText(x, y, "Start")] },
  { id: "database", name: "Database", faName: "پایگاه‌داده", icon: "⛁", build: (x, y) => [stencilBox(x, y, 120, 90, "#a855f7", "cylinder"), stencilText(x, y + 6, "DB")] },
  { id: "input", name: "Input", faName: "ورودی", icon: "▱", build: (x, y) => [stencilBox(x, y, 150, 64, "#06b6d4", "parallelogram"), stencilText(x, y, "Input")] },
  { id: "actor", name: "Actor", faName: "کاربر", icon: "☺", build: (x, y) => [stencilBox(x, y, 90, 90, "#ec4899", "ellipse"), stencilText(x, y + 60, "User")] },
  { id: "card", name: "Card", faName: "کارت", icon: "▤", build: (x, y) => [{ id: uid(), kind: "note", tool: "note", color: NOTE_COLORS[0], width: 1, x: x - 95, y: y - 65, w: 190, h: 130, text: "New card", fontSize: 3 } as Shape] },
  { id: "cloud", name: "Cloud", faName: "ابر", icon: "☁", build: (x, y) => [stencilBox(x, y, 170, 110, "#64748b", "cloud"), stencilText(x, y, "Cloud")] },
  { id: "chip", name: "Tag", faName: "برچسب", icon: "▰", build: (x, y) => [{ id: uid(), kind: "shape", tool: "rect", color: "#10b981", width: 3, x0: x - 55, y0: y - 18, x1: x + 55, y1: y + 18, fill: true, fillColor: "#10b981", fillAlpha: 0.2, radius: 18 } as Shape, stencilText(x, y, "tag")] },
  { id: "callout", name: "Callout", faName: "بادکنک", icon: "💬", build: (x, y) => [{ id: uid(), kind: "shape", tool: "rect", color: "#f59e0b", width: 3, x0: x - 90, y0: y - 45, x1: x + 90, y1: y + 30, fill: true, fillColor: "#f59e0b", fillAlpha: 0.14, radius: 12 } as Shape, { id: uid(), kind: "shape", tool: "triangle", color: "#f59e0b", width: 3, x0: x - 20, y0: y + 28, x1: x + 10, y1: y + 55, fill: true, fillColor: "#f59e0b", fillAlpha: 0.14 } as Shape, stencilText(x, y - 8, "Note")] },
  { id: "stickypack", name: "Sticky pack", faName: "دسته یادداشت", icon: "▤▤", build: (x, y) => [0, 1, 2].map((i) => ({ id: uid(), kind: "note", tool: "note", color: NOTE_COLORS[i], width: 1, x: x - 90 + i * 14, y: y - 60 + i * 14, w: 180, h: 120, text: "", fontSize: 3 } as Shape)) },
  { id: "kbd", name: "Key", faName: "کلید", icon: "⌨", build: (x, y) => [{ id: uid(), kind: "shape", tool: "rect", color: "#94a3b8", width: 2.5, x0: x - 26, y0: y - 20, x1: x + 26, y1: y + 20, fill: true, fillColor: "#1e293b", fillAlpha: 0.9, radius: 6 } as Shape, stencilText(x, y, "⌘")] },
  { id: "dbtable", name: "Table", faName: "جدول", icon: "▤", build: (x, y) => [{ id: uid(), kind: "shape", tool: "rect", color: "#a855f7", width: 3, x0: x - 80, y0: y - 70, x1: x + 80, y1: y + 70, fill: true, fillColor: "#a855f7", fillAlpha: 0.12, radius: 8 } as Shape, { id: uid(), kind: "shape", tool: "line", color: "#a855f7", width: 2, x0: x - 80, y0: y - 40, x1: x + 80, y1: y - 40 } as Shape, stencilText(x, y - 56, "table"), stencilText(x - 50, y - 16, "id"), stencilText(x - 40, y + 12, "name")] },
];


/* ================================================================== *
 * Layout operations — tidy grid, flip, match size
 * ================================================================== */
export function tidyGrid(shapes: Shape[], gap = 28): Record<string, Point> {
  if (!shapes.length) return {};
  const items = shapes.map((s) => ({ s, b: bbox(s) }));
  const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)));
  const cw = Math.max(...items.map((i) => i.b.w)) + gap;
  const ch = Math.max(...items.map((i) => i.b.h)) + gap;
  const u = unionBox(shapes)!;
  const out: Record<string, Point> = {};
  items.forEach((it, i) => { const r = Math.floor(i / cols), c = i % cols; const tx = u.x + c * cw, ty = u.y + r * ch; out[it.s.id] = { x: tx - it.b.x, y: ty - it.b.y }; });
  return out;
}

export function flipShape(s: Shape, axis: "h" | "v", cx: number, cy: number) {
  const mapX = (x: number) => 2 * cx - x;
  const mapY = (y: number) => 2 * cy - y;
  if (s.pts) s.pts = s.pts.map((p) => ({ x: axis === "h" ? mapX(p.x) : p.x, y: axis === "v" ? mapY(p.y) : p.y }));
  if (s.x0 != null) {
    if (axis === "h") { const nx0 = mapX(s.x0), nx1 = mapX(s.x1!); s.x0 = Math.min(nx0, nx1); s.x1 = Math.max(nx0, nx1); if (s.tool === "line" || s.tool === "arrow" || s.tool === "connector") { s.x0 = nx0; s.x1 = nx1; } }
    else { const ny0 = mapY(s.y0!), ny1 = mapY(s.y1!); s.y0 = Math.min(ny0, ny1); s.y1 = Math.max(ny0, ny1); if (s.tool === "line" || s.tool === "arrow" || s.tool === "connector") { s.y0 = ny0; s.y1 = ny1; } }
  }
  if (s.x != null) { const b = bbox(s); if (axis === "h") s.x = mapX(b.x + b.w); else s.y = mapY(b.y + b.h); }
}

export function matchDimension(shapes: Shape[], dim: "w" | "h" | "both"): void {
  if (shapes.length < 2) return;
  const ref = bbox(shapes[0]);
  for (let i = 1; i < shapes.length; i++) {
    const b = bbox(shapes[i]);
    const nb: Box = { x: b.x, y: b.y, w: dim === "h" ? b.w : ref.w, h: dim === "w" ? b.h : ref.h };
    setShapeBox(shapes[i], nb);
  }
}
