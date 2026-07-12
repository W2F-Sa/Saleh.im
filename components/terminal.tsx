"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Reveal } from "./reveal";
import { profile, projects, skills } from "@/lib/data";

type Line = { type: "out" | "cmd" | "sys"; text: string };

const USER = "saleh";
const HOST = "saleh.im";
const PROMPT = `${USER}@${HOST}:~$`;

const HELP = `Available commands:
  help         show this help
  about        who is Saleh?
  skills       tech stack
  projects     list featured work
  experience   career timeline
  socials      contact & links
  whoami       current user
  neofetch     system info
  date         current date/time
  echo <text>  print text
  clear        clear the screen
  sudo         nice try 😉`;

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
      return skills.map((g) => `${g.label.padEnd(20)} ${g.items.join(", ")}`);
    case "projects":
      return projects
        .filter((p) => p.featured)
        .flatMap((p) => [`• ${p.title}`, `    ${p.description}`, `    ↳ ${p.href}`]);
    case "experience":
    case "exp":
      return [
        "2022  Started on GitHub — open-source networking tools",
        "2023  Proxy / tunneling infrastructure (Xray, V2Ray)",
        "2024  Edge computing on Cloudflare Workers",
        "2025-26  Cross-platform apps, dashboards & secure messengers",
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
    case "neofetch":
      return [
        `${USER}@${HOST}`,
        "-----------------",
        "OS:       SalehOS (Linux x86_64)",
        "Shell:    zsh 5.9",
        "Editor:   nvim / VS Code",
        "Uptime:   since 2022",
        `Langs:    TypeScript, Kotlin, Python, Go`,
        `Cloud:    Cloudflare Workers`,
        "CPU:      caffeine-powered",
      ];
    case "sudo":
      return ["[sudo] password for saleh: ", "Nice try 😉 — you don't have permission for that."];
    case "ls":
      return ["about  skills  projects  experience  socials  secret-chat/  messenger/"];
    case "cat":
      return args.length
        ? [`cat: ${args[0]}: Permission denied (it's a secret 🤫)`]
        : ["usage: cat <file>"];
    case "exit":
      return ["Connection to saleh.im closed."];
    default:
      return [`command not found: ${cmd}. Type 'help' for options.`];
  }
}

const INTRO: { cmd: string; out: string[] }[] = [
  {
    cmd: "whoami",
    out: ["saleh"],
  },
  {
    cmd: "cat welcome.txt",
    out: [
      `Welcome — I'm ${profile.name}.`,
      `${profile.role}, building at the edge since 2022.`,
      "Type 'help' to explore. Try: about, projects, neofetch.",
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

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  // Auto-typing boot sequence — starts once terminal scrolls into view.
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
          const t = setTimeout(() => resolve(), 26 + Math.random() * 40);
          timers.push(t);
        });
        onChar(text.slice(0, i));
      }
    };

    const run = async () => {
      await new Promise<void>((r) => {
        const t = setTimeout(r, 400);
        timers.push(t);
      });
      for (const step of INTRO) {
        // typewriter the command
        let idx = -1;
        setLines((prev) => {
          idx = prev.length;
          return [...prev, { type: "cmd", text: "" }];
        });
        await type(step.cmd, (partial) => {
          setLines((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { type: "cmd", text: partial };
            return copy;
          });
        });
        await new Promise<void>((r) => {
          const t = setTimeout(r, 220);
          timers.push(t);
        });
        // print output
        setLines((prev) => [
          ...prev,
          ...step.out.map((o) => ({ type: "out" as const, text: o })),
        ]);
        await new Promise<void>((r) => {
          const t = setTimeout(r, 380);
          timers.push(t);
        });
      }
      if (!cancelled) {
        setLines((prev) => [
          ...prev,
          { type: "sys", text: "— shell ready. type a command —" },
        ]);
        setInteractive(true);
      }
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [booted]);

  const submit = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      setLines((prev) => [...prev, { type: "cmd", text: raw }]);
      if (cmd) setHistory((h) => [...h, cmd]);
      setHistIdx(-1);

      if (cmd.toLowerCase() === "clear") {
        setLines([]);
        return;
      }
      const out = runCommand(raw);
      if (out.length) {
        setLines((prev) => [...prev, ...out.map((o) => ({ type: "out" as const, text: o }))]);
      }
    },
    []
  );

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
    <section id="terminal" ref={sectionRef} className="scroll-mt-20 py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <span className="section-label">06 — Terminal</span>
          <h2 className="heading-lg max-w-3xl">
            Prefer a shell?{" "}
            <span className="text-[var(--fg-muted)]">Talk to my machine.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[var(--fg-muted)]">
            A real, interactive terminal. It boots on its own — then it&apos;s yours.
            Type <code className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 font-mono text-sm">help</code> to begin.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div
            className="mt-8 overflow-hidden rounded-xl border shadow-2xl"
            style={{ borderColor: "rgba(74,222,128,0.25)", background: "#0b0f0b" }}
            onClick={() => inputRef.current?.focus()}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between border-b border-[rgba(74,222,128,0.15)] px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/90" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/90" />
                <span className="h-3 w-3 rounded-full bg-green-500/90" />
              </div>
              <span className="font-mono text-xs text-emerald-400/70">
                {USER}@{HOST}: ~ — bash
              </span>
              <span className="w-12" />
            </div>

            {/* Screen */}
            <div
              ref={scrollRef}
              className="h-[360px] overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed sm:text-sm"
              style={{ color: "#4ade80", scrollbarWidth: "thin" }}
            >
              {lines.map((line, i) => {
                if (line.type === "cmd") {
                  return (
                    <div key={i} className="flex gap-2 whitespace-pre-wrap break-words">
                      <span className="shrink-0 text-emerald-500/80">{PROMPT}</span>
                      <span className="text-emerald-300">{line.text}</span>
                    </div>
                  );
                }
                if (line.type === "sys") {
                  return (
                    <div key={i} className="my-1 whitespace-pre-wrap break-words text-emerald-500/50">
                      {line.text}
                    </div>
                  );
                }
                return (
                  <div key={i} className="whitespace-pre-wrap break-words text-emerald-400/90">
                    {line.text}
                  </div>
                );
              })}

              {/* Live input line */}
              {interactive && (
                <div className="flex gap-2">
                  <span className="shrink-0 text-emerald-500/80">{PROMPT}</span>
                  <span className="relative flex-1">
                    <span className="whitespace-pre-wrap break-words text-emerald-300">
                      {value}
                    </span>
                    <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-blink bg-emerald-400 align-middle" />
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

              {!interactive && !booted && (
                <div className="text-emerald-500/50">initializing shell…</div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
