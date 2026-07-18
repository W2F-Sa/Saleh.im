export type Lang = "en" | "fa";

export const LANGS: Lang[] = ["en", "fa"];
export const DEFAULT_LANG: Lang = "en";
export const LANG_KEY = "saleh-lang";

/**
 * Runs before paint. The site always boots in English (LTR) — Persian is
 * available via the in-page toggle but is never restored as the initial
 * language, so every fresh load of the main page starts in English.
 */
export const NO_FLASH_LANG = `(function(){try{document.documentElement.setAttribute('lang','${DEFAULT_LANG}');document.documentElement.setAttribute('dir','ltr');}catch(e){}})();`;

type Dict = {
  nav: { about: string; skills: string; journey: string; work: string; shell: string; contact: string; menu: string; electronics: string; certs: string };
  hero: {
    available: string;
    build: string;
    rotating: string[];
    bio: string;
    seeWork: string;
    sayHello: string;
    est: string;
    stats: { years: string; repos: string; langs: string; curiosity: string };
    ipLabel: string;
    ipResolving: string;
  };
  about: {
    eyebrow: string;
    lead1: string; leadAccent: string; lead2: string; lead3: string;
    p1: string; p2: string;
    since: string;
    glance: { role: string; focus: string; since: string; based: string; status: string; open: string; focusVal: string };
  };
  skills: { eyebrow: string; heading1: string; heading2: string; sub: string };
  electronics: { eyebrow: string; heading1: string; heading2: string; sub: string; hint: string; poweredBy: string };
  certs: { eyebrow: string; heading1: string; heading2: string; sub: string; verify: string; verified: string; issued: string };
  journey: { eyebrow: string; heading: string; range: string };
  projects: { eyebrow: string; heading1: string; heading2: string; all: string; live: string; repoBadge: string };
  shell: { eyebrow: string; heading1: string; heading2: string; sub: string; typeHelp: string; orOpen: string };
  contact: { eyebrow: string; heading1: string; heading2: string; sub: string; cta: string; email: string; telegram: string; github: string; write: string; message: string; follow: string };
  footer: { built: string; top: string };
  theme: { pick: string; dark: string; light: string };
};

const en: Dict = {
  nav: { about: "About", skills: "Skills", journey: "Journey", work: "Work", shell: "Shell", contact: "Contact", menu: "Menu", electronics: "Hardware", certs: "Certificates" },
  hero: {
    available: "Available for freelance",
    build: "I build fast things",
    rotating: ["for the web.", "over WebRTC.", "in the browser.", "in real time.", "with obsession."],
    bio: "Self-taught software engineer crafting fast, elegant products for the web — from real-time collaboration tools to end-to-end encrypted messengers. Shipping in public since 2022.",
    seeWork: "See the work",
    sayHello: "Say hello",
    est: "EST. 2022",
    stats: { years: "Years shipping", repos: "Projects built", langs: "Languages", curiosity: "Curiosity" },
    ipLabel: "your connection",
    ipResolving: "resolving…",
  },
  about: {
    eyebrow: "01 / Who",
    lead1: "I learned to code the hard way — by ",
    leadAccent: "breaking things",
    lead2: ", reading real source code and shipping in public. ",
    lead3: "No copy-paste tutorials.",
    p1: "My favorite work is taking a genuinely hard problem and turning it into something fast and reliable — then wrapping it in an interface that feels effortless. Performance, resilience and craft matter to me on every single screen.",
    p2: "I work across the whole stack — polished React front-ends, real-time back-ends and end-to-end encrypted apps — and I sweat the details most people skip: speed, accessibility, and design that actually has a point of view.",
    since: "shipping since 2022",
    glance: { role: "Role", focus: "Focus", since: "Since", based: "Based", status: "Status", open: "Open to work", focusVal: "Web · Networks · Security" },
  },
  skills: {
    eyebrow: "02 / Capabilities",
    heading1: "What I actually",
    heading2: "know how to do.",
    sub: "Not a wall of logos. Three areas I've shipped real, running software in — tap any skill to read the story behind it.",
  },
  electronics: {
    eyebrow: "03 / Hardware",
    heading1: "Where software",
    heading2: "meets solder.",
    sub: "Software is home, but I've been getting my hands dirty with electronics and PCB design — the board on the right is live: drag it around.",
    hint: "Drag to rotate · hover the parts",
    poweredBy: "Interactive · rendered with CSS 3D",
  },
  certs: {
    eyebrow: "04 / Credentials",
    heading1: "Certificates &",
    heading2: "proof of work.",
    sub: "Courses and programs I've completed. Each one is verifiable — follow the link to check the credential.",
    verify: "Verify",
    verified: "Verified",
    issued: "Issued",
  },
  journey: { eyebrow: "05 / Journey", heading: "The road so far", range: "2022 → today" },
  projects: {
    eyebrow: "06 / Selected work",
    heading1: "Things I've",
    heading2: "built.",
    all: "More on GitHub",
    live: "Runs in your browser",
    repoBadge: "Project",
  },
  shell: {
    eyebrow: "07 / Shell",
    heading1: "Prefer a",
    heading2: "terminal?",
    sub: "A real, interactive shell. It boots on its own — then it's yours.",
    typeHelp: "help",
    orOpen: "open messenger",
  },
  contact: {
    eyebrow: "08 / Contact",
    heading1: "Let's build something",
    heading2: "fast and beautiful.",
    sub: "Open to freelance and collaboration. Telegram or email is the fastest way to reach me — I usually reply within a day.",
    cta: "Start a conversation",
    email: "Email", telegram: "Telegram", github: "GitHub",
    write: "Write", message: "Message", follow: "Follow",
  },
  footer: { built: "Built with Next.js & React.", top: "Top" },
  theme: { pick: "Theme", dark: "Dark", light: "Light" },
};

/* Persian written by a developer, not a translator — real idioms, English
   tech terms kept where devs actually use them (edge, real-time → لایو, …). */
const fa: Dict = {
  nav: { about: "درباره", skills: "بلدی‌ها", journey: "مسیر", work: "کارها", shell: "ترمینال", contact: "تماس", menu: "منو", electronics: "سخت‌افزار", certs: "مدارک" },
  hero: {
    available: "پایه‌ی همکاری‌ام",
    build: "سریع می‌سازم",
    rotating: ["برای وب.", "روی WebRTC.", "توی مرورگر.", "به‌صورت لایو.", "با وسواس."],
    bio: "برنامه‌نویسِ خودآموخته‌ام؛ کارم ساختنِ محصولاتِ سریع و خوش‌ساخت برای وب است — از ابزارهای همکاریِ تیمی تا پیام‌رسان‌های رمزنگاری‌شده. از ۲۰۲۲ کد می‌زنم و کارهایم را متن‌باز منتشر می‌کنم.",
    seeWork: "کارها را ببین",
    sayHello: "سلام کن",
    est: "از ۲۰۲۲",
    stats: { years: "سال تجربه", repos: "پروژه‌ی ساخته‌شده", langs: "زبان برنامه‌نویسی", curiosity: "کنجکاوی" },
    ipLabel: "اتصال شما",
    ipResolving: "در حالِ دریافت…",
  },
  about: {
    eyebrow: "۰۱ / من کی‌ام",
    lead1: "برنامه‌نویسی را از راهِ سخت یاد گرفتم — با ",
    leadAccent: "دستکاری و خراب‌کردن",
    lead2: "، خواندنِ سورسِ پروژه‌های واقعی و انتشارِ عمومیِ کارهایم. ",
    lead3: "نه از روی آموزش‌های حاضری.",
    p1: "بیشتر از همه دوست دارم یک مسئله‌ی واقعاً سخت را بردارم و به چیزی سریع و قابل‌اتکا تبدیلش کنم — بعد هم توی رابطی بپیچمش که کار باهاش انگار هیچ زحمتی ندارد. کارایی، پایداری و تمیزیِ کار توی هر صفحه برایم مهم است.",
    p2: "توی کلِ استک کار می‌کنم — از فرانت‌اندِ تروتمیز با React تا بک‌اند و اپ‌های رمزنگاری‌شده — و روی همان جزئیاتی حساسم که معمولاً ازشان می‌گذرند: سرعت، دسترس‌پذیری، و طراحی‌ای که واقعاً حرفی برای گفتن دارد.",
    since: "از ۲۰۲۲ می‌سازم",
    glance: { role: "نقش", focus: "تمرکز", since: "از سالِ", based: "ساکنِ", status: "وضعیت", open: "پایه‌ی همکاری", focusVal: "وب · شبکه · امنیت" },
  },
  skills: {
    eyebrow: "۰۲ / بلدی‌ها",
    heading1: "کاری که واقعاً",
    heading2: "بلدم انجامش بدهم.",
    sub: "لیستِ لوگو نیست. سه حوزه‌ای که توی هرکدام نرم‌افزارِ واقعی و در حالِ استفاده ساخته‌ام — روی هر مهارت بزن تا داستانش را بخوانی.",
  },
  electronics: {
    eyebrow: "۰۳ / سخت‌افزار",
    heading1: "جایی که نرم‌افزار",
    heading2: "به لحیم می‌رسد.",
    sub: "خانه‌ام نرم‌افزار است، اما تازگی دست‌هایم را با الکترونیک و طراحیِ PCB خاکی کرده‌ام — بردِ کنار زنده است: بچرخانش.",
    hint: "برای چرخاندن بکش · روی قطعات ببر",
    poweredBy: "تعاملی · رندرشده با CSS سه‌بعدی",
  },
  certs: {
    eyebrow: "۰۴ / مدارک",
    heading1: "مدرک‌ها و",
    heading2: "گواهیِ کار.",
    sub: "دوره‌ها و برنامه‌هایی که تمام کرده‌ام. هرکدام قابلِ‌راستی‌آزمایی‌اند — روی لینک بزن تا مدرک را ببینی.",
    verify: "راستی‌آزمایی",
    verified: "تأییدشده",
    issued: "صدور",
  },
  journey: { eyebrow: "۰۵ / مسیر", heading: "راهی که تا اینجا آمده‌ام", range: "۲۰۲۲ تا امروز" },
  projects: {
    eyebrow: "۰۶ / کارهای منتخب",
    heading1: "چیزهایی که",
    heading2: "ساخته‌ام.",
    all: "بیشتر توی گیت‌هاب",
    live: "توی مرورگر اجرا می‌شود",
    repoBadge: "پروژه",
  },
  shell: {
    eyebrow: "۰۷ / ترمینال",
    heading1: "ترمینال را",
    heading2: "ترجیح می‌دهی؟",
    sub: "یک شلِ واقعی و تعاملی. خودش بالا می‌آید — بعدش در اختیارِ توست.",
    typeHelp: "help",
    orOpen: "open messenger",
  },
  contact: {
    eyebrow: "۰۸ / تماس",
    heading1: "بیا چیزی بسازیم که",
    heading2: "هم سریع باشد هم خوشگل.",
    sub: "برای همکاریِ آزاد و پروژه‌های مشترک پایه‌ام. سریع‌ترین راهِ ارتباط، تلگرام یا ایمیل است — معمولاً توی یک روز جواب می‌دهم.",
    cta: "یک پیام بده",
    email: "ایمیل", telegram: "تلگرام", github: "گیت‌هاب",
    write: "بنویس", message: "پیام بده", follow: "دنبال کن",
  },
  footer: { built: "ساخته‌شده با Next.js و React.", top: "بالا" },
  theme: { pick: "پوسته", dark: "تیره", light: "روشن" },
};

export const dict: Record<Lang, Dict> = { en, fa };
