/**
 * Central content source. Project & history data is derived from Saleh's
 * public GitHub profile: github.com/W2F-Sa
 */

/** Prefix for internal assets/apps (set on GitHub Pages, empty elsewhere). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const profile = {
  name: "Saleh Saghafiani",
  nameFa: "محمدصالح ثقفیانی",
  nickname: "Saleh",
  handle: "@W2F-Sa",
  role: "Software & Network Engineer",
  age: 16,
  activeSince: 2022,
  location: "Iran",
  email: "salehcodez@gmail.com",
  telegram: "dm_saleh",
  telegramUrl: "https://t.me/dm_saleh",
  github: "https://github.com/W2F-Sa",
  githubUser: "W2F-Sa",
  bio: "Self-taught engineer building fast, resilient systems at the edge — from Cloudflare Workers and tunneling infrastructure to cross-platform apps. Writing code that ships since 2022.",
};

/* ------------------------------------------------------------------ */
/* SKILLS — detailed, narrative, with proficiency + evidence          */
/* ------------------------------------------------------------------ */

export type Skill = {
  name: string;
  level: number; // 0-100
  years: string;
  tags: string[];
  summary: string;
  detail: string;
};

export type SkillDomain = {
  key: string;
  title: string;
  tagline: string;
  skills: Skill[];
};

export const domains: SkillDomain[] = [
  {
    key: "edge",
    title: "Edge & Networking",
    tagline: "Where I feel most at home — low-level, fast, and global.",
    skills: [
      {
        name: "Cloudflare Workers",
        level: 92,
        years: "3 yrs",
        tags: ["Workers", "Pages", "Edge runtime", "V8 isolates"],
        summary: "Building full apps and gateways that run entirely at the edge.",
        detail:
          "I've shipped Worker-based gateways (nahan), subscription/config panels (BPB-Worker-Pane) and edge APIs. Comfortable with the Workers runtime model — isolates, streaming responses, the cf request object, KV and cron triggers — and squeezing cold-starts down to nothing.",
      },
      {
        name: "Tunneling & Proxies",
        level: 90,
        years: "4 yrs",
        tags: ["Xray", "V2Ray", "XHTTP", "IP spoofing"],
        summary: "Designing resilient, hard-to-fingerprint transport layers.",
        detail:
          "Deep, hands-on work with Xray/V2Ray cores, XHTTP transports, spoof-tunnels and reverse proxies. I understand the protocol internals (VLESS/VMess/Trojan), fragmentation, TLS fingerprinting and how censorship-resistant transports actually behave on the wire.",
      },
      {
        name: "Linux & Systems",
        level: 85,
        years: "4 yrs",
        tags: ["Bash", "systemd", "VPS", "networking"],
        summary: "The terminal is my default workspace.",
        detail:
          "Daily driver on Linux — writing install scripts, wiring up systemd services, tuning networking, and automating deployments across VPS fleets. If it can be scripted, I script it.",
      },
    ],
  },
  {
    key: "web",
    title: "Web & Product",
    tagline: "Turning systems into interfaces people actually enjoy.",
    skills: [
      {
        name: "TypeScript / JavaScript",
        level: 90,
        years: "3 yrs",
        tags: ["TS", "ESNext", "Node", "tooling"],
        summary: "My primary language across front and back end.",
        detail:
          "Strongly-typed everything. I built the GIOT dashboard and multiple panels in TypeScript, and lean on generics, discriminated unions and strict configs to keep large codebases honest. Just as comfortable in plain modern JS for lightweight apps.",
      },
      {
        name: "React & Next.js",
        level: 86,
        years: "2 yrs",
        tags: ["App Router", "SSG", "Hooks", "RSC"],
        summary: "Component-driven UIs that stay fast on mobile.",
        detail:
          "This very site is Next.js (App Router, static export). I obsess over perceived performance — compositor-only animations, a single IntersectionObserver for reveals, passive listeners — so scrolling never janks, even on a mid-range phone.",
      },
      {
        name: "UI / Interaction Design",
        level: 80,
        years: "2 yrs",
        tags: ["Design systems", "Motion", "CSS", "a11y"],
        summary: "Opinionated layouts, real color theory, tasteful motion.",
        detail:
          "I design as I build: type scales, custom theming, micro-interactions and multi-palette systems. I care that a product has a point of view — not another templated grid of cards.",
      },
    ],
  },
  {
    key: "apps",
    title: "Apps & Cryptography",
    tagline: "From native mobile to end-to-end encrypted messengers.",
    skills: [
      {
        name: "Kotlin / Android",
        level: 74,
        years: "1 yr",
        tags: ["Android SDK", "Kotlin", "networking"],
        summary: "Native mobile clients for real network tooling.",
        detail:
          "Wrote xhttp-app, a native Android client in Kotlin for managing XHTTP transports on the go — background services, config parsing and a clean mobile UX around a gnarly networking problem.",
      },
      {
        name: "Applied Cryptography",
        level: 78,
        years: "2 yrs",
        tags: ["WebCrypto", "AES-GCM", "ECDH", "HMAC"],
        summary: "Layered, end-to-end encryption done in the browser.",
        detail:
          "I build encrypted messengers with the WebCrypto API: multi-layer AES-256-GCM pipelines, HMAC-authenticated envelopes, PBKDF2/ECDH key derivation, ephemeral keys and traffic-analysis padding. Security-by-default UX, no servers in the middle.",
      },
      {
        name: "WebRTC / P2P",
        level: 82,
        years: "2 yrs",
        tags: ["DataChannels", "STUN/ICE", "signalling"],
        summary: "Direct browser-to-browser communication.",
        detail:
          "Peer-to-peer messaging over WebRTC DataChannels — ICE/STUN negotiation, reliable ordered channels, and rendezvous schemes that keep content off any central server.",
      },
    ],
  },
];

/* Flat list for marquees */
export const skills = domains.map((d) => ({
  label: d.title,
  items: d.skills.flatMap((s) => s.tags).slice(0, 6),
}));

/* ------------------------------------------------------------------ */
/* PROJECTS                                                            */
/* ------------------------------------------------------------------ */

export type Project = {
  name: string;
  title: string;
  description: string;
  tags: string[];
  href: string;
  year: string;
  featured?: boolean;
  internal?: boolean;
  accent?: boolean;
};

export const projects: Project[] = [
  {
    name: "Cipher Messenger",
    title: "Cipher — Encrypted Messenger",
    description:
      "One messenger, two modes. P2P mode keeps an encrypted, on-device history; Secret mode is fully ephemeral and stores nothing. Every message runs through a heavy multi-layer encryption pipeline before it leaves the browser.",
    tags: ["WebRTC", "WebCrypto", "P2P", "E2E", "Zero-metadata"],
    href: `${BASE_PATH}/apps/messenger/`,
    year: "2026",
    featured: true,
    internal: true,
    accent: true,
  },
  {
    name: "Dashboard-my.giot.ir",
    title: "GIOT Dashboard",
    description:
      "A TypeScript dashboard for the GIOT platform — user management, live metrics and account controls behind a clean, responsive UI.",
    tags: ["TypeScript", "Dashboard", "Frontend"],
    href: "https://github.com/W2F-Sa/Dashboard-my.giot.ir",
    year: "2026",
    featured: true,
  },
  {
    name: "nahan",
    title: "Nahan Gateway",
    description:
      "A secure, lightweight and customizable network gateway designed to run entirely on Cloudflare Workers at the edge.",
    tags: ["Cloudflare Workers", "Edge", "Gateway"],
    href: "https://github.com/W2F-Sa/nahan",
    year: "2026",
    featured: true,
  },
  {
    name: "xhttp-app",
    title: "XHTTP App",
    description:
      "A native Android client written in Kotlin for managing XHTTP transport configurations on the go.",
    tags: ["Kotlin", "Android", "Networking"],
    href: "https://github.com/W2F-Sa/xhttp-app",
    year: "2026",
  },
  {
    name: "BPB-Worker-Pane",
    title: "BPB Worker Panel",
    description:
      "A GUI panel delivering Worker subscriptions and fragment settings, generating configs for cross-platform clients (sing-box & Xray cores).",
    tags: ["JavaScript", "Cloudflare Workers", "UI"],
    href: "https://github.com/W2F-Sa/BPB-Worker-Pane",
    year: "2024",
  },
  {
    name: "spoof-tunnel",
    title: "Spoof Tunnel",
    description:
      "A client–server tunnel featuring IP spoofing for resilient, hard-to-fingerprint connectivity.",
    tags: ["Networking", "Tunnel", "Systems"],
    href: "https://github.com/W2F-Sa/spoof-tunnel",
    year: "2026",
  },
];

/* ------------------------------------------------------------------ */
/* TIMELINE                                                            */
/* ------------------------------------------------------------------ */

export type TimelineItem = {
  period: string;
  title: string;
  description: string;
};

export const timeline: TimelineItem[] = [
  {
    period: "2022",
    title: "First commits",
    description:
      "Joined GitHub in August 2022 and started shipping open-source networking tools — learning systems programming and the Linux ecosystem entirely hands-on.",
  },
  {
    period: "2023",
    title: "Networking & proxy infrastructure",
    description:
      "Went deep on tunneling and proxy panels (x-ui, 3x-ui, edgetunnel) — V2Ray/Xray cores, subscriptions, fragmentation and edge runtimes.",
  },
  {
    period: "2024",
    title: "Edge computing on Cloudflare",
    description:
      "Shipped BPB-Worker-Pane and Worker-based gateways — GUI panels and config generators running fully on Cloudflare Workers.",
  },
  {
    period: "2025 – 2026",
    title: "Products, apps & cryptography",
    description:
      "Delivered the GIOT dashboard (TypeScript), a native Android client (Kotlin), reseller panels and encrypted P2P messengers — end-to-end product engineering.",
  },
];
