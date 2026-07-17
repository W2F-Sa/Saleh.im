"use client";

/*
  Nota — an offline-first, markdown-native knowledge base (a real product).

  All client-side (localStorage, no server, no account). Highlights:
    • Full markdown editor with a formatting toolbar and a live preview
      (edit / split / preview view modes + a distraction-free zen mode).
    • Markdown: h1–h6, bold/italic/strike, inline + fenced code, quotes, rules,
      ordered/unordered lists, clickable task lists, tables, images, links,
      auto-linked bare URLs, and [[wiki links]] that create-or-open notes.
    • Organisation: notebooks (folders), favourites, pinning, note colours,
      #tags rail, sort field + direction, and instant full-text search with
      match highlighting.
    • A per-note table of contents (click to scroll), automatic backlinks,
      a word goal with progress, reading time and live stats.
    • Soft-delete trash (restore / delete forever / empty), templates,
      duplicate, per-note .md export + copy, import .md files, export all,
      whole-library JSON export/import, and keyboard shortcuts.
    • Fully bilingual (English / Persian) and theme-aware.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";

type Note = { id: string; title: string; body: string; created: number; updated: number; pinned?: boolean; fav?: boolean; color?: string; folder?: string; trashed?: boolean; goal?: number };
type SortMode = "updated" | "created" | "title";
type ViewMode = "edit" | "split" | "preview";
type EditorFont = "mono" | "sans" | "serif";
type ReadWidth = "narrow" | "normal" | "wide";
type Prefs = { editorFont: EditorFont; fontSize: number; readWidth: ReadWidth; spellcheck: boolean; autoPair: boolean; smartLists: boolean; typewriter: boolean; compactList: boolean };
type Snapshot = { t: number; body: string; title: string };

const STORE = "nota:notes:v1";
const PREFS_STORE = "nota:prefs:v1";
const HIST_STORE = "nota:history:v1";
const HIST_MAX = 25; // snapshots kept per note
const uid = () => Math.random().toString(36).slice(2, 10);
const NOTE_COLORS = ["", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];
const DEFAULT_PREFS: Prefs = { editorFont: "mono", fontSize: 14, readWidth: "normal", spellcheck: false, autoPair: true, smartLists: true, typewriter: false, compactList: false };
const FONT_STACK: Record<EditorFont, string> = {
  mono: "var(--font-mono, ui-monospace), monospace",
  sans: "var(--font-sans, ui-sans-serif), system-ui",
  serif: "var(--font-display, ui-serif), Georgia, serif",
};
const READ_MAXW: Record<ReadWidth, string> = { narrow: "38rem", normal: "52rem", wide: "72rem" };

const seed = (fa: boolean): Note[] => {
  const now = Date.now();
  return [
    {
      id: uid(), pinned: true, fav: true, updated: now, created: now, folder: fa ? "شروع" : "Getting started",
      title: fa ? "به نوتا خوش آمدی" : "Welcome to Nota",
      body: fa
        ? "# سلام 👋\n\nنوتا یک **پایگاهِ دانشِ آفلاین‌محور** است. همه‌چیز فقط در مرورگرِ تو ذخیره می‌شود.\n\n## چه کارهایی می‌کنی؟\n- نوشتن با **مارک‌داون** و پیش‌نمایشِ زنده\n- دفترچه، علاقه‌مندی، سنجاق و رنگ\n- پیوند با `[[عنوان]]` و برچسب با #راهنما\n- جدول، تصویر، فهرستِ کارها\n\n| ویژگی | پشتیبانی |\n| --- | --- |\n| جدول | ✅ |\n| کارها | ✅ |\n\n> نوارِ ابزار بالای ویرایشگر را امتحان کن.\n\n- [x] نوتا را باز کن\n- [ ] اولین یادداشتت را بنویس\n\nنگاهی بینداز به [[ایده‌ها]] یا https://saleh.im"
        : "# Hello 👋\n\nNota is an **offline-first knowledge base**. Everything is stored only in your browser.\n\n## What can you do?\n- Write in **markdown** with a live preview\n- Notebooks, favourites, pinning and colours\n- Link with `[[Title]]` and tag with #guide\n- Tables, images, task lists\n\n| Feature | Supported |\n| --- | --- |\n| Tables | ✅ |\n| Tasks | ✅ |\n\n> Try the toolbar above the editor.\n\n- [x] Open Nota\n- [ ] Write your first note\n\nTake a look at [[Ideas]] or https://saleh.im",
    },
    {
      id: uid(), updated: now - 1000, created: now - 1000, folder: fa ? "شروع" : "Getting started",
      title: fa ? "ایده‌ها" : "Ideas",
      body: fa ? "# ایده‌ها\n\nهرچه به ذهنت رسید اینجا بنویس. #ایده\n\n1. یک اپِ آب‌وهوا\n2. بازنویسیِ رزومه\n\nبرگرد به [[به نوتا خوش آمدی]]." : "# Ideas\n\nCapture anything here. #idea\n\n1. A weather app\n2. Rewrite the résumé\n\nBack to [[Welcome to Nota]].",
    },
  ];
};

/* ----------------------------- markdown ----------------------------- */
function InlineMD({ text, onLink, hl }: { text: string; onLink: (t: string) => void; hl?: string }) {
  const nodes: React.ReactNode[] = [];
  let rest = text; let key = 0;
  const re = /(!\[[^\]]*\]\([^)]+\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)]+\))|(https?:\/\/[^\s)]+)/;
  const push = (s: string) => { if (hl && s) { const parts = s.split(new RegExp(`(${hl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig")); parts.forEach((p, i) => nodes.push(p.toLowerCase() === hl.toLowerCase() ? <mark key={key++} style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 3 }}>{p}</mark> : <span key={key++}>{p}</span>)); } else nodes.push(<span key={key++}>{s}</span>); };
  while (rest.length) {
    const m = rest.match(re);
    if (!m || m.index === undefined) { push(rest); break; }
    if (m.index > 0) push(rest.slice(0, m.index));
    const tok = m[0];
    if (tok.startsWith("![")) { const mm = tok.match(/!\[([^\]]*)\]\(([^)]+)\)/)!; nodes.push(<img key={key++} src={mm[2]} alt={mm[1]} className="my-2 max-h-80 max-w-full rounded-lg" />); }
    else if (tok.startsWith("`")) nodes.push(<code key={key++} className="rounded px-1.5 py-0.5 mono text-[0.85em]" style={{ background: "var(--bg-3)", color: "var(--accent)" }}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) nodes.push(<b key={key++}>{tok.slice(2, -2)}</b>);
    else if (tok.startsWith("~~")) nodes.push(<s key={key++} className="opacity-70">{tok.slice(2, -2)}</s>);
    else if (tok.startsWith("*")) nodes.push(<i key={key++}>{tok.slice(1, -1)}</i>);
    else if (tok.startsWith("[[")) { const title = tok.slice(2, -2).trim(); nodes.push(<button key={key++} onClick={() => onLink(title)} className="rounded px-1 font-medium underline decoration-dotted underline-offset-2" style={{ color: "var(--accent)" }}>{title}</button>); }
    else if (tok.startsWith("[")) { const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)!; nodes.push(<a key={key++} href={mm[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>{mm[1]}</a>); }
    else nodes.push(<a key={key++} href={tok} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>{tok}</a>);
    rest = rest.slice(m.index + tok.length);
  }
  return <>{nodes}</>;
}

function Markdown({ src, onLink, onToggleTask, hl }: { src: string; onLink: (t: string) => void; onToggleTask?: (i: number) => void; hl?: string }) {
  const lines = src.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0, key = 0, taskIdx = 0;
  let ul: React.ReactNode[] | null = null, ol: React.ReactNode[] | null = null;
  const flush = () => { if (ul) { out.push(<ul key={key++} className="my-2 space-y-1 ps-6">{ul}</ul>); ul = null; } if (ol) { out.push(<ol key={key++} className="my-2 list-decimal space-y-1 ps-6">{ol}</ol>); ol = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) { flush(); const buf: string[] = []; i++; while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; } i++; out.push(<pre key={key++} className="my-2 overflow-x-auto rounded-xl p-3 mono text-[13px] force-ltr" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}><code>{buf.join("\n")}</code></pre>); continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      flush(); const pr = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()); const header = pr(line); i += 2; const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(pr(lines[i])); i++; }
      out.push(<div key={key++} className="my-3 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr>{header.map((h, j) => <th key={j} className="border px-3 py-1.5 text-start font-semibold" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}><InlineMD text={h} onLink={onLink} hl={hl} /></th>)}</tr></thead><tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border px-3 py-1.5" style={{ borderColor: "var(--line)" }}><InlineMD text={c} onLink={onLink} hl={hl} /></td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) { flush(); const level = line.match(/^#+/)![0].length; const txt = line.replace(/^#+\s/, ""); const sizes = ["text-2xl font-display", "text-xl font-semibold", "text-lg font-semibold", "text-base font-semibold", "text-sm font-semibold", "text-sm font-semibold opacity-80"]; out.push(<div key={key++} id={"h-" + slug(txt)} className={"mt-3 mb-1 scroll-mt-4 " + sizes[level - 1]}><InlineMD text={txt} onLink={onLink} hl={hl} /></div>); }
    else if (/^>\s/.test(line)) { flush(); out.push(<blockquote key={key++} className="my-2 border-s-2 ps-3 text-[var(--fg-2)]" style={{ borderColor: "var(--accent)" }}><InlineMD text={line.replace(/^>\s/, "")} onLink={onLink} hl={hl} /></blockquote>); }
    else if (/^---+\s*$/.test(line)) { flush(); out.push(<hr key={key++} className="my-3" style={{ borderColor: "var(--line)" }} />); }
    else if (/^\s*-\s\[[ x]\]\s/i.test(line)) { const checked = /\[x\]/i.test(line); const txt = line.replace(/^\s*-\s\[[ x]\]\s/i, ""); const ti = taskIdx++; ul = ul || []; ul.push(<li key={key++} className="flex list-none items-start gap-2 -ms-6"><button onClick={() => onToggleTask?.(ti)} className="mt-0.5" style={{ color: checked ? "var(--accent)" : "var(--fg-2)" }}>{checked ? "☑" : "☐"}</button><span className={checked ? "line-through opacity-60" : ""}><InlineMD text={txt} onLink={onLink} hl={hl} /></span></li>); }
    else if (/^\s*\d+\.\s/.test(line)) { ol = ol || []; ol.push(<li key={key++}><InlineMD text={line.replace(/^\s*\d+\.\s/, "")} onLink={onLink} hl={hl} /></li>); }
    else if (/^\s*[-*]\s/.test(line)) { ul = ul || []; ul.push(<li key={key++} className="list-disc"><InlineMD text={line.replace(/^\s*[-*]\s/, "")} onLink={onLink} hl={hl} /></li>); }
    else if (line.trim() === "") flush();
    else { flush(); out.push(<p key={key++} className="my-1.5 leading-relaxed"><InlineMD text={line} onLink={onLink} hl={hl} /></p>); }
    i++;
  }
  flush();
  return <div className="text-[15px]">{out}</div>;
}

const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\d]+/gu, "-").replace(/^-|-$/g, "");
const tagsOf = (b: string) => Array.from(new Set((b.match(/(^|\s)#([\p{L}\d_-]+)/gu) || []).map((t) => t.trim().replace(/^#/, "").toLowerCase())));
const linksOf = (b: string) => Array.from(new Set((b.match(/\[\[([^\]]+)\]\]/g) || []).map((t) => t.slice(2, -2).trim().toLowerCase())));
const headingsOf = (b: string) => b.split("\n").filter((l) => /^#{1,6}\s/.test(l)).map((l) => ({ level: l.match(/^#+/)![0].length, text: l.replace(/^#+\s/, "") }));

/* Standalone markdown → HTML (used for .html export, print and copy-as-HTML).
   Deliberately a self-contained subset that mirrors the on-screen renderer. */
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inlineHtml(t: string): string {
  return escapeHtml(t)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[\[([^\]]+)\]\]/g, "<span class=\"wl\">$1</span>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[^"(])(https?:\/\/[^\s)]+)/g, '$1<a href="$2">$2</a>');
}
function mdToHtml(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0, ul = false, ol = false;
  const closeLists = () => { if (ul) { out.push("</ul>"); ul = false; } if (ol) { out.push("</ol>"); ol = false; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) { closeLists(); const buf: string[] = []; i++; while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; } i++; out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`); continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      closeLists(); const pr = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()); const header = pr(line); i += 2; const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(pr(lines[i])); i++; }
      out.push(`<table><thead><tr>${header.map((h) => `<th>${inlineHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inlineHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (/^#{1,6}\s/.test(line)) { closeLists(); const lv = line.match(/^#+/)![0].length; out.push(`<h${lv}>${inlineHtml(line.replace(/^#+\s/, ""))}</h${lv}>`); }
    else if (/^>\s/.test(line)) { closeLists(); out.push(`<blockquote>${inlineHtml(line.replace(/^>\s/, ""))}</blockquote>`); }
    else if (/^---+\s*$/.test(line)) { closeLists(); out.push("<hr/>"); }
    else if (/^\s*-\s\[[ x]\]\s/i.test(line)) { if (!ul) { closeLists(); out.push("<ul>"); ul = true; } const ck = /\[x\]/i.test(line); out.push(`<li>${ck ? "☑" : "☐"} ${inlineHtml(line.replace(/^\s*-\s\[[ x]\]\s/i, ""))}</li>`); }
    else if (/^\s*\d+\.\s/.test(line)) { if (!ol) { closeLists(); out.push("<ol>"); ol = true; } out.push(`<li>${inlineHtml(line.replace(/^\s*\d+\.\s/, ""))}</li>`); }
    else if (/^\s*[-*]\s/.test(line)) { if (!ul) { closeLists(); out.push("<ul>"); ul = true; } out.push(`<li>${inlineHtml(line.replace(/^\s*[-*]\s/, ""))}</li>`); }
    else if (line.trim() === "") closeLists();
    else { closeLists(); out.push(`<p>${inlineHtml(line)}</p>`); }
    i++;
  }
  closeLists();
  return out.join("\n");
}
const HTML_DOC = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif;line-height:1.65;max-width:46rem;margin:2.5rem auto;padding:0 1.25rem;color:#1a1a1a}h1,h2,h3{line-height:1.25}code{background:#f2f2f2;padding:.1em .35em;border-radius:4px;font-size:.9em}pre{background:#f6f6f6;padding:1rem;border-radius:10px;overflow:auto}pre code{background:none;padding:0}blockquote{border-inline-start:3px solid #ccc;margin:0;padding:.2rem 0 .2rem 1rem;color:#555}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:.4rem .6rem;text-align:start}img{max-width:100%;border-radius:8px}.wl{color:#2563eb;border-bottom:1px dotted #2563eb}a{color:#2563eb}hr{border:none;border-top:1px solid #ddd;margin:1.5rem 0}@media(prefers-color-scheme:dark){body{background:#0d0f12;color:#e7e7e7}code,pre{background:#1a1d22}th,td,hr{border-color:#2a2d33}blockquote{border-color:#333;color:#aaa}}</style></head><body><h1>${escapeHtml(title)}</h1>\n${body}</body></html>`;
const loadPrefs = (): Prefs => { if (typeof window === "undefined") return DEFAULT_PREFS; try { const r = localStorage.getItem(PREFS_STORE); return r ? { ...DEFAULT_PREFS, ...JSON.parse(r) } : DEFAULT_PREFS; } catch { return DEFAULT_PREFS; } };

export default function NotaPage() {
  const { lang } = useLang();
  const fa = lang === "fa";
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [inTrash, setInTrash] = useState(false);
  const [sort, setSort] = useState<SortMode>("updated");
  const [asc, setAsc] = useState(false);
  const [view, setView] = useState<ViewMode>("split");
  const [zen, setZen] = useState(false);
  const [ready, setReady] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [showTpl, setShowTpl] = useState(false);
  const [find, setFind] = useState<{ q: string; r: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mdRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLInputElement>(null);

  // --- new: preferences, command palette, stats / graph / history panels ---
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [showPrefs, setShowPrefs] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteQ, setPaletteQ] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Record<string, Snapshot[]>>({});
  const [readProgress, setReadProgress] = useState(0);
  const lastSnapRef = useRef<string>("");

  const T = fa
    ? { brand: "نوتا", newNote: "یادداشتِ تازه", search: "جست‌وجو…", untitled: "بدون عنوان", empty: "یادداشتی نیست", write: "بنویس…", edit: "ویرایش", split: "دوتایی", preview: "پیش‌نمایش", zen: "تمرکز", del: "حذف", backlinks: "ارجاع‌ها", noBacklinks: "ارجاعی نیست.", words: "کلمه", chars: "نویسه", read: "دقیقه", tags: "برچسب", export: "برون‌بری JSON", import: "درون‌ری JSON", importMd: "درون‌ریِ ‎.md", exportAll: "خروجیِ همه", all: "همه", confirmDel: "به سطلِ زباله برود؟", titlePh: "عنوان", pickNote: "یک یادداشت انتخاب کن.", pin: "سنجاق", fav: "علاقه‌مندی", favs: "علاقه‌مندی‌ها", dupl: "تکثیر", exportMd: "خروجیِ ‎.md", copyMd: "کپیِ مارک‌داون", copyLink: "کپیِ پیوند", toc: "فهرست", sortBy: "مرتب‌سازی", sUpdated: "ویرایش", sCreated: "ساخت", sTitle: "عنوان", templates: "قالب‌ها", tplDaily: "روزانه", tplMeeting: "جلسه", tplTable: "جدول", color: "رنگ", notebooks: "دفترچه‌ها", trash: "سطلِ زباله", restore: "بازگردانی", delForever: "حذفِ کامل", emptyTrash: "خالی‌کردن", moveTo: "انتقال به", find: "یافتن", replace: "جایگزینی", replaceAll: "جایگزینیِ همه", goal: "هدفِ کلمه", saved: "ذخیره شد", noNotebook: "بدون دفترچه", edited: "ویرایش", prefs: "ترجیحات", editorFont: "قلمِ ویرایشگر", fMono: "تک‌عرض", fSans: "بی‌سریف", fSerif: "سریف", fontSize: "اندازهٔ قلم", readWidth: "پهنای مطالعه", wNarrow: "باریک", wNormal: "معمولی", wWide: "پهن", spellcheck: "غلط‌یاب", autoPair: "بستنِ خودکارِ پرانتز", smartLists: "فهرستِ هوشمند", typewriter: "پیمایشِ ماشین‌تحریر", compactList: "فهرستِ فشرده", palette: "دستورها", palettePh: "برو به یادداشت یا فرمان…", stats: "آمار", graph: "گرافِ پیوندها", history: "تاریخچهٔ نسخه‌ها", noHistory: "هنوز نسخه‌ای ثبت نشده.", restoreVer: "بازگردانی", exportHtml: "خروجی HTML", print: "چاپ", copyHtml: "کپیِ HTML", merge: "ادغام در…", stTotalNotes: "یادداشت", stTotalWords: "کلمه", stTotalTags: "برچسب", stNotebooks: "دفترچه", stStreak: "روز پیاپی", stMostLinked: "پرارجاع‌ترین", tplJournal: "دفترِ روزنگار", tplStandup: "استندآپ", tplCornell: "یادداشتِ کورنل", copied: "کپی شد", graphEmpty: "برای دیدنِ گراف، یادداشت‌ها را با ‎[[عنوان]]‎ به هم پیوند بده.", now: "همین حالا" }
    : { brand: "Nota", newNote: "New note", search: "Search…", untitled: "Untitled", empty: "No notes", write: "Write…", edit: "Edit", split: "Split", preview: "Preview", zen: "Zen", del: "Delete", backlinks: "Backlinks", noBacklinks: "No backlinks yet.", words: "words", chars: "chars", read: "min", tags: "Tags", export: "Export JSON", import: "Import JSON", importMd: "Import .md", exportAll: "Export all", all: "All", confirmDel: "Move to trash?", titlePh: "Title", pickNote: "Select a note.", pin: "Pin", fav: "Favourite", favs: "Favourites", dupl: "Duplicate", exportMd: "Export .md", copyMd: "Copy markdown", copyLink: "Copy link", toc: "Contents", sortBy: "Sort", sUpdated: "Edited", sCreated: "Created", sTitle: "Title", templates: "Templates", tplDaily: "Daily", tplMeeting: "Meeting", tplTable: "Table", color: "Color", notebooks: "Notebooks", trash: "Trash", restore: "Restore", delForever: "Delete forever", emptyTrash: "Empty trash", moveTo: "Move to", find: "Find", replace: "Replace", replaceAll: "Replace all", goal: "Word goal", saved: "Saved", noNotebook: "No notebook", edited: "Edited", prefs: "Preferences", editorFont: "Editor font", fMono: "Mono", fSans: "Sans", fSerif: "Serif", fontSize: "Font size", readWidth: "Reading width", wNarrow: "Narrow", wNormal: "Normal", wWide: "Wide", spellcheck: "Spellcheck", autoPair: "Auto-pair brackets", smartLists: "Smart lists", typewriter: "Typewriter scroll", compactList: "Compact list", palette: "Commands", palettePh: "Jump to a note or command…", stats: "Statistics", graph: "Link graph", history: "Version history", noHistory: "No versions yet.", restoreVer: "Restore", exportHtml: "Export HTML", print: "Print", copyHtml: "Copy HTML", merge: "Merge into…", stTotalNotes: "notes", stTotalWords: "words", stTotalTags: "tags", stNotebooks: "notebooks", stStreak: "day streak", stMostLinked: "Most linked", tplJournal: "Journal", tplStandup: "Standup", tplCornell: "Cornell note", copied: "Copied", graphEmpty: "Link notes with [[Title]] to see the graph.", now: "now" };

  useEffect(() => { try { const raw = localStorage.getItem(STORE); const p: Note[] = raw ? JSON.parse(raw) : []; const data = p.length ? p : seed(fa); setNotes(data); setActiveId(data.find((n) => !n.trashed)?.id ?? null); } catch { const s = seed(fa); setNotes(s); setActiveId(s[0]?.id ?? null); } setReady(true); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(STORE, JSON.stringify(notes)); } catch {} setSaved(true); const t = setTimeout(() => setSaved(false), 1200); return () => clearTimeout(t); } }, [notes, ready]);
  // load prefs + history once
  useEffect(() => { setPrefs(loadPrefs()); try { const r = localStorage.getItem(HIST_STORE); if (r) setHistory(JSON.parse(r)); } catch {} }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(PREFS_STORE, JSON.stringify(prefs)); } catch {} }, [prefs, ready]);
  useEffect(() => { if (ready) try { localStorage.setItem(HIST_STORE, JSON.stringify(history)); } catch {} }, [history, ready]);

  const active = notes.find((n) => n.id === activeId) || null;

  const createNote = useCallback((title = "", body = "") => { const now = Date.now(); const n: Note = { id: uid(), title, body, created: now, updated: now, folder: folder ?? undefined }; setNotes((p) => [n, ...p]); setActiveId(n.id); setSidebar(false); setInTrash(false); return n; }, [folder]);
  const patchActive = (patch: Partial<Note>) => setNotes((p) => p.map((n) => (n.id === activeId ? { ...n, ...patch, updated: Date.now() } : n)));
  const patch = (id: string, patch: Partial<Note>) => setNotes((p) => p.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  const duplicate = () => { if (!active) return; const now = Date.now(); const n: Note = { ...active, id: uid(), title: active.title + (fa ? " (کپی)" : " (copy)"), created: now, updated: now, pinned: false }; setNotes((p) => [n, ...p]); setActiveId(n.id); };
  const openByTitle = (title: string) => { const f = notes.find((n) => !n.trashed && n.title.trim().toLowerCase() === title.trim().toLowerCase()); if (f) { setActiveId(f.id); setSidebar(false); } else createNote(title); };
  const trashActive = () => { if (!active) return; if (!inTrash) { if (!window.confirm(T.confirmDel)) return; patch(active.id, { trashed: true }); setActiveId(notes.find((n) => !n.trashed && n.id !== active.id)?.id ?? null); } };

  const toggleTask = (idx: number) => { if (!active) return; const lines = active.body.split("\n"); let c = -1; for (let i = 0; i < lines.length; i++) { if (/^\s*-\s\[[ x]\]\s/i.test(lines[i])) { c++; if (c === idx) { lines[i] = /\[x\]/i.test(lines[i]) ? lines[i].replace(/\[x\]/i, "[ ]") : lines[i].replace(/\[ \]/, "[x]"); break; } } } patchActive({ body: lines.join("\n") }); };

  /* editor formatting */
  const wrapSel = (before: string, after = before) => { const ta = bodyRef.current; if (!ta || !active) return; const s = ta.selectionStart, e = ta.selectionEnd, val = active.body; const next = val.slice(0, s) + before + val.slice(s, e) + after + val.slice(e); patchActive({ body: next }); requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = e + before.length; }); };
  const linePrefix = (prefix: string) => { const ta = bodyRef.current; if (!ta || !active) return; const s = ta.selectionStart, val = active.body; const ls = val.lastIndexOf("\n", s - 1) + 1; const next = val.slice(0, ls) + prefix + val.slice(ls); patchActive({ body: next }); requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + prefix.length; }); };
  const insertAtCursor = (txt: string) => { const ta = bodyRef.current; if (!ta || !active) return; const s = ta.selectionStart, val = active.body; const next = val.slice(0, s) + txt + val.slice(s); patchActive({ body: next }); requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + txt.length; }); };
  const runReplace = () => { if (!active || !find || !find.q) return; patchActive({ body: active.body.split(find.q).join(find.r) }); };

  // Smart editor typing: auto-continue lists on Enter, Tab/Shift-Tab to
  // indent, and auto-pair brackets/quotes — all preference-gated.
  const PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}", "`": "`", '"': '"' };
  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget; if (!active) return;
    const s = ta.selectionStart, en = ta.selectionEnd, val = active.body;
    const setBody = (next: string, caret: number) => { patchActive({ body: next }); requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = caret; }); };
    if (e.key === "Enter" && prefs.smartLists) {
      const ls = val.lastIndexOf("\n", s - 1) + 1;
      const cur = val.slice(ls, s);
      const m = cur.match(/^(\s*)(-\s\[[ x]\]\s|[-*]\s|\d+\.\s)/i);
      if (m) {
        const rest = cur.slice(m[0].length);
        if (rest.trim() === "") { e.preventDefault(); setBody(val.slice(0, ls) + val.slice(s), ls); return; } // empty item → end list
        e.preventDefault();
        let marker = m[2];
        const om = marker.match(/^(\d+)\.\s/);
        if (om) marker = `${parseInt(om[1]) + 1}. `;
        else if (/\[[ x]\]/i.test(marker)) marker = "- [ ] ";
        const ins = "\n" + m[1] + marker;
        setBody(val.slice(0, s) + ins + val.slice(en), s + ins.length);
        return;
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ls = val.lastIndexOf("\n", s - 1) + 1;
      if (e.shiftKey) { if (val.slice(ls, ls + 2) === "  ") setBody(val.slice(0, ls) + val.slice(ls + 2), Math.max(ls, s - 2)); }
      else setBody(val.slice(0, ls) + "  " + val.slice(ls), s + 2);
      return;
    }
    if (prefs.autoPair && PAIRS[e.key] && s !== en) { e.preventDefault(); const sel = val.slice(s, en); setBody(val.slice(0, s) + e.key + sel + PAIRS[e.key] + val.slice(en), en + 2); return; }
  };

  const insertTemplate = (kind: "daily" | "meeting" | "table" | "journal" | "standup" | "cornell") => {
    setShowTpl(false);
    const d = new Date().toISOString().slice(0, 10);
    const tpl: Record<string, { title: string; body: string }> = {
      daily: { title: d, body: fa ? `# ${d}\n\n## تمرکز\n- \n\n## یادداشت‌ها\n\n## کارها\n- [ ] ` : `# ${d}\n\n## Focus\n- \n\n## Notes\n\n## Tasks\n- [ ] ` },
      meeting: { title: fa ? "جلسه" : "Meeting", body: fa ? `# جلسه — \n\n**تاریخ:** ${d}\n**حاضران:** \n\n## دستورِ کار\n- \n\n## تصمیم‌ها\n\n## اقدامات\n- [ ] ` : `# Meeting — \n\n**Date:** ${d}\n**Attendees:** \n\n## Agenda\n- \n\n## Decisions\n\n## Action items\n- [ ] ` },
      table: { title: fa ? "جدول" : "Table", body: fa ? `| ستون ۱ | ستون ۲ |\n| --- | --- |\n| مقدار | مقدار |\n` : `| Column 1 | Column 2 |\n| --- | --- |\n| value | value |\n` },
      journal: { title: fa ? `روزنگار ${d}` : `Journal ${d}`, body: fa ? `# ${d}\n\n## سه چیزی که سپاسگزارم\n1. \n2. \n3. \n\n## امروز چه شد\n\n## فردا\n- [ ] ` : `# ${d}\n\n## Three things I'm grateful for\n1. \n2. \n3. \n\n## How today went\n\n## Tomorrow\n- [ ] ` },
      standup: { title: fa ? `استندآپ ${d}` : `Standup ${d}`, body: fa ? `# استندآپ — ${d}\n\n## دیروز\n- \n\n## امروز\n- \n\n## موانع\n- ` : `# Standup — ${d}\n\n## Yesterday\n- \n\n## Today\n- \n\n## Blockers\n- ` },
      cornell: { title: fa ? "یادداشتِ کورنل" : "Cornell note", body: fa ? `# موضوع\n\n| نشانه‌ها | یادداشت‌ها |\n| --- | --- |\n| سؤالِ کلیدی | نکتهٔ اصلی |\n\n## خلاصه\n` : `# Topic\n\n| Cues | Notes |\n| --- | --- |\n| Key question | Main point |\n\n## Summary\n` },
    };
    const t = tpl[kind];
    createNote(t.title, t.body);
  };

  const live = notes.filter((n) => !n.trashed);
  const trashed = notes.filter((n) => n.trashed);
  const allTags = useMemo(() => Array.from(new Set(live.flatMap((n) => tagsOf(n.body)))).sort(), [notes]); // eslint-disable-line
  const allFolders = useMemo(() => Array.from(new Set(live.map((n) => n.folder).filter(Boolean) as string[])).sort(), [notes]); // eslint-disable-line
  const backlinks = useMemo(() => { if (!active) return []; const t = active.title.trim().toLowerCase(); return live.filter((n) => n.id !== active.id && linksOf(n.body).includes(t)); }, [notes, active]); // eslint-disable-line
  const toc = useMemo(() => (active ? headingsOf(active.body) : []), [active]);

  // aggregate stats for the dashboard
  const stats = useMemo(() => {
    const totalWords = live.reduce((s, n) => s + (n.body.trim().match(/\S+/g) || []).length, 0);
    const tags = new Set(live.flatMap((n) => tagsOf(n.body)));
    const notebooks = new Set(live.map((n) => n.folder).filter(Boolean));
    // writing streak: consecutive days (ending today) with a note updated
    const days = new Set(live.map((n) => new Date(n.updated).toDateString()));
    let streak = 0; const day = new Date();
    while (days.has(day.toDateString())) { streak++; day.setDate(day.getDate() - 1); }
    // most-linked note by incoming [[links]]
    const incoming: Record<string, number> = {};
    live.forEach((n) => linksOf(n.body).forEach((l) => { incoming[l] = (incoming[l] || 0) + 1; }));
    let mostLinked = ""; let max = 0;
    live.forEach((n) => { const c = incoming[n.title.trim().toLowerCase()] || 0; if (c > max) { max = c; mostLinked = n.title; } });
    return { notes: live.length, words: totalWords, tags: tags.size, notebooks: notebooks.size, streak, mostLinked, mostLinkedCount: max };
  }, [notes]); // eslint-disable-line

  // link-graph nodes + edges from [[wiki links]]
  const graph = useMemo(() => {
    const nodes = live.map((n) => ({ id: n.id, title: n.title, key: n.title.trim().toLowerCase() }));
    const byKey = new Map(nodes.map((n) => [n.key, n.id]));
    const edges: { from: string; to: string }[] = [];
    live.forEach((n) => linksOf(n.body).forEach((l) => { const to = byKey.get(l); if (to && to !== n.id) edges.push({ from: n.id, to }); }));
    return { nodes, edges };
  }, [notes]); // eslint-disable-line

  const paletteResults = useMemo(() => { const q = paletteQ.trim().toLowerCase(); const src = live; return (q ? src.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) : src).slice(0, 8); }, [paletteQ, notes]); // eslint-disable-line

  const listSource = inTrash ? trashed : live;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dir = asc ? 1 : -1;
    const cmp = sort === "title" ? (a: Note, b: Note) => a.title.localeCompare(b.title) * dir : sort === "created" ? (a: Note, b: Note) => (a.created - b.created) * dir : (a: Note, b: Note) => (a.updated - b.updated) * dir;
    return [...listSource]
      .filter((n) => (!tag || tagsOf(n.body).includes(tag)))
      .filter((n) => (!folder || n.folder === folder))
      .filter((n) => (!favOnly || n.fav))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => (inTrash ? 0 : (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || cmp(a, b));
  }, [notes, query, tag, folder, favOnly, sort, asc, inTrash]); // eslint-disable-line

  const download = (name: string, text: string, mime = "text/plain") => { const b = new Blob([text], { type: mime }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  const importJSON = (file: File) => { const r = new FileReader(); r.onload = () => { try { const arr = JSON.parse(r.result as string); if (Array.isArray(arr)) { setNotes(arr); setActiveId(arr[0]?.id ?? null); } } catch {} }; r.readAsText(file); };
  const importMd = (files: FileList) => { Array.from(files).forEach((f) => { const r = new FileReader(); r.onload = () => { const now = Date.now(); setNotes((p) => [{ id: uid(), title: f.name.replace(/\.m[dk]+$/i, ""), body: r.result as string, created: now, updated: now }, ...p]); }; r.readAsText(f); }); };
  const exportAll = () => download("nota-all.md", live.map((n) => `# ${n.title}\n\n${n.body}`).join("\n\n---\n\n"), "text/markdown");

  // --- HTML export / print / copy-as-HTML ---
  const activeHtml = () => (active ? HTML_DOC(active.title || T.untitled, mdToHtml(active.body)) : "");
  const exportHtml = () => { if (!active) return; download((active.title || "note").replace(/[^\p{L}\d]+/gu, "-") + ".html", activeHtml(), "text/html"); };
  const printNote = () => { if (!active) return; const w = window.open("", "_blank"); if (!w) return; w.document.write(activeHtml()); w.document.close(); w.focus(); setTimeout(() => w.print(), 250); };
  const copyHtml = () => { if (!active) return; navigator.clipboard?.writeText(mdToHtml(active.body)); flashSaved(T.copied); };
  const [toast, setToast] = useState("");
  const flashSaved = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1400); };

  // --- merge the active note's body into another note ---
  const mergeInto = (targetId: string) => { if (!active || targetId === active.id) return; setNotes((p) => p.map((n) => n.id === targetId ? { ...n, body: `${n.body}\n\n---\n\n${active.body}`, updated: Date.now() } : n)); patch(active.id, { trashed: true }); setActiveId(targetId); };

  // --- version history: snapshot the active note a few seconds after edits ---
  useEffect(() => {
    if (!ready || !active) return;
    const id = active.id;
    const key = id + "::" + active.body;
    const t = setTimeout(() => {
      if (lastSnapRef.current === key) return;
      setHistory((h) => {
        const list = h[id] || [];
        if (list[0]?.body === active.body) return h;
        const next = [{ t: Date.now(), body: active.body, title: active.title }, ...list].slice(0, HIST_MAX);
        return { ...h, [id]: next };
      });
      lastSnapRef.current = key;
    }, 3500);
    return () => clearTimeout(t);
  }, [active?.id, active?.body, ready]); // eslint-disable-line
  const restoreSnap = (s: Snapshot) => { if (!active) return; patchActive({ body: s.body, title: s.title || active.title }); setShowHistory(false); };

  const rel = (t: number) => { const s = (Date.now() - t) / 1000; if (s < 60) return fa ? "الان" : "now"; if (s < 3600) return `${Math.floor(s / 60)}${fa ? "د" : "m"}`; if (s < 86400) return `${Math.floor(s / 3600)}${fa ? "س" : "h"}`; return `${Math.floor(s / 86400)}${fa ? "ر" : "d"}`; };

  // shortcuts
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey; if (!mod) return; const k = e.key.toLowerCase();
      if (k === "k") { e.preventDefault(); setPalette((v) => !v); setPaletteQ(""); requestAnimationFrame(() => paletteRef.current?.focus()); }
      else if (k === "n") { e.preventDefault(); createNote(""); } else if (k === "f") { e.preventDefault(); searchRef.current?.focus(); } else if (k === "s") { e.preventDefault(); if (active) download((active.title || "note") + ".md", active.body, "text/markdown"); }
      else if (document.activeElement === bodyRef.current) { if (k === "b") { e.preventDefault(); wrapSel("**"); } else if (k === "i") { e.preventDefault(); wrapSel("*"); } }
    };
    window.addEventListener("keydown", kd); return () => window.removeEventListener("keydown", kd); // eslint-disable-line
  }, [active]);

  const words = active ? (active.body.trim().match(/\S+/g) || []).length : 0;
  const readMin = Math.max(1, Math.round(words / 200));
  const goalPct = active?.goal ? Math.min(100, Math.round((words / active.goal) * 100)) : 0;

  const fmtBtns: [string, () => void, string][] = [["B", () => wrapSel("**"), "font-bold"], ["I", () => wrapSel("*"), "italic"], ["S", () => wrapSel("~~"), "line-through"], ["‹›", () => wrapSel("`"), "mono"], ["H1", () => linePrefix("# "), ""], ["H2", () => linePrefix("## "), ""], ["•", () => linePrefix("- "), ""], ["☑", () => linePrefix("- [ ] "), ""], ["❝", () => linePrefix("> "), ""], ["🔗", () => wrapSel("[", "](url)"), ""], ["▦", () => insertAtCursor("\n| A | B |\n| --- | --- |\n| 1 | 2 |\n"), ""]];

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>◲</span><span className="font-display text-lg">{T.brand}</span></span>
          {saved && <span className="hidden text-xs text-[var(--fg-2)] sm:inline">✓ {T.saved}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportAll} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex" title={T.exportAll}>⇊ md</button>
          <button onClick={() => mdRef.current?.click()} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex">{T.importMd}</button>
          <input ref={mdRef} type="file" accept=".md,.markdown,.txt" multiple className="hidden" onChange={(e) => { if (e.target.files) importMd(e.target.files); e.currentTarget.value = ""; }} />
          <button onClick={() => download("nota-export.json", JSON.stringify(notes, null, 2), "application/json")} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex">↓</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex">↑</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.currentTarget.value = ""; }} />
          <button onClick={() => { setPalette(true); setPaletteQ(""); requestAnimationFrame(() => paletteRef.current?.focus()); }} className="grid h-9 w-9 place-items-center rounded-full border text-sm" style={{ borderColor: "var(--line-2)" }} title={`${T.palette} (Ctrl/⌘+K)`}>⌘</button>
          <button onClick={() => setShowGraph(true)} className="hidden h-9 w-9 place-items-center rounded-full border text-sm sm:grid" style={{ borderColor: "var(--line-2)" }} title={T.graph}>◵</button>
          <button onClick={() => setShowStats(true)} className="hidden h-9 w-9 place-items-center rounded-full border text-sm sm:grid" style={{ borderColor: "var(--line-2)" }} title={T.stats}>📊</button>
          <button onClick={() => setShowPrefs(true)} className="grid h-9 w-9 place-items-center rounded-full border text-sm" style={{ borderColor: "var(--line-2)" }} title={T.prefs}>⚙</button>
          <ThemePicker /><LangToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`${sidebar && !zen ? "flex" : "hidden"} w-full flex-col border-e sm:flex sm:w-80 sm:shrink-0`} style={{ borderColor: "var(--line)", background: "var(--bg-2)", ...(zen ? { display: "none" } : {}) }}>
          <div className="space-y-2 border-b p-3" style={{ borderColor: "var(--line)" }}>
            <div className="flex gap-2">
              <button onClick={() => createNote("")} className="btn btn-accent flex-1">+ {T.newNote}</button>
              <div className="relative">
                <button onClick={() => setShowTpl((s) => !s)} className="btn btn-outline h-full px-3" title={T.templates}>▤</button>
                {showTpl && (<><div className="fixed inset-0 z-10" onClick={() => setShowTpl(false)} /><div className="absolute end-0 z-20 mt-1 w-44 rounded-xl border p-1 text-sm shadow-lg" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}><div className="label px-2 py-1">{T.templates}</div><button onClick={() => insertTemplate("daily")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">📅 {T.tplDaily}</button><button onClick={() => insertTemplate("meeting")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">👥 {T.tplMeeting}</button><button onClick={() => insertTemplate("table")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">▦ {T.tplTable}</button><button onClick={() => insertTemplate("journal")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">📔 {T.tplJournal}</button><button onClick={() => insertTemplate("standup")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">🧍 {T.tplStandup}</button><button onClick={() => insertTemplate("cornell")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">🗂 {T.tplCornell}</button></div></>)}
              </div>
            </div>
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.search} className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} />
            <div className="flex items-center gap-1.5 text-xs text-[var(--fg-2)]">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="flex-1 rounded-lg border bg-transparent px-2 py-1 outline-none" style={{ borderColor: "var(--line)" }}><option value="updated">{T.sUpdated}</option><option value="created">{T.sCreated}</option><option value="title">{T.sTitle}</option></select>
              <button onClick={() => setAsc((a) => !a)} className="rounded-lg border px-2 py-1" style={{ borderColor: "var(--line)" }}>{asc ? "↑" : "↓"}</button>
              <button onClick={() => setFavOnly((f) => !f)} className="rounded-lg border px-2 py-1" style={{ borderColor: favOnly ? "var(--accent)" : "var(--line)", color: favOnly ? "var(--accent)" : undefined }} title={T.favs}>★</button>
              <button onClick={() => { setInTrash((t) => !t); setActiveId(null); }} className="rounded-lg border px-2 py-1" style={{ borderColor: inTrash ? "var(--accent)" : "var(--line)", color: inTrash ? "var(--accent)" : undefined }} title={T.trash}>🗑{trashed.length > 0 ? trashed.length : ""}</button>
            </div>
            {!inTrash && allFolders.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button onClick={() => setFolder(null)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: folder === null ? "var(--accent)" : "var(--bg-3)", color: folder === null ? "var(--on-accent)" : "var(--fg-2)" }}>{T.all}</button>
                {allFolders.map((f) => <button key={f} onClick={() => setFolder(f === folder ? null : f)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: folder === f ? "var(--accent)" : "var(--bg-3)", color: folder === f ? "var(--on-accent)" : "var(--fg-2)" }}>📁 {f}</button>)}
              </div>
            )}
            {!inTrash && allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tg) => <button key={tg} onClick={() => setTag(tg === tag ? null : tg)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: tag === tg ? "var(--accent)" : "var(--bg-3)", color: tag === tg ? "var(--on-accent)" : "var(--fg-2)" }}>#{tg}</button>)}
              </div>
            )}
            {inTrash && trashed.length > 0 && <button onClick={() => { if (window.confirm(T.emptyTrash + "?")) setNotes((p) => p.filter((n) => !n.trashed)); }} className="w-full rounded-lg border py-1 text-xs text-[#ff6a6a]" style={{ borderColor: "var(--line)" }}>{T.emptyTrash}</button>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
            {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-[var(--fg-2)]">{T.empty}</p>}
            {filtered.map((n) => (
              <div key={n.id} className="group relative">
                <button onClick={() => { setActiveId(n.id); setSidebar(false); }} className={`mb-1 block w-full rounded-xl text-start transition-colors ${prefs.compactList ? "px-2.5 py-1.5" : "p-2.5"}`} style={{ background: activeId === n.id ? "var(--bg-3)" : "transparent", borderInlineStart: n.color ? `3px solid ${n.color}` : "3px solid transparent" }}>
                  <div className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{n.title || T.untitled}</span>{n.fav && <span className="text-xs">★</span>}{n.pinned && <span className="text-xs">📌</span>}{(history[n.id]?.length ?? 0) > 0 && <span className="text-[10px] text-[var(--fg-2)]" title={T.history}>⟲</span>}<span className="mono ms-auto shrink-0 text-[10px] text-[var(--fg-2)]">{rel(n.updated)}</span></div>
                  {!prefs.compactList && <div className="truncate text-xs text-[var(--fg-2)]">{n.body.replace(/[#*`>\-[\]|]/g, "").slice(0, 60) || "…"}</div>}
                </button>
                {inTrash ? (
                  <div className="absolute end-2 top-2 hidden gap-1 group-hover:flex"><button onClick={() => patch(n.id, { trashed: false })} className="rounded p-1 text-[10px]" title={T.restore}>↩</button><button onClick={() => setNotes((p) => p.filter((x) => x.id !== n.id))} className="rounded p-1 text-[10px] text-[#ff6a6a]" title={T.delForever}>✕</button></div>
                ) : (
                  <button onClick={() => patch(n.id, { pinned: !n.pinned })} className="absolute end-2 top-2 hidden rounded p-1 text-xs group-hover:block" title={T.pin}>{n.pinned ? "📌" : "📍"}</button>
                )}
              </div>
            ))}
          </div>
        </aside>

        <main className={`${sidebar && !zen ? "hidden" : "flex"} min-w-0 flex-1 flex-col sm:flex`}>
          {!active ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-[var(--fg-2)]">{T.pickNote}</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 border-b p-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <button onClick={() => setSidebar(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border sm:hidden" style={{ borderColor: "var(--line-2)" }}>☰</button>
                <input value={active.title} onChange={(e) => patchActive({ title: e.target.value })} placeholder={T.titlePh} className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none" />
                <button onClick={() => patchActive({ fav: !active.fav })} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: active.fav ? "var(--accent)" : "var(--line-2)", color: active.fav ? "var(--accent)" : undefined }} title={T.fav}>★</button>
                <button onClick={() => patchActive({ pinned: !active.pinned })} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: active.pinned ? "var(--accent)" : "var(--line-2)" }} title={T.pin}>📌</button>
                <div className="hidden items-center gap-1 sm:flex">{NOTE_COLORS.map((c) => <button key={c || "n"} onClick={() => patchActive({ color: c })} className="h-5 w-5 rounded-full border-2" title={T.color} style={{ background: c || "var(--bg-3)", borderColor: active.color === c ? "var(--fg)" : "var(--line)" }}>{!c && <span className="text-[9px]">✕</span>}</button>)}</div>
                <div className="ms-auto flex items-center gap-1">
                  {(["edit", "split", "preview"] as ViewMode[]).map((v) => <button key={v} onClick={() => setView(v)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: view === v ? "var(--accent)" : "var(--line-2)", background: view === v ? "var(--accent)" : "transparent", color: view === v ? "var(--on-accent)" : "var(--fg-2)" }}>{v === "edit" ? T.edit : v === "split" ? T.split : T.preview}</button>)}
                  <button onClick={() => setZen((z) => !z)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: zen ? "var(--accent)" : "var(--line-2)", color: zen ? "var(--accent)" : undefined }} title={T.zen}>◱</button>
                  <button onClick={() => setFind((f) => (f ? null : { q: "", r: "" }))} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: find ? "var(--accent)" : "var(--line-2)" }} title={T.find}>⌕</button>
                  <button onClick={duplicate} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }} title={T.dupl}>⧉</button>
                  <button onClick={() => navigator.clipboard?.writeText(`[[${active.title}]]`)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }} title={T.copyLink}>🔗</button>
                  <button onClick={() => download((active.title || "note").replace(/[^\p{L}\d]+/gu, "-") + ".md", active.body, "text/markdown")} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }} title={T.exportMd}>md</button>
                  <button onClick={exportHtml} className="hidden rounded-lg border px-2 py-1 text-xs sm:block" style={{ borderColor: "var(--line-2)" }} title={T.exportHtml}>html</button>
                  <button onClick={printNote} className="hidden rounded-lg border px-2 py-1 text-xs sm:block" style={{ borderColor: "var(--line-2)" }} title={T.print}>⎙</button>
                  <button onClick={copyHtml} className="hidden rounded-lg border px-2 py-1 text-xs sm:block" style={{ borderColor: "var(--line-2)" }} title={T.copyHtml}>❐</button>
                  <button onClick={() => setShowHistory(true)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: (history[active.id]?.length ?? 0) > 0 ? "var(--accent)" : "var(--line-2)" }} title={T.history}>⟲</button>
                  {inTrash ? <button onClick={() => patch(active.id, { trashed: false })} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }} title={T.restore}>↩</button> : <button onClick={trashActive} className="rounded-lg border px-2 py-1 text-xs hover:border-[#ff6a6a] hover:text-[#ff6a6a]" style={{ borderColor: "var(--line-2)" }} title={T.del}>🗑</button>}
                </div>
              </div>

              {/* notebook + goal row */}
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <span>{T.moveTo}:</span>
                <input list="nb" value={active.folder || ""} onChange={(e) => patchActive({ folder: e.target.value || undefined })} placeholder={T.noNotebook} className="w-40 rounded-lg border bg-transparent px-2 py-0.5 outline-none" style={{ borderColor: "var(--line)" }} />
                <datalist id="nb">{allFolders.map((f) => <option key={f} value={f} />)}</datalist>
                <span className="ms-2">{T.goal}:</span>
                <input type="number" value={active.goal || ""} onChange={(e) => patchActive({ goal: +e.target.value || undefined })} className="w-16 rounded-lg border bg-transparent px-2 py-0.5 outline-none" style={{ borderColor: "var(--line)" }} />
                {active.goal ? <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-20 overflow-hidden rounded-full" style={{ background: "var(--line)" }}><span className="block h-full rounded-full" style={{ width: `${goalPct}%`, background: "var(--accent)" }} /></span>{goalPct}%</span> : null}
                {live.length > 1 && !inTrash && (
                  <select value="" onChange={(e) => { if (e.target.value && window.confirm(T.merge)) mergeInto(e.target.value); }} className="ms-auto rounded-lg border bg-transparent px-2 py-0.5 outline-none" style={{ borderColor: "var(--line)" }}>
                    <option value="">{T.merge}</option>
                    {live.filter((n) => n.id !== active.id).map((n) => <option key={n.id} value={n.id}>{n.title || T.untitled}</option>)}
                  </select>
                )}
              </div>

              {find && (
                <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                  <input value={find.q} onChange={(e) => setFind({ ...find, q: e.target.value })} placeholder={T.find} className="rounded-lg border bg-transparent px-2 py-1 text-sm outline-none" style={{ borderColor: "var(--line)" }} />
                  <input value={find.r} onChange={(e) => setFind({ ...find, r: e.target.value })} placeholder={T.replace} className="rounded-lg border bg-transparent px-2 py-1 text-sm outline-none" style={{ borderColor: "var(--line)" }} />
                  <button onClick={runReplace} className="btn btn-outline h-8 px-3 py-0 text-xs">{T.replaceAll}</button>
                </div>
              )}

              {view !== "preview" && (
                <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                  {fmtBtns.map(([lab, fn, cls]) => <button key={lab} onClick={fn} className={`rounded-md border px-2 py-1 text-xs ${cls}`} style={{ borderColor: "var(--line-2)" }}>{lab}</button>)}
                </div>
              )}

              <div className={`grid min-h-0 flex-1 ${view === "split" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                {view !== "preview" && <textarea ref={bodyRef} value={active.body} spellCheck={prefs.spellcheck} onKeyDown={onEditorKeyDown} onChange={(e) => patchActive({ body: e.target.value })} placeholder={T.write} className="min-h-0 resize-none overflow-y-auto border-e p-4 leading-relaxed outline-none thin-scroll force-ltr" style={{ background: "var(--bg)", borderColor: "var(--line)", fontFamily: FONT_STACK[prefs.editorFont], fontSize: prefs.fontSize }} />}
                {view !== "edit" && (
                  <div ref={previewRef} onScroll={(e) => { const el = e.currentTarget; setReadProgress(el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0); }} className={`relative min-h-0 overflow-y-auto p-4 thin-scroll ${zen || prefs.typewriter ? "mx-auto" : ""}`} style={{ background: "var(--bg)", maxWidth: zen || prefs.typewriter ? READ_MAXW[prefs.readWidth] : undefined }}>
                    <div className="pointer-events-none sticky -top-4 z-10 -mx-4 -mt-4 mb-2 h-0.5" style={{ background: "var(--accent)", width: `${readProgress * 100}%`, transition: "width .1s" }} />
                    {toc.length > 2 && (
                      <details className="mb-3 rounded-xl border p-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                        <summary className="cursor-pointer text-xs font-semibold text-[var(--fg-2)]">📑 {T.toc}</summary>
                        <div className="mt-2 space-y-0.5">{toc.map((h, j) => <button key={j} onClick={() => previewRef.current?.querySelector("#h-" + slug(h.text))?.scrollIntoView({ behavior: "smooth", block: "start" })} className="block truncate text-start text-xs text-[var(--fg-2)] hover:text-[var(--accent)]" style={{ paddingInlineStart: (h.level - 1) * 12 }}>{h.text}</button>)}</div>
                      </details>
                    )}
                    <Markdown src={active.body || (fa ? "*خالی*" : "*Empty*")} onLink={openByTitle} onToggleTask={toggleTask} hl={query.trim() || undefined} />
                    <div className="mt-6 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                      <div className="label mb-2">🔗 {T.backlinks}</div>
                      {backlinks.length === 0 ? <p className="text-xs text-[var(--fg-2)]">{T.noBacklinks}</p> : <div className="flex flex-wrap gap-1.5">{backlinks.map((b) => <button key={b.id} onClick={() => setActiveId(b.id)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }}>{b.title || T.untitled}</button>)}</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 border-t px-4 py-2 text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <span className="mono">{words} {T.words}</span><span className="mono">{active.body.length} {T.chars}</span><span className="mono">{readMin} {T.read}</span>
                <span className="mono ms-auto">{T.edited} {rel(active.updated)}</span>
                {tagsOf(active.body).length > 0 && <span className="truncate">{tagsOf(active.body).map((t) => `#${t}`).join(" ")}</span>}
              </div>
            </>
          )}
        </main>
      </div>

      {/* toast */}
      {toast && <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-xs shadow-lg" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{toast}</div>}

      {/* command palette (Ctrl/⌘+K) */}
      {palette && (
        <div className="fixed inset-0 z-50 grid place-items-start justify-center p-4 pt-[12vh]" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", backdropFilter: "blur(4px)" }} onClick={() => setPalette(false)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
            <input ref={paletteRef} value={paletteQ} onChange={(e) => setPaletteQ(e.target.value)} placeholder={T.palettePh} className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none" style={{ borderColor: "var(--line)" }} onKeyDown={(e) => { if (e.key === "Enter" && paletteResults[0]) { setActiveId(paletteResults[0].id); setPalette(false); setSidebar(false); } if (e.key === "Escape") setPalette(false); }} />
            <div className="max-h-72 overflow-y-auto p-2 thin-scroll">
              <button onClick={() => { createNote(paletteQ); setPalette(false); }} className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-[var(--bg-3)]">+ {T.newNote}{paletteQ ? ` — “${paletteQ}”` : ""}</button>
              {paletteResults.map((n) => (
                <button key={n.id} onClick={() => { setActiveId(n.id); setPalette(false); setSidebar(false); setInTrash(false); }} className="block w-full truncate rounded-lg px-3 py-2 text-start text-sm hover:bg-[var(--bg-3)]">
                  <span className="font-medium">{n.title || T.untitled}</span>{n.folder && <span className="ms-2 text-xs text-[var(--fg-2)]">📁 {n.folder}</span>}
                </button>
              ))}
              {paletteResults.length === 0 && paletteQ && <p className="px-3 py-2 text-xs text-[var(--fg-2)]">{T.empty}</p>}
            </div>
          </div>
        </div>
      )}

      {/* preferences */}
      {showPrefs && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", backdropFilter: "blur(4px)" }} onClick={() => setShowPrefs(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border p-5 shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-display text-lg">⚙ {T.prefs}</h3><button onClick={() => setShowPrefs(false)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button></div>
            <div>
              <div className="label mb-1.5">{T.editorFont}</div>
              <div className="flex gap-1.5">{(["mono", "sans", "serif"] as EditorFont[]).map((f) => <button key={f} onClick={() => setPrefs((p) => ({ ...p, editorFont: f }))} className="flex-1 rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: prefs.editorFont === f ? "var(--accent)" : "var(--line)", color: prefs.editorFont === f ? "var(--accent)" : undefined, fontFamily: FONT_STACK[f] }}>{f === "mono" ? T.fMono : f === "sans" ? T.fSans : T.fSerif}</button>)}</div>
            </div>
            <div>
              <div className="label mb-1.5 flex justify-between"><span>{T.fontSize}</span><span className="mono">{prefs.fontSize}px</span></div>
              <input type="range" min={12} max={22} value={prefs.fontSize} onChange={(e) => setPrefs((p) => ({ ...p, fontSize: +e.target.value }))} className="w-full" />
            </div>
            <div>
              <div className="label mb-1.5">{T.readWidth}</div>
              <div className="flex gap-1.5">{(["narrow", "normal", "wide"] as ReadWidth[]).map((wd) => <button key={wd} onClick={() => setPrefs((p) => ({ ...p, readWidth: wd }))} className="flex-1 rounded-lg border px-2 py-1.5 text-xs" style={{ borderColor: prefs.readWidth === wd ? "var(--accent)" : "var(--line)", color: prefs.readWidth === wd ? "var(--accent)" : undefined }}>{wd === "narrow" ? T.wNarrow : wd === "normal" ? T.wNormal : T.wWide}</button>)}</div>
            </div>
            {([["spellcheck", T.spellcheck], ["autoPair", T.autoPair], ["smartLists", T.smartLists], ["typewriter", T.typewriter], ["compactList", T.compactList]] as [keyof Prefs, string][]).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <input type="checkbox" checked={prefs[k] as boolean} onChange={(e) => setPrefs((p) => ({ ...p, [k]: e.target.checked }))} className="h-4 w-4" />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* stats dashboard */}
      {showStats && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", backdropFilter: "blur(4px)" }} onClick={() => setShowStats(false)}>
          <div className="w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg">📊 {T.stats}</h3><button onClick={() => setShowStats(false)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button></div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[[stats.notes, T.stTotalNotes], [stats.words.toLocaleString(), T.stTotalWords], [stats.tags, T.stTotalTags], [stats.notebooks, T.stNotebooks], [stats.streak, T.stStreak], [trashed.length, T.trash]].map(([v, l], i) => (
                <div key={i} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}><div className="font-display text-2xl">{v}</div><div className="label mt-1">{l}</div></div>
              ))}
            </div>
            {stats.mostLinked && <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)" }}>{T.stMostLinked}: <b>{stats.mostLinked}</b> <span className="text-[var(--fg-2)]">({stats.mostLinkedCount})</span></div>}
          </div>
        </div>
      )}

      {/* link graph */}
      {showGraph && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", backdropFilter: "blur(4px)" }} onClick={() => setShowGraph(false)}>
          <div className="w-full max-w-2xl rounded-2xl border p-5 shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-lg">◵ {T.graph}</h3><button onClick={() => setShowGraph(false)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button></div>
            {graph.edges.length === 0 ? <p className="py-10 text-center text-sm text-[var(--fg-2)]">{T.graphEmpty}</p> : (
              <svg viewBox="0 0 400 300" className="h-[52vh] w-full">
                {(() => {
                  const N = graph.nodes.length; const cx = 200, cy = 150, R = Math.min(130, 40 + N * 8);
                  const pos = new Map(graph.nodes.map((n, i) => [n.id, { x: cx + R * Math.cos((i / N) * Math.PI * 2 - Math.PI / 2), y: cy + R * Math.sin((i / N) * Math.PI * 2 - Math.PI / 2) }]));
                  return (<>
                    {graph.edges.map((e, i) => { const a = pos.get(e.from), b = pos.get(e.to); return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line-2)" strokeWidth={0.8} /> : null; })}
                    {graph.nodes.map((n) => { const p = pos.get(n.id); if (!p) return null; const deg = graph.edges.filter((e) => e.from === n.id || e.to === n.id).length; return (
                      <g key={n.id} className="cursor-pointer" onClick={() => { setActiveId(n.id); setShowGraph(false); setSidebar(false); }}>
                        <circle cx={p.x} cy={p.y} r={Math.min(9, 3 + deg)} fill={n.id === activeId ? "var(--accent)" : "var(--fg-2)"} />
                        <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={7} fill="var(--fg)">{(n.title || "…").slice(0, 14)}</text>
                      </g>
                    ); })}
                  </>);
                })()}
              </svg>
            )}
          </div>
        </div>
      )}

      {/* version history */}
      {showHistory && active && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", backdropFilter: "blur(4px)" }} onClick={() => setShowHistory(false)}>
          <div className="flex max-h-[70vh] w-full max-w-md flex-col rounded-2xl border p-5 shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-lg">⟲ {T.history}</h3><button onClick={() => setShowHistory(false)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button></div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto thin-scroll">
              {(history[active.id] || []).length === 0 ? <p className="py-8 text-center text-sm text-[var(--fg-2)]">{T.noHistory}</p> : (history[active.id] || []).map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border p-2.5" style={{ borderColor: "var(--line)" }}>
                  <span className="mono shrink-0 text-[11px] text-[var(--fg-2)]">{new Date(s.t).toLocaleString()}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--fg-2)]">{(s.body.trim().match(/\S+/g) || []).length} {T.words}</span>
                  <button onClick={() => restoreSnap(s)} className="btn btn-outline h-7 shrink-0 px-2 py-0 text-xs">{T.restoreVer}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
