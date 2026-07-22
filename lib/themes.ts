export type ThemeMode = "dark" | "light";

export type Theme = {
  id: string;
  name: string;
  nameFa: string;
  mode: ThemeMode;
  /** [background, foreground, accent] swatch preview */
  swatch: [string, string, string];
  blurb: string;
  blurbFa: string;
};

export const THEMES: Theme[] = [
  // ---- Dark ----------------------------------------------------------------
  {
    id: "carbon",
    name: "Carbon",
    nameFa: "کربن",
    mode: "dark",
    swatch: ["#0b0c0e", "#eef1f4", "#b9ff3a"],
    blurb: "Charcoal + acid lime",
    blurbFa: "زغالی + سبز لیمویی",
  },
  {
    id: "midnight",
    name: "Midnight",
    nameFa: "نیمه‌شب",
    mode: "dark",
    swatch: ["#080d18", "#e6edf7", "#38bdf8"],
    blurb: "Deep navy + sky blue",
    blurbFa: "سرمه‌ای عمیق + آبی آسمانی",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    nameFa: "اوبسیدین",
    mode: "dark",
    swatch: ["#0a0a0f", "#ececf5", "#a78bfa"],
    blurb: "Black glass + violet",
    blurbFa: "شیشهٔ سیاه + بنفش",
  },
  {
    id: "dracula",
    name: "Dracula",
    nameFa: "دراکولا",
    mode: "dark",
    swatch: ["#282a36", "#f8f8f2", "#bd93f9"],
    blurb: "Dusk purple + pink",
    blurbFa: "بنفش غروب + صورتی",
  },
  {
    id: "forest",
    name: "Forest",
    nameFa: "جنگل",
    mode: "dark",
    swatch: ["#0a1310", "#e4f0e9", "#4ade80"],
    blurb: "Pine dark + spring green",
    blurbFa: "کاج تیره + سبز بهاری",
  },
  {
    id: "ocean",
    name: "Ocean",
    nameFa: "اقیانوس",
    mode: "dark",
    swatch: ["#07141c", "#e3f1f7", "#22d3ee"],
    blurb: "Abyssal teal + cyan",
    blurbFa: "فیروزه‌ای ژرف + فیروزه",
  },
  {
    id: "ember",
    name: "Ember",
    nameFa: "اخگر",
    mode: "dark",
    swatch: ["#140c0e", "#f6e7ec", "#fb7185"],
    blurb: "Charcoal + rose flame",
    blurbFa: "زغالی + شعلهٔ گلگون",
  },
  // ---- Light ---------------------------------------------------------------
  {
    id: "paper",
    name: "Paper",
    nameFa: "کاغذ",
    mode: "light",
    swatch: ["#f2eee4", "#1a1611", "#e5432a"],
    blurb: "Warm cream + vermillion",
    blurbFa: "کرم گرم + شنگرف",
  },
  {
    id: "frost",
    name: "Frost",
    nameFa: "یخ",
    mode: "light",
    swatch: ["#eef2f8", "#141a24", "#2563eb"],
    blurb: "Cool white + royal blue",
    blurbFa: "سفید سرد + آبی سلطنتی",
  },
  {
    id: "rose",
    name: "Rose Quartz",
    nameFa: "کوارتز رز",
    mode: "light",
    swatch: ["#f8eef3", "#2a1620", "#db2777"],
    blurb: "Blush pink + magenta",
    blurbFa: "صورتی ملایم + سرخابی",
  },
  {
    id: "sand",
    name: "Sand",
    nameFa: "شن",
    mode: "light",
    swatch: ["#efe9dd", "#241d10", "#b45309"],
    blurb: "Desert sand + amber",
    blurbFa: "شن کویری + کهربایی",
  },
  {
    id: "mint",
    name: "Mint",
    nameFa: "نعنا",
    mode: "light",
    swatch: ["#edf6f0", "#0f1f17", "#059669"],
    blurb: "Fresh mint + emerald",
    blurbFa: "نعنای تازه + زمرد",
  },
];

export const DEFAULT_THEME = "forest";
export const STORAGE_KEY = "saleh-theme";

/** Inline script (runs before paint) — no flash of wrong theme. */
export const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var ok=${JSON.stringify(
  THEMES.map((t) => t.id)
)};if(!t||ok.indexOf(t)<0){t='${DEFAULT_THEME}';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}})();`;
