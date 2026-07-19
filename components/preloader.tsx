"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A polished full-screen loading screen. It stays up until the heavy work of
 * the first paint is genuinely finished — web-fonts decoded and every image on
 * the page loaded — plus a short minimum so it never just flashes. Warming
 * everything up behind the curtain means the page is fully painted before the
 * user starts scrolling, which removes the first-scroll hitching.
 *
 * Mounted once in the root layout, so it only appears on a real (hard) page
 * load, never on in-app client navigations. Hard fail-safe timeout guarantees
 * it always lets go even if some asset never resolves.
 */
export function Preloader() {
  const [progress, setProgress] = useState(8);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);
  const targetRef = useRef(8);
  const rafRef = useRef(0);

  useEffect(() => {
    const startedAt = performance.now();
    const MIN_MS = 750; // never flash by less than this
    const MAX_MS = 6000; // hard ceiling — always release the page

    // lock scrolling while the curtain is up so nothing jumps underneath it
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    let settled = false;
    const bump = (to: number) => { targetRef.current = Math.max(targetRef.current, to); };

    // smooth easing of the displayed number toward the current target
    const tick = () => {
      setProgress((p) => {
        const t = settled ? 100 : targetRef.current;
        const next = p + (t - p) * 0.12;
        return next > 99.5 && !settled ? 99 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // milestones
    bump(22);
    const t1 = setTimeout(() => bump(40), 120);

    // fonts decoded
    const fontsReady =
      (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
    fontsReady.then(() => bump(70)).catch(() => bump(70));

    // decode every <img> that's already in the DOM so scrolling never waits on it
    const decodeImages = async () => {
      const imgs = Array.from(document.images);
      if (!imgs.length) { bump(88); return; }
      let loaded = 0;
      await Promise.all(
        imgs.map((img) => {
          const step = () => { loaded++; bump(70 + Math.round((loaded / imgs.length) * 22)); };
          if (img.complete) { step(); return Promise.resolve(); }
          return new Promise<void>((res) => {
            const onEnd = () => { step(); res(); };
            img.addEventListener("load", onEnd, { once: true });
            img.addEventListener("error", onEnd, { once: true });
          });
        }),
      );
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - startedAt));
      setTimeout(() => {
        setDone(true); // triggers the fade
        document.documentElement.style.overflow = prevOverflow;
        setTimeout(() => { setGone(true); cancelAnimationFrame(rafRef.current); }, 650);
      }, wait);
    };

    const onWindowLoad = async () => { await decodeImages(); finish(); };
    if (document.readyState === "complete") onWindowLoad();
    else window.addEventListener("load", onWindowLoad, { once: true });

    const failSafe = setTimeout(finish, MAX_MS);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(t1);
      clearTimeout(failSafe);
      window.removeEventListener("load", onWindowLoad);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, []);

  if (gone) return null;
  const pct = Math.min(100, Math.round(progress));

  return (
    <div className={`preloader${done ? " preloader--done" : ""}`} role="status" aria-live="polite" aria-label="Loading">
      <div className="preloader__bg" aria-hidden>
        <div className="preloader__aurora preloader__aurora--a" />
        <div className="preloader__aurora preloader__aurora--b" />
      </div>

      <div className="preloader__stack">
        <div className="preloader__mark" aria-hidden>
          <svg viewBox="0 0 120 120" width="96" height="96">
            <circle className="pl-ring pl-ring--1" cx="60" cy="60" r="52" fill="none" stroke="var(--line-2)" strokeWidth="1.5" />
            <circle
              className="pl-ring pl-ring--2"
              cx="60" cy="60" r="52" fill="none"
              stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="327" strokeDashoffset={327 - (327 * pct) / 100}
              transform="rotate(-90 60 60)"
            />
            <text x="60" y="60" textAnchor="middle" dominantBaseline="central" className="pl-monogram" fill="var(--fg)">S</text>
          </svg>
        </div>

        <div className="preloader__brand">
          <span className="preloader__name">saleh.im</span>
          <span className="preloader__sub">crafting the experience…</span>
        </div>

        <div className="preloader__bar" aria-hidden>
          <span className="preloader__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="preloader__pct mono force-ltr">{pct}%</span>
      </div>
    </div>
  );
}
