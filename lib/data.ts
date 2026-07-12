/**
 * Central content source for the portfolio.
 * All project data is derived from Saleh's public GitHub profile: github.com/W2F-Sa
 */

export const profile = {
  name: "Saleh Saghafiani",
  nameFa: "محمدصالح ثقفیانی",
  nickname: "Saleh",
  handle: "@W2F-Sa",
  role: "Software & Network Engineer",
  roleFa: "مهندس نرم‌افزار و شبکه",
  age: 16,
  activeSince: 2022,
  location: "Iran",
  email: "salehcodez@gmail.com",
  telegram: "dm_saleh",
  telegramUrl: "https://t.me/dm_saleh",
  github: "https://github.com/W2F-Sa",
  githubUser: "W2F-Sa",
  bio: "Self-taught engineer building fast, resilient systems at the edge — from Cloudflare Workers and tunneling infrastructure to cross-platform apps. Writing code that ships since 2022.",
  bioFa: "برنامه‌نویس خودآموخته با تمرکز روی سیستم‌های سریع و مقاوم در لبه‌ی شبکه — از Cloudflare Workers و زیرساخت تونلینگ تا اپلیکیشن‌های چندسکویی. از سال ۲۰۲۲ در حال کدنویسی و انتشار.",
};

export type Project = {
  name: string;
  title: string;
  description: string;
  tags: string[];
  href: string;
  year: string;
  featured?: boolean;
  internal?: boolean;
};

/** Real repositories from github.com/W2F-Sa plus the two apps shipped in this repo. */
export const projects: Project[] = [
  {
    name: "P2P Messenger",
    title: "P2P Messenger",
    description:
      "A serverless, peer-to-peer messenger with username/password sign-in. Messages travel directly between browsers over WebRTC DataChannels — no central server ever sees the traffic.",
    tags: ["WebRTC", "P2P", "E2E", "TypeScript"],
    href: "/apps/messenger/",
    year: "2026",
    featured: true,
    internal: true,
  },
  {
    name: "Secret Chat",
    title: "Secret Chat — Triple-Layer E2EE",
    description:
      "An anti-surveillance secure chat using a 3-stage encryption pipeline (ECDH → AES-256-GCM → ChaCha20-style stream → HMAC). Ephemeral keys, zero metadata, self-destructing sessions.",
    tags: ["Cryptography", "WebCrypto", "Zero-metadata", "Security"],
    href: "/apps/secret-chat/",
    year: "2026",
    featured: true,
    internal: true,
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
    name: "xhttp-app",
    title: "XHTTP App",
    description:
      "A native Android client written in Kotlin for managing XHTTP transport configurations on the go.",
    tags: ["Kotlin", "Android", "Networking"],
    href: "https://github.com/W2F-Sa/xhttp-app",
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
  {
    name: "MyPanel-hamcari",
    title: "Hamcari Reseller Panel",
    description:
      "A JavaScript reseller/management panel with account provisioning and traffic controls.",
    tags: ["JavaScript", "Panel", "Full-stack"],
    href: "https://github.com/W2F-Sa/MyPanel-hamcari",
    year: "2026",
  },
];

export type SkillGroup = {
  label: string;
  items: string[];
};

export const skills: SkillGroup[] = [
  {
    label: "Languages",
    items: ["TypeScript", "JavaScript", "Kotlin", "Python", "Go", "Bash"],
  },
  {
    label: "Frontend",
    items: ["React", "Next.js", "Tailwind CSS", "HTML5 / CSS3", "Web APIs"],
  },
  {
    label: "Edge & Backend",
    items: ["Cloudflare Workers", "Serverless", "Node.js", "REST APIs", "WebRTC"],
  },
  {
    label: "Networking & Infra",
    items: ["Tunneling", "Proxies", "Xray / V2Ray", "Linux", "Git / CI-CD"],
  },
];

export type TimelineItem = {
  period: string;
  title: string;
  description: string;
};

export const timeline: TimelineItem[] = [
  {
    period: "2022",
    title: "Started on GitHub",
    description:
      "Joined GitHub in August 2022 and began shipping open-source networking tools, learning systems programming and the Linux ecosystem hands-on.",
  },
  {
    period: "2023",
    title: "Networking & Proxy Infrastructure",
    description:
      "Built and forked tunneling / proxy panels (x-ui, 3x-ui, edgetunnel) — deep dive into V2Ray/Xray cores, subscriptions and edge runtimes.",
  },
  {
    period: "2024",
    title: "Edge Computing on Cloudflare",
    description:
      "Shipped BPB-Worker-Pane and Worker-based gateways — designing GUI panels and config generators that run fully on Cloudflare Workers.",
  },
  {
    period: "2025 – 2026",
    title: "Cross-Platform Apps & Products",
    description:
      "Delivered the GIOT dashboard (TypeScript), a native Android client (Kotlin), reseller panels and secure tunneling apps — end-to-end product engineering.",
  },
];
