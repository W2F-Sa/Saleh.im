"use client";

import { useEffect, useRef, useState } from "react";
import { profile } from "@/lib/data";

const roles = [
  "Software Engineer",
  "Network Engineer",
  "Edge & Cloudflare Workers",
  "Full-Stack Developer",
];

function useTypewriter(words: string[], speed = 70, pause = 1400) {
  const [text, setText] = useState("");
  const [i, setI] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[i % words.length];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && text === current) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && text === "") {
      setDeleting(false);
      setI((v) => v + 1);
    } else {
      timeout = setTimeout(
        () => {
          setText((prev) =>
            deleting
              ? current.slice(0, prev.length - 1)
              : current.slice(0, prev.length + 1)
          );
        },
        deleting ? speed / 2 : speed
      );
    }
    return () => clearTimeout(timeout);
  }, [text, deleting, i, words, speed, pause]);

  return text;
}

export function Hero() {
  const typed = useTypewriter(roles);
  const spotRef = useRef<HTMLDivElement>(null);

  // Pointer spotlight — pointer events only (never on scroll), rAF-throttled.
  useEffect(() => {
    const el = spotRef.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${e.clientX}px`);
        el.style.setProperty("--my", `${e.clientY}px`);
        raf = 0;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      <div className="pointer-events-none absolute inset-0 grid-backdrop" aria-hidden />
      <div
        ref={spotRef}
        className="pointer-events-none absolute inset-0 hidden md:block"
        aria-hidden
        style={{
          background:
            "radial-gradient(400px circle at var(--mx, 50%) var(--my, 20%), color-mix(in srgb, var(--fg) 7%, transparent), transparent 60%)",
        }}
      />

      <div className="container-page relative">
        <div className="animate-fade-in">
          <span className="section-label">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Available for work · {profile.location}
          </span>
        </div>

        <h1 className="heading-xl mt-4 max-w-4xl animate-fade-up">
          Hi, I&apos;m <span className="text-gradient animate-gradient-pan">Saleh</span>.
          <br />
          I build fast systems <span className="text-[var(--fg-muted)]">at the edge.</span>
        </h1>

        <div
          className="mt-6 flex h-8 items-center font-mono text-lg text-[var(--fg-muted)] sm:text-xl animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          <span className="mr-2 text-emerald-500">&gt;</span>
          <span className="text-[var(--fg)]">{typed}</span>
          <span className="ml-0.5 inline-block h-5 w-[2px] animate-blink bg-[var(--fg)]" />
        </div>

        <p
          className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg animate-fade-up"
          style={{ animationDelay: "160ms" }}
        >
          {profile.bio}
        </p>

        <div
          className="mt-9 flex flex-wrap items-center gap-3 animate-fade-up"
          style={{ animationDelay: "240ms" }}
        >
          <a href="#projects" className="btn-primary">
            View Projects
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <a href="#contact" className="btn-ghost">
            Get in touch
          </a>
          <a
            href={profile.github}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 .1.8 1.7 2.6 1.2.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
            </svg>
            {profile.handle}
          </a>
        </div>

        <dl
          className="mt-14 grid max-w-lg grid-cols-3 gap-4 animate-fade-up"
          style={{ animationDelay: "320ms" }}
        >
          {[
            { k: "Since", v: String(profile.activeSince) },
            { k: "Repos", v: "30+" },
            { k: "Age", v: String(profile.age) },
          ].map((s) => (
            <div key={s.k}>
              <dt className="font-mono text-2xl font-bold sm:text-3xl">{s.v}</dt>
              <dd className="mt-1 text-xs uppercase tracking-widest text-[var(--fg-muted)]">
                {s.k}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
