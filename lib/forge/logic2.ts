/* ================================================================== *
 * Forge · logic2
 * ------------------------------------------------------------------
 * A second, self-contained library of pure helpers powering the
 * extended Forge toolset (100+ additional tools). Everything here is
 * framework-agnostic and runs entirely in the browser.
 * ================================================================== */

import { clamp, shuffleArray, parseColor, rgbToHex, rgbToHsl, hslToHex, type RGB } from "./logic";

export type Res<T> = { ok: true; value: T } | { ok: false; error: string };
export const ok = <T>(value: T): Res<T> => ({ ok: true, value });
export const err = (error: string): Res<never> => ({ ok: false, error });

/* ================================================================== *
 * MATH — expression evaluator (safe, no eval)
 * ================================================================== */

const MATH_FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, sin: Math.sin, cos: Math.cos,
  tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh,
  cosh: Math.cosh, tanh: Math.tanh, ln: Math.log, log: Math.log10, log2: Math.log2,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
  deg: (x) => (x * 180) / Math.PI, rad: (x) => (x * Math.PI) / 180,
};
const MATH_CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };

type Tok = { t: "num" | "op" | "lp" | "rp" | "func" | "comma"; v: string };

function tokenizeExpr(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const s = src.replace(/\s+/g, "");
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let num = "";
      while (i < s.length && /[0-9.eE]/.test(s[i])) {
        // handle scientific notation sign
        if ((s[i] === "e" || s[i] === "E") && (s[i + 1] === "+" || s[i + 1] === "-")) {
          num += s[i] + s[i + 1];
          i += 2;
          continue;
        }
        num += s[i++];
      }
      toks.push({ t: "num", v: num });
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let name = "";
      while (i < s.length && /[a-zA-Z0-9]/.test(s[i])) name += s[i++];
      const lower = name.toLowerCase();
      if (lower in MATH_CONSTS) toks.push({ t: "num", v: String(MATH_CONSTS[lower]) });
      else if (lower in MATH_FUNCS) toks.push({ t: "func", v: lower });
      else throw new Error(`Unknown identifier "${name}"`);
      continue;
    }
    if ("+-*/%^".includes(c)) { toks.push({ t: "op", v: c }); i++; continue; }
    if (c === "(") { toks.push({ t: "lp", v: c }); i++; continue; }
    if (c === ")") { toks.push({ t: "rp", v: c }); i++; continue; }
    if (c === ",") { toks.push({ t: "comma", v: c }); i++; continue; }
    throw new Error(`Unexpected character "${c}"`);
  }
  return toks;
}

const PREC: Record<string, number> = { "+": 2, "-": 2, "*": 3, "/": 3, "%": 3, "^": 4, "u-": 5 };
const RIGHT = new Set(["^", "u-"]);

export function safeMathEval(expr: string): Res<number> {
  if (!expr.trim()) return err("Enter an expression.");
  let toks: Tok[];
  try { toks = tokenizeExpr(expr); } catch (e) { return err(e instanceof Error ? e.message : "Parse error"); }
  // shunting-yard → RPN with unary minus detection
  const out: Tok[] = [];
  const stack: Tok[] = [];
  let prev: Tok | null = null;
  for (const tok of toks) {
    if (tok.t === "num") out.push(tok);
    else if (tok.t === "func") stack.push(tok);
    else if (tok.t === "comma") {
      while (stack.length && stack[stack.length - 1].t !== "lp") out.push(stack.pop()!);
    } else if (tok.t === "op") {
      let op = tok.v;
      const unary = op === "-" && (!prev || prev.t === "op" || prev.t === "lp" || prev.t === "comma");
      if (unary) op = "u-";
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === "op" || top.t === "func") {
          const topOp = top.t === "func" ? "func" : top.v;
          const topPrec = top.t === "func" ? 6 : PREC[topOp];
          if (topPrec > PREC[op] || (topPrec === PREC[op] && !RIGHT.has(op))) out.push(stack.pop()!);
          else break;
        } else break;
      }
      stack.push({ t: "op", v: op });
    } else if (tok.t === "lp") stack.push(tok);
    else if (tok.t === "rp") {
      while (stack.length && stack[stack.length - 1].t !== "lp") out.push(stack.pop()!);
      if (!stack.length) return err("Mismatched parentheses.");
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === "func") out.push(stack.pop()!);
    }
    prev = tok;
  }
  while (stack.length) {
    const t = stack.pop()!;
    if (t.t === "lp") return err("Mismatched parentheses.");
    out.push(t);
  }
  // evaluate RPN
  const es: number[] = [];
  for (const tok of out) {
    if (tok.t === "num") es.push(parseFloat(tok.v));
    else if (tok.t === "func") {
      const a = es.pop();
      if (a == null) return err("Malformed expression.");
      es.push(MATH_FUNCS[tok.v](a));
    } else if (tok.v === "u-") {
      const a = es.pop();
      if (a == null) return err("Malformed expression.");
      es.push(-a);
    } else {
      const b = es.pop(), a = es.pop();
      if (a == null || b == null) return err("Malformed expression.");
      switch (tok.v) {
        case "+": es.push(a + b); break;
        case "-": es.push(a - b); break;
        case "*": es.push(a * b); break;
        case "/": es.push(a / b); break;
        case "%": es.push(a % b); break;
        case "^": es.push(Math.pow(a, b)); break;
      }
    }
  }
  if (es.length !== 1) return err("Malformed expression.");
  if (!isFinite(es[0])) return err("Result is not finite.");
  return ok(es[0]);
}

/* ---- number theory ------------------------------------------------ */
export function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
export function lcm(a: number, b: number): number { if (!a || !b) return 0; return Math.abs(a / gcd(a, b) * b); }

export function gcdLcmOf(nums: number[]): { gcd: number; lcm: number } {
  const g = nums.reduce((acc, n) => gcd(acc, n));
  const l = nums.reduce((acc, n) => lcm(acc, n));
  return { gcd: g, lcm: l };
}

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  if (n % 2 === 0) return n === 2;
  if (n % 3 === 0) return n === 3;
  for (let i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
  return true;
}

export function primeFactors(n: number): { factor: number; power: number }[] {
  n = Math.abs(Math.trunc(n));
  const out: { factor: number; power: number }[] = [];
  for (let d = 2; d * d <= n; d++) {
    let p = 0;
    while (n % d === 0) { n /= d; p++; }
    if (p) out.push({ factor: d, power: p });
  }
  if (n > 1) out.push({ factor: n, power: 1 });
  return out;
}

export function solveQuadratic(a: number, b: number, c: number): { kind: string; roots: string[] } {
  if (a === 0) {
    if (b === 0) return { kind: c === 0 ? "infinite" : "none", roots: [] };
    return { kind: "linear", roots: [String(-c / b)] };
  }
  const disc = b * b - 4 * a * c;
  if (disc > 0) {
    const s = Math.sqrt(disc);
    return { kind: "two real", roots: [((-b + s) / (2 * a)).toString(), ((-b - s) / (2 * a)).toString()] };
  }
  if (disc === 0) return { kind: "one real", roots: [(-b / (2 * a)).toString()] };
  const re = -b / (2 * a), im = Math.sqrt(-disc) / (2 * a);
  return { kind: "complex", roots: [`${re} + ${im}i`, `${re} − ${im}i`] };
}

export function descriptiveStats(nums: number[]): Record<string, number> | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const n = nums.length;
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const counts = new Map<number, number>();
  for (const x of nums) counts.set(x, (counts.get(x) || 0) + 1);
  let mode = sorted[0], best = 0;
  for (const [k, v] of counts) if (v > best) { best = v; mode = k; }
  return {
    count: n, sum, mean, median, mode, min: sorted[0], max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0], variance, stddev: Math.sqrt(variance),
  };
}

export function fibonacci(count: number): string[] {
  count = clamp(Math.trunc(count), 1, 200);
  const out: bigint[] = [0n, 1n];
  for (let i = 2; i < count; i++) out.push(out[i - 1] + out[i - 2]);
  return out.slice(0, count).map(String);
}

export function factorial(n: number): string {
  n = Math.trunc(n);
  if (n < 0) return "undefined";
  if (n > 5000) return "too large";
  let r = 1n;
  for (let i = 2n; i <= BigInt(n); i++) r *= i;
  return r.toString();
}

export function nPr(n: number, r: number): string {
  if (r > n || n < 0 || r < 0) return "0";
  let res = 1n;
  for (let i = 0; i < r; i++) res *= BigInt(n - i);
  return res.toString();
}
export function nCr(n: number, r: number): string {
  if (r > n || n < 0 || r < 0) return "0";
  r = Math.min(r, n - r);
  let num = 1n, den = 1n;
  for (let i = 0; i < r; i++) { num *= BigInt(n - i); den *= BigInt(i + 1); }
  return (num / den).toString();
}

export function formatNumberGroups(input: string, sep = ",", dec = "."): string {
  const clean = input.replace(/[^0-9.\-]/g, "");
  if (!clean) return "";
  const neg = clean.startsWith("-");
  const [int, frac] = clean.replace("-", "").split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (neg ? "-" : "") + grouped + (frac != null ? dec + frac : "");
}

export function simplifyFraction(num: number, den: number): { num: number; den: number; decimal: number } | null {
  if (den === 0) return null;
  const g = gcd(num, den) || 1;
  let n = num / g, d = den / g;
  if (d < 0) { n = -n; d = -d; }
  return { num: n, den: d, decimal: num / den };
}

export function decimalToFraction(x: number, maxDen = 1_000_000): { num: number; den: number } {
  const neg = x < 0; x = Math.abs(x);
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = x;
  do {
    const a = Math.floor(b);
    let aux = h1; h1 = a * h1 + h2; h2 = aux;
    aux = k1; k1 = a * k1 + k2; k2 = aux;
    b = 1 / (b - a);
  } while (Math.abs(x - h1 / k1) > x * 1e-12 && k1 < maxDen && isFinite(b));
  return { num: (neg ? -1 : 1) * h1, den: k1 };
}

export function roundTo(n: number, dp: number, mode: "round" | "floor" | "ceil" | "trunc"): number {
  const f = 10 ** dp;
  const fn = mode === "floor" ? Math.floor : mode === "ceil" ? Math.ceil : mode === "trunc" ? Math.trunc : Math.round;
  return fn(n * f) / f;
}

export function rightTriangle(a?: number, b?: number, c?: number): Record<string, number> | null {
  // c is hypotenuse
  let A = a, B = b, C = c;
  const known = [a, b, c].filter((x) => x != null && x > 0).length;
  if (known < 2) return null;
  if (A != null && B != null) C = Math.hypot(A, B);
  else if (A != null && C != null) { if (C <= A) return null; B = Math.sqrt(C * C - A * A); }
  else if (B != null && C != null) { if (C <= B) return null; A = Math.sqrt(C * C - B * B); }
  if (A == null || B == null || C == null) return null;
  return {
    a: A, b: B, c: C, area: (A * B) / 2, perimeter: A + B + C,
    angleA: (Math.atan2(A, B) * 180) / Math.PI, angleB: (Math.atan2(B, A) * 180) / Math.PI,
  };
}

export function modPow(base: number, exp: number, mod: number): number {
  let result = 1n; let b = BigInt(base) % BigInt(mod); let e = BigInt(exp); const m = BigInt(mod);
  while (e > 0n) { if (e & 1n) result = (result * b) % m; e >>= 1n; b = (b * b) % m; }
  return Number(result);
}
export function modInverse(a: number, m: number): number | null {
  let [old_r, r] = [a % m, m];
  let [old_s, s] = [1, 0];
  while (r !== 0) { const q = Math.floor(old_r / r); [old_r, r] = [r, old_r - q * r]; [old_s, s] = [s, old_s - q * s]; }
  if (old_r !== 1) return null;
  return ((old_s % m) + m) % m;
}

export function convertAnyBase(value: string, from: number, to: number): Res<string> {
  value = value.trim().toLowerCase();
  if (!value) return err("Enter a value.");
  if (from < 2 || from > 36 || to < 2 || to > 36) return err("Bases must be 2–36.");
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
  let dec = 0n; const base = BigInt(from);
  const neg = value.startsWith("-"); if (neg) value = value.slice(1);
  for (const ch of value) {
    const d = digits.indexOf(ch);
    if (d < 0 || d >= from) return err(`"${ch}" is not valid in base ${from}.`);
    dec = dec * base + BigInt(d);
  }
  if (dec === 0n) return ok("0");
  let out = ""; const tb = BigInt(to);
  while (dec > 0n) { out = digits[Number(dec % tb)] + out; dec /= tb; }
  return ok((neg ? "-" : "") + out);
}

export function seriesInfo(kind: "arith" | "geom", first: number, common: number, n: number): { terms: number[]; sum: number } {
  n = clamp(Math.trunc(n), 1, 1000);
  const terms: number[] = [];
  let cur = first;
  for (let i = 0; i < n; i++) { terms.push(cur); cur = kind === "arith" ? cur + common : cur * common; }
  const sum = terms.reduce((a, b) => a + b, 0);
  return { terms, sum };
}

export function toScientific(n: number, sig = 6): string {
  if (n === 0) return "0";
  return n.toExponential(sig).replace(/e([+-])(\d+)/, " × 10^$1$2");
}

/* ---- everyday finance / health ----------------------------------- */
export function compoundInterest(principal: number, ratePct: number, timesPerYear: number, years: number, contribution = 0): { total: number; interest: number; contributed: number } {
  const r = ratePct / 100;
  const n = timesPerYear;
  const t = years;
  const base = principal * Math.pow(1 + r / n, n * t);
  // future value of periodic contributions
  const periods = n * t;
  const ratePer = r / n;
  const fvContrib = ratePer === 0 ? contribution * periods : contribution * ((Math.pow(1 + ratePer, periods) - 1) / ratePer);
  const total = base + fvContrib;
  const contributed = principal + contribution * periods;
  return { total, interest: total - contributed, contributed };
}

export function loanPayment(principal: number, annualRatePct: number, months: number): { monthly: number; total: number; interest: number } {
  const r = annualRatePct / 100 / 12;
  const monthly = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  const total = monthly * months;
  return { monthly, total, interest: total - principal };
}

export function tipCalc(bill: number, tipPct: number, people: number): { tip: number; total: number; perPerson: number } {
  const tip = bill * (tipPct / 100);
  const total = bill + tip;
  return { tip, total, perPerson: people > 0 ? total / people : total };
}

export function discountCalc(price: number, pct: number): { saved: number; final: number } {
  const saved = price * (pct / 100);
  return { saved, final: price - saved };
}

export function bmiCalc(weightKg: number, heightCm: number): { bmi: number; category: string } | null {
  if (heightCm <= 0 || weightKg <= 0) return null;
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  const category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
  return { bmi, category };
}


/* ================================================================== *
 * COLOR
 * ================================================================== */

function hslShift(hex: string, dh: number): string | null {
  const rgb = parseColor(hex); if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);
  return hslToHex((h + dh + 360) % 360, s, l);
}

export function colorHarmonies(hex: string): Record<string, string[]> | null {
  const rgb = parseColor(hex); if (!rgb) return null;
  const base = rgbToHex(rgb);
  const at = (d: number) => hslShift(base, d)!;
  return {
    complementary: [base, at(180)],
    analogous: [at(-30), base, at(30)],
    triadic: [base, at(120), at(240)],
    "split-complement": [base, at(150), at(210)],
    tetradic: [base, at(90), at(180), at(270)],
    "monochrome": [base, ...[10, 20, 30, -10, -20].map((d) => {
      const { h, s, l } = rgbToHsl(rgb); return hslToHex(h, s, clamp(l + d, 0, 100));
    })],
  };
}

export function randomPalette(count = 5): string[] {
  const baseHue = Math.floor(Math.random() * 360);
  return Array.from({ length: count }, (_, i) => {
    const h = (baseHue + i * (360 / count) + (Math.random() * 20 - 10)) % 360;
    const s = 55 + Math.random() * 35;
    const l = 40 + Math.random() * 30;
    return hslToHex(h, s, l);
  });
}

export function rgbToCmyk(r: number, g: number, b: number): { c: number; m: number; y: number; k: number } {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  const c = (1 - rr - k) / (1 - k);
  const m = (1 - gg - k) / (1 - k);
  const y = (1 - bb - k) / (1 - k);
  return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) };
}
export function cmykToRgb(c: number, m: number, y: number, k: number): RGB {
  c /= 100; m /= 100; y /= 100; k /= 100;
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  };
}

export function adjustColor(hex: string, opts: { lightness?: number; saturation?: number; hue?: number }): string | null {
  const rgb = parseColor(hex); if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);
  return hslToHex(
    (h + (opts.hue || 0) + 360) % 360,
    clamp(s + (opts.saturation || 0), 0, 100),
    clamp(l + (opts.lightness || 0), 0, 100),
  );
}

export function tintsAndShades(hex: string): { tints: string[]; shades: string[] } | null {
  const rgb = parseColor(hex); if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);
  const tints = [0.8, 0.6, 0.4, 0.2].map((t) => hslToHex(h, s, clamp(l + (100 - l) * t, 0, 100)));
  const shades = [0.2, 0.4, 0.6, 0.8].map((t) => hslToHex(h, s, clamp(l * (1 - t), 0, 100)));
  return { tints, shades };
}

const CSS_NAMED_COLORS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", lime: "#00ff00", blue: "#0000ff",
  yellow: "#ffff00", cyan: "#00ffff", magenta: "#ff00ff", silver: "#c0c0c0", gray: "#808080",
  maroon: "#800000", olive: "#808000", green: "#008000", purple: "#800080", teal: "#008080",
  navy: "#000080", orange: "#ffa500", pink: "#ffc0cb", brown: "#a52a2a", gold: "#ffd700",
  coral: "#ff7f50", salmon: "#fa8072", crimson: "#dc143c", indigo: "#4b0082", violet: "#ee82ee",
  turquoise: "#40e0d0", tan: "#d2b48c", khaki: "#f0e68c", lavender: "#e6e6fa", plum: "#dda0dd",
  orchid: "#da70d6", tomato: "#ff6347", "sky blue": "#87ceeb", "steel blue": "#4682b4",
  "sea green": "#2e8b57", "forest green": "#228b22", "slate gray": "#708090", chocolate: "#d2691e",
};

export function nearestColorName(hex: string): { name: string; hex: string; distance: number } | null {
  const rgb = parseColor(hex); if (!rgb) return null;
  let best = { name: "", hex: "", distance: Infinity };
  for (const [name, val] of Object.entries(CSS_NAMED_COLORS)) {
    const c = parseColor(val)!;
    const d = Math.sqrt((rgb.r - c.r) ** 2 + (rgb.g - c.g) ** 2 + (rgb.b - c.b) ** 2);
    if (d < best.distance) best = { name, hex: val, distance: Math.round(d) };
  }
  return best;
}

export function withAlpha(hex: string, alpha: number): { hex8: string; rgba: string } | null {
  const rgb = parseColor(hex); if (!rgb) return null;
  const a = clamp(alpha, 0, 1);
  const hh = Math.round(a * 255).toString(16).padStart(2, "0");
  return { hex8: rgbToHex(rgb) + hh, rgba: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})` };
}

/* ================================================================== *
 * TEXT
 * ================================================================== */

export function dedupeLines(text: string, opts: { trim: boolean; ci: boolean; sort: boolean }): { output: string; removed: number } {
  let lines = text.split("\n");
  if (opts.trim) lines = lines.map((l) => l.trim());
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const l of lines) {
    const key = opts.ci ? l.toLowerCase() : l;
    if (!seen.has(key)) { seen.add(key); kept.push(l); }
  }
  if (opts.sort) kept.sort((a, b) => a.localeCompare(b));
  return { output: kept.join("\n"), removed: lines.length - kept.length };
}

export function countOccurrences(text: string, needle: string, ci: boolean): number {
  if (!needle) return 0;
  const hay = ci ? text.toLowerCase() : text;
  const n = ci ? needle.toLowerCase() : needle;
  let count = 0, idx = 0;
  while ((idx = hay.indexOf(n, idx)) !== -1) { count++; idx += n.length; }
  return count;
}

export function reverseWords(text: string): string {
  return text.split("\n").map((line) => line.split(/(\s+)/).reverse().join("")).join("\n");
}

export function sortWords(text: string, dir: "asc" | "desc" | "len"): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (dir === "asc") words.sort((a, b) => a.localeCompare(b));
  else if (dir === "desc") words.sort((a, b) => b.localeCompare(a));
  else words.sort((a, b) => a.length - b.length);
  return words.join(" ");
}

export function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function extractPattern(text: string, kind: "email" | "url" | "number" | "ip" | "hashtag" | "mention"): string[] {
  const patterns: Record<string, RegExp> = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    url: /https?:\/\/[^\s<>"')]+/g,
    number: /-?\d+(?:\.\d+)?/g,
    ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    hashtag: /#[\w]+/g,
    mention: /@[\w]+/g,
  };
  const m = text.match(patterns[kind]);
  return m ? Array.from(new Set(m)) : [];
}

const NATO: Record<string, string> = {
  a: "Alfa", b: "Bravo", c: "Charlie", d: "Delta", e: "Echo", f: "Foxtrot", g: "Golf",
  h: "Hotel", i: "India", j: "Juliett", k: "Kilo", l: "Lima", m: "Mike", n: "November",
  o: "Oscar", p: "Papa", q: "Quebec", r: "Romeo", s: "Sierra", t: "Tango", u: "Uniform",
  v: "Victor", w: "Whiskey", x: "X-ray", y: "Yankee", z: "Zulu",
  "0": "Zero", "1": "One", "2": "Two", "3": "Three", "4": "Four", "5": "Five",
  "6": "Six", "7": "Seven", "8": "Eight", "9": "Nine",
};
export function toNato(text: string): string {
  return text.toLowerCase().split("").map((c) => NATO[c] || (c === " " ? "(space)" : c)).filter(Boolean).join(" ");
}

const LEET: Record<string, string> = { a: "4", b: "8", e: "3", g: "6", i: "1", l: "1", o: "0", s: "5", t: "7", z: "2" };
export function toLeet(text: string): string {
  return text.split("").map((c) => LEET[c.toLowerCase()] || c).join("");
}

export function rot47(text: string): string {
  return text.split("").map((c) => {
    const code = c.charCodeAt(0);
    if (code >= 33 && code <= 126) return String.fromCharCode(33 + ((code - 33 + 47) % 94));
    return c;
  }).join("");
}

export function wrapText(text: string, cols: number): string {
  cols = clamp(cols, 1, 500);
  return text.split("\n").map((para) => {
    const words = para.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if (cur && (cur + " " + w).length > cols) { lines.push(cur); cur = w; }
      else cur = cur ? cur + " " + w : w;
    }
    if (cur) lines.push(cur);
    return lines.join("\n");
  }).join("\n");
}

export function padText(text: string, width: number, ch: string, side: "left" | "right"): string {
  const pad = ch || " ";
  return text.split("\n").map((l) => side === "left" ? l.padStart(width, pad) : l.padEnd(width, pad)).join("\n");
}

export function truncateText(text: string, len: number, ellipsis: string): string {
  if (text.length <= len) return text;
  return text.slice(0, Math.max(0, len - ellipsis.length)) + ellipsis;
}

export function isPalindrome(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean.length > 0 && clean === clean.split("").reverse().join("");
}

export function isAnagram(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").split("").sort().join("");
  return norm(a).length > 0 && norm(a) === norm(b);
}

export function columnToNumber(col: string): number {
  let n = 0;
  for (const c of col.toUpperCase()) {
    if (c < "A" || c > "Z") return NaN;
    n = n * 26 + (c.charCodeAt(0) - 64);
  }
  return n;
}
export function numberToColumn(n: number): string {
  if (n < 1) return "";
  let s = "";
  while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const FANCY_MAPS: Record<string, (c: string) => string> = {
  circled: (c) => { const i = c.toLowerCase().charCodeAt(0) - 97; return i >= 0 && i < 26 ? String.fromCodePoint(0x24d0 + i) : c; },
  bold: (c) => { const i = c.charCodeAt(0); if (i >= 65 && i <= 90) return String.fromCodePoint(0x1d400 + i - 65); if (i >= 97 && i <= 122) return String.fromCodePoint(0x1d41a + i - 97); return c; },
  italic: (c) => { const i = c.charCodeAt(0); if (i >= 65 && i <= 90) return String.fromCodePoint(0x1d434 + i - 65); if (i >= 97 && i <= 122) return String.fromCodePoint(0x1d44e + i - 97); return c; },
  script: (c) => { const i = c.charCodeAt(0); if (i >= 65 && i <= 90) return String.fromCodePoint(0x1d49c + i - 65); if (i >= 97 && i <= 122) return String.fromCodePoint(0x1d4b6 + i - 97); return c; },
  fullwidth: (c) => { const i = c.charCodeAt(0); return i >= 33 && i <= 126 ? String.fromCodePoint(0xff00 + i - 32) : c; },
};
export function fancyText(text: string, style: string): string {
  const fn = FANCY_MAPS[style]; if (!fn) return text;
  return text.split("").map(fn).join("");
}

export function removeLineBreaks(text: string, replaceWith: string): string {
  return text.replace(/\r?\n/g, replaceWith === "\\n" ? "\n" : replaceWith);
}


/* ================================================================== *
 * ENCODE / CRYPTO
 * ================================================================== */

/* ---- Punycode (RFC 3492) ----------------------------------------- */
const PUNY = { base: 36, tmin: 1, tmax: 26, skew: 38, damp: 700, initialBias: 72, initialN: 128, delim: "-" };
function punyAdapt(delta: number, numPoints: number, first: boolean): number {
  delta = first ? Math.floor(delta / PUNY.damp) : delta >> 1;
  delta += Math.floor(delta / numPoints);
  let k = 0;
  while (delta > ((PUNY.base - PUNY.tmin) * PUNY.tmax) >> 1) { delta = Math.floor(delta / (PUNY.base - PUNY.tmin)); k += PUNY.base; }
  return k + Math.floor(((PUNY.base - PUNY.tmin + 1) * delta) / (delta + PUNY.skew));
}
function punyEncodeLabel(input: string): string {
  const cps = Array.from(input).map((c) => c.codePointAt(0)!);
  const basic = cps.filter((c) => c < 128);
  let n = PUNY.initialN, delta = 0, bias = PUNY.initialBias;
  let output = basic.map((c) => String.fromCodePoint(c)).join("");
  let handled = basic.length;
  const basicLen = handled;
  if (basicLen > 0) output += PUNY.delim;
  const digits = "abcdefghijklmnopqrstuvwxyz0123456789";
  while (handled < cps.length) {
    let m = Infinity;
    for (const c of cps) if (c >= n && c < m) m = c;
    delta += (m - n) * (handled + 1);
    n = m;
    for (const c of cps) {
      if (c < n) delta++;
      if (c === n) {
        let q = delta;
        for (let k = PUNY.base; ; k += PUNY.base) {
          const t = k <= bias ? PUNY.tmin : k >= bias + PUNY.tmax ? PUNY.tmax : k - bias;
          if (q < t) break;
          output += digits[t + ((q - t) % (PUNY.base - t))];
          q = Math.floor((q - t) / (PUNY.base - t));
        }
        output += digits[q];
        bias = punyAdapt(delta, handled + 1, handled === basicLen);
        delta = 0; handled++;
      }
    }
    delta++; n++;
  }
  return output;
}
export function punycodeEncode(domain: string): string {
  return domain.split(".").map((l) => (/[^\x00-\x7F]/.test(l) ? "xn--" + punyEncodeLabel(l) : l)).join(".");
}
function punyDecodeLabel(input: string): string {
  const digits = "abcdefghijklmnopqrstuvwxyz0123456789";
  let n = PUNY.initialN, i = 0, bias = PUNY.initialBias;
  const delimIdx = input.lastIndexOf(PUNY.delim);
  const output: number[] = [];
  const basic = delimIdx > 0 ? input.slice(0, delimIdx) : "";
  for (const c of basic) output.push(c.codePointAt(0)!);
  let idx = delimIdx > 0 ? delimIdx + 1 : 0;
  while (idx < input.length) {
    const oldi = i;
    for (let w = 1, k = PUNY.base; ; k += PUNY.base) {
      const d = digits.indexOf(input[idx++]);
      if (d < 0) throw new Error("Invalid punycode");
      i += d * w;
      const t = k <= bias ? PUNY.tmin : k >= bias + PUNY.tmax ? PUNY.tmax : k - bias;
      if (d < t) break;
      w *= PUNY.base - t;
    }
    const outLen = output.length + 1;
    bias = punyAdapt(i - oldi, outLen, oldi === 0);
    n += Math.floor(i / outLen);
    i %= outLen;
    output.splice(i, 0, n);
    i++;
  }
  return output.map((c) => String.fromCodePoint(c)).join("");
}
export function punycodeDecode(domain: string): Res<string> {
  try {
    return ok(domain.split(".").map((l) => (l.startsWith("xn--") ? punyDecodeLabel(l.slice(4)) : l)).join("."));
  } catch (e) { return err(e instanceof Error ? e.message : "Decode failed"); }
}

/* ---- Quoted-printable -------------------------------------------- */
export function quotedPrintableEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (const b of bytes) {
    if ((b >= 33 && b <= 126 && b !== 61) || b === 32 || b === 9) out += String.fromCharCode(b);
    else out += "=" + b.toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}
export function quotedPrintableDecode(text: string): Res<string> {
  try {
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === "=") {
        const hex = text.slice(i + 1, i + 3);
        if (hex === "\r\n" || hex === "\n") { i += hex.length; continue; }
        bytes.push(parseInt(hex, 16)); i += 2;
      } else bytes.push(text.charCodeAt(i));
    }
    return ok(new TextDecoder().decode(new Uint8Array(bytes)));
  } catch { return err("Decode failed"); }
}

/* ---- XOR cipher (hex output) ------------------------------------- */
export function xorCipher(text: string, key: string, decode: boolean): Res<string> {
  if (!key) return err("Enter a key.");
  const keyBytes = new TextEncoder().encode(key);
  if (decode) {
    const clean = text.replace(/\s+/g, "");
    if (clean.length % 2) return err("Hex input must have even length.");
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i += 2) {
      const b = parseInt(clean.slice(i, i + 2), 16);
      if (isNaN(b)) return err("Invalid hex.");
      bytes.push(b ^ keyBytes[(i / 2) % keyBytes.length]);
    }
    return ok(new TextDecoder().decode(new Uint8Array(bytes)));
  }
  const input = new TextEncoder().encode(text);
  let out = "";
  for (let i = 0; i < input.length; i++) out += (input[i] ^ keyBytes[i % keyBytes.length]).toString(16).padStart(2, "0");
  return ok(out);
}

/* ---- Vigenère ----------------------------------------------------- */
export function vigenere(text: string, key: string, decode: boolean): Res<string> {
  const k = key.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return err("Key must contain letters.");
  let ki = 0;
  const out = text.split("").map((ch) => {
    const isUpper = ch >= "A" && ch <= "Z";
    const isLower = ch >= "a" && ch <= "z";
    if (!isUpper && !isLower) return ch;
    const base = isUpper ? 65 : 97;
    const shift = k.charCodeAt(ki % k.length) - 97;
    ki++;
    const c = ch.charCodeAt(0) - base;
    const res = decode ? (c - shift + 26) % 26 : (c + shift) % 26;
    return String.fromCharCode(base + res);
  }).join("");
  return ok(out);
}

/* ---- Rail fence --------------------------------------------------- */
export function railFence(text: string, rails: number, decode: boolean): Res<string> {
  rails = Math.trunc(rails);
  if (rails < 2) return err("Rails must be ≥ 2.");
  if (!decode) {
    const rows: string[] = Array.from({ length: rails }, () => "");
    let r = 0, dir = 1;
    for (const c of text) { rows[r] += c; if (r === 0) dir = 1; else if (r === rails - 1) dir = -1; r += dir; }
    return ok(rows.join(""));
  }
  const len = text.length;
  const pattern: number[] = [];
  let r = 0, dir = 1;
  for (let i = 0; i < len; i++) { pattern.push(r); if (r === 0) dir = 1; else if (r === rails - 1) dir = -1; r += dir; }
  const counts = Array.from({ length: rails }, (_, i) => pattern.filter((x) => x === i).length);
  const rowStrs: string[] = []; let pos = 0;
  for (let i = 0; i < rails; i++) { rowStrs.push(text.slice(pos, pos + counts[i])); pos += counts[i]; }
  const idx = Array(rails).fill(0);
  let out = "";
  for (const p of pattern) out += rowStrs[p][idx[p]++];
  return ok(out);
}

/* ---- HMAC / TOTP (async, uses SubtleCrypto) ---------------------- */
export async function hmacHex(message: string, key: string, algo: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512"): Promise<string> {
  const enc = new TextEncoder();
  const ck = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: algo }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", ck, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base32ToBytes(s: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  s = s.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = "";
  for (const c of s) { const v = alphabet.indexOf(c); if (v < 0) throw new Error("Invalid Base32"); bits += v.toString(2).padStart(5, "0"); }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}
export async function totpCode(secret: string, opts: { digits: number; period: number; algo: "SHA-1" | "SHA-256" | "SHA-512"; time?: number }): Promise<Res<{ code: string; secondsLeft: number }>> {
  try {
    const key = base32ToBytes(secret);
    const t = Math.floor((opts.time ?? Date.now()) / 1000);
    const counter = Math.floor(t / opts.period);
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(4, counter);
    const ck = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: opts.algo }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", ck, buf));
    const offset = sig[sig.length - 1] & 0xf;
    const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3];
    const code = (bin % 10 ** opts.digits).toString().padStart(opts.digits, "0");
    return ok({ code, secondsLeft: opts.period - (t % opts.period) });
  } catch (e) { return err(e instanceof Error ? e.message : "Invalid secret"); }
}

/* ---- Ascii85 ------------------------------------------------------ */
export function ascii85Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.slice(i, i + 4);
    const pad = 4 - chunk.length;
    let n = 0;
    for (let j = 0; j < 4; j++) n = n * 256 + (chunk[j] || 0);
    if (n === 0 && pad === 0) { out += "z"; continue; }
    const group: string[] = [];
    for (let j = 0; j < 5; j++) { group.unshift(String.fromCharCode(33 + (n % 85))); n = Math.floor(n / 85); }
    out += group.join("").slice(0, 5 - pad);
  }
  return "<~" + out + "~>";
}
export function ascii85Decode(text: string): Res<string> {
  try {
    let s = text.trim().replace(/^<~/, "").replace(/~>$/, "").replace(/\s+/g, "");
    const bytes: number[] = [];
    let i = 0;
    while (i < s.length) {
      if (s[i] === "z") { bytes.push(0, 0, 0, 0); i++; continue; }
      const chunk = s.slice(i, i + 5);
      const pad = 5 - chunk.length;
      let n = 0;
      for (let j = 0; j < 5; j++) { const c = j < chunk.length ? chunk.charCodeAt(j) - 33 : 84; if (c < 0 || c > 84) return err("Invalid Ascii85 character."); n = n * 85 + c; }
      const out4 = [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
      for (let j = 0; j < 4 - pad; j++) bytes.push(out4[j]);
      i += 5;
    }
    return ok(new TextDecoder().decode(new Uint8Array(bytes)));
  } catch { return err("Decode failed"); }
}

/* ---- UUID inspector ---------------------------------------------- */
export function inspectUuid(uuid: string): Res<{ valid: boolean; version: number; variant: string; timestamp?: string }> {
  const clean = uuid.trim().toLowerCase();
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!re.test(clean)) return err("Not a valid UUID format.");
  const version = parseInt(clean[14], 16);
  const variantNibble = parseInt(clean[19], 16);
  let variant = "reserved";
  if (variantNibble < 8) variant = "NCS (legacy)";
  else if (variantNibble < 12) variant = "RFC 4122";
  else if (variantNibble < 14) variant = "Microsoft";
  const result: { valid: boolean; version: number; variant: string; timestamp?: string } = { valid: true, version, variant };
  if (version === 1) {
    const hex = clean.replace(/-/g, "");
    const timeHigh = hex.slice(12, 16), timeMid = hex.slice(8, 12), timeLow = hex.slice(0, 8);
    const ticks = BigInt("0x" + timeHigh.slice(1) + timeMid + timeLow);
    const ms = Number(ticks / 10000n) - 12219292800000;
    result.timestamp = new Date(ms).toISOString();
  }
  return ok(result);
}

/* ---- Text ⇄ Hex, Unicode escape ---------------------------------- */
export function textToHex(text: string, sep = " "): string {
  return Array.from(new TextEncoder().encode(text)).map((b) => b.toString(16).padStart(2, "0")).join(sep);
}
export function hexToTextStr(hex: string): Res<string> {
  const clean = hex.replace(/0x/gi, "").replace(/[\s,]+/g, "");
  if (clean.length % 2) return err("Hex must have even length.");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) { const b = parseInt(clean.slice(i, i + 2), 16); if (isNaN(b)) return err("Invalid hex."); bytes.push(b); }
  return ok(new TextDecoder().decode(new Uint8Array(bytes)));
}
export function unicodeEscape(text: string): string {
  return text.split("").map((c) => { const code = c.charCodeAt(0); return code > 127 ? "\\u" + code.toString(16).padStart(4, "0") : c; }).join("");
}
export function unicodeUnescape(text: string): Res<string> {
  try { return ok(text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))); }
  catch { return err("Invalid escape sequence."); }
}


/* ================================================================== *
 * DEVELOPER UTILITIES
 * ================================================================== */

/* ---- Semantic versioning ----------------------------------------- */
type SemVer = { major: number; minor: number; patch: number; pre: string[]; build: string };
function parseSemver(v: string): SemVer | null {
  const m = v.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split(".") : [], build: m[5] || "" };
}
export function semverCompare(a: string, b: string): Res<{ result: number; label: string }> {
  const A = parseSemver(a), B = parseSemver(b);
  if (!A || !B) return err("Both inputs must be valid semver (e.g. 1.2.3).");
  for (const k of ["major", "minor", "patch"] as const) {
    if (A[k] !== B[k]) { const r = A[k] > B[k] ? 1 : -1; return ok({ result: r, label: describeSemver(r, a, b) }); }
  }
  if (A.pre.length && !B.pre.length) return ok({ result: -1, label: describeSemver(-1, a, b) });
  if (!A.pre.length && B.pre.length) return ok({ result: 1, label: describeSemver(1, a, b) });
  for (let i = 0; i < Math.max(A.pre.length, B.pre.length); i++) {
    const x = A.pre[i], y = B.pre[i];
    if (x === undefined) return ok({ result: -1, label: describeSemver(-1, a, b) });
    if (y === undefined) return ok({ result: 1, label: describeSemver(1, a, b) });
    if (x !== y) { const r = (isNaN(+x) || isNaN(+y)) ? x.localeCompare(y) : +x - +y; const rr = r > 0 ? 1 : -1; return ok({ result: rr, label: describeSemver(rr, a, b) }); }
  }
  return ok({ result: 0, label: `${a} is equal to ${b}` });
}
function describeSemver(r: number, a: string, b: string): string { return r > 0 ? `${a} is greater than ${b}` : `${a} is less than ${b}`; }
export function semverBump(v: string, type: "major" | "minor" | "patch" | "premajor" | "preminor" | "prepatch" | "prerelease"): Res<string> {
  const p = parseSemver(v); if (!p) return err("Invalid semver.");
  switch (type) {
    case "major": return ok(`${p.major + 1}.0.0`);
    case "minor": return ok(`${p.major}.${p.minor + 1}.0`);
    case "patch": return ok(`${p.major}.${p.minor}.${p.patch + 1}`);
    case "premajor": return ok(`${p.major + 1}.0.0-0`);
    case "preminor": return ok(`${p.major}.${p.minor + 1}.0-0`);
    case "prepatch": return ok(`${p.major}.${p.minor}.${p.patch + 1}-0`);
    case "prerelease": {
      const last = p.pre[p.pre.length - 1];
      if (p.pre.length && !isNaN(+last)) return ok(`${p.major}.${p.minor}.${p.patch}-${[...p.pre.slice(0, -1), +last + 1].join(".")}`);
      return ok(`${p.major}.${p.minor}.${p.patch}-${p.pre.length ? p.pre.join(".") + ".0" : "0"}`);
    }
  }
}

/* ---- JSON ⇄ YAML (subset) ---------------------------------------- */
function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return "\n" + value.map((v) => `${pad}- ${toYaml(v, indent + 1).replace(/^\n/, "").replace(new RegExp("^" + "  ".repeat(indent + 1)), "")}`).join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return "{}";
    return "\n" + entries.map(([k, v]) => {
      const rendered = toYaml(v, indent + 1);
      return `${pad}${k}:${rendered.startsWith("\n") ? rendered : " " + rendered}`;
    }).join("\n");
  }
  if (typeof value === "string") return /[:#\-?{}\[\],&*!|>'"%@`\n]/.test(value) || value === "" ? JSON.stringify(value) : value;
  return String(value);
}
export function jsonToYaml(json: string): Res<string> {
  try { const parsed = JSON.parse(json); const y = toYaml(parsed, 0); return ok(y.replace(/^\n/, "")); }
  catch (e) { return err(e instanceof Error ? e.message : "Invalid JSON"); }
}

function parseYamlValue(raw: string): unknown {
  const v = raw.trim();
  if (v === "" || v === "~" || v === "null") return null;
  if (v === "true") return true; if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}
export function yamlToJson(yaml: string, indent = 2): Res<string> {
  try {
    const lines = yaml.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    const root: Record<string, unknown> = {};
    const stack: { indent: number; container: Record<string, unknown> | unknown[] }[] = [{ indent: -1, container: root }];
    for (const line of lines) {
      const ind = line.match(/^ */)![0].length;
      const content = line.trim();
      while (stack.length > 1 && ind <= stack[stack.length - 1].indent) stack.pop();
      const parent = stack[stack.length - 1].container;
      if (content.startsWith("- ")) {
        const val = content.slice(2);
        if (!Array.isArray(parent)) throw new Error("List item without a list context.");
        if (val.includes(":")) {
          const obj: Record<string, unknown> = {};
          const [k, ...rest] = val.split(":");
          obj[k.trim()] = parseYamlValue(rest.join(":"));
          parent.push(obj);
        } else parent.push(parseYamlValue(val));
      } else {
        const ci = content.indexOf(":");
        const key = content.slice(0, ci).trim();
        const rest = content.slice(ci + 1).trim();
        if (Array.isArray(parent)) throw new Error("Mapping inside a list needs '-'.");
        if (rest === "") {
          const nextIsList = false;
          const container: Record<string, unknown> | unknown[] = nextIsList ? [] : {};
          (parent as Record<string, unknown>)[key] = container;
          stack.push({ indent: ind, container });
        } else {
          (parent as Record<string, unknown>)[key] = parseYamlValue(rest);
        }
      }
    }
    return ok(JSON.stringify(root, null, indent));
  } catch (e) { return err(e instanceof Error ? e.message : "Invalid YAML"); }
}

/* ---- SQL formatter ------------------------------------------------ */
export function formatSql(sql: string): string {
  const keywords = ["SELECT", "FROM", "WHERE", "AND", "OR", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "JOIN", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "UNION", "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "ON"];
  let out = sql.replace(/\s+/g, " ").trim();
  for (const kw of keywords) {
    out = out.replace(new RegExp(`\\b${kw.replace(/ /g, "\\s+")}\\b`, "gi"), "\n" + kw);
  }
  out = out.replace(/,\s*/g, ",\n  ");
  return out.split("\n").map((l) => {
    const t = l.trim();
    if (/^(AND|OR|ON)\b/i.test(t)) return "  " + t;
    return t;
  }).join("\n").trim();
}

/* ---- Minifiers ---------------------------------------------------- */
export function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*([{}:;,>~+])\s*/g, "$1")
    .replace(/;}/g, "}")
    .replace(/\s+/g, " ")
    .trim();
}
export function minifyHtml(html: string): string {
  return html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* ---- JSON ⇄ XML --------------------------------------------------- */
function objToXml(obj: unknown, tag: string, indent: number): string {
  const pad = "  ".repeat(indent);
  if (obj === null || obj === undefined) return `${pad}<${tag}/>`;
  if (Array.isArray(obj)) return obj.map((v) => objToXml(v, tag, indent)).join("\n");
  if (typeof obj === "object") {
    const inner = Object.entries(obj as Record<string, unknown>).map(([k, v]) => objToXml(v, k.replace(/[^\w.-]/g, "_"), indent + 1)).join("\n");
    return `${pad}<${tag}>\n${inner}\n${pad}</${tag}>`;
  }
  return `${pad}<${tag}>${String(obj).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</${tag}>`;
}
export function jsonToXml(json: string, root = "root"): Res<string> {
  try { return ok(`<?xml version="1.0" encoding="UTF-8"?>\n${objToXml(JSON.parse(json), root, 0)}`); }
  catch (e) { return err(e instanceof Error ? e.message : "Invalid JSON"); }
}

/* ---- JSON diff ---------------------------------------------------- */
export type DiffEntry = { path: string; type: "added" | "removed" | "changed"; a?: string; b?: string };
function walkDiff(a: unknown, b: unknown, path: string, out: DiffEntry[]) {
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    out.push({ path: path || "(root)", type: "changed", a: JSON.stringify(a), b: JSON.stringify(b) }); return;
  }
  if (a && b && typeof a === "object") {
    const ak = Object.keys(a as object), bk = Object.keys(b as object);
    for (const k of new Set([...ak, ...bk])) {
      const p = path ? `${path}.${k}` : k;
      const av = (a as Record<string, unknown>)[k], bv = (b as Record<string, unknown>)[k];
      if (!(k in (a as object))) out.push({ path: p, type: "added", b: JSON.stringify(bv) });
      else if (!(k in (b as object))) out.push({ path: p, type: "removed", a: JSON.stringify(av) });
      else walkDiff(av, bv, p, out);
    }
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    out.push({ path: path || "(root)", type: "changed", a: JSON.stringify(a), b: JSON.stringify(b) });
  }
}
export function jsonDiff(aStr: string, bStr: string): Res<DiffEntry[]> {
  try { const out: DiffEntry[] = []; walkDiff(JSON.parse(aStr), JSON.parse(bStr), "", out); return ok(out); }
  catch (e) { return err(e instanceof Error ? e.message : "Invalid JSON on one side"); }
}

/* ---- Flatten / unflatten JSON ------------------------------------ */
export function flattenJson(json: string): Res<string> {
  try {
    const obj = JSON.parse(json);
    const out: Record<string, unknown> = {};
    const walk = (o: unknown, prefix: string) => {
      if (o && typeof o === "object" && !Array.isArray(o)) {
        for (const [k, v] of Object.entries(o)) walk(v, prefix ? `${prefix}.${k}` : k);
      } else if (Array.isArray(o)) {
        o.forEach((v, i) => walk(v, `${prefix}[${i}]`));
      } else out[prefix] = o;
    };
    walk(obj, "");
    return ok(JSON.stringify(out, null, 2));
  } catch (e) { return err(e instanceof Error ? e.message : "Invalid JSON"); }
}

/* ---- Escape regex ------------------------------------------------- */
export function escapeRegex(str: string): string { return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/* ---- HTTP header parser ------------------------------------------ */
export function parseHeaders(raw: string): { name: string; value: string }[] {
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const idx = l.indexOf(":");
    if (idx < 0) return { name: l, value: "" };
    return { name: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
  });
}

/* ---- User-agent parser ------------------------------------------- */
export function parseUserAgent(ua: string): Record<string, string> {
  const out: Record<string, string> = { browser: "Unknown", version: "", os: "Unknown", device: "Desktop", engine: "Unknown" };
  const browsers: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, "Edge"], [/OPR\/([\d.]+)/, "Opera"], [/Chrome\/([\d.]+)/, "Chrome"],
    [/Firefox\/([\d.]+)/, "Firefox"], [/Version\/([\d.]+).*Safari/, "Safari"], [/MSIE ([\d.]+)/, "IE"],
  ];
  for (const [re, name] of browsers) { const m = ua.match(re); if (m) { out.browser = name; out.version = m[1]; break; } }
  if (/Windows NT 10/.test(ua)) out.os = "Windows 10/11";
  else if (/Mac OS X/.test(ua)) out.os = "macOS";
  else if (/Android/.test(ua)) { out.os = "Android"; out.device = "Mobile"; }
  else if (/iPhone|iPad/.test(ua)) { out.os = "iOS"; out.device = /iPad/.test(ua) ? "Tablet" : "Mobile"; }
  else if (/Linux/.test(ua)) out.os = "Linux";
  if (/Gecko\//.test(ua)) out.engine = "Gecko";
  else if (/AppleWebKit/.test(ua)) out.engine = "WebKit/Blink";
  else if (/Trident/.test(ua)) out.engine = "Trident";
  return out;
}

/* ---- MIME lookup -------------------------------------------------- */
export const MIME_TYPES: Record<string, string> = {
  html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
  json: "application/json", xml: "application/xml", txt: "text/plain", csv: "text/csv", md: "text/markdown",
  pdf: "application/pdf", zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml",
  webp: "image/webp", ico: "image/x-icon", bmp: "image/bmp", avif: "image/avif",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", eot: "application/vnd.ms-fontobject",
  wasm: "application/wasm", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export function mimeLookup(query: string): { ext: string; mime: string }[] {
  const q = query.toLowerCase().replace(/^\./, "").trim();
  if (!q) return Object.entries(MIME_TYPES).map(([ext, mime]) => ({ ext, mime }));
  return Object.entries(MIME_TYPES).filter(([ext, mime]) => ext.includes(q) || mime.includes(q)).map(([ext, mime]) => ({ ext, mime }));
}

/* ---- Cron next runs ---------------------------------------------- */
function parseCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    let step = 1, range = part;
    if (part.includes("/")) { const [r, s] = part.split("/"); range = r; step = parseInt(s, 10); }
    let lo = min, hi = max;
    if (range === "*") { /* full */ }
    else if (range.includes("-")) { const [a, b] = range.split("-"); lo = parseInt(a, 10); hi = parseInt(b, 10); }
    else { lo = hi = parseInt(range, 10); }
    for (let v = lo; v <= hi; v += step) if (v >= min && v <= max) values.add(v);
  }
  return [...values].sort((a, b) => a - b);
}
export function cronNextRuns(expr: string, count: number, from = new Date()): Res<string[]> {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return err("Expected 5 fields: minute hour day month weekday.");
  try {
    const [min, hr, dom, mon, dow] = [
      parseCronField(parts[0], 0, 59), parseCronField(parts[1], 0, 23),
      parseCronField(parts[2], 1, 31), parseCronField(parts[3], 1, 12), parseCronField(parts[4], 0, 6),
    ];
    const runs: string[] = [];
    const d = new Date(from.getTime());
    d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
    let iterations = 0;
    while (runs.length < count && iterations < 5_000_000) {
      iterations++;
      if (min.includes(d.getMinutes()) && hr.includes(d.getHours()) && mon.includes(d.getMonth() + 1) &&
          dom.includes(d.getDate()) && dow.includes(d.getDay())) {
        runs.push(d.toLocaleString());
      }
      d.setMinutes(d.getMinutes() + 1);
    }
    if (!runs.length) return err("No upcoming runs found (check the expression).");
    return ok(runs);
  } catch { return err("Could not parse the expression."); }
}

/* ---- Query-string builder ---------------------------------------- */
export function buildQueryString(pairs: { key: string; value: string }[]): string {
  const params = pairs.filter((p) => p.key).map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);
  return params.length ? "?" + params.join("&") : "";
}


/* ================================================================== *
 * UNIT CONVERTERS (factor-based)
 * ================================================================== */
export type UnitMap = { id: string; label: string; factor: number }[];

export const ANGLE_UNITS: UnitMap = [
  { id: "deg", label: "Degrees", factor: 1 }, { id: "rad", label: "Radians", factor: 180 / Math.PI },
  { id: "grad", label: "Gradians", factor: 0.9 }, { id: "turn", label: "Turns", factor: 360 },
  { id: "arcmin", label: "Arcminutes", factor: 1 / 60 }, { id: "arcsec", label: "Arcseconds", factor: 1 / 3600 },
];
export const SPEED_UNITS: UnitMap = [
  { id: "mps", label: "m/s", factor: 1 }, { id: "kph", label: "km/h", factor: 1 / 3.6 },
  { id: "mph", label: "mph", factor: 0.44704 }, { id: "fps", label: "ft/s", factor: 0.3048 },
  { id: "knot", label: "Knots", factor: 0.514444 }, { id: "mach", label: "Mach", factor: 343 },
];
export const AREA_UNITS: UnitMap = [
  { id: "m2", label: "m²", factor: 1 }, { id: "km2", label: "km²", factor: 1e6 }, { id: "cm2", label: "cm²", factor: 1e-4 },
  { id: "ft2", label: "ft²", factor: 0.092903 }, { id: "in2", label: "in²", factor: 0.00064516 },
  { id: "acre", label: "Acres", factor: 4046.86 }, { id: "hectare", label: "Hectares", factor: 10000 }, { id: "mi2", label: "mi²", factor: 2.59e6 },
];
export const VOLUME_UNITS: UnitMap = [
  { id: "l", label: "Litres", factor: 1 }, { id: "ml", label: "Millilitres", factor: 0.001 }, { id: "m3", label: "m³", factor: 1000 },
  { id: "gal", label: "US Gallons", factor: 3.78541 }, { id: "qt", label: "US Quarts", factor: 0.946353 },
  { id: "cup", label: "US Cups", factor: 0.24 }, { id: "floz", label: "US fl oz", factor: 0.0295735 }, { id: "tbsp", label: "Tablespoons", factor: 0.0147868 },
];
export const PRESSURE_UNITS: UnitMap = [
  { id: "pa", label: "Pascal", factor: 1 }, { id: "kpa", label: "Kilopascal", factor: 1000 }, { id: "bar", label: "Bar", factor: 100000 },
  { id: "psi", label: "PSI", factor: 6894.76 }, { id: "atm", label: "Atmosphere", factor: 101325 }, { id: "torr", label: "Torr", factor: 133.322 }, { id: "mmhg", label: "mmHg", factor: 133.322 },
];
export const ENERGY_UNITS: UnitMap = [
  { id: "j", label: "Joules", factor: 1 }, { id: "kj", label: "Kilojoules", factor: 1000 }, { id: "cal", label: "Calories", factor: 4.184 },
  { id: "kcal", label: "Kilocalories", factor: 4184 }, { id: "wh", label: "Watt-hours", factor: 3600 }, { id: "kwh", label: "Kilowatt-hours", factor: 3.6e6 },
  { id: "btu", label: "BTU", factor: 1055.06 }, { id: "ev", label: "Electronvolts", factor: 1.602e-19 },
];
export const POWER_UNITS: UnitMap = [
  { id: "w", label: "Watts", factor: 1 }, { id: "kw", label: "Kilowatts", factor: 1000 }, { id: "mw", label: "Megawatts", factor: 1e6 },
  { id: "hp", label: "Horsepower", factor: 745.7 }, { id: "btuh", label: "BTU/hour", factor: 0.293071 },
];
export const DATARATE_UNITS: UnitMap = [
  { id: "bps", label: "bit/s", factor: 1 }, { id: "kbps", label: "kbit/s", factor: 1000 }, { id: "mbps", label: "Mbit/s", factor: 1e6 },
  { id: "gbps", label: "Gbit/s", factor: 1e9 }, { id: "Bps", label: "byte/s", factor: 8 }, { id: "KBps", label: "KB/s", factor: 8000 }, { id: "MBps", label: "MB/s", factor: 8e6 },
];
export const TYPOGRAPHY_UNITS: UnitMap = [
  { id: "px", label: "Pixels", factor: 1 }, { id: "pt", label: "Points", factor: 96 / 72 }, { id: "pc", label: "Picas", factor: 16 },
  { id: "in", label: "Inches", factor: 96 }, { id: "cm", label: "Centimetres", factor: 96 / 2.54 }, { id: "mm", label: "Millimetres", factor: 96 / 25.4 },
];
export const COOKING_UNITS: UnitMap = [
  { id: "tsp", label: "Teaspoons", factor: 1 }, { id: "tbsp", label: "Tablespoons", factor: 3 }, { id: "floz", label: "Fluid ounces", factor: 6 },
  { id: "cup", label: "Cups", factor: 48 }, { id: "pint", label: "Pints", factor: 96 }, { id: "ml", label: "Millilitres", factor: 0.202884 },
];

export function convertByFactor(map: UnitMap, value: number, from: string, to: string): number | null {
  const f = map.find((u) => u.id === from), t = map.find((u) => u.id === to);
  if (!f || !t) return null;
  return (value * f.factor) / t.factor;
}

const SPEED_OF_LIGHT = 299792458;
export function frequencyWavelength(input: number, mode: "f2w" | "w2f"): number {
  return mode === "f2w" ? SPEED_OF_LIGHT / input : SPEED_OF_LIGHT / input;
}

/* ================================================================== *
 * NETWORK
 * ================================================================== */
export function formatMac(mac: string, sep: ":" | "-" | ".", upper: boolean): Res<string> {
  const clean = mac.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length !== 12) return err("A MAC address needs 12 hex digits.");
  const c = upper ? clean.toUpperCase() : clean.toLowerCase();
  let out: string;
  if (sep === ".") out = c.match(/.{4}/g)!.join(".");
  else out = c.match(/.{2}/g)!.join(sep);
  return ok(out);
}
export function macVendorHint(mac: string): string {
  const clean = mac.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  return clean.length >= 6 ? clean.slice(0, 6).match(/.{2}/g)!.join(":") + " (OUI prefix)" : "";
}

export function expandIpv6(addr: string): Res<string> {
  try {
    let a = addr.trim();
    if (!a.includes(":")) return err("Not an IPv6 address.");
    let head = "", tail = "";
    if (a.includes("::")) { const [h, t] = a.split("::"); head = h; tail = t; }
    else head = a;
    const hp = head ? head.split(":") : [];
    const tp = tail ? tail.split(":") : [];
    const missing = 8 - hp.length - tp.length;
    if (missing < 0) return err("Too many groups.");
    const groups = [...hp, ...Array(a.includes("::") ? missing : 0).fill("0"), ...tp];
    if (groups.length !== 8) return err("Invalid IPv6 length.");
    return ok(groups.map((g) => g.padStart(4, "0").toLowerCase()).join(":"));
  } catch { return err("Invalid IPv6 address."); }
}
export function compressIpv6(addr: string): Res<string> {
  const expanded = expandIpv6(addr);
  if (!expanded.ok) return expanded;
  const groups = expanded.value.split(":").map((g) => g.replace(/^0+/, "") || "0");
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (groups[i] === "0") { if (curStart < 0) curStart = i; curLen++; if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; } }
    else { curStart = -1; curLen = 0; }
  }
  if (bestLen > 1) {
    const before = groups.slice(0, bestStart).join(":");
    const after = groups.slice(bestStart + bestLen).join(":");
    return ok(`${before}::${after}`);
  }
  return ok(groups.join(":"));
}

export function parseUrlParts(url: string): Res<Record<string, string>> {
  try {
    const u = new URL(url);
    return ok({
      protocol: u.protocol.replace(":", ""), host: u.host, hostname: u.hostname,
      port: u.port || "(default)", pathname: u.pathname, search: u.search || "(none)",
      hash: u.hash || "(none)", origin: u.origin, username: u.username || "(none)",
    });
  } catch { return err("Enter a full URL, e.g. https://example.com/path?x=1"); }
}

export function ipClassInfo(ip: string): Res<Record<string, string>> {
  const parts = ip.trim().split(".");
  if (parts.length !== 4 || parts.some((p) => p === "" || isNaN(+p) || +p < 0 || +p > 255)) return err("Enter a valid IPv4 address.");
  const first = +parts[0];
  let cls = "E (reserved)";
  if (first < 128) cls = "A"; else if (first < 192) cls = "B"; else if (first < 224) cls = "C"; else if (first < 240) cls = "D (multicast)";
  const isPrivate = first === 10 || (first === 172 && +parts[1] >= 16 && +parts[1] <= 31) || (first === 192 && +parts[1] === 168);
  const isLoopback = first === 127;
  const isLinkLocal = first === 169 && +parts[1] === 254;
  return ok({
    class: cls, scope: isPrivate ? "Private" : isLoopback ? "Loopback" : isLinkLocal ? "Link-local" : "Public",
    binary: parts.map((p) => (+p).toString(2).padStart(8, "0")).join("."),
    type: first >= 224 ? "Reserved / multicast" : "Unicast",
  });
}

export const COMMON_PORTS: { port: number; service: string; proto: string }[] = [
  { port: 20, service: "FTP data", proto: "TCP" }, { port: 21, service: "FTP control", proto: "TCP" },
  { port: 22, service: "SSH", proto: "TCP" }, { port: 23, service: "Telnet", proto: "TCP" },
  { port: 25, service: "SMTP", proto: "TCP" }, { port: 53, service: "DNS", proto: "TCP/UDP" },
  { port: 67, service: "DHCP server", proto: "UDP" }, { port: 68, service: "DHCP client", proto: "UDP" },
  { port: 80, service: "HTTP", proto: "TCP" }, { port: 110, service: "POP3", proto: "TCP" },
  { port: 123, service: "NTP", proto: "UDP" }, { port: 143, service: "IMAP", proto: "TCP" },
  { port: 161, service: "SNMP", proto: "UDP" }, { port: 389, service: "LDAP", proto: "TCP" },
  { port: 443, service: "HTTPS", proto: "TCP" }, { port: 445, service: "SMB", proto: "TCP" },
  { port: 465, service: "SMTPS", proto: "TCP" }, { port: 587, service: "SMTP (submission)", proto: "TCP" },
  { port: 993, service: "IMAPS", proto: "TCP" }, { port: 995, service: "POP3S", proto: "TCP" },
  { port: 1433, service: "MS SQL", proto: "TCP" }, { port: 3306, service: "MySQL", proto: "TCP" },
  { port: 3389, service: "RDP", proto: "TCP" }, { port: 5432, service: "PostgreSQL", proto: "TCP" },
  { port: 5672, service: "AMQP", proto: "TCP" }, { port: 6379, service: "Redis", proto: "TCP" },
  { port: 8080, service: "HTTP alt", proto: "TCP" }, { port: 8443, service: "HTTPS alt", proto: "TCP" },
  { port: 9200, service: "Elasticsearch", proto: "TCP" }, { port: 27017, service: "MongoDB", proto: "TCP" },
];

export const DNS_RECORDS: { type: string; purpose: string }[] = [
  { type: "A", purpose: "Maps a hostname to an IPv4 address." },
  { type: "AAAA", purpose: "Maps a hostname to an IPv6 address." },
  { type: "CNAME", purpose: "Alias of one name to another canonical name." },
  { type: "MX", purpose: "Mail exchange servers for a domain." },
  { type: "TXT", purpose: "Arbitrary text; used for SPF, DKIM, verification." },
  { type: "NS", purpose: "Authoritative name servers for the zone." },
  { type: "SOA", purpose: "Start of authority; zone administration data." },
  { type: "SRV", purpose: "Location of services (host + port)." },
  { type: "PTR", purpose: "Reverse lookup: IP address to hostname." },
  { type: "CAA", purpose: "Which CAs may issue certificates for the domain." },
  { type: "DNSKEY", purpose: "Public key for DNSSEC validation." },
  { type: "SPF", purpose: "Legacy sender policy framework record." },
];

/* ================================================================== *
 * RANDOM
 * ================================================================== */
export function coinFlip(n: number): { results: string[]; heads: number; tails: number } {
  n = clamp(Math.trunc(n), 1, 10000);
  const results: string[] = [];
  let heads = 0;
  for (let i = 0; i < n; i++) { const h = Math.random() < 0.5; results.push(h ? "H" : "T"); if (h) heads++; }
  return { results, heads, tails: n - heads };
}
export function randomStringGen(len: number, opts: { upper: boolean; lower: boolean; digits: boolean; symbols: boolean }): string {
  let pool = "";
  if (opts.upper) pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (opts.lower) pool += "abcdefghijklmnopqrstuvwxyz";
  if (opts.digits) pool += "0123456789";
  if (opts.symbols) pool += "!@#$%^&*()-_=+[]{}";
  if (!pool) return "";
  len = clamp(len, 1, 4096);
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (v) => pool[v % pool.length]).join("");
}
export function randomPick(items: string[]): string { return items.length ? items[Math.floor(Math.random() * items.length)] : ""; }
export function gaussianRandom(mean: number, sd: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function lotteryNumbers(count: number, max: number): number[] {
  count = clamp(Math.trunc(count), 1, max);
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  return shuffleArray(pool).slice(0, count).sort((a, b) => a - b);
}
export function randomDate(startIso: string, endIso: string): Res<string> {
  const s = new Date(startIso).getTime(), e = new Date(endIso).getTime();
  if (isNaN(s) || isNaN(e)) return err("Enter valid start & end dates.");
  if (s > e) return err("Start must be before end.");
  return ok(new Date(s + Math.random() * (e - s)).toISOString());
}
export function teamSplit(names: string[], teams: number): string[][] {
  teams = clamp(Math.trunc(teams), 1, names.length || 1);
  const shuffled = shuffleArray(names.filter(Boolean));
  const out: string[][] = Array.from({ length: teams }, () => []);
  shuffled.forEach((name, i) => out[i % teams].push(name));
  return out;
}

/* ================================================================== *
 * TIME / DATE
 * ================================================================== */
export function ageFrom(birthIso: string, atIso?: string): Res<Record<string, number>> {
  const b = new Date(birthIso);
  const now = atIso ? new Date(atIso) : new Date();
  if (isNaN(b.getTime()) || isNaN(now.getTime())) return err("Enter a valid birth date.");
  if (b > now) return err("Birth date is in the future.");
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  let days = now.getDate() - b.getDate();
  if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years--; months += 12; }
  const totalDays = Math.floor((now.getTime() - b.getTime()) / 86400000);
  return ok({ years, months, days, totalDays, totalWeeks: Math.floor(totalDays / 7), totalHours: Math.floor((now.getTime() - b.getTime()) / 3600000) });
}
export function isoWeek(dateIso: string): Res<{ week: number; year: number; day: number }> {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return err("Enter a valid date.");
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return ok({ week, year: target.getUTCFullYear(), day: dayNr + 1 });
}
export function businessDays(startIso: string, endIso: string): Res<{ total: number; business: number; weekend: number }> {
  const s = new Date(startIso), e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return err("Enter valid dates.");
  const [lo, hi] = s <= e ? [s, e] : [e, s];
  let total = 0, business = 0;
  const d = new Date(lo);
  while (d <= hi) { total++; const day = d.getDay(); if (day !== 0 && day !== 6) business++; d.setDate(d.getDate() + 1); }
  return ok({ total, business, weekend: total - business });
}
export function dateArithmetic(dateIso: string, amount: number, unit: "days" | "weeks" | "months" | "years" | "hours" | "minutes"): Res<string> {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return err("Enter a valid date.");
  switch (unit) {
    case "days": d.setDate(d.getDate() + amount); break;
    case "weeks": d.setDate(d.getDate() + amount * 7); break;
    case "months": d.setMonth(d.getMonth() + amount); break;
    case "years": d.setFullYear(d.getFullYear() + amount); break;
    case "hours": d.setHours(d.getHours() + amount); break;
    case "minutes": d.setMinutes(d.getMinutes() + amount); break;
  }
  return ok(d.toString());
}
export function dayOfWeekInfo(dateIso: string): Res<{ weekday: string; dayOfYear: number; leap: boolean }> {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return err("Enter a valid date.");
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const y = d.getFullYear();
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return ok({ weekday: d.toLocaleDateString(undefined, { weekday: "long" }), dayOfYear, leap });
}
export function countdownTo(targetIso: string): Res<Record<string, number>> {
  const t = new Date(targetIso).getTime();
  if (isNaN(t)) return err("Enter a valid target date/time.");
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  return ok({
    past: diff < 0 ? 1 : 0,
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    minutes: Math.floor((abs % 3600000) / 60000),
    seconds: Math.floor((abs % 60000) / 1000),
  });
}
