"use client";

import { useEffect, useMemo, useState } from "react";
import * as F from "@/lib/forge/logic2";
import { shuffleArray, parseColor, rgbToHex } from "@/lib/forge/logic";
import { Btn, CopyBtn, ErrorNote, Field, Input, Output, Panel, Segmented, Stat, TextArea, Toggle, ToolShell } from "./ui";
import type { ToolDef } from "./tools";

/* Small numeric input used across the extended tools. */
function NumInput({ value, onChange, min, max, step, w = "w-28" }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; w?: string }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
      className={`${w} rounded-xl border bg-[var(--bg-3)] px-3 py-2 text-sm mono outline-none transition-colors focus:border-[var(--accent)]`}
      style={{ borderColor: "var(--line-2)" }}
    />
  );
}

function fmt(n: number, dp = 6): string {
  if (!Number.isFinite(n)) return "—";
  const r = Number(n.toFixed(dp));
  return String(r);
}

/* Reusable factor-based unit converter used by 10+ Convert tools. */
function UnitConverter({ title, subtitle, map, initFrom, initTo }: { title: string; subtitle: string; map: F.UnitMap; initFrom: string; initTo: string }) {
  const [value, setValue] = useState(1);
  const [from, setFrom] = useState(initFrom);
  const [to, setTo] = useState(initTo);
  const result = useMemo(() => F.convertByFactor(map, value, from, to), [map, value, from, to]);
  const sel = "rounded-xl border bg-[var(--bg-3)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";
  return (
    <ToolShell title={title} subtitle={subtitle}>
      <Panel>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Field label="Value">
            <NumInput value={value} onChange={setValue} w="w-full" />
          </Field>
          <div className="pb-2 text-center text-[var(--fg-2)]">→</div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From">
              <select value={from} onChange={(e) => setFrom(e.target.value)} className={sel} style={{ borderColor: "var(--line-2)" }}>
                {map.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </Field>
            <Field label="To">
              <select value={to} onChange={(e) => setTo(e.target.value)} className={sel} style={{ borderColor: "var(--line-2)" }}>
                {map.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat value={result == null ? "—" : fmt(result, 8)} label={`${map.find((u) => u.id === to)?.label ?? to}`} />
          <Stat value={`1 ${from} = ${fmt(F.convertByFactor(map, 1, from, to) ?? 0, 8)} ${to}`} label="Rate" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {map.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs" style={{ borderColor: "var(--line)" }}>
              <span className="text-[var(--fg-2)]">{u.label}</span>
              <span className="mono">{fmt(F.convertByFactor(map, value, from, u.id) ?? 0, 4)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * MATH — Expression evaluator
 * ================================================================== */
function CalcTool() {
  const [expr, setExpr] = useState("sqrt(3^2 + 4^2) + sin(pi/6)");
  const res = useMemo(() => F.safeMathEval(expr), [expr]);
  return (
    <ToolShell title="Expression Calculator" subtitle="Evaluate maths safely — supports + − × ÷ % ^, parentheses, sqrt, sin, log, constants (pi, e, phi) and more.">
      <Panel>
        <Field label="Expression"><Input value={expr} onChange={setExpr} /></Field>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["pi", "e", "sqrt(", "sin(", "cos(", "ln(", "log(", "^", "abs("].map((t) => (
            <button key={t} onClick={() => setExpr((v) => v + t)} className="chip">{t}</button>
          ))}
        </div>
      </Panel>
      <Panel>
        {res.ok ? <Stat value={fmt(res.value, 10)} label="Result" /> : <ErrorNote message={res.error} />}
      </Panel>
    </ToolShell>
  );
}

function GcdLcmTool() {
  const [input, setInput] = useState("12, 18, 24");
  const res = useMemo(() => {
    const nums = input.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n) && n !== 0);
    return nums.length >= 2 ? F.gcdLcmOf(nums) : null;
  }, [input]);
  return (
    <ToolShell title="GCD & LCM" subtitle="Greatest common divisor and least common multiple of two or more integers.">
      <Panel><Field label="Numbers" hint="comma or space separated"><Input value={input} onChange={setInput} /></Field></Panel>
      <Panel>
        {res ? (
          <div className="grid grid-cols-2 gap-3"><Stat value={res.gcd} label="GCD" /><Stat value={res.lcm} label="LCM" /></div>
        ) : <ErrorNote message="Enter at least two non-zero integers." />}
      </Panel>
    </ToolShell>
  );
}

function PrimeTool() {
  const [input, setInput] = useState("360");
  const n = Math.trunc(Number(input));
  const prime = useMemo(() => (Number.isFinite(n) ? F.isPrime(n) : false), [n]);
  const factors = useMemo(() => (Number.isFinite(n) && Math.abs(n) > 1 ? F.primeFactors(n) : []), [n]);
  return (
    <ToolShell title="Prime & Factorise" subtitle="Check primality and break a number into its prime factorisation.">
      <Panel><Field label="Integer"><Input value={input} onChange={setInput} /></Field></Panel>
      <Panel>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={prime ? "Yes" : "No"} label="Prime?" />
          <Stat value={factors.length ? factors.map((f) => (f.power > 1 ? `${f.factor}^${f.power}` : `${f.factor}`)).join(" × ") : "—"} label="Factorisation" />
        </div>
      </Panel>
    </ToolShell>
  );
}

function QuadraticTool() {
  const [a, setA] = useState(1), [b, setB] = useState(-3), [c, setC] = useState(2);
  const res = useMemo(() => F.solveQuadratic(a, b, c), [a, b, c]);
  return (
    <ToolShell title="Quadratic Solver" subtitle="Solve ax² + bx + c = 0, including complex roots.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="a"><NumInput value={a} onChange={setA} /></Field>
          <Field label="b"><NumInput value={b} onChange={setB} /></Field>
          <Field label="c"><NumInput value={c} onChange={setC} /></Field>
        </div>
      </Panel>
      <Panel>
        <Stat value={res.kind} label="Discriminant type" />
        <div className="mt-3 grid gap-2">
          {res.roots.length ? res.roots.map((r, i) => <Output key={i} value={r} label={`x${i + 1}`} />) : <p className="text-sm text-[var(--fg-2)]">No finite solutions.</p>}
        </div>
      </Panel>
    </ToolShell>
  );
}

function StatsTool() {
  const [input, setInput] = useState("4, 8, 15, 16, 23, 42");
  const res = useMemo(() => {
    const nums = input.split(/[\s,]+/).map(Number).filter(Number.isFinite);
    return F.descriptiveStats(nums);
  }, [input]);
  return (
    <ToolShell title="Statistics" subtitle="Mean, median, mode, standard deviation and more from a list of numbers.">
      <Panel><Field label="Numbers" hint="comma or space separated"><TextArea value={input} onChange={setInput} rows={3} /></Field></Panel>
      <Panel>
        {res ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat value={fmt(res.mean, 4)} label="Mean" /><Stat value={fmt(res.median, 4)} label="Median" /><Stat value={fmt(res.mode, 4)} label="Mode" />
            <Stat value={fmt(res.stddev, 4)} label="Std dev" /><Stat value={fmt(res.variance, 4)} label="Variance" /><Stat value={fmt(res.range, 4)} label="Range" />
            <Stat value={fmt(res.min, 4)} label="Min" /><Stat value={fmt(res.max, 4)} label="Max" /><Stat value={fmt(res.sum, 4)} label="Sum" />
          </div>
        ) : <ErrorNote message="Enter at least one number." />}
      </Panel>
    </ToolShell>
  );
}

function FibTool() {
  const [count, setCount] = useState(15);
  const seq = useMemo(() => F.fibonacci(count), [count]);
  return (
    <ToolShell title="Fibonacci" subtitle="Generate the Fibonacci sequence with arbitrary precision (BigInt).">
      <Panel><Field label="How many terms" hint="1–200"><NumInput value={count} onChange={setCount} min={1} max={200} /></Field></Panel>
      <Panel><Output value={seq.join(", ")} label={`${seq.length} terms`} /></Panel>
    </ToolShell>
  );
}

function FactorialTool() {
  const [n, setN] = useState(20);
  const res = useMemo(() => F.factorial(n), [n]);
  return (
    <ToolShell title="Factorial" subtitle="Compute n! for large n using arbitrary-precision integers.">
      <Panel><Field label="n" hint="0–5000"><NumInput value={n} onChange={setN} min={0} max={5000} /></Field></Panel>
      <Panel><Output value={res} label={`${n}!`} /></Panel>
    </ToolShell>
  );
}

function CombinTool() {
  const [n, setN] = useState(10), [r, setR] = useState(3);
  return (
    <ToolShell title="Combinations & Permutations" subtitle="Compute nCr and nPr for counting problems.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="n"><NumInput value={n} onChange={setN} min={0} /></Field>
          <Field label="r"><NumInput value={r} onChange={setR} min={0} /></Field>
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={F.nCr(n, r)} label={`C(${n}, ${r}) — combinations`} />
          <Stat value={F.nPr(n, r)} label={`P(${n}, ${r}) — permutations`} />
        </div>
      </Panel>
    </ToolShell>
  );
}

function NumFmtTool() {
  const [input, setInput] = useState("1234567.891");
  const [sep, setSep] = useState<"," | " " | ".">(",");
  const out = useMemo(() => F.formatNumberGroups(input, sep, sep === "." ? "," : "."), [input, sep]);
  return (
    <ToolShell title="Number Formatter" subtitle="Group digits with thousands separators for readable numbers.">
      <Panel>
        <Field label="Number"><Input value={input} onChange={setInput} /></Field>
        <div className="mt-3"><Segmented value={sep} onChange={setSep} options={[{ value: ",", label: "1,234" }, { value: " ", label: "1 234" }, { value: ".", label: "1.234" }]} /></div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function FractionTool() {
  const [num, setNum] = useState(24), [den, setDen] = useState(36);
  const res = useMemo(() => F.simplifyFraction(num, den), [num, den]);
  return (
    <ToolShell title="Fraction Simplifier" subtitle="Reduce a fraction to its lowest terms.">
      <Panel>
        <div className="flex items-end gap-3">
          <Field label="Numerator"><NumInput value={num} onChange={setNum} /></Field>
          <span className="pb-2 text-xl">/</span>
          <Field label="Denominator"><NumInput value={den} onChange={setDen} /></Field>
        </div>
      </Panel>
      <Panel>
        {res ? <div className="grid grid-cols-2 gap-3"><Stat value={`${res.num}/${res.den}`} label="Simplified" /><Stat value={fmt(res.decimal, 6)} label="Decimal" /></div> : <ErrorNote message="Denominator cannot be zero." />}
      </Panel>
    </ToolShell>
  );
}

function Dec2FracTool() {
  const [input, setInput] = useState("0.375");
  const res = useMemo(() => { const x = Number(input); return Number.isFinite(x) ? F.decimalToFraction(x) : null; }, [input]);
  return (
    <ToolShell title="Decimal → Fraction" subtitle="Convert a decimal number into the nearest exact fraction.">
      <Panel><Field label="Decimal"><Input value={input} onChange={setInput} /></Field></Panel>
      <Panel>{res ? <Stat value={`${res.num}/${res.den}`} label="Fraction" /> : <ErrorNote message="Enter a number." />}</Panel>
    </ToolShell>
  );
}

function RoundTool() {
  const [input, setInput] = useState("3.14159265");
  const [dp, setDp] = useState(2);
  const [mode, setMode] = useState<"round" | "floor" | "ceil" | "trunc">("round");
  const out = useMemo(() => { const n = Number(input); return Number.isFinite(n) ? F.roundTo(n, dp, mode) : NaN; }, [input, dp, mode]);
  return (
    <ToolShell title="Rounding" subtitle="Round, floor, ceil or truncate to a chosen number of decimals.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Number"><Input value={input} onChange={setInput} /></Field>
          <Field label="Decimals"><NumInput value={dp} onChange={setDp} min={0} max={15} w="w-20" /></Field>
        </div>
        <div className="mt-3"><Segmented value={mode} onChange={setMode} options={[{ value: "round", label: "Round" }, { value: "floor", label: "Floor" }, { value: "ceil", label: "Ceil" }, { value: "trunc", label: "Truncate" }]} /></div>
      </Panel>
      <Panel><Stat value={fmt(out, 15)} label="Result" /></Panel>
    </ToolShell>
  );
}

function TriangleTool() {
  const [a, setA] = useState(3), [b, setB] = useState(4), [c, setC] = useState(NaN);
  const res = useMemo(() => F.rightTriangle(Number.isFinite(a) ? a : undefined, Number.isFinite(b) ? b : undefined, Number.isFinite(c) ? c : undefined), [a, b, c]);
  return (
    <ToolShell title="Right Triangle Solver" subtitle="Provide any two sides (c is the hypotenuse) to solve the rest.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="a (leg)"><NumInput value={a} onChange={setA} /></Field>
          <Field label="b (leg)"><NumInput value={b} onChange={setB} /></Field>
          <Field label="c (hypotenuse)"><NumInput value={c} onChange={setC} /></Field>
        </div>
      </Panel>
      <Panel>
        {res ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat value={fmt(res.a, 4)} label="a" /><Stat value={fmt(res.b, 4)} label="b" /><Stat value={fmt(res.c, 4)} label="c" />
            <Stat value={fmt(res.area, 4)} label="Area" /><Stat value={fmt(res.perimeter, 4)} label="Perimeter" /><Stat value={`${fmt(res.angleA, 2)}° / ${fmt(res.angleB, 2)}°`} label="Angles" />
          </div>
        ) : <ErrorNote message="Enter at least two valid sides (hypotenuse must be the longest)." />}
      </Panel>
    </ToolShell>
  );
}

function ModularTool() {
  const [base, setBase] = useState(7), [exp, setExp] = useState(128), [mod, setMod] = useState(13);
  const inv = useMemo(() => F.modInverse(base, mod), [base, mod]);
  const pow = useMemo(() => (mod > 0 ? F.modPow(base, exp, mod) : NaN), [base, exp, mod]);
  return (
    <ToolShell title="Modular Arithmetic" subtitle="Fast modular exponentiation (bᵉ mod m) and modular multiplicative inverse.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="base"><NumInput value={base} onChange={setBase} /></Field>
          <Field label="exponent"><NumInput value={exp} onChange={setExp} /></Field>
          <Field label="modulus"><NumInput value={mod} onChange={setMod} min={1} /></Field>
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={fmt(pow, 0)} label={`${base}^${exp} mod ${mod}`} />
          <Stat value={inv == null ? "none" : String(inv)} label={`inverse of ${base} mod ${mod}`} />
        </div>
      </Panel>
    </ToolShell>
  );
}

function AnyBaseTool() {
  const [value, setValue] = useState("ff"), [from, setFrom] = useState(16), [to, setTo] = useState(2);
  const res = useMemo(() => F.convertAnyBase(value, from, to), [value, from, to]);
  return (
    <ToolShell title="Any-Base Converter" subtitle="Convert integers between any bases from 2 to 36 (BigInt-safe).">
      <Panel>
        <Field label="Value"><Input value={value} onChange={setValue} /></Field>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="From base"><NumInput value={from} onChange={setFrom} min={2} max={36} w="w-20" /></Field>
          <Field label="To base"><NumInput value={to} onChange={setTo} min={2} max={36} w="w-20" /></Field>
        </div>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} label={`base ${to}`} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function SeriesTool() {
  const [kind, setKind] = useState<"arith" | "geom">("arith");
  const [first, setFirst] = useState(2), [common, setCommon] = useState(3), [n, setN] = useState(10);
  const res = useMemo(() => F.seriesInfo(kind, first, common, n), [kind, first, common, n]);
  return (
    <ToolShell title="Number Series" subtitle="Generate arithmetic or geometric sequences and their sum.">
      <Panel>
        <div className="mb-3"><Segmented value={kind} onChange={setKind} options={[{ value: "arith", label: "Arithmetic" }, { value: "geom", label: "Geometric" }]} /></div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="First term"><NumInput value={first} onChange={setFirst} /></Field>
          <Field label={kind === "arith" ? "Common difference" : "Common ratio"}><NumInput value={common} onChange={setCommon} /></Field>
          <Field label="Terms"><NumInput value={n} onChange={setN} min={1} max={1000} /></Field>
        </div>
      </Panel>
      <Panel><Output value={res.terms.join(", ")} label="Sequence" /><div className="mt-3"><Stat value={fmt(res.sum, 6)} label="Sum" /></div></Panel>
    </ToolShell>
  );
}

function SciNotTool() {
  const [input, setInput] = useState("0.000045");
  const [sig, setSig] = useState(4);
  const out = useMemo(() => { const n = Number(input); return Number.isFinite(n) ? F.toScientific(n, sig) : "—"; }, [input, sig]);
  return (
    <ToolShell title="Scientific Notation" subtitle="Express any number in normalised scientific notation.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Number"><Input value={input} onChange={setInput} /></Field>
          <Field label="Significant figures"><NumInput value={sig} onChange={setSig} min={0} max={20} w="w-20" /></Field>
        </div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function InterestTool() {
  const [p, setP] = useState(10000), [r, setR] = useState(5), [n, setN] = useState(12), [y, setY] = useState(10), [c, setC] = useState(200);
  const res = useMemo(() => F.compoundInterest(p, r, n, y, c), [p, r, n, y, c]);
  return (
    <ToolShell title="Compound Interest" subtitle="Project savings growth with compounding and recurring contributions.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Principal"><NumInput value={p} onChange={setP} w="w-full" /></Field>
          <Field label="Annual rate (%)"><NumInput value={r} onChange={setR} w="w-full" /></Field>
          <Field label="Compounds / year"><NumInput value={n} onChange={setN} w="w-full" /></Field>
          <Field label="Years"><NumInput value={y} onChange={setY} w="w-full" /></Field>
          <Field label="Contribution / period"><NumInput value={c} onChange={setC} w="w-full" /></Field>
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={fmt(res.total, 2)} label="Final value" />
          <Stat value={fmt(res.contributed, 2)} label="Contributed" />
          <Stat value={fmt(res.interest, 2)} label="Interest earned" />
        </div>
      </Panel>
    </ToolShell>
  );
}

function LoanTool() {
  const [p, setP] = useState(250000), [r, setR] = useState(6.5), [m, setM] = useState(360);
  const res = useMemo(() => F.loanPayment(p, r, m), [p, r, m]);
  return (
    <ToolShell title="Loan Payment" subtitle="Monthly payment, total cost and total interest for an amortised loan.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Principal"><NumInput value={p} onChange={setP} w="w-full" /></Field>
          <Field label="Annual rate (%)"><NumInput value={r} onChange={setR} w="w-full" /></Field>
          <Field label="Term (months)"><NumInput value={m} onChange={setM} w="w-full" /></Field>
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={fmt(res.monthly, 2)} label="Monthly" /><Stat value={fmt(res.total, 2)} label="Total paid" /><Stat value={fmt(res.interest, 2)} label="Total interest" />
        </div>
      </Panel>
    </ToolShell>
  );
}

function TipTool() {
  const [bill, setBill] = useState(84.5), [pct, setPct] = useState(18), [people, setPeople] = useState(3);
  const res = useMemo(() => F.tipCalc(bill, pct, people), [bill, pct, people]);
  return (
    <ToolShell title="Tip & Split" subtitle="Work out the tip, the grand total and each person's share.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bill"><NumInput value={bill} onChange={setBill} w="w-full" /></Field>
          <Field label="Tip (%)"><NumInput value={pct} onChange={setPct} w="w-full" /></Field>
          <Field label="People"><NumInput value={people} onChange={setPeople} min={1} w="w-full" /></Field>
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-3 gap-3">
          <Stat value={fmt(res.tip, 2)} label="Tip" /><Stat value={fmt(res.total, 2)} label="Total" /><Stat value={fmt(res.perPerson, 2)} label="Per person" />
        </div>
      </Panel>
    </ToolShell>
  );
}

function DiscountTool() {
  const [price, setPrice] = useState(199.99), [pct, setPct] = useState(25);
  const res = useMemo(() => F.discountCalc(price, pct), [price, pct]);
  return (
    <ToolShell title="Discount" subtitle="Calculate savings and the final price after a percentage discount.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Price"><NumInput value={price} onChange={setPrice} /></Field>
          <Field label="Discount (%)"><NumInput value={pct} onChange={setPct} /></Field>
        </div>
      </Panel>
      <Panel><div className="grid grid-cols-2 gap-3"><Stat value={fmt(res.saved, 2)} label="You save" /><Stat value={fmt(res.final, 2)} label="Final price" /></div></Panel>
    </ToolShell>
  );
}

function BmiTool() {
  const [w, setW] = useState(72), [h, setH] = useState(178);
  const res = useMemo(() => F.bmiCalc(w, h), [w, h]);
  return (
    <ToolShell title="BMI Calculator" subtitle="Body mass index from weight (kg) and height (cm).">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Weight (kg)"><NumInput value={w} onChange={setW} /></Field>
          <Field label="Height (cm)"><NumInput value={h} onChange={setH} /></Field>
        </div>
      </Panel>
      <Panel>{res ? <div className="grid grid-cols-2 gap-3"><Stat value={fmt(res.bmi, 1)} label="BMI" /><Stat value={res.category} label="Category" /></div> : <ErrorNote message="Enter positive values." />}</Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * COLOR
 * ================================================================== */
function Swatch({ hex, label }: { hex: string; label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border p-2" style={{ borderColor: "var(--line)" }}>
      <span className="h-8 w-8 shrink-0 rounded-md border" style={{ background: hex, borderColor: "var(--line-2)" }} />
      <div className="min-w-0">
        <div className="mono text-xs">{hex}</div>
        {label && <div className="label">{label}</div>}
      </div>
      <span className="ms-auto"><CopyBtn text={hex} label="" /></span>
    </div>
  );
}

function HarmonyTool() {
  const [hex, setHex] = useState("#6d5efc");
  const res = useMemo(() => F.colorHarmonies(hex), [hex]);
  return (
    <ToolShell title="Colour Harmonies" subtitle="Generate complementary, analogous, triadic and other palettes from a base colour.">
      <Panel>
        <div className="flex items-center gap-3">
          <input type="color" value={parseColor(hex) ? rgbToHex(parseColor(hex)!) : "#6d5efc"} onChange={(e) => setHex(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent" style={{ borderColor: "var(--line-2)" }} />
          <div className="flex-1"><Input value={hex} onChange={setHex} /></div>
        </div>
      </Panel>
      {res ? Object.entries(res).map(([name, cols]) => (
        <Panel key={name}>
          <p className="label mb-2 capitalize">{name}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{cols.map((c, i) => <Swatch key={i} hex={c} />)}</div>
        </Panel>
      )) : <Panel><ErrorNote message="Enter a valid colour (hex, rgb, hsl or name)." /></Panel>}
    </ToolShell>
  );
}

function PaletteTool() {
  const [count, setCount] = useState(5);
  const [palette, setPalette] = useState<string[]>(() => F.randomPalette(5));
  return (
    <ToolShell title="Random Palette" subtitle="Roll a harmonious colour palette for your next design.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Colours"><NumInput value={count} onChange={setCount} min={2} max={10} w="w-20" /></Field>
          <Btn accent onClick={() => setPalette(F.randomPalette(count))}>🎲 Generate</Btn>
        </div>
      </Panel>
      <Panel>
        <div className="mb-3 flex h-20 overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
          {palette.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} />)}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{palette.map((c, i) => <Swatch key={i} hex={c} />)}</div>
      </Panel>
    </ToolShell>
  );
}

function CmykTool() {
  const [hex, setHex] = useState("#38bdf8");
  const rgb = useMemo(() => parseColor(hex), [hex]);
  const cmyk = useMemo(() => (rgb ? F.rgbToCmyk(rgb.r, rgb.g, rgb.b) : null), [rgb]);
  return (
    <ToolShell title="RGB → CMYK" subtitle="Convert a colour to the CMYK values used in print.">
      <Panel>
        <div className="flex items-center gap-3">
          <input type="color" value={rgb ? rgbToHex(rgb) : "#38bdf8"} onChange={(e) => setHex(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent" style={{ borderColor: "var(--line-2)" }} />
          <div className="flex-1"><Input value={hex} onChange={setHex} /></div>
        </div>
      </Panel>
      <Panel>
        {cmyk ? (
          <div className="grid grid-cols-4 gap-2">
            <Stat value={`${cmyk.c}%`} label="Cyan" /><Stat value={`${cmyk.m}%`} label="Magenta" /><Stat value={`${cmyk.y}%`} label="Yellow" /><Stat value={`${cmyk.k}%`} label="Key/Black" />
          </div>
        ) : <ErrorNote message="Enter a valid colour." />}
        {cmyk && <div className="mt-3"><Output value={`cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`} /></div>}
      </Panel>
    </ToolShell>
  );
}

function ColorAdjustTool() {
  const [hex, setHex] = useState("#6d5efc");
  const [l, setL] = useState(0), [s, setS] = useState(0), [h, setH] = useState(0);
  const out = useMemo(() => F.adjustColor(hex, { lightness: l, saturation: s, hue: h }), [hex, l, s, h]);
  const Slider = ({ label, val, set, min, max }: { label: string; val: number; set: (n: number) => void; min: number; max: number }) => (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span className="label">{label}</span><span className="mono">{val}</span></div>
      <input type="range" min={min} max={max} value={val} onChange={(e) => set(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
    </div>
  );
  return (
    <ToolShell title="Colour Adjuster" subtitle="Lighten, darken, saturate and rotate the hue of a colour.">
      <Panel>
        <div className="mb-3 flex items-center gap-3">
          <input type="color" value={parseColor(hex) ? rgbToHex(parseColor(hex)!) : "#6d5efc"} onChange={(e) => setHex(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent" style={{ borderColor: "var(--line-2)" }} />
          <div className="flex-1"><Input value={hex} onChange={setHex} /></div>
        </div>
        <div className="grid gap-3">
          <Slider label="Lightness" val={l} set={setL} min={-100} max={100} />
          <Slider label="Saturation" val={s} set={setS} min={-100} max={100} />
          <Slider label="Hue" val={h} set={setH} min={-180} max={180} />
        </div>
      </Panel>
      <Panel>
        {out ? (
          <div className="flex items-center gap-3">
            <span className="h-16 w-16 rounded-xl border" style={{ background: out, borderColor: "var(--line-2)" }} />
            <Output value={out} label="Adjusted" />
          </div>
        ) : <ErrorNote message="Enter a valid colour." />}
      </Panel>
    </ToolShell>
  );
}

function TintsTool() {
  const [hex, setHex] = useState("#22c55e");
  const res = useMemo(() => F.tintsAndShades(hex), [hex]);
  return (
    <ToolShell title="Tints & Shades" subtitle="Build a lightness scale from a single base colour.">
      <Panel>
        <div className="flex items-center gap-3">
          <input type="color" value={parseColor(hex) ? rgbToHex(parseColor(hex)!) : "#22c55e"} onChange={(e) => setHex(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent" style={{ borderColor: "var(--line-2)" }} />
          <div className="flex-1"><Input value={hex} onChange={setHex} /></div>
        </div>
      </Panel>
      {res ? (
        <>
          <Panel><p className="label mb-2">Tints (lighter)</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{res.tints.map((c, i) => <Swatch key={i} hex={c} />)}</div></Panel>
          <Panel><p className="label mb-2">Shades (darker)</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{res.shades.map((c, i) => <Swatch key={i} hex={c} />)}</div></Panel>
        </>
      ) : <Panel><ErrorNote message="Enter a valid colour." /></Panel>}
    </ToolShell>
  );
}

function NamedColorTool() {
  const [hex, setHex] = useState("#4a7fd6");
  const res = useMemo(() => F.nearestColorName(hex), [hex]);
  return (
    <ToolShell title="Nearest Colour Name" subtitle="Find the closest CSS named colour to any hex value.">
      <Panel>
        <div className="flex items-center gap-3">
          <input type="color" value={parseColor(hex) ? rgbToHex(parseColor(hex)!) : "#4a7fd6"} onChange={(e) => setHex(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent" style={{ borderColor: "var(--line-2)" }} />
          <div className="flex-1"><Input value={hex} onChange={setHex} /></div>
        </div>
      </Panel>
      <Panel>
        {res ? (
          <div className="flex items-center gap-3">
            <span className="h-14 w-14 rounded-xl border" style={{ background: res.hex, borderColor: "var(--line-2)" }} />
            <div><div className="font-display text-xl capitalize">{res.name}</div><div className="mono text-xs text-[var(--fg-2)]">{res.hex} · distance {res.distance}</div></div>
          </div>
        ) : <ErrorNote message="Enter a valid colour." />}
      </Panel>
    </ToolShell>
  );
}

function AlphaTool() {
  const [hex, setHex] = useState("#6d5efc");
  const [alpha, setAlpha] = useState(0.5);
  const res = useMemo(() => F.withAlpha(hex, alpha), [hex, alpha]);
  return (
    <ToolShell title="Colour Alpha" subtitle="Add transparency and get 8-digit hex plus rgba() output.">
      <Panel>
        <div className="mb-3 flex items-center gap-3">
          <input type="color" value={parseColor(hex) ? rgbToHex(parseColor(hex)!) : "#6d5efc"} onChange={(e) => setHex(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border bg-transparent" style={{ borderColor: "var(--line-2)" }} />
          <div className="flex-1"><Input value={hex} onChange={setHex} /></div>
        </div>
        <div><div className="mb-1 flex justify-between text-xs"><span className="label">Alpha</span><span className="mono">{alpha.toFixed(2)}</span></div>
          <input type="range" min={0} max={1} step={0.01} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></div>
      </Panel>
      <Panel>
        {res ? <><Output value={res.hex8} label="8-digit hex" /><div className="mt-3"><Output value={res.rgba} label="rgba()" /></div></> : <ErrorNote message="Enter a valid colour." />}
      </Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * TEXT
 * ================================================================== */
function DedupeTool() {
  const [text, setText] = useState("apple\nBanana\napple\ncherry\nbanana\ncherry");
  const [trim, setTrim] = useState(true), [ci, setCi] = useState(false), [sort, setSort] = useState(false);
  const res = useMemo(() => F.dedupeLines(text, { trim, ci, sort }), [text, trim, ci, sort]);
  return (
    <ToolShell title="Deduplicate Lines" subtitle="Remove duplicate lines, optionally ignoring case and re-sorting.">
      <Panel>
        <Field label="Lines"><TextArea value={text} onChange={setText} rows={7} /></Field>
        <div className="mt-3 flex flex-wrap gap-4"><Toggle label="Trim" checked={trim} onChange={setTrim} /><Toggle label="Ignore case" checked={ci} onChange={setCi} /><Toggle label="Sort" checked={sort} onChange={setSort} /></div>
      </Panel>
      <Panel><Output value={res.output} label={`${res.removed} duplicate${res.removed !== 1 ? "s" : ""} removed`} /></Panel>
    </ToolShell>
  );
}

function OccurTool() {
  const [text, setText] = useState("the quick brown fox jumps over the lazy dog. the end.");
  const [needle, setNeedle] = useState("the");
  const [ci, setCi] = useState(true);
  const count = useMemo(() => F.countOccurrences(text, needle, ci), [text, needle, ci]);
  return (
    <ToolShell title="Count Occurrences" subtitle="Count how many times a substring appears in your text.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={5} mono={false} /></Field>
        <div className="mt-3 flex flex-wrap items-end gap-3"><Field label="Find"><Input value={needle} onChange={setNeedle} /></Field><div className="pb-2"><Toggle label="Ignore case" checked={ci} onChange={setCi} /></div></div>
      </Panel>
      <Panel><Stat value={count} label={`occurrences of “${needle}”`} /></Panel>
    </ToolShell>
  );
}

function ReverseWordsTool() {
  const [text, setText] = useState("the quick brown fox");
  const out = useMemo(() => F.reverseWords(text), [text]);
  return (
    <ToolShell title="Reverse Words" subtitle="Reverse the order of words on each line.">
      <Panel><Field label="Text"><TextArea value={text} onChange={setText} rows={4} mono={false} /></Field></Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function SortWordsTool() {
  const [text, setText] = useState("banana apple cherry date elderberry");
  const [dir, setDir] = useState<"asc" | "desc" | "len">("asc");
  const out = useMemo(() => F.sortWords(text, dir), [text, dir]);
  return (
    <ToolShell title="Sort Words" subtitle="Alphabetise words or order them by length.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={4} mono={false} /></Field>
        <div className="mt-3"><Segmented value={dir} onChange={setDir} options={[{ value: "asc", label: "A → Z" }, { value: "desc", label: "Z → A" }, { value: "len", label: "By length" }]} /></div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function AccentsTool() {
  const [text, setText] = useState("Crème brûlée, jalapeño & naïve façade");
  const out = useMemo(() => F.removeAccents(text), [text]);
  return (
    <ToolShell title="Remove Accents" subtitle="Strip diacritics to produce plain ASCII-friendly text.">
      <Panel><Field label="Text"><TextArea value={text} onChange={setText} rows={4} mono={false} /></Field></Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function ExtractTool() {
  const [text, setText] = useState("Contact hi@saleh.im or visit https://saleh.im — call 555-1234 from 10.0.0.1 #forge @saleh");
  const [kind, setKind] = useState<"email" | "url" | "number" | "ip" | "hashtag" | "mention">("email");
  const out = useMemo(() => F.extractPattern(text, kind), [text, kind]);
  return (
    <ToolShell title="Extract Patterns" subtitle="Pull emails, URLs, numbers, IPs, hashtags or mentions out of text.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={5} mono={false} /></Field>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["email", "url", "number", "ip", "hashtag", "mention"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className="rounded-full px-3 py-1.5 text-xs font-medium capitalize" style={kind === k ? { background: "var(--accent)", color: "var(--on-accent)" } : { border: "1px solid var(--line-2)", color: "var(--fg-2)" }}>{k}</button>
          ))}
        </div>
      </Panel>
      <Panel><Output value={out.join("\n")} label={`${out.length} match${out.length !== 1 ? "es" : ""}`} /></Panel>
    </ToolShell>
  );
}

function NatoTool() {
  const [text, setText] = useState("Saleh 2026");
  const out = useMemo(() => F.toNato(text), [text]);
  return (
    <ToolShell title="NATO Phonetic" subtitle="Spell out text using the NATO phonetic alphabet.">
      <Panel><Field label="Text"><Input value={text} onChange={setText} /></Field></Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function LeetTool() {
  const [text, setText] = useState("elite hacker");
  const out = useMemo(() => F.toLeet(text), [text]);
  return (
    <ToolShell title="Leetspeak" subtitle="Convert text into playful 1337 5p34k.">
      <Panel><Field label="Text"><Input value={text} onChange={setText} /></Field></Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function Rot47Tool() {
  const [text, setText] = useState("Hello, Forge!");
  const out = useMemo(() => F.rot47(text), [text]);
  return (
    <ToolShell title="ROT47" subtitle="A reversible cipher over all printable ASCII (apply twice to decode).">
      <Panel><Field label="Text"><TextArea value={text} onChange={setText} rows={4} /></Field></Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function WrapTool() {
  const [text, setText] = useState("Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.");
  const [cols, setCols] = useState(40);
  const out = useMemo(() => F.wrapText(text, cols), [text, cols]);
  return (
    <ToolShell title="Wrap Text" subtitle="Hard-wrap paragraphs at a chosen column width.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={4} mono={false} /></Field>
        <div className="mt-3"><Field label="Columns"><NumInput value={cols} onChange={setCols} min={1} max={500} /></Field></div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function PadTool() {
  const [text, setText] = useState("1\n22\n333");
  const [width, setWidth] = useState(6);
  const [ch, setCh] = useState("0");
  const [side, setSide] = useState<"left" | "right">("left");
  const out = useMemo(() => F.padText(text, width, ch, side), [text, width, ch, side]);
  return (
    <ToolShell title="Pad & Align" subtitle="Pad each line to a fixed width with a character of your choice.">
      <Panel>
        <Field label="Lines"><TextArea value={text} onChange={setText} rows={5} /></Field>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Width"><NumInput value={width} onChange={setWidth} min={0} w="w-20" /></Field>
          <Field label="Pad char"><Input value={ch} onChange={setCh} /></Field>
          <div className="pb-1"><Segmented value={side} onChange={setSide} options={[{ value: "left", label: "Left pad" }, { value: "right", label: "Right pad" }]} /></div>
        </div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function TruncateTool() {
  const [text, setText] = useState("This is a fairly long sentence that we would like to shorten neatly.");
  const [len, setLen] = useState(30);
  const [ell, setEll] = useState("…");
  const out = useMemo(() => F.truncateText(text, len, ell), [text, len, ell]);
  return (
    <ToolShell title="Truncate Text" subtitle="Cut text to a maximum length and append an ellipsis.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={3} mono={false} /></Field>
        <div className="mt-3 flex flex-wrap items-end gap-3"><Field label="Max length"><NumInput value={len} onChange={setLen} min={1} /></Field><Field label="Ellipsis"><Input value={ell} onChange={setEll} /></Field></div>
      </Panel>
      <Panel><Output value={out} label={`${out.length} chars`} /></Panel>
    </ToolShell>
  );
}

function PalindromeTool() {
  const [text, setText] = useState("A man, a plan, a canal: Panama");
  const res = useMemo(() => F.isPalindrome(text), [text]);
  return (
    <ToolShell title="Palindrome Checker" subtitle="Test whether text reads the same forwards and backwards (ignoring punctuation).">
      <Panel><Field label="Text"><Input value={text} onChange={setText} /></Field></Panel>
      <Panel><Stat value={res ? "Yes ✓" : "No"} label="Palindrome?" /></Panel>
    </ToolShell>
  );
}

function AnagramTool() {
  const [a, setA] = useState("listen"), [b, setB] = useState("silent");
  const res = useMemo(() => F.isAnagram(a, b), [a, b]);
  return (
    <ToolShell title="Anagram Checker" subtitle="Check whether two phrases are anagrams of each other.">
      <Panel><div className="grid gap-3 sm:grid-cols-2"><Field label="First"><Input value={a} onChange={setA} /></Field><Field label="Second"><Input value={b} onChange={setB} /></Field></div></Panel>
      <Panel><Stat value={res ? "Yes ✓" : "No"} label="Anagram?" /></Panel>
    </ToolShell>
  );
}

function SpreadsheetColTool() {
  const [dir, setDir] = useState<"a2n" | "n2a">("a2n");
  const [input, setInput] = useState("AZ");
  const out = useMemo(() => {
    if (dir === "a2n") { const n = F.columnToNumber(input); return Number.isFinite(n) && n > 0 ? String(n) : "invalid"; }
    const n = Math.trunc(Number(input)); return n > 0 ? F.numberToColumn(n) : "invalid";
  }, [dir, input]);
  return (
    <ToolShell title="Spreadsheet Column" subtitle="Convert spreadsheet column letters (A, B … AA) to numbers and back.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "a2n", label: "Letters → Number" }, { value: "n2a", label: "Number → Letters" }]} /></div>
        <Field label={dir === "a2n" ? "Column letters" : "Column number"}><Input value={input} onChange={setInput} /></Field>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function FancyTextTool() {
  const [text, setText] = useState("Forge");
  const styles = ["bold", "italic", "script", "circled", "fullwidth"];
  return (
    <ToolShell title="Fancy Text" subtitle="Turn plain text into stylish Unicode variants for bios and posts.">
      <Panel><Field label="Text"><Input value={text} onChange={setText} /></Field></Panel>
      {styles.map((s) => (
        <Panel key={s}>
          <div className="flex items-center justify-between gap-2">
            <div><p className="label capitalize">{s}</p><p className="mt-1 break-words text-lg">{F.fancyText(text, s)}</p></div>
            <CopyBtn text={F.fancyText(text, s)} label="" />
          </div>
        </Panel>
      ))}
    </ToolShell>
  );
}

function RemoveBreaksTool() {
  const [text, setText] = useState("line one\nline two\nline three");
  const [rep, setRep] = useState(" ");
  const out = useMemo(() => F.removeLineBreaks(text, rep), [text, rep]);
  return (
    <ToolShell title="Remove Line Breaks" subtitle="Join multi-line text into one line, replacing breaks with a separator.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={5} /></Field>
        <div className="mt-3"><Field label="Replace breaks with" hint="use \\n to keep newlines"><Input value={rep} onChange={setRep} /></Field></div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * ENCODE / CRYPTO
 * ================================================================== */
function PunycodeTool() {
  const [input, setInput] = useState("münchen.example");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = useMemo(() => (dir === "enc" ? { ok: true as const, value: F.punycodeEncode(input) } : F.punycodeDecode(input)), [input, dir]);
  return (
    <ToolShell title="Punycode (IDN)" subtitle="Encode internationalised domain names to ASCII (xn--) and back.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Unicode → ASCII" }, { value: "dec", label: "ASCII → Unicode" }]} /></div>
        <Field label="Domain"><Input value={input} onChange={setInput} /></Field>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function QuotedPrintableTool() {
  const [input, setInput] = useState("Héllo = café ☕");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = useMemo(() => (dir === "enc" ? { ok: true as const, value: F.quotedPrintableEncode(input) } : F.quotedPrintableDecode(input)), [input, dir]);
  return (
    <ToolShell title="Quoted-Printable" subtitle="Encode / decode the MIME quoted-printable transfer encoding.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encode" }, { value: "dec", label: "Decode" }]} /></div>
        <Field label="Text"><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function XorTool() {
  const [input, setInput] = useState("secret message");
  const [key, setKey] = useState("forge");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = useMemo(() => F.xorCipher(input, key, dir === "dec"), [input, key, dir]);
  return (
    <ToolShell title="XOR Cipher" subtitle="Symmetric XOR with a repeating key; ciphertext is shown as hex.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encrypt" }, { value: "dec", label: "Decrypt (hex)" }]} /></div>
        <Field label={dir === "enc" ? "Plain text" : "Hex ciphertext"}><TextArea value={input} onChange={setInput} rows={3} /></Field>
        <div className="mt-3"><Field label="Key"><Input value={key} onChange={setKey} /></Field></div>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function VigenereTool() {
  const [input, setInput] = useState("Attack at dawn");
  const [key, setKey] = useState("lemon");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = useMemo(() => F.vigenere(input, key, dir === "dec"), [input, key, dir]);
  return (
    <ToolShell title="Vigenère Cipher" subtitle="Classic poly-alphabetic substitution cipher with a keyword.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encrypt" }, { value: "dec", label: "Decrypt" }]} /></div>
        <Field label="Text"><TextArea value={input} onChange={setInput} rows={3} /></Field>
        <div className="mt-3"><Field label="Keyword"><Input value={key} onChange={setKey} /></Field></div>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function RailFenceTool() {
  const [input, setInput] = useState("WE ARE DISCOVERED FLEE AT ONCE");
  const [rails, setRails] = useState(3);
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = useMemo(() => F.railFence(input, rails, dir === "dec"), [input, rails, dir]);
  return (
    <ToolShell title="Rail Fence Cipher" subtitle="Transposition cipher that zig-zags text across a number of rails.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encrypt" }, { value: "dec", label: "Decrypt" }]} /></div>
        <Field label="Text"><TextArea value={input} onChange={setInput} rows={3} /></Field>
        <div className="mt-3"><Field label="Rails"><NumInput value={rails} onChange={setRails} min={2} max={50} w="w-20" /></Field></div>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function HmacTool() {
  const [msg, setMsg] = useState("The quick brown fox");
  const [key, setKey] = useState("key");
  const [algo, setAlgo] = useState<"SHA-1" | "SHA-256" | "SHA-384" | "SHA-512">("SHA-256");
  const [out, setOut] = useState("");
  useEffect(() => {
    let live = true;
    F.hmacHex(msg, key, algo).then((h) => live && setOut(h)).catch(() => live && setOut(""));
    return () => { live = false; };
  }, [msg, key, algo]);
  return (
    <ToolShell title="HMAC" subtitle="Keyed-hash message authentication code using the Web Crypto API.">
      <Panel>
        <Field label="Message"><TextArea value={msg} onChange={setMsg} rows={3} /></Field>
        <div className="mt-3"><Field label="Secret key"><Input value={key} onChange={setKey} /></Field></div>
        <div className="mt-3"><Segmented value={algo} onChange={setAlgo} options={[{ value: "SHA-1", label: "SHA-1" }, { value: "SHA-256", label: "SHA-256" }, { value: "SHA-384", label: "SHA-384" }, { value: "SHA-512", label: "SHA-512" }]} /></div>
      </Panel>
      <Panel><Output value={out} label={`HMAC-${algo}`} /></Panel>
    </ToolShell>
  );
}

function TotpTool() {
  const [secret, setSecret] = useState("JBSWY3DPEHPK3PXP");
  const [digits, setDigits] = useState(6);
  const [period, setPeriod] = useState(30);
  const [res, setRes] = useState<{ code: string; secondsLeft: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const tick = () => {
      F.totpCode(secret, { digits, period, algo: "SHA-1" }).then((r) => {
        if (!live) return;
        if (r.ok) { setRes(r.value); setError(""); } else { setRes(null); setError(r.error); }
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { live = false; clearInterval(id); };
  }, [secret, digits, period]);
  return (
    <ToolShell title="TOTP Generator" subtitle="Live time-based one-time passwords (RFC 6238) from a Base32 secret.">
      <Panel>
        <Field label="Base32 secret"><Input value={secret} onChange={setSecret} /></Field>
        <div className="mt-3 flex flex-wrap items-end gap-3"><Field label="Digits"><NumInput value={digits} onChange={setDigits} min={4} max={10} w="w-20" /></Field><Field label="Period (s)"><NumInput value={period} onChange={setPeriod} min={10} max={120} w="w-24" /></Field></div>
      </Panel>
      <Panel>
        {error ? <ErrorNote message={error} /> : res ? (
          <div className="text-center">
            <div className="font-display text-4xl tracking-[0.3em]" style={{ color: "var(--accent)" }}>{res.code}</div>
            <div className="mt-2 text-sm text-[var(--fg-2)]">refreshes in {res.secondsLeft}s</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}><div className="h-full" style={{ width: `${(res.secondsLeft / period) * 100}%`, background: "var(--accent)", transition: "width 1s linear" }} /></div>
          </div>
        ) : <p className="text-sm text-[var(--fg-2)]">Computing…</p>}
      </Panel>
    </ToolShell>
  );
}

function Ascii85Tool() {
  const [input, setInput] = useState("Hello, Forge!");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = useMemo(() => (dir === "enc" ? { ok: true as const, value: F.ascii85Encode(input) } : F.ascii85Decode(input)), [input, dir]);
  return (
    <ToolShell title="Ascii85 / Base85" subtitle="Compact binary-to-text encoding used in PDF and PostScript.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encode" }, { value: "dec", label: "Decode" }]} /></div>
        <Field label="Text"><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function UuidInspectTool() {
  const [input, setInput] = useState("f47ac10b-58cc-4372-a567-0e02b2c3d479");
  const res = useMemo(() => F.inspectUuid(input), [input]);
  return (
    <ToolShell title="UUID Inspector" subtitle="Validate a UUID and reveal its version, variant and (for v1) timestamp.">
      <Panel><Field label="UUID"><Input value={input} onChange={setInput} /></Field></Panel>
      <Panel>
        {res.ok ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat value={`v${res.value.version}`} label="Version" />
            <Stat value={res.value.variant} label="Variant" />
            {res.value.timestamp && <div className="col-span-2"><Output value={res.value.timestamp} label="Timestamp (v1)" /></div>}
          </div>
        ) : <ErrorNote message={res.error} />}
      </Panel>
    </ToolShell>
  );
}

function TextHexTool() {
  const [input, setInput] = useState("Forge ⚒");
  const [dir, setDir] = useState<"t2h" | "h2t">("t2h");
  const res = useMemo(() => (dir === "t2h" ? { ok: true as const, value: F.textToHex(input) } : F.hexToTextStr(input)), [input, dir]);
  return (
    <ToolShell title="Text ⇄ Hex" subtitle="Encode UTF-8 text as hexadecimal bytes and decode it back.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "t2h", label: "Text → Hex" }, { value: "h2t", label: "Hex → Text" }]} /></div>
        <Field label={dir === "t2h" ? "Text" : "Hex bytes"}><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function UnicodeEscapeTool() {
  const [input, setInput] = useState("Café — naïve 日本語");
  const [dir, setDir] = useState<"esc" | "unesc">("esc");
  const res = useMemo(() => (dir === "esc" ? { ok: true as const, value: F.unicodeEscape(input) } : F.unicodeUnescape(input)), [input, dir]);
  return (
    <ToolShell title="Unicode Escape" subtitle="Escape non-ASCII characters as \\uXXXX sequences and unescape them.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "esc", label: "Escape" }, { value: "unesc", label: "Unescape" }]} /></div>
        <Field label="Text"><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * DEVELOPER UTILITIES
 * ================================================================== */
function SemverTool() {
  const [a, setA] = useState("1.4.0"), [b, setB] = useState("1.10.0-rc.1");
  const [bump, setBump] = useState<"major" | "minor" | "patch" | "prerelease">("minor");
  const cmp = useMemo(() => F.semverCompare(a, b), [a, b]);
  const bumped = useMemo(() => F.semverBump(a, bump), [a, bump]);
  return (
    <ToolShell title="Semantic Versioning" subtitle="Compare two semver strings and bump versions (major/minor/patch/prerelease).">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Version A"><Input value={a} onChange={setA} /></Field><Field label="Version B"><Input value={b} onChange={setB} /></Field></div>
      </Panel>
      <Panel>{cmp.ok ? <Stat value={cmp.value.label} label="Comparison" /> : <ErrorNote message={cmp.error} />}</Panel>
      <Panel>
        <div className="mb-3"><Segmented value={bump} onChange={setBump} options={[{ value: "major", label: "major" }, { value: "minor", label: "minor" }, { value: "patch", label: "patch" }, { value: "prerelease", label: "prerelease" }]} /></div>
        {bumped.ok ? <Output value={bumped.value} label={`A bumped (${bump})`} /> : <ErrorNote message={bumped.error} />}
      </Panel>
    </ToolShell>
  );
}

function JsonYamlTool() {
  const [input, setInput] = useState('{\n  "name": "forge",\n  "version": "1.0.0",\n  "keywords": ["dev", "tools"],\n  "private": true\n}');
  const res = useMemo(() => F.jsonToYaml(input), [input]);
  return (
    <ToolShell title="JSON → YAML" subtitle="Convert JSON into readable YAML.">
      <Panel><Field label="JSON"><TextArea value={input} onChange={setInput} rows={9} /></Field></Panel>
      <Panel>{res.ok ? <Output value={res.value} label="YAML" /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function YamlJsonTool() {
  const [input, setInput] = useState("name: forge\nversion: 1.0.0\nkeywords:\n  - dev\n  - tools\nprivate: true");
  const res = useMemo(() => F.yamlToJson(input), [input]);
  return (
    <ToolShell title="YAML → JSON" subtitle="Parse a common subset of YAML into JSON.">
      <Panel><Field label="YAML"><TextArea value={input} onChange={setInput} rows={9} /></Field></Panel>
      <Panel>{res.ok ? <Output value={res.value} label="JSON" /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function SqlFormatTool() {
  const [input, setInput] = useState("select id, name, email from users u inner join orders o on o.user_id = u.id where u.active = 1 and o.total > 100 order by o.total desc limit 20");
  const out = useMemo(() => F.formatSql(input), [input]);
  return (
    <ToolShell title="SQL Formatter" subtitle="Add line breaks and indentation to a one-line SQL statement.">
      <Panel><Field label="SQL"><TextArea value={input} onChange={setInput} rows={5} /></Field></Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function CssMinTool() {
  const [input, setInput] = useState(".btn {\n  color: #fff;\n  padding: 8px 16px; /* comfy */\n  border-radius: 12px;\n}\n\n.btn:hover { opacity: 0.9; }");
  const out = useMemo(() => F.minifyCss(input), [input]);
  return (
    <ToolShell title="CSS Minifier" subtitle="Strip comments and whitespace to shrink CSS.">
      <Panel><Field label="CSS"><TextArea value={input} onChange={setInput} rows={8} /></Field></Panel>
      <Panel><Output value={out} label={`${out.length} bytes`} /></Panel>
    </ToolShell>
  );
}

function HtmlMinTool() {
  const [input, setInput] = useState("<!-- header -->\n<div class=\"card\">\n  <h1>  Title  </h1>\n  <p>Some    text here.</p>\n</div>");
  const out = useMemo(() => F.minifyHtml(input), [input]);
  return (
    <ToolShell title="HTML Minifier" subtitle="Remove comments and collapse whitespace between tags.">
      <Panel><Field label="HTML"><TextArea value={input} onChange={setInput} rows={8} /></Field></Panel>
      <Panel><Output value={out} label={`${out.length} bytes`} /></Panel>
    </ToolShell>
  );
}

function JsonXmlTool() {
  const [input, setInput] = useState('{\n  "book": {\n    "title": "Forge",\n    "tags": ["dev", "tools"]\n  }\n}');
  const [root, setRoot] = useState("root");
  const res = useMemo(() => F.jsonToXml(input, root || "root"), [input, root]);
  return (
    <ToolShell title="JSON → XML" subtitle="Serialise a JSON document into indented XML.">
      <Panel>
        <Field label="JSON"><TextArea value={input} onChange={setInput} rows={8} /></Field>
        <div className="mt-3"><Field label="Root element"><Input value={root} onChange={setRoot} /></Field></div>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} label="XML" /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function JsonDiffTool() {
  const [a, setA] = useState('{\n  "name": "forge",\n  "version": 1,\n  "flags": ["a", "b"]\n}');
  const [b, setB] = useState('{\n  "name": "forge",\n  "version": 2,\n  "flags": ["a", "c"],\n  "extra": true\n}');
  const res = useMemo(() => F.jsonDiff(a, b), [a, b]);
  const colors: Record<string, string> = { added: "#22c55e", removed: "#ef4444", changed: "#fbbf24" };
  return (
    <ToolShell title="JSON Diff" subtitle="See added, removed and changed keys between two JSON documents.">
      <Panel><div className="grid gap-3 sm:grid-cols-2"><Field label="A"><TextArea value={a} onChange={setA} rows={8} /></Field><Field label="B"><TextArea value={b} onChange={setB} rows={8} /></Field></div></Panel>
      <Panel>
        {!res.ok ? <ErrorNote message={res.error} /> : res.value.length === 0 ? <p className="text-sm text-[var(--fg-2)]">The two documents are identical.</p> : (
          <div className="grid gap-1.5">
            {res.value.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                <span className="mono text-xs font-semibold uppercase" style={{ color: colors[d.type] }}>{d.type}</span>
                <span className="mono accent-text">{d.path}</span>
                {d.a != null && <span className="mono text-[var(--fg-2)] line-through">{d.a}</span>}
                {d.b != null && <span className="mono">{d.b}</span>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </ToolShell>
  );
}

function FlattenTool() {
  const [input, setInput] = useState('{\n  "user": {\n    "name": "Saleh",\n    "roles": ["admin", "dev"]\n  },\n  "active": true\n}');
  const res = useMemo(() => F.flattenJson(input), [input]);
  return (
    <ToolShell title="Flatten JSON" subtitle="Flatten nested objects into dot / bracket key paths.">
      <Panel><Field label="JSON"><TextArea value={input} onChange={setInput} rows={8} /></Field></Panel>
      <Panel>{res.ok ? <Output value={res.value} label="Flattened" /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function EscapeRegexTool() {
  const [input, setInput] = useState("Price: $9.99 (was $19.99)?");
  const out = useMemo(() => F.escapeRegex(input), [input]);
  return (
    <ToolShell title="Escape Regex" subtitle="Escape special characters so a literal string is safe inside a regular expression.">
      <Panel><Field label="Text"><TextArea value={input} onChange={setInput} rows={3} /></Field></Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function HeadersTool() {
  const [input, setInput] = useState("Content-Type: application/json\nCache-Control: no-cache\nX-Request-Id: abc-123\nAuthorization: Bearer xxx");
  const rows = useMemo(() => F.parseHeaders(input), [input]);
  return (
    <ToolShell title="HTTP Header Parser" subtitle="Split raw HTTP headers into structured name / value pairs.">
      <Panel><Field label="Raw headers"><TextArea value={input} onChange={setInput} rows={6} /></Field></Panel>
      <Panel>
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr] gap-2 border-b px-3 py-2 text-sm last:border-0" style={{ borderColor: "var(--line)" }}>
              <span className="mono font-medium accent-text break-words">{r.name}</span>
              <span className="mono break-words text-[var(--fg-2)]">{r.value || "—"}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

function UserAgentTool() {
  const [input, setInput] = useState("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  const info = useMemo(() => F.parseUserAgent(input), [input]);
  return (
    <ToolShell title="User-Agent Parser" subtitle="Break a user-agent string into browser, engine, OS and device.">
      <Panel><Field label="User-Agent"><TextArea value={input} onChange={setInput} rows={3} /></Field></Panel>
      <Panel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat value={info.browser} label="Browser" /><Stat value={info.version || "—"} label="Version" /><Stat value={info.engine} label="Engine" />
          <Stat value={info.os} label="OS" /><Stat value={info.device} label="Device" />
        </div>
      </Panel>
    </ToolShell>
  );
}

function MimeTool() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => F.mimeLookup(q).slice(0, 60), [q]);
  return (
    <ToolShell title="MIME Types" subtitle="Look up the MIME type for a file extension (or search the table).">
      <Panel><Field label="Extension or search"><Input value={q} onChange={setQ} placeholder="e.g. png, json, video" /></Field></Panel>
      <Panel>
        <div className="thin-scroll max-h-[420px] overflow-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
          {rows.map((r) => (
            <div key={r.ext} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b px-3 py-2 text-sm last:border-0" style={{ borderColor: "var(--line)" }}>
              <span className="mono font-medium accent-text">.{r.ext}</span>
              <span className="mono text-[var(--fg-2)]">{r.mime}</span>
              <CopyBtn text={r.mime} label="" />
            </div>
          ))}
          {rows.length === 0 && <p className="px-3 py-4 text-sm text-[var(--fg-2)]">No matches.</p>}
        </div>
      </Panel>
    </ToolShell>
  );
}

function CronNextTool() {
  const [expr, setExpr] = useState("*/15 9-17 * * 1-5");
  const [count, setCount] = useState(6);
  const res = useMemo(() => F.cronNextRuns(expr, count), [expr, count]);
  return (
    <ToolShell title="Cron Next Runs" subtitle="Compute the next execution times for a standard 5-field cron expression.">
      <Panel>
        <Field label="Cron expression" hint="min hour day month weekday"><Input value={expr} onChange={setExpr} /></Field>
        <div className="mt-3"><Field label="Occurrences"><NumInput value={count} onChange={setCount} min={1} max={50} w="w-20" /></Field></div>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value.map((r, i) => `${i + 1}. ${r}`).join("\n")} label="Upcoming runs" /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function QueryBuildTool() {
  const [pairs, setPairs] = useState<{ key: string; value: string }[]>([{ key: "q", value: "forge tools" }, { key: "page", value: "2" }, { key: "sort", value: "new" }]);
  const out = useMemo(() => F.buildQueryString(pairs), [pairs]);
  const update = (i: number, field: "key" | "value", v: string) => setPairs((p) => p.map((x, j) => (j === i ? { ...x, [field]: v } : x)));
  return (
    <ToolShell title="Query String Builder" subtitle="Assemble a properly URL-encoded query string from key / value pairs.">
      <Panel>
        <div className="grid gap-2">
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={p.key} onChange={(v) => update(i, "key", v)} />
              <span className="text-[var(--fg-2)]">=</span>
              <Input value={p.value} onChange={(v) => update(i, "value", v)} />
              <button onClick={() => setPairs((x) => x.filter((_, j) => j !== i))} className="chip">✕</button>
            </div>
          ))}
        </div>
        <div className="mt-3"><Btn onClick={() => setPairs((p) => [...p, { key: "", value: "" }])}>+ Add pair</Btn></div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * CONVERT — unit converters (thin wrappers over UnitConverter)
 * ================================================================== */
const AngleTool = () => <UnitConverter title="Angle Converter" subtitle="Convert between degrees, radians, gradians, turns and arc units." map={F.ANGLE_UNITS} initFrom="deg" initTo="rad" />;
const SpeedTool = () => <UnitConverter title="Speed Converter" subtitle="Convert m/s, km/h, mph, knots, ft/s and Mach." map={F.SPEED_UNITS} initFrom="kph" initTo="mph" />;
const AreaTool = () => <UnitConverter title="Area Converter" subtitle="Convert m², km², ft², acres, hectares and more." map={F.AREA_UNITS} initFrom="m2" initTo="ft2" />;
const VolumeTool = () => <UnitConverter title="Volume Converter" subtitle="Convert litres, millilitres, gallons, cups and more." map={F.VOLUME_UNITS} initFrom="l" initTo="gal" />;
const PressureTool = () => <UnitConverter title="Pressure Converter" subtitle="Convert pascal, bar, PSI, atmosphere, torr and mmHg." map={F.PRESSURE_UNITS} initFrom="bar" initTo="psi" />;
const EnergyTool = () => <UnitConverter title="Energy Converter" subtitle="Convert joules, calories, watt-hours, BTU and electronvolts." map={F.ENERGY_UNITS} initFrom="kcal" initTo="kj" />;
const PowerTool = () => <UnitConverter title="Power Converter" subtitle="Convert watts, kilowatts, horsepower and BTU/hour." map={F.POWER_UNITS} initFrom="hp" initTo="kw" />;
const DataRateTool = () => <UnitConverter title="Data Rate Converter" subtitle="Convert between bit/s and byte/s across metric prefixes." map={F.DATARATE_UNITS} initFrom="mbps" initTo="MBps" />;
const TypographyTool = () => <UnitConverter title="Typography Units" subtitle="Convert px, pt, pica, inches and metric print units." map={F.TYPOGRAPHY_UNITS} initFrom="pt" initTo="px" />;
const CookingTool = () => <UnitConverter title="Cooking Measures" subtitle="Convert teaspoons, tablespoons, cups, pints and millilitres." map={F.COOKING_UNITS} initFrom="cup" initTo="ml" />;

function FrequencyTool() {
  const [input, setInput] = useState(2.4e9);
  const [mode, setMode] = useState<"f2w" | "w2f">("f2w");
  const out = useMemo(() => F.frequencyWavelength(input, mode), [input, mode]);
  return (
    <ToolShell title="Frequency ⇄ Wavelength" subtitle="Relate frequency (Hz) and wavelength (m) for electromagnetic waves.">
      <Panel>
        <div className="mb-3"><Segmented value={mode} onChange={setMode} options={[{ value: "f2w", label: "Freq → λ" }, { value: "w2f", label: "λ → Freq" }]} /></div>
        <Field label={mode === "f2w" ? "Frequency (Hz)" : "Wavelength (m)"}><NumInput value={input} onChange={setInput} w="w-full" /></Field>
      </Panel>
      <Panel><Stat value={fmt(out, 8)} label={mode === "f2w" ? "Wavelength (m)" : "Frequency (Hz)"} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * NETWORK
 * ================================================================== */
function MacTool() {
  const [mac, setMac] = useState("001B441130AE");
  const [sep, setSep] = useState<":" | "-" | ".">(":");
  const [upper, setUpper] = useState(false);
  const res = useMemo(() => F.formatMac(mac, sep, upper), [mac, sep, upper]);
  return (
    <ToolShell title="MAC Address" subtitle="Normalise and reformat a MAC address; shows the OUI vendor prefix.">
      <Panel>
        <Field label="MAC address"><Input value={mac} onChange={setMac} /></Field>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Segmented value={sep} onChange={setSep} options={[{ value: ":", label: "AA:BB" }, { value: "-", label: "AA-BB" }, { value: ".", label: "AABB." }]} />
          <Toggle label="Uppercase" checked={upper} onChange={setUpper} />
        </div>
      </Panel>
      <Panel>{res.ok ? <><Output value={res.value} /><div className="mt-3"><Stat value={F.macVendorHint(mac) || "—"} label="OUI prefix" /></div></> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function Ipv6Tool() {
  const [addr, setAddr] = useState("2001:db8::1");
  const expanded = useMemo(() => F.expandIpv6(addr), [addr]);
  const compressed = useMemo(() => F.compressIpv6(addr), [addr]);
  return (
    <ToolShell title="IPv6 Expand / Compress" subtitle="Convert between the full and shortened forms of an IPv6 address.">
      <Panel><Field label="IPv6 address"><Input value={addr} onChange={setAddr} /></Field></Panel>
      <Panel>
        {expanded.ok ? <Output value={expanded.value} label="Expanded" /> : <ErrorNote message={expanded.error} />}
        {compressed.ok && <div className="mt-3"><Output value={compressed.value} label="Compressed" /></div>}
      </Panel>
    </ToolShell>
  );
}

function UrlParseTool() {
  const [url, setUrl] = useState("https://user@saleh.im:8443/forge/tools?tab=dev&sort=new#top");
  const res = useMemo(() => F.parseUrlParts(url), [url]);
  return (
    <ToolShell title="URL Parser" subtitle="Break a URL into protocol, host, port, path, query and hash.">
      <Panel><Field label="URL"><Input value={url} onChange={setUrl} /></Field></Panel>
      <Panel>
        {res.ok ? (
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
            {Object.entries(res.value).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[1fr_2fr] gap-2 border-b px-3 py-2 text-sm last:border-0" style={{ borderColor: "var(--line)" }}>
                <span className="label">{k}</span><span className="mono break-words text-[var(--fg-2)]">{v}</span>
              </div>
            ))}
          </div>
        ) : <ErrorNote message={res.error} />}
      </Panel>
    </ToolShell>
  );
}

function IpClassTool() {
  const [ip, setIp] = useState("172.16.5.24");
  const res = useMemo(() => F.ipClassInfo(ip), [ip]);
  return (
    <ToolShell title="IP Class & Scope" subtitle="Classify an IPv4 address and detect private, loopback or link-local scope.">
      <Panel><Field label="IPv4 address"><Input value={ip} onChange={setIp} /></Field></Panel>
      <Panel>
        {res.ok ? (
          <div className="grid grid-cols-2 gap-3">
            <Stat value={res.value.class} label="Class" /><Stat value={res.value.scope} label="Scope" /><Stat value={res.value.type} label="Type" />
            <div className="col-span-2 sm:col-span-1"><Output value={res.value.binary} label="Binary" /></div>
          </div>
        ) : <ErrorNote message={res.error} />}
      </Panel>
    </ToolShell>
  );
}

function PortsTool() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => F.COMMON_PORTS.filter((p) => !q || String(p.port).includes(q) || p.service.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <ToolShell title="Common Ports" subtitle="A reference of well-known TCP/UDP port numbers and their services.">
      <Panel><Field label="Search"><Input value={q} onChange={setQ} placeholder="port or service" /></Field></Panel>
      <Panel>
        <div className="thin-scroll max-h-[420px] overflow-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
          {rows.map((p) => (
            <div key={p.port} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b px-3 py-2 text-sm last:border-0" style={{ borderColor: "var(--line)" }}>
              <span className="mono font-semibold accent-text">{p.port}</span><span>{p.service}</span><span className="chip">{p.proto}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

function DnsTool() {
  return (
    <ToolShell title="DNS Record Types" subtitle="A quick reference to common DNS record types and their purpose.">
      <Panel>
        <div className="grid gap-2">
          {F.DNS_RECORDS.map((r) => (
            <div key={r.type} className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)" }}>
              <span className="mono font-semibold accent-text">{r.type}</span><span className="text-sm text-[var(--fg-2)]">{r.purpose}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * RANDOM
 * ================================================================== */
function CoinTool() {
  const [n, setN] = useState(10);
  const [res, setRes] = useState(() => F.coinFlip(10));
  return (
    <ToolShell title="Coin Flip" subtitle="Flip one or many coins and see the heads / tails tally.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3"><Field label="Flips"><NumInput value={n} onChange={setN} min={1} max={10000} /></Field><Btn accent onClick={() => setRes(F.coinFlip(n))}>Flip</Btn></div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-2 gap-3"><Stat value={res.heads} label="Heads" /><Stat value={res.tails} label="Tails" /></div>
        {res.results.length <= 200 && <div className="mt-3 break-words text-sm mono text-[var(--fg-2)]">{res.results.join(" ")}</div>}
      </Panel>
    </ToolShell>
  );
}

function RandStrTool() {
  const [len, setLen] = useState(24);
  const [upper, setUpper] = useState(true), [lower, setLower] = useState(true), [digits, setDigits] = useState(true), [symbols, setSymbols] = useState(false);
  const [out, setOut] = useState("");
  const gen = () => setOut(F.randomStringGen(len, { upper, lower, digits, symbols }));
  useEffect(() => { gen(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <ToolShell title="Random String" subtitle="Generate a cryptographically-random string from a chosen character set.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3"><Field label="Length"><NumInput value={len} onChange={setLen} min={1} max={4096} /></Field><Btn accent onClick={gen}>Generate</Btn></div>
        <div className="mt-3 flex flex-wrap gap-4"><Toggle label="A-Z" checked={upper} onChange={setUpper} /><Toggle label="a-z" checked={lower} onChange={setLower} /><Toggle label="0-9" checked={digits} onChange={setDigits} /><Toggle label="!@#" checked={symbols} onChange={setSymbols} /></div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function PickTool() {
  const [text, setText] = useState("Alice\nBob\nCharlie\nDana\nEli");
  const [pick, setPick] = useState("");
  const choose = () => { const items = text.split("\n").map((s) => s.trim()).filter(Boolean); setPick(F.randomPick(items)); };
  return (
    <ToolShell title="Random Picker" subtitle="Pick a random entry from a list — great for raffles and decisions.">
      <Panel>
        <Field label="Options (one per line)"><TextArea value={text} onChange={setText} rows={6} mono={false} /></Field>
        <div className="mt-3"><Btn accent onClick={choose}>🎯 Pick one</Btn></div>
      </Panel>
      <Panel><Stat value={pick || "—"} label="Winner" /></Panel>
    </ToolShell>
  );
}

function ShuffleTool() {
  const [text, setText] = useState("1\n2\n3\n4\n5\n6\n7");
  const [out, setOut] = useState("");
  const doShuffle = () => setOut(shuffleArray(text.split("\n").filter((l) => l.length)).join("\n"));
  return (
    <ToolShell title="Shuffle List" subtitle="Randomly reorder the lines of a list (Fisher–Yates).">
      <Panel>
        <Field label="List (one per line)"><TextArea value={text} onChange={setText} rows={6} /></Field>
        <div className="mt-3"><Btn accent onClick={doShuffle}>🔀 Shuffle</Btn></div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function GaussTool() {
  const [mean, setMean] = useState(0), [sd, setSd] = useState(1), [count, setCount] = useState(10);
  const [out, setOut] = useState<number[]>([]);
  const gen = () => setOut(Array.from({ length: Math.max(1, Math.min(1000, count)) }, () => F.gaussianRandom(mean, sd)));
  return (
    <ToolShell title="Gaussian Random" subtitle="Draw normally-distributed random numbers (Box–Muller transform).">
      <Panel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Mean"><NumInput value={mean} onChange={setMean} /></Field>
          <Field label="Std dev"><NumInput value={sd} onChange={setSd} /></Field>
          <Field label="Count"><NumInput value={count} onChange={setCount} min={1} max={1000} /></Field>
          <Btn accent onClick={gen}>Generate</Btn>
        </div>
      </Panel>
      <Panel><Output value={out.map((n) => fmt(n, 4)).join("\n")} /></Panel>
    </ToolShell>
  );
}

function LotteryTool() {
  const [count, setCount] = useState(6), [max, setMax] = useState(49);
  const [nums, setNums] = useState<number[]>(() => F.lotteryNumbers(6, 49));
  return (
    <ToolShell title="Lottery Numbers" subtitle="Draw a set of unique random numbers within a range.">
      <Panel>
        <div className="flex flex-wrap items-end gap-3"><Field label="How many"><NumInput value={count} onChange={setCount} min={1} max={max} /></Field><Field label="Max value"><NumInput value={max} onChange={setMax} min={1} /></Field><Btn accent onClick={() => setNums(F.lotteryNumbers(count, max))}>Draw</Btn></div>
      </Panel>
      <Panel>
        <div className="flex flex-wrap gap-2">{nums.map((n, i) => <span key={i} className="grid h-10 w-10 place-items-center rounded-full font-display text-lg" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{n}</span>)}</div>
      </Panel>
    </ToolShell>
  );
}

function RandDateTool() {
  const [start, setStart] = useState("2000-01-01"), [end, setEnd] = useState("2030-12-31");
  const [out, setOut] = useState("");
  const gen = () => { const r = F.randomDate(start, end); setOut(r.ok ? r.value : r.error); };
  return (
    <ToolShell title="Random Date" subtitle="Generate a random date/time between two bounds.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Start"><Input value={start} onChange={setStart} /></Field><Field label="End"><Input value={end} onChange={setEnd} /></Field></div>
        <div className="mt-3"><Btn accent onClick={gen}>Generate</Btn></div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

function TeamTool() {
  const [text, setText] = useState("Alice\nBob\nCharlie\nDana\nEli\nFrank\nGrace\nHeidi");
  const [teams, setTeams] = useState(2);
  const [out, setOut] = useState<string[][]>([]);
  const split = () => setOut(F.teamSplit(text.split("\n").map((s) => s.trim()).filter(Boolean), teams));
  return (
    <ToolShell title="Team Randomiser" subtitle="Fairly split a list of people into random balanced teams.">
      <Panel>
        <Field label="Names (one per line)"><TextArea value={text} onChange={setText} rows={6} mono={false} /></Field>
        <div className="mt-3 flex flex-wrap items-end gap-3"><Field label="Teams"><NumInput value={teams} onChange={setTeams} min={1} /></Field><Btn accent onClick={split}>Split</Btn></div>
      </Panel>
      {out.length > 0 && (
        <Panel>
          <div className="grid gap-3 sm:grid-cols-2">
            {out.map((team, i) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
                <p className="label mb-2">Team {i + 1}</p>
                <ul className="grid gap-1 text-sm">{team.map((m, j) => <li key={j}>{m}</li>)}</ul>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </ToolShell>
  );
}

/* ================================================================== *
 * TIME / DATE
 * ================================================================== */
function AgeTool() {
  const [birth, setBirth] = useState("1998-06-15");
  const res = useMemo(() => F.ageFrom(birth), [birth]);
  return (
    <ToolShell title="Age Calculator" subtitle="Work out an exact age plus totals in weeks, days and hours.">
      <Panel><Field label="Birth date"><Input value={birth} onChange={setBirth} /></Field></Panel>
      <Panel>
        {res.ok ? (
          <div className="grid grid-cols-3 gap-3">
            <Stat value={res.value.years} label="Years" /><Stat value={res.value.months} label="Months" /><Stat value={res.value.days} label="Days" />
            <Stat value={res.value.totalWeeks} label="Total weeks" /><Stat value={res.value.totalDays} label="Total days" /><Stat value={res.value.totalHours} label="Total hours" />
          </div>
        ) : <ErrorNote message={res.error} />}
      </Panel>
    </ToolShell>
  );
}

function WeekNumTool() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const res = useMemo(() => F.isoWeek(date), [date]);
  return (
    <ToolShell title="ISO Week Number" subtitle="Find the ISO-8601 week number and weekday for a date.">
      <Panel><Field label="Date"><Input value={date} onChange={setDate} /></Field></Panel>
      <Panel>{res.ok ? <div className="grid grid-cols-3 gap-3"><Stat value={res.value.week} label="Week" /><Stat value={res.value.year} label="ISO year" /><Stat value={res.value.day} label="Weekday (Mon=1)" /></div> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function BusDaysTool() {
  const [a, setA] = useState(new Date().toISOString().slice(0, 10)), [b, setB] = useState("2026-12-31");
  const res = useMemo(() => F.businessDays(a, b), [a, b]);
  return (
    <ToolShell title="Business Days" subtitle="Count total, business and weekend days between two dates (inclusive).">
      <Panel><div className="grid gap-3 sm:grid-cols-2"><Field label="From"><Input value={a} onChange={setA} /></Field><Field label="To"><Input value={b} onChange={setB} /></Field></div></Panel>
      <Panel>{res.ok ? <div className="grid grid-cols-3 gap-3"><Stat value={res.value.total} label="Total days" /><Stat value={res.value.business} label="Business days" /><Stat value={res.value.weekend} label="Weekend days" /></div> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function DateMathTool() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(30);
  const [unit, setUnit] = useState<"days" | "weeks" | "months" | "years" | "hours" | "minutes">("days");
  const res = useMemo(() => F.dateArithmetic(date, amount, unit), [date, amount, unit]);
  return (
    <ToolShell title="Date Add / Subtract" subtitle="Add or subtract a duration from a date (use a negative amount to go back).">
      <Panel>
        <Field label="Start date"><Input value={date} onChange={setDate} /></Field>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Amount"><NumInput value={amount} onChange={setAmount} /></Field>
          <select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} className="rounded-xl border bg-[var(--bg-3)] px-3 py-2 text-sm" style={{ borderColor: "var(--line-2)" }}>
            {["minutes", "hours", "days", "weeks", "months", "years"].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </Panel>
      <Panel>{res.ok ? <Output value={res.value} label="Result" /> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function DayOfWeekTool() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const res = useMemo(() => F.dayOfWeekInfo(date), [date]);
  return (
    <ToolShell title="Day of Week" subtitle="Find the weekday, day-of-year and whether it's a leap year.">
      <Panel><Field label="Date"><Input value={date} onChange={setDate} /></Field></Panel>
      <Panel>{res.ok ? <div className="grid grid-cols-3 gap-3"><Stat value={res.value.weekday} label="Weekday" /><Stat value={res.value.dayOfYear} label="Day of year" /><Stat value={res.value.leap ? "Yes" : "No"} label="Leap year?" /></div> : <ErrorNote message={res.error} />}</Panel>
    </ToolShell>
  );
}

function CountdownTool() {
  const [target, setTarget] = useState("2027-01-01T00:00");
  const [res, setRes] = useState(() => F.countdownTo("2027-01-01T00:00"));
  useEffect(() => {
    const tick = () => setRes(F.countdownTo(target));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return (
    <ToolShell title="Countdown" subtitle="A live countdown (or count-up) to any date and time.">
      <Panel><Field label="Target date/time"><Input value={target} onChange={setTarget} /></Field></Panel>
      <Panel>
        {res.ok ? (
          <>
            <div className="grid grid-cols-4 gap-3">
              <Stat value={res.value.days} label="Days" /><Stat value={res.value.hours} label="Hours" /><Stat value={res.value.minutes} label="Minutes" /><Stat value={res.value.seconds} label="Seconds" />
            </div>
            <p className="mt-3 text-center text-sm text-[var(--fg-2)]">{res.value.past ? "in the past" : "remaining"}</p>
          </>
        ) : <ErrorNote message={res.error} />}
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * REGISTRY
 * ================================================================== */
export const CATEGORIES2 = ["Math", "Color", "Text", "Encode", "Dev", "Convert", "Network", "Random", "Time"];

export const TOOLS2: ToolDef[] = [
  // Math
  { id: "calc", name: "Calculator", icon: "=", category: "Math", keywords: "math expression evaluate calculator equation compute", render: CalcTool },
  { id: "gcdlcm", name: "GCD & LCM", icon: "gcd", category: "Math", keywords: "gcd lcm greatest common divisor least multiple", render: GcdLcmTool },
  { id: "prime", name: "Prime & Factorise", icon: "℘", category: "Math", keywords: "prime factor factorisation number theory", render: PrimeTool },
  { id: "quadratic", name: "Quadratic Solver", icon: "x²", category: "Math", keywords: "quadratic equation roots solve discriminant", render: QuadraticTool },
  { id: "stats", name: "Statistics", icon: "σ", category: "Math", keywords: "statistics mean median mode stddev variance", render: StatsTool },
  { id: "fib", name: "Fibonacci", icon: "φ", category: "Math", keywords: "fibonacci sequence golden ratio series", render: FibTool },
  { id: "factorial", name: "Factorial", icon: "n!", category: "Math", keywords: "factorial bigint product", render: FactorialTool },
  { id: "combin", name: "Combinations", icon: "nCr", category: "Math", keywords: "combinations permutations ncr npr counting", render: CombinTool },
  { id: "numfmt", name: "Number Formatter", icon: "1,0", category: "Math", keywords: "number format thousands separator group digits", render: NumFmtTool },
  { id: "fraction", name: "Fraction Simplifier", icon: "½", category: "Math", keywords: "fraction simplify reduce lowest terms", render: FractionTool },
  { id: "dec2frac", name: "Decimal → Fraction", icon: "⅜", category: "Math", keywords: "decimal fraction convert ratio", render: Dec2FracTool },
  { id: "round", name: "Rounding", icon: "≈", category: "Math", keywords: "round floor ceil truncate decimals", render: RoundTool },
  { id: "triangle", name: "Triangle Solver", icon: "△", category: "Math", keywords: "right triangle pythagoras hypotenuse angle area", render: TriangleTool },
  { id: "modular", name: "Modular Arithmetic", icon: "mod", category: "Math", keywords: "modular exponent inverse mod power crypto", render: ModularTool },
  { id: "anybase", name: "Any-Base Converter", icon: "36", category: "Math", keywords: "base convert radix 2 36 binary hex", render: AnyBaseTool },
  { id: "series", name: "Number Series", icon: "Σ", category: "Math", keywords: "series arithmetic geometric sequence sum", render: SeriesTool },
  { id: "scinot", name: "Scientific Notation", icon: "e±", category: "Math", keywords: "scientific notation exponent standard form", render: SciNotTool },
  { id: "interest", name: "Compound Interest", icon: "%↑", category: "Math", keywords: "compound interest savings investment finance", render: InterestTool },
  { id: "loan", name: "Loan Payment", icon: "🏦", category: "Math", keywords: "loan mortgage payment amortisation finance", render: LoanTool },
  { id: "tip", name: "Tip & Split", icon: "🧾", category: "Math", keywords: "tip gratuity split bill restaurant", render: TipTool },
  { id: "discount", name: "Discount", icon: "🏷", category: "Math", keywords: "discount sale percent off price", render: DiscountTool },
  { id: "bmi", name: "BMI Calculator", icon: "⚖", category: "Math", keywords: "bmi body mass index health weight", render: BmiTool },
  // Color
  { id: "harmony", name: "Colour Harmonies", icon: "◔", category: "Color", keywords: "color harmony complementary triadic analogous palette scheme", render: HarmonyTool },
  { id: "palette", name: "Random Palette", icon: "🎨", category: "Color", keywords: "color palette random generator scheme swatch", render: PaletteTool },
  { id: "cmyk", name: "RGB → CMYK", icon: "◕", category: "Color", keywords: "cmyk print color convert rgb", render: CmykTool },
  { id: "coloradjust", name: "Colour Adjuster", icon: "◧", category: "Color", keywords: "color lighten darken saturate hue adjust", render: ColorAdjustTool },
  { id: "tints", name: "Tints & Shades", icon: "▤", category: "Color", keywords: "tint shade lightness scale color", render: TintsTool },
  { id: "namedcolor", name: "Nearest Colour", icon: "◑", category: "Color", keywords: "color name nearest css named closest", render: NamedColorTool },
  { id: "alpha", name: "Colour Alpha", icon: "◍", category: "Color", keywords: "alpha transparency rgba hex8 opacity color", render: AlphaTool },
  // Text
  { id: "dedupe", name: "Deduplicate Lines", icon: "≡", category: "Text", keywords: "dedupe duplicate lines unique remove", render: DedupeTool },
  { id: "occur", name: "Count Occurrences", icon: "#n", category: "Text", keywords: "count occurrences substring frequency find", render: OccurTool },
  { id: "reverseword", name: "Reverse Words", icon: "↤", category: "Text", keywords: "reverse words order text flip", render: ReverseWordsTool },
  { id: "sortwords", name: "Sort Words", icon: "↕w", category: "Text", keywords: "sort words alphabetical length order", render: SortWordsTool },
  { id: "accents", name: "Remove Accents", icon: "é", category: "Text", keywords: "accents diacritics normalize ascii strip", render: AccentsTool },
  { id: "extract", name: "Extract Patterns", icon: "⊹", category: "Text", keywords: "extract email url number ip hashtag mention regex", render: ExtractTool },
  { id: "nato", name: "NATO Phonetic", icon: "🅰", category: "Text", keywords: "nato phonetic alphabet spell alfa bravo", render: NatoTool },
  { id: "leet", name: "Leetspeak", icon: "1337", category: "Text", keywords: "leet 1337 speak text convert", render: LeetTool },
  { id: "rot47", name: "ROT47", icon: "47", category: "Text", keywords: "rot47 cipher rotate ascii", render: Rot47Tool },
  { id: "wrapcol", name: "Wrap Text", icon: "↵", category: "Text", keywords: "wrap text column width line break", render: WrapTool },
  { id: "padtext", name: "Pad & Align", icon: "⇥", category: "Text", keywords: "pad align width fixed leading zero", render: PadTool },
  { id: "truncate", name: "Truncate", icon: "…", category: "Text", keywords: "truncate shorten ellipsis clip text", render: TruncateTool },
  { id: "palindrome", name: "Palindrome", icon: "◈", category: "Text", keywords: "palindrome check reverse text", render: PalindromeTool },
  { id: "anagram", name: "Anagram", icon: "⇄a", category: "Text", keywords: "anagram check compare letters", render: AnagramTool },
  { id: "sheetcol", name: "Spreadsheet Column", icon: "A1", category: "Text", keywords: "spreadsheet column letter number excel a1", render: SpreadsheetColTool },
  { id: "fancytext", name: "Fancy Text", icon: "𝓕", category: "Text", keywords: "fancy unicode text bold italic script cool", render: FancyTextTool },
  { id: "removebreaks", name: "Remove Line Breaks", icon: "¬↵", category: "Text", keywords: "remove line breaks join newlines single", render: RemoveBreaksTool },
  // Encode
  { id: "punycode", name: "Punycode (IDN)", icon: "xn", category: "Encode", keywords: "punycode idn domain unicode ascii xn--", render: PunycodeTool },
  { id: "quotedprintable", name: "Quoted-Printable", icon: "=QP", category: "Encode", keywords: "quoted printable mime email encode", render: QuotedPrintableTool },
  { id: "xor", name: "XOR Cipher", icon: "⊕", category: "Encode", keywords: "xor cipher key encrypt hex", render: XorTool },
  { id: "vigenere", name: "Vigenère", icon: "🔐", category: "Encode", keywords: "vigenere cipher keyword polyalphabetic", render: VigenereTool },
  { id: "railfence", name: "Rail Fence", icon: "⋀⋁", category: "Encode", keywords: "rail fence transposition cipher zigzag", render: RailFenceTool },
  { id: "hmac", name: "HMAC", icon: "⊞", category: "Encode", keywords: "hmac keyed hash sha256 authentication", render: HmacTool },
  { id: "totp", name: "TOTP Generator", icon: "⏲", category: "Encode", keywords: "totp otp 2fa authenticator code base32", render: TotpTool },
  { id: "ascii85", name: "Ascii85", icon: "85", category: "Encode", keywords: "ascii85 base85 encode pdf postscript", render: Ascii85Tool },
  { id: "uuidinspect", name: "UUID Inspector", icon: "🆔", category: "Encode", keywords: "uuid inspect version variant validate timestamp", render: UuidInspectTool },
  { id: "texthex", name: "Text ⇄ Hex", icon: "0x", category: "Encode", keywords: "text hex bytes convert encode utf8", render: TextHexTool },
  { id: "unicodeescape", name: "Unicode Escape", icon: "\\u", category: "Encode", keywords: "unicode escape unescape uXXXX", render: UnicodeEscapeTool },
  // Dev
  { id: "semver", name: "Semantic Versioning", icon: "1.0", category: "Dev", keywords: "semver version compare bump major minor patch", render: SemverTool },
  { id: "jsonyaml", name: "JSON → YAML", icon: "Y↓", category: "Dev", keywords: "json yaml convert config", render: JsonYamlTool },
  { id: "yamljson", name: "YAML → JSON", icon: "↑J", category: "Dev", keywords: "yaml json parse convert config", render: YamlJsonTool },
  { id: "sqlformat", name: "SQL Formatter", icon: "⌘S", category: "Dev", keywords: "sql format beautify indent query", render: SqlFormatTool },
  { id: "cssmin", name: "CSS Minifier", icon: "{}↓", category: "Dev", keywords: "css minify compress whitespace", render: CssMinTool },
  { id: "htmlmin", name: "HTML Minifier", icon: "<>↓", category: "Dev", keywords: "html minify compress whitespace", render: HtmlMinTool },
  { id: "jsonxml", name: "JSON → XML", icon: "</>", category: "Dev", keywords: "json xml convert serialize", render: JsonXmlTool },
  { id: "jsondiff", name: "JSON Diff", icon: "±", category: "Dev", keywords: "json diff compare changes added removed", render: JsonDiffTool },
  { id: "flatten", name: "Flatten JSON", icon: "⤵", category: "Dev", keywords: "flatten json nested dot path keys", render: FlattenTool },
  { id: "escaperegex", name: "Escape Regex", icon: "\\.", category: "Dev", keywords: "escape regex regular expression literal", render: EscapeRegexTool },
  { id: "headers", name: "HTTP Headers", icon: "H:", category: "Dev", keywords: "http headers parse name value", render: HeadersTool },
  { id: "useragent", name: "User-Agent Parser", icon: "UA", category: "Dev", keywords: "user agent browser os device parse", render: UserAgentTool },
  { id: "mime", name: "MIME Types", icon: "📎", category: "Dev", keywords: "mime type extension lookup content", render: MimeTool },
  { id: "cronnext", name: "Cron Next Runs", icon: "⏰", category: "Dev", keywords: "cron schedule next runs times crontab", render: CronNextTool },
  { id: "querybuild", name: "Query Builder", icon: "?=", category: "Dev", keywords: "query string builder url params encode", render: QueryBuildTool },
  // Convert
  { id: "angle", name: "Angle", icon: "∠", category: "Convert", keywords: "angle degrees radians gradians convert", render: AngleTool },
  { id: "speed", name: "Speed", icon: "🏃", category: "Convert", keywords: "speed velocity kmh mph knots convert", render: SpeedTool },
  { id: "area", name: "Area", icon: "▦", category: "Convert", keywords: "area square meters acres hectares convert", render: AreaTool },
  { id: "volume", name: "Volume", icon: "🧊", category: "Convert", keywords: "volume litres gallons cups convert", render: VolumeTool },
  { id: "pressure", name: "Pressure", icon: "🎈", category: "Convert", keywords: "pressure bar psi pascal atmosphere convert", render: PressureTool },
  { id: "energy", name: "Energy", icon: "⚡", category: "Convert", keywords: "energy joules calories kwh btu convert", render: EnergyTool },
  { id: "power", name: "Power", icon: "🔌", category: "Convert", keywords: "power watts horsepower kilowatt convert", render: PowerTool },
  { id: "datarate", name: "Data Rate", icon: "📶", category: "Convert", keywords: "data rate bandwidth mbps bitrate convert", render: DataRateTool },
  { id: "typography", name: "Typography Units", icon: "pt", category: "Convert", keywords: "typography px pt pica point convert font", render: TypographyTool },
  { id: "cooking", name: "Cooking Measures", icon: "🥄", category: "Convert", keywords: "cooking cups tablespoons teaspoons convert recipe", render: CookingTool },
  { id: "frequency", name: "Frequency ⇄ λ", icon: "〜", category: "Convert", keywords: "frequency wavelength hertz light convert", render: FrequencyTool },
  // Network
  { id: "mac", name: "MAC Address", icon: "🔗", category: "Network", keywords: "mac address format oui vendor network", render: MacTool },
  { id: "ipv6", name: "IPv6 Tools", icon: "::", category: "Network", keywords: "ipv6 expand compress address network", render: Ipv6Tool },
  { id: "urlparse", name: "URL Parser", icon: "🌐", category: "Network", keywords: "url parse components host path query", render: UrlParseTool },
  { id: "ipclass", name: "IP Class", icon: "🖧", category: "Network", keywords: "ip class private public scope binary", render: IpClassTool },
  { id: "ports", name: "Common Ports", icon: ":80", category: "Network", keywords: "ports tcp udp services reference well known", render: PortsTool },
  { id: "dns", name: "DNS Records", icon: "@", category: "Network", keywords: "dns records types reference a mx txt cname", render: DnsTool },
  // Random
  { id: "coin", name: "Coin Flip", icon: "🪙", category: "Random", keywords: "coin flip heads tails random probability", render: CoinTool },
  { id: "randstr", name: "Random String", icon: "☷", category: "Random", keywords: "random string generate charset secure", render: RandStrTool },
  { id: "pick", name: "Random Picker", icon: "🎯", category: "Random", keywords: "random pick choose winner raffle decision", render: PickTool },
  { id: "shuffle", name: "Shuffle List", icon: "🔀", category: "Random", keywords: "shuffle list randomize order fisher yates", render: ShuffleTool },
  { id: "gauss", name: "Gaussian Random", icon: "∿", category: "Random", keywords: "gaussian normal random distribution box muller", render: GaussTool },
  { id: "lottery", name: "Lottery Numbers", icon: "🎰", category: "Random", keywords: "lottery numbers draw unique random", render: LotteryTool },
  { id: "randdate", name: "Random Date", icon: "📅", category: "Random", keywords: "random date time between range generate", render: RandDateTool },
  { id: "teamsplit", name: "Team Randomiser", icon: "👥", category: "Random", keywords: "team split random groups balance people", render: TeamTool },
  // Time
  { id: "age", name: "Age Calculator", icon: "🎂", category: "Time", keywords: "age calculator birthday years months days", render: AgeTool },
  { id: "weeknum", name: "ISO Week Number", icon: "W#", category: "Time", keywords: "iso week number date year weekday", render: WeekNumTool },
  { id: "busdays", name: "Business Days", icon: "💼", category: "Time", keywords: "business days working weekend between dates", render: BusDaysTool },
  { id: "datemath", name: "Date Add / Subtract", icon: "＋⏱", category: "Time", keywords: "date add subtract math duration offset", render: DateMathTool },
  { id: "dayofweek", name: "Day of Week", icon: "📆", category: "Time", keywords: "day of week weekday leap year day of year", render: DayOfWeekTool },
  { id: "countdown", name: "Countdown", icon: "⏳", category: "Time", keywords: "countdown timer remaining target date live", render: CountdownTool },
];
