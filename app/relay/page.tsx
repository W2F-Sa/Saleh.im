"use client";

/*
  Relay — a visual event / webhook router.

  Compose a pipeline: a webhook Source receives a JSON event, it flows through
  an ordered list of Transform steps (filter, rename, set, delete, delay), and
  fans out to one or more Destinations. Hit "Run" to push a sample event
  through: you see the payload mutate at every step, then each destination is
  "delivered" with a real HMAC-SHA256 signature (WebCrypto) over the final body
  and a simulated delivery log with latency + automatic retries on failure.
  Everything is client-side and bilingual.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";

type StepType = "filter" | "rename" | "set" | "delete" | "delay" | "upper" | "lower" | "template" | "number" | "timestamp" | "uuid" | "hash" | "coalesce";
type Step = { id: string; type: StepType; a?: string; b?: string; off?: boolean };
type Dest = { id: string; name: string; url: string; sign: boolean; method?: string };
type StepResult = { step: Step; before: unknown; after: unknown; note?: string; dropped?: boolean };
type Delivery = { dest: Dest; status: number; ms: number; attempts: number; sig?: string };

const uid = () => Math.random().toString(36).slice(2, 10);

function getPath(obj: any, path: string) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
function setPath(obj: any, path: string, val: any) {
  const keys = path.split("."); const clone = structuredClone(obj); let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) { if (typeof cur[keys[i]] !== "object" || cur[keys[i]] == null) cur[keys[i]] = {}; cur = cur[keys[i]]; }
  cur[keys[keys.length - 1]] = val; return clone;
}
function delPath(obj: any, path: string) {
  const keys = path.split("."); const clone = structuredClone(obj); let cur = clone;
  for (let i = 0; i < keys.length - 1; i++) { if (cur[keys[i]] == null) return clone; cur = cur[keys[i]]; }
  delete cur[keys[keys.length - 1]]; return clone;
}
function coerce(v: string): any { const t = v.trim(); if (t === "true") return true; if (t === "false") return false; if (t === "null") return null; if (t !== "" && !isNaN(Number(t))) return Number(t); return v; }

async function hmac(secret: string, body: string): Promise<string> {
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return "unavailable"; }
}
async function sha256(text: string): Promise<string> { try { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)); return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join(""); } catch { return "unavailable"; } }
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STORE = "relay:pipeline:v1";

const SAMPLES: Record<string, string> = {
  "order.created": JSON.stringify({ event: "order.created", id: "ord_8f2a", amount: 4200, currency: "usd", customer: { email: "sam@example.com", country: "IR" }, test: false }, null, 2),
  "user.signup": JSON.stringify({ event: "user.signup", id: "usr_1c4d", email: "NEW@Example.com", plan: "pro", referral: null, test: false }, null, 2),
  "payment.failed": JSON.stringify({ event: "payment.failed", id: "pay_77aa", amount: 1999, reason: "card_declined", attempt: 2, test: false }, null, 2),
};
const SAMPLE = SAMPLES["order.created"];

export default function RelayPage() {
  const { lang } = useLang();
  const fa = lang === "fa";

  const [sample, setSample] = useState(SAMPLE);
  const [secret] = useState(() => "whsec_" + uid() + uid());
  const [steps, setSteps] = useState<Step[]>([
    { id: uid(), type: "filter", a: "test", b: "false" },
    { id: uid(), type: "set", a: "routedAt", b: "relay" },
    { id: uid(), type: "rename", a: "amount", b: "amountCents" },
  ]);
  const [dests, setDests] = useState<Dest[]>([
    { id: uid(), name: "Slack", url: "https://hooks.slack.com/services/T000/B000/xxx", sign: true },
    { id: uid(), name: "Analytics", url: "https://api.example.com/ingest", sign: true },
  ]);
  const [results, setResults] = useState<StepResult[] | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const T = fa
    ? { back: "بازگشت", brand: "ری‌لِی", tagline: "مسیریابِ رویداد و وب‌هوک", source: "منبع (وب‌هوک)", endpoint: "اندپوینت", secret: "کلیدِ امضا", copy: "کپی", copied: "کپی شد!", sampleEvent: "رویدادِ نمونه (JSON)", steps: "مراحلِ تبدیل", addStep: "افزودن مرحله", dests: "مقصدها", addDest: "افزودن مقصد", run: "اجرا ▶", running: "در حال اجرا…", output: "خروجی در هر مرحله", delivery: "گزارشِ تحویل", dropped: "رویداد این‌جا فیلتر شد و متوقف ماند.", badJson: "JSON نامعتبر است.", noRun: "«اجرا» را بزن تا رویداد را در خط‌لوله ببینی.", filter: "فیلتر", rename: "تغییرِ نام", set: "تنظیمِ فیلد", del: "حذفِ فیلد", delayS: "تأخیر", ifField: "اگر فیلد", equals: "برابرِ", from: "از", to: "به", key: "کلید", value: "مقدار", ms: "میلی‌ثانیه", signed: "امضا", attempts: "تلاش", name: "نام", url: "آدرس", remove: "حذف", passed: "عبور کرد", noSteps: "مرحله‌ای نیست — رویداد بدونِ تغییر عبور می‌کند." }
    : { back: "back", brand: "Relay", tagline: "Event & webhook router", source: "Source (webhook)", endpoint: "Endpoint", secret: "Signing secret", copy: "Copy", copied: "Copied!", sampleEvent: "Sample event (JSON)", steps: "Transform steps", addStep: "Add step", dests: "Destinations", addDest: "Add destination", run: "Run ▶", running: "Running…", output: "Output at each step", delivery: "Delivery log", dropped: "Event was filtered out here and stopped.", badJson: "Invalid JSON.", noRun: "Hit Run to push the event through the pipeline.", filter: "Filter", rename: "Rename", set: "Set field", del: "Delete field", delayS: "Delay", ifField: "if field", equals: "equals", from: "from", to: "to", key: "key", value: "value", ms: "ms", signed: "signed", attempts: "attempts", name: "name", url: "URL", remove: "remove", passed: "passed", noSteps: "No steps — the event passes through unchanged." };

  const stepLabel: Record<StepType, string> = { filter: T.filter, rename: T.rename, set: T.set, delete: T.del, delay: T.delayS, upper: fa ? "بزرگ‌کردن" : "Uppercase", lower: fa ? "کوچک‌کردن" : "Lowercase", template: fa ? "قالب" : "Template", number: fa ? "عدد" : "To number", timestamp: fa ? "زمان" : "Timestamp", uuid: "UUID", hash: fa ? "هش SHA-256" : "SHA-256", coalesce: fa ? "اولین مقدار" : "Coalesce" };

  // Persist the whole pipeline (steps + destinations + sample) locally.
  useEffect(() => { try { const raw = localStorage.getItem(STORE); if (raw) { const p = JSON.parse(raw); if (p.steps) setSteps(p.steps); if (p.dests) setDests(p.dests); if (typeof p.sample === "string") setSample(p.sample); } } catch {} /* eslint-disable-next-line */ }, []);
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify({ steps, dests, sample })); } catch {} }, 400); return () => clearTimeout(t); }, [steps, dests, sample]);

  const addStep = (type: StepType) => setSteps((s) => [...s, { id: uid(), type, a: "", b: type === "delay" ? "250" : type === "timestamp" ? "routedAt" : type === "uuid" ? "traceId" : "" }]);
  const dupStep = (id: string) => setSteps((s) => { const i = s.findIndex((x) => x.id === id); if (i < 0) return s; const c = [...s]; c.splice(i + 1, 0, { ...s[i], id: uid() }); return c; });
  const exportPipeline = () => { const blob = new Blob([JSON.stringify({ steps, dests, sample }, null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "relay-pipeline.json"; a.click(); URL.revokeObjectURL(a.href); };
  const importPipeline = (file: File) => { const r = new FileReader(); r.onload = () => { try { const p = JSON.parse(r.result as string); if (p.steps) setSteps(p.steps); if (p.dests) setDests(p.dests); if (typeof p.sample === "string") setSample(p.sample); } catch {} }; r.readAsText(file); };
  const patchStep = (id: string, patch: Partial<Step>) => setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeStep = (id: string) => setSteps((s) => s.filter((x) => x.id !== id));
  const moveStep = (id: string, dir: -1 | 1) => setSteps((s) => { const i = s.findIndex((x) => x.id === id); const j = i + dir; if (j < 0 || j >= s.length) return s; const c = [...s]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const addDest = () => setDests((d) => [...d, { id: uid(), name: "New destination", url: "https://", sign: true }]);
  const patchDest = (id: string, patch: Partial<Dest>) => setDests((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeDest = (id: string) => setDests((d) => d.filter((x) => x.id !== id));

  const run = useCallback(async () => {
    setErr("");
    let event: any;
    try { event = JSON.parse(sample); } catch { setErr(T.badJson); return; }
    setRunning(true); setResults(null); setDeliveries(null);

    const res: StepResult[] = [];
    let cur = event;
    let dropped = false;
    for (const step of steps) {
      const before = cur;
      let after = cur; let note = ""; let drop = false;
      if (step.off) { res.push({ step, before, after: cur, note: fa ? "(غیرفعال)" : "(disabled)" }); continue; }
      if (step.type === "number") {
        if (step.a) { const v = getPath(cur, step.a); const n = Number(v); if (!isNaN(n)) { after = setPath(cur, step.a, n); note = `${step.a} → ${n}`; } }
      } else if (step.type === "timestamp") {
        if (step.a) { const ts = new Date().toISOString(); after = setPath(cur, step.a, ts); note = `${step.a} = ${ts}`; }
      } else if (step.type === "uuid") {
        if (step.a) { const id = (crypto.randomUUID ? crypto.randomUUID() : uid() + uid()); after = setPath(cur, step.a, id); note = `${step.a} = ${id.slice(0, 8)}…`; }
      } else if (step.type === "hash") {
        if (step.a) { const v = getPath(cur, step.a); const h = await sha256(String(v ?? "")); after = setPath(cur, step.a, h); note = `${step.a} → sha256`; }
      } else if (step.type === "coalesce") {
        if (step.a) { const paths = (step.b || "").split(",").map((p) => p.trim()).filter(Boolean); let val: any = null; for (const p of paths) { const v = getPath(cur, p); if (v != null && v !== "") { val = v; break; } } after = setPath(cur, step.a, val); note = `${step.a} = ${JSON.stringify(val)}`; }
      } else if (step.type === "filter") {
        const val = getPath(cur, step.a || "");
        const pass = String(val) === String(coerce(step.b || ""));
        note = `${step.a} = ${JSON.stringify(val)} ${pass ? "✓ " + T.passed : "✕"}`;
        if (!pass) { drop = true; }
      } else if (step.type === "rename") {
        if (step.a && step.b) { const v = getPath(cur, step.a); after = setPath(delPath(cur, step.a), step.b, v); note = `${step.a} → ${step.b}`; }
      } else if (step.type === "set") {
        if (step.a) { after = setPath(cur, step.a, coerce(step.b || "")); note = `${step.a} = ${step.b}`; }
      } else if (step.type === "delete") {
        if (step.a) { after = delPath(cur, step.a); note = `− ${step.a}`; }
      } else if (step.type === "delay") {
        await delay(Math.min(1200, Number(step.b) || 0)); note = `${step.b}${T.ms}`;
      } else if (step.type === "upper" || step.type === "lower") {
        if (step.a) { const v = getPath(cur, step.a); if (v != null) { after = setPath(cur, step.a, step.type === "upper" ? String(v).toUpperCase() : String(v).toLowerCase()); note = `${step.a} → ${step.type === "upper" ? "UPPER" : "lower"}`; } }
      } else if (step.type === "template") {
        if (step.a) { const tpl = (step.b || "").replace(/\{\{([^}]+)\}\}/g, (_m, p) => String(getPath(cur, String(p).trim()) ?? "")); after = setPath(cur, step.a, tpl); note = `${step.a} = "${tpl}"`; }
      }
      res.push({ step, before, after, note, dropped: drop });
      if (drop) { dropped = true; break; }
      cur = after;
    }
    setResults(res);

    if (!dropped) {
      const body = JSON.stringify(cur);
      const dels: Delivery[] = [];
      for (const dest of dests) {
        const sig = dest.sign ? await hmac(secret, body) : undefined;
        // simulate delivery: mostly 200s, sometimes a transient failure + retry
        let attempts = 0; let status = 0; let ms = 0;
        while (attempts < 3) {
          attempts++;
          await delay(120 + Math.random() * 260);
          ms += Math.round(80 + Math.random() * 300);
          status = Math.random() < 0.82 || attempts === 3 ? 200 : 503;
          if (status === 200) break;
        }
        dels.push({ dest, status, ms, attempts, sig });
        setDeliveries([...dels]);
      }
    }
    setRunning(false);
  }, [sample, steps, dests, secret, T]);

  const finalOut = useMemo(() => { if (!results || !results.length) return null; const last = results[results.length - 1]; return last.dropped ? null : last.after; }, [results]);

  const pretty = (v: unknown) => { try { return JSON.stringify(v, null, 2); } catch { return String(v); } };
  const copy = (t: string) => { navigator.clipboard?.writeText(t); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const stepFields = (s: Step) => {
    if (s.type === "filter") return (<><span className="text-xs text-[var(--fg-2)]">{T.ifField}</span><input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder="path" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /><span className="text-xs text-[var(--fg-2)]">{T.equals}</span><input value={s.b || ""} onChange={(e) => patchStep(s.id, { b: e.target.value })} placeholder="value" className="w-24 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /></>);
    if (s.type === "rename") return (<><span className="text-xs text-[var(--fg-2)]">{T.from}</span><input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder="old.path" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /><span className="text-xs text-[var(--fg-2)]">{T.to}</span><input value={s.b || ""} onChange={(e) => patchStep(s.id, { b: e.target.value })} placeholder="new.path" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /></>);
    if (s.type === "set") return (<><input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder={T.key} className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /><span className="text-xs text-[var(--fg-2)]">=</span><input value={s.b || ""} onChange={(e) => patchStep(s.id, { b: e.target.value })} placeholder={T.value} className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /></>);
    if (s.type === "delete") return (<input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder="path.to.remove" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} />);
    if (s.type === "upper" || s.type === "lower") return (<input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder="field.path" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} />);
    if (s.type === "template") return (<><input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder="target.path" className="w-28 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /><span className="text-xs text-[var(--fg-2)]">=</span><input value={s.b || ""} onChange={(e) => patchStep(s.id, { b: e.target.value })} placeholder="Hi {{customer.email}}" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /></>);
    if (s.type === "number" || s.type === "hash") return (<input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder="field.path" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} />);
    if (s.type === "timestamp" || s.type === "uuid") return (<input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder="target.field" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} />);
    if (s.type === "coalesce") return (<><input value={s.a || ""} onChange={(e) => patchStep(s.id, { a: e.target.value })} placeholder="target" className="w-28 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /><span className="text-xs text-[var(--fg-2)]">=</span><input value={s.b || ""} onChange={(e) => patchStep(s.id, { b: e.target.value })} placeholder="a.path, b.path" className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none force-ltr" style={{ borderColor: "var(--line)" }} /></>);
    return (<><input value={s.b || ""} onChange={(e) => patchStep(s.id, { b: e.target.value })} type="number" className="w-24 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none" style={{ borderColor: "var(--line)" }} /><span className="text-xs text-[var(--fg-2)]">{T.ms}</span></>);
  };
  const importRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-[100dvh]" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-2) 82%, transparent)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>⇄</span><span className="font-display text-lg">{T.brand}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={run} disabled={running} className="btn btn-accent h-9 px-4 py-0 text-sm disabled:opacity-50">{running ? T.running : T.run}</button>
          <ThemePicker /><LangToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-4 sm:p-6 lg:grid-cols-2">
        {/* pipeline builder */}
        <div className="space-y-4">
          <div>
            <h1 className="display gradient-text text-3xl">{T.brand}</h1>
            <p className="mt-1 text-sm text-[var(--fg-2)]">{T.tagline}</p>
          </div>

          {/* source */}
          <div className="panel p-4">
            <div className="label mb-2">◇ {T.source}</div>
            <div className="mb-2 flex items-center gap-2 rounded-lg border p-2 text-xs" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
              <span className="text-[var(--fg-2)]">{T.endpoint}</span>
              <code className="mono flex-1 truncate force-ltr">https://relay.saleh.im/hooks/{secret.slice(6, 14)}</code>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2 text-xs" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
              <span className="text-[var(--fg-2)]">{T.secret}</span>
              <code className="mono flex-1 truncate force-ltr" style={{ color: "var(--accent)" }}>{secret}</code>
              <button onClick={() => copy(secret)} className="rounded-md border px-2 py-0.5" style={{ borderColor: "var(--line-2)" }}>{copied ? "✓" : T.copy}</button>
            </div>
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label">{T.sampleEvent}</span>
                <div className="flex gap-1">{Object.keys(SAMPLES).map((k) => <button key={k} onClick={() => setSample(SAMPLES[k])} className="rounded-full border px-2 py-0.5 text-[10px] mono force-ltr" style={{ borderColor: "var(--line-2)", color: "var(--fg-2)" }}>{k}</button>)}</div>
              </div>
              <textarea value={sample} onChange={(e) => setSample(e.target.value)} rows={9} className="w-full resize-none rounded-xl border p-3 mono text-[12.5px] leading-relaxed outline-none force-ltr thin-scroll" style={{ background: "var(--bg-3)", borderColor: err ? "#ff6a6a" : "var(--line)" }} />
              {err && <p className="mt-1 text-xs" style={{ color: "#ff6a6a" }}>{err}</p>}
            </div>
          </div>

          {/* steps */}
          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between"><div className="label">⚙ {T.steps}</div></div>
            <div className="space-y-2">
              {steps.length === 0 && <p className="text-xs text-[var(--fg-2)]">{T.noSteps}</p>}
              {steps.map((s, i) => (
                <div key={s.id} className="rounded-xl border p-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)", opacity: s.off ? 0.5 : 1 }}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{i + 1}</span>
                    <span className="text-sm font-semibold">{stepLabel[s.type]}</span>
                    <div className="ms-auto flex gap-1">
                      <button onClick={() => patchStep(s.id, { off: !s.off })} className="grid h-6 w-6 place-items-center rounded border text-xs" style={{ borderColor: "var(--line-2)" }} title={s.off ? (fa ? "فعال" : "Enable") : (fa ? "غیرفعال" : "Disable")}>{s.off ? "○" : "◉"}</button>
                      <button onClick={() => dupStep(s.id)} className="grid h-6 w-6 place-items-center rounded border text-xs" style={{ borderColor: "var(--line-2)" }} title={fa ? "تکثیر" : "Duplicate"}>⧉</button>
                      <button onClick={() => moveStep(s.id, -1)} className="grid h-6 w-6 place-items-center rounded border text-xs" style={{ borderColor: "var(--line-2)" }}>↑</button>
                      <button onClick={() => moveStep(s.id, 1)} className="grid h-6 w-6 place-items-center rounded border text-xs" style={{ borderColor: "var(--line-2)" }}>↓</button>
                      <button onClick={() => removeStep(s.id)} className="grid h-6 w-6 place-items-center rounded border text-xs text-[var(--fg-2)] hover:text-[#ff6a6a]" style={{ borderColor: "var(--line-2)" }}>✕</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">{stepFields(s)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["filter", "rename", "set", "delete", "delay", "upper", "lower", "template", "number", "timestamp", "uuid", "hash", "coalesce"] as StepType[]).map((t) => <button key={t} onClick={() => addStep(t)} className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]" style={{ borderColor: "var(--line-2)" }}>+ {stepLabel[t]}</button>)}
            </div>
            <div className="mt-2 flex gap-1.5">
              <button onClick={exportPipeline} className="rounded-lg border px-2.5 py-1 text-xs" style={{ borderColor: "var(--line-2)" }}>↓ {fa ? "ذخیرهٔ خط‌لوله" : "Save pipeline"}</button>
              <button onClick={() => importRef.current?.click()} className="rounded-lg border px-2.5 py-1 text-xs" style={{ borderColor: "var(--line-2)" }}>↑ {fa ? "بازکردن" : "Load"}</button>
              <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importPipeline(f); e.currentTarget.value = ""; }} />
            </div>
          </div>

          {/* destinations */}
          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between"><div className="label">◎ {T.dests}</div><button onClick={addDest} className="btn btn-outline h-7 px-2.5 py-0 text-xs">+ {T.addDest}</button></div>
            <div className="space-y-2">
              {dests.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                  <input value={d.name} onChange={(e) => patchDest(d.id, { name: e.target.value })} className="w-28 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none" style={{ borderColor: "var(--line)" }} />
                  <input value={d.url} onChange={(e) => patchDest(d.id, { url: e.target.value })} className="min-w-0 flex-1 rounded-lg border bg-transparent px-2 py-1 text-xs outline-none force-ltr" style={{ borderColor: "var(--line)" }} />
                  <select value={d.method || "POST"} onChange={(e) => patchDest(d.id, { method: e.target.value })} className="rounded-lg border bg-transparent px-1 py-1 text-[11px] outline-none" style={{ borderColor: "var(--line)" }}><option>POST</option><option>PUT</option><option>PATCH</option><option>GET</option></select>
                  <button onClick={() => patchDest(d.id, { sign: !d.sign })} className="rounded-full px-2 py-1 text-[11px] font-medium" style={{ background: d.sign ? "var(--accent)" : "var(--bg-2)", color: d.sign ? "var(--on-accent)" : "var(--fg-2)" }}>HMAC</button>
                  <button onClick={() => removeDest(d.id)} className="grid h-7 w-7 place-items-center rounded border text-xs text-[var(--fg-2)] hover:text-[#ff6a6a]" style={{ borderColor: "var(--line-2)" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* run output */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          {!results ? (
            <div className="panel grid place-items-center p-10 text-center text-sm text-[var(--fg-2)]">{T.noRun}</div>
          ) : (
            <>
              <div className="panel p-4">
                <div className="label mb-3">↳ {T.output}</div>
                <ol className="space-y-2">
                  {results.map((r, i) => (
                    <li key={r.step.id} className="rounded-xl border p-2.5" style={{ borderColor: r.dropped ? "#ef444455" : "var(--line)", background: "var(--bg-3)" }}>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold" style={{ background: r.dropped ? "#ef4444" : "var(--accent)", color: "#fff" }}>{i + 1}</span>
                        <b>{stepLabel[r.step.type]}</b>
                        <span className="mono text-xs text-[var(--fg-2)]">{r.note}</span>
                      </div>
                      {r.dropped && <p className="mt-1.5 text-xs" style={{ color: "#ef4444" }}>⛔ {T.dropped}</p>}
                    </li>
                  ))}
                </ol>
                {finalOut != null && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-end"><button onClick={() => copy(pretty(finalOut))} className="rounded-md border px-2 py-0.5 text-[11px]" style={{ borderColor: "var(--line-2)" }}>{copied ? "✓" : (fa ? "کپیِ خروجی" : "Copy output")}</button></div>
                    <pre className="max-h-56 overflow-auto rounded-xl border p-3 mono text-[12px] thin-scroll force-ltr" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>{pretty(finalOut)}</pre>
                  </div>
                )}
              </div>

              {deliveries && (
                <div className="panel p-4">
                  <div className="label mb-3">📡 {T.delivery}</div>
                  <div className="space-y-2">
                    {deliveries.map((d) => (
                      <div key={d.dest.id} className="rounded-xl border p-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.status === 200 ? "#22c55e" : "#ef4444" }} />
                          <b>{d.dest.name}</b>
                          <span className="mono rounded px-1 py-0.5 text-[10px] text-[var(--fg-2)]" style={{ background: "var(--bg-2)" }}>{d.dest.method || "POST"}</span>
                          <span className="mono rounded px-1.5 py-0.5 text-[11px]" style={{ background: d.status === 200 ? "#22c55e22" : "#ef444422", color: d.status === 200 ? "#22c55e" : "#ef4444" }}>{d.status}</span>
                          <span className="mono ms-auto text-xs text-[var(--fg-2)]">{d.ms}ms · {d.attempts} {T.attempts}</span>
                        </div>
                        {d.sig && <div className="mt-1.5 truncate text-[11px] text-[var(--fg-2)]"><span className="text-[var(--fg-2)]">X-Relay-Signature: </span><code className="mono force-ltr" style={{ color: "var(--accent)" }}>sha256={d.sig.slice(0, 40)}…</code></div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
