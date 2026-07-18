"use client";

import { useEffect, useState } from "react";
import { ThemePicker } from "./theme-picker";
import { LangToggle } from "./lang-toggle";
import { useLang } from "./lang-provider";
import { Logo } from "./logo";

export function Navbar() {
  const { t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const links = [
    { href: "#about", label: t.nav.about, n: "01" },
    { href: "#skills", label: t.nav.skills, n: "02" },
    { href: "#electronics", label: t.nav.electronics, n: "03" },
    { href: "#certificates", label: t.nav.certs, n: "04" },
    { href: "#work", label: t.nav.journey, n: "05" },
    { href: "#projects", label: t.nav.work, n: "06" },
    { href: "#terminal", label: t.nav.shell, n: "07" },
    { href: "#contact", label: t.nav.contact, n: "08" },
  ];

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 16);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-all duration-300 ${scrolled ? "backdrop-blur-xl" : ""}`}
        style={{
          background: scrolled ? "color-mix(in srgb, var(--bg) 78%, transparent)" : "transparent",
          borderBottom: scrolled ? "1px solid var(--line)" : "1px solid transparent",
        }}
      >
        <nav className="wrap flex h-16 items-center justify-between">
          <a href="#top" className="group flex items-center gap-2.5">
            <Logo size={34} className="transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105" />
            <span className="font-display text-lg font-semibold tracking-tight force-ltr">
              saleh<span className="accent-text">.</span>im
            </span>
          </a>

          <div className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[var(--fg-2)] transition-all hover:-translate-y-0.5 hover:text-[var(--fg)]">
                <span className="mono text-[10px] opacity-50 transition-colors group-hover:text-[var(--accent)] group-hover:opacity-100">{l.n}</span>
                <span className="udl">{l.label}</span>
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemePicker />
            <button
              type="button"
              aria-label={t.nav.menu}
              onClick={() => setOpen((v) => !v)}
              className="grid h-9 w-9 place-items-center rounded-full border lg:hidden"
              style={{ borderColor: "var(--line-2)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
              </svg>
            </button>
          </div>
        </nav>
      </div>

      {open && (
        <div className="lg:hidden" style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
          <div className="wrap grid gap-1 py-4">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-[var(--fg-2)] hover:bg-[var(--bg-2)] hover:text-[var(--fg)]">
                <span className="mono text-xs opacity-50">{l.n}</span>
                <span className="text-lg">{l.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
