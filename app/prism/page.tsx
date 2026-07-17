"use client";

/*
  Prism — a headless UI kit & design-system playground.

  Drive a set of design tokens (accent, radius, spacing density, font size,
  surface, border strength, shadow) from the control rail and watch a live
  gallery of accessible components re-theme instantly. Tokens are applied as
  scoped CSS custom properties on the preview surface, so nothing leaks into
  the rest of the page. Export the tokens as CSS variables or a Tailwind theme
  with one click. Fully bilingual + theme-aware.
*/

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";

const PRESETS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#ef4444", "#8b5cf6", "#14b8a6"];

// One-click design-system starting points — each sets the whole token bundle.
const THEME_PRESETS: { name: string; accent: string; radius: number; density: number; font: number; border: number; shadow: number; dark: boolean }[] = [
  { name: "Indigo", accent: "#6366f1", radius: 12, density: 12, font: 15, border: 1, shadow: 18, dark: true },
  { name: "Emerald", accent: "#10b981", radius: 10, density: 12, font: 15, border: 1, shadow: 14, dark: true },
  { name: "Sunset", accent: "#f97316", radius: 16, density: 13, font: 15, border: 1, shadow: 22, dark: false },
  { name: "Rose", accent: "#f43f5e", radius: 22, density: 12, font: 15, border: 2, shadow: 20, dark: false },
  { name: "Mono", accent: "#111827", radius: 4, density: 10, font: 14, border: 2, shadow: 0, dark: false },
  { name: "Cyber", accent: "#22d3ee", radius: 2, density: 11, font: 14, border: 1, shadow: 30, dark: true },
];

/* ---- colour maths for the shade scale + WCAG contrast checker ---- */
type RGB = { r: number; g: number; b: number };
const hx = (h: string): RGB => { const s = h.replace("#", ""); const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s.padEnd(6, "0").slice(0, 6), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; };
const toHex = (c: RGB) => "#" + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => ({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
const relLum = ({ r, g, b }: RGB) => { const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrastRatio = (a: RGB, b: RGB) => { const L1 = relLum(a), L2 = relLum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); };
const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
const buildScale = (accent: string) => {
  const a = hx(accent), white = { r: 255, g: 255, b: 255 }, black = { r: 0, g: 0, b: 0 };
  return SCALE_STEPS.map((step) => {
    let c: RGB;
    if (step < 500) c = mix(a, white, ((500 - step) / 450) * 0.92);
    else if (step > 500) c = mix(a, black, ((step - 500) / 400) * 0.72);
    else c = a;
    return { step, hex: toHex(c) };
  });
};
const FONT_FAMILIES: Record<string, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', 'JetBrains Mono', monospace",
};
const randHex = () => toHex({ r: Math.random() * 255, g: Math.random() * 255, b: Math.random() * 255 });

export default function PrismPage() {
  const { lang } = useLang();
  const fa = lang === "fa";

  const [accent, setAccent] = useState("#6366f1");
  const [radius, setRadius] = useState(12);
  const [density, setDensity] = useState(12);
  const [font, setFont] = useState(15);
  const [border, setBorder] = useState(1);
  const [shadow, setShadow] = useState(18);
  const [dark, setDark] = useState(true);
  const [copied, setCopied] = useState("");
  const [family, setFamily] = useState<"sans" | "serif" | "mono">("sans");

  // live component demo state
  const [tab, setTab] = useState(0);
  const [sw, setSw] = useState(true);
  const [chk, setChk] = useState(true);
  const [radio, setRadio] = useState("b");
  const [range, setRange] = useState(64);
  const [modal, setModal] = useState(false);
  const [seg, setSeg] = useState(1);

  const T = fa
    ? { back: "بازگشت", brand: "پریزم", tagline: "کیتِ رابطِ بی‌سر و آزمایشگاهِ دیزاین‌سیستم", tokens: "توکن‌ها", accent: "رنگِ تأکید", radius: "گردیِ گوشه", density: "تراکم", font: "اندازهٔ فونت", border: "ضخامتِ خط", shadow: "سایه", surface: "سطح", darkS: "تیره", lightS: "روشن", copyCss: "کپیِ متغیرهای CSS", copyTw: "کپیِ تمِ Tailwind", copied: "کپی شد!", buttons: "دکمه‌ها", inputs: "ورودی‌ها", selection: "انتخاب", feedback: "بازخورد", surfaces: "سطوح و ناوبری", primary: "اصلی", outline: "خطی", ghost: "شبح", danger: "خطر", placeholder: "یک چیزی بنویس…", option: "گزینه", switch: "سوییچ", check: "چک‌باکس", tabs: ["نمای کلی", "فعالیت", "تنظیمات"], openModal: "بازکردنِ مودال", modalTitle: "مودالِ نمونه", modalBody: "این یک دیالوگِ کاملاً تم‌پذیر است که با همان توکن‌ها استایل گرفته.", close: "بستن", ok: "باشه", success: "با موفقیت ذخیره شد.", warn: "فضای دیسک رو به اتمام است.", error: "اتصال برقرار نشد.", info: "یک نسخهٔ جدید در دسترس است.", progress: "پیشرفت", slider: "اسلایدر", segmented: "قطعه‌ای", avatars: "آواتارها", badge: "نشان", new: "جدید", pro: "حرفه‌ای", scaleTitle: "طیفِ رنگِ تأکید", contrast: "کنتراستِ متن", contrastNote: "بهترین رنگِ متن روی رنگِ تأکید", family: "خانوادهٔ فونت", fSans: "بی‌سریف", fSerif: "سریف", fMono: "تک‌عرض", copyJson: "کپیِ توکن‌های JSON", copyScss: "کپیِ SCSS", randomize: "تصادفی", copyHex: "برای کپی کلیک کن" }
    : { back: "back", brand: "Prism", tagline: "Headless UI kit & design-system playground", tokens: "Tokens", accent: "Accent", radius: "Corner radius", density: "Density", font: "Font size", border: "Border width", shadow: "Shadow", surface: "Surface", darkS: "Dark", lightS: "Light", copyCss: "Copy CSS variables", copyTw: "Copy Tailwind theme", copied: "Copied!", buttons: "Buttons", inputs: "Inputs", selection: "Selection", feedback: "Feedback", surfaces: "Surfaces & navigation", primary: "Primary", outline: "Outline", ghost: "Ghost", danger: "Danger", placeholder: "Type something…", option: "Option", switch: "Switch", check: "Checkbox", tabs: ["Overview", "Activity", "Settings"], openModal: "Open modal", modalTitle: "Example dialog", modalBody: "A fully theme-aware dialog styled from the very same tokens.", close: "Close", ok: "Got it", success: "Saved successfully.", warn: "You're running low on disk space.", error: "Could not connect.", info: "A new version is available.", progress: "Progress", slider: "Slider", segmented: "Segmented", avatars: "Avatars", badge: "Badge", new: "New", pro: "Pro", scaleTitle: "Accent scale", contrast: "Text contrast", contrastNote: "Best text colour on the accent", family: "Font family", fSans: "Sans", fSerif: "Serif", fMono: "Mono", copyJson: "Copy JSON tokens", copyScss: "Copy SCSS", randomize: "Randomize", copyHex: "Click to copy" };

  // scoped token variables for the preview surface
  const surfBg = dark ? "#0e1017" : "#ffffff";
  const surfFg = dark ? "#e8ebf2" : "#1a1d24";
  const surfMut = dark ? "#98a0b0" : "#5a6270";
  const surfCard = dark ? "#161a22" : "#f6f7f9";
  const surfLine = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const previewVars: React.CSSProperties & Record<string, string> = {
    "--p-accent": accent,
    "--p-radius": `${radius}px`,
    "--p-space": `${density}px`,
    "--p-font": `${font}px`,
    "--p-border": `${border}px`,
    "--p-shadow": `0 ${shadow}px ${shadow * 2.4}px -${shadow}px ${accent}55`,
    "--p-bg": surfBg,
    "--p-fg": surfFg,
    "--p-mut": surfMut,
    "--p-card": surfCard,
    "--p-line": surfLine,
  };

  const cssText = useMemo(() =>
`:root {
  --accent: ${accent};
  --radius: ${radius}px;
  --space: ${density}px;
  --font-size: ${font}px;
  --border-width: ${border}px;
  --shadow: 0 ${shadow}px ${shadow * 2.4}px -${shadow}px ${accent}55;
  --bg: ${surfBg};
  --fg: ${surfFg};
  --muted: ${surfMut};
  --card: ${surfCard};
  --line: ${surfLine};
}`, [accent, radius, density, font, border, shadow, surfBg, surfFg, surfMut, surfCard, surfLine]);

  const twText = useMemo(() =>
`// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: { accent: "${accent}" },
      borderRadius: { DEFAULT: "${radius}px" },
      spacing: { token: "${density}px" },
      fontSize: { base: "${font}px" },
      boxShadow: { token: "0 ${shadow}px ${shadow * 2.4}px -${shadow}px ${accent}55" },
    },
  },
};`, [accent, radius, density, font, shadow]);

  const scale = useMemo(() => buildScale(accent), [accent]);
  const accRgb = hx(accent);
  const cW = contrastRatio(accRgb, { r: 255, g: 255, b: 255 });
  const cB = contrastRatio(accRgb, { r: 0, g: 0, b: 0 });
  const bestText = cW >= cB ? "#ffffff" : "#000000";
  const bestRatio = Math.max(cW, cB);
  const rating = bestRatio >= 7 ? "AAA" : bestRatio >= 4.5 ? "AA" : bestRatio >= 3 ? "AA Large" : "Fail";
  const jsonText = useMemo(() => JSON.stringify({ accent, radius, density, fontSize: font, borderWidth: border, shadow, fontFamily: family, scale: Object.fromEntries(scale.map((s) => [s.step, s.hex])) }, null, 2), [accent, radius, density, font, border, shadow, family, scale]);
  const scssText = useMemo(() => [`$accent: ${accent};`, `$radius: ${radius}px;`, `$space: ${density}px;`, `$font-size: ${font}px;`, `$border-width: ${border}px;`, `$shadow: 0 ${shadow}px ${shadow * 2.4}px -${shadow}px ${accent}55;`, "", ...scale.map((s) => `$accent-${s.step}: ${s.hex};`)].join("\n"), [accent, radius, density, font, border, shadow, scale]);
  const randomize = () => { setAccent(randHex()); setRadius(Math.floor(Math.random() * 24)); setDensity(8 + Math.floor(Math.random() * 12)); setShadow(Math.floor(Math.random() * 40)); setBorder(Math.floor(Math.random() * 3)); };

  const copy = (text: string, key: string) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1600); };
  const applyPreset = (p: typeof THEME_PRESETS[number]) => { setAccent(p.accent); setRadius(p.radius); setDensity(p.density); setFont(p.font); setBorder(p.border); setShadow(p.shadow); setDark(p.dark); };
  const reactSnippet = `export function Button({ children, ...props }) {
  return (
    <button
      style={{
        background: "${accent}",
        color: "#fff",
        borderRadius: ${radius},
        padding: "${Math.round(density * 0.6)}px ${Math.round(density * 1.1)}px",
        fontSize: ${font},
        fontWeight: 600,
        border: "none",
        boxShadow: "0 ${shadow}px ${shadow * 2.4}px -${shadow}px ${accent}55",
      }}
      {...props}
    >
      {children}
    </button>
  );
}`;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs text-[var(--fg-2)]"><span>{label}</span></span>
      {children}
    </label>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-2xl p-4" style={{ background: "var(--p-card)", border: "var(--p-border) solid var(--p-line)", borderRadius: "calc(var(--p-radius) + 4px)" }}>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--p-mut)" }}>{title}</div>
      {children}
    </section>
  );

  const btnBase = { borderRadius: "var(--p-radius)", padding: "calc(var(--p-space) * 0.6) calc(var(--p-space) * 1.1)", fontSize: "var(--p-font)", fontWeight: 600, transition: "transform .1s ease" } as React.CSSProperties;

  return (
    <div className="min-h-[100dvh]" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-2) 82%, transparent)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>◈</span>
            <span className="font-display text-lg">{T.brand}</span>
          </span>
        </div>
        <div className="flex items-center gap-2"><ThemePicker /><LangToggle /></div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[320px_1fr]">
        {/* controls */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <div>
            <h1 className="display gradient-text text-3xl">{T.brand}</h1>
            <p className="mt-1 text-sm text-[var(--fg-2)]">{T.tagline}</p>
          </div>
          <div className="panel space-y-4 p-4">
            <p className="label">{fa ? "قالب‌های آماده" : "Presets"}</p>
            <div className="flex flex-wrap gap-1.5">
              {THEME_PRESETS.map((p) => (
                <button key={p.name} onClick={() => applyPreset(p)} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-transform hover:scale-[1.04]" style={{ borderColor: accent === p.accent ? p.accent : "var(--line-2)" }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: p.accent }} />{p.name}
                </button>
              ))}
            </div>
            <p className="label">{T.tokens}</p>
            <Row label={T.accent}>
              <div className="flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((c) => <button key={c} onClick={() => setAccent(c)} className="h-6 w-6 rounded-full border-2" style={{ background: c, borderColor: accent === c ? "var(--fg)" : "transparent" }} />)}
                </div>
              </div>
            </Row>
            <Row label={`${T.radius} — ${radius}px`}><input type="range" min={0} max={24} value={radius} onChange={(e) => setRadius(+e.target.value)} className="w-full accent-[var(--accent)]" /></Row>
            <Row label={`${T.density} — ${density}px`}><input type="range" min={8} max={20} value={density} onChange={(e) => setDensity(+e.target.value)} className="w-full accent-[var(--accent)]" /></Row>
            <Row label={`${T.font} — ${font}px`}><input type="range" min={13} max={18} value={font} onChange={(e) => setFont(+e.target.value)} className="w-full accent-[var(--accent)]" /></Row>
            <Row label={`${T.border} — ${border}px`}><input type="range" min={0} max={3} value={border} onChange={(e) => setBorder(+e.target.value)} className="w-full accent-[var(--accent)]" /></Row>
            <Row label={`${T.shadow} — ${shadow}px`}><input type="range" min={0} max={40} value={shadow} onChange={(e) => setShadow(+e.target.value)} className="w-full accent-[var(--accent)]" /></Row>
            <Row label={T.surface}>
              <div className="flex gap-1.5">
                <button onClick={() => setDark(true)} className="flex-1 rounded-lg py-1.5 text-xs" style={{ background: dark ? "var(--accent)" : "var(--bg-3)", color: dark ? "var(--on-accent)" : "var(--fg-2)" }}>{T.darkS}</button>
                <button onClick={() => setDark(false)} className="flex-1 rounded-lg py-1.5 text-xs" style={{ background: !dark ? "var(--accent)" : "var(--bg-3)", color: !dark ? "var(--on-accent)" : "var(--fg-2)" }}>{T.lightS}</button>
              </div>
            </Row>
            <Row label={T.family}>
              <div className="flex gap-1.5">
                {(["sans", "serif", "mono"] as const).map((f) => (
                  <button key={f} onClick={() => setFamily(f)} className="flex-1 rounded-lg py-1.5 text-xs" style={{ background: family === f ? "var(--accent)" : "var(--bg-3)", color: family === f ? "var(--on-accent)" : "var(--fg-2)", fontFamily: FONT_FAMILIES[f] }}>{f === "sans" ? T.fSans : f === "serif" ? T.fSerif : T.fMono}</button>
                ))}
              </div>
            </Row>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: "var(--bg-3)" }} title={T.contrastNote}>
              <span className="text-[var(--fg-2)]">{T.contrast}</span>
              <span className="flex items-center gap-2">
                <span className="mono rounded px-1.5 py-0.5" style={{ background: accent, color: bestText }}>{bestRatio.toFixed(2)}:1</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: rating === "Fail" ? "#ef444422" : "#22c55e22", color: rating === "Fail" ? "#ef4444" : "#22c55e" }}>{rating}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => copy(cssText, "css")} className="btn btn-accent text-xs">{copied === "css" ? "✓ " + T.copied : T.copyCss}</button>
              <button onClick={() => copy(twText, "tw")} className="btn btn-outline text-xs">{copied === "tw" ? "✓ " + T.copied : T.copyTw}</button>
              <button onClick={() => copy(jsonText, "json")} className="btn btn-outline text-xs">{copied === "json" ? "✓ " + T.copied : T.copyJson}</button>
              <button onClick={() => copy(scssText, "scss")} className="btn btn-outline text-xs">{copied === "scss" ? "✓ " + T.copied : T.copyScss}</button>
              <button onClick={() => copy(reactSnippet, "rx")} className="btn btn-outline text-xs">{copied === "rx" ? "✓ " + T.copied : (fa ? "کپیِ کامپوننتِ React" : "Copy React")}</button>
              <button onClick={randomize} className="btn btn-outline text-xs">🎲 {T.randomize}</button>
            </div>
          </div>
          <pre className="panel max-h-48 overflow-auto p-3 mono text-[11px] text-[var(--fg-2)] thin-scroll force-ltr">{cssText}</pre>
        </div>

        {/* live preview surface */}
        <div className="space-y-5 rounded-3xl p-4 sm:p-6" style={{ ...previewVars, background: "var(--p-bg)", color: "var(--p-fg)", fontSize: "var(--p-font)", fontFamily: FONT_FAMILIES[family], boxShadow: "var(--p-shadow)", border: "var(--p-border) solid var(--p-line)" }}>
          <Section title={T.scaleTitle}>
            <div className="flex overflow-hidden rounded-xl" style={{ borderRadius: "var(--p-radius)" }}>
              {scale.map((s) => (
                <button key={s.step} onClick={() => copy(s.hex, "sc-" + s.step)} title={`${s.hex} — ${T.copyHex}`} className="group relative h-14 flex-1 transition-transform hover:z-10 hover:scale-105" style={{ background: s.hex }}>
                  <span className="absolute inset-x-0 bottom-1 text-center text-[9px] font-semibold" style={{ color: relLum(hx(s.hex)) > 0.5 ? "#000" : "#fff" }}>{copied === "sc-" + s.step ? "✓" : s.step}</span>
                </button>
              ))}
            </div>
          </Section>
          <Section title={T.buttons}>
            <div className="flex flex-wrap items-center gap-2.5">
              <button style={{ ...btnBase, background: "var(--p-accent)", color: "#fff" }}>{T.primary}</button>
              <button style={{ ...btnBase, background: "transparent", color: "var(--p-accent)", border: "var(--p-border) solid var(--p-accent)" }}>{T.outline}</button>
              <button style={{ ...btnBase, background: "transparent", color: "var(--p-fg)" }}>{T.ghost}</button>
              <button style={{ ...btnBase, background: "#ef4444", color: "#fff" }}>{T.danger}</button>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--p-accent)", color: "#fff", borderRadius: "var(--p-radius)" }}>✦ {T.pro}</span>
            </div>
          </Section>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title={T.inputs}>
              <div className="space-y-3">
                <input placeholder={T.placeholder} className="w-full bg-transparent px-3 py-2 outline-none" style={{ borderRadius: "var(--p-radius)", border: "var(--p-border) solid var(--p-line)", color: "var(--p-fg)" }} />
                <select className="w-full bg-transparent px-3 py-2 outline-none" style={{ borderRadius: "var(--p-radius)", border: "var(--p-border) solid var(--p-line)", color: "var(--p-fg)" }}>
                  <option>{T.option} A</option><option>{T.option} B</option><option>{T.option} C</option>
                </select>
                <div>
                  <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--p-mut)" }}><span>{T.slider}</span><span>{range}</span></div>
                  <input type="range" value={range} onChange={(e) => setRange(+e.target.value)} className="w-full" style={{ accentColor: "var(--p-accent)" }} />
                </div>
              </div>
            </Section>

            <Section title={T.selection}>
              <div className="space-y-3">
                <button onClick={() => setSw((s) => !s)} className="flex w-full items-center justify-between">
                  <span>{T.switch}</span>
                  <span className="relative h-6 w-11 rounded-full transition-colors" style={{ background: sw ? "var(--p-accent)" : "var(--p-line)" }}>
                    <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ insetInlineStart: sw ? "22px" : "2px" }} />
                  </span>
                </button>
                <button onClick={() => setChk((c) => !c)} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center text-xs text-white" style={{ borderRadius: "calc(var(--p-radius) * 0.4)", background: chk ? "var(--p-accent)" : "transparent", border: "var(--p-border) solid " + (chk ? "var(--p-accent)" : "var(--p-line)") }}>{chk ? "✓" : ""}</span>
                  <span>{T.check}</span>
                </button>
                <div className="flex gap-4">
                  {["a", "b", "c"].map((r) => (
                    <button key={r} onClick={() => setRadio(r)} className="flex items-center gap-1.5">
                      <span className="grid h-4 w-4 place-items-center rounded-full" style={{ border: "var(--p-border) solid " + (radio === r ? "var(--p-accent)" : "var(--p-line)") }}>{radio === r && <span className="h-2 w-2 rounded-full" style={{ background: "var(--p-accent)" }} />}</span>
                      <span className="text-sm uppercase">{r}</span>
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-full p-1" style={{ background: "var(--p-line)", borderRadius: "var(--p-radius)" }}>
                  {[T.darkS, T.lightS, "Auto"].map((s, i) => <button key={i} onClick={() => setSeg(i)} className="px-3 py-1 text-xs font-medium transition-colors" style={{ borderRadius: "var(--p-radius)", background: seg === i ? "var(--p-accent)" : "transparent", color: seg === i ? "#fff" : "var(--p-mut)" }}>{s}</button>)}
                </div>
              </div>
            </Section>
          </div>

          <Section title={T.feedback}>
            <div className="space-y-2.5">
              {[["info", "#3b82f6", T.info], ["success", "#22c55e", T.success], ["warn", "#f59e0b", T.warn], ["error", "#ef4444", T.error]].map(([k, c, msg]) => (
                <div key={k} className="flex items-center gap-2.5 px-3 py-2 text-sm" style={{ borderRadius: "var(--p-radius)", background: `${c}1a`, border: `var(--p-border) solid ${c}55` }}>
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs text-white" style={{ background: c as string }}>!</span>
                  <span>{msg}</span>
                </div>
              ))}
              <div>
                <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--p-mut)" }}><span>{T.progress}</span><span>{range}%</span></div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--p-line)" }}><div className="h-full rounded-full transition-all" style={{ width: `${range}%`, background: "var(--p-accent)" }} /></div>
              </div>
            </div>
          </Section>

          <Section title={T.surfaces}>
            <div className="flex gap-1.5 border-b pb-0" style={{ borderColor: "var(--p-line)" }}>
              {T.tabs.map((tb, i) => <button key={i} onClick={() => setTab(i)} className="relative px-3 py-2 text-sm font-medium" style={{ color: tab === i ? "var(--p-accent)" : "var(--p-mut)" }}>{tb}{tab === i && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: "var(--p-accent)" }} />}</button>)}
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <div className="flex -space-x-2 rtl:space-x-reverse">
                {["A", "S", "M", "+3"].map((a, i) => <span key={i} className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: i === 3 ? "var(--p-line)" : "var(--p-accent)", border: "2px solid var(--p-bg)", color: i === 3 ? "var(--p-fg)" : "#fff" }}>{a}</span>)}
              </div>
              <span className="text-xs" style={{ color: "var(--p-mut)" }}>{T.avatars}</span>
              <button onClick={() => setModal(true)} style={{ ...btnBase, marginInlineStart: "auto", background: "var(--p-accent)", color: "#fff" }}>{T.openModal}</button>
            </div>
          </Section>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md p-6" style={{ ...previewVars, background: surfBg, color: surfFg, borderRadius: "calc(var(--p-radius) + 6px)", boxShadow: "var(--p-shadow)", border: `${border}px solid ${surfLine}` }}>
            <h3 className="text-lg font-semibold">{T.modalTitle}</h3>
            <p className="mt-2 text-sm" style={{ color: surfMut }}>{T.modalBody}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModal(false)} style={{ ...btnBase, background: "transparent", color: surfFg, border: `${border}px solid ${surfLine}` }}>{T.close}</button>
              <button onClick={() => setModal(false)} style={{ ...btnBase, background: accent, color: "#fff" }}>{T.ok}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
