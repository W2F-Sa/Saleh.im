"use client";

/*
  Pulse — a status page & uptime monitor.

  Add HTTP monitors and Pulse checks them from your browser on an interval,
  timing each request. Because cross-origin pages can't be read directly, a
  monitor is probed with a no-cors request (and an image/He<ad> fallback); the
  round-trip time is real, and up/down is inferred from whether the fetch
  settled before a timeout. Each monitor keeps a rolling history that drives a
  latency sparkline, an uptime %, and an auto-generated incident timeline, with
  an overall status banner on top. Monitors persist to localStorage. Bilingual.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";

type Check = { t: number; up: boolean; ms: number };
type Monitor = { id: string; name: string; url: string; history: Check[] };

const STORE = "pulse:monitors:v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const MAX_HISTORY = 40;
const TIMEOUT = 8000;
const INTERVAL = 15000;

const seed = (): Monitor[] => [
  { id: uid(), name: "saleh.im", url: "https://saleh.im", history: [] },
  { id: uid(), name: "GitHub", url: "https://github.com", history: [] },
  { id: uid(), name: "Cloudflare", url: "https://www.cloudflare.com", history: [] },
];

async function probe(url: string): Promise<Check> {
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    // no-cors: we can't read the body/status, but a settled fetch means the
    // host answered — good enough to infer reachability + round-trip time.
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    return { t: Date.now(), up: true, ms: Math.round(performance.now() - start) };
  } catch {
    clearTimeout(timer);
    // fall back to an image ping (favicon) which some hosts allow
    const ok = await new Promise<boolean>((res) => {
      const img = new Image();
      const to = setTimeout(() => { res(false); }, TIMEOUT);
      img.onload = () => { clearTimeout(to); res(true); };
      img.onerror = () => { clearTimeout(to); res(false); };
      try { img.src = new URL("/favicon.ico", url).href + "?_=" + Date.now(); } catch { res(false); }
    });
    return { t: Date.now(), up: ok, ms: Math.round(performance.now() - start) };
  }
}

export default function PulsePage() {
  const { lang } = useLang();
  const fa = lang === "fa";
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const monitorsRef = useRef<Monitor[]>([]);
  monitorsRef.current = monitors;

  const T = fa
    ? { back: "بازگشت", brand: "پالس", tagline: "صفحهٔ وضعیت و مانیتورِ آپ‌تایم", add: "افزودن مانیتور", namePh: "نام (مثلاً وب‌سایت من)", urlPh: "https://example.com", allUp: "همهٔ سیستم‌ها برقرارند", someDown: "اختلال در برخی سیستم‌ها", checking: "در حال بررسی…", checkNow: "بررسی همه", up: "برقرار", down: "قطع", uptime: "آپ‌تایم", latency: "تأخیر", lastCheck: "آخرین بررسی", noData: "هنوز داده‌ای نیست — در حال بررسی…", remove: "حذف", incidents: "رخدادها", noIncidents: "هیچ رخدادی ثبت نشده. عالیه!", down2: "قطع شد", up2: "بازیابی شد", justNow: "همین حالا", ago: "پیش", secs: "ثانیه", mins: "دقیقه", hrs: "ساعت", monitors: "مانیتورها", empty: "هنوز مانیتوری اضافه نکرده‌ای.", note: "بررسی‌ها از مرورگرِ تو انجام می‌شوند؛ زمانِ رفت‌وبرگشت واقعی است." }
    : { back: "back", brand: "Pulse", tagline: "Status page & uptime monitor", add: "Add monitor", namePh: "Name (e.g. My website)", urlPh: "https://example.com", allUp: "All systems operational", someDown: "Some systems are down", checking: "Checking…", checkNow: "Check all", up: "Operational", down: "Down", uptime: "Uptime", latency: "Latency", lastCheck: "Last check", noData: "No data yet — checking…", remove: "Remove", incidents: "Incidents", noIncidents: "No incidents recorded. Nice!", down2: "went down", up2: "recovered", justNow: "just now", ago: "ago", secs: "s", mins: "m", hrs: "h", monitors: "Monitors", empty: "No monitors added yet.", note: "Checks run from your browser; the round-trip time is real." };

  useEffect(() => {
    try { const raw = localStorage.getItem(STORE); const p = raw ? JSON.parse(raw) : []; setMonitors(p.length ? p : seed()); }
    catch { setMonitors(seed()); }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(STORE, JSON.stringify(monitors)); } catch {} }, [monitors, ready]);

  const runChecks = useCallback(async () => {
    const list = monitorsRef.current;
    if (!list.length) return;
    setChecking(true);
    const results = await Promise.all(list.map((m) => probe(m.url).then((c) => [m.id, c] as const)));
    const map = new Map(results);
    setMonitors((prev) => prev.map((m) => { const c = map.get(m.id); return c ? { ...m, history: [...m.history, c].slice(-MAX_HISTORY) } : m; }));
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t0 = setTimeout(runChecks, 400);
    const iv = setInterval(runChecks, INTERVAL);
    return () => { clearTimeout(t0); clearInterval(iv); };
  }, [ready, runChecks]);

  const addMonitor = () => {
    let u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try { new URL(u); } catch { return; }
    const nm = name.trim() || new URL(u).hostname;
    setMonitors((p) => [...p, { id: uid(), name: nm, url: u, history: [] }]);
    setName(""); setUrl("");
    setTimeout(runChecks, 200);
  };
  const removeMonitor = (id: string) => setMonitors((p) => p.filter((m) => m.id !== id));

  const relTime = (t: number) => {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 5) return T.justNow;
    if (s < 60) return `${s}${T.secs} ${T.ago}`;
    if (s < 3600) return `${Math.floor(s / 60)}${T.mins} ${T.ago}`;
    return `${Math.floor(s / 3600)}${T.hrs} ${T.ago}`;
  };

  const allUp = monitors.length > 0 && monitors.every((m) => { const last = m.history[m.history.length - 1]; return !last || last.up; });

  // Build incident list from up->down / down->up transitions across all monitors.
  const incidents = useMemo(() => {
    const out: { id: string; name: string; up: boolean; t: number }[] = [];
    for (const m of monitors) {
      for (let i = 1; i < m.history.length; i++) {
        if (m.history[i].up !== m.history[i - 1].up) out.push({ id: m.id + i, name: m.name, up: m.history[i].up, t: m.history[i].t });
      }
    }
    return out.sort((a, b) => b.t - a.t).slice(0, 12);
  }, [monitors]);

  const Spark = ({ h }: { h: Check[] }) => {
    if (h.length < 2) return <div className="h-8" />;
    const max = Math.max(...h.map((c) => c.ms), 1);
    const w = 160, ht = 32, step = w / (MAX_HISTORY - 1);
    const pts = h.map((c, i) => `${i * step},${ht - (c.ms / max) * (ht - 4) - 2}`).join(" ");
    return (
      <svg width={w} height={ht} className="overflow-visible">
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
        {h.map((c, i) => <circle key={i} cx={i * step} cy={ht - (c.ms / max) * (ht - 4) - 2} r={c.up ? 1.4 : 2.6} fill={c.up ? "var(--accent)" : "#ef4444"} />)}
      </svg>
    );
  };

  return (
    <div className="min-h-[100dvh]" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-2) 82%, transparent)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>◉</span><span className="font-display text-lg">{T.brand}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runChecks} disabled={checking} className="btn btn-outline h-9 px-3 py-0 text-xs disabled:opacity-50">{checking ? T.checking : "↻ " + T.checkNow}</button>
          <ThemePicker /><LangToggle />
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <div>
          <h1 className="display gradient-text text-3xl sm:text-4xl">{T.brand}</h1>
          <p className="mt-1 text-sm text-[var(--fg-2)]">{T.tagline}</p>
        </div>

        {/* overall banner */}
        <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: allUp ? "color-mix(in srgb, #22c55e 14%, var(--bg-2))" : "color-mix(in srgb, #ef4444 14%, var(--bg-2))", border: `1px solid ${allUp ? "#22c55e55" : "#ef444455"}` }}>
          <span className="grid h-10 w-10 place-items-center rounded-full text-xl text-white" style={{ background: allUp ? "#22c55e" : "#ef4444" }}>{allUp ? "✓" : "!"}</span>
          <div>
            <div className="text-lg font-semibold">{allUp ? T.allUp : T.someDown}</div>
            <div className="text-xs text-[var(--fg-2)]">{monitors.length} {T.monitors.toLowerCase()}</div>
          </div>
        </div>

        {/* add monitor */}
        <div className="panel flex flex-col gap-2 p-3 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={T.namePh} className="rounded-xl border bg-transparent px-3 py-2 text-sm outline-none sm:w-56" style={{ borderColor: "var(--line)" }} />
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMonitor()} placeholder={T.urlPh} className="flex-1 rounded-xl border bg-transparent px-3 py-2 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} />
          <button onClick={addMonitor} className="btn btn-accent">+ {T.add}</button>
        </div>

        {/* monitors */}
        <div className="space-y-3">
          {monitors.length === 0 && <p className="py-8 text-center text-sm text-[var(--fg-2)]">{T.empty}</p>}
          {monitors.map((m) => {
            const last = m.history[m.history.length - 1];
            const up = !last || last.up;
            const uptime = m.history.length ? Math.round((m.history.filter((c) => c.up).length / m.history.length) * 100) : null;
            const avg = m.history.length ? Math.round(m.history.reduce((s, c) => s + c.ms, 0) / m.history.length) : null;
            return (
              <div key={m.id} className="panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative flex h-3 w-3 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: up ? "#22c55e" : "#ef4444" }} /><span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: up ? "#22c55e" : "#ef4444" }} /></span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{m.name}</div>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-[var(--fg-2)] hover:text-[var(--accent)] force-ltr">{m.url}</a>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-end"><div className="text-xs text-[var(--fg-2)]">{T.uptime}</div><div className="mono font-semibold" style={{ color: uptime === null ? "var(--fg-2)" : uptime >= 99 ? "#22c55e" : uptime >= 90 ? "#f59e0b" : "#ef4444" }}>{uptime === null ? "—" : uptime + "%"}</div></div>
                    <div className="text-end"><div className="text-xs text-[var(--fg-2)]">{T.latency}</div><div className="mono font-semibold">{avg === null ? "—" : avg + "ms"}</div></div>
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: up ? "#22c55e22" : "#ef444422", color: up ? "#22c55e" : "#ef4444" }}>{up ? T.up : T.down}</span>
                    <button onClick={() => removeMonitor(m.id)} className="grid h-8 w-8 place-items-center rounded-full border text-[var(--fg-2)] transition-colors hover:border-[#ff6a6a] hover:text-[#ff6a6a]" style={{ borderColor: "var(--line-2)" }} title={T.remove}>✕</button>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  {m.history.length < 2 ? <p className="text-xs text-[var(--fg-2)]">{T.noData}</p> : <Spark h={m.history} />}
                  {last && <span className="mono text-[11px] text-[var(--fg-2)]">{T.lastCheck}: {relTime(last.t)} · {last.ms}ms</span>}
                </div>
                {/* uptime bar of recent checks */}
                {m.history.length > 0 && (
                  <div className="mt-2 flex gap-0.5">
                    {m.history.slice(-MAX_HISTORY).map((c, i) => <span key={i} className="h-5 flex-1 rounded-sm" style={{ background: c.up ? "#22c55e" : "#ef4444", opacity: 0.35 + 0.65 * (i / m.history.length) }} title={`${c.ms}ms`} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* incidents */}
        <div className="panel p-4">
          <div className="label mb-3">🕓 {T.incidents}</div>
          {incidents.length === 0 ? <p className="text-sm text-[var(--fg-2)]">{T.noIncidents}</p> : (
            <ul className="space-y-2">
              {incidents.map((inc) => (
                <li key={inc.id} className="flex items-center gap-3 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: inc.up ? "#22c55e" : "#ef4444" }} />
                  <span className="font-medium">{inc.name}</span>
                  <span className="text-[var(--fg-2)]">{inc.up ? T.up2 : T.down2}</span>
                  <span className="mono ms-auto text-xs text-[var(--fg-2)]">{relTime(inc.t)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-[var(--fg-2)]">{T.note}</p>
      </div>
    </div>
  );
}
