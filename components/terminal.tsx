"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";
import { profile, projects, domains, BASE_PATH } from "@/lib/data";
import { useLang } from "./lang-provider";

type Line = { type: "out" | "cmd" | "sys"; text: string };

const USER = "saleh";
const HOST = "saleh.im";
const PROMPT = `${USER}@${HOST}:~$`;

const HELP = `available commands:
  help         show this help
  about        who is Saleh?
  skills       tech stack overview
  projects     featured work
  experience   career timeline
  socials      contact & links
  whoami       current user
  neofetch     system info
  date         current date/time
  echo <text>  print text
  open <app>   e.g. open messenger
  clear        clear the screen
  sudo         nice try`;

function runCommand(raw: string): string[] {
  const input = raw.trim();
  const [cmd, ...args] = input.split(/\s+/);

  switch (cmd.toLowerCase()) {
    case "":
      return [];
    case "help":
    case "?":
      return HELP.split("\n");
    case "about":
      return [
        `${profile.name.en}  (aka "${profile.nickname.en}")`,
        `${profile.role.en} · ${profile.location.en}`,
        "",
        "Self-taught engineer shipping in public since 2022.",
        "Focus: fast web products, real-time systems & applied cryptography.",
      ];
    case "skills":
      return domains.flatMap((d) => [
        `${d.title.en}:`,
        ...d.skills.map((s) => `   ${s.name.en.padEnd(26)} ${s.level}%  (${s.years.en})`),
      ]);
    case "projects":
      return projects
        .filter((p) => p.featured)
        .flatMap((p) => [`• ${p.title.en}`, `    ${p.description.en.slice(0, 72)}…`, `    ↳ ${p.href}`]);
    case "experience":
    case "exp":
      return [
        "2022     first commits — open-source & personal projects",
        "2023     full-stack foundations (TypeScript, React)",
        "2024     real-time & systems (WebRTC, streaming)",
        "2025-26  products & cryptography — encrypted apps, design systems",
      ];
    case "socials":
    case "contact":
      return [
        `email     ${profile.email}`,
        `telegram  ${profile.telegramUrl}`,
        `github    ${profile.github}`,
      ];
    case "whoami":
      return [USER];
    case "date":
      return [new Date().toString()];
    case "echo":
      return [args.join(" ")];
    case "open":
      if (/messeng|chat|cipher/i.test(args[0] || "")) {
        if (typeof window !== "undefined") window.open(`${BASE_PATH}/messenger/`, "_blank");
        return ["opening Cipher messenger…"];
      }
      if (/lumen|dash|market/i.test(args[0] || "")) {
        if (typeof window !== "undefined") window.open(`${BASE_PATH}/lumen/`, "_blank");
        return ["opening Lumen dashboard…"];
      }
      if (/probe|net|conn/i.test(args[0] || "")) {
        if (typeof window !== "undefined") window.open(`${BASE_PATH}/probe/`, "_blank");
        return ["opening Probe inspector…"];
      }
      return [`open: unknown app '${args[0] || ""}'. try: open messenger | lumen | probe`];
    case "neofetch":
      return [
        `${USER}@${HOST}`,
        "-----------------",
        "os        SalehOS (Linux x86_64)",
        "shell     zsh 5.9",
        "editor    nvim / VS Code",
        "uptime    since 2022",
        "langs     TypeScript · JavaScript · Rust · Go · Python",
        "stack     React · Next.js · Node.js",
        "cpu       caffeine-powered",
      ];
    case "sudo":
      return ["[sudo] password for saleh:", "nice try — you don't have permission for that."];
    case "ls":
      return ["about  skills  projects  experience  socials  messenger/  lumen/  probe/"];
    case "cat":
      return args.length ? [`cat: ${args[0]}: permission denied (it's a secret)`] : ["usage: cat <file>"];
    case "exit":
      return ["Connection to saleh.im closed."];
    default:
      return [`command not found: ${cmd}. type 'help' for options.`];
  }
}

const INTRO: { cmd: string; out: string[] }[] = [
  { cmd: "whoami", out: ["saleh"] },
  {
    cmd: "cat welcome.txt",
    out: [
      `welcome — I'm ${profile.name.en}.`,
      `${profile.role.en}, shipping since 2022.`,
      "type 'help' to explore. try: about, projects, neofetch.",
    ],
  },
];

/* zsh-style colored prompt: saleh@saleh.im ~/portfolio $ */
function Prompt() {
  return (
    <span className="shrink-0 select-none">
      <span style={{ color: "var(--accent)" }}>{USER}</span>
      <span style={{ opacity: 0.45 }}>@</span>
      <span style={{ color: "#7fd1ff" }}>{HOST}</span>
      <span style={{ opacity: 0.45 }}> </span>
      <span style={{ color: "#c9a6ff" }}>~/portfolio</span>
      <span style={{ color: "var(--accent)" }}> ❯</span>
    </span>
  );
}

export function Terminal() {
  const { t } = useLang();
  const [lines, setLines] = useState<Line[]>([]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [booted, setBooted] = useState(false);
  const [interactive, setInteractive] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !booted) {
          setBooted(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [booted]);

  useEffect(() => {
    if (!booted) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const type = async (text: string, onChar: (partial: string) => void) => {
      for (let i = 1; i <= text.length; i++) {
        if (cancelled) return;
        await new Promise<void>((resolve) => timers.push(setTimeout(resolve, 24 + Math.random() * 38)));
        onChar(text.slice(0, i));
      }
    };

    const run = async () => {
      await new Promise<void>((r) => timers.push(setTimeout(r, 400)));
      for (const step of INTRO) {
        setLines((prev) => [...prev, { type: "cmd", text: "" }]);
        await type(step.cmd, (partial) => {
          setLines((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { type: "cmd", text: partial };
            return copy;
          });
        });
        await new Promise<void>((r) => timers.push(setTimeout(r, 220)));
        setLines((prev) => [...prev, ...step.out.map((o) => ({ type: "out" as const, text: o }))]);
        await new Promise<void>((r) => timers.push(setTimeout(r, 360)));
      }
      if (!cancelled) {
        setLines((prev) => [...prev, { type: "sys", text: "— shell ready. type a command —" }]);
        setInteractive(true);
      }
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [booted]);

  const submit = useCallback((raw: string) => {
    const cmd = raw.trim();
    setLines((prev) => [...prev, { type: "cmd", text: raw }]);
    if (cmd) setHistory((h) => [...h, cmd]);
    setHistIdx(-1);
    if (cmd.toLowerCase() === "clear") {
      setLines([]);
      return;
    }
    const out = runCommand(raw);
    if (out.length) setLines((prev) => [...prev, ...out.map((o) => ({ type: "out" as const, text: o }))]);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      submit(value);
      setValue("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setValue(history[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const next = histIdx + 1;
      if (next >= history.length) {
        setHistIdx(-1);
        setValue("");
      } else {
        setHistIdx(next);
        setValue(history[next] ?? "");
      }
    }
  };

  return (
    <section id="terminal" ref={sectionRef} className="cv-section relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <span className="section-index pointer-events-none absolute start-2 top-10 select-none sm:start-6" aria-hidden>07</span>
      <div className="pointer-events-none absolute end-[8%] top-1/3 h-72 w-72 rounded-full aurora floaty" style={{ background: "var(--accent)", opacity: 0.1 }} aria-hidden />
      <div className="wrap relative">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Reveal>
              <p className="label">{t.shell.eyebrow}</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                {t.shell.heading1}
                <br />
                <span className="display-italic accent-text">{t.shell.heading2}</span>
              </h2>
              <p className="mt-6 max-w-sm text-[var(--fg-2)]">{t.shell.sub}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["help", "about", "projects", "neofetch"].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      if (interactive) submit(c);
                      inputRef.current?.focus();
                    }}
                    className="chip force-ltr transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-8">
            <Reveal delay={80}>
              <div
                dir="ltr"
                className="relative overflow-hidden rounded-2xl"
                style={{
                  background: "linear-gradient(180deg,#0a0e0d 0%,#07090a 100%)",
                  border: "1px solid var(--line-2)",
                  boxShadow: "0 40px 90px -40px var(--shadow), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 120px -60px var(--glow)",
                }}
                onClick={() => inputRef.current?.focus()}
              >
                {/* scanline sheen */}
                <div
                  className="pointer-events-none absolute inset-0 z-10"
                  aria-hidden
                  style={{
                    background: "repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)",
                    mixBlendMode: "overlay",
                    opacity: 0.5,
                  }}
                />

                {/* title bar */}
                <div className="relative z-20 flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f56", boxShadow: "0 0 8px rgba(255,95,86,0.5)" }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: "#ffbd2e", boxShadow: "0 0 8px rgba(255,189,46,0.4)" }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: "#27c93f", boxShadow: "0 0 8px rgba(39,201,63,0.45)" }} />
                  </div>
                  <span className="mono text-xs" style={{ color: "#8aa0a0" }}>
                    <span style={{ color: "var(--accent)" }}>{USER}</span>
                    <span style={{ opacity: 0.6 }}> — ~/portfolio — zsh</span>
                  </span>
                  <span className="mono text-[10px]" style={{ color: "#8aa0a0", opacity: 0.5 }}>⌘</span>
                </div>

                {/* screen */}
                <div ref={scrollRef} className="relative z-20 mono h-[360px] overflow-y-auto px-4 py-4 text-[13px] leading-relaxed sm:text-sm" style={{ color: "var(--accent)" }}>
                  {lines.map((line, i) => {
                    if (line.type === "cmd")
                      return (
                        <div key={i} className="flex flex-wrap gap-x-2 whitespace-pre-wrap break-words">
                          <Prompt />
                          <span style={{ color: "#eafff0" }}>{line.text}</span>
                        </div>
                      );
                    if (line.type === "sys")
                      return <div key={i} className="my-1.5 whitespace-pre-wrap break-words" style={{ opacity: 0.4 }}>{line.text}</div>;
                    return <div key={i} className="whitespace-pre-wrap break-words" style={{ opacity: 0.88 }}>{line.text}</div>;
                  })}

                  {interactive && (
                    <div className="flex flex-wrap gap-x-2">
                      <Prompt />
                      <span className="relative min-w-[1ch] flex-1">
                        <span className="whitespace-pre-wrap break-words" style={{ color: "#eafff0" }}>{value}</span>
                        <span className="caret ms-0.5 inline-block h-4 w-2 translate-y-0.5 align-middle" style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--glow)" }} />
                        <input
                          ref={inputRef}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          onKeyDown={onKeyDown}
                          spellCheck={false}
                          autoCapitalize="off"
                          autoComplete="off"
                          autoCorrect="off"
                          aria-label="Terminal input"
                          className="absolute inset-0 h-full w-full cursor-default bg-transparent text-transparent caret-transparent outline-none"
                        />
                      </span>
                    </div>
                  )}

                  {!interactive && !booted && <div style={{ opacity: 0.4 }}>initializing shell…</div>}
                </div>

                {/* status bar */}
                <div className="relative z-20 flex items-center justify-between px-4 py-2 mono text-[10px]" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "#8aa0a0" }}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: interactive ? "#27c93f" : "#ffbd2e" }} />
                    {interactive ? "ready" : "booting"} · zsh · utf-8
                  </span>
                  <span style={{ opacity: 0.7 }}>{lines.length} lines · ↑↓ history</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
