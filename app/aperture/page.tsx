"use client";

/*
  Aperture — a collaborative whiteboard canvas.

  A real drawing surface with a pen, geometric shapes (line, arrow, rectangle,
  ellipse), sticky notes and text, plus select/move and an eraser. Colours and
  stroke width are adjustable; there's full undo/redo, delete, clear and PNG
  export. To convey the "collaborative" nature it renders a couple of animated
  remote-collaborator cursors and a presence rail, and a Share button copies a
  room link. Rendering runs on a single requestAnimationFrame loop against refs
  (so drawing stays smooth) while React only owns the toolbar UI. Bilingual.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";

type Tool = "select" | "pen" | "line" | "arrow" | "rect" | "ellipse" | "note" | "text" | "eraser";
type Shape = {
  id: string; type: Tool; color: string; width: number;
  pts?: { x: number; y: number }[];
  x0?: number; y0?: number; x1?: number; y1?: number;
  x?: number; y?: number; w?: number; h?: number; text?: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const COLORS = ["#e5484d", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#111827", "#ffffff"];
const GHOST_NAMES = [["Sara", "#f59e0b"], ["Milad", "#22c55e"], ["Ava", "#ec4899"]] as const;

export default function AperturePage() {
  const { lang } = useLang();
  const fa = lang === "fa";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#3b82f6");
  const [width, setWidth] = useState(3);
  const [version, setVersion] = useState(0); // bump to refresh toolbar (undo/redo/count)
  const [copied, setCopied] = useState(false);

  // canvas state lives in refs so the rAF loop is cheap
  const shapesRef = useRef<Shape[]>([]);
  const undoRef = useRef<Shape[][]>([]);
  const redoRef = useRef<Shape[][]>([]);
  const draftRef = useRef<Shape | null>(null);
  const selRef = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const toolRef = useRef(tool); toolRef.current = tool;
  const colorRef = useRef(color); colorRef.current = color;
  const widthRef = useRef(width); widthRef.current = width;
  const dprRef = useRef(1);
  const ghostsRef = useRef(GHOST_NAMES.map(([name, c]) => ({ name, color: c, x: Math.random() * 600, y: Math.random() * 400, tx: Math.random() * 600, ty: Math.random() * 400 })));

  const T = fa
    ? { back: "بازگشت", brand: "آپرچر", tagline: "بومِ مشارکتیِ لایو", select: "انتخاب", pen: "قلم", line: "خط", arrow: "پیکان", rect: "مستطیل", ellipse: "بیضی", note: "یادداشت", text: "متن", eraser: "پاک‌کن", undo: "واگرد", redo: "ازنو", clear: "پاک‌کردن همه", export: "خروجی PNG", share: "اشتراک اتاق", copied: "لینک کپی شد!", color: "رنگ", size: "ضخامت", promptText: "متن را وارد کن:", promptNote: "متنِ یادداشت:", confirmClear: "کلِ بوم پاک شود؟", online: "آنلاین", shapes: "شکل" }
    : { back: "back", brand: "Aperture", tagline: "Real-time collaborative canvas", select: "Select", pen: "Pen", line: "Line", arrow: "Arrow", rect: "Rectangle", ellipse: "Ellipse", note: "Note", text: "Text", eraser: "Eraser", undo: "Undo", redo: "Redo", clear: "Clear all", export: "Export PNG", share: "Share room", copied: "Room link copied!", color: "Color", size: "Width", promptText: "Enter text:", promptNote: "Sticky note text:", confirmClear: "Clear the whole canvas?", online: "online", shapes: "shapes" };

  const TOOLS: { id: Tool; label: string; icon: string }[] = [
    { id: "select", label: T.select, icon: "⬚" }, { id: "pen", label: T.pen, icon: "✎" },
    { id: "line", label: T.line, icon: "╱" }, { id: "arrow", label: T.arrow, icon: "↗" },
    { id: "rect", label: T.rect, icon: "▭" }, { id: "ellipse", label: T.ellipse, icon: "◯" },
    { id: "note", label: T.note, icon: "▤" }, { id: "text", label: T.text, icon: "T" },
    { id: "eraser", label: T.eraser, icon: "⌫" },
  ];

  const bump = () => setVersion((v) => v + 1);
  const snapshot = () => { undoRef.current.push(structuredClone(shapesRef.current)); if (undoRef.current.length > 60) undoRef.current.shift(); redoRef.current = []; };
  const undo = () => { if (!undoRef.current.length) return; redoRef.current.push(structuredClone(shapesRef.current)); shapesRef.current = undoRef.current.pop()!; selRef.current = null; bump(); };
  const redo = () => { if (!redoRef.current.length) return; undoRef.current.push(structuredClone(shapesRef.current)); shapesRef.current = redoRef.current.pop()!; bump(); };
  const clearAll = () => { if (!shapesRef.current.length || !window.confirm(T.confirmClear)) return; snapshot(); shapesRef.current = []; selRef.current = null; bump(); };

  const bbox = (s: Shape) => {
    if (s.type === "pen" && s.pts) { const xs = s.pts.map((p) => p.x), ys = s.pts.map((p) => p.y); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
    if (s.type === "note") return { x: s.x!, y: s.y!, w: s.w!, h: s.h! };
    if (s.type === "text") return { x: s.x!, y: s.y! - 20, w: (s.text?.length || 4) * (s.width + 8), h: 28 };
    const x = Math.min(s.x0!, s.x1!), y = Math.min(s.y0!, s.y1!); return { x, y, w: Math.abs(s.x1! - s.x0!), h: Math.abs(s.y1! - s.y0!) };
  };
  const hit = (px: number, py: number) => {
    for (let i = shapesRef.current.length - 1; i >= 0; i--) { const b = bbox(shapesRef.current[i]); if (px >= b.x - 8 && px <= b.x + b.w + 8 && py >= b.y - 8 && py <= b.y + b.h + 8) return shapesRef.current[i]; }
    return null;
  };
  const translate = (s: Shape, dx: number, dy: number) => {
    if (s.pts) s.pts = s.pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    if (s.x0 != null) { s.x0 += dx; s.x1! += dx; s.y0! += dy; s.y1! += dy; }
    if (s.x != null) { s.x += dx; s.y! += dy; }
  };

  const drawShape = (ctx: CanvasRenderingContext2D, s: Shape) => {
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (s.type === "pen" && s.pts && s.pts.length) {
      ctx.beginPath(); ctx.moveTo(s.pts[0].x, s.pts[0].y); for (const p of s.pts) ctx.lineTo(p.x, p.y); ctx.stroke();
    } else if (s.type === "line" || s.type === "arrow") {
      ctx.beginPath(); ctx.moveTo(s.x0!, s.y0!); ctx.lineTo(s.x1!, s.y1!); ctx.stroke();
      if (s.type === "arrow") { const a = Math.atan2(s.y1! - s.y0!, s.x1! - s.x0!); const h = 10 + s.width * 2; ctx.beginPath(); ctx.moveTo(s.x1!, s.y1!); ctx.lineTo(s.x1! - h * Math.cos(a - 0.4), s.y1! - h * Math.sin(a - 0.4)); ctx.moveTo(s.x1!, s.y1!); ctx.lineTo(s.x1! - h * Math.cos(a + 0.4), s.y1! - h * Math.sin(a + 0.4)); ctx.stroke(); }
    } else if (s.type === "rect") {
      ctx.strokeRect(Math.min(s.x0!, s.x1!), Math.min(s.y0!, s.y1!), Math.abs(s.x1! - s.x0!), Math.abs(s.y1! - s.y0!));
    } else if (s.type === "ellipse") {
      ctx.beginPath(); ctx.ellipse((s.x0! + s.x1!) / 2, (s.y0! + s.y1!) / 2, Math.abs(s.x1! - s.x0!) / 2, Math.abs(s.y1! - s.y0!) / 2, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (s.type === "note") {
      ctx.save(); ctx.fillStyle = s.color; ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
      ctx.beginPath(); ctx.roundRect(s.x!, s.y!, s.w!, s.h!, 6); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#1a1a1a"; ctx.font = "14px ui-sans-serif, system-ui"; ctx.textBaseline = "top";
      wrapText(ctx, s.text || "", s.x! + 10, s.y! + 10, s.w! - 20, 18);
    } else if (s.type === "text") {
      ctx.fillStyle = s.color; ctx.font = `${14 + s.width * 3}px ui-sans-serif, system-ui`; ctx.textBaseline = "alphabetic"; ctx.fillText(s.text || "", s.x!, s.y!);
    }
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) => {
    const words = text.split(/\s+/); let line = ""; let yy = y;
    for (const w of words) { const test = line ? line + " " + w : w; if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = test; }
    if (line) ctx.fillText(line, x, yy);
  };

  // main render loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); dprRef.current = dpr;
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const r = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      // (the dot grid is a CSS background on the wrapper, so the canvas is transparent)
      ctx.save(); ctx.globalAlpha = 0.5;
      for (const s of shapesRef.current) drawShape(ctx, s);
      if (draftRef.current) drawShape(ctx, draftRef.current);
      ctx.restore();
      // selection box
      const sel = shapesRef.current.find((s) => s.id === selRef.current);
      if (sel) { const b = bbox(sel); ctx.save(); ctx.strokeStyle = "#3b82f6"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12); ctx.restore(); }
      // animated ghost collaborators
      for (const g of ghostsRef.current) {
        g.x += (g.tx - g.x) * Math.min(1, dt * 1.6); g.y += (g.ty - g.y) * Math.min(1, dt * 1.6);
        if (Math.hypot(g.tx - g.x, g.ty - g.y) < 8) { g.tx = 40 + Math.random() * (r.width - 80); g.ty = 40 + Math.random() * (r.height - 80); }
        ctx.save(); ctx.fillStyle = g.color;
        ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x, g.y + 16); ctx.lineTo(g.x + 5, g.y + 12); ctx.lineTo(g.x + 11, g.y + 11); ctx.closePath(); ctx.fill();
        ctx.font = "600 11px ui-sans-serif, system-ui"; ctx.fillStyle = g.color;
        const w = ctx.measureText(g.name).width; ctx.globalAlpha = 0.92;
        ctx.fillRect(g.x + 12, g.y + 12, w + 12, 16); ctx.fillStyle = "#fff"; ctx.fillText(g.name, g.x + 18, g.y + 24);
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ptOf = (e: React.PointerEvent) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const { x, y } = ptOf(e); const t = toolRef.current;
    if (t === "select") { const h = hit(x, y); selRef.current = h?.id ?? null; if (h) { snapshot(); dragRef.current = { x, y, moved: false }; } bump(); return; }
    if (t === "eraser") { const h = hit(x, y); if (h) { snapshot(); shapesRef.current = shapesRef.current.filter((s) => s.id !== h.id); bump(); } return; }
    if (t === "pen") { draftRef.current = { id: uid(), type: "pen", color: colorRef.current, width: widthRef.current, pts: [{ x, y }] }; return; }
    if (t === "note") { const txt = window.prompt(T.promptNote, ""); if (txt != null) { snapshot(); shapesRef.current.push({ id: uid(), type: "note", color: colorRef.current === "#ffffff" ? "#fde68a" : colorRef.current, width: 1, x, y, w: 180, h: 120, text: txt }); bump(); } return; }
    if (t === "text") { const txt = window.prompt(T.promptText, ""); if (txt) { snapshot(); shapesRef.current.push({ id: uid(), type: "text", color: colorRef.current, width: widthRef.current, x, y, text: txt }); bump(); } return; }
    // shapes
    draftRef.current = { id: uid(), type: t, color: colorRef.current, width: widthRef.current, x0: x, y0: y, x1: x, y1: y };
  };
  const onMove = (e: React.PointerEvent) => {
    const { x, y } = ptOf(e);
    if (dragRef.current) { const sel = shapesRef.current.find((s) => s.id === selRef.current); if (sel) { translate(sel, x - dragRef.current.x, y - dragRef.current.y); dragRef.current = { x, y, moved: true }; } return; }
    const d = draftRef.current; if (!d) return;
    if (d.type === "pen") d.pts!.push({ x, y }); else { d.x1 = x; d.y1 = y; }
  };
  const onUp = () => {
    if (dragRef.current) { if (!dragRef.current.moved) undoRef.current.pop(); dragRef.current = null; bump(); return; }
    const d = draftRef.current; if (!d) return;
    const isDot = d.type !== "pen" && Math.hypot((d.x1! - d.x0!), (d.y1! - d.y0!)) < 3;
    draftRef.current = null;
    if (!isDot) { snapshot(); shapesRef.current.push(d); }
    bump();
  };

  const exportPNG = useCallback(() => {
    const src = canvasRef.current!; const r = src.getBoundingClientRect(); const dpr = dprRef.current;
    const off = document.createElement("canvas"); off.width = r.width * dpr; off.height = r.height * dpr;
    const ctx = off.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0e1116"; ctx.fillRect(0, 0, r.width, r.height);
    for (const s of shapesRef.current) drawShape(ctx, s);
    off.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "aperture.png"; a.click(); URL.revokeObjectURL(a.href); });
  }, []);

  const share = () => { const link = `${location.origin}${location.pathname}?room=${uid()}`; navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>◎</span><span className="font-display text-lg">{T.brand}</span></span>
        </div>
        <div className="flex items-center gap-2">
          {/* presence */}
          <div className="hidden items-center gap-1 sm:flex">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: "var(--accent)", border: "2px solid var(--bg-2)" }}>{fa ? "تو" : "You"}</span>
              {GHOST_NAMES.map(([n, c]) => <span key={n} className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ background: c, border: "2px solid var(--bg-2)" }}>{n[0]}</span>)}
            </div>
            <span className="ms-1.5 flex items-center gap-1 text-xs text-[var(--fg-2)]"><span className="h-2 w-2 rounded-full" style={{ background: "#22c55e" }} />4 {T.online}</span>
          </div>
          <button onClick={share} className="btn btn-outline h-9 px-3 py-0 text-xs">{copied ? "✓ " + T.copied : "🔗 " + T.share}</button>
          <ThemePicker /><LangToggle />
        </div>
      </header>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex flex-wrap gap-1">
          {TOOLS.map((tl) => (
            <button key={tl.id} onClick={() => setTool(tl.id)} title={tl.label} className="grid h-9 w-9 place-items-center rounded-lg border text-base transition-colors" style={{ borderColor: tool === tl.id ? "var(--accent)" : "var(--line-2)", background: tool === tl.id ? "var(--accent)" : "transparent", color: tool === tl.id ? "var(--on-accent)" : "var(--fg)" }}>{tl.icon}</button>
          ))}
        </div>
        <span className="mx-1 h-6 w-px" style={{ background: "var(--line)" }} />
        <div className="flex items-center gap-1">
          {COLORS.map((c) => <button key={c} onClick={() => setColor(c)} className="h-6 w-6 rounded-full border-2" style={{ background: c, borderColor: color === c ? "var(--fg)" : "var(--line)" }} />)}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
        </div>
        <span className="mx-1 h-6 w-px" style={{ background: "var(--line)" }} />
        <label className="flex items-center gap-2 text-xs text-[var(--fg-2)]">{T.size}<input type="range" min={1} max={16} value={width} onChange={(e) => setWidth(+e.target.value)} className="w-24 accent-[var(--accent)]" /></label>
        <div className="ms-auto flex items-center gap-1">
          <button onClick={undo} disabled={!undoRef.current.length} className="btn btn-outline h-9 px-3 py-0 text-xs disabled:opacity-40">↶ {T.undo}</button>
          <button onClick={redo} disabled={!redoRef.current.length} className="btn btn-outline h-9 px-3 py-0 text-xs disabled:opacity-40">↷ {T.redo}</button>
          <button onClick={exportPNG} className="btn btn-outline h-9 px-3 py-0 text-xs">↓ PNG</button>
          <button onClick={clearAll} className="btn btn-outline h-9 px-3 py-0 text-xs hover:!border-[#ff6a6a] hover:!text-[#ff6a6a]">{T.clear}</button>
        </div>
      </div>

      {/* canvas */}
      <div className="relative min-h-0 flex-1" style={{ background: "var(--bg)", backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--fg) 12%, transparent) 1px, transparent 1px)", backgroundSize: "22px 22px" }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ cursor: tool === "select" ? "default" : tool === "eraser" ? "cell" : "crosshair" }}
        />
        <div className="pointer-events-none absolute bottom-3 start-3 rounded-full px-3 py-1 text-xs text-[var(--fg-2)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>
          {shapesRef.current.length} {T.shapes}
        </div>
      </div>
    </div>
  );
}
