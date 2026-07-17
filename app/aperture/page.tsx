"use client";

/*
  Aperture — a real, collaborative whiteboard (not a demo).

  Collaboration: genuine WebRTC peer-to-peer (PeerJS) in a host-relayed star.
  Share opens a room; anyone who opens the link joins live. Strokes, shapes,
  notes, images, moves, z-order and clears all sync, plus real remote cursors,
  a live presence list and a synced laser pointer. No fake collaborators.

  Tools: pen, marker, highlighter, neon, spray, object eraser, laser; line,
  arrow, rectangle, ellipse, diamond, triangle, star; sticky notes, text, and
  image insert; plus select / pan / eyedropper.

  Options (20+): fill + fill/stroke opacity, dashed/dotted lines, snap-to-grid,
  Shift-constrain (square/circle/45°), text bold + font size, board background
  (grid / dots / plain), duplicate, bring-to-front / send-to-back, copy & paste
  (Ctrl+C/V), image paste, zoom in/out/fit + reset, PNG + SVG export, board
  save/load (JSON, auto-persisted), undo/redo, keyboard shortcuts, and a rich
  colour palette + custom picker + recents + variable width. Bilingual + themed.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";

type Tool =
  | "select" | "pan" | "eyedropper" | "pen" | "marker" | "highlighter" | "neon" | "spray" | "eraser" | "laser"
  | "line" | "arrow" | "rect" | "ellipse" | "diamond" | "triangle" | "star" | "note" | "text" | "image";
type Dash = "solid" | "dashed" | "dotted";
type Bg = "grid" | "dots" | "plain";

type Shape = {
  id: string;
  kind: "stroke" | "shape" | "note" | "text" | "image";
  tool: Tool;
  color: string;
  width: number;
  alpha?: number;
  dash?: Dash;
  fill?: boolean;
  bold?: boolean;
  fontSize?: number;
  pts?: { x: number; y: number }[];
  x0?: number; y0?: number; x1?: number; y1?: number;
  x?: number; y?: number; w?: number; h?: number;
  text?: string;
  src?: string;
  by?: string;
};

type Cursor = { x: number; y: number; name: string; color: string; t: number };
type Peer = { id: string; name: string; color: string };

const uid = () => Math.random().toString(36).slice(2, 10);
const STORE = "aperture:board:v1";
const GRID = 40;
const PALETTE = ["#111827", "#ffffff", "#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#78716c"];
const STROKE_TOOLS: Tool[] = ["pen", "marker", "highlighter", "neon", "spray"];
const SHAPE_TOOLS: Tool[] = ["line", "arrow", "rect", "ellipse", "diamond", "triangle", "star"];
const CLOSED_SHAPES: Tool[] = ["rect", "ellipse", "diamond", "triangle", "star"];
const NAMES = ["Falcon", "Nova", "Echo", "Vega", "Onyx", "Iris", "Zephyr", "Lumen", "Koi", "Sable"];
const CURSOR_COLORS = ["#f59e0b", "#22c55e", "#ec4899", "#3b82f6", "#a855f7", "#06b6d4", "#ef4444"];
const SHORTCUTS: Record<string, Tool> = { v: "select", h: "pan", i: "eyedropper", b: "pen", m: "marker", g: "highlighter", n: "neon", k: "spray", e: "eraser", x: "laser", l: "line", a: "arrow", r: "rect", o: "ellipse", d: "diamond", y: "triangle", s: "star", t: "text" };

export default function AperturePage() {
  const { lang } = useLang();
  const fa = lang === "fa";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#3b82f6");
  const [recent, setRecent] = useState<string[]>([]);
  const [width, setWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [dash, setDash] = useState<Dash>("solid");
  const [fill, setFill] = useState(false);
  const [bold, setBold] = useState(false);
  const [fontSize, setFontSize] = useState(4);
  const [bg, setBg] = useState<Bg>("grid");
  const [snap, setSnap] = useState(false);
  const [, setVersion] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [copied, setCopied] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<"solo" | "connecting" | "live">("solo");
  const [presence, setPresence] = useState<Peer[]>([]);
  const [editing, setEditing] = useState<{ id: string; sx: number; sy: number; value: string; kind: "note" | "text" } | null>(null);

  // canvas state in refs → smooth rAF, no re-render churn
  const shapesRef = useRef<Shape[]>([]);
  const undoRef = useRef<Shape[][]>([]);
  const redoRef = useRef<Shape[][]>([]);
  const draftRef = useRef<Shape | null>(null);
  const selRef = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const clipRef = useRef<Shape | null>(null);
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const panRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const spaceRef = useRef(false);
  const shiftRef = useRef(false);
  const laserRef = useRef<Record<string, { x: number; y: number; t: number }[]>>({});
  const imgCache = useRef<Record<string, HTMLImageElement>>({});
  const toolRef = useRef(tool); toolRef.current = tool;
  const colorRef = useRef(color); colorRef.current = color;
  const widthRef = useRef(width); widthRef.current = width;
  const opacityRef = useRef(opacity); opacityRef.current = opacity;
  const dashRef = useRef(dash); dashRef.current = dash;
  const fillRef = useRef(fill); fillRef.current = fill;
  const boldRef = useRef(bold); boldRef.current = bold;
  const fontRef = useRef(fontSize); fontRef.current = fontSize;
  const bgRef = useRef(bg); bgRef.current = bg;
  const snapRef = useRef(snap); snapRef.current = snap;
  const dprRef = useRef(1);
  const sprayTimer = useRef(0);

  // collaboration
  const peerRef = useRef<any>(null);
  const connsRef = useRef<any[]>([]);
  const isHostRef = useRef(false);
  const meRef = useRef({ id: uid(), name: NAMES[Math.floor(Math.random() * NAMES.length)], color: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)] });
  const remoteCursorsRef = useRef<Record<string, Cursor>>({});
  const lastCursorSent = useRef(0);

  const T = fa
    ? { brand: "آپرچر", select: "انتخاب", pan: "جابه‌جایی", eyedropper: "قطره‌چکان", pen: "قلم", marker: "ماژیک", highlighter: "هایلایتر", neon: "نئون", spray: "اسپری", eraser: "پاک‌کن", laser: "لیزر", line: "خط", arrow: "پیکان", rect: "مستطیل", ellipse: "بیضی", diamond: "لوزی", triangle: "مثلث", star: "ستاره", note: "یادداشت", text: "متن", image: "تصویر", undo: "واگرد", redo: "ازنو", clear: "پاک‌کردن همه", exportPng: "PNG", exportSvg: "SVG", save: "ذخیره", load: "بازکردن", share: "اشتراکِ اتاق", copied: "لینک کپی شد!", solo: "تنها", connecting: "در حال اتصال…", live: "زنده", size: "ضخامت", opacity: "شفافیت", grid: "پس‌زمینه", confirmClear: "کلِ بوم پاک شود؟", shapes: "شکل", writeHere: "بنویس…", online: "آنلاین", zoomReset: "بازنشانی", fill: "پُر", dashS: "خط‌چین", bold: "درشت", font: "اندازه", snap: "چفت به شبکه", dup: "تکثیر", front: "به جلو", back: "به عقب", fit: "جای‌دهی", you: "تو" }
    : { brand: "Aperture", select: "Select", pan: "Pan", eyedropper: "Eyedropper", pen: "Pen", marker: "Marker", highlighter: "Highlighter", neon: "Neon", spray: "Spray", eraser: "Eraser", laser: "Laser", line: "Line", arrow: "Arrow", rect: "Rectangle", ellipse: "Ellipse", diamond: "Diamond", triangle: "Triangle", star: "Star", note: "Note", text: "Text", image: "Image", undo: "Undo", redo: "Redo", clear: "Clear all", exportPng: "PNG", exportSvg: "SVG", save: "Save", load: "Load", share: "Share room", copied: "Link copied!", solo: "Solo", connecting: "Connecting…", live: "Live", size: "Width", opacity: "Opacity", grid: "Background", confirmClear: "Clear the whole board?", shapes: "shapes", writeHere: "Type…", online: "online", zoomReset: "Reset", fill: "Fill", dashS: "Dash", bold: "Bold", font: "Size", snap: "Snap", dup: "Duplicate", front: "To front", back: "To back", fit: "Fit", you: "You" };

  const label: Record<string, string> = { select: T.select, pan: T.pan, eyedropper: T.eyedropper, pen: T.pen, marker: T.marker, highlighter: T.highlighter, neon: T.neon, spray: T.spray, eraser: T.eraser, laser: T.laser, line: T.line, arrow: T.arrow, rect: T.rect, ellipse: T.ellipse, diamond: T.diamond, triangle: T.triangle, star: T.star, note: T.note, text: T.text, image: T.image };
  const icon: Record<string, string> = { select: "⬚", pan: "✋", eyedropper: "💧", pen: "✎", marker: "🖊", highlighter: "▬", neon: "⚡", spray: "░", eraser: "⌫", laser: "🔴", line: "╱", arrow: "↗", rect: "▭", ellipse: "◯", diamond: "◆", triangle: "△", star: "★", note: "▤", text: "T", image: "🖼" };

  const bump = () => setVersion((v) => v + 1);
  const pushColor = (c: string) => setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 8));
  const snapv = (v: number) => (snapRef.current ? Math.round(v / GRID) * GRID : v);

  /* ---------------- persistence ---------------- */
  useEffect(() => { try { const raw = localStorage.getItem(STORE); if (raw) shapesRef.current = JSON.parse(raw); } catch {} bump(); }, []);
  const persist = useCallback(() => { try { localStorage.setItem(STORE, JSON.stringify(shapesRef.current.slice(-3000))); } catch {} }, []);

  /* ---------------- history ---------------- */
  const snapshot = () => { undoRef.current.push(structuredClone(shapesRef.current)); if (undoRef.current.length > 100) undoRef.current.shift(); redoRef.current = []; };
  const syncAll = () => broadcast({ type: "sync", shapes: shapesRef.current });
  const undo = () => { if (!undoRef.current.length) return; redoRef.current.push(structuredClone(shapesRef.current)); shapesRef.current = undoRef.current.pop()!; selRef.current = null; persist(); syncAll(); bump(); };
  const redo = () => { if (!redoRef.current.length) return; undoRef.current.push(structuredClone(shapesRef.current)); shapesRef.current = redoRef.current.pop()!; persist(); syncAll(); bump(); };
  const clearAll = () => { if (!shapesRef.current.length || !window.confirm(T.confirmClear)) return; snapshot(); shapesRef.current = []; selRef.current = null; persist(); syncAll(); bump(); };

  /* ---------------- collaboration ---------------- */
  const broadcast = (msg: any, exclude?: any) => { const data = JSON.stringify(msg); for (const c of connsRef.current) { if (c === exclude) continue; try { if (c.open) c.send(data); } catch {} } };
  const upsertShape = (s: Shape, fromRemote = false) => { const i = shapesRef.current.findIndex((x) => x.id === s.id); if (i >= 0) shapesRef.current[i] = s; else shapesRef.current.push(s); if (!fromRemote) { persist(); broadcast({ type: "upsert", shape: s }); } };
  const removeShape = (id: string, fromRemote = false) => { shapesRef.current = shapesRef.current.filter((x) => x.id !== id); if (!fromRemote) { persist(); broadcast({ type: "remove", id }); } };

  const handleMessage = (raw: any, conn: any) => {
    let msg: any; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "sync") { shapesRef.current = msg.shapes || []; persist(); }
    else if (msg.type === "upsert") upsertShape(msg.shape, true);
    else if (msg.type === "remove") removeShape(msg.id, true);
    else if (msg.type === "reorder") { shapesRef.current = (msg.order as string[]).map((id) => shapesRef.current.find((s) => s.id === id)).filter(Boolean) as Shape[]; }
    else if (msg.type === "cursor") remoteCursorsRef.current[msg.id] = { x: msg.x, y: msg.y, name: msg.name, color: msg.color, t: Date.now() };
    else if (msg.type === "laser") { (laserRef.current[msg.id] = laserRef.current[msg.id] || []).push({ x: msg.x, y: msg.y, t: Date.now() }); }
    else if (msg.type === "hello") setPresence((p) => (p.some((x) => x.id === msg.id) ? p : [...p, { id: msg.id, name: msg.name, color: msg.color }]));
    if (isHostRef.current && msg.type !== "cursor" && msg.type !== "laser") broadcast(msg, conn);
    if (msg.type !== "cursor" && msg.type !== "laser") bump();
  };

  const wireConn = (conn: any) => {
    conn.on("open", () => {
      connsRef.current.push(conn); setStatus("live");
      try { conn.send(JSON.stringify({ type: "hello", id: meRef.current.id, name: meRef.current.name, color: meRef.current.color })); } catch {}
      if (isHostRef.current) { try { conn.send(JSON.stringify({ type: "sync", shapes: shapesRef.current })); } catch {} }
    });
    conn.on("data", (raw: any) => handleMessage(raw, conn));
    const drop = () => { connsRef.current = connsRef.current.filter((c) => c !== conn); if (!connsRef.current.length && isHostRef.current) setStatus("solo"); setPresence([]); };
    conn.on("close", drop); conn.on("error", drop);
  };

  const startRoom = useCallback(async (room: string, host: boolean) => {
    setStatus("connecting"); setRoomId(room); isHostRef.current = host;
    try {
      const mod = await import("peerjs"); const Peer: any = mod.default;
      const cfg = { config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] } };
      const peer = host ? new Peer("aperture-" + room, cfg) : new Peer(cfg);
      peerRef.current = peer;
      peer.on("open", () => { if (host) setStatus(connsRef.current.length ? "live" : "solo"); else wireConn(peer.connect("aperture-" + room, { reliable: true })); });
      peer.on("connection", (conn: any) => wireConn(conn));
      peer.on("error", () => { if (host) setStatus("solo"); else setStatus("connecting"); });
    } catch { setStatus("solo"); }
  }, []);

  const share = () => { let room = roomId; if (!peerRef.current) { room = uid(); startRoom(room, true); } const link = `${location.origin}${location.pathname}?room=${room}`; navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  useEffect(() => { const r = new URLSearchParams(window.location.search).get("room"); if (r) startRoom(r, false); return () => { try { peerRef.current?.destroy(); } catch {} }; }, [startRoom]);

  /* ---------------- geometry ---------------- */
  const bbox = (s: Shape) => {
    if (s.pts && s.pts.length) { const xs = s.pts.map((p) => p.x), ys = s.pts.map((p) => p.y); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
    if (s.kind === "note" || s.kind === "image") return { x: s.x!, y: s.y!, w: s.w!, h: s.h! };
    if (s.kind === "text") return { x: s.x!, y: s.y! - 22, w: Math.max(60, (s.text?.length || 4) * ((s.fontSize ?? 4) + 9)), h: 30 };
    const x = Math.min(s.x0!, s.x1!), y = Math.min(s.y0!, s.y1!); return { x, y, w: Math.abs(s.x1! - s.x0!), h: Math.abs(s.y1! - s.y0!) };
  };
  const hit = (px: number, py: number) => { for (let i = shapesRef.current.length - 1; i >= 0; i--) { const b = bbox(shapesRef.current[i]); if (px >= b.x - 8 && px <= b.x + b.w + 8 && py >= b.y - 8 && py <= b.y + b.h + 8) return shapesRef.current[i]; } return null; };
  const translate = (s: Shape, dx: number, dy: number) => { if (s.pts) s.pts = s.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })); if (s.x0 != null) { s.x0 += dx; s.x1! += dx; s.y0! += dy; s.y1! += dy; } if (s.x != null) { s.x += dx; s.y! += dy; } };
  const getImg = (src: string) => { let im = imgCache.current[src]; if (!im) { im = new Image(); im.src = src; imgCache.current[src] = im; } return im; };

  /* ---------------- drawing ---------------- */
  const drawShape = (ctx: CanvasRenderingContext2D, s: Shape) => {
    ctx.save();
    ctx.globalAlpha = s.alpha ?? 1;
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (s.dash === "dashed") ctx.setLineDash([s.width * 3, s.width * 2.5]);
    else if (s.dash === "dotted") ctx.setLineDash([1, s.width * 2]);
    if (s.kind === "image" && s.src) { const im = getImg(s.src); try { ctx.drawImage(im, s.x!, s.y!, s.w!, s.h!); } catch {} ctx.restore(); return; }
    if (s.kind === "stroke" && s.pts && s.pts.length) {
      if (s.tool === "spray") { for (const p of s.pts) ctx.fillRect(p.x, p.y, 1.5, 1.5); }
      else {
        if (s.tool === "neon") { ctx.shadowColor = s.color; ctx.shadowBlur = s.width * 3; }
        if (s.tool === "highlighter") ctx.lineCap = "butt";
        ctx.beginPath(); ctx.moveTo(s.pts[0].x, s.pts[0].y); for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y); ctx.stroke();
        if (s.tool === "neon") { ctx.shadowBlur = 0; ctx.strokeStyle = "#ffffff"; ctx.globalAlpha = (s.alpha ?? 1) * 0.7; ctx.lineWidth = Math.max(1, s.width * 0.35); ctx.stroke(); }
      }
    } else if (s.kind === "shape") {
      const x0 = s.x0!, y0 = s.y0!, x1 = s.x1!, y1 = s.y1!;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
      ctx.beginPath();
      if (s.tool === "line" || s.tool === "arrow") {
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        if (s.tool === "arrow") { const a = Math.atan2(y1 - y0, x1 - x0), h = 10 + s.width * 2.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - h * Math.cos(a - 0.4), y1 - h * Math.sin(a - 0.4)); ctx.moveTo(x1, y1); ctx.lineTo(x1 - h * Math.cos(a + 0.4), y1 - h * Math.sin(a + 0.4)); ctx.stroke(); }
      } else {
        if (s.tool === "rect") ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        else if (s.tool === "ellipse") ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        else if (s.tool === "diamond") { ctx.moveTo(cx, y0); ctx.lineTo(x1, cy); ctx.lineTo(cx, y1); ctx.lineTo(x0, cy); ctx.closePath(); }
        else if (s.tool === "triangle") { ctx.moveTo(cx, Math.min(y0, y1)); ctx.lineTo(x1, Math.max(y0, y1)); ctx.lineTo(x0, Math.max(y0, y1)); ctx.closePath(); }
        else if (s.tool === "star") { const oR = Math.max(rx, ry), iR = oR * 0.44; let rot = -Math.PI / 2; ctx.moveTo(cx + Math.cos(rot) * oR, cy + Math.sin(rot) * oR); for (let i = 0; i < 5; i++) { rot += Math.PI / 5; ctx.lineTo(cx + Math.cos(rot) * iR, cy + Math.sin(rot) * iR); rot += Math.PI / 5; ctx.lineTo(cx + Math.cos(rot) * oR, cy + Math.sin(rot) * oR); } ctx.closePath(); }
        if (s.fill) { ctx.save(); ctx.globalAlpha = (s.alpha ?? 1) * 0.32; ctx.fill(); ctx.restore(); }
        ctx.stroke();
      }
    } else if (s.kind === "note") {
      ctx.save(); ctx.setLineDash([]); ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.roundRect(s.x!, s.y!, s.w!, s.h!, 8); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#1a1a1a"; ctx.font = `${s.bold ? "700 " : ""}${14 + (s.fontSize ?? 4)}px ui-sans-serif, system-ui`; ctx.textBaseline = "top"; ctx.globalAlpha = 1;
      wrap(ctx, s.text || "", s.x! + 12, s.y! + 12, s.w! - 24, 18 + (s.fontSize ?? 4));
    } else if (s.kind === "text") {
      ctx.fillStyle = s.color; ctx.font = `${s.bold ? "800" : "600"} ${14 + (s.fontSize ?? 4) * 3}px ui-sans-serif, system-ui`; ctx.textBaseline = "alphabetic";
      (s.text || "").split("\n").forEach((ln, i) => ctx.fillText(ln, s.x!, s.y! + i * (18 + (s.fontSize ?? 4) * 3)));
    }
    ctx.restore();
  };
  const wrap = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) => {
    let yy = y;
    for (const para of text.split("\n")) { const words = para.split(/\s+/); let line = ""; for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; } ctx.fillText(line, x, yy); yy += lh; }
  };

  /* ---------------- render loop ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current!; const ctx = canvas.getContext("2d")!; let raf = 0;
    const resize = () => { const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); dprRef.current = dpr; canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);
    const loop = () => {
      const r = canvas.getBoundingClientRect(); const dpr = dprRef.current; const cam = camRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
      ctx.save(); ctx.translate(r.width / 2, r.height / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
      const vx0 = cam.x - r.width / 2 / cam.zoom, vy0 = cam.y - r.height / 2 / cam.zoom, vx1 = cam.x + r.width / 2 / cam.zoom, vy1 = cam.y + r.height / 2 / cam.zoom;
      if (bgRef.current === "grid") { ctx.strokeStyle = "rgba(128,128,128,0.16)"; ctx.lineWidth = 1 / cam.zoom; for (let x = Math.floor(vx0 / GRID) * GRID; x < vx1; x += GRID) { ctx.beginPath(); ctx.moveTo(x, vy0); ctx.lineTo(x, vy1); ctx.stroke(); } for (let y = Math.floor(vy0 / GRID) * GRID; y < vy1; y += GRID) { ctx.beginPath(); ctx.moveTo(vx0, y); ctx.lineTo(vx1, y); ctx.stroke(); } }
      else if (bgRef.current === "dots") { ctx.fillStyle = "rgba(128,128,128,0.28)"; for (let x = Math.floor(vx0 / GRID) * GRID; x < vx1; x += GRID) for (let y = Math.floor(vy0 / GRID) * GRID; y < vy1; y += GRID) { ctx.beginPath(); ctx.arc(x, y, 1.3 / cam.zoom, 0, Math.PI * 2); ctx.fill(); } }
      for (const s of shapesRef.current) drawShape(ctx, s);
      if (draftRef.current) drawShape(ctx, draftRef.current);
      const sel = shapesRef.current.find((s) => s.id === selRef.current);
      if (sel) { const b = bbox(sel); ctx.strokeStyle = "#3b82f6"; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5 / cam.zoom; ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12); ctx.setLineDash([]); }
      // laser trails (fade over 700ms)
      const now = Date.now();
      for (const id in laserRef.current) { const pts = laserRef.current[id] = laserRef.current[id].filter((p) => now - p.t < 700); for (const p of pts) { const a = 1 - (now - p.t) / 700; ctx.globalAlpha = a; ctx.fillStyle = "#ff2d55"; ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 12 / cam.zoom; ctx.beginPath(); ctx.arc(p.x, p.y, 5 / cam.zoom, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
      // remote cursors
      for (const id in remoteCursorsRef.current) { const c = remoteCursorsRef.current[id]; if (now - c.t > 5000) { delete remoteCursorsRef.current[id]; continue; } ctx.save(); ctx.fillStyle = c.color; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y + 18 / cam.zoom); ctx.lineTo(c.x + 6 / cam.zoom, c.y + 13 / cam.zoom); ctx.lineTo(c.x + 13 / cam.zoom, c.y + 12 / cam.zoom); ctx.closePath(); ctx.fill(); ctx.font = `${12 / cam.zoom}px ui-sans-serif`; const tw = ctx.measureText(c.name).width; ctx.fillRect(c.x + 12 / cam.zoom, c.y + 12 / cam.zoom, tw + 12 / cam.zoom, 16 / cam.zoom); ctx.fillStyle = "#fff"; ctx.fillText(c.name, c.x + 18 / cam.zoom, c.y + 24 / cam.zoom); ctx.restore(); }
      ctx.restore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- input ---------------- */
  const toWorld = (e: { clientX: number; clientY: number }) => { const r = canvasRef.current!.getBoundingClientRect(); const cam = camRef.current; return { x: (e.clientX - r.left - r.width / 2) / cam.zoom + cam.x, y: (e.clientY - r.top - r.height / 2) / cam.zoom + cam.y }; };
  const sendCursor = (w: { x: number; y: number }) => { const now = Date.now(); if (now - lastCursorSent.current < 45 || !connsRef.current.length) return; lastCursorSent.current = now; broadcast({ type: "cursor", id: meRef.current.id, x: w.x, y: w.y, name: meRef.current.name, color: meRef.current.color }); };
  const styleOf = (): Partial<Shape> => ({ color: colorRef.current, width: widthRef.current, alpha: opacityRef.current, dash: dashRef.current, fill: fillRef.current, by: meRef.current.color });

  const commitDraft = () => { const d = draftRef.current; draftRef.current = null; if (!d) return; if (d.kind === "shape" && Math.hypot(d.x1! - d.x0!, d.y1! - d.y0!) < 3) return; snapshot(); upsertShape(d); bump(); };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const t = toolRef.current; const scr = { sx: e.clientX, sy: e.clientY }; const raw = toWorld(e); const w = { x: snapv(raw.x), y: snapv(raw.y) };
    if (t === "pan" || spaceRef.current || e.button === 1) { panRef.current = { sx: e.clientX, sy: e.clientY, cx: camRef.current.x, cy: camRef.current.y }; return; }
    if (t === "eyedropper") { const h = hit(raw.x, raw.y); if (h) { setColor(h.color); } setTool("pen"); return; }
    if (t === "laser") { (laserRef.current[meRef.current.id] = laserRef.current[meRef.current.id] || []).push({ x: raw.x, y: raw.y, t: Date.now() }); broadcast({ type: "laser", id: meRef.current.id, x: raw.x, y: raw.y }); dragRef.current = { x: raw.x, y: raw.y, moved: true }; return; }
    if (t === "select") { const h = hit(raw.x, raw.y); selRef.current = h?.id ?? null; if (h) { snapshot(); dragRef.current = { x: raw.x, y: raw.y, moved: false }; } bump(); return; }
    if (t === "eraser") { snapshot(); const h = hit(raw.x, raw.y); if (h) removeShape(h.id); dragRef.current = { x: raw.x, y: raw.y, moved: true }; bump(); return; }
    if (t === "note") { snapshot(); const s: Shape = { id: uid(), kind: "note", tool: "note", color: colorRef.current === "#ffffff" ? "#fde68a" : colorRef.current, width: 1, bold: boldRef.current, fontSize: fontRef.current, x: w.x, y: w.y, w: 190, h: 130, text: "", by: meRef.current.color }; upsertShape(s); setEditing({ id: s.id, sx: scr.sx, sy: scr.sy, value: "", kind: "note" }); pushColor(colorRef.current); bump(); return; }
    if (t === "text") { snapshot(); const s: Shape = { id: uid(), kind: "text", tool: "text", color: colorRef.current, width: widthRef.current, bold: boldRef.current, fontSize: fontRef.current, x: w.x, y: w.y, text: "", by: meRef.current.color }; upsertShape(s); setEditing({ id: s.id, sx: scr.sx, sy: scr.sy, value: "", kind: "text" }); pushColor(colorRef.current); bump(); return; }
    if (STROKE_TOOLS.includes(t)) { const alpha = (t === "highlighter" ? 0.35 : t === "marker" ? 0.92 : 1) * opacityRef.current; const wMul = t === "highlighter" ? 3.2 : t === "marker" ? 1.7 : 1; draftRef.current = { id: uid(), kind: "stroke", tool: t, color: colorRef.current, width: widthRef.current * wMul, alpha, pts: [{ x: raw.x, y: raw.y }], by: meRef.current.color }; pushColor(colorRef.current); return; }
    draftRef.current = { id: uid(), kind: "shape", tool: t, ...styleOf(), x0: w.x, y0: w.y, x1: w.x, y1: w.y } as Shape; pushColor(colorRef.current);
  };
  const onMove = (e: React.PointerEvent) => {
    const raw = toWorld(e); sendCursor(raw);
    if (panRef.current) { const cam = camRef.current; cam.x = panRef.current.cx - (e.clientX - panRef.current.sx) / cam.zoom; cam.y = panRef.current.cy - (e.clientY - panRef.current.sy) / cam.zoom; return; }
    if (toolRef.current === "laser" && dragRef.current) { (laserRef.current[meRef.current.id] = laserRef.current[meRef.current.id] || []).push({ x: raw.x, y: raw.y, t: Date.now() }); broadcast({ type: "laser", id: meRef.current.id, x: raw.x, y: raw.y }); return; }
    if (dragRef.current) {
      if (toolRef.current === "eraser") { const h = hit(raw.x, raw.y); if (h) { removeShape(h.id); bump(); } return; }
      const sel = shapesRef.current.find((s) => s.id === selRef.current); if (sel) { translate(sel, snapv(raw.x) - dragRef.current.x, snapv(raw.y) - dragRef.current.y); dragRef.current = { x: snapv(raw.x), y: snapv(raw.y), moved: true }; } return;
    }
    const d = draftRef.current; if (!d) return;
    if (d.kind === "stroke") { if (d.tool === "spray") { const now = performance.now(); if (now - sprayTimer.current > 12) { sprayTimer.current = now; for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, rr = Math.random() * d.width * 2.2; d.pts!.push({ x: raw.x + Math.cos(a) * rr, y: raw.y + Math.sin(a) * rr }); } } } else d.pts!.push({ x: raw.x, y: raw.y }); }
    else { let nx = snapv(raw.x), ny = snapv(raw.y); if (shiftRef.current) { if (CLOSED_SHAPES.includes(d.tool)) { const side = Math.max(Math.abs(nx - d.x0!), Math.abs(ny - d.y0!)); nx = d.x0! + Math.sign(nx - d.x0!) * side; ny = d.y0! + Math.sign(ny - d.y0!) * side; } else { const dx = nx - d.x0!, dy = ny - d.y0!; const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); const len = Math.hypot(dx, dy); nx = d.x0! + Math.cos(ang) * len; ny = d.y0! + Math.sin(ang) * len; } } d.x1 = nx; d.y1 = ny; }
  };
  const onUp = () => {
    if (panRef.current) { panRef.current = null; return; }
    if (toolRef.current === "laser") { dragRef.current = null; return; }
    if (dragRef.current) { if (!dragRef.current.moved && toolRef.current === "select") undoRef.current.pop(); else if (selRef.current && dragRef.current.moved) { const sel = shapesRef.current.find((s) => s.id === selRef.current); if (sel) upsertShape(sel); } dragRef.current = null; persist(); bump(); return; }
    commitDraft(); persist();
  };
  const onWheel = (e: React.WheelEvent) => { const cam = camRef.current; const r = canvasRef.current!.getBoundingClientRect(); const before = toWorld(e); const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1; cam.zoom = Math.max(0.15, Math.min(6, cam.zoom * factor)); const sx = e.clientX - r.left - r.width / 2, sy = e.clientY - r.top - r.height / 2; cam.x = before.x - sx / cam.zoom; cam.y = before.y - sy / cam.zoom; setZoomPct(Math.round(cam.zoom * 100)); };
  const zoomBy = (f: number) => { camRef.current.zoom = Math.max(0.15, Math.min(6, camRef.current.zoom * f)); setZoomPct(Math.round(camRef.current.zoom * 100)); };
  const resetZoom = () => { camRef.current.zoom = 1; camRef.current.x = 0; camRef.current.y = 0; setZoomPct(100); };
  const zoomFit = () => { const ss = shapesRef.current; if (!ss.length) return resetZoom(); let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; for (const s of ss) { const b = bbox(s); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); } const r = canvasRef.current!.getBoundingClientRect(); const pad = 80; const z = Math.max(0.15, Math.min(3, Math.min((r.width - pad) / (maxX - minX || 1), (r.height - pad) / (maxY - minY || 1)))); camRef.current.zoom = z; camRef.current.x = (minX + maxX) / 2; camRef.current.y = (minY + maxY) / 2; setZoomPct(Math.round(z * 100)); };

  /* ---------------- selection actions ---------------- */
  const withSel = (fn: (s: Shape) => void) => { const s = shapesRef.current.find((x) => x.id === selRef.current); if (!s) return; snapshot(); fn(s); persist(); syncAll(); bump(); };
  const duplicateSel = () => { const s = shapesRef.current.find((x) => x.id === selRef.current); if (!s) return; snapshot(); const c: Shape = structuredClone(s); c.id = uid(); translate(c, 24, 24); shapesRef.current.push(c); selRef.current = c.id; persist(); broadcast({ type: "upsert", shape: c }); bump(); };
  const bringFront = () => withSel((s) => { shapesRef.current = shapesRef.current.filter((x) => x.id !== s.id); shapesRef.current.push(s); broadcast({ type: "reorder", order: shapesRef.current.map((x) => x.id) }); });
  const sendBack = () => withSel((s) => { shapesRef.current = shapesRef.current.filter((x) => x.id !== s.id); shapesRef.current.unshift(s); broadcast({ type: "reorder", order: shapesRef.current.map((x) => x.id) }); });

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = true;
      if (editing) return;
      if (e.code === "Space") { spaceRef.current = true; return; }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "c") { const s = shapesRef.current.find((x) => x.id === selRef.current); if (s) clipRef.current = structuredClone(s); return; }
      if (mod && e.key.toLowerCase() === "v") { if (clipRef.current) { snapshot(); const c = structuredClone(clipRef.current); c.id = uid(); translate(c, 28, 28); shapesRef.current.push(c); selRef.current = c.id; persist(); broadcast({ type: "upsert", shape: c }); bump(); } return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); return; }
      if (mod) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selRef.current) { snapshot(); removeShape(selRef.current); selRef.current = null; bump(); return; }
      const tl = SHORTCUTS[e.key.toLowerCase()]; if (tl) setTool(tl);
    };
    const ku = (e: KeyboardEvent) => { if (e.key === "Shift") shiftRef.current = false; if (e.code === "Space") spaceRef.current = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /* ---------------- images ---------------- */
  const addImageFromDataUrl = (dataUrl: string) => {
    const im = new Image();
    im.onload = () => {
      const max = 800; let w = im.naturalWidth, h = im.naturalHeight;
      if (Math.max(w, h) > max) { const k = max / Math.max(w, h); w *= k; h *= k; }
      const off = document.createElement("canvas"); off.width = w; off.height = h; off.getContext("2d")!.drawImage(im, 0, 0, w, h);
      const src = off.toDataURL("image/png");
      imgCache.current[src] = (() => { const c = new Image(); c.src = src; return c; })();
      const dw = Math.min(360, w), dh = dw * (h / w);
      snapshot(); const s: Shape = { id: uid(), kind: "image", tool: "image", color: "#000", width: 1, src, x: camRef.current.x - dw / 2, y: camRef.current.y - dh / 2, w: dw, h: dh, by: meRef.current.color };
      upsertShape(s); selRef.current = s.id; setTool("select"); bump();
    };
    im.src = dataUrl;
  };
  const imgInputRef = useRef<HTMLInputElement>(null);
  const onPickImage = (file: File) => { const r = new FileReader(); r.onload = () => addImageFromDataUrl(r.result as string); r.readAsDataURL(file); };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => { if (editing) return; const items = e.clipboardData?.items; if (!items) return; for (const it of items) { if (it.type.startsWith("image/")) { const f = it.getAsFile(); if (f) { const r = new FileReader(); r.onload = () => addImageFromDataUrl(r.result as string); r.readAsDataURL(f); } } } };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /* ---------------- text edit commit ---------------- */
  const commitEditing = () => { if (!editing) return; const s = shapesRef.current.find((x) => x.id === editing.id); if (s) { if (editing.value.trim() === "") removeShape(s.id); else { s.text = editing.value; upsertShape(s); } } setEditing(null); persist(); bump(); };

  /* ---------------- export ---------------- */
  const exportPNG = () => { const src = canvasRef.current!; const r = src.getBoundingClientRect(); const dpr = dprRef.current; const cam = camRef.current; const off = document.createElement("canvas"); off.width = r.width * dpr; off.height = r.height * dpr; const ctx = off.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = "#0e1116"; ctx.fillRect(0, 0, r.width, r.height); ctx.translate(r.width / 2, r.height / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y); for (const s of shapesRef.current) drawShape(ctx, s); off.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "aperture.png"; a.click(); URL.revokeObjectURL(a.href); }); };
  const exportSVG = () => {
    const ss = shapesRef.current; if (!ss.length) return; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of ss) { const b = bbox(s); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
    const pad = 24; const W = maxX - minX + pad * 2, H = maxY - minY + pad * 2; const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let body = "";
    for (const s of ss) {
      const da = s.dash === "dashed" ? ` stroke-dasharray="${s.width * 3} ${s.width * 2.5}"` : s.dash === "dotted" ? ` stroke-dasharray="1 ${s.width * 2}"` : "";
      const op = s.alpha ?? 1;
      if (s.kind === "stroke" && s.pts) { const pts = s.pts.map((p) => `${(p.x - minX + pad).toFixed(1)},${(p.y - minY + pad).toFixed(1)}`).join(" "); body += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"${da}/>`; }
      else if (s.kind === "shape") { const x0 = s.x0! - minX + pad, y0 = s.y0! - minY + pad, x1 = s.x1! - minX + pad, y1 = s.y1! - minY + pad; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2; const fillA = s.fill ? `fill="${s.color}" fill-opacity="0.32"` : `fill="none"`; if (s.tool === "line" || s.tool === "arrow") body += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" opacity="${op}"${da}/>`; else if (s.tool === "rect") body += `<rect x="${Math.min(x0, x1)}" y="${Math.min(y0, y1)}" width="${Math.abs(x1 - x0)}" height="${Math.abs(y1 - y0)}" ${fillA} stroke="${s.color}" stroke-width="${s.width}" opacity="${op}"${da}/>`; else if (s.tool === "ellipse") body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${fillA} stroke="${s.color}" stroke-width="${s.width}" opacity="${op}"${da}/>`; else { const pts = s.tool === "diamond" ? `${cx},${y0} ${x1},${cy} ${cx},${y1} ${x0},${cy}` : s.tool === "triangle" ? `${cx},${Math.min(y0, y1)} ${x1},${Math.max(y0, y1)} ${x0},${Math.max(y0, y1)}` : ""; if (pts) body += `<polygon points="${pts}" ${fillA} stroke="${s.color}" stroke-width="${s.width}" opacity="${op}"${da}/>`; } }
      else if (s.kind === "text") body += `<text x="${s.x! - minX + pad}" y="${s.y! - minY + pad}" fill="${s.color}" font-family="sans-serif" font-weight="${s.bold ? 800 : 600}" font-size="${14 + (s.fontSize ?? 4) * 3}">${esc(s.text || "")}</text>`;
      else if (s.kind === "note") { body += `<rect x="${s.x! - minX + pad}" y="${s.y! - minY + pad}" width="${s.w}" height="${s.h}" rx="8" fill="${s.color}"/><text x="${s.x! - minX + pad + 12}" y="${s.y! - minY + pad + 26}" fill="#1a1a1a" font-family="sans-serif" font-size="15">${esc((s.text || "").slice(0, 60))}</text>`; }
      else if (s.kind === "image" && s.src) body += `<image x="${s.x! - minX + pad}" y="${s.y! - minY + pad}" width="${s.w}" height="${s.h}" href="${s.src}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#0e1116"/>${body}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "aperture.svg"; a.click(); URL.revokeObjectURL(a.href);
  };
  const saveJSON = () => { const blob = new Blob([JSON.stringify(shapesRef.current)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "aperture-board.json"; a.click(); URL.revokeObjectURL(a.href); };
  const loadRef = useRef<HTMLInputElement>(null);
  const loadJSON = (file: File) => { const rd = new FileReader(); rd.onload = () => { try { const arr = JSON.parse(rd.result as string); if (Array.isArray(arr)) { snapshot(); shapesRef.current = arr; persist(); syncAll(); bump(); } } catch {} }; rd.readAsText(file); };

  const activeColor = editing ? (shapesRef.current.find((s) => s.id === editing.id)?.color || color) : color;
  const hasSel = !!shapesRef.current.find((s) => s.id === selRef.current);

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>◎</span><span className="font-display text-lg">{T.brand}</span></span>
        </div>
        <div className="flex items-center gap-2">
          {/* live presence avatars (real peers) */}
          {status === "live" && (
            <div className="hidden items-center gap-1 sm:flex">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                <span className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white" title={meRef.current.name} style={{ background: meRef.current.color, border: "2px solid var(--bg-2)" }}>{T.you[0]}</span>
                {presence.slice(0, 5).map((p) => <span key={p.id} className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white" title={p.name} style={{ background: p.color, border: "2px solid var(--bg-2)" }}>{p.name[0]}</span>)}
              </div>
            </div>
          )}
          <span className="hidden items-center gap-1.5 text-xs sm:flex text-[var(--fg-2)]"><span className="h-2 w-2 rounded-full" style={{ background: status === "live" ? "#22c55e" : status === "connecting" ? "#eab308" : "#71717a" }} />{status === "live" ? `${presence.length + 1} ${T.online}` : status === "connecting" ? T.connecting : T.solo}</span>
          <button onClick={share} className="btn btn-outline h-9 px-3 py-0 text-xs">{copied ? "✓ " + T.copied : "🔗 " + T.share}</button>
          <ThemePicker /><LangToggle />
        </div>
      </header>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex flex-wrap gap-1">
          {(["select", "pan", "eyedropper"] as Tool[]).map((tl) => <ToolBtn key={tl} tl={tl} tool={tool} setTool={setTool} icon={icon} label={label} />)}
          <span className="mx-0.5 h-9 w-px" style={{ background: "var(--line)" }} />
          {STROKE_TOOLS.map((tl) => <ToolBtn key={tl} tl={tl} tool={tool} setTool={setTool} icon={icon} label={label} />)}
          <ToolBtn tl="eraser" tool={tool} setTool={setTool} icon={icon} label={label} />
          <ToolBtn tl="laser" tool={tool} setTool={setTool} icon={icon} label={label} />
          <span className="mx-0.5 h-9 w-px" style={{ background: "var(--line)" }} />
          {SHAPE_TOOLS.map((tl) => <ToolBtn key={tl} tl={tl} tool={tool} setTool={setTool} icon={icon} label={label} />)}
          <ToolBtn tl="note" tool={tool} setTool={setTool} icon={icon} label={label} />
          <ToolBtn tl="text" tool={tool} setTool={setTool} icon={icon} label={label} />
          <button onClick={() => imgInputRef.current?.click()} title={T.image} className="grid h-9 w-9 place-items-center rounded-lg border text-base" style={{ borderColor: "var(--line-2)" }}>🖼</button>
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); e.currentTarget.value = ""; }} />
        </div>
        <span className="mx-1 h-6 w-px" style={{ background: "var(--line)" }} />
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => <button key={c} onClick={() => setColor(c)} className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110" style={{ background: c, borderColor: color === c ? "var(--fg)" : "var(--line)" }} />)}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
          {recent.map((c) => <button key={c} onClick={() => setColor(c)} className="h-5 w-5 rounded-full border" style={{ background: c, borderColor: "var(--line)" }} />)}
        </div>
        <span className="mx-1 h-6 w-px" style={{ background: "var(--line)" }} />
        <label className="flex items-center gap-1.5 text-xs text-[var(--fg-2)]">{T.size}<input type="range" min={1} max={40} value={width} onChange={(e) => setWidth(+e.target.value)} className="w-20 accent-[var(--accent)]" /></label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--fg-2)]">{T.opacity}<input type="range" min={10} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(+e.target.value / 100)} className="w-16 accent-[var(--accent)]" /></label>
        <select value={dash} onChange={(e) => setDash(e.target.value as Dash)} className="rounded-lg border bg-transparent px-1.5 py-1 text-xs outline-none" style={{ borderColor: "var(--line)" }} title={T.dashS}>
          <option value="solid">──</option><option value="dashed">- -</option><option value="dotted">···</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-[var(--fg-2)]"><input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} className="h-3.5 w-3.5" />{T.fill}</label>
        <label className="flex items-center gap-1 text-xs text-[var(--fg-2)]"><input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} className="h-3.5 w-3.5" />{T.bold}</label>
        <label className="flex items-center gap-1 text-xs text-[var(--fg-2)]">{T.font}<input type="range" min={0} max={12} value={fontSize} onChange={(e) => setFontSize(+e.target.value)} className="w-14 accent-[var(--accent)]" /></label>
        <select value={bg} onChange={(e) => setBg(e.target.value as Bg)} className="rounded-lg border bg-transparent px-1.5 py-1 text-xs outline-none" style={{ borderColor: "var(--line)" }} title={T.grid}>
          <option value="grid">{fa ? "شبکه" : "Grid"}</option><option value="dots">{fa ? "نقطه" : "Dots"}</option><option value="plain">{fa ? "ساده" : "Plain"}</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-[var(--fg-2)]"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="h-3.5 w-3.5" />{T.snap}</label>
        <div className="ms-auto flex items-center gap-1">
          {hasSel && <>
            <button onClick={duplicateSel} className="btn btn-outline h-9 px-2.5 py-0 text-xs" title={T.dup}>⧉</button>
            <button onClick={bringFront} className="btn btn-outline h-9 px-2.5 py-0 text-xs" title={T.front}>⬆</button>
            <button onClick={sendBack} className="btn btn-outline h-9 px-2.5 py-0 text-xs" title={T.back}>⬇</button>
          </>}
          <button onClick={() => zoomBy(1 / 1.2)} className="btn btn-outline h-9 px-2 py-0 text-xs">−</button>
          <button onClick={resetZoom} className="btn btn-outline h-9 px-2 py-0 text-xs" title={T.zoomReset}>{zoomPct}%</button>
          <button onClick={() => zoomBy(1.2)} className="btn btn-outline h-9 px-2 py-0 text-xs">+</button>
          <button onClick={zoomFit} className="btn btn-outline h-9 px-2 py-0 text-xs" title={T.fit}>⤢</button>
          <button onClick={undo} disabled={!undoRef.current.length} className="btn btn-outline h-9 px-2 py-0 text-xs disabled:opacity-40">↶</button>
          <button onClick={redo} disabled={!redoRef.current.length} className="btn btn-outline h-9 px-2 py-0 text-xs disabled:opacity-40">↷</button>
          <button onClick={exportPNG} className="btn btn-outline h-9 px-2 py-0 text-xs">{T.exportPng}</button>
          <button onClick={exportSVG} className="btn btn-outline hidden h-9 px-2 py-0 text-xs sm:inline-flex">{T.exportSvg}</button>
          <button onClick={saveJSON} className="btn btn-outline hidden h-9 px-2 py-0 text-xs sm:inline-flex">↓</button>
          <button onClick={() => loadRef.current?.click()} className="btn btn-outline hidden h-9 px-2 py-0 text-xs sm:inline-flex">↑</button>
          <input ref={loadRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadJSON(f); e.currentTarget.value = ""; }} />
          <button onClick={clearAll} className="btn btn-outline h-9 px-2 py-0 text-xs hover:!border-[#ff6a6a] hover:!text-[#ff6a6a]">✕</button>
        </div>
      </div>

      {/* canvas */}
      <div className="relative min-h-0 flex-1" style={{ background: "var(--bg)" }}>
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onWheel={onWheel} className="absolute inset-0 h-full w-full touch-none" style={{ cursor: tool === "pan" || spaceRef.current ? "grab" : tool === "select" ? "default" : tool === "eraser" ? "cell" : tool === "eyedropper" ? "copy" : "crosshair" }} />
        {editing && (
          <textarea autoFocus value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} onBlur={commitEditing} onKeyDown={(e) => { if (e.key === "Enter" && editing.kind === "text" && !e.shiftKey) { e.preventDefault(); commitEditing(); } if (e.key === "Escape") commitEditing(); }} className="absolute z-30 resize-none rounded-lg p-2 text-sm outline-none" style={{ left: editing.sx, top: editing.sy, width: editing.kind === "note" ? 190 : 220, height: editing.kind === "note" ? 130 : 44, background: editing.kind === "note" ? (activeColor === "#ffffff" ? "#fde68a" : activeColor) : "var(--bg-2)", color: editing.kind === "note" ? "#1a1a1a" : activeColor, border: "2px solid var(--accent)", boxShadow: "0 10px 30px -10px var(--shadow)" }} placeholder={T.writeHere} />
        )}
        <div className="pointer-events-none absolute bottom-3 start-3 rounded-full px-3 py-1 text-xs text-[var(--fg-2)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>{shapesRef.current.length} {T.shapes}</div>
      </div>
    </div>
  );
}

function ToolBtn({ tl, tool, setTool, icon, label }: { tl: Tool; tool: Tool; setTool: (t: Tool) => void; icon: Record<string, string>; label: Record<string, string> }) {
  return <button onClick={() => setTool(tl)} title={label[tl]} className="grid h-9 w-9 place-items-center rounded-lg border text-base transition-colors" style={{ borderColor: tool === tl ? "var(--accent)" : "var(--line-2)", background: tool === tl ? "var(--accent)" : "transparent", color: tool === tl ? "var(--on-accent)" : "var(--fg)" }}>{icon[tl]}</button>;
}
