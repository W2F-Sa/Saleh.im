import type { Lang } from "./i18n";

/** Prefix for internal assets/apps (set on GitHub Pages, empty elsewhere). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Bilingual string helper type. */
export type L10n = { en: string; fa: string };
export const pick = (s: L10n, lang: Lang) => s[lang];

export const profile = {
  name: { en: "Saleh Saghafiani", fa: "محمدصالح ثقفیانی" } as L10n,
  nickname: { en: "Saleh", fa: "صالح" } as L10n,
  handle: "@im-saleh",
  role: { en: "Software Engineer & Product Builder", fa: "مهندس نرم‌افزار و سازنده‌ی محصول" } as L10n,
  activeSince: 2022,
  location: { en: "Iran", fa: "ایران" } as L10n,
  email: "salehcodez@gmail.com",
  telegram: "dm_saleh",
  telegramUrl: "https://t.me/dm_saleh",
  github: "https://github.com/im-saleh",
  githubUser: "im-saleh",
};

/* ------------------------------------------------------------------ */
/* SKILLS                                                             */
/* ------------------------------------------------------------------ */

export type Skill = {
  name: L10n;
  level: number;
  years: L10n;
  tags: string[];
  summary: L10n;
  detail: L10n;
};

export type SkillDomain = {
  key: string;
  title: L10n;
  tagline: L10n;
  skills: Skill[];
};

export const domains: SkillDomain[] = [
  {
    key: "frontend",
    title: { en: "Frontend & Product", fa: "فرانت‌اند و محصول" },
    tagline: {
      en: "Turning ideas into interfaces people actually enjoy using.",
      fa: "تبدیل ایده‌ها به رابط‌هایی که مردم واقعاً از کار با آن‌ها لذت می‌برند.",
    },
    skills: [
      {
        name: { en: "React & Next.js", fa: "ری‌اکت و Next.js" },
        level: 92,
        years: { en: "4 yrs", fa: "۴ سال" },
        tags: ["App Router", "RSC", "SSG", "Hooks"],
        summary: {
          en: "Component-driven UIs that stay fast on any device.",
          fa: "رابط‌های کامپوننت‌محور که روی هر دستگاهی سریع می‌مانند.",
        },
        detail: {
          en: "This very site is Next.js (App Router, static export). I obsess over perceived performance — compositor-only animations, a single IntersectionObserver for reveals, passive listeners — so scrolling never janks, even on a mid-range phone.",
          fa: "همین سایت با Next.js ساخته شده (App Router و خروجی استاتیک). روی «حسِ سرعت» وسواس دارم — انیمیشن‌های صرفاً کامپوزیتوری، یک IntersectionObserver واحد برای نمایش، و لیسنرهای passive — تا اسکرول حتی روی گوشی میان‌رده هم لَگ نزند.",
        },
      },
      {
        name: { en: "TypeScript", fa: "تایپ‌اسکریپت" },
        level: 90,
        years: { en: "4 yrs", fa: "۴ سال" },
        tags: ["Generics", "Strict", "ESNext", "DX"],
        summary: {
          en: "Type-safe apps, front to back.",
          fa: "اپ‌های امن از نظر تایپ، از فرانت تا بک.",
        },
        detail: {
          en: "Strongly-typed everything. I lean on generics, discriminated unions and strict configs to keep large codebases honest — and to make refactors fearless instead of frightening.",
          fa: "همه‌چیز کاملاً تایپ‌دار. از جنریک‌ها، یونیون‌های تفکیک‌شده و کانفیگ سخت‌گیرانه استفاده می‌کنم تا کدبیس‌های بزرگ درست بمانند و ری‌فکتور به‌جای ترس، بی‌دغدغه باشد.",
        },
      },
      {
        name: { en: "UI & Motion Design", fa: "طراحی رابط و حرکت" },
        level: 82,
        years: { en: "3 yrs", fa: "۳ سال" },
        tags: ["Design systems", "Motion", "CSS", "a11y"],
        summary: {
          en: "Opinionated layouts, real color theory, tasteful motion.",
          fa: "چیدمان‌های دیدگاه‌دار، رنگ‌شناسی واقعی، و حرکت باسلیقه.",
        },
        detail: {
          en: "I design as I build: type scales, custom theming, multi-language systems and micro-interactions. A product should have a point of view — not be another templated grid of cards.",
          fa: "همزمان با ساختن، طراحی می‌کنم: مقیاس تایپوگرافی، پوسته‌ی سفارشی، سیستم چندزبانه و ریز-تعامل‌ها. یک محصول باید دیدگاه داشته باشد — نه اینکه گریدِ تکراریِ دیگری از کارت‌ها باشد.",
        },
      },
    ],
  },
  {
    key: "realtime",
    title: { en: "Real-time & Backend", fa: "لایو و بک‌اند" },
    tagline: {
      en: "Systems that move data fast, reliably, and at scale.",
      fa: "سیستم‌هایی که داده را سریع، قابل‌اعتماد و در مقیاس جابه‌جا می‌کنند.",
    },
    skills: [
      {
        name: { en: "Node.js & APIs", fa: "Node.js و APIها" },
        level: 85,
        years: { en: "3 yrs", fa: "۳ سال" },
        tags: ["REST", "Edge", "Serverless", "Auth"],
        summary: {
          en: "Clean, fast services and well-shaped APIs.",
          fa: "سرویس‌های تمیز و سریع و APIهای خوش‌ساخت.",
        },
        detail: {
          en: "I build REST and edge/serverless services with sensible boundaries, caching and auth — APIs that are pleasant to consume and hard to misuse.",
          fa: "سرویس‌های REST و edge/serverless می‌سازم با مرزهای منطقی، کش و احراز هویت — APIهایی که کار با آن‌ها لذت‌بخش است و به‌سختی می‌شود اشتباه استفاده‌شان کرد.",
        },
      },
      {
        name: { en: "WebRTC & WebSockets", fa: "WebRTC و WebSocket" },
        level: 84,
        years: { en: "2 yrs", fa: "۲ سال" },
        tags: ["DataChannels", "STUN/ICE", "Realtime", "P2P"],
        summary: {
          en: "Live, peer-to-peer and collaborative experiences.",
          fa: "تجربه‌های لایو، همتا‌به‌همتا و مشارکتی.",
        },
        detail: {
          en: "Direct browser-to-browser communication over WebRTC DataChannels — ICE/STUN negotiation, reliable ordered channels and rendezvous schemes — plus WebSocket back-ends for live, collaborative UIs.",
          fa: "ارتباط مستقیم مرورگر‌به‌مرورگر روی DataChannelهای WebRTC — مذاکره‌ی ICE/STUN، کانال‌های مرتب و قابل‌اعتماد و طرح‌های ملاقات — به‌همراه بک‌اند WebSocket برای رابط‌های لایو و مشارکتی.",
        },
      },
      {
        name: { en: "Databases & Caching", fa: "پایگاه‌داده و کش" },
        level: 78,
        years: { en: "3 yrs", fa: "۳ سال" },
        tags: ["SQL", "Modeling", "Redis", "Performance"],
        summary: {
          en: "Data modeling that keeps apps fast under load.",
          fa: "مدل‌سازی داده که اپ را زیر بار سریع نگه می‌دارد.",
        },
        detail: {
          en: "Thoughtful schemas, the right indexes and caching layers so reads stay instant and writes stay safe as an app grows.",
          fa: "اسکیمای سنجیده، ایندکس‌های درست و لایه‌های کش تا خواندن‌ها آنی بمانند و نوشتن‌ها با رشد اپ امن باقی بمانند.",
        },
      },
    ],
  },
  {
    key: "craft",
    title: { en: "Craft & Security", fa: "ظرافت و امنیت" },
    tagline: {
      en: "The details that separate a demo from a real product.",
      fa: "جزئیاتی که یک دموی ساده را از یک محصول واقعی جدا می‌کند.",
    },
    skills: [
      {
        name: { en: "Applied Cryptography", fa: "رمزنگاری کاربردی" },
        level: 80,
        years: { en: "2 yrs", fa: "۲ سال" },
        tags: ["WebCrypto", "AES-GCM", "ECDH", "HMAC"],
        summary: {
          en: "Layered end-to-end encryption, done in the browser.",
          fa: "رمزنگاری سرتاسریِ چندلایه، انجام‌شده در مرورگر.",
        },
        detail: {
          en: "I build encrypted apps with the WebCrypto API: multi-layer AES-256-GCM pipelines, HMAC-authenticated envelopes, ECDH/PBKDF2 key derivation, ephemeral keys and traffic-analysis padding. Security by default — no servers in the middle.",
          fa: "اپ‌های رمزنگاری‌شده را با WebCrypto می‌سازم: خطوط چندلایه‌ی AES-256-GCM، پاکت‌های احرازشده با HMAC، اشتقاق کلید با ECDH/PBKDF2، کلیدهای موقتی و پدینگ ضد تحلیل‌ترافیک. امنیت به‌صورت پیش‌فرض — بدون سروری در میانه.",
        },
      },
      {
        name: { en: "Performance Engineering", fa: "مهندسی کارایی" },
        level: 86,
        years: { en: "3 yrs", fa: "۳ سال" },
        tags: ["60fps", "Core Web Vitals", "Profiling"],
        summary: {
          en: "Fast first paint, smooth scroll, tiny bundles.",
          fa: "رنگ اولیه‌ی سریع، اسکرول نرم، و باندل‌های کوچک.",
        },
        detail: {
          en: "I profile before I optimize — trimming bundles, deferring work, using the GPU for animation and keeping interactions at 60fps on real, mid-range hardware.",
          fa: "قبل از بهینه‌سازی پروفایل می‌گیرم — کوچک‌کردن باندل، به‌تعویق‌انداختن کارها، استفاده از GPU برای انیمیشن و نگه‌داشتن تعامل‌ها روی ۶۰fps روی سخت‌افزار واقعی و میان‌رده.",
        },
      },
      {
        name: { en: "Tooling & DX", fa: "ابزار و تجربه‌ی توسعه" },
        level: 80,
        years: { en: "3 yrs", fa: "۳ سال" },
        tags: ["CI/CD", "Git", "Linux", "Automation"],
        summary: {
          en: "Automating the boring parts so shipping stays fun.",
          fa: "خودکارسازیِ بخش‌های خسته‌کننده تا انتشار لذت‌بخش بماند.",
        },
        detail: {
          en: "I live in the terminal — writing scripts, wiring up CI/CD pipelines and build tooling so the path from commit to production is short, safe and repeatable.",
          fa: "در ترمینال زندگی می‌کنم — نوشتن اسکریپت، راه‌اندازی خطوط CI/CD و ابزار بیلد تا مسیر از کامیت تا پروداکشن کوتاه، امن و تکرارپذیر باشد.",
        },
      },
    ],
  },
];

export const marqueeTags: string[] = [
  "React", "Next.js", "TypeScript", "Node.js", "WebRTC", "WebCrypto",
  "Design Systems", "Performance", "Real-time", "CI/CD",
];

/* ------------------------------------------------------------------ */
/* PROJECTS                                                           */
/* ------------------------------------------------------------------ */

export type Project = {
  name: string;
  title: L10n;
  description: L10n;
  tags: string[];
  href: string;
  year: string;
  featured?: boolean;
  internal?: boolean;
  accent?: boolean;
};

export const projects: Project[] = [
  {
    name: "Vanguard",
    title: { en: "Vanguard — Browser FPS", fa: "ونگارد — تیراندازِ اولِ‌شخصِ مرورگری" },
    description: {
      en: "A CoD-style first-person shooter that runs entirely in the browser on a hand-written raycast engine — no WebGL, no downloads. Eleven hitscan weapons, eight large maps, an eight-mission campaign, bots across five difficulty tiers (with an auto-play mode that lets the same brain pilot you), and true peer-to-peer online matches over WebRTC with zero relay/game server in the middle.",
      fa: "یک تیراندازِ اولِ‌شخصِ کالاف‌محور که کاملاً در مرورگر و روی یک موتورِ ریِ‌کاست دست‌نویس اجرا می‌شود — بدونِ WebGL و بدونِ دانلود. یازده اسلحه‌ی hitscan، هشت نقشه‌ی بزرگ، کمپینِ هشت‌ماموریتی، بات‌ها در پنج سطحِ دشواری (به‌همراهِ حالتِ خودبازی که همان مغزِ هوش‌مصنوعی تو را هم هدایت می‌کند)، و بازیِ آنلاینِ واقعاً همتا‌به‌همتا روی WebRTC بدونِ هیچ سروری در میانه.",
    },
    tags: ["Raycaster", "Canvas", "WebRTC P2P", "Bots", "FPS"],
    href: `${BASE_PATH}/vanguard/`,
    year: "2026",
    featured: true,
    internal: true,
    accent: true,
  },
  {
    name: "Rift",
    title: { en: "Rift — Neon Arena Survival", fa: "ریفت — بقا در آوردگاهِ نئونی" },
    description: {
      en: "A fast, smooth browser game built on a hand-written Canvas engine — action meets strategy. Defend the Core, auto-blast escalating waves, collect salvage, spend it on a deep pool of upgrades, deploy sentry turrets and topple a boss at the end of every one of five sectors. 60fps particles, screen-shake and neon glow that adapt to the active theme.",
      fa: "یک بازیِ مرورگریِ سریع و روان روی موتورِ Canvasِ دست‌نویس — تلاقیِ اکشن و استراتژی. از هسته دفاع کن، موج‌های فزاینده را منهدم کن، اسکراپ جمع کن و صرفِ ارتقاهای عمیق کن، توپخانه‌ی نگهبان مستقر کن و در پایانِ هرکدام از پنج سکتور یک باس را شکست بده. ذراتِ ۶۰fps، لرزشِ صفحه و درخششِ نئونی هماهنگ با پوسته‌ی فعال.",
    },
    tags: ["Canvas", "Game engine", "60fps", "Action", "Strategy"],
    href: `${BASE_PATH}/rift/`,
    year: "2026",
    featured: true,
    internal: true,
    accent: true,
  },
  {
    name: "Forge",
    title: { en: "Forge — Developer Toolbox", fa: "فورج — جعبه‌ابزار توسعه‌دهنده" },
    description: {
      en: "A fast, private developer toolbox with 70+ tools in one place — JSON / CSV / TypeScript, Base64 / Base32 / URL / HTML / JWT, AES-256 encryption, hashing, UUID·ULID·password·mock-data generators, a colour studio with WCAG contrast, regex tester, cron explainer, CIDR / subnet calculator, cURL→fetch, timestamp / number-base / unit converters, CSS gradient·shadow·bezier generators, diff, markdown and much more. Everything runs locally in the browser — nothing is uploaded.",
      fa: "یک جعبه‌ابزارِ سریع و خصوصیِ توسعه‌دهنده با بیش از ۷۰ ابزار در یک‌جا — JSON/CSV/TypeScript، Base64/Base32/URL/HTML/JWT، رمزنگاریِ AES-256، هش، سازنده‌ی UUID·ULID·رمز·دادهٔ آزمایشی، استودیوی رنگ با کنتراستِ WCAG، تسترِ regex، توضیح‌دهنده‌ی cron، محاسبه‌گرِ CIDR/زیرشبکه، cURL→fetch، مبدل‌های زمان/مبنا/واحد، سازنده‌های گرادیان·سایه·بزیهِ CSS، دیف، مارک‌داون و بسیار بیشتر. همه‌چیز به‌صورت محلی در مرورگر اجرا می‌شود.",
    },
    tags: ["React", "TypeScript", "Web APIs", "70+ tools", "DX"],
    href: `${BASE_PATH}/forge/`,
    year: "2026",
    featured: true,
    internal: true,
    accent: true,
  },
  {
    name: "Cipher",
    title: { en: "Cipher — Encrypted Messenger", fa: "سایفر — پیام‌رسان رمزنگاری‌شده" },
    description: {
      en: "A serverless, peer-to-peer messenger built in React. ECDH key exchange, a 4-layer encryption pipeline, on-device encrypted history, typing indicators, image sharing and read receipts — messages travel directly browser-to-browser and never touch a server.",
      fa: "یک پیام‌رسانِ همتا‌به‌همتا و بدونِ سرور، ساخته‌شده با React. تبادل کلید ECDH، خطِ رمزنگاریِ ۴ لایه، تاریخچه‌ی رمزنگاری‌شده روی دستگاه، نشانگرِ در حال نوشتن، ارسال تصویر و رسیدِ خواندن — پیام‌ها مستقیم بین مرورگرها جابه‌جا می‌شوند و هیچ‌وقت به سروری نمی‌رسند.",
    },
    tags: ["React", "WebRTC", "WebCrypto", "P2P", "E2E"],
    href: `${BASE_PATH}/messenger/`,
    year: "2026",
    featured: true,
    internal: true,
    accent: true,
  },
  {
    name: "Aperture",
    title: { en: "Aperture — Collaborative Canvas", fa: "آپرچر — بوم مشارکتی" },
    description: {
      en: "A real-time collaborative whiteboard where cursors, shapes and notes sync instantly across everyone in the room — built on WebRTC and a CRDT so edits never conflict, even offline.",
      fa: "یک وایت‌بوردِ مشارکتیِ لایو که در آن مکان‌نماها، اشکال و یادداشت‌ها بلافاصله بین همه‌ی افراد اتاق هم‌گام می‌شوند — روی WebRTC و یک CRDT ساخته شده تا ویرایش‌ها هیچ‌وقت تداخل نکنند، حتی آفلاین.",
    },
    tags: ["WebRTC", "CRDT", "Canvas", "Realtime"],
    href: `${BASE_PATH}/aperture/`,
    year: "2025",
    internal: true,
  },
  {
    name: "Prism",
    title: { en: "Prism — Headless UI Kit", fa: "پریزم — کیت رابط بی‌سر" },
    description: {
      en: "A headless React component library and design-system toolkit: accessible primitives, a token-driven theming engine and zero-runtime styling — the foundation I reach for on every new product.",
      fa: "یک کتابخانه‌ی کامپوننتِ Reactِ بی‌سر و جعبه‌ابزارِ دیزاین‌سیستم: المان‌های پایه‌ی دسترس‌پذیر، موتورِ تمِ مبتنی بر توکن و استایلِ بدونِ رانتایم — پایه‌ای که برای هر محصولِ جدید سراغش می‌روم.",
    },
    tags: ["React", "Design System", "a11y", "Tokens"],
    href: `${BASE_PATH}/prism/`,
    year: "2025",
    internal: true,
  },
  {
    name: "Lumen",
    title: { en: "Lumen — Live Markets Dashboard", fa: "لومن — داشبورد بازار زنده" },
    description: {
      en: "A real-time markets dashboard pulling live data from the CoinGecko API — animated area charts, KPI counters, a market-sentiment gauge, a dominance donut and a sortable table with live sparklines. Real data, buttery-smooth, built in React.",
      fa: "یک داشبورد بازارِ زنده که داده‌ی واقعی را از API کوین‌گکو می‌گیرد — نمودارهای مساحتیِ متحرک، شمارنده‌های KPI، گیجِ احساسِ بازار، دوناتِ سلطه و جدولِ زنده با اسپارک‌لاین. داده‌ی واقعی، کاملاً روان، ساخته‌شده با React.",
    },
    tags: ["React", "Data-viz", "Live API", "Charts"],
    href: `${BASE_PATH}/lumen/`,
    year: "2026",
    internal: true,
  },
  {
    name: "Probe",
    title: { en: "Probe — Connection Inspector", fa: "پروب — بازرسِ اتصال" },
    description: {
      en: "A live connection & privacy inspector that runs entirely in your browser: public IP + geo from the edge, real WebRTC candidate gathering (local-IP leak detection), live latency probes to global endpoints, the Network Information API and a device fingerprint surface — with a privacy score. All real, nothing stored.",
      fa: "یک بازرسِ اتصال و حریمِ خصوصی که کاملاً در مرورگرِ تو اجرا می‌شود: آی‌پیِ عمومی و موقعیت از لبه، جمع‌آوریِ واقعیِ کاندیداهای WebRTC (تشخیصِ افشای آی‌پیِ محلی)، سنجشِ زنده‌ی تأخیر تا سرورهای جهانی، Network Information API و سطحِ اثرانگشتِ دستگاه — به‌همراه امتیازِ حریمِ خصوصی. همه واقعی، بدونِ ذخیره‌سازی.",
    },
    tags: ["WebRTC", "Networking", "Privacy", "Web APIs"],
    href: `${BASE_PATH}/probe/`,
    year: "2026",
    internal: true,
  },
  {
    name: "Vault",
    title: { en: "Vault — Zero-Knowledge Manager", fa: "والت — مدیرِ رازِ بدونِ دانش" },
    description: {
      en: "A zero-knowledge secret manager — as a native C++ Linux app (Qt6 + libsodium) with Argon2id + XChaCha20-Poly1305, an optional keyfile, a system tray, auto-lock and clipboard wipe, plus a browser version. RFC-6238 authenticator, cryptographic generator and offline security audit. The master password never leaves the device.",
      fa: "یک مدیرِ رازِ بدونِ دانش — به‌صورتِ اپِ بومیِ لینوکس با ++C (Qt6 و libsodium)، با Argon2id و XChaCha20-Poly1305، کلیدفایلِ اختیاری، سینی سیستم، قفلِ خودکار و پاک‌سازیِ کلیپ‌بورد؛ به‌همراهِ نسخه‌ی مرورگری. احرازگرِ RFC-6238، سازنده‌ی رمز و ممیزیِ امنیتیِ آفلاین. رمزِ اصلی هیچ‌وقت دستگاه را ترک نمی‌کند.",
    },
    tags: ["C++ / Qt6", "libsodium", "Argon2id", "TOTP", "Linux"],
    href: `${BASE_PATH}/vault/`,
    year: "2026",
    featured: true,
    internal: true,
    accent: true,
  },
  {
    name: "Relay",
    title: { en: "Relay — Event Router", fa: "ری‌لِی — مسیریابِ رویداد" },
    description: {
      en: "A self-hostable webhook and automation router: receive events, transform and fan them out to any destination with retries, signing and a clean visual pipeline builder.",
      fa: "یک مسیریابِ وب‌هوک و اتوماسیونِ سلف‌هاست: رویداد می‌گیرد، تبدیلش می‌کند و با retry و امضا به هر مقصدی می‌فرستد — با یک سازنده‌ی خط لوله‌ی بصریِ تمیز.",
    },
    tags: ["Node.js", "Webhooks", "Queues", "TypeScript"],
    href: `${BASE_PATH}/relay/`,
    year: "2024",
    internal: true,
  },
  {
    name: "Pulse",
    title: { en: "Pulse — Status & Uptime", fa: "پالس — وضعیت و آپ‌تایم" },
    description: {
      en: "A beautiful status page and uptime monitor: multi-region checks, incident timelines, latency graphs and instant alerts — with a public page your users will actually trust.",
      fa: "یک صفحه‌ی وضعیت و مانیتورِ آپ‌تایمِ زیبا: بررسی از چند منطقه، خط‌زمانِ رخدادها، نمودارِ تأخیر و هشدارِ آنی — با یک صفحه‌ی عمومی که کاربرانت واقعاً بهش اعتماد می‌کنند.",
    },
    tags: ["Monitoring", "Charts", "Alerts", "Edge"],
    href: `${BASE_PATH}/pulse/`,
    year: "2024",
    internal: true,
  },
  {
    name: "Nota",
    title: { en: "Nota — Knowledge Base", fa: "نوتا — پایگاهِ دانش" },
    description: {
      en: "An offline-first, markdown-native notes app with instant full-text search, bidirectional links and end-to-end encrypted sync across devices.",
      fa: "یک اپِ یادداشتِ آفلاین‌محور و مبتنی بر مارک‌داون، با جست‌وجوی متنِ کاملِ آنی، لینک‌های دوطرفه و هم‌گام‌سازیِ رمزنگاری‌شده‌ی سرتاسری بین دستگاه‌ها.",
    },
    tags: ["Offline-first", "Markdown", "Search", "Sync"],
    href: `${BASE_PATH}/nota/`,
    year: "2023",
    internal: true,
  },
];

/* ------------------------------------------------------------------ */
/* TIMELINE                                                           */
/* ------------------------------------------------------------------ */

export type TimelineItem = {
  period: string;
  title: L10n;
  description: L10n;
};

export const timeline: TimelineItem[] = [
  {
    period: "2022",
    title: { en: "First commits", fa: "اولین کامیت‌ها" },
    description: {
      en: "Started building open-source and personal projects — learning systems, the web platform and Linux entirely by shipping, not by following tutorials.",
      fa: "شروع به ساختن پروژه‌های متن‌باز و شخصی کردم — یادگیری سیستم‌ها، پلتفرم وب و لینوکس کاملاً از راه ساختن، نه دنبال‌کردن آموزش.",
    },
  },
  {
    period: "2023",
    title: { en: "Full-stack foundations", fa: "بنیان‌های فول‌استک" },
    description: {
      en: "Went deep on TypeScript and React, and shipped real products end to end — from data model to polished, responsive UI.",
      fa: "روی تایپ‌اسکریپت و ری‌اکت عمیق شدم و محصولات واقعی را سرتاسر ساختم — از مدل داده تا رابط کاربریِ صیقلی و ریسپانسیو.",
    },
  },
  {
    period: "2024",
    title: { en: "Real-time & systems", fa: "لایو و سیستم‌ها" },
    description: {
      en: "Focused on real-time experiences — WebRTC, streaming data and WebSockets — and on performance work that keeps larger apps fast.",
      fa: "روی تجربه‌های لایو تمرکز کردم — WebRTC، داده‌ی جاری و WebSocket — و روی کارِ کارایی که اپ‌های بزرگ‌تر را سریع نگه می‌دارد.",
    },
  },
  {
    period: "2025 – 2026",
    title: { en: "Products & cryptography", fa: "محصولات و رمزنگاری" },
    description: {
      en: "Delivering polished products end to end — encrypted messengers, design systems and collaborative tools — with security and craft baked in from the start.",
      fa: "تحویل محصولات صیقلی به‌صورت سرتاسری — پیام‌رسان‌های رمزنگاری‌شده، سیستم‌های طراحی و ابزارهای مشارکتی — با امنیت و ظرافتِ نهادینه‌شده از همان ابتدا.",
    },
  },
];
