"use client";

/* ================================================================== *
 * Aperture — side panels & overlays
 * ------------------------------------------------------------------
 * Presentational React components (Inspector, Layers, Minimap,
 * Templates, Shortcuts, Context menu, Align bar). They own no board
 * state — the canvas page passes the current selection plus callbacks.
 * ================================================================== */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Shape, Camera, Box, SavedBoard, BoardPrefs } from "./types";
import { bbox, unionBox, renderThumb, SHORTCUT_HELP, TEMPLATES, STENCILS, NOTE_COLORS, PALETTE, type AlignMode } from "./lib";

type L = { fa: boolean };

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-b px-3 py-3" style={{ borderColor: "var(--line)" }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-2)]">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--fg-2)]">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

const num = "w-16 rounded border bg-transparent px-1.5 py-1 text-xs mono outline-none";

/* ------------------------------------------------------------------ *
 * Inspector
 * ------------------------------------------------------------------ */
export function InspectorPanel({
  selected, fa, onPatch, onDelete, onDuplicate, onFront, onBack, onForward, onBackward,
  onAlign, onDistribute, onGroup, onUngroup, onTidy, onFlip, onMatch, onArray, onConnect, stats,
}: {
  selected: Shape[];
  fa: boolean;
  onPatch: (patch: Partial<Shape>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onFront: () => void;
  onBack: () => void;
  onForward: () => void;
  onBackward: () => void;
  onAlign: (m: AlignMode) => void;
  onDistribute: (axis: "h" | "v") => void;
  onGroup: () => void;
  onUngroup: () => void;
  onTidy: () => void;
  onFlip: (axis: "h" | "v") => void;
  onMatch: (dim: "w" | "h" | "both") => void;
  onArray: () => void;
  onConnect: () => void;
  stats: { total: number; byKind: Record<string, number>; w: number; h: number };
}) {
  const t = fa
    ? { title: "ویژگی‌ها", none: "چیزی انتخاب نشده", hint: "یک شکل را انتخاب کن تا اینجا ویرایش شود.", stroke: "رنگ خط", fill: "پُرکردن", fillC: "رنگ پُر", opacity: "شفافیت", width: "ضخامت", dash: "خط‌چین", corner: "گردی گوشه", sides: "اضلاع", rotate: "چرخش", font: "اندازه فونت", bold: "درشت", italic: "کج", align: "چینش", text: "متن", pos: "موقعیت", size: "اندازه", order: "ترتیب", front: "جلو", back: "عقب", fwd: "یک جلو", bwd: "یک عقب", lock: "قفل", hide: "پنهان", dup: "تکثیر", del: "حذف", multi: "شکل انتخاب‌شده", alignT: "ترازبندی", dist: "توزیع", group: "گروه", ungroup: "لغو گروه", flip: "قرینه", flipH: "افقی", flipV: "عمودی", tidy: "مرتب‌سازی شبکه‌ای", match: "هم‌اندازه", arrange: "چیدمان" }
    : { title: "Properties", none: "Nothing selected", hint: "Pick a shape to edit its properties here.", stroke: "Stroke", fill: "Fill", fillC: "Fill colour", opacity: "Opacity", width: "Width", dash: "Dash", corner: "Corner", sides: "Sides", rotate: "Rotate", font: "Font size", bold: "Bold", italic: "Italic", align: "Align", text: "Text", pos: "Position", size: "Size", order: "Order", front: "Front", back: "Back", fwd: "Forward", bwd: "Backward", lock: "Lock", hide: "Hide", dup: "Duplicate", del: "Delete", multi: "shapes selected", alignT: "Align", dist: "Distribute", group: "Group", ungroup: "Ungroup", flip: "Flip", flipH: "Horizontal", flipV: "Vertical", tidy: "Tidy grid", match: "Match size", arrange: "Arrange" };

  if (selected.length === 0) {
    return (
      <div className="thin-scroll overflow-y-auto">
        <div className="px-4 py-6 text-center">
          <div className="mb-2 text-2xl opacity-40">✦</div>
          <p className="text-sm font-medium">{t.none}</p>
          <p className="mt-1 text-xs text-[var(--fg-2)]">{t.hint}</p>
        </div>
        <Section title={fa ? "آمار بورد" : "Board stats"}>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border p-2" style={{ borderColor: "var(--line)" }}><div className="font-display text-lg">{stats.total}</div><div className="text-[10px] text-[var(--fg-2)]">{fa ? "کل" : "Total"}</div></div>
            <div className="rounded-lg border p-2" style={{ borderColor: "var(--line)" }}><div className="font-display text-lg">{stats.w}×{stats.h}</div><div className="text-[10px] text-[var(--fg-2)]">{fa ? "ابعاد" : "Extent"}</div></div>
          </div>
          <div className="mt-2 grid gap-1">
            {Object.entries(stats.byKind).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg px-2 py-1 text-xs" style={{ background: "var(--bg-3)" }}><span className="capitalize text-[var(--fg-2)]">{k}</span><span className="mono">{v}</span></div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  const s = selected[0];
  const many = selected.length > 1;
  const isTextual = !many && (s.kind === "text" || s.kind === "note");
  const b = bbox(s);

  const swatch = (val: string, set: (c: string) => void) => (
    <input type="color" value={/^#/.test(val) ? val : "#000000"} onChange={(e) => set(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
  );

  return (
    <div className="thin-scroll overflow-y-auto">
      <Section title={many ? `${selected.length} ${t.multi}` : t.title}>
        <div className="flex items-center gap-2">
          <button onClick={onDuplicate} className="btn btn-outline flex-1 py-1.5 text-xs" title={t.dup}>⧉ {t.dup}</button>
          <button onClick={onDelete} className="btn btn-outline flex-1 py-1.5 text-xs hover:!border-[#ff6a6a] hover:!text-[#ff6a6a]" title={t.del}>🗑 {t.del}</button>
        </div>
      </Section>

      <Section title={t.title}>
        <Row label={t.stroke}>{swatch(s.color, (c) => onPatch({ color: c }))}
          <div className="flex gap-0.5">{PALETTE.slice(2, 12).map((c) => <button key={c} onClick={() => onPatch({ color: c })} className="h-4 w-4 rounded-full border" style={{ background: c, borderColor: "var(--line)" }} />)}</div>
        </Row>
        <Row label={t.width}><input type="range" min={1} max={40} value={s.width} onChange={(e) => onPatch({ width: +e.target.value })} className="w-24 accent-[var(--accent)]" /><span className="mono w-6 text-end">{Math.round(s.width)}</span></Row>
        <Row label={t.opacity}><input type="range" min={10} max={100} value={Math.round((s.alpha ?? 1) * 100)} onChange={(e) => onPatch({ alpha: +e.target.value / 100 })} className="w-24 accent-[var(--accent)]" /><span className="mono w-8 text-end">{Math.round((s.alpha ?? 1) * 100)}%</span></Row>
        <Row label={t.dash}>
          <select value={s.dash ?? "solid"} onChange={(e) => onPatch({ dash: e.target.value as Shape["dash"] })} className="rounded border bg-transparent px-1.5 py-1 text-xs" style={{ borderColor: "var(--line)" }}>
            <option value="solid">──</option><option value="dashed">- -</option><option value="dotted">···</option>
          </select>
        </Row>
        {s.kind === "shape" && (
          <>
            <Row label={t.fill}>
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!s.fill} onChange={(e) => onPatch({ fill: e.target.checked })} className="h-3.5 w-3.5" /></label>
              {s.fill && swatch(s.fillColor || s.color, (c) => onPatch({ fillColor: c }))}
            </Row>
            {s.fill && <Row label={t.fillC}><input type="range" min={5} max={100} value={Math.round((s.fillAlpha ?? 0.32) * 100)} onChange={(e) => onPatch({ fillAlpha: +e.target.value / 100 })} className="w-24 accent-[var(--accent)]" /></Row>}
            {s.tool === "rect" && <Row label={t.corner}><input type="range" min={0} max={60} value={s.radius ?? 0} onChange={(e) => onPatch({ radius: +e.target.value })} className="w-24 accent-[var(--accent)]" /></Row>}
            {s.tool === "polygon" && <Row label={t.sides}><input type="range" min={3} max={12} value={s.sides ?? 6} onChange={(e) => onPatch({ sides: +e.target.value })} className="w-24 accent-[var(--accent)]" /><span className="mono w-6 text-end">{s.sides ?? 6}</span></Row>}
            <Row label={fa ? "سایه" : "Shadow"}><input type="checkbox" checked={!!s.shadow} onChange={(e) => onPatch({ shadow: e.target.checked })} className="h-3.5 w-3.5" /></Row>
          </>
        )}
        {!many && <Row label={t.rotate}><input type="range" min={0} max={360} value={Math.round(((s.rotation ?? 0) * 180) / Math.PI)} onChange={(e) => onPatch({ rotation: (+e.target.value * Math.PI) / 180 })} className="w-24 accent-[var(--accent)]" /><span className="mono w-8 text-end">{Math.round(((s.rotation ?? 0) * 180) / Math.PI)}°</span></Row>}
      </Section>

      {isTextual && (
        <Section title={t.text}>
          <textarea value={s.text ?? ""} onChange={(e) => onPatch({ text: e.target.value })} rows={3} className="thin-scroll w-full resize-y rounded-lg border bg-transparent p-2 text-sm outline-none" style={{ borderColor: "var(--line-2)" }} />
          <Row label={t.font}><input type="range" min={0} max={16} value={s.fontSize ?? 4} onChange={(e) => onPatch({ fontSize: +e.target.value })} className="w-24 accent-[var(--accent)]" /></Row>
          <div className="flex flex-wrap gap-2 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!s.bold} onChange={(e) => onPatch({ bold: e.target.checked })} className="h-3.5 w-3.5" />{t.bold}</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!s.italic} onChange={(e) => onPatch({ italic: e.target.checked })} className="h-3.5 w-3.5" />{t.italic}</label>
            {s.kind === "text" && (
              <select value={s.align ?? "left"} onChange={(e) => onPatch({ align: e.target.value as Shape["align"] })} className="rounded border bg-transparent px-1.5 py-0.5" style={{ borderColor: "var(--line)" }}>
                <option value="left">⬅</option><option value="center">⬌</option><option value="right">➡</option>
              </select>
            )}
          </div>
          {s.kind === "note" && <div className="mt-2 flex flex-wrap gap-1">{NOTE_COLORS.map((c) => <button key={c} onClick={() => onPatch({ color: c })} className="h-5 w-5 rounded border" style={{ background: c, borderColor: s.color === c ? "var(--fg)" : "var(--line)" }} />)}</div>}
        </Section>
      )}

      {!many && (
        <Section title={`${t.pos} · ${t.size}`}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-1"><span className="text-[var(--fg-2)]">X</span><input type="number" value={Math.round(b.x)} onChange={(e) => onPatch({ __move: { x: +e.target.value - b.x, y: 0 } } as never)} className={num} style={{ borderColor: "var(--line)" }} /></label>
            <label className="flex items-center gap-1"><span className="text-[var(--fg-2)]">Y</span><input type="number" value={Math.round(b.y)} onChange={(e) => onPatch({ __move: { x: 0, y: +e.target.value - b.y } } as never)} className={num} style={{ borderColor: "var(--line)" }} /></label>
            <label className="flex items-center gap-1"><span className="text-[var(--fg-2)]">W</span><input type="number" value={Math.round(b.w)} onChange={(e) => onPatch({ __resize: { x: b.x, y: b.y, w: Math.max(4, +e.target.value), h: b.h } } as never)} className={num} style={{ borderColor: "var(--line)" }} /></label>
            <label className="flex items-center gap-1"><span className="text-[var(--fg-2)]">H</span><input type="number" value={Math.round(b.h)} onChange={(e) => onPatch({ __resize: { x: b.x, y: b.y, w: b.w, h: Math.max(4, +e.target.value) } } as never)} className={num} style={{ borderColor: "var(--line)" }} /></label>
          </div>
        </Section>
      )}

      {many && (
        <Section title={t.alignT}>
          <div className="grid grid-cols-3 gap-1">
            {([["left", "⬅"], ["hcenter", "⬌"], ["right", "➡"], ["top", "⬆"], ["vcenter", "⬍"], ["bottom", "⬇"]] as [AlignMode, string][]).map(([m, ic]) => (
              <button key={m} onClick={() => onAlign(m)} className="btn btn-outline py-1.5 text-sm" title={m}>{ic}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-1">
            <button onClick={() => onDistribute("h")} className="btn btn-outline flex-1 py-1.5 text-xs">{t.dist} ↔</button>
            <button onClick={() => onDistribute("v")} className="btn btn-outline flex-1 py-1.5 text-xs">{t.dist} ↕</button>
          </div>
          <div className="mt-2 flex gap-1">
            <button onClick={onGroup} className="btn btn-outline flex-1 py-1.5 text-xs">⧉ {t.group}</button>
            <button onClick={onUngroup} className="btn btn-outline flex-1 py-1.5 text-xs">{t.ungroup}</button>
          </div>
        </Section>
      )}

      <Section title={t.arrange}>
        <div className="flex gap-1">
          <button onClick={() => onFlip("h")} className="btn btn-outline flex-1 py-1.5 text-xs" title={t.flipH}>⇋ {t.flipH}</button>
          <button onClick={() => onFlip("v")} className="btn btn-outline flex-1 py-1.5 text-xs" title={t.flipV}>⇅ {t.flipV}</button>
          <button onClick={onArray} className="btn btn-outline flex-1 py-1.5 text-xs" title={fa ? "تکرار شبکه‌ای" : "Repeat in a grid"}>⋯ {fa ? "آرایه" : "Array"}</button>
        </div>
        {selected.length === 2 && <button onClick={onConnect} className="btn btn-outline mt-2 w-full py-1.5 text-xs">↔ {fa ? "اتصال دو شکل" : "Connect the two shapes"}</button>}
        {many && (
          <div className="mt-2 grid grid-cols-2 gap-1">
            <button onClick={onTidy} className="btn btn-outline py-1.5 text-xs">▦ {t.tidy}</button>
            <button onClick={() => onMatch("both")} className="btn btn-outline py-1.5 text-xs">▭ {t.match}</button>
            <button onClick={() => onMatch("w")} className="btn btn-outline py-1.5 text-xs">↔ W</button>
            <button onClick={() => onMatch("h")} className="btn btn-outline py-1.5 text-xs">↕ H</button>
          </div>
        )}
      </Section>

      <Section title={t.order}>
        <div className="grid grid-cols-2 gap-1">
          <button onClick={onFront} className="btn btn-outline py-1.5 text-xs">⤒ {t.front}</button>
          <button onClick={onBack} className="btn btn-outline py-1.5 text-xs">⤓ {t.back}</button>
          <button onClick={onForward} className="btn btn-outline py-1.5 text-xs">↑ {t.fwd}</button>
          <button onClick={onBackward} className="btn btn-outline py-1.5 text-xs">↓ {t.bwd}</button>
        </div>
        <div className="mt-2 flex gap-3 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!s.locked} onChange={(e) => onPatch({ locked: e.target.checked })} className="h-3.5 w-3.5" />{t.lock}</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!s.hidden} onChange={(e) => onPatch({ hidden: e.target.checked })} className="h-3.5 w-3.5" />{t.hide}</label>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Layers
 * ------------------------------------------------------------------ */
const kindIcon: Record<string, string> = { stroke: "✎", shape: "▭", note: "▤", text: "T", image: "🖼" };

export function LayersPanel({
  shapes, selectedIds, fa, onSelect, onToggleHidden, onToggleLocked, onDelete, onReorder, onLockAll, onShowAll,
}: {
  shapes: Shape[];
  selectedIds: Set<string>;
  fa: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  onLockAll: (lock: boolean) => void;
  onShowAll: () => void;
}) {
  const t = fa ? { title: "لایه‌ها", empty: "هنوز چیزی روی بوم نیست.", lockAll: "قفل همه", unlockAll: "باز کردن همه", showAll: "نمایش همه" } : { title: "Layers", empty: "Nothing on the board yet.", lockAll: "Lock all", unlockAll: "Unlock all", showAll: "Show all" };
  const label = (s: Shape) => s.name || (s.text ? s.text.slice(0, 18) : "") || `${s.kind} · ${s.tool}`;
  const list = [...shapes].reverse(); // top of z-order first

  return (
    <div className="thin-scroll overflow-y-auto">
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--line)" }}>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-2)]">{t.title} · {shapes.length}</span>
        <div className="flex gap-1">
          <button onClick={() => onLockAll(true)} title={t.lockAll} className="rounded px-1 text-xs hover:bg-[var(--bg-3)]">🔒</button>
          <button onClick={() => onLockAll(false)} title={t.unlockAll} className="rounded px-1 text-xs hover:bg-[var(--bg-3)]">🔓</button>
          <button onClick={onShowAll} title={t.showAll} className="rounded px-1 text-xs hover:bg-[var(--bg-3)]">👁</button>
        </div>
      </div>
      {list.length === 0 && <p className="px-3 py-6 text-center text-xs text-[var(--fg-2)]">{t.empty}</p>}
      <div className="p-1.5">
        {list.map((s) => {
          const active = selectedIds.has(s.id);
          return (
            <div key={s.id} onClick={(e) => onSelect(s.id, e.shiftKey || e.metaKey || e.ctrlKey)}
              className="group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
              style={active ? { background: "color-mix(in srgb, var(--accent) 18%, transparent)", boxShadow: "inset 2px 0 0 var(--accent)" } : {}}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded" style={{ background: s.kind === "shape" || s.kind === "stroke" ? s.color : "var(--bg-3)", color: s.kind === "shape" || s.kind === "stroke" ? "#fff" : "var(--fg-2)" }}>{kindIcon[s.kind]}</span>
              <span className="min-w-0 flex-1 truncate" style={{ opacity: s.hidden ? 0.4 : 1 }}>{label(s)}</span>
              <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={(e) => { e.stopPropagation(); onReorder(s.id, 1); }} title="up" className="rounded px-1 hover:bg-[var(--bg-3)]">↑</button>
                <button onClick={(e) => { e.stopPropagation(); onReorder(s.id, -1); }} title="down" className="rounded px-1 hover:bg-[var(--bg-3)]">↓</button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }} title="delete" className="rounded px-1 hover:bg-[var(--bg-3)]">🗑</button>
              </span>
              <button onClick={(e) => { e.stopPropagation(); onToggleLocked(s.id); }} title="lock" className="rounded px-0.5" style={{ opacity: s.locked ? 1 : 0.35 }}>{s.locked ? "🔒" : "🔓"}</button>
              <button onClick={(e) => { e.stopPropagation(); onToggleHidden(s.id); }} title="hide" className="rounded px-0.5" style={{ opacity: s.hidden ? 1 : 0.5 }}>{s.hidden ? "🙈" : "👁"}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Find — search text across notes, comments, labels & text
 * ------------------------------------------------------------------ */
export function FindPanel({ shapes, fa, onJump }: { shapes: Shape[]; fa: boolean; onJump: (id: string) => void }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = query ? shapes.filter((s) => (s.text || "").toLowerCase().includes(query)) : shapes.filter((s) => s.text);
  const t = fa ? { ph: "جست‌وجوی متن…", none: "چیزی پیدا نشد.", hint: "متن یادداشت‌ها، کامنت‌ها، برچسب‌ها و متن‌ها." } : { ph: "Search text…", none: "No matches.", hint: "Searches notes, comments, labels & text." };
  return (
    <div className="thin-scroll overflow-y-auto">
      <div className="border-b p-3" style={{ borderColor: "var(--line)" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.ph} className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--line-2)" }} />
        <p className="mt-1.5 text-[11px] text-[var(--fg-2)]">{t.hint}</p>
      </div>
      <div className="p-1.5">
        {results.length === 0 && <p className="px-2 py-6 text-center text-xs text-[var(--fg-2)]">{t.none}</p>}
        {results.map((s) => (
          <button key={s.id} onClick={() => onJump(s.id)} className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs transition-colors hover:bg-[var(--bg-3)]">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded" style={{ background: "var(--bg-3)" }}>{kindIcon[s.kind]}</span>
            <span className="min-w-0 flex-1 truncate">{(s.text || "").slice(0, 40) || "—"}</span>
            <span className="text-[10px] text-[var(--fg-2)]">{s.kind}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Minimap
 * ------------------------------------------------------------------ */
const MM_W = 200, MM_H = 140;
function minimapWorld(shapes: Shape[], viewport: Box): Box {
  const content = unionBox(shapes.filter((s) => !s.hidden));
  const parts = [viewport, ...(content ? [content] : [])];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of parts) { minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
  const pad = Math.max((maxX - minX), (maxY - minY)) * 0.08 + 40;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

export function Minimap({ getShapes, getViewport, getImg, onNavigate, bgColor }: {
  getShapes: () => Shape[];
  getViewport: () => Box;
  getImg: (src: string) => HTMLImageElement;
  onNavigate: (world: { x: number; y: number }) => void;
  bgColor: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // self-updating loop so the map tracks panning, zooming and live edits
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = MM_W * dpr; c.height = MM_H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    const loop = () => {
      const shapes = getShapes(); const viewport = getViewport();
      const world = minimapWorld(shapes, viewport);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, MM_W, MM_H);
      renderThumb(ctx, shapes.filter((s) => !s.hidden), getImg, world, { w: MM_W, h: MM_H }, bgColor);
      const scale = Math.min(MM_W / world.w, MM_H / world.h) * 0.9;
      const ox = (MM_W - world.w * scale) / 2, oy = (MM_H - world.h * scale) / 2;
      ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + (viewport.x - world.x) * scale, oy + (viewport.y - world.y) * scale, viewport.w * scale, viewport.h * scale);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nav = (e: React.MouseEvent) => {
    const c = ref.current!; const r = c.getBoundingClientRect();
    const world = minimapWorld(getShapes(), getViewport());
    const scale = Math.min(MM_W / world.w, MM_H / world.h) * 0.9;
    const ox = (MM_W - world.w * scale) / 2, oy = (MM_H - world.h * scale) / 2;
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    onNavigate({ x: world.x + (mx - ox) / scale, y: world.y + (my - oy) / scale });
  };

  return (
    <div className="overflow-hidden rounded-xl border shadow-lg" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
      <canvas ref={ref} onClick={nav} style={{ width: MM_W, height: MM_H, cursor: "pointer", display: "block" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Templates gallery
 * ------------------------------------------------------------------ */
export function TemplatesModal({ open, fa, onClose, onPick, onPickStencil }: { open: boolean; fa: boolean; onClose: () => void; onPick: (id: string) => void; onPickStencil: (id: string) => void }) {
  if (!open) return null;
  return (
    <Overlay onClose={onClose}>
      <div className="thin-scroll max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg">{fa ? "الگوها و استنسیل‌ها" : "Templates & Stencils"}</h3>
          <button onClick={onClose} className="btn btn-outline px-2.5 py-1 text-xs">✕</button>
        </div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-2)]">{fa ? "الگوهای کامل" : "Full templates"}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} onClick={() => { onPick(tpl.id); onClose(); }}
              className="card-lift flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-transform hover:scale-[1.02]" style={{ borderColor: "var(--line-2)" }}>
              <span className="text-3xl">{tpl.icon}</span>
              <span className="text-sm font-medium">{fa ? tpl.faName : tpl.name}</span>
            </button>
          ))}
        </div>
        <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-2)]">{fa ? "استنسیل‌های تک‌گره" : "Single-node stencils"}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {STENCILS.map((st) => (
            <button key={st.id} onClick={() => { onPickStencil(st.id); onClose(); }}
              className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors hover:bg-[var(--bg-3)]" style={{ borderColor: "var(--line-2)" }}>
              <span className="text-2xl">{st.icon}</span>
              <span className="text-xs">{fa ? st.faName : st.name}</span>
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ *
 * Shortcuts help
 * ------------------------------------------------------------------ */
export function ShortcutsModal({ open, fa, onClose }: { open: boolean; fa: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg">{fa ? "میان‌برهای صفحه‌کلید" : "Keyboard shortcuts"}</h3>
          <button onClick={onClose} className="btn btn-outline px-2.5 py-1 text-xs">✕</button>
        </div>
        <div className="thin-scroll grid max-h-[60vh] gap-1.5 overflow-y-auto">
          {SHORTCUT_HELP.map((sc) => (
            <div key={sc.keys} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm" style={{ background: "var(--bg-3)" }}>
              <span className="text-[var(--fg-2)]">{fa ? sc.fa : sc.en}</span>
              <span className="mono rounded border px-2 py-0.5 text-xs" style={{ borderColor: "var(--line-2)" }}>{sc.keys}</span>
            </div>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ *
 * Context menu
 * ------------------------------------------------------------------ */
export type MenuItem = { label: string; icon?: string; onClick: () => void; danger?: boolean; sep?: boolean };

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", onClose, true);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("scroll", onClose, true); };
  }, [onClose]);
  return (
    <div ref={ref} className="fixed z-50 min-w-[168px] overflow-hidden rounded-xl border py-1 shadow-xl" style={{ left: x, top: y, borderColor: "var(--line)", background: "var(--bg-2)" }}>
      {items.map((it, i) => it.sep ? <div key={i} className="my-1 h-px" style={{ background: "var(--line)" }} /> : (
        <button key={i} onClick={() => { it.onClick(); onClose(); }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-sm transition-colors hover:bg-[var(--bg-3)]" style={{ color: it.danger ? "#ff6a6a" : "var(--fg)" }}>
          <span className="w-4 text-center opacity-70">{it.icon}</span>{it.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board manager
 * ------------------------------------------------------------------ */
export function BoardsModal({ open, fa, boards, onClose, onSave, onLoad, onRename, onDelete }: {
  open: boolean; fa: boolean; boards: SavedBoard[];
  onClose: () => void; onSave: (name: string) => void; onLoad: (id: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  if (!open) return null;
  const t = fa
    ? { title: "بوردهای من", save: "ذخیره بورد فعلی", ph: "نام بورد…", empty: "هنوز بوردی ذخیره نشده.", load: "بازکردن", rename: "تغییر نام", del: "حذف", shapes: "شکل", promptRename: "نام جدید:" }
    : { title: "My boards", save: "Save current board", ph: "Board name…", empty: "No saved boards yet.", load: "Open", rename: "Rename", del: "Delete", shapes: "shapes", promptRename: "New name:" };
  return (
    <Overlay onClose={onClose}>
      <div className="thin-scroll max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg">{t.title}</h3>
          <button onClick={onClose} className="btn btn-outline px-2.5 py-1 text-xs">✕</button>
        </div>
        <div className="mb-4 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.ph} className="flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--line-2)" }} />
          <button onClick={() => { onSave(name); setName(""); }} className="btn btn-accent px-3 py-2 text-xs">💾 {t.save}</button>
        </div>
        {boards.length === 0 && <p className="py-6 text-center text-xs text-[var(--fg-2)]">{t.empty}</p>}
        <div className="grid gap-2">
          {boards.map((b) => (
            <div key={b.id} className="flex items-center gap-2 rounded-lg border p-2.5" style={{ borderColor: "var(--line-2)" }}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{b.name}</div>
                <div className="text-[11px] text-[var(--fg-2)]">{b.shapes.length} {t.shapes} · {new Date(b.updated).toLocaleString()}</div>
              </div>
              <button onClick={() => { onLoad(b.id); onClose(); }} className="btn btn-outline px-2.5 py-1 text-xs">{t.load}</button>
              <button onClick={() => { const n = window.prompt(t.promptRename, b.name); if (n) onRename(b.id, n); }} className="btn btn-outline px-2 py-1 text-xs">✎</button>
              <button onClick={() => onDelete(b.id)} className="btn btn-outline px-2 py-1 text-xs hover:!border-[#ff6a6a] hover:!text-[#ff6a6a]">🗑</button>
            </div>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ *
 * Style presets bar
 * ------------------------------------------------------------------ */
export function PresetsBar({ presets, fa, onApply, onAddCurrent, onRemove }: {
  presets: { id: string; color: string; width: number; opacity: number; dash: string; fill: boolean }[];
  fa: boolean;
  onApply: (id: string) => void;
  onAddCurrent: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="border-t px-3 py-2.5" style={{ borderColor: "var(--line)" }}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-2)]">{fa ? "استایل‌ها" : "Styles"}</span>
        <button onClick={onAddCurrent} className="chip" title={fa ? "ذخیره استایل فعلی" : "Save current style"}>＋</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p.id} onClick={() => onApply(p.id)} onContextMenu={(e) => { e.preventDefault(); onRemove(p.id); }}
            title={`${p.width}px · ${Math.round(p.opacity * 100)}%${p.fill ? " · fill" : ""}`}
            className="grid h-8 w-8 place-items-center rounded-lg border transition-transform hover:scale-110" style={{ borderColor: "var(--line-2)" }}>
            <span className="rounded-full" style={{ width: Math.min(20, 4 + p.width), height: Math.min(20, 4 + p.width), background: p.color, opacity: p.opacity, outline: p.fill ? `2px solid ${p.color}` : "none", outlineOffset: 1, borderStyle: p.dash === "solid" ? "none" : "dashed" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Emoji / sticker stamp picker
 * ------------------------------------------------------------------ */
export function StampPicker({ stamps, active, onPick }: { stamps: string[]; active: string; onPick: (s: string) => void }) {
  return (
    <div className="absolute z-40 mt-1 grid w-56 grid-cols-6 gap-1 rounded-xl border p-2 shadow-xl" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
      {stamps.map((s) => (
        <button key={s} onClick={() => onPick(s)} className="grid h-8 w-8 place-items-center rounded-lg text-lg transition-colors hover:bg-[var(--bg-3)]" style={active === s ? { background: "var(--bg-3)", boxShadow: "inset 0 0 0 1.5px var(--accent)" } : {}}>{s}</button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Preferences
 * ------------------------------------------------------------------ */
export function PrefsModal({ open, fa, prefs, onClose, onChange }: {
  open: boolean; fa: boolean; prefs: BoardPrefs; onClose: () => void; onChange: (p: Partial<BoardPrefs>) => void;
}) {
  if (!open) return null;
  const t = fa
    ? { title: "تنظیمات", bg: "پس‌زمینه خروجی", font: "اندازه فونت پیش‌فرض", autofit: "جای‌دهی خودکار هنگام باز شدن", coords: "نمایش مختصات نشانگر" }
    : { title: "Preferences", bg: "Export background", font: "Default font size", autofit: "Auto-fit on load", coords: "Show cursor coordinates" };
  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-sm rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg">{t.title}</h3>
          <button onClick={onClose} className="btn btn-outline px-2.5 py-1 text-xs">✕</button>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="flex items-center justify-between"><span>{t.bg}</span><input type="color" value={prefs.exportBg} onChange={(e) => onChange({ exportBg: e.target.value })} className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0" /></div>
          <div className="flex items-center justify-between gap-3"><span>{t.font}</span><input type="range" min={0} max={12} value={prefs.defaultFont} onChange={(e) => onChange({ defaultFont: +e.target.value })} className="w-32 accent-[var(--accent)]" /></div>
          <label className="flex items-center justify-between"><span>{t.autofit}</span><input type="checkbox" checked={prefs.autoFit} onChange={(e) => onChange({ autoFit: e.target.checked })} className="h-4 w-4" /></label>
          <label className="flex items-center justify-between"><span>{t.coords}</span><input type="checkbox" checked={prefs.showCoords} onChange={(e) => onChange({ showCoords: e.target.checked })} className="h-4 w-4" /></label>
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ *
 * Status bar
 * ------------------------------------------------------------------ */
export function StatusBar({ fa, zoom, total, selCount, selBox, cursor, showCoords }: {
  fa: boolean; zoom: number; total: number; selCount: number; selBox: Box | null; cursor: { x: number; y: number } | null; showCoords: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-4 px-3 py-1 text-[11px] mono" style={{ color: "var(--fg-2)" }}>
      <span className="rounded-md px-2 py-0.5" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>{zoom}%</span>
      <span className="rounded-md px-2 py-0.5" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>{total} {fa ? "شکل" : "shapes"}</span>
      {selCount > 0 && <span className="rounded-md px-2 py-0.5" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>{selCount} {fa ? "انتخاب" : "selected"}{selBox ? ` · ${Math.round(selBox.w)}×${Math.round(selBox.h)}` : ""}</span>}
      {showCoords && cursor && <span className="ms-auto rounded-md px-2 py-0.5" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }}>x {Math.round(cursor.x)} · y {Math.round(cursor.y)}</span>}
    </div>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      {children}
    </div>
  );
}

/* A tiny thumbnail preview used in tests / potential reuse. */
export function ShapeThumb({ shape, getImg, size = 40 }: { shape: Shape; getImg: (src: string) => HTMLImageElement; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const b = bbox(shape);
    renderThumb(ctx, [shape], getImg, b, { w: size, h: size }, "transparent");
  });
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}
