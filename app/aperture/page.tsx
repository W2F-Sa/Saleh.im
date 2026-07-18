"use client";

/*
  Aperture — a real, collaborative whiteboard (not a demo).

  Collaboration: genuine WebRTC peer-to-peer (PeerJS) in a host-relayed star.
  Share opens a room; anyone who opens the link joins live. Strokes, shapes,
  notes, images, moves, z-order and clears all sync, plus real remote cursors,
  a live presence list and a synced laser pointer. No fake collaborators.

  Editing: pen/marker/highlighter/neon/spray, object eraser and laser; line,
  arrow, elbow connector, rectangle, ellipse, diamond, triangle, star, polygon,
  hexagon, parallelogram, cloud and cylinder; sticky notes, text and images.

  Power features: true multi-selection (marquee + shift-click), a properties
  inspector, a reorderable layers panel with lock/hide, a live minimap, align
  & distribute, grouping, rotation, starter templates, a shortcut cheatsheet, a
  right-click context menu, snap-to-grid, copy/paste, duplicate, undo/redo,
  zoom/fit, PNG + SVG export, JSON save/load and full bilingual + themed UI.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";
import type { Tool, Dash, Bg, Shape, Cursor, Peer, Box, Point } from "./types";
import {
  GRID, STORE, PREFS, PALETTE, NOTE_COLORS, STROKE_TOOLS, CLOSED_SHAPES, NAMES, CURSOR_COLORS, SHORTCUTS, STAMPS,
  uid, bbox, shapeCenter, translate, setShapeBox, hitTest, marqueeHit, unionBox, alignShapes, distributeShapes,
  drawShape, TEMPLATES, STENCILS, handlePoints, hitHandle, resizeBox, computeSnap, tidyGrid, flipShape, matchDimension,
  type AlignMode, type Handle,
} from "./lib";
import { listBoards, saveBoardSnapshot, renameBoard, deleteBoard, getBoard } from "./boards";
import { listPresets, addPreset, removePreset, type StylePreset } from "./presets";
import type { SavedBoard, BoardPrefs } from "./types";
import { InspectorPanel, LayersPanel, FindPanel, Minimap, TemplatesModal, ShortcutsModal, ContextMenu, BoardsModal, StampPicker, PresetsBar, PrefsModal, StatusBar, type MenuItem } from "./panels";

const DEFAULT_PREFS: BoardPrefs = { exportBg: "#0e1116", defaultFont: 4, autoFit: false, showCoords: true };

const PRIMARY_SHAPES: Tool[] = ["line", "arrow", "connector", "rect", "ellipse", "diamond", "triangle", "star"];
const EXTRA_SHAPES: Tool[] = ["polygon", "hexagon", "parallelogram", "cloud", "cylinder", "frame"];

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
  const [editing, setEditing] = useState<{ id: string; sx: number; sy: number; value: string; kind: "note" | "text" | "comment" } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<"inspector" | "layers" | "find">("inspector");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [shapesMenu, setShapesMenu] = useState(false);
  const [stampMenu, setStampMenu] = useState(false);
  const [activeStamp, setActiveStamp] = useState(STAMPS[0]);
  const [showBoards, setShowBoards] = useState(false);
  const [boards, setBoards] = useState<SavedBoard[]>([]);
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [showRuler, setShowRuler] = useState(false);
  const [present, setPresent] = useState(false);
  const [presentIdx, setPresentIdx] = useState(0);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<BoardPrefs>(DEFAULT_PREFS);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [swatches, setSwatches] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const currentBoardRef = useRef<string | null>(null);
  const stampRef = useRef(activeStamp); stampRef.current = activeStamp;
  const rulerRef = useRef(showRuler); rulerRef.current = showRuler;
  const presentRef = useRef(present); presentRef.current = present;
  const presentIdxRef = useRef(presentIdx); presentIdxRef.current = presentIdx;
  const measureRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const prefsRef = useRef(prefs); prefsRef.current = prefs;
  const lastCursorUi = useRef(0);

  // canvas state in refs → smooth rAF, no re-render churn
  const shapesRef = useRef<Shape[]>([]);
  const undoRef = useRef<Shape[][]>([]);
  const redoRef = useRef<Shape[][]>([]);
  const draftRef = useRef<Shape | null>(null);
  const selRef = useRef<Set<string>>(new Set());
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const resizeRef = useRef<{ handle: Handle; start: Box; shapeId: string; center: Point } | null>(null);
  const guidesRef = useRef<{ vx: number | null; hy: number | null } | null>(null);
  const clipRef = useRef<Shape[]>([]);
  const camRef = useRef({ x: 0, y: 0, zoom: 1 });
  const panRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const spaceRef = useRef(false);
  const shiftRef = useRef(false);
  const lastSnap = useRef(0);
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
    ? { brand: "آپرچر", select: "انتخاب", pan: "جابه‌جایی", eyedropper: "قطره‌چکان", pen: "قلم", marker: "ماژیک", highlighter: "هایلایتر", neon: "نئون", spray: "اسپری", eraser: "پاک‌کن", laser: "لیزر", line: "خط", arrow: "پیکان", connector: "اتصال", rect: "مستطیل", ellipse: "بیضی", diamond: "لوزی", triangle: "مثلث", star: "ستاره", polygon: "چندضلعی", hexagon: "شش‌ضلعی", parallelogram: "متوازی‌الاضلاع", cloud: "ابر", cylinder: "استوانه", note: "یادداشت", text: "متن", image: "تصویر", undo: "واگرد", redo: "ازنو", clear: "پاک‌کردن همه", exportPng: "PNG", exportSvg: "SVG", save: "ذخیره", load: "بازکردن", share: "اشتراکِ اتاق", copied: "لینک کپی شد!", solo: "تنها", connecting: "در حال اتصال…", live: "زنده", size: "ضخامت", opacity: "شفافیت", grid: "پس‌زمینه", confirmClear: "کلِ بوم پاک شود؟", shapes: "شکل", writeHere: "بنویس…", online: "آنلاین", zoomReset: "بازنشانی", fill: "پُر", dashS: "خط‌چین", bold: "درشت", font: "اندازه", snap: "چفت به شبکه", dup: "تکثیر", front: "به جلو", back: "به عقب", fit: "جای‌دهی", you: "تو", panel: "پنل", inspector: "ویژگی‌ها", layers: "لایه‌ها", templates: "الگوها", shortcuts: "میان‌برها", moreShapes: "شکل‌های بیشتر", map: "نقشه", selectAll: "انتخاب همه", deselect: "لغو انتخاب" }
    : { brand: "Aperture", select: "Select", pan: "Pan", eyedropper: "Eyedropper", pen: "Pen", marker: "Marker", highlighter: "Highlighter", neon: "Neon", spray: "Spray", eraser: "Eraser", laser: "Laser", line: "Line", arrow: "Arrow", connector: "Connector", rect: "Rectangle", ellipse: "Ellipse", diamond: "Diamond", triangle: "Triangle", star: "Star", polygon: "Polygon", hexagon: "Hexagon", parallelogram: "Parallelogram", cloud: "Cloud", cylinder: "Cylinder", note: "Note", text: "Text", image: "Image", undo: "Undo", redo: "Redo", clear: "Clear all", exportPng: "PNG", exportSvg: "SVG", save: "Save", load: "Load", share: "Share room", copied: "Link copied!", solo: "Solo", connecting: "Connecting…", live: "Live", size: "Width", opacity: "Opacity", grid: "Background", confirmClear: "Clear the whole board?", shapes: "shapes", writeHere: "Type…", online: "online", zoomReset: "Reset", fill: "Fill", dashS: "Dash", bold: "Bold", font: "Size", snap: "Snap", dup: "Duplicate", front: "To front", back: "To back", fit: "Fit", you: "You", panel: "Panel", inspector: "Properties", layers: "Layers", templates: "Templates", shortcuts: "Shortcuts", moreShapes: "More shapes", map: "Map", selectAll: "Select all", deselect: "Deselect" };

  const measureLabel = fa ? "خط‌کش اندازه" : "Measure";
  const label: Record<string, string> = { measure: measureLabel, select: T.select, pan: T.pan, eyedropper: T.eyedropper, pen: T.pen, marker: T.marker, highlighter: T.highlighter, neon: T.neon, spray: T.spray, eraser: T.eraser, laser: T.laser, line: T.line, arrow: T.arrow, connector: T.connector, rect: T.rect, ellipse: T.ellipse, diamond: T.diamond, triangle: T.triangle, star: T.star, polygon: T.polygon, hexagon: T.hexagon, parallelogram: T.parallelogram, cloud: T.cloud, cylinder: T.cylinder, frame: fa ? "فریم" : "Frame", note: T.note, text: T.text, image: T.image, stamp: fa ? "استیکر" : "Stamp", comment: fa ? "کامنت" : "Comment" };
  const icon: Record<string, string> = { measure: "📐", select: "⬚", pan: "✋", eyedropper: "💧", pen: "✎", marker: "🖊", highlighter: "▬", neon: "⚡", spray: "░", eraser: "⌫", laser: "🔴", line: "╱", arrow: "↗", connector: "⌐", rect: "▭", ellipse: "◯", diamond: "◆", triangle: "△", star: "★", polygon: "⬠", hexagon: "⬡", parallelogram: "▱", cloud: "☁", cylinder: "⛁", frame: "🖼️", note: "▤", text: "T", image: "🖼", stamp: "😀", comment: "💬" };

  const bump = () => setVersion((v) => v + 1);
  const pushColor = (c: string) => setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 8));
  const snapv = (v: number) => (snapRef.current ? Math.round(v / GRID) * GRID : v);
  const getImg = useCallback((src: string) => { let im = imgCache.current[src]; if (!im) { im = new Image(); im.src = src; imgCache.current[src] = im; } return im; }, []);
  const selectedShapes = useCallback(() => shapesRef.current.filter((s) => selRef.current.has(s.id)), []);

  /* ---------------- persistence ---------------- */
  useEffect(() => {
    try { const raw = localStorage.getItem(STORE) || localStorage.getItem("aperture:board:v1"); if (raw) shapesRef.current = JSON.parse(raw); } catch {}
    bump();
  }, []);
  const persist = useCallback(() => { try { localStorage.setItem(STORE, JSON.stringify(shapesRef.current.slice(-3000))); } catch {} }, []);

  /* ---------------- preferences ---------------- */
  useEffect(() => {
    try { const raw = localStorage.getItem(PREFS); if (raw) { const p = { ...DEFAULT_PREFS, ...JSON.parse(raw) }; setPrefs(p); setFontSize(p.defaultFont); if (p.autoFit) setTimeout(() => zoomFit(), 60); } } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const updatePrefs = (patch: Partial<BoardPrefs>) => setPrefs((p) => { const next = { ...p, ...patch }; try { localStorage.setItem(PREFS, JSON.stringify(next)); } catch {} if (patch.defaultFont != null) setFontSize(patch.defaultFont); return next; });

  /* ---------------- custom swatches ---------------- */
  useEffect(() => { try { const raw = localStorage.getItem("aperture:swatches"); if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) setSwatches(a); } } catch {} }, []);
  const saveSwatches = (next: string[]) => { setSwatches(next); try { localStorage.setItem("aperture:swatches", JSON.stringify(next)); } catch {} };
  const addSwatch = () => { if (swatches.includes(color)) return; saveSwatches([color, ...swatches].slice(0, 12)); };
  const removeSwatch = (c: string) => saveSwatches(swatches.filter((x) => x !== c));

  /* ---------------- history ---------------- */
  const snapshot = () => { undoRef.current.push(structuredClone(shapesRef.current)); if (undoRef.current.length > 120) undoRef.current.shift(); redoRef.current = []; };
  const snapshotThrottled = () => { const now = Date.now(); if (now - lastSnap.current > 350) { snapshot(); lastSnap.current = now; } };
  const syncAll = () => broadcast({ type: "sync", shapes: shapesRef.current });
  const undo = () => { if (!undoRef.current.length) return; redoRef.current.push(structuredClone(shapesRef.current)); shapesRef.current = undoRef.current.pop()!; selRef.current = new Set(); persist(); syncAll(); bump(); };
  const redo = () => { if (!redoRef.current.length) return; undoRef.current.push(structuredClone(shapesRef.current)); shapesRef.current = redoRef.current.pop()!; persist(); syncAll(); bump(); };
  const clearAll = () => { if (!shapesRef.current.length || !window.confirm(T.confirmClear)) return; snapshot(); shapesRef.current = []; selRef.current = new Set(); persist(); syncAll(); bump(); };

  /* ---------------- collaboration ---------------- */
  const broadcast = (msg: any, exclude?: any) => { const data = JSON.stringify(msg); for (const c of connsRef.current) { if (c === exclude) continue; try { if (c.open) c.send(data); } catch {} } };
  const upsertShape = (s: Shape, fromRemote = false) => { const i = shapesRef.current.findIndex((x) => x.id === s.id); if (i >= 0) shapesRef.current[i] = s; else shapesRef.current.push(s); if (!fromRemote) { persist(); broadcast({ type: "upsert", shape: s }); } };
  const removeShape = (id: string, fromRemote = false) => { shapesRef.current = shapesRef.current.filter((x) => x.id !== id); selRef.current.delete(id); if (!fromRemote) { persist(); broadcast({ type: "remove", id }); } };

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

  /* ---------------- selection ---------------- */
  const groupMembers = (id: string): string[] => {
    const s = shapesRef.current.find((x) => x.id === id);
    if (!s || !s.groupId) return [id];
    return shapesRef.current.filter((x) => x.groupId === s.groupId).map((x) => x.id);
  };
  const selectShape = (id: string, additive: boolean) => {
    const members = groupMembers(id);
    if (additive) { const cur = selRef.current; const allIn = members.every((m) => cur.has(m)); members.forEach((m) => (allIn ? cur.delete(m) : cur.add(m))); }
    else selRef.current = new Set(members);
    bump();
  };
  const clearSel = () => { if (selRef.current.size) { selRef.current = new Set(); bump(); } };
  const selectAll = () => { selRef.current = new Set(shapesRef.current.filter((s) => !s.hidden && !s.locked).map((s) => s.id)); bump(); };

  /* ---------------- geometry helpers ---------------- */
  const hit = (px: number, py: number) => hitTest(shapesRef.current, px, py);

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
      const b = bgRef.current;
      if (b === "grid" || b === "lines") { ctx.strokeStyle = "rgba(128,128,128,0.16)"; ctx.lineWidth = 1 / cam.zoom; for (let x = Math.floor(vx0 / GRID) * GRID; x < vx1; x += GRID) { ctx.beginPath(); ctx.moveTo(x, vy0); ctx.lineTo(x, vy1); ctx.stroke(); } if (b === "grid") for (let y = Math.floor(vy0 / GRID) * GRID; y < vy1; y += GRID) { ctx.beginPath(); ctx.moveTo(vx0, y); ctx.lineTo(vx1, y); ctx.stroke(); } }
      else if (b === "dots") { ctx.fillStyle = "rgba(128,128,128,0.28)"; for (let x = Math.floor(vx0 / GRID) * GRID; x < vx1; x += GRID) for (let y = Math.floor(vy0 / GRID) * GRID; y < vy1; y += GRID) { ctx.beginPath(); ctx.arc(x, y, 1.3 / cam.zoom, 0, Math.PI * 2); ctx.fill(); } }
      else if (b === "iso") { ctx.strokeStyle = "rgba(128,128,128,0.13)"; ctx.lineWidth = 1 / cam.zoom; const step = GRID; for (let x = Math.floor(vx0 / step) * step - (vy1 - vy0); x < vx1 + (vy1 - vy0); x += step) { ctx.beginPath(); ctx.moveTo(x, vy0); ctx.lineTo(x + (vy1 - vy0), vy1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, vy0); ctx.lineTo(x - (vy1 - vy0), vy1); ctx.stroke(); } }
      for (const s of shapesRef.current) drawShape(ctx, s, getImg);
      if (draftRef.current) drawShape(ctx, draftRef.current, getImg);
      // presentation spotlight — dim everything outside the current frame
      if (presentRef.current) { const frames = shapesRef.current.filter((s) => s.tool === "frame"); const f = frames[presentIdxRef.current % (frames.length || 1)]; if (f) { const fb = bbox(f); ctx.save(); ctx.fillStyle = "rgba(6,8,12,0.62)"; ctx.beginPath(); ctx.rect(vx0 - 10, vy0 - 10, (vx1 - vx0) + 20, (vy1 - vy0) + 20); ctx.rect(fb.x, fb.y, fb.w, fb.h); ctx.fill("evenodd"); ctx.restore(); } }
      // selection outlines
      for (const s of shapesRef.current) {
        if (!selRef.current.has(s.id)) continue;
        const bb = bbox(s); ctx.save();
        if (s.rotation) { const c = shapeCenter(s); ctx.translate(c.x, c.y); ctx.rotate(s.rotation); ctx.translate(-c.x, -c.y); }
        ctx.strokeStyle = "#3b82f6"; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5 / cam.zoom; ctx.strokeRect(bb.x - 6, bb.y - 6, bb.w + 12, bb.h + 12); ctx.setLineDash([]); ctx.restore();
      }
      // transform handles for a single, unrotated selection
      if (selRef.current.size === 1) {
        const s = shapesRef.current.find((x) => selRef.current.has(x.id));
        if (s && !s.rotation && !s.locked && s.kind !== "stroke") {
          const bb = bbox(s); const ro = 26 / cam.zoom; const hs = 4.5 / cam.zoom;
          const pts = handlePoints(bb, ro);
          ctx.save(); ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1 / cam.zoom;
          ctx.beginPath(); ctx.moveTo(pts.n.x, pts.n.y); ctx.lineTo(pts.rotate.x, pts.rotate.y); ctx.stroke();
          ctx.fillStyle = "#ffffff";
          (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as Handle[]).forEach((k) => { const p = pts[k]; ctx.beginPath(); ctx.rect(p.x - hs, p.y - hs, hs * 2, hs * 2); ctx.fill(); ctx.stroke(); });
          ctx.beginPath(); ctx.arc(pts.rotate.x, pts.rotate.y, hs * 1.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }
      // measure overlay
      if (measureRef.current) { const m = measureRef.current; const dist = Math.hypot(m.x1 - m.x0, m.y1 - m.y0); const ang = (Math.atan2(m.y1 - m.y0, m.x1 - m.x0) * 180 / Math.PI).toFixed(1); ctx.save(); ctx.strokeStyle = "#f59e0b"; ctx.fillStyle = "#f59e0b"; ctx.lineWidth = 1.5 / cam.zoom; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(m.x0, m.y0); ctx.lineTo(m.x1, m.y1); ctx.stroke(); ctx.setLineDash([]); [[m.x0, m.y0], [m.x1, m.y1]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3 / cam.zoom, 0, Math.PI * 2); ctx.fill(); }); const mx = (m.x0 + m.x1) / 2, my = (m.y0 + m.y1) / 2; const txt = `${Math.round(dist)} px · ${ang}°`; ctx.font = `${12 / cam.zoom}px ui-sans-serif`; const tw = ctx.measureText(txt).width; ctx.fillStyle = "rgba(20,22,28,0.9)"; ctx.fillRect(mx - tw / 2 - 4 / cam.zoom, my - 18 / cam.zoom, tw + 8 / cam.zoom, 16 / cam.zoom); ctx.fillStyle = "#fbbf24"; ctx.fillText(txt, mx - tw / 2, my - 6 / cam.zoom); ctx.restore(); }
      // smart alignment guides
      if (guidesRef.current) { const g = guidesRef.current; ctx.save(); ctx.strokeStyle = "#ec4899"; ctx.lineWidth = 1 / cam.zoom; ctx.setLineDash([4, 4]); if (g.vx != null) { ctx.beginPath(); ctx.moveTo(g.vx, vy0); ctx.lineTo(g.vx, vy1); ctx.stroke(); } if (g.hy != null) { ctx.beginPath(); ctx.moveTo(vx0, g.hy); ctx.lineTo(vx1, g.hy); ctx.stroke(); } ctx.restore(); }
      // marquee
      if (marqueeRef.current) { const m = marqueeRef.current; const x = Math.min(m.x0, m.x1), y = Math.min(m.y0, m.y1), w = Math.abs(m.x1 - m.x0), h = Math.abs(m.y1 - m.y0); ctx.save(); ctx.fillStyle = "rgba(59,130,246,0.10)"; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1 / cam.zoom; ctx.setLineDash([5, 3]); ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); ctx.restore(); }
      // laser trails (fade over 700ms)
      const now = Date.now();
      for (const id in laserRef.current) { const pts = laserRef.current[id] = laserRef.current[id].filter((p) => now - p.t < 700); for (const p of pts) { const a = 1 - (now - p.t) / 700; ctx.globalAlpha = a; ctx.fillStyle = "#ff2d55"; ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 12 / cam.zoom; ctx.beginPath(); ctx.arc(p.x, p.y, 5 / cam.zoom, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
      // remote cursors
      for (const id in remoteCursorsRef.current) { const c = remoteCursorsRef.current[id]; if (now - c.t > 5000) { delete remoteCursorsRef.current[id]; continue; } ctx.save(); ctx.fillStyle = c.color; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y + 18 / cam.zoom); ctx.lineTo(c.x + 6 / cam.zoom, c.y + 13 / cam.zoom); ctx.lineTo(c.x + 13 / cam.zoom, c.y + 12 / cam.zoom); ctx.closePath(); ctx.fill(); ctx.font = `${12 / cam.zoom}px ui-sans-serif`; const tw = ctx.measureText(c.name).width; ctx.fillRect(c.x + 12 / cam.zoom, c.y + 12 / cam.zoom, tw + 12 / cam.zoom, 16 / cam.zoom); ctx.fillStyle = "#fff"; ctx.fillText(c.name, c.x + 18 / cam.zoom, c.y + 24 / cam.zoom); ctx.restore(); }
      ctx.restore();
      // rulers (screen space)
      if (rulerRef.current) {
        const RB = 18; ctx.fillStyle = "rgba(20,22,28,0.9)"; ctx.fillRect(0, 0, r.width, RB); ctx.fillRect(0, 0, RB, r.height);
        ctx.fillStyle = "rgba(160,170,190,0.85)"; ctx.font = "9px ui-monospace, monospace"; ctx.strokeStyle = "rgba(160,170,190,0.35)"; ctx.lineWidth = 1;
        const stepW = GRID * cam.zoom; const startX = (r.width / 2 - cam.x * cam.zoom) % stepW;
        for (let x = startX; x < r.width; x += stepW) { const world = Math.round((x - r.width / 2) / cam.zoom + cam.x); ctx.beginPath(); ctx.moveTo(x, RB - 5); ctx.lineTo(x, RB); ctx.stroke(); if (Math.round(world / GRID) % 5 === 0) ctx.fillText(String(world), x + 2, 10); }
        const startY = (r.height / 2 - cam.y * cam.zoom) % stepW;
        for (let y = startY; y < r.height; y += stepW) { const world = Math.round((y - r.height / 2) / cam.zoom + cam.y); ctx.beginPath(); ctx.moveTo(RB - 5, y); ctx.lineTo(RB, y); ctx.stroke(); if (Math.round(world / GRID) % 5 === 0) { ctx.save(); ctx.translate(9, y - 2); ctx.rotate(-Math.PI / 2); ctx.fillText(String(world), 0, 0); ctx.restore(); } }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- input ---------------- */
  const toWorld = (e: { clientX: number; clientY: number }) => { const r = canvasRef.current!.getBoundingClientRect(); const cam = camRef.current; return { x: (e.clientX - r.left - r.width / 2) / cam.zoom + cam.x, y: (e.clientY - r.top - r.height / 2) / cam.zoom + cam.y }; };
  const sendCursor = (w: { x: number; y: number }) => { const now = Date.now(); if (now - lastCursorSent.current < 45 || !connsRef.current.length) return; lastCursorSent.current = now; broadcast({ type: "cursor", id: meRef.current.id, x: w.x, y: w.y, name: meRef.current.name, color: meRef.current.color }); };
  const styleOf = (): Partial<Shape> => ({ color: colorRef.current, width: widthRef.current, alpha: opacityRef.current, dash: dashRef.current, fill: fillRef.current, fillColor: colorRef.current, fillAlpha: 0.32, by: meRef.current.color });

  const commitDraft = () => { const d = draftRef.current; draftRef.current = null; if (!d) return; if (d.kind === "shape" && d.tool !== "polygon" && Math.hypot(d.x1! - d.x0!, d.y1! - d.y0!) < 3) return; snapshot(); if (d.tool === "frame") d.text = d.text || (fa ? "فریم" : "Frame"); upsertShape(d); if (d.tool === "frame") { shapesRef.current = [d, ...shapesRef.current.filter((s) => s.id !== d.id)]; broadcast({ type: "reorder", order: shapesRef.current.map((s) => s.id) }); persist(); } bump(); };

  const onDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // right-click handled by context menu
    setMenu(null); setShapesMenu(false); setStampMenu(false);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const t = toolRef.current; const scr = { sx: e.clientX, sy: e.clientY }; const raw = toWorld(e); const w = { x: snapv(raw.x), y: snapv(raw.y) };
    if (t === "pan" || spaceRef.current || e.button === 1) { panRef.current = { sx: e.clientX, sy: e.clientY, cx: camRef.current.x, cy: camRef.current.y }; return; }
    if (t === "eyedropper") { const h = hit(raw.x, raw.y); if (h) { setColor(h.color); } setTool("pen"); return; }
    if (t === "measure") { measureRef.current = { x0: raw.x, y0: raw.y, x1: raw.x, y1: raw.y }; return; }
    if (t === "laser") { (laserRef.current[meRef.current.id] = laserRef.current[meRef.current.id] || []).push({ x: raw.x, y: raw.y, t: Date.now() }); broadcast({ type: "laser", id: meRef.current.id, x: raw.x, y: raw.y }); dragRef.current = { x: raw.x, y: raw.y, moved: true }; return; }
    if (t === "select") {
      // grab a transform handle on a single unrotated selection first
      if (selRef.current.size === 1) {
        const s = shapesRef.current.find((x) => selRef.current.has(x.id));
        if (s && !s.rotation && !s.locked && s.kind !== "stroke") {
          const bb = bbox(s); const ro = 26 / camRef.current.zoom; const tol = 9 / camRef.current.zoom;
          const hnd = hitHandle(bb, raw.x, raw.y, tol, ro);
          if (hnd) { snapshot(); resizeRef.current = { handle: hnd, start: bb, shapeId: s.id, center: { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 } }; return; }
        }
      }
      const h = hit(raw.x, raw.y);
      if (h) {
        if (shiftRef.current) selectShape(h.id, true);
        else if (!selRef.current.has(h.id)) selectShape(h.id, false);
        if (selRef.current.size) { snapshot(); dragRef.current = { x: raw.x, y: raw.y, moved: false }; }
      } else {
        if (!shiftRef.current) clearSel();
        marqueeRef.current = { x0: raw.x, y0: raw.y, x1: raw.x, y1: raw.y };
      }
      bump(); return;
    }
    if (t === "eraser") { snapshot(); const h = hit(raw.x, raw.y); if (h) removeShape(h.id); dragRef.current = { x: raw.x, y: raw.y, moved: true }; bump(); return; }
    if (t === "note") { snapshot(); const s: Shape = { id: uid(), kind: "note", tool: "note", color: colorRef.current === "#ffffff" ? "#fde68a" : colorRef.current, width: 1, bold: boldRef.current, fontSize: fontRef.current, x: w.x, y: w.y, w: 190, h: 130, text: "", by: meRef.current.color }; upsertShape(s); setEditing({ id: s.id, sx: scr.sx, sy: scr.sy, value: "", kind: "note" }); pushColor(colorRef.current); bump(); return; }
    if (t === "text") { snapshot(); const s: Shape = { id: uid(), kind: "text", tool: "text", color: colorRef.current, width: widthRef.current, bold: boldRef.current, fontSize: fontRef.current, x: w.x, y: w.y, text: "", by: meRef.current.color }; upsertShape(s); setEditing({ id: s.id, sx: scr.sx, sy: scr.sy, value: "", kind: "text" }); pushColor(colorRef.current); bump(); return; }
    if (t === "comment") { snapshot(); const s: Shape = { id: uid(), kind: "comment", tool: "comment", color: meRef.current.color, width: 1, x: w.x, y: w.y, text: "", by: meRef.current.color }; upsertShape(s); setEditing({ id: s.id, sx: scr.sx, sy: scr.sy, value: "", kind: "comment" }); bump(); return; }
    if (t === "stamp") { snapshot(); const s: Shape = { id: uid(), kind: "text", tool: "text", color: colorRef.current, width: 2, fontSize: 12, x: w.x, y: w.y, text: stampRef.current, by: meRef.current.color }; upsertShape(s); selRef.current = new Set([s.id]); bump(); return; }
    if (STROKE_TOOLS.includes(t)) { const alpha = (t === "highlighter" ? 0.35 : t === "marker" ? 0.92 : 1) * opacityRef.current; const wMul = t === "highlighter" ? 3.2 : t === "marker" ? 1.7 : 1; draftRef.current = { id: uid(), kind: "stroke", tool: t, color: colorRef.current, width: widthRef.current * wMul, alpha, pts: [{ x: raw.x, y: raw.y }], by: meRef.current.color }; pushColor(colorRef.current); return; }
    draftRef.current = { id: uid(), kind: "shape", tool: t, ...styleOf(), x0: w.x, y0: w.y, x1: w.x, y1: w.y, ...(t === "polygon" ? { sides: 6 } : {}) } as Shape; pushColor(colorRef.current);
  };

  const onMove = (e: React.PointerEvent) => {
    const raw = toWorld(e); sendCursor(raw);
    { const now = Date.now(); if (now - lastCursorUi.current > 80) { lastCursorUi.current = now; setCursorPos(raw); } }
    if (measureRef.current) { measureRef.current.x1 = raw.x; measureRef.current.y1 = raw.y; return; }
    if (panRef.current) { const cam = camRef.current; cam.x = panRef.current.cx - (e.clientX - panRef.current.sx) / cam.zoom; cam.y = panRef.current.cy - (e.clientY - panRef.current.sy) / cam.zoom; return; }
    if (resizeRef.current) {
      const rr = resizeRef.current; const s = shapesRef.current.find((x) => x.id === rr.shapeId);
      if (s) {
        if (rr.handle === "rotate") { let ang = Math.atan2(raw.y - rr.center.y, raw.x - rr.center.x) + Math.PI / 2; if (shiftRef.current) ang = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12); s.rotation = ang; }
        else setShapeBox(s, resizeBox(rr.start, rr.handle, snapv(raw.x), snapv(raw.y), shiftRef.current));
        bump();
      }
      return;
    }
    if (marqueeRef.current) { marqueeRef.current.x1 = raw.x; marqueeRef.current.y1 = raw.y; return; }
    if (toolRef.current === "laser" && dragRef.current) { (laserRef.current[meRef.current.id] = laserRef.current[meRef.current.id] || []).push({ x: raw.x, y: raw.y, t: Date.now() }); broadcast({ type: "laser", id: meRef.current.id, x: raw.x, y: raw.y }); return; }
    if (dragRef.current) {
      if (toolRef.current === "eraser") { const h = hit(raw.x, raw.y); if (h) { removeShape(h.id); bump(); } return; }
      const dx = snapv(raw.x) - dragRef.current.x, dy = snapv(raw.y) - dragRef.current.y;
      const sel = selectedShapes();
      for (const s of sel) if (!s.locked) translate(s, dx, dy);
      // smart alignment guides (only when grid-snap is off)
      if (!snapRef.current && sel.length) {
        const u = unionBox(sel);
        if (u) { const others = shapesRef.current.filter((s) => !selRef.current.has(s.id) && !s.hidden); const g = computeSnap(u, others, 6 / camRef.current.zoom); if (g.dx || g.dy) for (const s of sel) if (!s.locked) translate(s, g.dx, g.dy); guidesRef.current = { vx: g.vx, hy: g.hy }; }
      } else guidesRef.current = null;
      dragRef.current = { x: snapv(raw.x), y: snapv(raw.y), moved: true }; return;
    }
    const d = draftRef.current; if (!d) return;
    if (d.kind === "stroke") { if (d.tool === "spray") { const now = performance.now(); if (now - sprayTimer.current > 12) { sprayTimer.current = now; for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, rr = Math.random() * d.width * 2.2; d.pts!.push({ x: raw.x + Math.cos(a) * rr, y: raw.y + Math.sin(a) * rr }); } } } else d.pts!.push({ x: raw.x, y: raw.y }); }
    else { let nx = snapv(raw.x), ny = snapv(raw.y); if (shiftRef.current) { if (CLOSED_SHAPES.includes(d.tool)) { const side = Math.max(Math.abs(nx - d.x0!), Math.abs(ny - d.y0!)); nx = d.x0! + Math.sign(nx - d.x0!) * side; ny = d.y0! + Math.sign(ny - d.y0!) * side; } else { const dx = nx - d.x0!, dy = ny - d.y0!; const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); const len = Math.hypot(dx, dy); nx = d.x0! + Math.cos(ang) * len; ny = d.y0! + Math.sin(ang) * len; } } d.x1 = nx; d.y1 = ny; }
  };

  const onUp = () => {
    if (measureRef.current) { measureRef.current = null; bump(); return; }
    if (panRef.current) { panRef.current = null; return; }
    if (resizeRef.current) { const s = shapesRef.current.find((x) => x.id === resizeRef.current!.shapeId); if (s) upsertShape(s); resizeRef.current = null; persist(); bump(); return; }
    guidesRef.current = null;
    if (marqueeRef.current) { const m = marqueeRef.current; marqueeRef.current = null; const box: Box = { x: m.x0, y: m.y0, w: m.x1 - m.x0, h: m.y1 - m.y0 }; const inside = marqueeHit(shapesRef.current, box); if (Math.abs(box.w) > 4 || Math.abs(box.h) > 4) { if (shiftRef.current) inside.forEach((s) => selRef.current.add(s.id)); else selRef.current = new Set(inside.map((s) => s.id)); } bump(); return; }
    if (toolRef.current === "laser") { dragRef.current = null; return; }
    if (dragRef.current) { if (!dragRef.current.moved && toolRef.current === "select") undoRef.current.pop(); else if (dragRef.current.moved) { for (const s of selectedShapes()) upsertShape(s); } dragRef.current = null; persist(); bump(); return; }
    commitDraft(); persist();
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const raw = toWorld(e); const h = hit(raw.x, raw.y);
    if (h && !selRef.current.has(h.id)) selectShape(h.id, false);
    const hasSelNow = h || selRef.current.size;
    const items: MenuItem[] = [];
    if (hasSelNow) {
      items.push({ label: T.dup, icon: "⧉", onClick: duplicateSel });
      items.push({ label: fa ? "کپی" : "Copy", icon: "⌘C", onClick: copySel });
      items.push({ label: T.front, icon: "⤒", onClick: bringFront });
      items.push({ label: T.back, icon: "⤓", onClick: sendBack });
      items.push({ sep: true, label: "", onClick: () => {} });
      items.push({ label: fa ? "انتخاب هم‌نوع" : "Select same type", icon: "⧉", onClick: () => selectSame("kind") });
      items.push({ label: fa ? "انتخاب هم‌رنگ" : "Select same colour", icon: "🎨", onClick: () => selectSame("color") });
      items.push({ label: fa ? "انتخاب معکوس" : "Invert selection", icon: "⇄", onClick: () => { const cur = selRef.current; selRef.current = new Set(shapesRef.current.filter((s) => !s.hidden && !cur.has(s.id)).map((s) => s.id)); bump(); } });
      items.push({ label: fa ? "قفل/باز" : "Lock / unlock", icon: "🔒", onClick: () => onPatch({ locked: !selectedShapes()[0]?.locked }) });
      items.push({ label: fa ? "خروجی PNG انتخاب" : "Export selection PNG", icon: "🖼", onClick: exportSelectionPNG });
      items.push({ label: fa ? "خروجی JSON انتخاب" : "Export selection JSON", icon: "{ }", onClick: exportSelectionJSON });
      items.push({ label: fa ? "حذف" : "Delete", icon: "🗑", danger: true, onClick: deleteSel });
    } else {
      items.push({ label: fa ? "چسباندن" : "Paste", icon: "⌘V", onClick: pasteClip });
      items.push({ label: T.selectAll, icon: "⬚", onClick: selectAll });
      items.push({ label: fa ? "کپی بورد (PNG)" : "Copy board PNG", icon: "⧉", onClick: copyBoardPNG });
      items.push({ label: fa ? "خروجی فریم‌ها (PNG)" : "Export frames (PNG)", icon: "🎞", onClick: exportFrames });
      items.push({ label: T.templates, icon: "⊞", onClick: () => setShowTemplates(true) });
    }
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  const onWheel = (e: React.WheelEvent) => { const cam = camRef.current; const r = canvasRef.current!.getBoundingClientRect(); const before = toWorld(e); const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1; cam.zoom = Math.max(0.15, Math.min(6, cam.zoom * factor)); const sx = e.clientX - r.left - r.width / 2, sy = e.clientY - r.top - r.height / 2; cam.x = before.x - sx / cam.zoom; cam.y = before.y - sy / cam.zoom; setZoomPct(Math.round(cam.zoom * 100)); };
  const zoomBy = (f: number) => { camRef.current.zoom = Math.max(0.15, Math.min(6, camRef.current.zoom * f)); setZoomPct(Math.round(camRef.current.zoom * 100)); };
  const resetZoom = () => { camRef.current.zoom = 1; camRef.current.x = 0; camRef.current.y = 0; setZoomPct(100); };
  const zoomFit = () => { const u = unionBox(shapesRef.current.filter((s) => !s.hidden)); if (!u) return resetZoom(); const r = canvasRef.current!.getBoundingClientRect(); const pad = 80; const z = Math.max(0.15, Math.min(3, Math.min((r.width - pad) / (u.w || 1), (r.height - pad) / (u.h || 1)))); camRef.current.zoom = z; camRef.current.x = u.x + u.w / 2; camRef.current.y = u.y + u.h / 2; setZoomPct(Math.round(z * 100)); };
  const navigateTo = (world: Point) => { camRef.current.x = world.x; camRef.current.y = world.y; bump(); };
  const zoomToBox = (b: Box, pad = 100) => { const r = canvasRef.current!.getBoundingClientRect(); const z = Math.max(0.15, Math.min(4, Math.min((r.width - pad) / (b.w || 1), (r.height - pad) / (b.h || 1)))); camRef.current.zoom = z; camRef.current.x = b.x + b.w / 2; camRef.current.y = b.y + b.h / 2; setZoomPct(Math.round(z * 100)); };

  /* ---------------- presentation (navigate frames) ---------------- */
  const frameList = () => shapesRef.current.filter((s) => s.tool === "frame");
  const gotoFrame = (i: number) => { const frames = frameList(); if (!frames.length) return; const idx = (i + frames.length) % frames.length; setPresentIdx(idx); zoomToBox(bbox(frames[idx]), 60); };
  const enterPresent = () => { const frames = frameList(); if (!frames.length) { window.alert(fa ? "ابتدا یک «فریم» بکش تا نمایش دهی." : "Draw a Frame first to present."); return; } setPresent(true); setTool("pan"); gotoFrame(0); };
  const exitPresent = () => { setPresent(false); resetZoom(); };

  /* ---------------- style presets ---------------- */
  useEffect(() => { setPresets(listPresets()); }, []);
  const applyPreset = (id: string) => { const p = presets.find((x) => x.id === id); if (!p) return; setColor(p.color); setWidth(p.width); setOpacity(p.opacity); setDash(p.dash); setFill(p.fill); if (selRef.current.size) onPatch({ color: p.color, width: p.width, alpha: p.opacity, dash: p.dash, fill: p.fill, fillColor: p.fillColor || p.color }); };
  const addCurrentPreset = () => setPresets(addPreset({ color, width, opacity, dash, fill, fillColor: color }));
  const removePresetById = (id: string) => setPresets(removePreset(id));

  /* ---------------- clipboard / json export ---------------- */
  const copyBoardPNG = () => { const src = canvasRef.current!; const r = src.getBoundingClientRect(); const dpr = dprRef.current; const cam = camRef.current; const off = document.createElement("canvas"); off.width = r.width * dpr; off.height = r.height * dpr; const ctx = off.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = prefsRef.current.exportBg; ctx.fillRect(0, 0, r.width, r.height); ctx.translate(r.width / 2, r.height / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y); for (const s of shapesRef.current) drawShape(ctx, s, getImg); off.toBlob((b) => { if (b && (navigator.clipboard as any)?.write) { try { (navigator.clipboard as any).write([new (window as any).ClipboardItem({ "image/png": b })]); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} } }); };
  const exportSelectionJSON = () => { const sel = selectedShapes(); if (!sel.length) return; const blob = new Blob([JSON.stringify(sel, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "aperture-selection.json"; a.click(); URL.revokeObjectURL(a.href); };
  const getViewport = useCallback((): Box => { const r = canvasRef.current?.getBoundingClientRect(); const cam = camRef.current; const w = (r?.width || 800) / cam.zoom, h = (r?.height || 600) / cam.zoom; return { x: cam.x - w / 2, y: cam.y - h / 2, w, h }; }, []);

  /* ---------------- selection actions ---------------- */
  const onPatch = (patch: Partial<Shape>) => {
    const sel = selectedShapes(); if (!sel.length) return;
    const p = patch as any;
    snapshotThrottled();
    for (const s of sel) {
      if (p.__move) translate(s, p.__move.x, p.__move.y);
      else if (p.__resize) setShapeBox(s, p.__resize);
      else Object.assign(s, patch);
      upsertShape(s);
    }
    persist(); bump();
  };
  const duplicateSel = () => { const sel = selectedShapes(); if (!sel.length) return; snapshot(); const newIds = new Set<string>(); const gmap: Record<string, string> = {}; for (const s of sel) { const c: Shape = structuredClone(s); c.id = uid(); if (c.groupId) { gmap[s.groupId!] = gmap[s.groupId!] || uid(); c.groupId = gmap[s.groupId!]; } translate(c, 24, 24); shapesRef.current.push(c); broadcast({ type: "upsert", shape: c }); newIds.add(c.id); } selRef.current = newIds; persist(); bump(); };
  const copySel = () => { const sel = selectedShapes(); if (sel.length) clipRef.current = sel.map((s) => structuredClone(s)); };
  const duplicateInPlace = () => { const sel = selectedShapes(); if (!sel.length) return; snapshot(); const newIds = new Set<string>(); const gmap: Record<string, string> = {}; for (const s of sel) { const c: Shape = structuredClone(s); c.id = uid(); if (c.groupId) { gmap[s.groupId!] = gmap[s.groupId!] || uid(); c.groupId = gmap[s.groupId!]; } translate(c, 8, 8); shapesRef.current.push(c); broadcast({ type: "upsert", shape: c }); newIds.add(c.id); } selRef.current = newIds; persist(); bump(); };
  const pasteClip = () => { if (!clipRef.current.length) return; snapshot(); const newIds = new Set<string>(); const gmap: Record<string, string> = {}; for (const s of clipRef.current) { const c: Shape = structuredClone(s); c.id = uid(); if (c.groupId) { gmap[s.groupId!] = gmap[s.groupId!] || uid(); c.groupId = gmap[s.groupId!]; } translate(c, 28, 28); shapesRef.current.push(c); broadcast({ type: "upsert", shape: c }); newIds.add(c.id); } selRef.current = newIds; persist(); bump(); };
  const deleteSel = () => { const sel = selectedShapes(); if (!sel.length) return; snapshot(); for (const s of sel) removeShape(s.id); selRef.current = new Set(); persist(); bump(); };
  const bringFront = () => { const sel = selectedShapes(); if (!sel.length) return; snapshot(); const ids = new Set(sel.map((s) => s.id)); const rest = shapesRef.current.filter((s) => !ids.has(s.id)); const moved = shapesRef.current.filter((s) => ids.has(s.id)); shapesRef.current = [...rest, ...moved]; broadcast({ type: "reorder", order: shapesRef.current.map((s) => s.id) }); persist(); bump(); };
  const sendBack = () => { const sel = selectedShapes(); if (!sel.length) return; snapshot(); const ids = new Set(sel.map((s) => s.id)); const rest = shapesRef.current.filter((s) => !ids.has(s.id)); const moved = shapesRef.current.filter((s) => ids.has(s.id)); shapesRef.current = [...moved, ...rest]; broadcast({ type: "reorder", order: shapesRef.current.map((s) => s.id) }); persist(); bump(); };
  const reorderOne = (id: string, dir: -1 | 1) => { const arr = shapesRef.current; const i = arr.findIndex((s) => s.id === id); if (i < 0) return; const j = i + dir; if (j < 0 || j >= arr.length) return; snapshot(); [arr[i], arr[j]] = [arr[j], arr[i]]; broadcast({ type: "reorder", order: arr.map((s) => s.id) }); persist(); bump(); };
  const primaryId = () => selectedShapes()[0]?.id;
  const doAlign = (mode: AlignMode) => { const sel = selectedShapes(); if (sel.length < 2) return; snapshot(); const map = alignShapes(sel, mode); for (const s of sel) { const d = map[s.id]; if (d) translate(s, d.x, d.y); upsertShape(s); } persist(); bump(); };
  const doDistribute = (axis: "h" | "v") => { const sel = selectedShapes(); if (sel.length < 3) return; snapshot(); const map = distributeShapes(sel, axis); for (const s of sel) { const d = map[s.id]; if (d) translate(s, d.x, d.y); upsertShape(s); } persist(); bump(); };
  const groupSel = () => { const sel = selectedShapes(); if (sel.length < 2) return; snapshot(); const gid = uid(); for (const s of sel) { s.groupId = gid; upsertShape(s); } persist(); bump(); };
  const ungroupSel = () => { const sel = selectedShapes(); if (!sel.length) return; snapshot(); for (const s of sel) { delete s.groupId; upsertShape(s); } persist(); bump(); };
  const nudge = (dx: number, dy: number) => { const sel = selectedShapes(); if (!sel.length) return; snapshotThrottled(); for (const s of sel) if (!s.locked) translate(s, dx, dy); for (const s of sel) upsertShape(s); persist(); bump(); };
  const doTidy = () => { const sel = selectedShapes(); if (sel.length < 2) return; snapshot(); const map = tidyGrid(sel); for (const s of sel) { const d = map[s.id]; if (d) translate(s, d.x, d.y); upsertShape(s); } persist(); bump(); };
  const doFlip = (axis: "h" | "v") => { const sel = selectedShapes(); if (!sel.length) return; snapshot(); const u = unionBox(sel)!; const cx = u.x + u.w / 2, cy = u.y + u.h / 2; for (const s of sel) { flipShape(s, axis, cx, cy); upsertShape(s); } persist(); bump(); };
  const doMatch = (dim: "w" | "h" | "both") => { const sel = selectedShapes(); if (sel.length < 2) return; snapshot(); matchDimension(sel, dim); for (const s of sel) upsertShape(s); persist(); bump(); };
  const doArray = () => {
    const sel = selectedShapes(); if (!sel.length) return;
    const cols = parseInt(window.prompt(fa ? "چند ستون؟" : "How many columns?", "3") || "0", 10);
    const rows = parseInt(window.prompt(fa ? "چند ردیف؟" : "How many rows?", "1") || "1", 10);
    if (!cols || cols < 1) return;
    const u = unionBox(sel)!; const gap = 24; snapshot();
    for (let ry = 0; ry < Math.max(1, rows); ry++) for (let cx2 = 0; cx2 < cols; cx2++) {
      if (ry === 0 && cx2 === 0) continue;
      const gmap: Record<string, string> = {};
      for (const s of sel) { const c: Shape = structuredClone(s); c.id = uid(); if (c.groupId) { gmap[s.groupId!] = gmap[s.groupId!] || uid(); c.groupId = gmap[s.groupId!]; } translate(c, (u.w + gap) * cx2, (u.h + gap) * ry); shapesRef.current.push(c); broadcast({ type: "upsert", shape: c }); }
    }
    persist(); bump();
  };
  const connectSelected = () => { const sel = selectedShapes(); if (sel.length !== 2) return; const a = shapeCenter(sel[0]), b = shapeCenter(sel[1]); snapshot(); const s: Shape = { id: uid(), kind: "shape", tool: "arrow", color: colorRef.current, width: widthRef.current, alpha: 1, x0: a.x, y0: a.y, x1: b.x, y1: b.y, by: meRef.current.color }; shapesRef.current.unshift(s); broadcast({ type: "upsert", shape: s }); broadcast({ type: "reorder", order: shapesRef.current.map((x) => x.id) }); persist(); bump(); };
  const boardStats = () => { const byKind: Record<string, number> = {}; for (const s of shapesRef.current) byKind[s.kind] = (byKind[s.kind] || 0) + 1; const u = unionBox(shapesRef.current.filter((s) => !s.hidden)); return { total: shapesRef.current.length, byKind, w: u ? Math.round(u.w) : 0, h: u ? Math.round(u.h) : 0 }; };
  const selectSame = (by: "kind" | "color") => { const first = selectedShapes()[0]; if (!first) return; selRef.current = new Set(shapesRef.current.filter((s) => !s.hidden && (by === "kind" ? s.tool === first.tool : s.color === first.color)).map((s) => s.id)); bump(); };
  const jumpToShape = (id: string) => { const s = shapesRef.current.find((x) => x.id === id); if (!s) return; const b = bbox(s); camRef.current.x = b.x + b.w / 2; camRef.current.y = b.y + b.h / 2; selRef.current = new Set([id]); bump(); };
  const lockAll = (lock: boolean) => { snapshot(); for (const s of shapesRef.current) { s.locked = lock; upsertShape(s); } persist(); bump(); };
  const showAll = () => { snapshot(); for (const s of shapesRef.current) if (s.hidden) { s.hidden = false; upsertShape(s); } persist(); bump(); };
  const exportFrames = () => {
    const frames = shapesRef.current.filter((s) => s.tool === "frame"); if (!frames.length) { window.alert(fa ? "فریمی وجود ندارد." : "No frames to export."); return; }
    frames.forEach((f, idx) => {
      const b = bbox(f); const pad = 10; const scale = 2;
      const off = document.createElement("canvas"); off.width = (b.w + pad * 2) * scale; off.height = (b.h + pad * 2) * scale; const ctx = off.getContext("2d")!;
      ctx.scale(scale, scale); ctx.fillStyle = prefsRef.current.exportBg; ctx.fillRect(0, 0, b.w + pad * 2, b.h + pad * 2); ctx.translate(pad - b.x, pad - b.y);
      const inside = shapesRef.current.filter((s) => { if (s.id === f.id) return false; const sb = bbox(s); return sb.x >= b.x - 2 && sb.y >= b.y - 2 && sb.x + sb.w <= b.x + b.w + 2 && sb.y + sb.h <= b.y + b.h + 2; });
      for (const s of inside) drawShape(ctx, s, getImg);
      off.toBlob((blob) => { if (!blob) return; const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `aperture-frame-${idx + 1}.png`; a.click(); URL.revokeObjectURL(a.href); });
    });
  };

  /* ---------------- board manager ---------------- */
  const refreshBoards = () => setBoards(listBoards());
  useEffect(() => { refreshBoards(); }, []);
  const doSaveBoard = (name: string) => { const b = saveBoardSnapshot(name || (fa ? "بورد" : "Board"), shapesRef.current); currentBoardRef.current = b.id; refreshBoards(); };
  const doLoadBoard = (id: string) => { const b = getBoard(id); if (!b) return; snapshot(); shapesRef.current = structuredClone(b.shapes); selRef.current = new Set(); currentBoardRef.current = id; persist(); syncAll(); bump(); };
  const doRenameBoard = (id: string, name: string) => { renameBoard(id, name); refreshBoards(); };
  const doDeleteBoard = (id: string) => { deleteBoard(id); refreshBoards(); };

  const insertTemplate = (id: string) => { const tpl = TEMPLATES.find((t) => t.id === id); if (!tpl) return; snapshot(); const built = tpl.build(camRef.current.x, camRef.current.y); shapesRef.current.push(...built); for (const s of built) broadcast({ type: "upsert", shape: s }); selRef.current = new Set(built.map((s) => s.id)); persist(); bump(); };
  const insertStencil = (id: string) => { const st = STENCILS.find((t) => t.id === id); if (!st) return; snapshot(); const built = st.build(camRef.current.x, camRef.current.y); shapesRef.current.push(...built); for (const s of built) broadcast({ type: "upsert", shape: s }); selRef.current = new Set(built.map((s) => s.id)); setTool("select"); persist(); bump(); };
  const exportSelectionPNG = () => {
    const sel = selectedShapes(); if (!sel.length) return; const u = unionBox(sel)!; const pad = 24; const scale = 2;
    const off = document.createElement("canvas"); off.width = (u.w + pad * 2) * scale; off.height = (u.h + pad * 2) * scale; const ctx = off.getContext("2d")!;
    ctx.scale(scale, scale); ctx.fillStyle = prefsRef.current.exportBg; ctx.fillRect(0, 0, u.w + pad * 2, u.h + pad * 2); ctx.translate(pad - u.x, pad - u.y);
    for (const s of sel) drawShape(ctx, s, getImg);
    off.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "aperture-selection.png"; a.click(); URL.revokeObjectURL(a.href); });
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = true;
      if (present) { if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); gotoFrame(presentIdx + 1); } else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); gotoFrame(presentIdx - 1); } else if (e.key === "Escape") exitPresent(); return; }
      if (editing) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") { spaceRef.current = true; return; }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); selectAll(); return; }
      if (mod && e.key.toLowerCase() === "c") { copySel(); return; }
      if (mod && e.key.toLowerCase() === "v") { pasteClip(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); e.shiftKey ? duplicateInPlace() : duplicateSel(); return; }
      if (mod && e.key.toLowerCase() === "g") { e.preventDefault(); e.shiftKey ? ungroupSel() : groupSel(); return; }
      if (mod) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) { setShowShortcuts((v) => !v); return; }
      if (e.key === "Escape") { clearSel(); setMenu(null); setShowTemplates(false); setShowShortcuts(false); return; }
      if (e.key === "0") { resetZoom(); return; }
      if (e.key === "[") { const id = primaryId(); if (id) reorderOne(id, -1); return; }
      if (e.key === "]") { const id = primaryId(); if (id) reorderOne(id, 1); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selRef.current.size) { e.preventDefault(); deleteSel(); return; }
      if (e.key.startsWith("Arrow") && selRef.current.size) { e.preventDefault(); const step = e.shiftKey ? GRID : 1; if (e.key === "ArrowUp") nudge(0, -step); else if (e.key === "ArrowDown") nudge(0, step); else if (e.key === "ArrowLeft") nudge(-step, 0); else nudge(step, 0); return; }
      if (/^[1-9]$/.test(e.key)) { const c = PALETTE[Number(e.key) + 1]; if (c) { setColor(c); if (selRef.current.size) onPatch({ color: c }); } return; }
      const tl = SHORTCUTS[e.key.toLowerCase()]; if (tl) setTool(tl);
    };
    const ku = (e: KeyboardEvent) => { if (e.key === "Shift") shiftRef.current = false; if (e.code === "Space") spaceRef.current = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, present, presentIdx]);

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
      upsertShape(s); selRef.current = new Set([s.id]); setTool("select"); bump();
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
  const commitEditing = () => { if (!editing) return; const s = shapesRef.current.find((x) => x.id === editing.id); if (s) { if (editing.value.trim() === "" && (s.kind === "note" || s.kind === "text" || s.kind === "comment")) removeShape(s.id); else { s.text = editing.value; upsertShape(s); } } setEditing(null); persist(); bump(); };
  const onDoubleClick = (e: React.MouseEvent) => {
    const raw = toWorld(e); const h = hit(raw.x, raw.y);
    if (!h) { // double-click empty canvas → quick note
      const w = { x: snapv(raw.x), y: snapv(raw.y) }; snapshot();
      const s: Shape = { id: uid(), kind: "note", tool: "note", color: colorRef.current === "#ffffff" ? "#fde68a" : NOTE_COLORS.includes(colorRef.current) ? colorRef.current : "#fde68a", width: 1, fontSize: fontRef.current, x: w.x, y: w.y, w: 190, h: 130, text: "", by: meRef.current.color };
      upsertShape(s); setEditing({ id: s.id, sx: e.clientX - 20, sy: e.clientY - 20, value: "", kind: "note" }); bump(); return;
    }
    if (h.locked) return;
    if (h.kind === "note" || h.kind === "text" || h.kind === "comment") { selRef.current = new Set([h.id]); setEditing({ id: h.id, sx: e.clientX - 20, sy: e.clientY - 20, value: h.text || "", kind: h.kind }); bump(); return; }
    if (h.kind === "shape" && h.tool !== "line" && h.tool !== "arrow" && h.tool !== "connector") { selRef.current = new Set([h.id]); setEditing({ id: h.id, sx: e.clientX - 20, sy: e.clientY - 20, value: h.text || "", kind: "text" }); bump(); }
  };

  /* ---------------- export ---------------- */
  const exportPNG = () => { const src = canvasRef.current!; const r = src.getBoundingClientRect(); const dpr = dprRef.current; const cam = camRef.current; const off = document.createElement("canvas"); off.width = r.width * dpr; off.height = r.height * dpr; const ctx = off.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = prefsRef.current.exportBg; ctx.fillRect(0, 0, r.width, r.height); ctx.translate(r.width / 2, r.height / 2); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y); for (const s of shapesRef.current) drawShape(ctx, s, getImg); off.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "aperture.png"; a.click(); URL.revokeObjectURL(a.href); }); };
  const exportSVG = () => {
    const ss = shapesRef.current.filter((s) => !s.hidden); if (!ss.length) return; const u = unionBox(ss)!;
    const minX = u.x, minY = u.y; const pad = 24; const W = u.w + pad * 2, H = u.h + pad * 2; const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    let body = "";
    for (const s of ss) {
      const da = s.dash === "dashed" ? ` stroke-dasharray="${s.width * 3} ${s.width * 2.5}"` : s.dash === "dotted" ? ` stroke-dasharray="1 ${s.width * 2}"` : "";
      const op = s.alpha ?? 1;
      if (s.kind === "stroke" && s.pts) { const pts = s.pts.map((p) => `${(p.x - minX + pad).toFixed(1)},${(p.y - minY + pad).toFixed(1)}`).join(" "); body += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"${da}/>`; }
      else if (s.kind === "shape") { const x0 = s.x0! - minX + pad, y0 = s.y0! - minY + pad, x1 = s.x1! - minX + pad, y1 = s.y1! - minY + pad; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2; const fillA = s.fill ? `fill="${s.fillColor || s.color}" fill-opacity="${s.fillAlpha ?? 0.32}"` : `fill="none"`; if (s.tool === "line" || s.tool === "arrow" || s.tool === "connector") body += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" opacity="${op}"${da}/>`; else if (s.tool === "rect") body += `<rect x="${Math.min(x0, x1)}" y="${Math.min(y0, y1)}" width="${Math.abs(x1 - x0)}" height="${Math.abs(y1 - y0)}" rx="${s.radius ?? 0}" ${fillA} stroke="${s.color}" stroke-width="${s.width}" opacity="${op}"${da}/>`; else if (s.tool === "ellipse") body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${fillA} stroke="${s.color}" stroke-width="${s.width}" opacity="${op}"${da}/>`; else { const pts = s.tool === "diamond" ? `${cx},${Math.min(y0, y1)} ${Math.max(x0, x1)},${cy} ${cx},${Math.max(y0, y1)} ${Math.min(x0, x1)},${cy}` : s.tool === "triangle" ? `${cx},${Math.min(y0, y1)} ${Math.max(x0, x1)},${Math.max(y0, y1)} ${Math.min(x0, x1)},${Math.max(y0, y1)}` : ""; if (pts) body += `<polygon points="${pts}" ${fillA} stroke="${s.color}" stroke-width="${s.width}" opacity="${op}"${da}/>`; else body += `<rect x="${Math.min(x0, x1)}" y="${Math.min(y0, y1)}" width="${Math.abs(x1 - x0)}" height="${Math.abs(y1 - y0)}" ${fillA} stroke="${s.color}" stroke-width="${s.width}" opacity="${op}"${da}/>`; } }
      else if (s.kind === "text") body += `<text x="${s.x! - minX + pad}" y="${s.y! - minY + pad}" fill="${s.color}" font-family="sans-serif" font-weight="${s.bold ? 800 : 600}" font-size="${14 + (s.fontSize ?? 4) * 3}">${esc(s.text || "")}</text>`;
      else if (s.kind === "note") { body += `<rect x="${s.x! - minX + pad}" y="${s.y! - minY + pad}" width="${s.w}" height="${s.h}" rx="8" fill="${s.color}"/><text x="${s.x! - minX + pad + 12}" y="${s.y! - minY + pad + 26}" fill="#1a1a1a" font-family="sans-serif" font-size="15">${esc((s.text || "").slice(0, 60))}</text>`; }
      else if (s.kind === "image" && s.src) body += `<image x="${s.x! - minX + pad}" y="${s.y! - minY + pad}" width="${s.w}" height="${s.h}" href="${s.src}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${prefsRef.current.exportBg}"/>${body}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "aperture.svg"; a.click(); URL.revokeObjectURL(a.href);
  };
  const saveJSON = () => { const blob = new Blob([JSON.stringify(shapesRef.current)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "aperture-board.json"; a.click(); URL.revokeObjectURL(a.href); };
  const loadRef = useRef<HTMLInputElement>(null);
  const loadJSON = (file: File) => { const rd = new FileReader(); rd.onload = () => { try { const arr = JSON.parse(rd.result as string); if (Array.isArray(arr)) { snapshot(); shapesRef.current = arr; selRef.current = new Set(); persist(); syncAll(); bump(); } } catch {} }; rd.readAsText(file); };

  const activeColor = editing ? (shapesRef.current.find((s) => s.id === editing.id)?.color || color) : color;
  const currentSelection = shapesRef.current.filter((s) => selRef.current.has(s.id));
  const hasSel = selRef.current.size > 0;

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>◎</span><span className="font-display text-lg">{T.brand}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplates(true)} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex" title={T.templates}>⊞ {T.templates}</button>
          <button onClick={() => { refreshBoards(); setShowBoards(true); }} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex" title={fa ? "بوردها" : "Boards"}>🗂 {fa ? "بوردها" : "Boards"}</button>
          <button onClick={() => setShowRuler((v) => !v)} className="btn btn-outline hidden h-9 px-2.5 py-0 text-xs sm:inline-flex" title={fa ? "خط‌کش" : "Ruler"} style={showRuler ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}>📏</button>
          <button onClick={enterPresent} className="btn btn-outline hidden h-9 px-2.5 py-0 text-xs sm:inline-flex" title={fa ? "نمایش" : "Present"}>▶</button>
          <button onClick={() => setShowPrefs(true)} className="btn btn-outline h-9 px-2.5 py-0 text-xs" title={fa ? "تنظیمات" : "Preferences"}>⚙</button>
          <button onClick={() => setShowShortcuts(true)} className="btn btn-outline h-9 px-2.5 py-0 text-xs" title={T.shortcuts}>?</button>
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
          <button onClick={() => setPanelOpen((v) => !v)} className="btn btn-outline h-9 px-2.5 py-0 text-xs" title={T.panel}>{panelOpen ? "⊟" : "⊞"}</button>
          <ThemePicker /><LangToggle />
        </div>
      </header>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex flex-wrap gap-1">
          {(["select", "pan", "eyedropper", "measure"] as Tool[]).map((tl) => <ToolBtn key={tl} tl={tl} tool={tool} setTool={setTool} icon={icon} label={label} />)}
          <span className="mx-0.5 h-9 w-px" style={{ background: "var(--line)" }} />
          {STROKE_TOOLS.map((tl) => <ToolBtn key={tl} tl={tl} tool={tool} setTool={setTool} icon={icon} label={label} />)}
          <ToolBtn tl="eraser" tool={tool} setTool={setTool} icon={icon} label={label} />
          <ToolBtn tl="laser" tool={tool} setTool={setTool} icon={icon} label={label} />
          <span className="mx-0.5 h-9 w-px" style={{ background: "var(--line)" }} />
          {PRIMARY_SHAPES.map((tl) => <ToolBtn key={tl} tl={tl} tool={tool} setTool={setTool} icon={icon} label={label} />)}
          <div className="relative">
            <button onClick={() => setShapesMenu((v) => !v)} title={T.moreShapes} className="grid h-9 w-9 place-items-center rounded-lg border text-base" style={{ borderColor: EXTRA_SHAPES.includes(tool) ? "var(--accent)" : "var(--line-2)", background: EXTRA_SHAPES.includes(tool) ? "var(--accent)" : "transparent", color: EXTRA_SHAPES.includes(tool) ? "var(--on-accent)" : "var(--fg)" }}>⋯</button>
            {shapesMenu && (
              <div className="absolute z-40 mt-1 flex gap-1 rounded-xl border p-1.5 shadow-xl" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                {EXTRA_SHAPES.map((tl) => <button key={tl} onClick={() => { setTool(tl); setShapesMenu(false); }} title={label[tl]} className="grid h-9 w-9 place-items-center rounded-lg border text-base" style={{ borderColor: tool === tl ? "var(--accent)" : "var(--line-2)", background: tool === tl ? "var(--accent)" : "transparent", color: tool === tl ? "var(--on-accent)" : "var(--fg)" }}>{icon[tl]}</button>)}
              </div>
            )}
          </div>
          <ToolBtn tl="note" tool={tool} setTool={setTool} icon={icon} label={label} />
          <ToolBtn tl="text" tool={tool} setTool={setTool} icon={icon} label={label} />
          <ToolBtn tl="comment" tool={tool} setTool={setTool} icon={icon} label={label} />
          <button onClick={() => imgInputRef.current?.click()} title={T.image} className="grid h-9 w-9 place-items-center rounded-lg border text-base" style={{ borderColor: "var(--line-2)" }}>🖼</button>
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f); e.currentTarget.value = ""; }} />
          <div className="relative">
            <button onClick={() => { setTool("stamp"); setStampMenu((v) => !v); }} title={label.stamp} className="grid h-9 w-9 place-items-center rounded-lg border text-base" style={{ borderColor: tool === "stamp" ? "var(--accent)" : "var(--line-2)", background: tool === "stamp" ? "var(--accent)" : "transparent" }}>{activeStamp}</button>
            {stampMenu && <StampPicker stamps={STAMPS} active={activeStamp} onPick={(s) => { setActiveStamp(s); setTool("stamp"); setStampMenu(false); }} />}
          </div>
        </div>
        <span className="mx-1 h-6 w-px" style={{ background: "var(--line)" }} />
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => <button key={c} onClick={() => setColor(c)} className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110" style={{ background: c, borderColor: color === c ? "var(--fg)" : "var(--line)" }} />)}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
          {recent.map((c) => <button key={c} onClick={() => setColor(c)} className="h-5 w-5 rounded-full border" style={{ background: c, borderColor: "var(--line)" }} />)}
          <button onClick={addSwatch} title={fa ? "ذخیره رنگ" : "Save colour"} className="grid h-5 w-5 place-items-center rounded-full border text-[10px]" style={{ borderColor: "var(--line-2)" }}>＋</button>
          {swatches.map((c) => <button key={c} onClick={() => setColor(c)} onContextMenu={(e) => { e.preventDefault(); removeSwatch(c); }} title={fa ? "راست‌کلیک برای حذف" : "Right-click to remove"} className="h-5 w-5 rounded-sm border" style={{ background: c, borderColor: color === c ? "var(--fg)" : "var(--line)" }} />)}
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
          <option value="grid">{fa ? "شبکه" : "Grid"}</option><option value="dots">{fa ? "نقطه" : "Dots"}</option><option value="lines">{fa ? "خطوط" : "Lines"}</option><option value="iso">{fa ? "ایزومتریک" : "Iso"}</option><option value="plain">{fa ? "ساده" : "Plain"}</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-[var(--fg-2)]"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="h-3.5 w-3.5" />{T.snap}</label>
        {tool === "note" && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--fg-2)]">{fa ? "رنگ یادداشت" : "Note"}</span>
            {NOTE_COLORS.map((c) => <button key={c} onClick={() => setColor(c)} className="h-5 w-5 rounded-sm border" style={{ background: c, borderColor: color === c ? "var(--fg)" : "var(--line)" }} />)}
          </div>
        )}
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

      {/* board + panel */}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1" style={{ background: "var(--bg)" }}>
          <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={onDoubleClick} onWheel={onWheel} onContextMenu={onContextMenu} className="absolute inset-0 h-full w-full touch-none" style={{ cursor: tool === "pan" || spaceRef.current ? "grab" : tool === "select" ? "default" : tool === "eraser" ? "cell" : tool === "eyedropper" ? "copy" : "crosshair" }} />
          {editing && (
            <textarea autoFocus value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} onBlur={commitEditing} onKeyDown={(e) => { if (e.key === "Enter" && editing.kind !== "note" && !e.shiftKey) { e.preventDefault(); commitEditing(); } if (e.key === "Escape") commitEditing(); }} className="absolute z-30 resize-none rounded-lg p-2 text-sm outline-none" style={{ left: editing.sx, top: editing.sy, width: editing.kind === "note" ? 190 : 220, height: editing.kind === "note" ? 130 : editing.kind === "comment" ? 80 : 44, background: editing.kind === "note" ? (activeColor === "#ffffff" ? "#fde68a" : activeColor) : "var(--bg-2)", color: editing.kind === "note" ? "#1a1a1a" : editing.kind === "comment" ? "#e5e7eb" : activeColor, border: "2px solid var(--accent)", boxShadow: "0 10px 30px -10px var(--shadow)" }} placeholder={editing.kind === "comment" ? (fa ? "کامنت بگذار…" : "Leave a comment…") : T.writeHere} />
          )}
          {shapesRef.current.length === 0 && !editing && !present && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-2xl border px-6 py-5 text-center" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-2) 70%, transparent)" }}>
                <div className="mb-2 text-3xl opacity-60">◎</div>
                <p className="text-sm font-medium">{fa ? "بومِ خالی — شروع کن!" : "Blank canvas — start creating!"}</p>
                <p className="mt-1 text-xs text-[var(--fg-2)]">{fa ? "ابزاری بردار، یا دوبار روی بوم کلیک کن تا یادداشت بسازی. ? را برای میان‌برها بزن." : "Pick a tool, or double-click the canvas to drop a note. Press ? for shortcuts."}</p>
                <div className="mt-3 flex justify-center gap-2">
                  <button onClick={() => setShowTemplates(true)} className="pointer-events-auto btn btn-outline px-3 py-1.5 text-xs">⊞ {T.templates}</button>
                  <button onClick={() => setShowShortcuts(true)} className="pointer-events-auto btn btn-outline px-3 py-1.5 text-xs">? {T.shortcuts}</button>
                </div>
              </div>
            </div>
          )}
          <StatusBar fa={fa} zoom={zoomPct} total={shapesRef.current.length} selCount={selRef.current.size} selBox={hasSel ? unionBox(currentSelection) : null} cursor={cursorPos} showCoords={prefs.showCoords} />
          {showMinimap && (
            <div className="absolute bottom-8 end-3">
              <Minimap getShapes={() => shapesRef.current} getViewport={getViewport} getImg={getImg} onNavigate={navigateTo} bgColor={"#0e1116"} />
              <button onClick={() => setShowMinimap(false)} className="absolute -top-2 -end-2 grid h-5 w-5 place-items-center rounded-full border text-[10px]" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>✕</button>
            </div>
          )}
          {!showMinimap && <button onClick={() => setShowMinimap(true)} className="absolute bottom-8 end-3 btn btn-outline px-2.5 py-1 text-xs">{T.map}</button>}
        </div>

        {panelOpen && (
          <aside className="flex w-72 shrink-0 flex-col border-s" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
            <div className="flex border-b" style={{ borderColor: "var(--line)" }}>
              {(["inspector", "layers", "find"] as const).map((tb) => (
                <button key={tb} onClick={() => setPanelTab(tb)} className="flex-1 py-2.5 text-xs font-semibold transition-colors" style={panelTab === tb ? { color: "var(--fg)", boxShadow: "inset 0 -2px 0 var(--accent)" } : { color: "var(--fg-2)" }}>
                  {tb === "inspector" ? T.inspector : tb === "layers" ? T.layers : (fa ? "یافتن" : "Find")}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {panelTab === "find" ? (
                <FindPanel shapes={shapesRef.current} fa={fa} onJump={jumpToShape} />
              ) : panelTab === "inspector" ? (
                <InspectorPanel
                  selected={currentSelection} fa={fa} onPatch={onPatch}
                  onDelete={deleteSel} onDuplicate={duplicateSel} onFront={bringFront} onBack={sendBack}
                  onForward={() => { const id = primaryId(); if (id) reorderOne(id, 1); }} onBackward={() => { const id = primaryId(); if (id) reorderOne(id, -1); }}
                  onAlign={doAlign} onDistribute={doDistribute} onGroup={groupSel} onUngroup={ungroupSel}
                  onTidy={doTidy} onFlip={doFlip} onMatch={doMatch} onArray={doArray} onConnect={connectSelected} stats={boardStats()}
                />
              ) : (
                <LayersPanel
                  shapes={shapesRef.current} selectedIds={selRef.current} fa={fa}
                  onSelect={(id, additive) => selectShape(id, additive)}
                  onToggleHidden={(id) => { const s = shapesRef.current.find((x) => x.id === id); if (s) { snapshot(); s.hidden = !s.hidden; upsertShape(s); persist(); bump(); } }}
                  onToggleLocked={(id) => { const s = shapesRef.current.find((x) => x.id === id); if (s) { snapshot(); s.locked = !s.locked; upsertShape(s); persist(); bump(); } }}
                  onDelete={(id) => { snapshot(); removeShape(id); persist(); bump(); }}
                  onReorder={reorderOne}
                  onLockAll={lockAll}
                  onShowAll={showAll}
                />
              )}
            </div>
            <PresetsBar presets={presets} fa={fa} onApply={applyPreset} onAddCurrent={addCurrentPreset} onRemove={removePresetById} />
          </aside>
        )}

        {present && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border px-4 py-2 shadow-xl" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
              <button onClick={() => gotoFrame(presentIdx - 1)} className="btn btn-outline px-3 py-1 text-sm">‹</button>
              <span className="mono text-sm">{presentIdx + 1} / {frameList().length}</span>
              <button onClick={() => gotoFrame(presentIdx + 1)} className="btn btn-outline px-3 py-1 text-sm">›</button>
              <button onClick={exitPresent} className="btn btn-accent px-3 py-1 text-xs">{fa ? "خروج" : "Exit"}</button>
            </div>
          </div>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
      <TemplatesModal open={showTemplates} fa={fa} onClose={() => setShowTemplates(false)} onPick={insertTemplate} onPickStencil={insertStencil} />
      <ShortcutsModal open={showShortcuts} fa={fa} onClose={() => setShowShortcuts(false)} />
      <BoardsModal open={showBoards} fa={fa} boards={boards} onClose={() => setShowBoards(false)} onSave={doSaveBoard} onLoad={doLoadBoard} onRename={doRenameBoard} onDelete={doDeleteBoard} />
      <PrefsModal open={showPrefs} fa={fa} prefs={prefs} onClose={() => setShowPrefs(false)} onChange={updatePrefs} />
    </div>
  );
}

function ToolBtn({ tl, tool, setTool, icon, label }: { tl: Tool; tool: Tool; setTool: (t: Tool) => void; icon: Record<string, string>; label: Record<string, string> }) {
  return <button onClick={() => setTool(tl)} title={label[tl]} className="grid h-9 w-9 place-items-center rounded-lg border text-base transition-colors" style={{ borderColor: tool === tl ? "var(--accent)" : "var(--line-2)", background: tool === tl ? "var(--accent)" : "transparent", color: tool === tl ? "var(--on-accent)" : "var(--fg)" }}>{icon[tl]}</button>;
}
