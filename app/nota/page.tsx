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

const STORE = "nota:notes:v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const NOTE_COLORS = ["", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

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

  const T = fa
    ? { brand: "نوتا", newNote: "یادداشتِ تازه", search: "جست‌وجو…", untitled: "بدون عنوان", empty: "یادداشتی نیست", write: "بنویس…", edit: "ویرایش", split: "دوتایی", preview: "پیش‌نمایش", zen: "تمرکز", del: "حذف", backlinks: "ارجاع‌ها", noBacklinks: "ارجاعی نیست.", words: "کلمه", chars: "نویسه", read: "دقیقه", tags: "برچسب", export: "برون‌بری JSON", import: "درون‌ری JSON", importMd: "درون‌ریِ ‎.md", exportAll: "خروجیِ همه", all: "همه", confirmDel: "به سطلِ زباله برود؟", titlePh: "عنوان", pickNote: "یک یادداشت انتخاب کن.", pin: "سنجاق", fav: "علاقه‌مندی", favs: "علاقه‌مندی‌ها", dupl: "تکثیر", exportMd: "خروجیِ ‎.md", copyMd: "کپیِ مارک‌داون", copyLink: "کپیِ پیوند", toc: "فهرست", sortBy: "مرتب‌سازی", sUpdated: "ویرایش", sCreated: "ساخت", sTitle: "عنوان", templates: "قالب‌ها", tplDaily: "روزانه", tplMeeting: "جلسه", tplTable: "جدول", color: "رنگ", notebooks: "دفترچه‌ها", trash: "سطلِ زباله", restore: "بازگردانی", delForever: "حذفِ کامل", emptyTrash: "خالی‌کردن", moveTo: "انتقال به", find: "یافتن", replace: "جایگزینی", replaceAll: "جایگزینیِ همه", goal: "هدفِ کلمه", saved: "ذخیره شد", noNotebook: "بدون دفترچه", edited: "ویرایش" }
    : { brand: "Nota", newNote: "New note", search: "Search…", untitled: "Untitled", empty: "No notes", write: "Write…", edit: "Edit", split: "Split", preview: "Preview", zen: "Zen", del: "Delete", backlinks: "Backlinks", noBacklinks: "No backlinks yet.", words: "words", chars: "chars", read: "min", tags: "Tags", export: "Export JSON", import: "Import JSON", importMd: "Import .md", exportAll: "Export all", all: "All", confirmDel: "Move to trash?", titlePh: "Title", pickNote: "Select a note.", pin: "Pin", fav: "Favourite", favs: "Favourites", dupl: "Duplicate", exportMd: "Export .md", copyMd: "Copy markdown", copyLink: "Copy link", toc: "Contents", sortBy: "Sort", sUpdated: "Edited", sCreated: "Created", sTitle: "Title", templates: "Templates", tplDaily: "Daily", tplMeeting: "Meeting", tplTable: "Table", color: "Color", notebooks: "Notebooks", trash: "Trash", restore: "Restore", delForever: "Delete forever", emptyTrash: "Empty trash", moveTo: "Move to", find: "Find", replace: "Replace", replaceAll: "Replace all", goal: "Word goal", saved: "Saved", noNotebook: "No notebook", edited: "Edited" };

  useEffect(() => { try { const raw = localStorage.getItem(STORE); const p: Note[] = raw ? JSON.parse(raw) : []; const data = p.length ? p : seed(fa); setNotes(data); setActiveId(data.find((n) => !n.trashed)?.id ?? null); } catch { const s = seed(fa); setNotes(s); setActiveId(s[0]?.id ?? null); } setReady(true); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(STORE, JSON.stringify(notes)); } catch {} setSaved(true); const t = setTimeout(() => setSaved(false), 1200); return () => clearTimeout(t); } }, [notes, ready]);

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

  const insertTemplate = (kind: "daily" | "meeting" | "table") => { setShowTpl(false); const d = new Date().toISOString().slice(0, 10); const body = kind === "daily" ? (fa ? `# ${d}\n\n## تمرکز\n- \n\n## یادداشت‌ها\n\n## کارها\n- [ ] ` : `# ${d}\n\n## Focus\n- \n\n## Notes\n\n## Tasks\n- [ ] `) : kind === "meeting" ? (fa ? `# جلسه — \n\n**تاریخ:** ${d}\n**حاضران:** \n\n## دستورِ کار\n- \n\n## تصمیم‌ها\n\n## اقدامات\n- [ ] ` : `# Meeting — \n\n**Date:** ${d}\n**Attendees:** \n\n## Agenda\n- \n\n## Decisions\n\n## Action items\n- [ ] `) : (fa ? `| ستون ۱ | ستون ۲ |\n| --- | --- |\n| مقدار | مقدار |\n` : `| Column 1 | Column 2 |\n| --- | --- |\n| value | value |\n`); createNote(kind === "daily" ? d : kind === "meeting" ? (fa ? "جلسه" : "Meeting") : (fa ? "جدول" : "Table"), body); };

  const live = notes.filter((n) => !n.trashed);
  const trashed = notes.filter((n) => n.trashed);
  const allTags = useMemo(() => Array.from(new Set(live.flatMap((n) => tagsOf(n.body)))).sort(), [notes]); // eslint-disable-line
  const allFolders = useMemo(() => Array.from(new Set(live.map((n) => n.folder).filter(Boolean) as string[])).sort(), [notes]); // eslint-disable-line
  const backlinks = useMemo(() => { if (!active) return []; const t = active.title.trim().toLowerCase(); return live.filter((n) => n.id !== active.id && linksOf(n.body).includes(t)); }, [notes, active]); // eslint-disable-line
  const toc = useMemo(() => (active ? headingsOf(active.body) : []), [active]);

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

  const rel = (t: number) => { const s = (Date.now() - t) / 1000; if (s < 60) return fa ? "الان" : "now"; if (s < 3600) return `${Math.floor(s / 60)}${fa ? "د" : "m"}`; if (s < 86400) return `${Math.floor(s / 3600)}${fa ? "س" : "h"}`; return `${Math.floor(s / 86400)}${fa ? "ر" : "d"}`; };

  // shortcuts
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey; if (!mod) return; const k = e.key.toLowerCase();
      if (k === "n") { e.preventDefault(); createNote(""); } else if (k === "f") { e.preventDefault(); searchRef.current?.focus(); } else if (k === "s") { e.preventDefault(); if (active) download((active.title || "note") + ".md", active.body, "text/markdown"); }
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
                {showTpl && (<><div className="fixed inset-0 z-10" onClick={() => setShowTpl(false)} /><div className="absolute end-0 z-20 mt-1 w-44 rounded-xl border p-1 text-sm shadow-lg" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}><div className="label px-2 py-1">{T.templates}</div><button onClick={() => insertTemplate("daily")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">📅 {T.tplDaily}</button><button onClick={() => insertTemplate("meeting")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">👥 {T.tplMeeting}</button><button onClick={() => insertTemplate("table")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">▦ {T.tplTable}</button></div></>)}
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
                <button onClick={() => { setActiveId(n.id); setSidebar(false); }} className="mb-1 block w-full rounded-xl p-2.5 text-start transition-colors" style={{ background: activeId === n.id ? "var(--bg-3)" : "transparent", borderInlineStart: n.color ? `3px solid ${n.color}` : "3px solid transparent" }}>
                  <div className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{n.title || T.untitled}</span>{n.fav && <span className="text-xs">★</span>}{n.pinned && <span className="text-xs">📌</span>}<span className="mono ms-auto shrink-0 text-[10px] text-[var(--fg-2)]">{rel(n.updated)}</span></div>
                  <div className="truncate text-xs text-[var(--fg-2)]">{n.body.replace(/[#*`>\-[\]|]/g, "").slice(0, 60) || "…"}</div>
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
                {view !== "preview" && <textarea ref={bodyRef} value={active.body} onChange={(e) => patchActive({ body: e.target.value })} placeholder={T.write} className="min-h-0 resize-none overflow-y-auto border-e p-4 mono text-[14px] leading-relaxed outline-none thin-scroll force-ltr" style={{ background: "var(--bg)", borderColor: "var(--line)" }} />}
                {view !== "edit" && (
                  <div ref={previewRef} className={`min-h-0 overflow-y-auto p-4 thin-scroll ${zen ? "mx-auto max-w-2xl" : ""}`} style={{ background: "var(--bg)" }}>
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
    </div>
  );
}
