"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TOOLS, CATEGORIES, type ToolDef } from "./tools";
import { TOOLS2, CATEGORIES2 } from "./tools2";
import { ThemePicker } from "@/components/theme-picker";

/* Merge the original toolset with the extended one, de-duplicating by id. */
const ALL_TOOLS: ToolDef[] = (() => {
  const seen = new Set<string>();
  const merged: ToolDef[] = [];
  for (const t of [...TOOLS, ...TOOLS2]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    merged.push(t);
  }
  return merged;
})();

/* Ordered, de-duplicated category list across both toolsets. */
const ALL_CATEGORIES: string[] = (() => {
  const order = [...CATEGORIES, ...CATEGORIES2];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of order) {
    if (ALL_TOOLS.some((t) => t.category === c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
})();

const CAT_COLOR: Record<string, string> = {
  Data: "#38bdf8",
  Encode: "#a78bfa",
  Generate: "#22c55e",
  Convert: "#fbbf24",
  Text: "#f472b6",
  CSS: "#22d3ee",
  Web: "#fb7185",
  Math: "#f59e0b",
  Color: "#ec4899",
  Dev: "#60a5fa",
  Network: "#34d399",
  Random: "#c084fc",
  Time: "#2dd4bf",
};
const catColor = (c: string) => CAT_COLOR[c] || "var(--accent)";

const CAT_ICON: Record<string, string> = {
  Data: "⛁", Encode: "🔐", Generate: "✦", Convert: "⇌", Text: "Aa", CSS: "❏", Web: "🌐",
  Math: "∑", Color: "🎨", Dev: "⌂", Network: "🖧", Random: "🎲", Time: "⏱",
};

export default function ForgePage() {
  const [activeId, setActiveId] = useState(ALL_TOOLS[0].id);
  const [activeCat, setActiveCat] = useState(ALL_CATEGORIES[0]);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // deep-link the active tool via the URL hash and sync the active tab to it
  useEffect(() => {
    const h = decodeURIComponent(location.hash.slice(1));
    const t = ALL_TOOLS.find((x) => x.id === h);
    if (t) {
      setActiveId(t.id);
      setActiveCat(t.category);
    }
  }, []);
  useEffect(() => {
    history.replaceState(null, "", `#${activeId}`);
  }, [activeId]);

  // Ctrl/⌘+K focuses the tool search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searching = query.trim().length > 0;

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_TOOLS.filter((t) => (t.name + " " + t.keywords + " " + t.category).toLowerCase().includes(q));
  }, [query]);

  // tools shown in the sidebar: search results, or the active tab's tools
  const visibleTools = useMemo(
    () => (searching ? searchResults : ALL_TOOLS.filter((t) => t.category === activeCat)),
    [searching, searchResults, activeCat],
  );

  const countByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of ALL_TOOLS) m[t.category] = (m[t.category] || 0) + 1;
    return m;
  }, []);

  const active = ALL_TOOLS.find((t) => t.id === activeId) ?? ALL_TOOLS[0];
  const Active = active.render;

  const openTool = (t: ToolDef) => {
    setActiveId(t.id);
    setActiveCat(t.category);
    setQuery("");
    setNavOpen(false);
  };

  return (
    <div className="relative min-h-screen">
      {/* ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 dotfield opacity-70" />
        <div className="aurora left-[-6%] top-[-4%] h-80 w-80" style={{ background: "var(--accent)" }} />
        <div className="aurora right-[-4%] top-[26%] h-72 w-72" style={{ background: "var(--accent-2)", opacity: 0.24, animationDelay: "-7s" }} />
      </div>

      {/* top bar */}
      <header className="sticky top-0 z-40 border-b glass" style={{ borderColor: "var(--line)" }}>
        <div className="mx-auto flex max-w-[104rem] items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="link-sweep flex items-center gap-2 text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            saleh.im
          </Link>
          <span className="text-[var(--line-2)]">/</span>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg text-sm font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>⚒</span>
            <span className="font-display text-lg font-semibold">Forge</span>
            <span className="chip hidden sm:inline">{ALL_TOOLS.length} tools</span>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button onClick={() => setNavOpen((v) => !v)} className="btn btn-outline px-3 py-2 text-xs lg:hidden">☰ Tools</button>
            <ThemePicker />
          </div>
        </div>

        {/* category tabs */}
        <div className="border-t" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto max-w-[104rem] px-2 sm:px-4">
            <div className="thin-scroll flex items-center gap-1 overflow-x-auto py-2">
              {ALL_CATEGORIES.map((cat) => {
                const activeTab = !searching && cat === activeCat;
                const col = catColor(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCat(cat);
                      setQuery("");
                      const first = ALL_TOOLS.find((t) => t.category === cat);
                      if (first) setActiveId(first.id);
                    }}
                    className="group flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all"
                    style={
                      activeTab
                        ? { background: col, color: "#0b0c0e", boxShadow: `0 6px 18px -8px ${col}` }
                        : { color: "var(--fg-2)", border: "1px solid var(--line-2)" }
                    }
                  >
                    <span className="text-xs">{CAT_ICON[cat] ?? "•"}</span>
                    {cat}
                    <span
                      className="mono rounded-full px-1.5 py-0.5 text-[10px]"
                      style={activeTab ? { background: "rgba(0,0,0,0.18)" } : { background: "var(--bg-3)", color: "var(--fg-2)" }}
                    >
                      {countByCat[cat]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[104rem] gap-6 px-4 py-6 sm:px-6">
        {/* sidebar */}
        <aside className={`${navOpen ? "block" : "hidden"} shrink-0 lg:block lg:w-72`}>
          <div className="lg:sticky lg:top-32">
            <div className="relative mb-3">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all tools…"
                className="w-full rounded-xl border bg-[var(--bg-2)] py-2.5 pl-9 pr-14 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                style={{ borderColor: "var(--line-2)" }}
              />
              <svg className="pointer-events-none absolute left-3 top-3 text-[var(--fg-2)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <span className="kbd absolute right-3 top-2.5">⌘K</span>
            </div>

            <div className="mb-2 flex items-center justify-between px-1">
              <p className="label">{searching ? `Results (${visibleTools.length})` : activeCat}</p>
              {!searching && <span className="mono text-[10px] text-[var(--fg-2)]">{visibleTools.length} tools</span>}
            </div>

            <nav className="thin-scroll max-h-[calc(100vh-13rem)] overflow-auto pr-1">
              <div className="grid gap-0.5">
                {visibleTools.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openTool(t)}
                    className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-start text-sm transition-all hover:translate-x-0.5"
                    style={
                      t.id === activeId
                        ? { background: "var(--bg-3)", boxShadow: `inset 2px 0 0 ${catColor(t.category)}` }
                        : {}
                    }
                  >
                    <span
                      className="mono grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs transition-all group-hover:scale-110"
                      style={{
                        background: t.id === activeId ? catColor(t.category) : `color-mix(in srgb, ${catColor(t.category)} 12%, transparent)`,
                        color: t.id === activeId ? "#0b0c0e" : catColor(t.category),
                        border: `1px solid color-mix(in srgb, ${catColor(t.category)} 24%, transparent)`,
                      }}
                    >
                      {t.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={t.id === activeId ? "block font-medium" : "block text-[var(--fg-2)] group-hover:text-[var(--fg)]"}>{t.name}</span>
                      {searching && <span className="block text-[10px] text-[var(--fg-2)]">{t.category}</span>}
                    </span>
                  </button>
                ))}
              </div>
              {visibleTools.length === 0 && <p className="px-2 py-4 text-sm text-[var(--fg-2)]">No tools match “{query}”.</p>}
            </nav>
          </div>
        </aside>

        {/* main tool panel */}
        <main className="min-w-0 flex-1">
          <div key={active.id} className="mx-auto max-w-3xl">
            <Active />
          </div>

          <footer className="mx-auto mt-14 max-w-3xl border-t pt-6 text-center text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)" }}>
            <p>
              Forge · a developer toolbox by{" "}
              <Link href="/" className="link-sweep accent-text">Saleh</Link>. {ALL_TOOLS.length} tools across {ALL_CATEGORIES.length} categories — everything runs locally in your browser.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
