"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";

/* ============================================================================
   Lumen — a real-time markets dashboard powered by the public CoinGecko API.
   Everything here is real, live data (with a graceful synthetic fallback if the
   API is rate-limited). Historical charts, OHLC candles, trending, a watchlist,
   currency switching, sortable tables and a per-coin detail view.
   ========================================================================== */

const API = "https://api.coingecko.com/api/v3";

type Coin = {
  id: string; symbol: string; name: string; image?: string;
  price: number; change24h: number; change7d?: number;
  marketCap: number; volume: number; rank?: number; supply?: number;
  ath?: number; high24?: number; low24?: number; spark: number[];
};
type Global = { cap: number; vol: number; btcDom: number; ethDom: number; coins: number; capChange: number };
type Trend = { id: string; name: string; symbol: string; thumb: string; rank: number };
type Currency = "usd" | "eur" | "gbp" | "jpy";
const CUR_SYMBOL: Record<Currency, string> = { usd: "$", eur: "€", gbp: "£", jpy: "¥" };

const FALLBACK: Coin[] = [
  { id: "bitcoin", symbol: "btc", name: "Bitcoin", price: 68432, change24h: 1.8, change7d: 4.2, marketCap: 1.35e12, volume: 3.2e10, rank: 1, spark: [] },
  { id: "ethereum", symbol: "eth", name: "Ethereum", price: 3567, change24h: -0.9, change7d: 2.1, marketCap: 4.3e11, volume: 1.6e10, rank: 2, spark: [] },
  { id: "solana", symbol: "sol", name: "Solana", price: 172, change24h: 3.4, change7d: 8.7, marketCap: 7.8e10, volume: 4.1e9, rank: 5, spark: [] },
  { id: "binancecoin", symbol: "bnb", name: "BNB", price: 592, change24h: 0.6, change7d: 1.2, marketCap: 8.9e10, volume: 1.9e9, rank: 4, spark: [] },
  { id: "ripple", symbol: "xrp", name: "XRP", price: 0.61, change24h: -1.4, change7d: -3.0, marketCap: 3.4e10, volume: 1.1e9, rank: 6, spark: [] },
  { id: "cardano", symbol: "ada", name: "Cardano", price: 0.45, change24h: 2.1, change7d: 5.5, marketCap: 1.6e10, volume: 6e8, rank: 9, spark: [] },
  { id: "dogecoin", symbol: "doge", name: "Dogecoin", price: 0.16, change24h: 4.8, change7d: 12.0, marketCap: 2.3e10, volume: 1.4e9, rank: 8, spark: [] },
  { id: "avalanche-2", symbol: "avax", name: "Avalanche", price: 38, change24h: -2.2, change7d: -1.1, marketCap: 1.5e10, volume: 4e8, rank: 12, spark: [] },
].map((c) => ({ ...c, spark: Array.from({ length: 40 }, (_, i) => c.price * (1 + Math.sin(i / 4) * 0.05 + (Math.random() - 0.5) * 0.02)) }));

function walk(arr: number[], base: number) {
  const next = arr.slice(1);
  next.push((arr[arr.length - 1] || base) * (1 + (Math.random() - 0.5) * 0.02));
  return next;
}

/* ---------- primitives ---------- */
function Counter({ value, format }: { value: number; format: (n: number) => string }) {
  const [disp, setDisp] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    let raf = 0;
    const from = ref.current;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      ref.current = v;
      setDisp(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(disp)}</>;
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  const path = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
    return data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24 - 2}`).join(" ");
  }, [data]);
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full">
      <polyline points={path} fill="none" stroke={up ? "#22c55e" : "#ef4444"} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function AreaChart({ data, up, height = "16rem" }: { data: number[]; up: boolean; height?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const { line, fill, pts } = useMemo(() => {
    if (data.length < 2) return { line: "", fill: "", pts: [] as number[][] };
    const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
    const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 100 - ((v - min) / range) * 86 - 7]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
    return { line, fill: `${line} L100,100 L0,100 Z`, pts };
  }, [data]);
  const col = up ? "#22c55e" : "#ef4444";
  const dot = pts[hover ?? pts.length - 1];
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" onMouseMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); setHover(Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - r.left) / r.width) * (data.length - 1))))); }} onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.28" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
        {[25, 50, 75].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
        <path d={fill} fill="url(#lg)" style={{ transition: "d .6s ease" }} />
        <path d={line} fill="none" stroke={col} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "d .6s ease" }} />
        {dot && <circle cx={dot[0]} cy={dot[1]} r="1.8" fill={col} vectorEffect="non-scaling-stroke" />}
        {dot && hover != null && <line x1={dot[0]} y1="0" x2={dot[0]} y2="100" stroke="var(--line-2)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />}
      </svg>
    </div>
  );
}

function Candles({ ohlc }: { ohlc: number[][] }) {
  const { bars, min, range } = useMemo(() => {
    if (!ohlc.length) return { bars: [] as any[], min: 0, range: 1 };
    const lows = ohlc.map((c) => c[3]), highs = ohlc.map((c) => c[2]);
    const min = Math.min(...lows), max = Math.max(...highs), range = max - min || 1;
    const w = 100 / ohlc.length;
    const bars = ohlc.map((c, i) => {
      const [, o, h, l, cl] = c;
      const x = i * w + w / 2;
      const y = (v: number) => 100 - ((v - min) / range) * 92 - 4;
      return { x, w: w * 0.6, top: y(Math.max(o, cl)), bot: y(Math.min(o, cl)), hi: y(h), lo: y(l), up: cl >= o };
    });
    return { bars, min, range };
  }, [ohlc]);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      {bars.map((b, i) => (
        <g key={i}>
          <line x1={b.x} y1={b.hi} x2={b.x} y2={b.lo} stroke={b.up ? "#22c55e" : "#ef4444"} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          <rect x={b.x - b.w / 2} y={Math.min(b.top, b.bot)} width={b.w} height={Math.max(0.6, Math.abs(b.bot - b.top))} fill={b.up ? "#22c55e" : "#ef4444"} />
        </g>
      ))}
    </svg>
  );
}

function Donut({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90">
      {segments.map((s, i) => {
        const dash = (s.value / total) * c;
        const el = <circle key={i} cx="50" cy="50" r={r} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc} style={{ transition: "stroke-dasharray .6s ease, stroke-dashoffset .6s ease" }} />;
        acc += dash;
        return el;
      })}
    </svg>
  );
}

export default function LumenPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";

  const [coins, setCoins] = useState<Coin[]>(FALLBACK);
  const [glob, setGlob] = useState<Global>({ cap: 2.31e12, vol: 9.8e10, btcDom: 52.4, ethDom: 17.1, coins: 13847, capChange: 1.2 });
  const [trending, setTrending] = useState<Trend[]>([]);
  const [selected, setSelected] = useState("bitcoin");
  const [detail, setDetail] = useState<{ id: string; prices: number[]; ohlc: number[][]; coin?: Coin } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [range, setRange] = useState<1 | 7 | 30 | 90>(7);
  const [cur, setCur] = useState<Currency>("usd");
  const [live, setLive] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [usingLive, setUsingLive] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<"rank" | "price" | "change24h" | "marketCap" | "volume">("rank");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [watch, setWatch] = useState<string[]>([]);
  const [tab, setTab] = useState<"all" | "watch" | "gainers" | "losers">("all");
  const liveRef = useRef(true);
  useEffect(() => { liveRef.current = live; }, [live]);

  useEffect(() => { try { const w = localStorage.getItem("lumen:watch"); if (w) setWatch(JSON.parse(w)); } catch {} }, []);
  const toggleWatch = (id: string) => setWatch((w) => { const n = w.includes(id) ? w.filter((x) => x !== id) : [...w, id]; try { localStorage.setItem("lumen:watch", JSON.stringify(n)); } catch {} return n; });

  const sym = CUR_SYMBOL[cur];
  const money = useCallback((n: number) => {
    const s = n < 0 ? "-" : "", a = Math.abs(n);
    if (a >= 1e12) return `${s}${sym}${(a / 1e12).toFixed(2)}T`;
    if (a >= 1e9) return `${s}${sym}${(a / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `${s}${sym}${(a / 1e6).toFixed(2)}M`;
    if (a >= 1) return `${s}${sym}${a.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    return `${s}${sym}${a.toFixed(a < 0.01 ? 6 : 4)}`;
  }, [sym]);
  const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  const fetchData = useCallback(async () => {
    try {
      const [mRes, gRes, tRes] = await Promise.all([
        fetch(`${API}/coins/markets?vs_currency=${cur}&order=market_cap_desc&per_page=25&page=1&sparkline=true&price_change_percentage=24h,7d`, { cache: "no-store" }),
        fetch(`${API}/global`, { cache: "no-store" }),
        fetch(`${API}/search/trending`, { cache: "no-store" }),
      ]);
      if (!mRes.ok || !gRes.ok) throw new Error("rate");
      const m = await mRes.json();
      const g = (await gRes.json()).data;
      setCoins(m.map((c: any) => ({
        id: c.id, symbol: c.symbol, name: c.name, image: c.image,
        price: c.current_price, change24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? 0,
        change7d: c.price_change_percentage_7d_in_currency, marketCap: c.market_cap, volume: c.total_volume,
        rank: c.market_cap_rank, supply: c.circulating_supply, ath: c.ath, high24: c.high_24h, low24: c.low_24h,
        spark: c.sparkline_in_7d?.price?.slice(-60) ?? [],
      })));
      setGlob({ cap: g.total_market_cap[cur] ?? g.total_market_cap.usd, vol: g.total_volume[cur] ?? g.total_volume.usd, btcDom: g.market_cap_percentage.btc, ethDom: g.market_cap_percentage.eth, coins: g.active_cryptocurrencies, capChange: g.market_cap_change_percentage_24h_usd });
      try { const tj = await tRes.json(); setTrending((tj.coins || []).slice(0, 7).map((x: any) => ({ id: x.item.id, name: x.item.name, symbol: x.item.symbol, thumb: x.item.thumb, rank: x.item.market_cap_rank }))); } catch {}
      setUsingLive(true);
      setUpdated(new Date());
    } catch {
      setUsingLive(false);
      setCoins((prev) => prev.map((c) => ({ ...c, price: c.price * (1 + (Math.random() - 0.5) * 0.006), change24h: c.change24h + (Math.random() - 0.5) * 0.3, spark: walk(c.spark.length ? c.spark : [c.price], c.price) })));
      setUpdated(new Date());
    }
  }, [cur]);

  useEffect(() => { fetchData(); const id = setInterval(() => liveRef.current && fetchData(), 45000); return () => clearInterval(id); }, [fetchData]);
  useEffect(() => { const id = setInterval(() => { if (!usingLive && liveRef.current) setCoins((prev) => prev.map((c) => ({ ...c, price: c.price * (1 + (Math.random() - 0.5) * 0.003) }))); }, 3000); return () => clearInterval(id); }, [usingLive]);

  // per-coin detail (real historical prices + OHLC candles)
  const loadDetail = useCallback(async (id: string) => {
    const coin = coins.find((c) => c.id === id);
    setDetail({ id, prices: coin?.spark || [], ohlc: [], coin });
    setDetailOpen(true);
    try {
      const [pRes, oRes] = await Promise.all([
        fetch(`${API}/coins/${id}/market_chart?vs_currency=${cur}&days=${range}`, { cache: "no-store" }),
        fetch(`${API}/coins/${id}/ohlc?vs_currency=${cur}&days=${range === 1 ? 1 : range}`, { cache: "no-store" }),
      ]);
      const prices = pRes.ok ? (await pRes.json()).prices.map((p: number[]) => p[1]) : coin?.spark || [];
      const ohlc = oRes.ok ? await oRes.json() : [];
      setDetail({ id, prices, ohlc, coin });
    } catch {}
  }, [coins, cur, range]);
  useEffect(() => { if (detailOpen && detail) loadDetail(detail.id); /* eslint-disable-next-line */ }, [range]);

  const sel = coins.find((c) => c.id === selected) || coins[0];
  const sentiment = useMemo(() => { const avg = coins.reduce((s, c) => s + c.change24h, 0) / (coins.length || 1); return Math.max(0, Math.min(100, Math.round(50 + avg * 6))); }, [coins]);

  const filtered = useMemo(() => {
    let list = coins;
    if (tab === "watch") list = list.filter((c) => watch.includes(c.id));
    else if (tab === "gainers") list = [...list].sort((a, b) => b.change24h - a.change24h).slice(0, 10);
    else if (tab === "losers") list = [...list].sort((a, b) => a.change24h - b.change24h).slice(0, 10);
    if (query.trim()) { const q = query.toLowerCase(); list = list.filter((c) => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)); }
    if (tab === "all" || tab === "watch") list = [...list].sort((a, b) => { const av = (a as any)[sortKey] ?? 0, bv = (b as any)[sortKey] ?? 0; return (av - bv) * sortDir; });
    return list;
  }, [coins, tab, watch, query, sortKey, sortDir]);

  const T = fa
    ? { title: "Lumen", sub: "داشبورد بازار زنده", live: "زنده", paused: "متوقف", cap: "ارزش کل بازار", vol: "حجم ۲۴ساعته", btc: "سلطه‌ی BTC", coins: "ارزهای فعال", chart: "نمودار", movers: "بیشترین تغییر", markets: "بازار", sentiment: "احساسِ بازار", dom: "سلطه‌ی بازار", updated: "به‌روزرسانی", refresh: "تازه‌سازی", others: "سایر", trending: "پرطرفدارها", watch: "واچ‌لیست", all: "همه", gainers: "صعودی", losers: "نزولی", search: "جستجوی ارز…", name: "نام", price: "قیمت", h24: "۲۴س", mcap: "ارزش بازار", volc: "حجم", rankc: "#", real: "داده‌ی واقعی و زنده از CoinGecko", offline: "API موقتاً در دسترس نیست — نمایشِ نمونه.", close: "بستن", rank: "رتبه", ath: "بالاترین تاریخ", supply: "عرضه در گردش", high: "بیشترین ۲۴س", low: "کمترین ۲۴س", fearg: ["ترس شدید", "ترس", "خنثی", "طمع", "طمع شدید"], noWatch: "ارزی به واچ‌لیست اضافه نکرده‌ای — روی ★ بزن." }
    : { title: "Lumen", sub: "Live markets dashboard", live: "Live", paused: "Paused", cap: "Total market cap", vol: "24h volume", btc: "BTC dominance", coins: "Active coins", chart: "Chart", movers: "Top movers", markets: "Markets", sentiment: "Market sentiment", dom: "Market dominance", updated: "Updated", refresh: "Refresh", others: "Others", trending: "Trending", watch: "Watchlist", all: "All", gainers: "Gainers", losers: "Losers", search: "Search coin…", name: "Name", price: "Price", h24: "24h", mcap: "Market cap", volc: "Volume", rankc: "#", real: "Real, live data from CoinGecko", offline: "API temporarily unavailable — sample data.", close: "Close", rank: "Rank", ath: "All-time high", supply: "Circulating supply", high: "24h high", low: "24h low", fearg: ["Extreme fear", "Fear", "Neutral", "Greed", "Extreme greed"], noWatch: "No coins in your watchlist yet — tap ★." };

  const senLabel = T.fearg[Math.min(4, Math.floor(sentiment / 20))];
  const Th = ({ k, label, cls = "" }: { k: typeof sortKey; label: string; cls?: string }) => (
    <th className={`cursor-pointer select-none pb-2 font-normal ${cls}`} onClick={() => { if (sortKey === k) setSortDir((d) => (d * -1) as 1 | -1); else { setSortKey(k); setSortDir(k === "rank" ? 1 : -1); } }}>
      {label}{sortKey === k ? (sortDir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2.5 sm:flex"><Logo size={28} /><span className="font-display text-lg">{T.title}</span><span className="text-xs text-[var(--fg-2)]">{T.sub}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <select value={cur} onChange={(e) => setCur(e.target.value as Currency)} className="rounded-full border bg-transparent px-2.5 py-1.5 text-xs outline-none force-ltr" style={{ borderColor: "var(--line-2)" }}>
            {(["usd", "eur", "gbp", "jpy"] as Currency[]).map((c) => <option key={c} value={c} style={{ background: "var(--bg-2)" }}>{c.toUpperCase()}</option>)}
          </select>
          <button onClick={() => setLive((l) => !l)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line-2)" }}>
            <span className="relative flex h-2 w-2">{live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "#22c55e" }} />}<span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: live ? "#22c55e" : "#71717a" }} /></span>{live ? T.live : T.paused}
          </button>
          <button onClick={fetchData} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title={T.refresh}>↻</button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
          <LangToggle />
        </div>
      </header>

      {/* live ticker */}
      <div className="edge-fade overflow-hidden border-b py-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="marquee">{[...coins, ...coins].map((c, i) => (
          <button key={i} onClick={() => loadDetail(c.id)} className="mx-4 inline-flex items-center gap-2 text-sm force-ltr"><b className="uppercase">{c.symbol}</b><span className="mono">{money(c.price)}</span><span className="mono" style={{ color: c.change24h >= 0 ? "#22c55e" : "#ef4444" }}>{pct(c.change24h)}</span></button>
        ))}</div>
      </div>

      <main className="wrap py-6">
        <div className="mb-5 flex items-end justify-between">
          <h1 className="font-display text-2xl sm:text-3xl">{T.title}</h1>
          <span className="mono text-xs text-[var(--fg-2)]">{updated ? `${T.updated}: ${updated.toLocaleTimeString(fa ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "…"}</span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[{ label: T.cap, value: glob.cap, fmt: money, delta: glob.capChange }, { label: T.vol, value: glob.vol, fmt: money, delta: null as number | null }, { label: T.btc, value: glob.btcDom, fmt: (n: number) => `${n.toFixed(1)}%`, delta: null }, { label: T.coins, value: glob.coins, fmt: (n: number) => Math.round(n).toLocaleString(fa ? "fa-IR" : "en-US"), delta: null }].map((k) => (
            <div key={k.label} className="panel elev p-4">
              <div className="flex items-center justify-between"><span className="label">{k.label}</span>{k.delta != null && <span className="mono text-[11px]" style={{ color: k.delta >= 0 ? "#22c55e" : "#ef4444" }}>{pct(k.delta)}</span>}</div>
              <div className="mt-2 font-display text-2xl tabular-nums sm:text-3xl force-ltr"><Counter value={k.value} format={k.fmt} /></div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* main chart */}
          <div className="panel elev p-5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <button onClick={() => loadDetail(sel.id)} className="label hover:text-[var(--fg)]">{sel?.name} · {T.chart} ↗</button>
                <p className="font-display text-3xl force-ltr"><Counter value={sel?.price || 0} format={money} /><span className="ms-2 text-sm" style={{ color: (sel?.change24h || 0) >= 0 ? "#22c55e" : "#ef4444" }}>{pct(sel?.change24h || 0)}</span></p>
              </div>
              <div className="flex flex-wrap gap-1">{coins.slice(0, 6).map((c) => <button key={c.id} onClick={() => setSelected(c.id)} className="mono rounded-full px-2.5 py-1 text-xs uppercase transition-colors" style={{ background: selected === c.id ? "var(--accent)" : "transparent", color: selected === c.id ? "var(--on-accent)" : "var(--fg-2)", border: "1px solid var(--line-2)" }}>{c.symbol}</button>)}</div>
            </div>
            {sel && <AreaChart data={sel.spark} up={(sel.change24h || 0) >= 0} />}
          </div>

          {/* sentiment + dominance */}
          <div className="grid gap-4">
            <div className="panel elev p-5">
              <p className="label mb-3">{T.sentiment}</p>
              <div className="flex items-center gap-4">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center">
                  <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-3)" strokeWidth="10" /><circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(sentiment / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`} style={{ transition: "stroke-dasharray .6s ease" }} /></svg>
                  <span className="absolute font-display text-xl">{fa ? sentiment.toLocaleString("fa-IR") : sentiment}</span>
                </div>
                <div><p className="font-display text-lg">{senLabel}</p><p className="text-xs text-[var(--fg-2)]">{fa ? "میانگین تغییرِ ۲۴ساعته" : "avg 24h change"}</p></div>
              </div>
            </div>
            <div className="panel elev p-5">
              <p className="label mb-3">{T.dom}</p>
              <div className="flex items-center gap-4">
                <Donut segments={[{ label: "BTC", value: glob.btcDom, color: "var(--accent)" }, { label: "ETH", value: glob.ethDom, color: "var(--accent-2)" }, { label: T.others, value: Math.max(0, 100 - glob.btcDom - glob.ethDom), color: "var(--bg-3)" }]} />
                <div className="space-y-2 text-sm">{[["BTC", glob.btcDom, "var(--accent)"], ["ETH", glob.ethDom, "var(--accent-2)"], [T.others, 100 - glob.btcDom - glob.ethDom, "var(--fg-2)"]].map(([l, v, c]) => <div key={l as string} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c as string }} /><span className="force-ltr">{l as string}</span><span className="mono text-[var(--fg-2)]">{(v as number).toFixed(1)}%</span></div>)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* trending */}
        {trending.length > 0 && (
          <div className="panel elev mt-4 p-5">
            <p className="label mb-3">🔥 {T.trending}</p>
            <div className="flex flex-wrap gap-2">{trending.map((t) => <button key={t.id} onClick={() => loadDetail(t.id)} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-3)]" style={{ borderColor: "var(--line-2)" }}><img src={t.thumb} alt="" className="h-4 w-4 rounded-full" /><span className="force-ltr">{t.name}</span><span className="uppercase text-[var(--fg-2)] force-ltr">{t.symbol}</span></button>)}</div>
          </div>
        )}

        {/* markets table */}
        <div className="panel elev mt-4 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1">{(["all", "watch", "gainers", "losers"] as const).map((tb) => <button key={tb} onClick={() => setTab(tb)} className="rounded-full px-3 py-1.5 text-sm transition-colors" style={{ background: tab === tb ? "var(--accent)" : "transparent", color: tab === tb ? "var(--on-accent)" : "var(--fg-2)", border: "1px solid var(--line-2)" }}>{T[tb]}</button>)}</div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.search} className="rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none" style={{ borderColor: "var(--line)" }} />
          </div>
          {tab === "watch" && filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--fg-2)]">{T.noWatch}</p>
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead><tr className="text-start text-xs text-[var(--fg-2)]">
                  <th className="pb-2 text-start font-normal" />
                  <Th k="rank" label={T.rankc} cls="text-start" />
                  <th className="pb-2 text-start font-normal">{T.name}</th>
                  <Th k="price" label={T.price} cls="text-end force-ltr" />
                  <Th k="change24h" label={T.h24} cls="text-end" />
                  <Th k="marketCap" label={T.mcap} cls="hidden text-end sm:table-cell" />
                  <th className="hidden pb-2 text-end font-normal lg:table-cell">7d</th>
                </tr></thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t transition-colors hover:bg-[var(--bg-3)]" style={{ borderColor: "var(--line)" }}>
                      <td className="py-2.5"><button onClick={() => toggleWatch(c.id)} style={{ color: watch.includes(c.id) ? "var(--accent)" : "var(--fg-2)" }}>{watch.includes(c.id) ? "★" : "☆"}</button></td>
                      <td className="py-2.5 text-[var(--fg-2)] force-ltr">{c.rank ?? "—"}</td>
                      <td className="cursor-pointer py-2.5" onClick={() => loadDetail(c.id)}><span className="inline-flex items-center gap-2">{c.image && <img src={c.image} alt="" className="h-5 w-5 rounded-full" />}<b>{c.name}</b> <span className="uppercase text-[var(--fg-2)] force-ltr">{c.symbol}</span></span></td>
                      <td className="py-2.5 text-end mono force-ltr">{money(c.price)}</td>
                      <td className="py-2.5 text-end mono" style={{ color: c.change24h >= 0 ? "#22c55e" : "#ef4444" }}>{pct(c.change24h)}</td>
                      <td className="hidden py-2.5 text-end mono force-ltr sm:table-cell">{money(c.marketCap)}</td>
                      <td className="hidden py-2.5 lg:table-cell"><div className="ms-auto w-24"><Sparkline data={c.spark} up={(c.change7d ?? c.change24h) >= 0} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[var(--fg-2)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: usingLive ? "#22c55e" : "#eab308" }} />{usingLive ? T.real : T.offline}</p>
      </main>

      {/* DETAIL MODAL */}
      {detailOpen && detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setDetailOpen(false)}>
          <div className="panel elev max-h-[92dvh] w-full max-w-2xl overflow-y-auto p-6 thin-scroll" style={{ borderRadius: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
            {(() => {
              const c = detail.coin || coins.find((x) => x.id === detail.id);
              const up = (c?.change24h || 0) >= 0;
              return (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">{c?.image && <img src={c.image} alt="" className="h-10 w-10 rounded-full" />}<div><h2 className="font-display text-2xl">{c?.name}</h2><span className="uppercase text-sm text-[var(--fg-2)] force-ltr">{c?.symbol} · #{c?.rank}</span></div></div>
                    <button onClick={() => setDetailOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>✕</button>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className="font-display text-4xl force-ltr">{c ? money(c.price) : "…"}<span className="ms-2 text-base" style={{ color: up ? "#22c55e" : "#ef4444" }}>{c ? pct(c.change24h) : ""}</span></p>
                    <div className="flex gap-1">{([1, 7, 30, 90] as const).map((r) => <button key={r} onClick={() => setRange(r)} className="mono rounded-full px-2.5 py-1 text-xs" style={{ background: range === r ? "var(--accent)" : "transparent", color: range === r ? "var(--on-accent)" : "var(--fg-2)", border: "1px solid var(--line-2)" }}>{r}d</button>)}</div>
                  </div>
                  <div className="mt-4 h-52">{detail.prices.length > 1 ? <AreaChart data={detail.prices} up={detail.prices[detail.prices.length - 1] >= detail.prices[0]} height="13rem" /> : <div className="grid h-full place-items-center text-sm text-[var(--fg-2)]">…</div>}</div>
                  {detail.ohlc.length > 0 && <div className="mt-4 h-40"><p className="label mb-2">OHLC</p><Candles ohlc={detail.ohlc} /></div>}
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[[T.mcap, c ? money(c.marketCap) : "—"], [T.volc, c ? money(c.volume) : "—"], [T.rank, c?.rank ? `#${c.rank}` : "—"], [T.ath, c?.ath ? money(c.ath) : "—"], [T.high, c?.high24 ? money(c.high24) : "—"], [T.low, c?.low24 ? money(c.low24) : "—"]].map(([l, v]) => (
                      <div key={l as string} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}><p className="label mb-1">{l}</p><p className="text-sm font-medium force-ltr">{v}</p></div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
