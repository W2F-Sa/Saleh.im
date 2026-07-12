"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";
import { profile, projects, domains } from "@/lib/data";

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
        `${profile.name}  (aka "${profile.nickname}")`,
        `${profile.role} · ${profile.age} y/o · ${profile.location}`,
        "",
        "Self-taught engineer shipping open-source since 2022.",
        "Focus: Cloudflare Workers, edge runtimes, networking & full-stack.",
      ];
    case "skills":
      return domains.flatMap((d) => [
        `${d.title}:`,
        ...d.skills.map((s) => `   ${s.name.padEnd(26)} ${s.level}%  (${s.years})`),
      ]);
    case "projects":
      return projects
        .filter((p) => p.featured)
        .flatMap((p) => [`• ${p.title}`, `    ${p.description.slice(0, 72)}…`, `    ↳ ${p.href}`]);
    case "experience":
    case "exp":
      return [
        "2022     started on GitHub — open-source networking tools",
        "2023     proxy / tunneling infrastructure (Xray, V2Ray)",
        "2024     edge computing on Cloudflare Workers",
        "2025-26  cross-platform apps, dashboards & encrypted messengers",
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
        if (typeof window !== "undefined")
          window.open(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/apps/messenger/`, "_blank");
        return ["opening Cipher messenger in a new tab…"];
      }
      return [`open: unknown app '${args[0] || ""}'. try: open messenger`];
    case "neofetch":
      return [
        `${USER}@${HOST}`,
        "-----------------",
        "os        SalehOS (Linux x86_64)",
        "shell     zsh 5.9",
        "editor    nvim / VS Code",
        "uptime    since 2022",
        "langs     TypeScript · Kotlin · Python · Go",
        "cloud     Cloudflare Workers",
        "cpu       caffeine-powered",
      ];
    case "sudo":
      return ["[sudo] password for saleh:", "nice try — you don't have permission for that."];
    case "ls":
      return ["about  skills  projects  experience  socials  apps/messenger"];
    case "cat":
      return args.length
        ? [`cat: ${args[0]}: permission denied (it's a secret)`]
        : ["usage: cat <file>"];
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
      `welcome — I'm ${profile.name}.`,
      `${profile.role}, building at the edge since 2022.`,
      "type 'help' to explore. try: about, projects, neofetch.",
    ],
  },
];

export function Terminal() {
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
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 24 + Math.random() * 38);
          timers.push(t);
        });
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
    <section id="terminal" ref={sectionRef} className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="wrap">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Reveal>
              <p className="label">05 / Shell</p>
              <h2 className="display mt-3 text-5xl sm:text-6xl">
                Prefer a<br />
                <span className="display-italic accent-text">terminal?</span>
              </h2>
              <p className="mt-6 max-w-sm text-[var(--fg-2)]">
                A real, interactive shell. It boots on its own — then it&apos;s yours.
                Type <code className="mono rounded px-1.5 py-0.5" style={{ background: "var(--bg-3)" }}>help</code> to
                begin, or <code className="mono rounded px-1.5 py-0.5" style={{ background: "var(--bg-3)" }}>open messenger</code>.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["help", "about", "projects", "neofetch"].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      if (interactive) submit(c);
                      inputRef.current?.focus();
                    }}
                    className="chip transition-colors hover:text-[var(--fg)]"
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
                className="overflow-hidden rounded-2xl"
                style={{ background: "#07090a", border: "1px solid var(--line-2)", boxShadow: "0 30px 80px -30px var(--shadow)" }}
                onClick={() => inputRef.current?.focus()}
              >
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: "#ff5f56" }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: "#ffbd2e" }} />
                    <span className="h-3 w-3 rounded-full" style={{ background: "#27c93f" }} />
                  </div>
                  <span className="mono text-xs" style={{ color: "var(--accent)" }}>
                    {USER}@{HOST}: ~ — zsh
                  </span>
                  <span className="w-12" />
                </div>

                <div
                  ref={scrollRef}
                  className="mono h-[380px] overflow-y-auto px-4 py-4 text-[13px] leading-relaxed sm:text-sm"
                  style={{ color: "var(--accent)" }}
                >
                  {lines.map((line, i) => {
                    if (line.type === "cmd")
                      return (
                        <div key={i} className="flex gap-2 whitespace-pre-wrap break-words">
                          <span className="shrink-0" style={{ opacity: 0.7 }}>{PROMPT}</span>
                          <span style={{ color: "#e8ffe0" }}>{line.text}</span>
                        </div>
                      );
                    if (line.type === "sys")
                      return (
                        <div key={i} className="my-1 whitespace-pre-wrap break-words" style={{ opacity: 0.45 }}>
                          {line.text}
                        </div>
                      );
                    return (
                      <div key={i} className="whitespace-pre-wrap break-words" style={{ opacity: 0.9 }}>
                        {line.text}
                      </div>
                    );
                  })}

                  {interactive && (
                    <div className="flex gap-2">
                      <span className="shrink-0" style={{ opacity: 0.7 }}>{PROMPT}</span>
                      <span className="relative flex-1">
                        <span className="whitespace-pre-wrap break-words" style={{ color: "#e8ffe0" }}>{value}</span>
                        <span className="caret ml-0.5 inline-block h-4 w-2 translate-y-0.5 align-middle" style={{ background: "var(--accent)" }} />
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

                  {!interactive && !booted && <div style={{ opacity: 0.45 }}>initializing shell…</div>}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
