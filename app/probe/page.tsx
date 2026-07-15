"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";
import {
  resolveGeo,
  resolveTls,
  type GeoData,
  type ProviderResult,
  type TlsFingerprint,
} from "@/lib/probe/ip";
import {
  detectKeyboard,
  collectDevice,
  deviceHash,
  profileCpu,
  classifyConnection,
  resolveJurisdiction,
  groupHash,
  ccName,
  ccFlag,
  TZ_TO_CC,
  type KeyboardInfo,
  type DeviceSignals,
  type CpuProfile,
  type ConnectionVerdict,
  type JurisdictionResult,
} from "@/lib/probe/analyze";
import { collectCapabilities, type Capabilities } from "@/lib/probe/capabilities";
import { deriveFindings, connectionQuality, type Finding } from "@/lib/probe/insights";

/* ============================================================================
   Probe — a real connection & privacy inspector. Every check runs live in the
   browser using genuine Web APIs: multi-provider IP/geo, WebRTC candidate
   gathering, TLS (JA3/JA4) reflection, Network Information, latency probes,
   canvas/WebGL/audio/font fingerprinting, keyboard layout, device + CPU
   hashing, and an inference layer that estimates the visitor's true
   jurisdiction and whether the path looks masked.

   The signals feeding those two conclusions — and their weights — are kept out
   of the interface on purpose. Nothing is stored or transmitted.
   ========================================================================== */

type Cand = { ip: string; type: string; mdns: boolean };
type Ping = { host: string; label: string; ms: number | null; hist: number[] };
type Tab = "intel" | "network" | "capabilities" | "fingerprint" | "performance" | "permissions";

export default function ProbePage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";

  const [tab, setTab] = useState<Tab>("intel");
  const [tick, setTick] = useState(0);

  // ---- resolved intelligence ----
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [trail, setTrail] = useState<ProviderResult[]>([]);
  const [tls, setTls] = useState<TlsFingerprint | null>(null);
  const [tlsPending, setTlsPending] = useState(true);
  const [keyboard, setKeyboard] = useState<KeyboardInfo | null>(null);
  const [device, setDevice] = useState<DeviceSignals | null>(null);
  const [devHash, setDevHash] = useState<string>("");
  const [cpu, setCpu] = useState<CpuProfile | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);

  // ---- live probes ----
  const [cands, setCands] = useState<Cand[]>([]);
  const [gathering, setGathering] = useState(true);
  const [net, setNet] = useState<{ type?: string; downlink?: number; rtt?: number; save?: boolean } | null>(null);
  const [pings, setPings] = useState<Ping[]>([
    { host: "https://www.cloudflare.com/favicon.ico", label: "Cloudflare", ms: null, hist: [] },
    { host: "https://www.google.com/favicon.ico", label: "Google", ms: null, hist: [] },
    { host: "https://github.githubassets.com/favicons/favicon.svg", label: "GitHub", ms: null, hist: [] },
    { host: "https://cdn.jsdelivr.net/favicon.ico", label: "jsDelivr", ms: null, hist: [] },
  ]);
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [devices, setDevices] = useState<{ cam: number; mic: number; spk: number }>({ cam: 0, mic: 0, spk: 0 });
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [speed, setSpeed] = useState<{ mbps: number | null; running: boolean }>({ mbps: null, running: false });
  const [gps, setGps] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  /* ---- device + keyboard + cpu (once) ---- */
  useEffect(() => {
    let alive = true;
    const d = collectDevice();
    if (!alive) return;
    setDevice(d);
    deviceHash(d).then((h) => alive && setDevHash(h));
    profileCpu(d).then((c) => alive && setCpu(c));
    detectKeyboard().then((k) => alive && setKeyboard(k));
    return () => {
      alive = false;
    };
  }, []);

  /* ---- capability & hardware surface ---- */
  useEffect(() => {
    let alive = true;
    collectCapabilities().then((c) => alive && setCaps(c)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  /* ---- multi-provider IP/geo ---- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const { geo: g, trail: tr } = await resolveGeo();
      if (!alive) return;
      setGeo(g);
      setTrail(tr);
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  /* ---- TLS (JA3/JA4) reflection ---- */
  useEffect(() => {
    let alive = true;
    setTlsPending(true);
    resolveTls()
      .then((t) => {
        if (alive) {
          setTls(t);
          setTlsPending(false);
        }
      })
      .catch(() => alive && setTlsPending(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  /* ---- WebRTC candidates ---- */
  const gather = useCallback(() => {
    setCands([]);
    setGathering(true);
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;
      pc.createDataChannel("probe");
      const seen = new Set<string>();
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          setGathering(false);
          pc.close();
          return;
        }
        const c = e.candidate.candidate;
        const m = c.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3})|([a-fA-F0-9]{0,4}(?::[a-fA-F0-9]{0,4}){2,7})|([0-9a-f-]+\.local)/);
        const raw = m?.[0];
        if (!raw) return;
        const type = c.includes("typ host") ? "host" : c.includes("typ srflx") ? "srflx" : c.includes("typ relay") ? "relay" : "?";
        const key = raw + type;
        if (seen.has(key)) return;
        seen.add(key);
        setCands((p) => [...p, { ip: raw, type, mdns: raw.endsWith(".local") }]);
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => setGathering(false));
      setTimeout(() => {
        setGathering(false);
        try {
          pc.close();
        } catch {}
      }, 4000);
    } catch {
      setGathering(false);
    }
  }, []);
  useEffect(() => {
    gather();
    return () => {
      try {
        pcRef.current?.close();
      } catch {}
    };
  }, [gather, tick]);

  /* ---- Network Information ---- */
  useEffect(() => {
    const c = (navigator as any).connection;
    if (c) {
      const read = () => setNet({ type: c.effectiveType, downlink: c.downlink, rtt: c.rtt, save: c.saveData });
      read();
      c.addEventListener?.("change", read);
      return () => c.removeEventListener?.("change", read);
    }
  }, []);

  /* ---- latency probes ---- */
  const runPings = useCallback(async () => {
    const measure = async (url: string) => {
      let best = Infinity;
      for (let i = 0; i < 2; i++) {
        const t = performance.now();
        try {
          await fetch(url + "?_=" + Math.random(), { mode: "no-cors", cache: "no-store" });
          best = Math.min(best, performance.now() - t);
        } catch {}
      }
      return best === Infinity ? null : Math.round(best);
    };
    const results = await Promise.all(pings.map((p) => measure(p.host)));
    setPings((prev) => prev.map((p, i) => ({ ...p, ms: results[i], hist: [...p.hist, results[i] ?? 0].slice(-20) })));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    runPings();
    const id = setInterval(runPings, 5000);
    return () => clearInterval(id);
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- permissions + media + storage + battery ---- */
  useEffect(() => {
    const names = ["geolocation", "camera", "microphone", "notifications", "clipboard-read", "persistent-storage"];
    (async () => {
      const p: Record<string, string> = {};
      for (const name of names) {
        try {
          const r = await (navigator.permissions as any).query({ name });
          p[name] = r.state;
        } catch {
          p[name] = "n/a";
        }
      }
      setPerms(p);
    })();
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((list) => {
        setDevices({
          cam: list.filter((d) => d.kind === "videoinput").length,
          mic: list.filter((d) => d.kind === "audioinput").length,
          spk: list.filter((d) => d.kind === "audiooutput").length,
        });
      })
      .catch(() => {});
    (navigator as any).storage?.estimate?.().then((e: any) => setStorage({ usage: e.usage || 0, quota: e.quota || 0 })).catch(() => {});
    (navigator as any).getBattery?.()
      .then((b: any) => {
        const read = () => setBattery({ level: b.level, charging: b.charging });
        read();
        b.addEventListener("levelchange", read);
        b.addEventListener("chargingchange", read);
      })
      .catch(() => {});
  }, [tick]);

  const runSpeed = async () => {
    setSpeed({ mbps: null, running: true });
    try {
      const bytes = 5_000_000;
      const t = performance.now();
      const r = await fetch(`https://speed.cloudflare.com/__down?bytes=${bytes}`, { cache: "no-store" });
      await r.arrayBuffer();
      const secs = (performance.now() - t) / 1000;
      setSpeed({ mbps: (bytes * 8) / secs / 1e6, running: false });
    } catch {
      setSpeed({ mbps: null, running: false });
    }
  };

  const askGeo = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setGps({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  /* ---- derived intelligence (methodology intentionally not surfaced) ---- */
  const publicLeak = cands.some((c) => c.type === "srflx");
  const localLeak = cands.some((c) => c.type === "host" && !c.mdns);

  const tzCc = device?.tz ? TZ_TO_CC[device.tz] : undefined;
  const tzMismatch = !!(tzCc && geo?.cc && tzCc.toUpperCase() !== geo.cc.toUpperCase());
  const srflxIp = cands.find((c) => c.type === "srflx")?.ip;
  const webrtcMismatch = !!(srflxIp && geo?.ip && srflxIp !== geo.ip);

  const jurisdiction: JurisdictionResult = useMemo(
    () =>
      resolveJurisdiction({
        ipCc: geo?.cc,
        tz: device?.tz,
        languages: device?.languages,
        localeRegion: device?.localeRegion,
        keyboardRegion: keyboard?.region,
      }),
    [geo?.cc, device?.tz, device?.languages, device?.localeRegion, keyboard?.region]
  );

  const connection: ConnectionVerdict = useMemo(
    () => classifyConnection(geo || {}, tzMismatch, webrtcMismatch),
    [geo, tzMismatch, webrtcMismatch]
  );

  const findings: Finding[] = useMemo(
    () =>
      deriveFindings({
        localLeak,
        publicLeak,
        masking: connection.masking,
        connectionKind: connection.kind,
        geoCc: geo?.cc,
        trueCc: jurisdiction.cc,
        jurisdictionConfidence: jurisdiction.confidence,
        geolocationGranted: perms.geolocation === "granted",
        uniqueness: caps?.uniqueness ?? 0,
        timeSkewMs: caps?.timeSkewMs ?? null,
        httpProtocol: caps?.httpProtocol ?? "",
        secureContext: typeof window !== "undefined" ? window.isSecureContext : null,
        gpc: typeof navigator !== "undefined" && !!(navigator as any).globalPrivacyControl,
        dnt: typeof navigator !== "undefined" && ((navigator as any).doNotTrack === "1" || (navigator as any).doNotTrack === "yes"),
        camerasMics: devices.cam + devices.mic,
      }),
    [localLeak, publicLeak, connection, geo?.cc, jurisdiction, perms.geolocation, caps, devices]
  );

  const quality = useMemo(() => connectionQuality(pings.map((p) => p.hist)), [pings]);

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      note: "Generated locally by saleh.im/probe. Nothing was transmitted.",
      network: { ip: geo?.ip, geo, providerTrail: trail, webrtc: cands, latency: pings.map((p) => ({ label: p.label, ms: p.ms })), quality, httpProtocol: caps?.httpProtocol, clockSkewMs: caps?.timeSkewMs },
      intelligence: { estimatedCountry: jurisdiction.cc, confidence: jurisdiction.confidence, connection: connection.kind, maskingLikelihood: connection.masking, findings: findings.map((f) => ({ severity: f.severity, title: f.title })) },
      tls: tls,
      keyboard,
      device: device ? { ...device, canvasHash: device.canvasHash } : null,
      deviceHash: devHash,
      cpu,
      capabilities: caps ? { supported: caps.supportedCount, total: caps.totalCount, uniqueness: caps.uniqueness, refreshHz: caps.refreshHz, groups: caps.groups } : null,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `probe-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const score = Math.max(
    0,
    100 -
      (localLeak ? 30 : 0) -
      (publicLeak ? 8 : 0) -
      (perms.geolocation === "granted" ? 8 : 0) -
      Math.round(connection.masking * 0.2)
  );
  const scoreColor = score >= 80 ? "#22c55e" : score >= 55 ? "#eab308" : "#ef4444";

  const mb = (n: number) => (n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
  const jsHeap = (performance as any).memory
    ? `${mb((performance as any).memory.usedJSHeapSize)} / ${mb((performance as any).memory.jsHeapSizeLimit)}`
    : "—";
  const num = (n: number) => (fa ? n.toLocaleString("fa-IR") : String(n));

  /* ---- localisation ---- */
  const T = fa
    ? {
        title: "Probe",
        sub: "بازرسِ اتصال و ردپای دیجیتال",
        scan: "اسکن دوباره",
        exportReport: "خروجیِ گزارش",
        scoreL: "امتیاز حریم خصوصی",
        tabs: { intel: "برآورد", network: "شبکه", capabilities: "قابلیت‌ها", fingerprint: "ردپا", performance: "کارایی", permissions: "دسترسی‌ها" },
        capsTitle: "سطحِ قابلیت‌ها",
        supported: "پشتیبانی‌شده",
        uniqueness: "میزانِ یکتایی",
        uniqueNote: "هرچه ترکیبِ قابلیت‌ها نادرتر باشد، مرورگرِ شما شناسایی‌پذیرتر است.",
        httpProto: "پروتکلِ HTTP",
        timeSkew: "اختلافِ ساعت",
        refresh: "نرخِ نوسازی",
        gpuAdapter: "آداپتورِ GPU",
        capsLoading: "در حالِ بررسیِ قابلیت‌ها…",
        exposure: "افشا و ریسک",
        quality: "کیفیتِ اتصال",
        jitter: "جیتر",
        loss: "افت",
        avgLat: "میانگین",
        trueLoc: "موقعیت واقعیِ برآوردشده",
        confidence: "قطعیت",
        pathStatus: "وضعیتِ مسیر",
        masking: "احتمالِ پنهان‌سازی",
        residential: "خطِ خانگی",
        datacenter: "زیرساختِ میزبانی",
        mobile: "شبکهٔ همراه",
        unknownK: "نامشخص",
        clean: "مسیر تمیز به‌نظر می‌رسد",
        maskedLikely: "نشانه‌هایی از مسیرِ پنهان‌شده",
        maskedStrong: "به‌احتمال زیاد مسیر پنهان شده",
        deviceHash: "شناسهٔ دستگاه",
        cpuHash: "شناسهٔ پردازنده",
        cpuBench: "سنجهٔ محاسبات",
        keyboardL: "چیدمانِ صفحه‌کلید",
        tlsFp: "اثرِ TLS",
        tlsNa: "در دسترس نیست",
        conn: "اتصالِ شما",
        ip: "آی‌پی عمومی",
        loc: "موقعیتِ آی‌پی",
        isp: "ارائه‌دهنده",
        org: "سازمان",
        asn: "ASN",
        tz: "منطقهٔ زمانی",
        src: "منبعِ پاسخ‌دهنده",
        providers: "سرویس‌های پرسیده‌شده",
        netTitle: "شبکه",
        type: "نوعِ اتصال",
        down: "پهنای باند",
        rtt: "تأخیرِ تخمینی",
        save: "کم‌مصرف",
        na: "در دسترس نیست (کرومیوم)",
        webrtc: "کاندیداهای WebRTC",
        gathering: "در حالِ جمع‌آوری…",
        host: "محلی",
        mdns: "محافظت‌شده",
        none: "کاندیدایی نیست",
        latency: "تأخیر تا سرورها",
        latOverTime: "روندِ تأخیر",
        device: "دستگاه و مرورگر",
        note: "همهٔ بررسی‌ها زنده و کاملاً درونِ مرورگرِ شماست — هیچ‌چیز ذخیره یا ارسال نمی‌شود.",
        leakY: "آی‌پیِ محلی افشا شد",
        leakN: "نشتی محلی نیست",
        canvas: "کانواس",
        webglV: "سازندهٔ GPU",
        webglR: "رندرِ GPU",
        audio: "صوت",
        fonts: "فونت‌ها",
        combined: "اثرِ ترکیبی",
        fpNote: "این مقادیر یکتا هستند و می‌توانند مرورگرِ شما را بدونِ کوکی بازشناسند.",
        speed: "تستِ سرعتِ دانلود",
        runSpeed: "اجرای تست",
        mbps: "مگابیت/ثانیه",
        mem: "حافظهٔ JS",
        perms: "دسترسی‌ها",
        mediaDev: "دستگاه‌های رسانه",
        cam: "دوربین",
        mic: "میکروفون",
        spk: "بلندگو",
        storageL: "فضای ذخیره",
        used: "مصرف",
        quota: "سهمیه",
        batteryL: "باتری",
        geoBtn: "درخواستِ موقعیتِ دقیق",
        geoAcc: "دقت",
        precise: "موقعیتِ دقیق (GPS)",
        coords: "مختصات",
        analyzing: "در حالِ تحلیل…",
      }
    : {
        title: "Probe",
        sub: "Connection & digital-trail inspector",
        scan: "Re-scan",
        exportReport: "Export report",
        scoreL: "Privacy score",
        tabs: { intel: "Assessment", network: "Network", capabilities: "Capabilities", fingerprint: "Trail", performance: "Performance", permissions: "Permissions" },
        capsTitle: "Capability surface",
        supported: "supported",
        uniqueness: "Uniqueness",
        uniqueNote: "The rarer your mix of capabilities, the more identifiable your browser is.",
        httpProto: "HTTP protocol",
        timeSkew: "Clock skew",
        refresh: "Refresh rate",
        gpuAdapter: "GPU adapter",
        capsLoading: "probing capabilities…",
        exposure: "Exposure & risk",
        quality: "Connection quality",
        jitter: "Jitter",
        loss: "Loss",
        avgLat: "Average",
        trueLoc: "Estimated true location",
        confidence: "confidence",
        pathStatus: "Path status",
        masking: "Masking likelihood",
        residential: "Residential line",
        datacenter: "Hosting infrastructure",
        mobile: "Mobile carrier",
        unknownK: "Unknown",
        clean: "Path appears clean",
        maskedLikely: "Signs of a masked path",
        maskedStrong: "Path very likely masked",
        deviceHash: "Device ID",
        cpuHash: "CPU ID",
        cpuBench: "Compute benchmark",
        keyboardL: "Keyboard layout",
        tlsFp: "TLS fingerprint",
        tlsNa: "unavailable",
        conn: "Your connection",
        ip: "Public IP",
        loc: "IP location",
        isp: "ISP",
        org: "Organization",
        asn: "ASN",
        tz: "Timezone",
        src: "Answering source",
        providers: "Providers consulted",
        netTitle: "Network",
        type: "Connection type",
        down: "Downlink",
        rtt: "Estimated RTT",
        save: "Data saver",
        na: "Not available (Chromium)",
        webrtc: "WebRTC candidates",
        gathering: "gathering…",
        host: "local",
        mdns: "protected",
        none: "No candidates",
        latency: "Latency to endpoints",
        latOverTime: "Latency trend",
        device: "Device & browser",
        note: "Every check runs live, entirely in your browser — nothing is stored or sent.",
        leakY: "Local IP exposed",
        leakN: "No local leak",
        canvas: "Canvas",
        webglV: "GPU vendor",
        webglR: "GPU renderer",
        audio: "Audio",
        fonts: "Fonts",
        combined: "Combined ID",
        fpNote: "These values are unique and can re-identify your browser without cookies.",
        speed: "Download speed test",
        runSpeed: "Run test",
        mbps: "Mbps",
        mem: "JS heap",
        perms: "Permissions",
        mediaDev: "Media devices",
        cam: "Cameras",
        mic: "Microphones",
        spk: "Speakers",
        storageL: "Storage",
        used: "Used",
        quota: "Quota",
        batteryL: "Battery",
        geoBtn: "Request precise location",
        geoAcc: "accuracy",
        precise: "Precise location (GPS)",
        coords: "Coordinates",
        analyzing: "analyzing…",
      };

  const maskLabel =
    connection.masking >= 65 ? T.maskedStrong : connection.masking >= 35 ? T.maskedLikely : T.clean;
  const maskColor = connection.masking >= 65 ? "#ef4444" : connection.masking >= 35 ? "#eab308" : "#22c55e";
  const kindLabel =
    connection.kind === "residential"
      ? T.residential
      : connection.kind === "datacenter"
      ? T.datacenter
      : connection.kind === "mobile"
      ? T.mobile
      : T.unknownK;

  const trueCc = jurisdiction.cc;
  const ipFlag = ccFlag(geo?.cc);

  const MiniLine = ({ data }: { data: number[] }) => {
    if (data.length < 2) return <span className="mono text-xs text-[var(--fg-2)]">…</span>;
    const max = Math.max(...data, 1),
      min = Math.min(...data);
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${20 - ((v - min) / (max - min || 1)) * 18 - 1}`).join(" ");
    return (
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="h-5 w-20">
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div className="min-h-[100dvh]">
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6"
        style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">
            ← saleh.im
          </Link>
          <span className="hidden items-center gap-2.5 sm:flex">
            <Logo size={28} />
            <span className="font-display text-lg">{T.title}</span>
            <span className="text-xs text-[var(--fg-2)]">{T.sub}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTick((t) => t + 1)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line-2)" }}>
            ↻ {T.scan}
          </button>
          <button onClick={exportReport} title={T.exportReport} className="hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs sm:flex" style={{ borderColor: "var(--line-2)" }}>
            ↓ {T.exportReport}
          </button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>
            ◑
          </button>
          <LangToggle />
        </div>
      </header>

      <main className="wrap py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl">{T.title}</h1>
          <div className="flex items-center gap-3 rounded-full border px-4 py-2" style={{ borderColor: "var(--line-2)" }}>
            <span className="label">{T.scoreL}</span>
            <span className="font-display text-2xl" style={{ color: scoreColor }}>
              {num(score)}
            </span>
            <span className="h-8 w-px" style={{ background: "var(--line)" }} />
            <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-3)" strokeWidth="4" />
              <circle cx="18" cy="18" r="15" fill="none" stroke={scoreColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(score / 100) * 2 * Math.PI * 15} 999`} />
            </svg>
          </div>
        </div>

        {/* tabs */}
        <div className="mb-5 flex flex-wrap gap-1 border-b" style={{ borderColor: "var(--line)" }}>
          {(Object.keys(T.tabs) as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} className="relative px-4 py-2.5 text-sm transition-colors" style={{ color: tab === tb ? "var(--fg)" : "var(--fg-2)" }}>
              {T.tabs[tb]}
              {tab === tb && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: "var(--accent)" }} />}
            </button>
          ))}
        </div>

        <div key={tab} className="tab-anim">
        {/* ============================= INTEL ============================= */}
        {tab === "intel" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Estimated true location */}
            <div className="panel elev relative overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-8 -top-8 text-[120px] opacity-[0.06]">{trueCc ? ccFlag(trueCc) : "🌐"}</div>
              <p className="label mb-4">{T.trueLoc}</p>
              {trueCc ? (
                <>
                  <div className="flex items-center gap-4">
                    <span className="shrink-0 text-5xl leading-none">{ccFlag(trueCc)}</span>
                    <div className="min-w-0">
                      <p className="font-display text-2xl leading-tight break-words sm:text-3xl">{ccName(trueCc, fa)}</p>
                      <p className="mono text-xs text-[var(--fg-2)]">{trueCc}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="label">{T.confidence}</span>
                      <span className="mono text-sm" style={{ color: "var(--accent)" }}>
                        {num(jurisdiction.confidence)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                      <div className="h-full rounded-full" style={{ width: `${jurisdiction.confidence}%`, background: "var(--accent)", transition: "width .6s ease" }} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--fg-2)]">{T.analyzing}</p>
              )}
            </div>

            {/* Path status */}
            <div className="panel elev p-6">
              <p className="label mb-4">{T.pathStatus}</p>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg" style={{ background: `color-mix(in srgb, ${maskColor} 16%, transparent)`, color: maskColor }}>
                  {connection.masking >= 65 ? "⚠" : connection.masking >= 35 ? "◐" : "✓"}
                </span>
                <div>
                  <p className="font-display text-lg" style={{ color: maskColor }}>
                    {maskLabel}
                  </p>
                  <p className="text-xs text-[var(--fg-2)]">{kindLabel}</p>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-1 flex items-center justify-between">
                  <span className="label">{T.masking}</span>
                  <span className="mono text-sm" style={{ color: maskColor }}>
                    {num(connection.masking)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                  <div className="h-full rounded-full" style={{ width: `${connection.masking}%`, background: maskColor, transition: "width .6s ease" }} />
                </div>
              </div>
            </div>

            {/* Hashes */}
            <div className="panel elev p-5">
              <p className="label mb-4">{T.deviceHash}</p>
              <p className="font-display text-xl force-ltr break-all sm:text-2xl" style={{ color: "var(--accent)", letterSpacing: "0.05em" }}>
                {devHash ? groupHash(devHash, 4, 4) : "…"}
              </p>
              <div className="mt-4 grid gap-3">
                <Field label={T.cpuHash} value={cpu?.hash} mono />
                <Field label={T.cpuBench} value={cpu ? `${cpu.benchMs} ms · tier ${cpu.bucket} · ${cpu.cores}× ${cpu.arch}` : undefined} mono />
              </div>
            </div>

            {/* TLS + keyboard */}
            <div className="panel elev p-5">
              <p className="label mb-4">{T.tlsFp}</p>
              {tlsPending ? (
                <p className="text-sm text-[var(--fg-2)]">{T.analyzing}</p>
              ) : tls ? (
                <div className="grid gap-3">
                  <Field label="JA4" value={tls.ja4 || tls.ja4Hash} mono />
                  <Field label="JA3" value={tls.ja3Hash || tls.ja3} mono />
                  <Field label={T.src} value={tls.source} mono />
                </div>
              ) : (
                <p className="text-sm text-[var(--fg-2)]">{T.tlsFp}: {T.tlsNa}</p>
              )}
              <div className="mt-4 grid gap-3">
                <Field
                  label={T.keyboardL}
                  value={keyboard ? (keyboard.supported ? `${keyboard.layout}${keyboard.region ? " · " + keyboard.region : ""}` : keyboard.layout) : undefined}
                  mono
                />
              </div>
            </div>

            {/* Connection summary */}
            <div className="panel elev p-5 lg:col-span-2">
              <p className="label mb-4">{T.conn}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={T.ip} value={geo?.ip} big />
                <Field label={T.loc} value={geo ? `${ipFlag} ${[geo.city, geo.country].filter(Boolean).join(", ")}` : undefined} />
                <Field label={T.tz} value={geo?.tz || device?.tz} />
                <Field label={T.isp} value={geo?.isp} />
                <Field label={T.asn} value={geo?.asn} />
                <Field label={T.src} value={geo?.source} />
              </div>
            </div>

            {/* Exposure & risk findings */}
            <div className="panel elev p-5 lg:col-span-2">
              <p className="label mb-4">{T.exposure}</p>
              {findings.length === 0 ? (
                <p className="text-sm text-[var(--fg-2)]">{T.analyzing}</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {findings.map((f, i) => {
                    const col = f.severity === "high" ? "#ef4444" : f.severity === "medium" ? "#f97316" : f.severity === "low" ? "#eab308" : "#22c55e";
                    return (
                      <div
                        key={f.id}
                        className="flex gap-3 rounded-xl border p-3"
                        style={{ borderColor: "var(--line)", background: "var(--bg-3)", animation: "popIn .45s cubic-bezier(.22,1,.36,1) both", animationDelay: `${i * 40}ms` }}
                      >
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: col, boxShadow: `0 0 10px ${col}` }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{fa ? f.faTitle : f.title}</p>
                          <p className="mt-0.5 text-xs text-[var(--fg-2)]">{fa ? f.faDetail : f.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================ NETWORK =========================== */}
        {tab === "network" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="panel elev p-5 lg:col-span-2">
              <p className="label mb-4">{T.conn}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={T.ip} value={geo?.ip} big />
                <Field label={T.loc} value={geo ? `${ipFlag} ${[geo.city, geo.country].filter(Boolean).join(", ")}` : undefined} />
                <Field label={T.isp} value={geo?.isp} />
                <Field label={T.org} value={geo?.org} />
                <Field label={T.asn} value={geo?.asn} />
                <Field label={T.tz} value={geo?.tz} />
              </div>
            </div>
            <div className="panel elev p-5">
              <p className="label mb-4">{T.netTitle}</p>
              <div className="grid gap-3">
                <Field label={T.httpProto} value={caps?.httpProtocol} mono />
                {net && <Field label={T.type} value={net.type?.toUpperCase()} />}
                {net && <Field label={T.down} value={net.downlink ? `${net.downlink} Mbps` : "—"} />}
                {net && <Field label={T.rtt} value={net.rtt != null ? `${net.rtt} ms` : "—"} />}
                <Field label={T.timeSkew} value={caps?.timeSkewMs == null ? undefined : `${caps.timeSkewMs > 0 ? "+" : ""}${(caps.timeSkewMs / 1000).toFixed(1)}s`} mono />
                {net && <Field label={T.save} value={net.save ? "on" : "off"} />}
              </div>
              {!net && <p className="mt-3 text-xs text-[var(--fg-2)]">{T.na}</p>}
            </div>

            {/* provider trail */}
            <div className="panel elev p-5 lg:col-span-3">
              <p className="label mb-4">{T.providers}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {trail.length === 0 && <p className="text-sm text-[var(--fg-2)]">{T.gathering}</p>}
                {trail.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                    <span className="force-ltr">{p.id}</span>
                    <span className="flex items-center gap-2">
                      <span className="mono text-xs text-[var(--fg-2)]">{num(p.ms)}ms</span>
                      <span className="mono rounded-md px-1.5 py-0.5 text-xs" style={{ background: "var(--bg-3)", color: p.ok ? "#22c55e" : "#ef4444" }}>
                        {p.ok ? "✓" : "✕"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* connection quality */}
            <div className="panel elev relative overflow-hidden p-5 lg:col-span-3">
              <div className="conic-sheen" aria-hidden style={{ opacity: 0.12 }} />
              <p className="label relative mb-4">{T.quality}</p>
              <div className="relative flex flex-wrap items-center gap-6">
                <div className="relative grid h-24 w-24 shrink-0 place-items-center">
                  <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-3)" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={quality.score >= 80 ? "#22c55e" : quality.score >= 50 ? "#eab308" : "#ef4444"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(quality.score / 100) * 2 * Math.PI * 42} 999`} style={{ transition: "stroke-dasharray .8s ease" }} />
                  </svg>
                  <div className="absolute text-center">
                    <p className="font-display text-2xl">{num(quality.score)}</p>
                    <p className="label" style={{ fontSize: "0.55rem" }}>{fa ? quality.faLabel : quality.label}</p>
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-3 gap-3">
                  <Field label={T.avgLat} value={quality.avg ? `${num(quality.avg)} ms` : "…"} mono />
                  <Field label={T.jitter} value={quality.avg ? `${num(quality.jitter)} ms` : "…"} mono />
                  <Field label={T.loss} value={`${num(quality.loss)}%`} mono />
                </div>
              </div>
            </div>

            <div className="panel elev p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <p className="label">
                  {T.latency} · {T.latOverTime}
                </p>
                <button onClick={runPings} className="mono text-xs text-[var(--accent)] hover:underline">
                  ↻
                </button>
              </div>
              <div className="space-y-3">
                {pings.map((p) => {
                  const ms = p.ms,
                    w = ms == null ? 0 : Math.min(100, (ms / 400) * 100),
                    col = ms == null ? "var(--fg-2)" : ms < 80 ? "#22c55e" : ms < 200 ? "#eab308" : "#ef4444";
                  return (
                    <div key={p.host} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm force-ltr">{p.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                        <div className="h-full rounded-full" style={{ width: `${w}%`, background: col, transition: "width .5s ease" }} />
                      </div>
                      <MiniLine data={p.hist} />
                      <span className="mono w-16 text-end text-xs" style={{ color: col }}>
                        {ms == null ? "…" : `${num(ms)}ms`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel elev p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="label">{T.webrtc}</p>
                <span className="mono text-xs" style={{ color: localLeak ? "#ef4444" : "#22c55e" }}>
                  {localLeak ? "⚠ " + T.leakY : "✔ " + T.leakN}
                </span>
              </div>
              {gathering && <p className="text-sm text-[var(--fg-2)]">{T.gathering}</p>}
              {!gathering && cands.length === 0 && <p className="text-sm text-[var(--fg-2)]">{T.none}</p>}
              <div className="space-y-2">
                {cands.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                    <span className="mono force-ltr">{c.ip}</span>
                    <span className="mono rounded-md px-2 py-0.5 text-xs" style={{ background: "var(--bg-3)", color: c.type === "srflx" ? "var(--accent)" : c.mdns ? "#22c55e" : "var(--fg-2)" }}>
                      {c.type === "srflx" ? (fa ? "عمومی·STUN" : "public·STUN") : c.mdns ? T.mdns : T.host}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================= CAPABILITIES ========================= */}
        {tab === "capabilities" && (
          <div className="space-y-4">
            {!caps ? (
              <div className="panel elev grid place-items-center py-20 text-sm text-[var(--fg-2)]">{T.capsLoading}</div>
            ) : (
              <>
                {/* summary rail */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="panel elev relative overflow-hidden p-5">
                    <div className="conic-sheen" aria-hidden style={{ opacity: 0.14 }} />
                    <p className="label relative mb-2">{T.capsTitle}</p>
                    <div className="relative flex items-center gap-3">
                      <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-3)" strokeWidth="3.5" />
                        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(caps.supportedCount / (caps.totalCount || 1)) * 2 * Math.PI * 15} 999`} style={{ transition: "stroke-dasharray .8s ease" }} />
                      </svg>
                      <div>
                        <p className="font-display text-2xl">{num(caps.supportedCount)}<span className="text-sm text-[var(--fg-2)]">/{num(caps.totalCount)}</span></p>
                        <p className="label">{T.supported}</p>
                      </div>
                    </div>
                  </div>
                  <div className="panel elev p-5">
                    <p className="label mb-2">{T.uniqueness}</p>
                    <p className="font-display text-3xl" style={{ color: caps.uniqueness >= 66 ? "#ef4444" : caps.uniqueness >= 40 ? "#eab308" : "#22c55e" }}>{num(caps.uniqueness)}%</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                      <div className="h-full rounded-full" style={{ width: `${caps.uniqueness}%`, background: caps.uniqueness >= 66 ? "#ef4444" : caps.uniqueness >= 40 ? "#eab308" : "#22c55e", transition: "width .8s ease" }} />
                    </div>
                  </div>
                  <div className="panel elev p-5">
                    <p className="label mb-2">{T.refresh}</p>
                    <p className="font-display text-3xl force-ltr">{num(caps.refreshHz)} <span className="text-sm text-[var(--fg-2)]">Hz</span></p>
                    <p className="mono mt-1 text-xs text-[var(--fg-2)] force-ltr">{T.httpProto}: {caps.httpProtocol}</p>
                  </div>
                  <div className="panel elev p-5">
                    <p className="label mb-2">{T.timeSkew}</p>
                    <p className="font-display text-3xl force-ltr" style={{ color: caps.timeSkewMs != null && Math.abs(caps.timeSkewMs) > 60000 ? "#eab308" : "var(--fg)" }}>
                      {caps.timeSkewMs == null ? "—" : `${caps.timeSkewMs > 0 ? "+" : ""}${(caps.timeSkewMs / 1000).toFixed(1)}s`}
                    </p>
                    <p className="mono mt-1 truncate text-xs text-[var(--fg-2)] force-ltr">{caps.gpuAdapter || "GPU: —"}</p>
                  </div>
                </div>

                {/* groups */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {caps.groups.map((g, gi) => (
                    <div
                      key={g.key}
                      className="panel elev glow-border p-5"
                      style={{ animation: "popIn .5s cubic-bezier(.22,1,.36,1) both", animationDelay: `${gi * 60}ms` }}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-lg text-sm" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>{g.icon}</span>
                        <h3 className="font-display text-base">{fa ? g.faTitle : g.title}</h3>
                      </div>
                      <div className="grid gap-1.5">
                        {g.items.map((it) => (
                          <div key={it.label} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-[var(--bg-3)]">
                            <span className="min-w-0 truncate text-[var(--fg-2)]">{fa ? it.faLabel : it.label}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="mono text-xs force-ltr" style={{ color: it.ok === false ? "var(--fg-2)" : "var(--fg)" }}>{it.value}</span>
                              {it.ok !== null && (
                                <span className="h-2 w-2 rounded-full" style={{ background: it.ok ? "#22c55e" : "color-mix(in srgb, var(--fg-2) 40%, transparent)" }} />
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-[var(--fg-2)]">{T.uniqueNote}</p>
              </>
            )}
          </div>
        )}

        {/* ========================== FINGERPRINT ========================= */}
        {tab === "fingerprint" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel elev glow-border relative overflow-hidden p-5">
              <div className="conic-sheen" aria-hidden style={{ opacity: 0.12 }} />
              <p className="label relative mb-4">{T.combined}</p>
              <p className="relative font-display text-xl force-ltr break-all sm:text-2xl" style={{ color: "var(--accent)", letterSpacing: "0.05em" }}>
                {devHash ? groupHash(devHash, 5, 4) : "…"}
              </p>
              <p className="relative mt-3 text-xs text-[var(--fg-2)]">{T.fpNote}</p>
              {caps && (
                <div className="relative mt-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="label">{T.uniqueness}</span>
                    <span className="mono text-xs" style={{ color: caps.uniqueness >= 66 ? "#ef4444" : caps.uniqueness >= 40 ? "#eab308" : "#22c55e" }}>{num(caps.uniqueness)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}>
                    <div className="h-full rounded-full" style={{ width: `${caps.uniqueness}%`, background: caps.uniqueness >= 66 ? "#ef4444" : caps.uniqueness >= 40 ? "#eab308" : "#22c55e", transition: "width .8s ease" }} />
                  </div>
                </div>
              )}
              <div className="relative mt-4 grid gap-3">
                <Field label={T.canvas} value={device?.canvasHash} mono />
                <Field label={T.audio} value={device?.audio} mono />
              </div>
            </div>
            <div className="panel elev p-5">
              <p className="label mb-4">GPU / WebGL</p>
              <div className="grid gap-3">
                <Field label={T.webglV} value={device?.gpuVendor} mono />
                <Field label={T.webglR} value={device?.gpuRenderer} mono />
              </div>
            </div>
            {device && device.fonts.length > 0 && (
              <div className="panel elev p-5 lg:col-span-2">
                <p className="label mb-4">
                  {T.fonts} · {num(device.fonts.length)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {device.fonts.map((f) => (
                    <span key={f} className="mono rounded-md border px-2 py-1 text-xs force-ltr" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="panel elev p-5 lg:col-span-2">
              <p className="label mb-4">{T.device}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {device &&
                  (
                    [
                      ["platform", device.platform],
                      ["arch", device.arch],
                      ["cores", String(device.cores || "—")],
                      ["memory", device.memory ? `${device.memory} GB` : "—"],
                      ["screen", `${device.screen} @${device.dpr}x`],
                      ["viewport", device.viewport],
                      ["color", `${device.colorDepth}-bit`],
                      ["touch", device.touchPoints ? `${device.touchPoints} pts` : fa ? "خیر" : "no"],
                      ["lang", device.languages.join(", ")],
                      ["locale", device.locale],
                      ["timezone", device.tz],
                      ["utc", `${device.tzOffset >= 0 ? "+" : ""}${device.tzOffset / 60}h`],
                      ["vendor", device.vendor],
                    ] as [string, string][]
                  ).map(([k, v]) => <Field key={k} label={k} value={v} mono />)}
              </div>
            </div>
          </div>
        )}

        {/* ========================= PERFORMANCE ========================== */}
        {tab === "performance" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel elev p-5">
              <p className="label mb-4">{T.speed}</p>
              <div className="flex items-center gap-4">
                <div className="relative grid h-24 w-24 shrink-0 place-items-center">
                  <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--bg-3)" strokeWidth="9" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(Math.min(100, ((speed.mbps || 0) / 200) * 100) / 100) * 2 * Math.PI * 42} 999`} style={{ transition: "stroke-dasharray .6s ease" }} />
                  </svg>
                  <span className="absolute font-display text-lg force-ltr">{speed.running ? "…" : speed.mbps ? speed.mbps.toFixed(0) : "—"}</span>
                </div>
                <div>
                  <p className="font-display text-3xl force-ltr">
                    {speed.mbps ? `${speed.mbps.toFixed(1)}` : "—"} <span className="text-sm text-[var(--fg-2)]">{T.mbps}</span>
                  </p>
                  <button onClick={runSpeed} disabled={speed.running} className="btn btn-accent mt-3 px-4 py-2 text-sm disabled:opacity-50">
                    {speed.running ? "…" : T.runSpeed}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--fg-2)]">via speed.cloudflare.com · 5MB</p>
            </div>
            <div className="panel elev p-5">
              <p className="label mb-4">
                {T.mem} · {T.storageL}
              </p>
              <div className="grid gap-3">
                <Field label={T.mem} value={jsHeap} mono />
                {storage && <Field label={`${T.used} / ${T.quota}`} value={`${mb(storage.usage)} / ${mb(storage.quota)}`} mono />}
                {battery && <Field label={T.batteryL} value={`${Math.round(battery.level * 100)}%${battery.charging ? " ⚡" : ""}`} mono />}
                {cpu && <Field label={T.cpuBench} value={`${cpu.benchMs} ms`} mono />}
              </div>
            </div>
          </div>
        )}

        {/* ========================= PERMISSIONS ========================== */}
        {tab === "permissions" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel elev p-5">
              <p className="label mb-4">{T.perms}</p>
              <div className="space-y-2">
                {Object.entries(perms).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--line)" }}>
                    <span className="force-ltr">{k}</span>
                    <span className="mono rounded-md px-2 py-0.5 text-xs" style={{ background: "var(--bg-3)", color: v === "granted" ? "#22c55e" : v === "denied" ? "#ef4444" : "var(--fg-2)" }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              <div className="panel elev p-5">
                <p className="label mb-4">{T.mediaDev}</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    [T.cam, devices.cam, "🎥"],
                    [T.mic, devices.mic, "🎙️"],
                    [T.spk, devices.spk, "🔊"],
                  ].map(([l, n, ic]) => (
                    <div key={l as string} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                      <div className="text-2xl">{ic as string}</div>
                      <div className="font-display text-2xl">{num(n as number)}</div>
                      <div className="label">{l as string}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel elev p-5">
                <p className="label mb-4">{T.precise}</p>
                {gps ? (
                  <div className="grid gap-3">
                    <Field label={T.coords} value={`${gps.lat.toFixed(4)}, ${gps.lon.toFixed(4)}`} mono />
                    <Field label={T.geoAcc} value={`±${Math.round(gps.acc)} m`} mono />
                  </div>
                ) : (
                  <button onClick={askGeo} className="btn btn-outline px-4 py-2 text-sm">
                    {T.geoBtn}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[var(--fg-2)]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#22c55e" }} />
          {T.note}
        </p>
      </main>
    </div>
  );
}

function Field({ label, value, big, mono }: { label: string; value?: string; big?: boolean; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
      <p className="label mb-1 truncate">{label}</p>
      <p
        className={`${big ? "font-display text-lg sm:text-xl" : "text-sm"} ${mono ? "mono break-all" : "break-words"} force-ltr leading-snug`}
        style={big ? { color: "var(--accent)" } : undefined}
      >
        {value || "…"}
      </p>
    </div>
  );
}
