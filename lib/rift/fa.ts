// ============================================================================
//  Rift — Persian (fa) translations for the data-driven game content.
//
//  The UI chrome (menus, HUD labels, guide) is translated in i18n.ts. This
//  module fills the remaining gap the players kept hitting: the *content*
//  itself — hero, weapon, ability, upgrade, enemy, boss, achievement,
//  difficulty and modifier names and descriptions — which previously always
//  rendered in English even with the site set to Persian.
//
//  Everything here is keyed by the same canonical `id`/`kind` used across the
//  simulation modules, and every accessor falls back gracefully to the English
//  source object when a key (or the language) isn't Persian — so adding a new
//  hero/weapon can never break the page, it just shows English until a
//  translation is added here.
// ============================================================================

import type { Lang } from "@/lib/i18n";
import type { HeroDef } from "./heroes";
import type { WeaponDef } from "./weapons";
import type { AbilityDef } from "./abilities";
import type { EnemyKind } from "./enemies";
import type { BossDef } from "./enemies";
import type { AchievementDef, DifficultyDef } from "./meta";
import type { ModifierDef } from "./challenges";
import type { CodexEntry, BossLore } from "./codex";

/* ------------------------------------------------------------------ */
/*  Heroes                                                             */
/* ------------------------------------------------------------------ */

interface HeroFa { name: string; title: string; bio: string; passiveDesc: string }

const HEROES_FA: Record<string, HeroFa> = {
  vanguard: {
    name: "ونگارد",
    title: "نگهدارِ خط",
    bio: "یک خلبانِ خطِ مقدمِ متوازن، بدون نقطه‌ضعف و بدون برتریِ خاص — امن‌ترین انتخاب برای اولین ران.",
    passiveDesc: "بدون قابلیتِ منفعل — یک استت‌لاینِ تمیز و متوازن.",
  },
  striker: {
    name: "استرایکر",
    title: "سلولِ آدرنالین",
    bio: "هر ثانیه شلیکِ بی‌وقفه سلاح‌هایش را داغ‌تر می‌کند — در نبردهای طولانی ویرانگر، بیرون از آن‌ها کُند.",
    passiveDesc: "هرچه شلیک را ادامه دهی، نرخِ شلیک تا +۴۰٪ بالا می‌رود.",
  },
  bastion: {
    name: "باستیون",
    title: "تزلزل‌ناپذیر",
    bio: "یک پناهگاهِ متحرک. کُند، پرجان و تقریباً غیرممکن است در آستانه‌ی هسته از پا درش بیاوری.",
    passiveDesc: "۲۰٪ آسیبِ تماسیِ کمتر می‌گیرد؛ ۸٪ کندتر حرکت می‌کند.",
  },
  prospector: {
    name: "پراسپکتور",
    title: "شکارچیِ اسقاط",
    bio: "کمتر به نبرد اهمیت می‌دهد تا به غنیمت. هر کشتن و هر جعبه به‌طور محسوسی بیشتر پول می‌دهد.",
    passiveDesc: "+۳۵٪ طلا از هر منبع.",
  },
  ghost: {
    name: "گوست",
    title: "فازگذر",
    bio: "به‌جای تحملِ خطر از میانش می‌لغزد — پنجره‌ی مصونیتِ بسیار طولانی‌تری بعد از هر ضربه.",
    passiveDesc: "پنجره‌ی مصونیتِ پس از ضربه ۶۰٪ طولانی‌تر است.",
  },
  overclocked: {
    name: "اورکلاک",
    title: "توپِ شیشه‌ای",
    bio: "هر توانایی و مسیرِ ارتقا حولِ شارژِ سریع‌ترِ توانایی‌ها می‌چرخد — ریسکِ بالا، ریتمِ بالا.",
    passiveDesc: "توانایی‌ها ۲۵٪ سریع‌تر شارژ می‌شوند.",
  },
};

export function trHero(lang: Lang, h: HeroDef): { name: string; title: string; bio: string; passiveDesc: string } {
  if (lang === "fa" && HEROES_FA[h.id]) return HEROES_FA[h.id];
  return { name: h.name, title: h.title, bio: h.bio, passiveDesc: h.passiveDesc };
}

/* ------------------------------------------------------------------ */
/*  Weapons                                                            */
/* ------------------------------------------------------------------ */

interface WeaponFa { name: string; desc: string; special: string }

const WEAPONS_FA: Record<string, WeaponFa> = {
  blaster: {
    name: "پالس‌بلستر",
    desc: "یک سلاحِ کمریِ تک‌گلوله‌ی مطمئن. بدون غافلگیری، بدون نقطه‌ضعف.",
    special: "متوازن — چیدمانِ پیش‌فرض.",
  },
  shotgun: {
    name: "شاتگانِ فلک",
    desc: "رگبارِ سه‌ساچمه‌ای با مخروطِ پهن. از نزدیک ویرانگر، از دور ضعیف.",
    special: "۳ ساچمه در مخروطی پهن شلیک می‌کند؛ هر ساچمه کریتِ خودش را می‌زند.",
  },
  railgun: {
    name: "ریل‌گان",
    desc: "یک شلیکِ پرتوی تقریباً آنی که همیشه هر چه سرِ راهش باشد را می‌شکافد.",
    special: "ذاتاً کلِ خط را می‌شکافد — عالی در برابرِ موج‌های متراکم.",
  },
  chainlaser: {
    name: "لیزرِ زنجیره‌ای",
    desc: "پرتوی نازکِ پیوسته که هرچه بیشتر روی یک هدف قفل بماند آسیبش بالاتر می‌رود.",
    special: "بسیار سریع، آسیبِ کم در هر برخورد — روی یک هدفِ ثابت تا +۱۵۰٪ بالا می‌رود.",
  },
  missiles: {
    name: "موشک‌های ردیاب",
    desc: "موشک‌های هدایت‌شونده‌ی کندپرتاب که به سمتِ نزدیک‌ترین تهدید خم می‌شوند و روی برخورد منفجر می‌شوند.",
    special: "روی هدف قفل می‌کند و هنگامِ برخورد با آسیبِ انفجاری منفجر می‌شود.",
  },
  orbitals: {
    name: "پهپادهای مداری",
    desc: "دو پهپاد گردِ قهرمان می‌چرخند و به‌جای شلیکِ روبه‌جلو، هرچه نزدیک شود را می‌زنند.",
    special: "بدون گلوله — پهپادهای چرخان با خنک‌شدنی کوتاه آسیبِ تماسی می‌زنند.",
  },
};

export function trWeapon(lang: Lang, w: WeaponDef): { name: string; desc: string; special: string } {
  if (lang === "fa" && WEAPONS_FA[w.id]) return WEAPONS_FA[w.id];
  return { name: w.name, desc: w.desc, special: w.special };
}

export function trWeaponName(lang: Lang, w: WeaponDef): string {
  return lang === "fa" && WEAPONS_FA[w.id] ? WEAPONS_FA[w.id].name : w.name;
}

/* ------------------------------------------------------------------ */
/*  Abilities                                                          */
/* ------------------------------------------------------------------ */

interface AbilityFa { name: string; desc: string }

const ABILITIES_FA: Record<string, AbilityFa> = {
  nova: { name: "انفجارِ نوا", desc: "موجی ضربه‌ای رها می‌کند که به هر دشمنِ روی صفحه آسیب می‌زند و پسش می‌راند." },
  overdrive: { name: "اوردرایو", desc: "برای ۶ ثانیه، نرخِ شلیک و سرعتِ حرکت هردو دو برابر می‌شوند." },
  shieldwall: { name: "دیوارِ سپر", desc: "سپری می‌دهد که ۱۲۰ آسیبِ بعدی را جذب می‌کند، یا پس از ۸ ثانیه محو می‌شود." },
  blink: { name: "بلینک", desc: "فوراً به جهتِ نشانه‌گیری‌شده تلپورت می‌کنی و ۱ ثانیه مصونیت می‌گیری." },
  turretStorm: { name: "طوفانِ برجک", desc: "سه برجکِ موقت را برای ۱۲ ثانیه گردِ قهرمان مستقر می‌کند." },
  timeDilation: { name: "اتساعِ زمان", desc: "هر دشمن و گلوله‌ی دشمن را برای ۵ ثانیه به ۴۰٪ سرعت کند می‌کند." },
};

export function trAbility(lang: Lang, a: AbilityDef): { name: string; desc: string } {
  if (lang === "fa" && ABILITIES_FA[a.id]) return ABILITIES_FA[a.id];
  return { name: a.name, desc: a.desc };
}

export function trAbilityName(lang: Lang, id: string, fallback: string): string {
  return lang === "fa" && ABILITIES_FA[id] ? ABILITIES_FA[id].name : fallback;
}

/* ------------------------------------------------------------------ */
/*  Upgrades (ids/copy defined inline in engine.ts)                    */
/* ------------------------------------------------------------------ */

interface UpgradeFa { name: string; desc: string }

const UPGRADES_FA: Record<string, UpgradeFa> = {
  damage: { name: "شارژِ مضاعف", desc: "+۲۵٪ آسیبِ پرتابه" },
  firerate: { name: "سیم‌پیچِ تندآتش", desc: "+۱۸٪ نرخِ شلیک" },
  speed: { name: "موتورهای رانش", desc: "+۱۲٪ سرعتِ حرکت" },
  maxhp: { name: "زره‌پوش", desc: "+۲۵ جانِ بیشینه و درمانِ کامل" },
  multishot: { name: "لوله‌ی چندشاخه", desc: "+۱ پرتابه" },
  pierce: { name: "گلوله‌های ریلی", desc: "شلیک‌ها +۱ دشمنِ بیشتر را می‌شکافند" },
  crit: { name: "لنزِ تمرکز", desc: "+۸٪ شانسِ کریتیکال" },
  core: { name: "سپرِ هسته", desc: "+۱۲۰ جانِ هسته و تعمیر" },
  sentry: { name: "استقرارِ سنتری", desc: "یک برجکِ خودکار از هسته محافظت می‌کند" },
  magnet: { name: "آهنربای اسقاط", desc: "+۴۰٪ بردِ جمع‌آوری" },
  regen: { name: "نانوبافت", desc: "بازسازیِ +۱٫۵ جان در ثانیه" },
  lifesteal: { name: "مکش", desc: "۴٪ آسیبِ واردشده را درمان می‌کنی" },
  bulletspeed: { name: "شتاب‌دهنده", desc: "+۲۰٪ سرعتِ پرتابه" },
  haste: { name: "خازنِ توانایی", desc: "-۱۲٪ زمانِ خنک‌شدنِ توانایی‌ها" },
  shieldcap: { name: "سلولِ حصار", desc: "+۴۰ سپرِ شخصیِ بیشینه" },
  goldgain: { name: "دستگاهِ اسقاط", desc: "+۱۵٪ طلا از هر منبع" },
};

export function trUpgrade(lang: Lang, u: { id: string; name: string; desc: string }): { name: string; desc: string } {
  if (lang === "fa" && UPGRADES_FA[u.id]) return UPGRADES_FA[u.id];
  return { name: u.name, desc: u.desc };
}

/* ------------------------------------------------------------------ */
/*  Enemies + Codex                                                    */
/* ------------------------------------------------------------------ */

const ENEMY_NAME_FA: Record<string, string> = {
  grunt: "سرباز", swift: "چابک", brute: "غول", shooter: "تیرانداز",
  bomber: "بمب‌گذار", shielded: "نگهبانِ سپردار", splitter: "شکافنده", sniper: "تک‌تیرانداز",
  healer: "پهپادِ درمانگر", summoner: "احضارگر", phantom: "شبح", berserker: "برسرکر",
  turret: "برجکِ مستقر", cloaker: "نامرئی‌گر", juggernaut: "جاگرنات",
};

export function trEnemyName(lang: Lang, kind: EnemyKind, fallback: string): string {
  return lang === "fa" && ENEMY_NAME_FA[kind] ? ENEMY_NAME_FA[kind] : fallback;
}

interface CodexFa { flavor: string; tacticalNote: string }

const CODEX_FA: Record<string, CodexFa> = {
  grunt: { flavor: "انبوه‌تولید و دورانداختنی — ریفت هزاران‌تای این‌ها را می‌فرستد پیش از آنکه چیزِ زیرکانه‌تری امتحان کند.", tacticalNote: "رفتارِ خاصی ندارد. اگر چیزِ ترسناک‌تری روی صفحه است می‌شود کوتاه نادیده‌اش گرفت." },
  swift: { flavor: "به‌سختی زره دارد، صرفاً برای سرعت ساخته شده — یک چابکِ تنها هیچ است، یک گله‌شان دردسرِ واقعی است.", tacticalNote: "ارتقاهای نفوذ و چندشلیکی گله‌های چابک را بی‌اهمیت می‌کنند." },
  brute: { flavor: "تخته‌ای از زره روی پا. جاخالی نمی‌دهد، عقب‌نشینی نمی‌کند و به قهرمانت اهمیتی نمی‌دهد — فقط به هسته.", tacticalNote: "پیش از رسیدن به هسته اولویتش بده؛ در هر ثانیه آسیبِ تماسیِ سنگینی می‌زند." },
  shooter: { flavor: "به‌جای نزدیک‌شدن مثلِ بقیه، فاصله‌اش را حفظ می‌کند و با آتشِ برد آرام‌آرام می‌ساید.", tacticalNote: "به‌محضِ دیدن بکش — اگر در طولِ یک موج رهایش کنی آسیبش سریع جمع می‌شود." },
  bomber: { flavor: "یک خرجِ زنده که لحظه‌ای که تو را ببیند می‌دود و روی برخورد منفجر می‌شود.", tacticalNote: "از دور بکشش. رساندنش به خودت یا هسته به هر حال تکه‌ای از جان را می‌گیرد." },
  shielded: { flavor: "یک سپرِ انرژیِ جلویی هرچه را مستقیم از روبه‌رو نزدیک شود منحرف می‌کند.", tacticalNote: "شلیک از پهلو یا پشت کاملاً سپر را نادیده می‌گیرد — اینجا جای‌گیری بر آسیب می‌چربد." },
  splitter: { flavor: "مرگش نبرد را تمام نمی‌کند — دو بار تمامش می‌کند و به یک جفت چابک می‌شکند.", tacticalNote: "وقتی یکی می‌میرد سرِ جا نایست؛ زاده‌هایش همان لحظه درحالِ‌حرکت ظاهر می‌شوند." },
  sniper: { flavor: "خودش را از دور کاشته، کمی بیش از یک ثانیه هشدار می‌دهد، بعد یک شلیک می‌کند که واقعاً درد دارد.", tacticalNote: "در حینِ هشدار خطِ دید را قطع کن، یا پیش از فرودِ شلیک بیشتر از او آسیب بزن." },
  healer: { flavor: "خودش هیچ آسیبی نمی‌زند — فقط هرچه دورش هست را خیلی بیشتر از آنچه باید زنده نگه می‌دارد.", tacticalNote: "در یک گله‌ی مختلط همیشه اولین هدف؛ نادیده‌گرفتنش هر نبردی که در آن باشد را طولانی می‌کند." },
  summoner: { flavor: "تا وقتی زنده بماند، هر چند ثانیه سربازانِ تازه می‌آورد.", tacticalNote: "با آن مثلِ یک تولیدکننده رفتار کن نه یک جنگجو — کشتنش فوراً خون‌ریزی را بند می‌آورد." },
  phantom: { flavor: "به‌جای راه‌رفتن با جهش‌های کوتاه جابه‌جا می‌شود و پیش‌بینیِ شلیک رویش کابوس است.", tacticalNote: "سلاح‌های نفوذی/ریل‌گانی که به هدف‌گیریِ دقیق نیاز ندارند خیلی بهتر از رگبارِ نقطه‌ای با آن کنار می‌آیند." },
  berserker: { flavor: "هرچه جانِ خودش پایین‌تر بیاید سریع‌تر و خشمگین‌تر می‌شود — یک نبردِ بازنده می‌تواند ناگهان برگردد.", tacticalNote: "وقتی شروع کردی، به کشتنش متعهد بمان؛ عقب‌کشیدن فقط خونسردی‌اش را برمی‌گرداند نه جانش را." },
  turret: { flavor: "تعقیب نمی‌کند — لحظه‌ای که فرود بیاید خودش را می‌کارد و از بیرونِ فاصله‌ی درگیری شلیک می‌کند.", tacticalNote: "بی‌تحرکیِ کاملش آن را به آسان‌ترین کشتنِ بخشش تبدیل می‌کند، همین‌که فاصله را ببندی یا شلیک را ردیف کنی." },
  cloaker: { flavor: "بیشترِ نبرد را تقریباً شفاف می‌گذراند و فقط لحظه‌ای که به جهش متعهد می‌شود دیده می‌شود.", tacticalNote: "به‌جای ردیابیِ بصری منتظرِ نشانه‌ی جهشش باش — واکنش به جهش بهتر از پیش‌بینی‌اش است." },
  juggernaut: { flavor: "غولی که یکی تصمیم گرفت به‌قدرِ کافی پرجان نیست، پس زرهِ بیشتری جوش داد و تمامش کرد.", tacticalNote: "زرهِ کاهشِ‌آسیبش به آتشِ پیوسته بیش از رگباری پاداش می‌دهد — سلاح‌های نفوذی اینجا می‌درخشند." },
};

export function trCodex(lang: Lang, c: CodexEntry): { flavor: string; tacticalNote: string } {
  if (lang === "fa" && CODEX_FA[c.kind]) return CODEX_FA[c.kind];
  return { flavor: c.flavor, tacticalNote: c.tacticalNote };
}

/* ------------------------------------------------------------------ */
/*  Bosses + boss lore                                                 */
/* ------------------------------------------------------------------ */

interface BossFa { name: string; title: string }

const BOSS_FA: Record<string, BossFa> = {
  colossus: { name: "کولوسوس", title: "اولین دیوار" },
  hive: { name: "کندو", title: "مادرِ ازدحام" },
  warden: { name: "واردنِ برتر", title: "تختِ سپردار" },
  reaper: { name: "درو‌گر", title: "بردارِ پوچ" },
  aeon: { name: "ایان", title: "آخرین ریفت" },
  eclipse: { name: "اکلیپس", title: "پرستیژِ بی‌پایان" },
};

export function trBoss(lang: Lang, b: BossDef): { name: string; title: string } {
  if (lang === "fa" && BOSS_FA[b.kind]) return BOSS_FA[b.kind];
  return { name: b.name, title: b.title };
}

// Boss intro lines shown as an on-canvas banner when a boss spawns.
const BOSS_INTRO_FA: Record<string, string> = {
  colossus: "دیواری از زره به سمتِ هسته می‌ساید.",
  hive: "تنها نمی‌جنگد — هیچ‌وقت مجبور نبوده.",
  warden: "سپرش هرگز نیفتاده. امروز خواهد افتاد.",
  reaper: "سریع‌تر از هرچیزی در این اندازه حرکت می‌کند.",
  aeon: "هرچه پیش از این بود، یک تمرین بود.",
  eclipse: "برای آن‌ها که یک‌بار ریفت را مهروموم کردند و برای بیشتر برگشتند.",
};

/** Persian boss name by kind (for on-canvas banners that only know the kind). */
export function trBossKindName(lang: Lang, kind: string, fallback: string): string {
  return lang === "fa" && BOSS_FA[kind] ? BOSS_FA[kind].name : fallback;
}

/** Persian boss intro line by kind. */
export function trBossIntro(lang: Lang, kind: string, fallback: string): string {
  return lang === "fa" && BOSS_INTRO_FA[kind] ? BOSS_INTRO_FA[kind] : fallback;
}

// English-name → fa-name lookup for HUD strings that only carry the display name.
const BOSS_NAME_EN_TO_FA: Record<string, { name: string; title: string }> = {
  Colossus: BOSS_FA.colossus,
  "The Hive": BOSS_FA.hive,
  "Warden Prime": BOSS_FA.warden,
  "The Reaper": BOSS_FA.reaper,
  Aeon: BOSS_FA.aeon,
  Eclipse: BOSS_FA.eclipse,
};

const BOSS_TITLE_EN_TO_FA: Record<string, string> = {
  "The First Wall": BOSS_FA.colossus.title,
  "Swarm Mother": BOSS_FA.hive.title,
  "The Shielded Throne": BOSS_FA.warden.title,
  "Null Vector": BOSS_FA.reaper.title,
  "The Last Rift": BOSS_FA.aeon.title,
  "The Endless Prestige": BOSS_FA.eclipse.title,
};

export function trHudBossName(lang: Lang, name: string): string {
  return lang === "fa" && BOSS_NAME_EN_TO_FA[name] ? BOSS_NAME_EN_TO_FA[name].name : name;
}
export function trHudBossTitle(lang: Lang, title: string): string {
  return lang === "fa" && BOSS_TITLE_EN_TO_FA[title] ? BOSS_TITLE_EN_TO_FA[title] : title;
}

interface BossLoreFa { lore: string; strategy: string }

const BOSS_LORE_FA: Record<string, BossLoreFa> = {
  colossus: {
    lore: "اولین چیزی که ریفت تنها با هدفِ پایان‌دادن به یک مدافع ساخت. هیچ‌چیزش ظریف نیست: جلو می‌آید، زمین را می‌کوبد و در مخروطی پهن شلیک می‌کند. آنچه در زیرکی کم دارد را در زرهِ خام جبران می‌کند.",
    strategy: "گِردِ شعاعِ کوبشش استریف کن و در فازِ رگبار مدام شلیک کن — همین‌که یادش بگیری، الگو روی چرخه‌ی دقیقِ ۶ ثانیه‌ای تکرار می‌شود.",
  },
  hive: {
    lore: "کمتر یک موجودِ یگانه است تا یک نقطه‌ی هماهنگی — خودِ کندو به‌سختی می‌جنگد، اما هیچ‌گاه از فراخواندنِ بدن‌های بیشتر برای جنگیدن به‌جای خودش دست نمی‌کشد.",
    strategy: "هر وقت پنجره‌ی تمیزی گرفتی، کندو را بر زاده‌هایش اولویت بده؛ لحظه‌ای که بمیرد، آمدنِ زاده‌ها بند می‌آید.",
  },
  warden: {
    lore: "یک مولدِ سپر که دورِ چیزی پیچیده شده که زمانی نیاز به محافظت داشت و دیگر ندارد. سپرش را با ریتم بالا می‌برد، برای تنبیهِ زیاده‌روی جهش می‌زند و در مخروط‌های پهنِ سخت‌جاخالی رگبار می‌بندد.",
    strategy: "آسیبِ رگباری و توانایی‌ها را برای پنجره‌های درست پس از افتادنِ سپرش نگه دار — آسیب حینِ سپر بیشتر هدر می‌رود.",
  },
  reaper: {
    lore: "سریع‌تر از هرچیزی که در این اندازه حق داشته باشد باشد. تو را زیرِ‌فشار نمی‌گذارد، بلکه از جای‌گیری می‌گذراندت، پیش از آنکه واکنش نشان دهی از بردِ درگیری بیرون و درون می‌جهد.",
    strategy: "توانایی‌های حرکتی مثلِ بلینک یا اتساعِ زمان این نبرد را بیشتر از ارتقاهای خامِ آسیب می‌چرخانند.",
  },
  aeon: {
    lore: "پاسخِ نهاییِ ریفت، ساخته‌شده از هرآنچه با تماشای هر مدافعِ پیش از تو آموخت. سپر می‌گیرد، جهش می‌زند، تقریباً در دایره‌ای کامل رگبار می‌بندد و در فازِ آخرش کمک هم می‌طلبد.",
    strategy: "هر فاز را باسی متفاوت بگیر — الگو هر بار که جانش از آستانه‌ای بگذرد بازنشانی و شدیدتر می‌شود.",
  },
  eclipse: {
    lore: "نباید وجود داشته باشد. ریفت این را فقط وقتی می‌سازد که مدافعی پس از یک‌بار مهروموم‌کردنش برگردد، انگار به مبارزه‌ای دوباره دعوتش می‌کند.",
    strategy: "همه‌ی تاکتیک‌های ایان هنوز کار می‌کنند، سریع‌تر و با فضای کمتر برای خطا — این نبرد طمع را بیش از هر نبردِ پیشین تنبیه می‌کند.",
  },
};

export function trBossLore(lang: Lang, l: BossLore): { lore: string; strategy: string } {
  if (lang === "fa" && BOSS_LORE_FA[l.kind]) return BOSS_LORE_FA[l.kind];
  return { lore: l.lore, strategy: l.strategy };
}

/* ------------------------------------------------------------------ */
/*  Achievements                                                       */
/* ------------------------------------------------------------------ */

const ACHIEVEMENTS_FA: Record<string, { name: string; desc: string }> = {
  first_blood: { name: "اولین خون", desc: "اولین کشتنت را ثبت کن." },
  hundred_kills: { name: "سنتوریون", desc: "به ۱۰۰ کشته‌ی کل برس." },
  thousand_kills: { name: "نابودگر", desc: "به ۱۰۰۰ کشته‌ی کل برس." },
  first_boss: { name: "شکننده‌ی دیوار", desc: "اولین باست را شکست بده." },
  five_bosses: { name: "شکارچیِ باس", desc: "روی‌هم ۵ باس را شکست بده." },
  first_win: { name: "ریفتِ مهروموم", desc: "یک ران را ببر — هر پنج بخش را پاک کن." },
  five_wins: { name: "افسانه‌ی ریفت", desc: "۵ ران را ببر." },
  score_10k: { name: "اسقاط‌گر", desc: "در یک ران ۱۰٬۰۰۰ امتیاز بگیر." },
  score_50k: { name: "انبارگر", desc: "در یک ران ۵۰٬۰۰۰ امتیاز بگیر." },
  sector_3: { name: "ریفتِ ژرف", desc: "در یک ران به بخشِ ۳ برس." },
  sector_5: { name: "لبه‌ی ریفت", desc: "در یک ران به بخشِ ۵ برس." },
  gold_5k: { name: "زراندود", desc: "۵٬۰۰۰ طلای کل به‌دست آور." },
  level_10: { name: "خلبانِ کارکشته", desc: "در یک ران به سطحِ ۱۰ قهرمان برس." },
  level_20: { name: "خلبانِ اِیس", desc: "در یک ران به سطحِ ۲۰ قهرمان برس." },
  crit_100: { name: "دقت", desc: "۱۰۰ ضربه‌ی کریتیکالِ کل بزن." },
};

export function trAchievement(lang: Lang, a: AchievementDef): { name: string; desc: string } {
  if (lang === "fa" && ACHIEVEMENTS_FA[a.id]) return ACHIEVEMENTS_FA[a.id];
  return { name: a.name, desc: a.desc };
}

/* ------------------------------------------------------------------ */
/*  Difficulties                                                       */
/* ------------------------------------------------------------------ */

const DIFFICULTY_FA: Record<string, { name: string; desc: string }> = {
  cadet: { name: "کارآموز", desc: "یک رانِ آرام — عالی برای یادگیریِ بیلدها." },
  veteran: { name: "کهنه‌کار", desc: "چالشِ متوازن و موردِ نظرِ سازنده." },
  nightmare: { name: "کابوس", desc: "دشمنانِ سخت‌تر، سریع‌تر و بدجنس‌تر — و پاداشش هم بیشتر است." },
};

export function trDifficulty(lang: Lang, d: DifficultyDef): { name: string; desc: string } {
  if (lang === "fa" && DIFFICULTY_FA[d.id]) return DIFFICULTY_FA[d.id];
  return { name: d.name, desc: d.desc };
}

/* ------------------------------------------------------------------ */
/*  Daily-challenge modifiers                                          */
/* ------------------------------------------------------------------ */

const MODIFIER_FA: Record<string, { name: string; desc: string }> = {
  glassCannon: { name: "توپِ شیشه‌ای", desc: "+۶۰٪ آسیبِ واردشده، -۳۵٪ جانِ بیشینه." },
  ironWill: { name: "اراده‌ی آهنین", desc: "+۴۰٪ جانِ بیشینه، -۲۰٪ آسیبِ واردشده." },
  swarmMode: { name: "حالتِ ازدحام", desc: "دشمن‌ها -۳۰٪ جان دارند اما موج‌ها به‌طور محسوسی متراکم‌ترند." },
  richHarvest: { name: "برداشتِ پرثمر", desc: "+۵۰٪ طلا از هر منبع." },
  slowBurn: { name: "سوزشِ آرام", desc: "دشمن‌ها ۲۰٪ کندترند اما ۲۵٪ سخت‌تر می‌زنند." },
  berserkCore: { name: "ریتمِ برسرک", desc: "+۳۵٪ نرخِ شلیک برای همه — تو و هر دشمن." },
  fragileCore: { name: "هسته‌ی شکننده", desc: "هسته ۳۰٪ جانِ کمتر دارد — جای اشتباه نیست." },
  sniperNest: { name: "لانه‌ی تک‌تیرانداز", desc: "دشمنانِ بردی این ران بسیار بیشتر ظاهر می‌شوند." },
  goldRush: { name: "هجومِ طلا", desc: "+۸۰٪ طلا، اما دشمن‌ها هم ۲۰٪ سخت‌تر می‌زنند." },
  bulletStorm: { name: "طوفانِ گلوله", desc: "گلوله‌های دشمن ۳۰٪ سریع‌تر حرکت می‌کنند." },
  oneLife: { name: "یک جان", desc: "این ران هیچ تواناییِ سپرِ شخصی نمی‌شود انتخاب کرد." },
  doubleXp: { name: "تجربه‌ی دوبرابر", desc: "این ران تقریباً دو برابر سریع‌تر لِوِل می‌گیری." },
  miniBosses: { name: "اسکورتِ نخبه", desc: "موج‌های عادی گاهی شاملِ یک واریانتِ نخبه‌ی سخت‌تر می‌شوند." },
  healScarcity: { name: "کمبودِ درمان", desc: "این ران آیتم‌های سلامتی ۶۰٪ کمیاب‌ترند." },
  adrenalineRun: { name: "رانِ آدرنالینی", desc: "همه ۱۵٪ سریع‌تر حرکت می‌کنند — تو و هر دشمن." },
};

export function trModifier(lang: Lang, m: ModifierDef): { name: string; desc: string } {
  if (lang === "fa" && MODIFIER_FA[m.id]) return MODIFIER_FA[m.id];
  return { name: m.name, desc: m.desc };
}

/* ------------------------------------------------------------------ */
/*  Hero → weapon synergy reasoning                                    */
/* ------------------------------------------------------------------ */

const SYNERGY_REASONING_FA: Record<string, string> = {
  vanguard: "نقطه‌ضعفی برای بیلد‌کردن حولش ندارد — اطمینانِ پالس‌بلستر و یک جفت تواناییِ همه‌منظوره هر ران را انعطاف‌پذیر نگه می‌دارد.",
  striker: "شیبِ نرخِ شلیکِ او و شیبِ آسیبِ لیزرِ زنجیره‌ای هم را تقویت می‌کنند — قفل‌ماندن روی یک هدف هر دو مکانیک را هم‌زمان پاداش می‌دهد.",
  bastion: "همین‌الانش پرجان‌ترین قهرمان است — تأکیدِ بیشتر با دیوارِ سپر و پشتیبانیِ برجک آستانه‌ی هسته را به دیواری تبدیل می‌کند که هیچ موجی از آن رد نمی‌شود.",
  prospector: "کسبِ طلا وسطِ نبرد کمکی نمی‌کند، پس روی ابزارهای پرآسیب مثلِ موشک‌های ردیاب و توانایی‌های پاک‌سازیِ جمعیت تکیه کن تا آن‌قدر زنده بمانی که خرجش کنی.",
  ghost: "مصونیتِ طولانی جای‌گیریِ تهاجمی را پاداش می‌دهد — نفوذِ ریل‌گان می‌گذارد شلیک‌ها را از میانِ کلِ یک موج ردیف کند درحالی‌که بینِ ضربه‌ها می‌بافد.",
  overclocked: "خنک‌شدنِ سریع‌ترِ توانایی یعنی اوردرایو و طوفانِ برجک خیلی بیشتر در دسترس‌اند — ابزارهای خنک‌شدن‌طلب را روی‌هم بگذار تا بیشترین بهره را از قابلیتِ منفعل ببری.",
};

export function trSynergyReasoning(lang: Lang, heroId: string, fallback: string): string {
  return lang === "fa" && SYNERGY_REASONING_FA[heroId] ? SYNERGY_REASONING_FA[heroId] : fallback;
}

/* ------------------------------------------------------------------ */
/*  Field tips                                                         */
/* ------------------------------------------------------------------ */

export const FIELD_TIPS_FA: string[] = [
  "نگهبانانِ سپردار فقط آسیبِ مستقیم از روبه‌رو را می‌بندند — از پهلو دورشان بزن.",
  "آسیبِ لیزرِ زنجیره‌ای هرچه بیشتر روی یک هدف بماند بالا می‌رود؛ با آن بین دشمن‌ها نپر.",
  "موشک‌های ردیاب روی برخورد یا در پایانِ عمرشان منفجر می‌شوند — همیشه آسیبِ انفجاری می‌زنند.",
  "احضارگرِ زنده‌مانده موج را بی‌پایان پر نگه می‌دارد. اول او را بکش.",
  "پهپادهای مداری اصلاً آسیبِ گلوله‌ای نمی‌زنند — شعاعشان بردِ واقعیِ توست.",
  "برسرکرها هرچه جانشان پایین بیاید سریع‌تر و پرضربه‌تر می‌شوند — همین‌که درگیر شدی سریع تمامشان کن.",
  "باس‌ها الگوی حمله را در ۶۶٪ و ۳۳٪ جان عوض می‌کنند — هر فاز ریتم را از نو یاد بگیر.",
  "پنجره‌ی مصونیتِ طولانیِ قهرمانِ گوست، معاوضه‌ی ضربه را بیش از پرهیزِ کامل پاداش می‌دهد.",
  "ارتقاهای آهنربای اسقاط طلا را از فاصله‌ی خیلی دورتر می‌کشند — برای پاک‌سازیِ سریعِ موج‌های متراکم عالی است.",
  "زمانِ خنک‌شدنِ توانایی‌ها روی نوارِ میان‌بر نشان داده می‌شود — نوا یا اتساعِ زمان را حولِ رگبارِ باس برنامه‌ریزی کن.",
];

/** Language-aware random field tip. */
export function randomTipFor(lang: Lang, enTips: string[]): string {
  const pool = lang === "fa" ? FIELD_TIPS_FA : enTips;
  return pool[Math.floor(Math.random() * pool.length)];
}
