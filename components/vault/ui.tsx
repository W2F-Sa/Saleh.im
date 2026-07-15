"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/* ============================================================================
   Vault — shared UI primitives, icon set, and the bilingual string table.
   Kept in one place so the app surface stays visually consistent and the two
   languages never drift apart.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Icons — a compact, stroke-based set drawn to match the site's aesthetic.
   ------------------------------------------------------------------------ */

export type IconName =
  | "lock"
  | "unlock"
  | "key"
  | "card"
  | "note"
  | "id"
  | "shield"
  | "plus"
  | "search"
  | "copy"
  | "check"
  | "eye"
  | "eye-off"
  | "trash"
  | "edit"
  | "star"
  | "star-fill"
  | "folder"
  | "settings"
  | "download"
  | "upload"
  | "refresh"
  | "x"
  | "dice"
  | "clock"
  | "globe"
  | "warn"
  | "chevron"
  | "grid"
  | "list"
  | "logout"
  | "install"
  | "fingerprint"
  | "bolt"
  | "phone"
  | "mail";

const PATHS: Record<IconName, ReactNode> = {
  lock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  unlock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 13l9-9M18 6l2 2M15 9l2 2" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  note: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M14 10h4M14 14h4M6 15c.5-1.6 1.7-2 3-2s2.5.4 3 2" /></>,
  shield: <><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  check: <path d="M4 12l5 5L20 6" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="M4 4l16 16M9.5 9.5A3 3 0 0 0 12 15a3 3 0 0 0 2.5-1.4M6.5 6.7C3.8 8.3 2 12 2 12s3.5 7 10 7c2 0 3.7-.6 5.2-1.5M16 7.5C14.8 6.6 13.5 6 12 6" /></>,
  trash: <><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13h10l1-13" /></>,
  edit: <><path d="M4 20h4L20 8l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  star: <path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" />,
  "star-fill": <path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" fill="currentColor" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  upload: <><path d="M12 21V9M7 14l5-5 5 5" /><path d="M4 3h16" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="15" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /><circle cx="9" cy="15" r="1.2" fill="currentColor" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  warn: <><path d="M12 3l9 16H3z" /><path d="M12 9v5M12 17h.01" /></>,
  chevron: <path d="M9 6l6 6-6 6" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 12H3m0 0l3-3m-3 3l3 3" /></>,
  install: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 8v6m0 0l-2.5-2.5M12 14l2.5-2.5M9 18h6" /></>,
  fingerprint: <><path d="M12 4a6 6 0 0 0-6 6v2M18 12v-2a6 6 0 0 0-3-5.2M8.5 20c-.7-1.5-1-3-1-5m4-3a2 2 0 0 1 2 2c0 3 .5 5 1.5 7M12 12v3c0 2 .4 3.5 1 5" /></>,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  phone: <path d="M4 5c0-1 1-2 2-2h2l2 5-2 1c1 2 3 4 5 5l1-2 5 2v2c0 1-1 2-2 2C10 20 4 14 4 5z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></>,
};

export function Icon({ name, size = 20, className = "", strokeWidth = 1.7 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

/* --------------------------------------------------------------------------
   Clipboard with automatic clear (defence against clipboard snooping)
   ------------------------------------------------------------------------ */

export function useClipboard(clearSeconds = 20) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timers = useRef<{ reset?: ReturnType<typeof setTimeout>; clear?: ReturnType<typeof setTimeout> }>({});

  const copy = useCallback(
    async (text: string, key: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {}
        document.body.removeChild(ta);
      }
      setCopiedKey(key);
      clearTimeout(timers.current.reset);
      clearTimeout(timers.current.clear);
      timers.current.reset = setTimeout(() => setCopiedKey(null), 1400);
      if (clearSeconds > 0) {
        timers.current.clear = setTimeout(async () => {
          try {
            const current = await navigator.clipboard.readText();
            if (current === text) await navigator.clipboard.writeText("");
          } catch {
            try {
              await navigator.clipboard.writeText("");
            } catch {}
          }
        }, clearSeconds * 1000);
      }
    },
    [clearSeconds]
  );

  useEffect(
    () => () => {
      clearTimeout(timers.current.reset);
      clearTimeout(timers.current.clear);
    },
    []
  );

  return { copy, copiedKey };
}

/* --------------------------------------------------------------------------
   Small building blocks
   ------------------------------------------------------------------------ */

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: on ? "var(--accent)" : "var(--bg-3)", border: "1px solid var(--line-2)" }}
    >
      <span
        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all"
        style={{ left: on ? "calc(100% - 20px)" : "3px", background: on ? "var(--on-accent)" : "var(--fg-2)" }}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border p-1" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="relative rounded-lg px-3 py-1.5 text-sm transition-colors"
          style={{
            background: value === o.value ? "var(--accent)" : "transparent",
            color: value === o.value ? "var(--on-accent)" : "var(--fg-2)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal>
      <div className="absolute inset-0 backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)" }} onClick={onClose} />
      <div
        className={`vault-modal-in panel frame-grad relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto thin-scroll rounded-t-3xl sm:rounded-3xl`}
        style={{ boxShadow: "0 40px 120px -30px var(--shadow), 0 0 80px -40px var(--glow)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function StrengthBar({ score, entropy }: { score: number; entropy: number }) {
  const colors = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
  const c = colors[Math.max(0, Math.min(4, score))];
  return (
    <div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all"
            style={{ background: i <= score ? c : "var(--bg-3)" }}
          />
        ))}
      </div>
      {entropy > 0 && (
        <p className="mono mt-1 text-[10px]" style={{ color: c }}>
          ~{entropy} bits
        </p>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)] ${props.className || ""}`}
      style={{ borderColor: "var(--line-2)", background: "var(--bg-3)", ...(props.style || {}) }}
    />
  );
}

/* --------------------------------------------------------------------------
   Bilingual string table
   ------------------------------------------------------------------------ */

export type VaultStrings = typeof EN;

const EN = {
  brand: "Vault",
  tagline: "Zero-knowledge, eight-layer encrypted vault",
  back: "saleh.im",
  // onboarding
  createTitle: "Create your vault",
  createSub: "Your master password is the only key. It never leaves this device and can't be recovered — choose something strong and memorable.",
  master: "Master password",
  confirm: "Confirm password",
  hint: "Hint (optional, stored in clear)",
  create: "Create vault",
  passwordsMismatch: "Passwords don't match.",
  tooWeak: "Please choose a stronger master password.",
  keyfile: "Keyfile — optional second factor",
  keyfileHint: "Pick any file as a second key (a photo, a doc…). You'll need this exact file, plus your password, to unlock. Keep it somewhere safe and separate.",
  keyfileRequired: "This vault also requires its keyfile.",
  selectKeyfile: "Choose keyfile",
  keyfileLoaded: "Keyfile attached",
  needKeyfile: "Please attach the keyfile.",
  // unlock
  unlockTitle: "Unlock vault",
  unlockSub: "Enter your master password to decrypt this vault locally.",
  unlock: "Unlock",
  wrong: "Wrong master password.",
  hintLabel: "Hint",
  forgot: "Forgotten it? A vault can only be reset — its contents are unrecoverable.",
  reset: "Reset vault",
  resetConfirm: "This permanently erases the encrypted vault on this device. Continue?",
  // shell
  search: "Search vault…",
  newItem: "New item",
  all: "All items",
  favorites: "Favorites",
  logins: "Logins",
  notes: "Notes",
  cards: "Cards",
  identities: "Identities",
  authenticator: "2FA codes",
  folders: "Folders",
  generator: "Generator",
  security: "Security",
  settings: "Settings",
  lock: "Lock",
  empty: "Nothing here yet.",
  emptyHint: "Create your first item to get started.",
  // entry fields
  title: "Title",
  username: "Username / email",
  password: "Password",
  website: "Website",
  twofa: "2FA secret (otpauth:// or base32)",
  cardholder: "Cardholder",
  cardNumber: "Card number",
  expiry: "Expiry",
  cvv: "CVV",
  fullName: "Full name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  content: "Content",
  tags: "Tags (comma separated)",
  folder: "Folder",
  noFolder: "No folder",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  deleteConfirm: "Delete this item permanently?",
  edit: "Edit",
  copy: "Copy",
  copied: "Copied",
  reveal: "Reveal",
  conceal: "Hide",
  favorite: "Favorite",
  created: "Created",
  updated: "Updated",
  open: "Open",
  // generator
  genTitle: "Password generator",
  genPassword: "Password",
  genPassphrase: "Passphrase",
  length: "Length",
  words: "Words",
  uppercase: "Uppercase (A-Z)",
  lowercase: "Lowercase (a-z)",
  numbers: "Numbers (0-9)",
  symbols: "Symbols (!@#$)",
  avoidAmbiguous: "Avoid ambiguous (l1O0)",
  capitalize: "Capitalize words",
  includeNumber: "Include a number",
  separator: "Separator",
  regenerate: "Regenerate",
  use: "Use this",
  strength: "Strength",
  crackTime: "Offline crack time",
  // security
  secTitle: "Security dashboard",
  secScore: "Health score",
  weakPasswords: "Weak passwords",
  reusedPasswords: "Reused passwords",
  oldPasswords: "Aging passwords",
  missing2fa: "Missing 2FA",
  insecureUrls: "Insecure URLs",
  avgEntropy: "Average entropy",
  allClear: "No issues found. Your vault looks healthy.",
  auditItems: "items with passwords",
  // settings
  autoLock: "Auto-lock after (minutes)",
  clipboardClear: "Clear clipboard after (seconds)",
  concealDefault: "Conceal passwords by default",
  lockOnHide: "Lock when tab is hidden",
  changeMaster: "Change master password",
  currentPassword: "Current password",
  newPassword: "New password",
  exportBackup: "Export encrypted backup",
  importBackup: "Import backup",
  install: "Install as app",
  installed: "Installed",
  installHint: "Install Vault on Linux/desktop for an offline, app-like experience.",
  desktopLinux: "Native Linux app (Ubuntu / Kubuntu)",
  desktopHint: "Prefer a real desktop app? Build the hardened Electron .deb / AppImage from the /desktop folder in the repo.",
  desktopCta: "Build instructions",
  dangerZone: "Danger zone",
  wipe: "Erase everything",
  // crypto explainer
  howTitle: "How the encryption works",
  layers: [
    "PBKDF2-HMAC-SHA-512 — 600,000 iterations stretch your password into a 512-bit secret.",
    "HKDF-SHA-512 — six independent sub-keys, one per layer.",
    "Anti-analysis padding — random-length padding hides the real size.",
    "AES-256-GCM — authenticated inner encryption.",
    "AES-256-CTR — an independent keystream layer.",
    "AES-256-CBC + Encrypt-then-MAC (HMAC-SHA-512).",
    "AES-256-GCM outer layer, binding the header as AAD.",
    "HMAC-SHA-512 envelope — verified first, so tampering fails fast.",
  ],
  encryptedLocal: "Encrypted locally • never leaves your device",
  autoLocked: "Vault auto-locked",
  entropyNote: "Everything is encrypted with WebCrypto in your browser.",
  secondsShort: "s",
  now: "just now",
};

const FA: VaultStrings = {
  brand: "والت",
  tagline: "گاوصندوقِ رمزنگاری‌شده‌ی هشت‌لایه و بدونِ دانش",
  back: "saleh.im",
  createTitle: "گاوصندوقت را بساز",
  createSub: "رمزِ اصلی تنها کلیدِ توست. هیچ‌وقت از این دستگاه خارج نمی‌شود و قابلِ بازیابی نیست — چیزی قوی و به‌یادماندنی انتخاب کن.",
  master: "رمزِ اصلی",
  confirm: "تکرارِ رمز",
  hint: "یادآور (اختیاری، بدونِ رمزنگاری ذخیره می‌شود)",
  create: "ساختِ گاوصندوق",
  passwordsMismatch: "رمزها یکی نیستند.",
  tooWeak: "لطفاً رمزِ اصلیِ قوی‌تری انتخاب کن.",
  keyfile: "کلیدفایل — فاکتورِ دومِ اختیاری",
  keyfileHint: "هر فایلی را به‌عنوانِ کلیدِ دوم انتخاب کن (یک عکس، یک سند…). برای بازکردن، هم به همین فایلِ دقیق و هم به رمزت نیاز داری. جایی امن و جدا نگهش دار.",
  keyfileRequired: "این گاوصندوق به کلیدفایلش هم نیاز دارد.",
  selectKeyfile: "انتخابِ کلیدفایل",
  keyfileLoaded: "کلیدفایل ضمیمه شد",
  needKeyfile: "لطفاً کلیدفایل را ضمیمه کن.",
  unlockTitle: "بازکردنِ گاوصندوق",
  unlockSub: "برای رمزگشاییِ محلی، رمزِ اصلی را وارد کن.",
  unlock: "بازکردن",
  wrong: "رمزِ اصلی اشتباه است.",
  hintLabel: "یادآور",
  forgot: "فراموشش کردی؟ گاوصندوق فقط قابلِ بازنشانی است — محتوایش بازیابی‌ناپذیر است.",
  reset: "بازنشانیِ گاوصندوق",
  resetConfirm: "این کار گاوصندوقِ رمزنگاری‌شده روی این دستگاه را برای همیشه پاک می‌کند. ادامه می‌دهی؟",
  search: "جست‌وجو در گاوصندوق…",
  newItem: "موردِ جدید",
  all: "همه",
  favorites: "برگزیده‌ها",
  logins: "ورودها",
  notes: "یادداشت‌ها",
  cards: "کارت‌ها",
  identities: "هویت‌ها",
  authenticator: "کدهای دومرحله‌ای",
  folders: "پوشه‌ها",
  generator: "سازنده",
  security: "امنیت",
  settings: "تنظیمات",
  lock: "قفل",
  empty: "هنوز چیزی اینجا نیست.",
  emptyHint: "برای شروع، اولین موردت را بساز.",
  title: "عنوان",
  username: "نام‌کاربری / ایمیل",
  password: "رمز",
  website: "وب‌سایت",
  twofa: "کلیدِ دومرحله‌ای (otpauth:// یا base32)",
  cardholder: "دارنده‌ی کارت",
  cardNumber: "شماره‌ی کارت",
  expiry: "انقضا",
  cvv: "CVV",
  fullName: "نامِ کامل",
  email: "ایمیل",
  phone: "تلفن",
  address: "نشانی",
  content: "محتوا",
  tags: "برچسب‌ها (با ویرگول جدا کن)",
  folder: "پوشه",
  noFolder: "بدونِ پوشه",
  save: "ذخیره",
  cancel: "انصراف",
  delete: "حذف",
  deleteConfirm: "این مورد برای همیشه حذف شود؟",
  edit: "ویرایش",
  copy: "کپی",
  copied: "کپی شد",
  reveal: "نمایش",
  conceal: "پنهان",
  favorite: "برگزیده",
  created: "ساخته‌شده",
  updated: "به‌روزرسانی",
  open: "بازکردن",
  genTitle: "سازنده‌ی رمز",
  genPassword: "رمز",
  genPassphrase: "عبارت‌عبور",
  length: "طول",
  words: "تعدادِ کلمه",
  uppercase: "بزرگ (A-Z)",
  lowercase: "کوچک (a-z)",
  numbers: "عدد (0-9)",
  symbols: "نماد (!@#$)",
  avoidAmbiguous: "پرهیز از مبهم‌ها (l1O0)",
  capitalize: "حرفِ اولِ کلمات بزرگ",
  includeNumber: "افزودنِ یک عدد",
  separator: "جداکننده",
  regenerate: "ساختِ دوباره",
  use: "استفاده",
  strength: "قدرت",
  crackTime: "زمانِ شکستنِ آفلاین",
  secTitle: "داشبوردِ امنیت",
  secScore: "امتیازِ سلامت",
  weakPasswords: "رمزهای ضعیف",
  reusedPasswords: "رمزهای تکراری",
  oldPasswords: "رمزهای قدیمی",
  missing2fa: "بدونِ دومرحله‌ای",
  insecureUrls: "آدرس‌های ناامن",
  avgEntropy: "میانگینِ آنتروپی",
  allClear: "مشکلی پیدا نشد. گاوصندوقت سالم است.",
  auditItems: "موردِ دارای رمز",
  autoLock: "قفلِ خودکار پس از (دقیقه)",
  clipboardClear: "پاک‌کردنِ کلیپ‌بورد پس از (ثانیه)",
  concealDefault: "پیش‌فرض رمزها پنهان باشند",
  lockOnHide: "قفل هنگامِ پنهان‌شدنِ تب",
  changeMaster: "تغییرِ رمزِ اصلی",
  currentPassword: "رمزِ فعلی",
  newPassword: "رمزِ جدید",
  exportBackup: "خروجیِ پشتیبانِ رمزنگاری‌شده",
  importBackup: "واردکردنِ پشتیبان",
  install: "نصب به‌عنوان اپ",
  installed: "نصب‌شده",
  installHint: "والت را روی لینوکس/دسکتاپ نصب کن تا تجربه‌ای آفلاین و اپ‌مانند داشته باشی.",
  desktopLinux: "اپِ بومیِ لینوکس (اوبونتو / کوبونتو)",
  desktopHint: "اپِ دسکتاپِ واقعی می‌خواهی؟ نسخه‌ی .deb / AppImage امن‌شده را از پوشه‌ی /desktop مخزن بساز.",
  desktopCta: "راهنمای ساخت",
  dangerZone: "منطقه‌ی خطر",
  wipe: "پاک‌کردنِ همه‌چیز",
  howTitle: "رمزنگاری چطور کار می‌کند",
  layers: [
    "PBKDF2-HMAC-SHA-512 — ۶۰۰٬۰۰۰ تکرار، رمزت را به یک رازِ ۵۱۲بیتی تبدیل می‌کند.",
    "HKDF-SHA-512 — شش زیرکلیدِ مستقل، هر کدام برای یک لایه.",
    "پدینگِ ضدِتحلیل — پدینگِ تصادفی اندازه‌ی واقعی را پنهان می‌کند.",
    "AES-256-GCM — رمزنگاریِ احرازشده‌ی داخلی.",
    "AES-256-CTR — یک لایه‌ی کی‌استریمِ مستقل.",
    "AES-256-CBC + رمزنگاری‌سپس‌احراز (HMAC-SHA-512).",
    "لایه‌ی بیرونیِ AES-256-GCM با هدر به‌عنوانِ AAD.",
    "پاکتِ HMAC-SHA-512 — اول بررسی می‌شود تا دستکاری سریع رد شود.",
  ],
  encryptedLocal: "رمزنگاری‌شده به‌صورتِ محلی • هیچ‌وقت دستگاهت را ترک نمی‌کند",
  autoLocked: "گاوصندوق خودکار قفل شد",
  entropyNote: "همه‌چیز با WebCrypto در مرورگرِ تو رمزنگاری می‌شود.",
  secondsShort: "ثانیه",
  now: "همین حالا",
};

export const VAULT_I18N = { en: EN, fa: FA };
