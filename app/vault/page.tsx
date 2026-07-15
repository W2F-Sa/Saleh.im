"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";
import { analyzeStrength } from "@/lib/vault/crypto";
import {
  hasVault,
  loadMeta,
  createVault,
  verifyPassword,
  unlockVault,
  persistVault,
  destroyVault,
  changeMasterPassword,
  vaultRequiresKeyfile,
  exportBackup,
  importBackup,
  filterEntries,
  sortEntries,
  auditVault,
  newEntry,
  domainOf,
  faviconFor,
  type VaultData,
  type VaultEntry,
  type EntryType,
  type SortKey,
  type AuditResult,
} from "@/lib/vault/store";
import { Icon, Segmented, StrengthBar, Toggle, Field, TextInput, VAULT_I18N, type IconName, type VaultStrings } from "@/components/vault/ui";
import { Generator } from "@/components/vault/generator";
import { EntryEditor } from "@/components/vault/entry-editor";
import { DetailView } from "@/components/vault/detail-view";
import { TotpRing } from "@/components/vault/totp-ring";

/* ============================================================================
   Vault — a zero-knowledge, eight-layer-encrypted secret manager. Everything
   (KDF, cascade, TOTP, generation, audit) happens locally in the browser; the
   only thing that touches storage is ciphertext. Installable as a PWA so it
   runs like a native app on Linux/desktop, fully offline.
   ========================================================================== */

type Phase = "loading" | "onboard" | "locked" | "unlocked";
type Nav =
  | { kind: "filter"; value: "all" | "favorites" | EntryType }
  | { kind: "folder"; id: string }
  | { kind: "view"; value: "generator" | "security" | "settings" };

const NAV_ICON: Record<string, IconName> = {
  all: "grid",
  favorites: "star",
  login: "key",
  note: "note",
  card: "card",
  identity: "id",
  totp: "shield",
  generator: "dice",
  security: "fingerprint",
  settings: "settings",
};

export default function VaultPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";
  const t: VaultStrings = fa ? VAULT_I18N.fa : VAULT_I18N.en;

  const [phase, setPhase] = useState<Phase>("loading");
  const [pw, setPw] = useState("");
  const [keyfile, setKeyfile] = useState<Uint8Array | null>(null);
  const [data, setData] = useState<VaultData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhase(hasVault() ? "locked" : "onboard");
  }, []);

  /* ---- persistence helper ---- */
  const persist = useCallback(
    async (next: VaultData) => {
      setData(next);
      if (!pw) return;
      setSaving(true);
      try {
        await persistVault(pw, next, keyfile);
      } finally {
        setSaving(false);
      }
    },
    [pw, keyfile]
  );

  const lock = useCallback(() => {
    setPw("");
    setKeyfile(null);
    setData(null);
    setPhase("locked");
  }, []);

  /* ---- auto-lock: idle timer + hide ---- */
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase !== "unlocked" || !data) return;
    const minutes = data.settings.autoLockMinutes;
    const reset = () => {
      if (idleRef.current) clearTimeout(idleRef.current);
      if (minutes > 0) idleRef.current = setTimeout(lock, minutes * 60_000);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden" && data.settings.lockOnHide) lock();
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    document.addEventListener("visibilitychange", onHide);
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", onHide);
      if (idleRef.current) clearTimeout(idleRef.current);
    };
  }, [phase, data, lock]);

  return (
    <div className="min-h-[100dvh]">
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6"
        style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">
            ← {t.back}
          </Link>
          <span className="hidden items-center gap-2.5 sm:flex">
            <Logo size={28} />
            <span className="font-display text-lg">{t.brand}</span>
            <span className="text-xs text-[var(--fg-2)]">{t.tagline}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {phase === "unlocked" && (
            <>
              {saving && <span className="mono hidden text-[10px] text-[var(--fg-2)] sm:inline">saving…</span>}
              <button onClick={lock} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line-2)" }}>
                <Icon name="lock" size={14} /> {t.lock}
              </button>
            </>
          )}
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} aria-label="theme">
            ◑
          </button>
          <LangToggle />
        </div>
      </header>

      {phase === "loading" && <div className="grid min-h-[70vh] place-items-center text-[var(--fg-2)]">…</div>}
      {phase === "onboard" && <Onboard t={t} fa={fa} onCreated={(p, d, kf) => { setPw(p); setKeyfile(kf); setData(d); setPhase("unlocked"); }} />}
      {phase === "locked" && (
        <Unlock
          t={t}
          fa={fa}
          onUnlocked={(p, d, kf) => { setPw(p); setKeyfile(kf); setData(d); setPhase("unlocked"); }}
          onReset={() => setPhase("onboard")}
        />
      )}
      {phase === "unlocked" && data && (
        <VaultApp t={t} fa={fa} data={data} pw={pw} keyfile={keyfile} persist={persist} onChangePw={setPw} onWipe={() => { destroyVault(); lock(); setPhase("onboard"); }} />
      )}

      <VaultStyles />
    </div>
  );
}

/* ==========================================================================
   ONBOARDING
   ========================================================================== */

async function readFileBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

function Onboard({ t, fa, onCreated }: { t: VaultStrings; fa: boolean; onCreated: (pw: string, d: VaultData, kf: Uint8Array | null) => void }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [hint, setHint] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [keyfile, setKeyfile] = useState<Uint8Array | null>(null);
  const [keyfileName, setKeyfileName] = useState("");
  const kfRef = useRef<HTMLInputElement>(null);
  const strength = useMemo(() => analyzeStrength(p1), [p1]);

  const submit = async () => {
    setErr("");
    if (p1 !== p2) return setErr(t.passwordsMismatch);
    if (strength.score < 2) return setErr(t.tooWeak);
    setBusy(true);
    try {
      const d = await createVault(p1, hint || undefined, keyfile);
      onCreated(p1, d, keyfile);
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wrap grid gap-8 py-10 lg:grid-cols-2 lg:py-16">
      <section className="reveal in">
        <p className="label tag-dot">{t.brand}</p>
        <h1 className="display mt-4 text-4xl sm:text-5xl">{t.createTitle}</h1>
        <p className="mt-4 max-w-md text-[var(--fg-2)]">{t.createSub}</p>

        <div className="panel elev mt-8 space-y-4 p-5 sm:p-6">
          <Field label={t.master}>
            <div className="relative">
              <input
                type={reveal ? "text" : "password"}
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                className="mono w-full rounded-xl border bg-transparent px-3.5 py-2.5 pe-10 text-sm outline-none focus:border-[var(--accent)] force-ltr"
                style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
                autoFocus
              />
              <button type="button" onClick={() => setReveal((r) => !r)} className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--fg-2)]">
                <Icon name={reveal ? "eye-off" : "eye"} size={17} />
              </button>
            </div>
            {p1 && (
              <div className="mt-2">
                <StrengthBar score={strength.score} entropy={strength.entropyBits} />
                <p className="mono mt-1 text-[10px] text-[var(--fg-2)]">
                  {t.crackTime}: {fa ? strength.crackTime.faLabel : strength.crackTime.label}
                </p>
              </div>
            )}
          </Field>
          <Field label={t.confirm}>
            <input
              type={reveal ? "text" : "password"}
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="mono w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] force-ltr"
              style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
            />
          </Field>
          <Field label={t.hint}>
            <TextInput value={hint} onChange={(e) => setHint(e.target.value)} />
          </Field>
          <div>
            <span className="label mb-1.5 block">{t.keyfile}</span>
            <input ref={kfRef} type="file" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setKeyfile(await readFileBytes(f)); setKeyfileName(f.name); } }} />
            <button type="button" onClick={() => kfRef.current?.click()} className="btn btn-outline w-full justify-center py-2.5 text-sm">
              <Icon name={keyfile ? "check" : "key"} size={15} /> {keyfile ? `${t.keyfileLoaded} · ${keyfileName}` : t.selectKeyfile}
            </button>
            {keyfile && (
              <button type="button" onClick={() => { setKeyfile(null); setKeyfileName(""); }} className="mt-1.5 text-xs text-[var(--fg-2)] hover:text-[var(--fg)]">✕ {t.cancel}</button>
            )}
            <p className="mt-1.5 text-xs text-[var(--fg-2)]">{t.keyfileHint}</p>
          </div>
          {err && <p className="text-sm" style={{ color: "#ef4444" }}>{err}</p>}
          <button onClick={submit} disabled={busy || !p1} className="btn btn-accent w-full py-3 disabled:opacity-50">
            {busy ? "…" : <><Icon name="shield" size={16} /> {t.create}</>}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[var(--fg-2)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
            {t.encryptedLocal}
          </p>
        </div>
      </section>

      <CryptoExplainer t={t} />
    </main>
  );
}

/* ==========================================================================
   UNLOCK
   ========================================================================== */

function Unlock({ t, fa, onUnlocked, onReset }: { t: VaultStrings; fa: boolean; onUnlocked: (pw: string, d: VaultData, kf: Uint8Array | null) => void; onReset: () => void }) {
  const [pw, setPw] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [keyfile, setKeyfile] = useState<Uint8Array | null>(null);
  const [keyfileName, setKeyfileName] = useState("");
  const kfRef = useRef<HTMLInputElement>(null);
  const meta = useMemo(() => loadMeta(), []);
  const needsKeyfile = useMemo(() => vaultRequiresKeyfile(), []);

  const submit = async () => {
    setErr("");
    if (needsKeyfile && !keyfile) return setErr(t.needKeyfile);
    setBusy(true);
    try {
      const ok = await verifyPassword(pw, keyfile);
      if (!ok) {
        setErr(t.wrong);
        setBusy(false);
        return;
      }
      const d = await unlockVault(pw, keyfile);
      onUnlocked(pw, d, keyfile);
    } catch {
      setErr(t.wrong);
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[80vh] place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="relative grid h-20 w-20 place-items-center rounded-3xl border" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}>
            <span className="conic-sheen" aria-hidden style={{ opacity: 0.25 }} />
            <Icon name="lock" size={30} className="relative" />
          </span>
          <h1 className="display mt-5 text-3xl">{t.unlockTitle}</h1>
          <p className="mt-2 max-w-xs text-sm text-[var(--fg-2)]">{t.unlockSub}</p>
        </div>

        <div className="panel elev p-5 sm:p-6">
          <div className="relative">
            <input
              type={reveal ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t.master}
              className="mono w-full rounded-xl border bg-transparent px-3.5 py-3 pe-10 text-sm outline-none focus:border-[var(--accent)] force-ltr"
              style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}
              autoFocus
            />
            <button type="button" onClick={() => setReveal((r) => !r)} className="absolute end-2 top-1/2 -translate-y-1/2 text-[var(--fg-2)]">
              <Icon name={reveal ? "eye-off" : "eye"} size={17} />
            </button>
          </div>
          {needsKeyfile && (
            <div className="mt-3">
              <input ref={kfRef} type="file" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setKeyfile(await readFileBytes(f)); setKeyfileName(f.name); } }} />
              <button type="button" onClick={() => kfRef.current?.click()} className="btn btn-outline w-full justify-center py-2.5 text-sm">
                <Icon name={keyfile ? "check" : "key"} size={15} /> {keyfile ? `${t.keyfileLoaded} · ${keyfileName}` : t.selectKeyfile}
              </button>
              <p className="mt-1.5 text-center text-xs text-[var(--fg-2)]">{t.keyfileRequired}</p>
            </div>
          )}
          {err && <p className="mt-2 text-sm" style={{ color: "#ef4444" }}>{err}</p>}
          <button onClick={submit} disabled={busy || !pw} className="btn btn-accent mt-4 w-full py-3 disabled:opacity-50">
            {busy ? "…" : <><Icon name="unlock" size={16} /> {t.unlock}</>}
          </button>

          {meta?.hint && (
            <button onClick={() => setShowHint((s) => !s)} className="mt-3 w-full text-center text-xs text-[var(--fg-2)] hover:text-[var(--fg)]">
              {showHint ? `${t.hintLabel}: ${meta.hint}` : `${t.hintLabel} ▾`}
            </button>
          )}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-center text-xs text-[var(--fg-2)]">{t.forgot}</summary>
          <button
            onClick={() => {
              if (confirm(t.resetConfirm)) {
                destroyVault();
                onReset();
              }
            }}
            className="btn btn-outline mx-auto mt-3 flex px-4 py-2 text-sm"
            style={{ color: "#ef4444", borderColor: "color-mix(in srgb, #ef4444 40%, transparent)" }}
          >
            <Icon name="trash" size={15} /> {t.reset}
          </button>
        </details>
      </div>
    </main>
  );
}

/* ==========================================================================
   MAIN APP (unlocked)
   ========================================================================== */

function VaultApp({
  t,
  fa,
  data,
  pw,
  keyfile,
  persist,
  onChangePw,
  onWipe,
}: {
  t: VaultStrings;
  fa: boolean;
  data: VaultData;
  pw: string;
  keyfile: Uint8Array | null;
  persist: (d: VaultData) => Promise<void>;
  onChangePw: (p: string) => void;
  onWipe: () => void;
}) {
  const [nav, setNav] = useState<Nav>({ kind: "filter", value: "all" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState<VaultEntry | null>(null);
  const [viewing, setViewing] = useState<VaultEntry | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  /* mutations */
  const upsert = (e: VaultEntry) => {
    const exists = data.entries.some((x) => x.id === e.id);
    const entries = exists ? data.entries.map((x) => (x.id === e.id ? e : x)) : [e, ...data.entries];
    persist({ ...data, entries });
    setEditing(null);
    setViewing(null);
  };
  const remove = (id: string) => {
    persist({ ...data, entries: data.entries.filter((x) => x.id !== id) });
    setEditing(null);
    setViewing(null);
  };
  const toggleFav = (id: string) =>
    persist({ ...data, entries: data.entries.map((x) => (x.id === id ? { ...x, favorite: !x.favorite } : x)) });

  const startNew = (type: EntryType) => {
    setShowNewMenu(false);
    setEditing(newEntry(type));
  };

  const filtered = useMemo(() => {
    let opts: Parameters<typeof filterEntries>[1] = { query };
    if (nav.kind === "filter") {
      if (nav.value === "favorites") opts.favorites = true;
      else if (nav.value !== "all") opts.type = nav.value;
    } else if (nav.kind === "folder") {
      opts.folder = nav.id;
    }
    return sortEntries(filterEntries(data.entries, opts), sort);
  }, [data.entries, query, nav, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.entries.length, favorites: data.entries.filter((e) => e.favorite).length };
    for (const type of ["login", "note", "card", "identity", "totp"] as EntryType[]) c[type] = data.entries.filter((e) => e.type === type).length;
    return c;
  }, [data.entries]);

  const isView = (v: string) => nav.kind === "view" && nav.value === v;
  const isFilter = (v: string) => nav.kind === "filter" && nav.value === v;

  const NavButton = ({ icon, label, active, count, onClick }: { icon: IconName; label: string; active: boolean; count?: number; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
      style={{ background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent", color: active ? "var(--accent)" : "var(--fg-2)" }}
    >
      <Icon name={icon} size={18} />
      <span className="flex-1 text-start">{label}</span>
      {count != null && count > 0 && <span className="mono text-xs opacity-70">{fa ? count.toLocaleString("fa-IR") : count}</span>}
    </button>
  );

  const sidebar = (
    <nav className="space-y-1">
      <NavButton icon="grid" label={t.all} active={isFilter("all")} count={counts.all} onClick={() => { setNav({ kind: "filter", value: "all" }); setMobileNav(false); }} />
      <NavButton icon="star" label={t.favorites} active={isFilter("favorites")} count={counts.favorites} onClick={() => { setNav({ kind: "filter", value: "favorites" }); setMobileNav(false); }} />
      <div className="my-2 h-px" style={{ background: "var(--line)" }} />
      <NavButton icon="key" label={t.logins} active={isFilter("login")} count={counts.login} onClick={() => { setNav({ kind: "filter", value: "login" }); setMobileNav(false); }} />
      <NavButton icon="shield" label={t.authenticator} active={isFilter("totp")} count={counts.totp} onClick={() => { setNav({ kind: "filter", value: "totp" }); setMobileNav(false); }} />
      <NavButton icon="note" label={t.notes} active={isFilter("note")} count={counts.note} onClick={() => { setNav({ kind: "filter", value: "note" }); setMobileNav(false); }} />
      <NavButton icon="card" label={t.cards} active={isFilter("card")} count={counts.card} onClick={() => { setNav({ kind: "filter", value: "card" }); setMobileNav(false); }} />
      <NavButton icon="id" label={t.identities} active={isFilter("identity")} count={counts.identity} onClick={() => { setNav({ kind: "filter", value: "identity" }); setMobileNav(false); }} />

      {data.folders.length > 0 && (
        <>
          <div className="my-2 h-px" style={{ background: "var(--line)" }} />
          <p className="label px-3 py-1">{t.folders}</p>
          {data.folders.map((f) => (
            <NavButton
              key={f.id}
              icon="folder"
              label={`${f.icon} ${f.name}`}
              active={nav.kind === "folder" && nav.id === f.id}
              count={data.entries.filter((e) => e.folder === f.id).length}
              onClick={() => { setNav({ kind: "folder", id: f.id }); setMobileNav(false); }}
            />
          ))}
        </>
      )}

      <div className="my-2 h-px" style={{ background: "var(--line)" }} />
      <NavButton icon="dice" label={t.generator} active={isView("generator")} onClick={() => { setNav({ kind: "view", value: "generator" }); setMobileNav(false); }} />
      <NavButton icon="fingerprint" label={t.security} active={isView("security")} onClick={() => { setNav({ kind: "view", value: "security" }); setMobileNav(false); }} />
      <NavButton icon="settings" label={t.settings} active={isView("settings")} onClick={() => { setNav({ kind: "view", value: "settings" }); setMobileNav(false); }} />
    </nav>
  );

  return (
    <main className="wrap py-6">
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        {/* desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">{sidebar}</div>
        </aside>

        {/* mobile nav toggle */}
        <div className="lg:hidden">
          <button onClick={() => setMobileNav((m) => !m)} className="btn btn-outline w-full justify-between py-2.5">
            <span className="flex items-center gap-2"><Icon name="list" size={16} /> {t.folders} · {t.all}</span>
            <Icon name="chevron" size={16} className={mobileNav ? "rotate-90" : ""} />
          </button>
          {mobileNav && <div className="panel mt-2 p-2">{sidebar}</div>}
        </div>

        <section className="min-w-0">
          {nav.kind === "view" && nav.value === "generator" && (
            <div className="tab-anim mx-auto max-w-xl">
              <Generator t={t} fa={fa} clearSeconds={data.settings.clipboardClearSeconds} />
            </div>
          )}

          {nav.kind === "view" && nav.value === "security" && (
            <div className="tab-anim">
              <SecurityDashboard t={t} fa={fa} data={data} onOpen={(e) => setViewing(e)} />
            </div>
          )}

          {nav.kind === "view" && nav.value === "settings" && (
            <div className="tab-anim">
              <Settings t={t} fa={fa} data={data} pw={pw} keyfile={keyfile} persist={persist} onChangePw={onChangePw} onWipe={onWipe} onImported={(d) => { persist(d); }} />
            </div>
          )}

          {(nav.kind === "filter" || nav.kind === "folder") && (
            <div className="tab-anim">
              {/* toolbar */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <div className="relative min-w-0 flex-1">
                  <Icon name="search" size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-2)]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.search}
                    className="w-full rounded-full border bg-transparent px-10 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                    style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-[var(--fg-2)]">
                      <Icon name="x" size={15} />
                    </button>
                  )}
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="rounded-full border bg-transparent px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}
                >
                  <option value="updated">{t.updated}</option>
                  <option value="created">{t.created}</option>
                  <option value="title">{t.title}</option>
                </select>
                <div className="hidden sm:block">
                  <Segmented value={layout} onChange={(v) => setLayout(v as typeof layout)} options={[{ value: "grid", label: <Icon name="grid" size={15} /> }, { value: "list", label: <Icon name="list" size={15} /> }]} />
                </div>
                <div className="relative">
                  <button onClick={() => setShowNewMenu((s) => !s)} className="btn btn-accent px-4 py-2.5 text-sm">
                    <Icon name="plus" size={16} /> <span className="hidden sm:inline">{t.newItem}</span>
                  </button>
                  {showNewMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowNewMenu(false)} />
                      <div className="panel absolute end-0 z-20 mt-2 w-52 overflow-hidden p-1.5" style={{ boxShadow: "0 30px 60px -20px var(--shadow)" }}>
                        {([["login", t.logins], ["totp", t.authenticator], ["note", t.notes], ["card", t.cards], ["identity", t.identities]] as [EntryType, string][]).map(([type, label]) => (
                          <button key={type} onClick={() => startNew(type)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--fg-2)] hover:bg-[var(--bg-3)] hover:text-[var(--fg)]">
                            <Icon name={NAV_ICON[type]} size={17} /> {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* items */}
              {filtered.length === 0 ? (
                <EmptyState t={t} onNew={() => startNew("login")} />
              ) : layout === "grid" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((e, i) => (
                    <EntryCard key={e.id} entry={e} t={t} fa={fa} index={i} onOpen={() => setViewing(e)} onFav={() => toggleFav(e.id)} />
                  ))}
                </div>
              ) : (
                <div className="panel divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
                  {filtered.map((e) => (
                    <EntryRow key={e.id} entry={e} t={t} fa={fa} onOpen={() => setViewing(e)} onFav={() => toggleFav(e.id)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {editing && (
        <EntryEditor entry={editing} folders={data.folders} t={t} fa={fa} onSave={upsert} onClose={() => setEditing(null)} onDelete={remove} />
      )}
      {viewing && !editing && (
        <DetailView
          entry={viewing}
          folders={data.folders}
          t={t}
          fa={fa}
          concealDefault={data.settings.concealByDefault}
          clearSeconds={data.settings.clipboardClearSeconds}
          onEdit={() => setEditing(viewing)}
          onClose={() => setViewing(null)}
          onDelete={remove}
          onToggleFavorite={(id) => { toggleFav(id); setViewing((v) => (v ? { ...v, favorite: !v.favorite } : v)); }}
        />
      )}
    </main>
  );
}

/* ==========================================================================
   ENTRY CARD + ROW
   ========================================================================== */

function subtitleOf(e: VaultEntry): string {
  if (e.type === "login") return e.username || domainOf(e.url) || "";
  if (e.type === "card") return e.cardNumber ? `•••• ${e.cardNumber.replace(/\s+/g, "").slice(-4)}` : e.cardBrand || "";
  if (e.type === "identity") return e.email || e.fullName || "";
  if (e.type === "totp") return e.otpIssuer || "2FA";
  if (e.type === "note") return (e.notes || "").slice(0, 40);
  return "";
}

function IconBadge({ entry, size = 44 }: { entry: VaultEntry; size?: number }) {
  const fav = faviconFor(entry.url);
  const icon: IconName = entry.type === "login" ? "key" : entry.type === "card" ? "card" : entry.type === "identity" ? "id" : entry.type === "totp" ? "shield" : "note";
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-xl border" style={{ width: size, height: size, borderColor: "var(--line)", background: "var(--bg-3)" }}>
      {fav ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fav} alt="" width={22} height={22} onError={(ev) => ((ev.target as HTMLImageElement).style.display = "none")} />
      ) : (
        <span style={{ color: "var(--accent)" }}>
          <Icon name={icon} size={20} />
        </span>
      )}
    </span>
  );
}

function EntryCard({ entry, t, fa, index, onOpen, onFav }: { entry: VaultEntry; t: VaultStrings; fa: boolean; index: number; onOpen: () => void; onFav: () => void }) {
  return (
    <div
      className="group panel elev glow-border relative cursor-pointer p-4"
      style={{ animation: `popIn .5s cubic-bezier(.22,1,.36,1) both`, animationDelay: `${Math.min(index * 30, 300)}ms` }}
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <IconBadge entry={entry} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-base group-hover:text-[var(--accent)]">{entry.title || "—"}</h3>
            <button
              onClick={(ev) => { ev.stopPropagation(); onFav(); }}
              className="shrink-0"
              style={{ color: entry.favorite ? "var(--accent)" : "var(--fg-2)" }}
            >
              <Icon name={entry.favorite ? "star-fill" : "star"} size={16} />
            </button>
          </div>
          <p className="mono mt-0.5 truncate text-xs text-[var(--fg-2)] force-ltr">{subtitleOf(entry) || "—"}</p>
        </div>
      </div>
      {entry.type === "totp" && entry.otpSecret && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
          <TotpRing secret={entry.otpSecret} size={40} compact />
        </div>
      )}
      {entry.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {entry.tags.slice(0, 3).map((tg) => (
            <span key={tg} className="mono rounded-md px-1.5 py-0.5 text-[10px]" style={{ background: "var(--bg-3)", color: "var(--fg-2)" }}>#{tg}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, t, fa, onOpen, onFav }: { entry: VaultEntry; t: VaultStrings; fa: boolean; onOpen: () => void; onFav: () => void }) {
  return (
    <div className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-3)]" onClick={onOpen}>
      <IconBadge entry={entry} size={38} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium">{entry.title || "—"}</h3>
        <p className="mono truncate text-xs text-[var(--fg-2)] force-ltr">{subtitleOf(entry) || "—"}</p>
      </div>
      <button onClick={(ev) => { ev.stopPropagation(); onFav(); }} style={{ color: entry.favorite ? "var(--accent)" : "var(--fg-2)" }}>
        <Icon name={entry.favorite ? "star-fill" : "star"} size={16} />
      </button>
    </div>
  );
}

function EmptyState({ t, onNew }: { t: VaultStrings; onNew: () => void }) {
  return (
    <div className="panel grid place-items-center gap-3 py-20 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl border" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }}>
        <Icon name="lock" size={26} className="text-[var(--fg-2)]" />
      </span>
      <p className="font-display text-lg">{t.empty}</p>
      <p className="max-w-xs text-sm text-[var(--fg-2)]">{t.emptyHint}</p>
      <button onClick={onNew} className="btn btn-accent mt-2 px-4 py-2 text-sm">
        <Icon name="plus" size={16} /> {t.newItem}
      </button>
    </div>
  );
}

/* ==========================================================================
   SECURITY DASHBOARD
   ========================================================================== */

function SecurityDashboard({ t, fa, data, onOpen }: { t: VaultStrings; fa: boolean; data: VaultData; onOpen: (e: VaultEntry) => void }) {
  const [audit, setAudit] = useState<AuditResult | null>(null);

  useEffect(() => {
    let alive = true;
    auditVault(data.entries).then((r) => alive && setAudit(r));
    return () => {
      alive = false;
    };
  }, [data.entries]);

  const num = (n: number) => (fa ? n.toLocaleString("fa-IR") : String(n));
  const byId = (id: string) => data.entries.find((e) => e.id === id);

  if (!audit) return <div className="panel grid place-items-center py-20 text-[var(--fg-2)]">…</div>;

  const scoreColor = audit.score >= 80 ? "#22c55e" : audit.score >= 55 ? "#eab308" : "#ef4444";
  const groups: { key: keyof AuditResult; label: string; icon: IconName; color: string }[] = [
    { key: "weak", label: t.weakPasswords, icon: "warn", color: "#ef4444" },
    { key: "reused", label: t.reusedPasswords, icon: "copy", color: "#f97316" },
    { key: "old", label: t.oldPasswords, icon: "clock", color: "#eab308" },
    { key: "no2fa", label: t.missing2fa, icon: "shield", color: "#67e8f9" },
    { key: "insecure", label: t.insecureUrls, icon: "globe", color: "#f97316" },
  ];
  const totalIssues = audit.weak.length + audit.reused.length + audit.old.length + audit.no2fa.length + audit.insecure.length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel elev relative overflow-hidden p-6 sm:col-span-1">
          <div className="conic-sheen" aria-hidden style={{ opacity: 0.16 }} />
          <p className="label">{t.secScore}</p>
          <div className="relative mt-2 flex items-center gap-4">
            <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-3)" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15" fill="none" stroke={scoreColor} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(audit.score / 100) * 2 * Math.PI * 15} 999`} style={{ transition: "stroke-dasharray .8s ease" }} />
            </svg>
            <div>
              <p className="font-display text-4xl" style={{ color: scoreColor }}>{num(audit.score)}</p>
              <p className="mono text-xs text-[var(--fg-2)]">/ 100</p>
            </div>
          </div>
        </div>
        <div className="panel elev p-6">
          <p className="label">{t.avgEntropy}</p>
          <p className="mt-2 font-display text-4xl">{num(audit.averageEntropy)} <span className="text-sm text-[var(--fg-2)]">bits</span></p>
          <p className="mono mt-1 text-xs text-[var(--fg-2)]">{num(audit.totalWithPasswords)} {t.auditItems}</p>
        </div>
        <div className="panel elev p-6">
          <p className="label">{fa ? "مسائل" : "Issues"}</p>
          <p className="mt-2 font-display text-4xl" style={{ color: totalIssues ? "#eab308" : "#22c55e" }}>{num(totalIssues)}</p>
        </div>
      </div>

      {totalIssues === 0 ? (
        <div className="panel grid place-items-center gap-2 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, #22c55e 16%, transparent)", color: "#22c55e" }}>
            <Icon name="check" size={26} />
          </span>
          <p className="font-display text-lg">{t.allClear}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const list = audit[g.key] as any[];
            if (!Array.isArray(list) || list.length === 0) return null;
            return (
              <div key={g.key} className="panel p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span style={{ color: g.color }}><Icon name={g.icon} size={17} /></span>
                  <h3 className="font-medium">{g.label}</h3>
                  <span className="mono text-xs text-[var(--fg-2)]">{num(list.length)}</span>
                </div>
                <div className="space-y-1.5">
                  {list.map((issue: any, i: number) => {
                    const e = byId(issue.entryId);
                    return (
                      <button key={issue.entryId + i} onClick={() => e && onOpen(e)} className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-start transition-colors hover:border-[var(--line-2)]" style={{ borderColor: "var(--line)" }}>
                        <span className="truncate text-sm">{issue.title || "—"}</span>
                        <span className="shrink-0 text-xs text-[var(--fg-2)]">{fa ? issue.faDetail : issue.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   SETTINGS
   ========================================================================== */

function Settings({
  t,
  fa,
  data,
  pw,
  keyfile,
  persist,
  onChangePw,
  onWipe,
  onImported,
}: {
  t: VaultStrings;
  fa: boolean;
  data: VaultData;
  pw: string;
  keyfile: Uint8Array | null;
  persist: (d: VaultData) => Promise<void>;
  onChangePw: (p: string) => void;
  onWipe: () => void;
  onImported: (d: VaultData) => void;
}) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onPrompt = (e: any) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const setSetting = (patch: Partial<VaultData["settings"]>) => persist({ ...data, settings: { ...data.settings, ...patch } });

  const doChangePw = async () => {
    setMsg("");
    if (analyzeStrength(next).score < 2) return setMsg(t.tooWeak);
    try {
      await changeMasterPassword(cur, next, undefined, keyfile, keyfile);
      onChangePw(next);
      setCur("");
      setNext("");
      setMsg(fa ? "رمز اصلی تغییر کرد." : "Master password changed.");
    } catch {
      setMsg(t.wrong);
    }
  };

  const doExport = () => {
    const blob = exportBackup();
    if (!blob) return;
    const url = URL.createObjectURL(new Blob([blob], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const pass = prompt(fa ? "رمزِ اصلیِ این پشتیبان را وارد کن:" : "Enter the master password for this backup:");
      if (!pass) return;
      try {
        const d = await importBackup(String(reader.result), pass, keyfile);
        onChangePw(pass);
        onImported(d);
        setMsg(fa ? "پشتیبان بازیابی شد." : "Backup restored.");
      } catch {
        setMsg(fa ? "پشتیبان یا رمز نامعتبر است." : "Invalid backup or password.");
      }
    };
    reader.readAsText(file);
  };

  const install = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    const res = await installEvt.userChoice;
    if (res?.outcome === "accepted") setInstalled(true);
    setInstallEvt(null);
  };

  const Row = ({ label, children }: { label: string; children: any }) => (
    <div className="flex items-center justify-between gap-4 border-t py-3.5 first:border-t-0" style={{ borderColor: "var(--line)" }}>
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* install / PWA */}
      <div className="panel elev relative overflow-hidden p-5 sm:p-6">
        <div className="conic-sheen" aria-hidden style={{ opacity: 0.14 }} />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}>
            <Icon name="install" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg">{installed ? t.installed : t.install}</h3>
            <p className="text-sm text-[var(--fg-2)]">{t.installHint}</p>
          </div>
          {!installed && (
            <button onClick={install} disabled={!installEvt} className="btn btn-accent px-4 py-2 text-sm disabled:opacity-40">
              <Icon name="download" size={16} /> {t.install}
            </button>
          )}
          {installed && <span className="chip" style={{ color: "#22c55e" }}><Icon name="check" size={13} /> {t.installed}</span>}
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: "var(--line)" }}>
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "var(--bg-3)", color: "var(--fg-2)" }}>🐧</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t.desktopLinux}</p>
            <p className="text-xs text-[var(--fg-2)]">{t.desktopHint}</p>
          </div>
          <a href="https://github.com/im-saleh/Saleh.im/tree/main/desktop" target="_blank" rel="noopener noreferrer" className="btn btn-outline px-3 py-2 text-xs">
            <Icon name="download" size={14} /> {t.desktopCta}
          </a>
        </div>
      </div>

      {/* preferences */}
      <div className="panel p-5 sm:p-6">
        <h3 className="mb-2 font-display text-lg">{t.settings}</h3>
        <Row label={t.autoLock}>
          <input type="number" min={0} max={120} value={data.settings.autoLockMinutes} onChange={(e) => setSetting({ autoLockMinutes: Number(e.target.value) })} className="mono w-20 rounded-lg border bg-transparent px-2 py-1.5 text-center text-sm" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }} />
        </Row>
        <Row label={t.clipboardClear}>
          <input type="number" min={0} max={120} value={data.settings.clipboardClearSeconds} onChange={(e) => setSetting({ clipboardClearSeconds: Number(e.target.value) })} className="mono w-20 rounded-lg border bg-transparent px-2 py-1.5 text-center text-sm" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }} />
        </Row>
        <Row label={t.concealDefault}>
          <Toggle on={data.settings.concealByDefault} onChange={(v) => setSetting({ concealByDefault: v })} />
        </Row>
        <Row label={t.lockOnHide}>
          <Toggle on={data.settings.lockOnHide} onChange={(v) => setSetting({ lockOnHide: v })} />
        </Row>
      </div>

      {/* master password */}
      <div className="panel p-5 sm:p-6">
        <h3 className="mb-3 font-display text-lg">{t.changeMaster}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.currentPassword}>
            <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className="mono w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] force-ltr" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }} />
          </Field>
          <Field label={t.newPassword}>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="mono w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] force-ltr" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)" }} />
          </Field>
        </div>
        {next && <div className="mt-2"><StrengthBar score={analyzeStrength(next).score} entropy={analyzeStrength(next).entropyBits} /></div>}
        <button onClick={doChangePw} disabled={!cur || !next} className="btn btn-outline mt-3 px-4 py-2 text-sm disabled:opacity-50">
          <Icon name="key" size={15} /> {t.changeMaster}
        </button>
        {msg && <p className="mt-2 text-sm text-[var(--fg-2)]">{msg}</p>}
      </div>

      {/* backup */}
      <div className="panel p-5 sm:p-6">
        <h3 className="mb-3 font-display text-lg">{t.exportBackup} / {t.importBackup}</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={doExport} className="btn btn-outline px-4 py-2 text-sm">
            <Icon name="download" size={15} /> {t.exportBackup}
          </button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-outline px-4 py-2 text-sm">
            <Icon name="upload" size={15} /> {t.importBackup}
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
      </div>

      {/* danger */}
      <div className="panel p-5 sm:p-6" style={{ borderColor: "color-mix(in srgb, #ef4444 30%, var(--line))" }}>
        <h3 className="mb-2 font-display text-lg" style={{ color: "#ef4444" }}>{t.dangerZone}</h3>
        <button
          onClick={() => {
            if (confirm(t.resetConfirm)) onWipe();
          }}
          className="btn btn-outline px-4 py-2 text-sm"
          style={{ color: "#ef4444", borderColor: "color-mix(in srgb, #ef4444 40%, transparent)" }}
        >
          <Icon name="trash" size={15} /> {t.wipe}
        </button>
      </div>
    </div>
  );
}

/* ==========================================================================
   CRYPTO EXPLAINER (shown during onboarding)
   ========================================================================== */

function CryptoExplainer({ t }: { t: VaultStrings }) {
  return (
    <section className="reveal in">
      <div className="panel frame-grad relative overflow-hidden p-6 sm:p-8">
        <div className="conic-sheen" aria-hidden style={{ opacity: 0.18 }} />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Icon name="shield" size={18} className="text-[var(--accent)]" />
            <h2 className="font-display text-xl">{t.howTitle}</h2>
          </div>
          <ol className="mt-5 space-y-3">
            {t.layers.map((layer, i) => (
              <li key={i} className="flex gap-3">
                <span className="mono grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                  {i + 1}
                </span>
                <p className="text-sm text-[var(--fg-2)]">{layer}</p>
              </li>
            ))}
          </ol>
          <p className="mono mt-6 flex items-center gap-2 text-xs text-[var(--fg-2)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
            {t.entropyNote}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   LOCAL STYLES
   ========================================================================== */

function VaultStyles() {
  return (
    <style jsx global>{`
      .vault-modal-in {
        animation: vaultModalIn 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      }
      @keyframes vaultModalIn {
        from {
          opacity: 0;
          transform: translate3d(0, 24px, 0) scale(0.98);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
      .vault-range {
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        border-radius: 999px;
        background: var(--bg-3);
        outline: none;
      }
      .vault-range::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--accent);
        cursor: pointer;
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent);
      }
      .vault-range::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border: none;
        border-radius: 50%;
        background: var(--accent);
        cursor: pointer;
      }
      @media (prefers-reduced-motion: reduce) {
        .vault-modal-in {
          animation: none;
        }
      }
    `}</style>
  );
}
