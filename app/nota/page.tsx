"use client";

/*
  Nota — an offline-first, markdown-native knowledge base.

  Everything lives in localStorage (no server, no account). Features:
    • Markdown editor with a live split/preview renderer (headings, bold,
      italic, code, code-blocks, quotes, lists, task lists, links, rules).
    • [[wiki links]] that create-or-open notes, plus an automatic backlinks
      panel showing every note that references the current one.
    • #tags parsed from the body, with a tag filter rail.
    • Instant full-text search across titles + bodies.
    • JSON export / import for portability, and a word/char/backlink readout.
    • Fully bilingual (English / Persian) and theme-aware.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";

type Note = { id: string; title: string; body: string; created: number; updated: number };

const STORE = "nota:notes:v1";
const uid = () => Math.random().toString(36).slice(2, 10);

const seed = (fa: boolean): Note[] => {
  const now = Date.now();
  return [
    {
      id: uid(),
      title: fa ? "به نوتا خوش آمدی" : "Welcome to Nota",
      body: fa
        ? "# سلام 👋\n\nنوتا یک **پایگاهِ دانشِ آفلاین‌محور** است. همه‌چیز فقط در مرورگرِ تو ذخیره می‌شود.\n\n## چه کارهایی می‌کنی؟\n- نوشتن با **مارک‌داون**\n- ساختِ پیوند با `[[عنوانِ یادداشت]]`\n- برچسب با #ایده و #راهنما\n- جست‌وجوی متنِ کامل\n\n> این یادداشت را ویرایش کن یا یکی تازه بساز.\n\n- [x] نوتا را باز کن\n- [ ] اولین یادداشتت را بنویس\n\nنگاهی بینداز به [[ایده‌ها]]."
        : "# Hello 👋\n\nNota is an **offline-first knowledge base**. Everything is stored only in your browser.\n\n## What can you do?\n- Write in **markdown**\n- Link notes with `[[Note title]]`\n- Tag with #idea and #guide\n- Full-text search across everything\n\n> Edit this note or create a fresh one.\n\n- [x] Open Nota\n- [ ] Write your first note\n\nTake a look at [[Ideas]].",
      created: now,
      updated: now,
    },
    {
      id: uid(),
      title: fa ? "ایده‌ها" : "Ideas",
      body: fa
        ? "# ایده‌ها\n\nهرچه به ذهنت رسید اینجا بنویس. #ایده\n\n- یک اپِ آب‌وهوا\n- بازنویسیِ رزومه\n\nبرگرد به [[به نوتا خوش آمدی]]."
        : "# Ideas\n\nCapture anything here. #idea\n\n- A weather app\n- Rewrite the résumé\n\nBack to [[Welcome to Nota]].",
      created: now - 1000,
      updated: now - 1000,
    },
  ];
};

/* ----------------------------- markdown ----------------------------- */

function InlineMD({ text, onLink }: { text: string; onLink: (title: string) => void }) {
  // Tokenise inline markdown into React nodes. Order matters: code first.
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)]+\))/;
  while (rest.length) {
    const m = rest.match(re);
    if (!m || m.index === undefined) { nodes.push(<span key={key++}>{rest}</span>); break; }
    if (m.index > 0) nodes.push(<span key={key++}>{rest.slice(0, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith("`")) nodes.push(<code key={key++} className="rounded px-1.5 py-0.5 mono text-[0.85em]" style={{ background: "var(--bg-3)", color: "var(--accent)" }}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) nodes.push(<b key={key++}>{tok.slice(2, -2)}</b>);
    else if (tok.startsWith("*")) nodes.push(<i key={key++}>{tok.slice(1, -1)}</i>);
    else if (tok.startsWith("[[")) {
      const title = tok.slice(2, -2).trim();
      nodes.push(<button key={key++} onClick={() => onLink(title)} className="rounded px-1 font-medium underline decoration-dotted underline-offset-2" style={{ color: "var(--accent)" }}>{title}</button>);
    } else {
      const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
      nodes.push(<a key={key++} href={mm[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>{mm[1]}</a>);
    }
    rest = rest.slice(m.index + tok.length);
  }
  return <>{nodes}</>;
}

function Markdown({ src, onLink }: { src: string; onLink: (title: string) => void }) {
  const lines = src.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  let list: React.ReactNode[] | null = null;
  const flush = () => { if (list) { out.push(<ul key={key++} className="my-2 space-y-1 ps-5">{list}</ul>); list = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flush();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      out.push(<pre key={key++} className="my-2 overflow-x-auto rounded-xl p-3 mono text-[13px]" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      flush();
      const level = line.match(/^#+/)![0].length;
      const txt = line.replace(/^#+\s/, "");
      const cls = level === 1 ? "mt-3 mb-1 text-2xl font-display" : level === 2 ? "mt-3 mb-1 text-xl font-semibold" : "mt-2 mb-1 text-lg font-semibold";
      out.push(<div key={key++} className={cls}><InlineMD text={txt} onLink={onLink} /></div>);
    } else if (/^>\s/.test(line)) {
      flush();
      out.push(<blockquote key={key++} className="my-2 border-s-2 ps-3 text-[var(--fg-2)]" style={{ borderColor: "var(--accent)" }}><InlineMD text={line.replace(/^>\s/, "")} onLink={onLink} /></blockquote>);
    } else if (/^---+\s*$/.test(line)) {
      flush();
      out.push(<hr key={key++} className="my-3" style={{ borderColor: "var(--line)" }} />);
    } else if (/^\s*-\s\[[ x]\]\s/.test(line)) {
      const checked = /\[x\]/i.test(line);
      const txt = line.replace(/^\s*-\s\[[ x]\]\s/, "");
      list = list || [];
      list.push(<li key={key++} className="flex list-none items-start gap-2 -ms-5"><span className="mt-0.5" style={{ color: checked ? "var(--accent)" : "var(--fg-2)" }}>{checked ? "☑" : "☐"}</span><span className={checked ? "line-through opacity-60" : ""}><InlineMD text={txt} onLink={onLink} /></span></li>);
    } else if (/^\s*[-*]\s/.test(line)) {
      list = list || [];
      list.push(<li key={key++} className="list-disc"><InlineMD text={line.replace(/^\s*[-*]\s/, "")} onLink={onLink} /></li>);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      out.push(<p key={key++} className="my-1.5 leading-relaxed"><InlineMD text={line} onLink={onLink} /></p>);
    }
    i++;
  }
  flush();
  return <div className="text-[15px]">{out}</div>;
}

const tagsOf = (body: string) => Array.from(new Set((body.match(/(^|\s)#([\p{L}\d_-]+)/gu) || []).map((t) => t.trim().replace(/^#/, "").toLowerCase())));
const linksOf = (body: string) => Array.from(new Set((body.match(/\[\[([^\]]+)\]\]/g) || []).map((t) => t.slice(2, -2).trim().toLowerCase())));

export default function NotaPage() {
  const { lang } = useLang();
  const fa = lang === "fa";
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const [ready, setReady] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const T = fa
    ? { back: "بازگشت", brand: "نوتا", tag: "پایگاهِ دانشِ مارک‌داونِ آفلاین", newNote: "یادداشتِ تازه", search: "جست‌وجو در همه…", untitled: "بدون عنوان", empty: "یادداشتی نیست", write: "بنویس…", preview: "پیش‌نمایش", edit: "ویرایش", del: "حذف", backlinks: "ارجاع‌ها", noBacklinks: "هیچ یادداشتی به این ارجاع نداده.", words: "کلمه", chars: "نویسه", tags: "برچسب‌ها", export: "برون‌بری", import: "درون‌ری", all: "همه", confirmDel: "این یادداشت حذف شود؟", titlePh: "عنوان یادداشت", pickNote: "یک یادداشت را انتخاب کن یا یکی تازه بساز." }
    : { back: "back", brand: "Nota", tag: "Offline-first markdown knowledge base", newNote: "New note", search: "Search everything…", untitled: "Untitled", empty: "No notes", write: "Write…", preview: "Preview", edit: "Edit", del: "Delete", backlinks: "Backlinks", noBacklinks: "No notes link here yet.", words: "words", chars: "chars", tags: "Tags", export: "Export", import: "Import", all: "All", confirmDel: "Delete this note?", titlePh: "Note title", pickNote: "Select a note or create a new one." };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      const parsed: Note[] = raw ? JSON.parse(raw) : [];
      const data = parsed.length ? parsed : seed(fa);
      setNotes(data);
      setActiveId(data[0]?.id ?? null);
    } catch { const s = seed(fa); setNotes(s); setActiveId(s[0]?.id ?? null); }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ready) try { localStorage.setItem(STORE, JSON.stringify(notes)); } catch {} }, [notes, ready]);

  const active = notes.find((n) => n.id === activeId) || null;

  const createNote = useCallback((title = "") => {
    const now = Date.now();
    const n: Note = { id: uid(), title, body: "", created: now, updated: now };
    setNotes((p) => [n, ...p]);
    setActiveId(n.id);
    setSidebar(false);
    return n;
  }, []);

  const patchActive = (patch: Partial<Note>) => setNotes((p) => p.map((n) => (n.id === activeId ? { ...n, ...patch, updated: Date.now() } : n)));

  const openByTitle = (title: string) => {
    const found = notes.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase());
    if (found) { setActiveId(found.id); setSidebar(false); }
    else createNote(title);
  };

  const removeActive = () => {
    if (!active || !window.confirm(T.confirmDel)) return;
    setNotes((p) => { const next = p.filter((n) => n.id !== active.id); setActiveId(next[0]?.id ?? null); return next; });
  };

  const allTags = useMemo(() => Array.from(new Set(notes.flatMap((n) => tagsOf(n.body)))).sort(), [notes]);
  const backlinks = useMemo(() => {
    if (!active) return [];
    const t = active.title.trim().toLowerCase();
    return notes.filter((n) => n.id !== active.id && linksOf(n.body).includes(t));
  }, [notes, active]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...notes]
      .filter((n) => (!tag || tagsOf(n.body).includes(tag)))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => b.updated - a.updated);
  }, [notes, query, tag]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "nota-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJSON = (file: File) => {
    const r = new FileReader();
    r.onload = () => { try { const arr = JSON.parse(r.result as string); if (Array.isArray(arr)) { setNotes(arr); setActiveId(arr[0]?.id ?? null); } } catch {} };
    r.readAsText(file);
  };

  const wordCount = active ? (active.body.trim().match(/\S+/g) || []).length : 0;

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>◲</span>
            <span className="font-display text-lg">{T.brand}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportJSON} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex">↓ {T.export}</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex">↑ {T.import}</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.currentTarget.value = ""; }} />
          <ThemePicker />
          <LangToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className={`${sidebar ? "flex" : "hidden"} w-full flex-col border-e sm:flex sm:w-80 sm:shrink-0`} style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
          <div className="space-y-2 border-b p-3" style={{ borderColor: "var(--line)" }}>
            <button onClick={() => createNote("")} className="btn btn-accent w-full">+ {T.newNote}</button>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.search} className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} />
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button onClick={() => setTag(null)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: tag === null ? "var(--accent)" : "var(--bg-3)", color: tag === null ? "var(--on-accent)" : "var(--fg-2)" }}>{T.all}</button>
                {allTags.map((tg) => (
                  <button key={tg} onClick={() => setTag(tg === tag ? null : tg)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: tag === tg ? "var(--accent)" : "var(--bg-3)", color: tag === tg ? "var(--on-accent)" : "var(--fg-2)" }}>#{tg}</button>
                ))}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
            {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-[var(--fg-2)]">{T.empty}</p>}
            {filtered.map((n) => (
              <button key={n.id} onClick={() => { setActiveId(n.id); setSidebar(false); }} className="mb-1 block w-full rounded-xl p-2.5 text-start transition-colors" style={{ background: activeId === n.id ? "var(--bg-3)" : "transparent" }}>
                <div className="truncate text-sm font-medium">{n.title || T.untitled}</div>
                <div className="truncate text-xs text-[var(--fg-2)]">{n.body.replace(/[#*`>\-[\]]/g, "").slice(0, 60) || "…"}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* editor */}
        <main className={`${sidebar ? "hidden" : "flex"} min-w-0 flex-1 flex-col sm:flex`}>
          {!active ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-[var(--fg-2)]">{T.pickNote}</div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <button onClick={() => setSidebar(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border sm:hidden" style={{ borderColor: "var(--line-2)" }}>☰</button>
                <input value={active.title} onChange={(e) => patchActive({ title: e.target.value })} placeholder={T.titlePh} className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none" />
                <button onClick={() => setPreview((p) => !p)} className="btn btn-outline h-9 px-3 py-0 text-xs">{preview ? T.edit : T.preview}</button>
                <button onClick={removeActive} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors hover:border-[#ff6a6a] hover:text-[#ff6a6a]" style={{ borderColor: "var(--line-2)" }} title={T.del}>🗑</button>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
                {(!preview || typeof window === "undefined") && (
                  <textarea value={active.body} onChange={(e) => patchActive({ body: e.target.value })} placeholder={T.write} className="min-h-0 resize-none overflow-y-auto border-e p-4 mono text-[14px] leading-relaxed outline-none thin-scroll force-ltr" style={{ background: "var(--bg)", borderColor: "var(--line)" }} />
                )}
                {preview && (
                  <div className="min-h-0 overflow-y-auto p-4 thin-scroll" style={{ background: "var(--bg)" }}>
                    <Markdown src={active.body || (fa ? "*خالی*" : "*Empty*")} onLink={openByTitle} />
                    <div className="mt-6 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                      <div className="label mb-2">🔗 {T.backlinks}</div>
                      {backlinks.length === 0 ? <p className="text-xs text-[var(--fg-2)]">{T.noBacklinks}</p> : (
                        <div className="flex flex-wrap gap-1.5">
                          {backlinks.map((b) => <button key={b.id} onClick={() => setActiveId(b.id)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }}>{b.title || T.untitled}</button>)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {!preview && (
                  <div className="hidden min-h-0 overflow-y-auto p-4 md:block thin-scroll" style={{ background: "var(--bg-2)" }}>
                    <Markdown src={active.body || (fa ? "*خالی*" : "*Empty*")} onLink={openByTitle} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 border-t px-4 py-2 text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <span className="mono">{wordCount} {T.words}</span>
                <span className="mono">{active.body.length} {T.chars}</span>
                {tagsOf(active.body).length > 0 && <span className="truncate">{tagsOf(active.body).map((t) => `#${t}`).join(" ")}</span>}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
