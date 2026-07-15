"use client";

import { useEffect, useState } from "react";
import { profile, BASE_PATH } from "@/lib/data";
import { useLang } from "./lang-provider";
import { useThemeScene } from "./theme-provider";

/* Live clock in Saleh's local time (Tehran) */
function LocalClock({ fa }: { fa: boolean }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      try {
        setTime(
          new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZone: "Asia/Tehran",
          }).format(new Date())
        );
      } catch {
        setTime(new Date().toLocaleTimeString());
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [fa]);
  return <span className="mono tabular-nums force-ltr">{time || "--:--:--"}</span>;
}

export function Footer() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";
  const year = new Date().getFullYear();

  const t = {
    kicker: fa ? "بیا با هم بسازیم" : "Let's build together",
    headline1: fa ? "یک ایده داری؟" : "Got an idea?",
    headline2: fa ? "بیا واقعیش کنیم." : "Let's make it real.",
    cta: fa ? "یک پیام بده" : "Start a project",
    availTitle: fa ? "وضعیت" : "Availability",
    avail: fa ? "پذیرای پروژه‌های جدید" : "Open to new projects",
    localTime: fa ? "ساعت محلی (تهران)" : "Local time (Tehran)",
    reply: fa ? "معمولاً تا یک روز پاسخ" : "Usually replies within a day",
    navTitle: fa ? "پیمایش" : "Navigate",
    projTitle: fa ? "پروژه‌ها" : "Projects",
    elseTitle: fa ? "جاهای دیگر" : "Elsewhere",
    nowTitle: fa ? "این روزها" : "Currently",
    nowText: fa
      ? "در حال ساختِ ابزارهای لایو و تجربه‌های وبِ رمزنگاری‌شده."
      : "Building real-time tools and encrypted web experiences.",
    built: fa ? "ساخته‌شده با Next.js و React" : "Built with Next.js & React",
    top: fa ? "بازگشت به بالا" : "Back to top",
    rights: fa ? "همه‌ی حقوق محفوظ است." : "All rights reserved.",
    theme: fa ? "تغییر پوسته" : "Toggle theme",
  };

  const nav = fa
    ? [
        ["#about", "درباره"],
        ["#skills", "بلدی‌ها"],
        ["#work", "مسیر"],
        ["#projects", "کارها"],
        ["#terminal", "ترمینال"],
      ]
    : [
        ["#about", "About"],
        ["#skills", "Skills"],
        ["#work", "Journey"],
        ["#projects", "Work"],
        ["#terminal", "Shell"],
      ];

  const projs: [string, string, boolean][] = [
    [`${BASE_PATH}/messenger/`, fa ? "پیام‌رسان Cipher" : "Cipher Messenger", false],
    [`${BASE_PATH}/lumen/`, fa ? "داشبورد Lumen" : "Lumen Dashboard", false],
    [profile.github, "GitHub", true],
  ];

  const social: [string, string][] = [
    [`mailto:${profile.email}`, fa ? "ایمیل" : "Email"],
    [profile.telegramUrl, fa ? "تلگرام" : "Telegram"],
    [profile.github, "GitHub"],
  ];

  return (
    <footer className="relative mt-10 overflow-hidden border-t" style={{ borderColor: "var(--line)" }}>
      {/* ambient glow + floating orbs */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)", opacity: 0.5 }} />
      <div className="pointer-events-none absolute -top-28 start-[12%] h-72 w-72 rounded-full aurora floaty" style={{ background: "var(--accent)", opacity: 0.16 }} aria-hidden />
      <div className="pointer-events-none absolute -top-16 end-[10%] h-56 w-56 rounded-full aurora floaty-slow" style={{ background: "var(--accent-2)", opacity: 0.14 }} aria-hidden />

      <div className="wrap relative pt-16 sm:pt-20">
        {/* CTA band */}
        <div className="frame-grad panel relative overflow-hidden p-6 sm:p-10">
          <div className="conic-sheen" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div>
              <p className="label tag-dot">{t.kicker}</p>
              <h2 className="display mt-5 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
                {t.headline1}
                <br />
                <span className="accent-text">{t.headline2}</span>
              </h2>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a href={`mailto:${profile.email}`} className="btn btn-accent text-base">
                  {t.cta}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
                <a href={profile.telegramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline text-base">
                  {fa ? "تلگرام" : "Telegram"}
                </a>
              </div>
            </div>

            <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg-3) 60%, transparent)" }}>
              <div className="flex items-center justify-between gap-3">
                <span className="label">{t.availTitle}</span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: "#27c93f" }} />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: "#27c93f" }} />
                  </span>
                  {t.avail}
                </span>
              </div>
              <div className="mt-5 flex items-end justify-between gap-4 border-t pt-5" style={{ borderColor: "var(--line)" }}>
                <div>
                  <p className="label mb-1">{t.localTime}</p>
                  <p className="font-display text-2xl sm:text-3xl">
                    <LocalClock fa={fa} />
                  </p>
                </div>
                <p className="max-w-[9rem] text-end text-xs text-[var(--fg-2)]">{t.reply}</p>
              </div>
            </div>
          </div>
        </div>

        {/* link columns */}
        <div className="mt-16 grid grid-cols-2 gap-8 border-t pt-12 sm:grid-cols-4" style={{ borderColor: "var(--line)" }}>
          <div>
            <p className="label mb-4">{t.navTitle}</p>
            <ul className="space-y-2.5">
              {nav.map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="link-sweep text-[var(--fg-2)] transition-colors hover:text-[var(--fg)]">{label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label mb-4">{t.projTitle}</p>
            <ul className="space-y-2.5">
              {projs.map(([href, label, ext]) => (
                <li key={label}>
                  <a href={href} target={ext ? "_blank" : undefined} rel="noopener noreferrer" className="link-sweep text-[var(--fg-2)] transition-colors hover:text-[var(--fg)]">{label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label mb-4">{t.elseTitle}</p>
            <ul className="space-y-2.5">
              {social.map(([href, label]) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="link-sweep text-[var(--fg-2)] transition-colors hover:text-[var(--fg)]">{label} ↗</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label mb-4">{t.nowTitle}</p>
            <p className="text-sm leading-relaxed text-[var(--fg-2)]">{t.nowText}</p>
            <p className="mono mt-4 text-xs force-ltr" style={{ color: "var(--accent)" }}>{profile.handle}</p>
          </div>
        </div>

        {/* giant wordmark */}
        <div className="edge-fade mt-12 overflow-hidden">
          {fa ? (
            <div className="fa-accent select-none whitespace-nowrap text-center text-[22vw] leading-[1.15] text-[var(--fg-2)] opacity-[0.07] sm:text-[13rem]">
              صالح ثقفیانی
            </div>
          ) : (
            <div className="display select-none text-center text-[24vw] leading-none text-[var(--fg-2)] opacity-[0.07] sm:text-[16rem] force-ltr">
              saleh
            </div>
          )}
        </div>

        {/* bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t py-8 sm:flex-row" style={{ borderColor: "var(--line)" }}>
          <p className="text-sm text-[var(--fg-2)]">
            © {fa ? year.toLocaleString("fa-IR").replace(/٬/g, "") : year} {profile.name?.en ?? "Saleh Saghafiani"} · {t.built}
          </p>
          <div className="flex items-center gap-5 text-sm">
            <button onClick={toggleMode} className="link-sweep text-[var(--fg-2)] hover:text-[var(--fg)]" title={t.theme}>
              {t.theme}
            </button>
            <a href="#top" className="group inline-flex items-center gap-1.5 text-[var(--fg-2)] hover:text-[var(--fg)]">
              {t.top}
              <span className="grid h-6 w-6 place-items-center rounded-full border transition-transform group-hover:-translate-y-0.5" style={{ borderColor: "var(--line-2)" }}>↑</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
