"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";

/* ============================================================================
   /download — get Vault as a native C++ (Qt6 + libsodium) Linux app.
   Bilingual, heavily animated: gradient hero, floating aurora, a live-typing
   terminal, staggered cards, scroll reveals.
   ========================================================================== */

const RELEASES = "https://github.com/im-saleh/Saleh.im/releases/latest";
const REPO_DESKTOP = "https://github.com/im-saleh/Saleh.im/tree/main/desktop";
const VERSION = "1.0.0";
const DEB = `saleh-vault_${VERSION}_amd64.deb`;

export default function DownloadPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1400);
  };

  const T = fa
    ? {
        eyebrow: "دانلود",
        title: "والت برای لینوکس",
        native: "اپلیکیشنِ بومیِ ++C",
        sub: "یک مدیرِ رمزِ عبورِ واقعیِ دسکتاپ — نوشته‌شده با ++C، Qt6 و libsodium. نه مرورگر، نه Electron؛ مستقیم از منوی برنامه‌ها باز می‌شود و کاملاً آفلاین کار می‌کند.",
        getDeb: "دانلودِ ‎.deb",
        source: "کدِ منبع",
        buildTitle: "ساخت و نصب",
        buildSub: "سه فرمان روی اوبونتو / کوبونتو:",
        installNote: "یا اگر ‎.deb را از Releases گرفتی:",
        featuresTitle: "بیش از ۲۰ امکان",
        securityTitle: "امنیتِ فوق‌بالا",
        howTitle: "رمزنگاری چطور کار می‌کند",
        launch: "پس از نصب، «Vault» را از منوی برنامه‌ها اجرا کن یا در ترمینال بنویس saleh-vault.",
        copyHint: "برای کپی کلیک کن",
        openWeb: "نسخه‌ی وب",
        note: "همه‌چیز محلی و متن‌باز است — رمزِ اصلی هیچ‌وقت دستگاه را ترک نمی‌کند.",
      }
    : {
        eyebrow: "Download",
        title: "Vault for Linux",
        native: "Native C++ application",
        sub: "A real desktop password manager — written in C++ with Qt6 and libsodium. Not a browser, not Electron: it launches straight from your apps menu and runs fully offline.",
        getDeb: "Download .deb",
        source: "Source code",
        buildTitle: "Build & install",
        buildSub: "Three commands on Ubuntu / Kubuntu:",
        installNote: "Or, if you grabbed the .deb from Releases:",
        featuresTitle: "20+ features",
        securityTitle: "Ultra-high security",
        howTitle: "How the encryption works",
        launch: "After installing, launch “Vault” from your apps menu or run saleh-vault.",
        copyHint: "click to copy",
        openWeb: "Web version",
        note: "Everything is local and open source — your master password never leaves the device.",
      };

  const features: [string, string][] = fa
    ? [
        ["🎯", "ذخیره‌ی سریعِ رمز (Ctrl+Shift+A)"], ["🖱️", "منوی راست‌کلیک"], ["🕘", "اخیر + مرتب‌سازی + آواتار"],
        ["🔑", "پنج نوع آیتم"], ["🛡️", "کدهای دومرحله‌ای (TOTP)"], ["🎲", "سازنده‌ی رمز و عبارت‌عبور"],
        ["📊", "سنجه‌ی قدرت رمز"], ["🔎", "جست‌وجو، پوشه، برچسب"], ["⭐", "برگزیده‌ها"],
        ["📋", "پاک‌سازیِ خودکارِ کلیپ‌بورد"], ["⏱️", "قفلِ خودکار در بی‌کاری"], ["🗂️", "سینی سیستم"],
        ["⌨️", "میان‌بُرها (Ctrl+L/F/N/G)"], ["🕑", "تاریخچه‌ی رمز"], ["🧭", "ممیزیِ امنیتی"],
        ["💾", "پشتیبانِ رمزنگاری‌شده"], ["🌗", "تمِ روشن/تیره"], ["🔗", "بازکردنِ آدرس"],
      ]
    : [
        ["🎯", "Quick Capture (Ctrl+Shift+A)"], ["🖱️", "Right-click actions"], ["🕘", "Recent, sort & avatars"],
        ["🔑", "Five item types"], ["🛡️", "TOTP 2FA codes"], ["🎲", "Password & passphrase generator"],
        ["📊", "Strength meter"], ["🔎", "Search, folders, tags"], ["⭐", "Favorites"],
        ["📋", "Clipboard auto-clear"], ["⏱️", "Idle auto-lock"], ["🗂️", "System tray"],
        ["⌨️", "Shortcuts (Ctrl+L/F/N/G)"], ["🕑", "Password history"], ["🧭", "Security audit"],
        ["💾", "Encrypted backup"], ["🌗", "Dark / light theme"], ["🔗", "Open URL"],
      ];

  const security: [string, string, string][] = fa
    ? [
        ["🧬", "Argon2id", "کلید‌سازیِ حافظه‌سخت (۶۴MB تا ۱GB)"],
        ["🔐", "XChaCha20-Poly1305", "رمزنگاریِ احرازشده با نانسِ ۱۹۲بیتی"],
        ["🗝️", "کلیدفایل", "فاکتورِ دومِ اختیاری در KDF"],
        ["🧹", "پاک‌سازیِ حافظه", "کلیدها با sodium_memzero پاک می‌شوند"],
        ["🔒", "فایلِ 0600", "دسترسیِ فقط‌مالک روی گاوصندوق"],
        ["✅", "ضدِ دستکاری", "هدر به‌عنوانِ AAD؛ هر تغییری رد می‌شود"],
      ]
    : [
        ["🧬", "Argon2id", "Memory-hard KDF (64 MB – 1 GB)"],
        ["🔐", "XChaCha20-Poly1305", "Authenticated encryption, 192-bit nonce"],
        ["🗝️", "Keyfile", "Optional second factor mixed into the KDF"],
        ["🧹", "Memory wipe", "Keys scrubbed with sodium_memzero"],
        ["🔒", "0600 file", "Owner-only permissions on the vault"],
        ["✅", "Tamper-proof", "Header bound as AAD; any change is rejected"],
      ];

  const steps = fa
    ? ["رمزت با Argon2id به یک کلیدِ ۲۵۶بیتی تبدیل می‌شود.", "کلیدفایلِ اختیاری با BLAKE2b ترکیب می‌شود.", "گاوصندوق با XChaCha20-Poly1305 رمز می‌شود.", "هدر به‌عنوانِ AAD احراز می‌شود — دستکاری غیرممکن."]
    : ["Argon2id stretches your password into a 256-bit key.", "An optional keyfile is folded in via BLAKE2b.", "The vault is sealed with XChaCha20-Poly1305.", "The header is authenticated as AAD — tampering fails."];

  const buildCmd = `cd desktop\n./build.sh --install-deps   # first time only\n./build.sh                  # → build/${DEB}`;
  const debCmd = `sudo apt install ./${DEB}`;

  const Terminal = ({ text, k, title }: { text: string; k: string; title: string }) => (
    <div className="dl-term relative overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)", boxShadow: "0 30px 60px -30px var(--shadow)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: "var(--line)" }}>
        <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f57" }} />
        <span className="h-3 w-3 rounded-full" style={{ background: "#febc2e" }} />
        <span className="h-3 w-3 rounded-full" style={{ background: "#28c840" }} />
        <span className="mono ms-2 text-xs text-[var(--fg-2)]">{title}</span>
        <button onClick={() => copy(text, k)} title={T.copyHint} className="ms-auto grid h-7 w-7 place-items-center rounded-lg text-[var(--fg-2)] transition-colors hover:text-[var(--accent)]">
          {copied === k ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>
          )}
        </button>
      </div>
      <pre className="thin-scroll overflow-x-auto p-4 text-sm leading-relaxed force-ltr">
        {text.split("\n").map((line, i) => (
          <div key={i} className="flex gap-2">
            <span style={{ color: "var(--accent)" }}>$</span>
            <code className="mono" style={{ color: "var(--fg)" }}>{line}</code>
          </div>
        ))}
        <span className="dl-cursor inline-block" style={{ background: "var(--accent)" }} />
      </pre>
    </div>
  );

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2.5 sm:flex">
            <Logo size={28} />
            <span className="font-display text-lg">Vault</span>
            <span className="text-xs text-[var(--fg-2)]">{T.eyebrow}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/vault" className="hidden rounded-full border px-3 py-1.5 text-xs sm:block" style={{ borderColor: "var(--line-2)" }}>{T.openWeb}</Link>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} aria-label="theme">◑</button>
          <LangToggle />
        </div>
      </header>

      <main className="wrap py-10 sm:py-14">
        {/* hero */}
        <Reveal>
          <section className="panel elev frame-grad relative overflow-hidden p-6 sm:p-12">
            <div className="conic-sheen" aria-hidden style={{ opacity: 0.2 }} />
            <div className="pointer-events-none absolute -end-20 -top-24 h-72 w-72 rounded-full aurora floaty" style={{ background: "var(--accent)", opacity: 0.18 }} aria-hidden />
            <div className="pointer-events-none absolute -start-20 bottom-0 h-64 w-64 rounded-full aurora floaty-slow" style={{ background: "var(--accent-2)", opacity: 0.14 }} aria-hidden />
            <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip">🐧 Linux</span>
                  <span className="chip">C++</span>
                  <span className="chip">Qt6</span>
                  <span className="chip">libsodium</span>
                  <span className="chip mono">v{VERSION}</span>
                </div>
                <h1 className="dl-title mt-5 font-display text-4xl leading-[1.05] sm:text-6xl">{T.title}</h1>
                <p className="mono mt-1 text-sm" style={{ color: "var(--accent)" }}>{T.native}</p>
                <p className="mt-4 max-w-xl text-[var(--fg-2)]">{T.sub}</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a href={RELEASES} target="_blank" rel="noopener noreferrer" className="btn btn-accent px-5 py-3 text-base" style={{ boxShadow: "0 14px 40px -12px var(--glow)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></svg>
                    {T.getDeb}
                  </a>
                  <a href={REPO_DESKTOP} target="_blank" rel="noopener noreferrer" className="btn btn-outline px-5 py-3 text-base">{T.source} ↗</a>
                </div>
                <p className="mono mt-3 flex items-center gap-2 text-xs text-[var(--fg-2)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />{T.note}</p>
              </div>
              <div className="relative hidden justify-self-center lg:block">
                <div className="dl-badge grid h-44 w-44 place-items-center rounded-[2.2rem] border" style={{ borderColor: "var(--line-2)", background: "var(--bg-3)", boxShadow: "0 40px 90px -30px var(--shadow), 0 0 80px -30px var(--glow)" }}>
                  <Logo size={112} />
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* build */}
        <Reveal>
          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="panel elev p-6 sm:p-8">
              <h2 className="font-display text-2xl">{T.buildTitle}</h2>
              <p className="mt-1 text-sm text-[var(--fg-2)]">{T.buildSub}</p>
              <div className="mt-4"><Terminal text={buildCmd} k="build" title="build — bash" /></div>
              <p className="mt-4 text-sm text-[var(--fg-2)]">{T.installNote}</p>
              <div className="mt-2"><Terminal text={debCmd} k="deb" title="install — bash" /></div>
              <p className="mt-4 text-sm text-[var(--fg-2)]">{T.launch}</p>
            </div>

            {/* how it works */}
            <div className="panel elev glow-border relative overflow-hidden p-6 sm:p-8">
              <div className="conic-sheen" aria-hidden style={{ opacity: 0.12 }} />
              <h2 className="relative font-display text-2xl">{T.howTitle}</h2>
              <ol className="relative mt-5 space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3" style={{ animation: "popIn .5s cubic-bezier(.22,1,.36,1) both", animationDelay: `${i * 90}ms` }}>
                    <span className="mono grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}>{i + 1}</span>
                    <p className="text-sm text-[var(--fg-2)]">{s}</p>
                  </li>
                ))}
              </ol>
              <div className="relative mt-6 grid grid-cols-2 gap-2">
                {security.map(([icon, title, desc], i) => (
                  <div key={i} className="rounded-xl border p-3 lift" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                    <div className="text-xl">{icon}</div>
                    <p className="mt-1 text-sm font-medium">{title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--fg-2)]">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        {/* features */}
        <Reveal>
          <section className="panel elev mt-6 p-6 sm:p-8">
            <h2 className="font-display text-2xl">{T.featuresTitle}</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {features.map(([icon, label], i) => (
                <div key={i} className="rounded-2xl border p-4 lift glow-border" style={{ borderColor: "var(--line)", background: "var(--bg-3)", animation: "popIn .5s cubic-bezier(.22,1,.36,1) both", animationDelay: `${Math.min(i * 40, 400)}ms` }}>
                  <div className="text-2xl">{icon}</div>
                  <p className="mt-2 text-sm font-medium leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <p className="mt-8 text-center text-sm text-[var(--fg-2)]">
          {fa ? "ترجیح می‌دهی نصب نکنی؟" : "Prefer not to install?"}{" "}
          <Link href="/vault" className="accent-text underline-offset-4 hover:underline">{T.openWeb} →</Link>
        </p>
      </main>

      <style jsx global>{`
        .dl-title {
          background: linear-gradient(100deg, var(--fg), var(--accent), var(--fg));
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: dlShift 6s ease-in-out infinite;
        }
        @keyframes dlShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .dl-cursor { width: 9px; height: 1.05em; margin-inline-start: 2px; vertical-align: text-bottom; animation: dlBlink 1.05s steps(1) infinite; border-radius: 1px; }
        @keyframes dlBlink { 50% { opacity: 0; } }
        .dl-badge { animation: dlFloat 7s ease-in-out infinite; }
        @keyframes dlFloat { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-12px) rotate(-2deg); } }
        @media (prefers-reduced-motion: reduce) {
          .dl-title, .dl-cursor, .dl-badge { animation: none; }
          .dl-title { -webkit-text-fill-color: var(--fg); }
        }
      `}</style>
    </div>
  );
}
