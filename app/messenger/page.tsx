"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { useThemeScene } from "@/components/theme-provider";
import { LangToggle } from "@/components/lang-toggle";
import { Logo } from "@/components/logo";
import { BASE_PATH } from "@/lib/data";
import {
  deriveShared,
  deriveVaultKey,
  exportPub,
  genECDH,
  open as openSeal,
  safetyNumber,
  sanitize,
  seal,
  sha256Hex,
  vaultDecrypt,
  vaultEncrypt,
  type SessionKeys,
  type Vault,
} from "@/lib/messenger/crypto";

type Reactions = Record<string, { me: boolean; them: boolean }>;
type Reply = { id: string; preview: string; mine: boolean } | null;
type MsgKind = "text" | "image" | "system" | "voice" | "file";
type Msg = {
  id: string;
  mine: boolean;
  kind: MsgKind;
  text?: string;
  dataUrl?: string;
  ts: number;
  status?: "sent" | "seen";
  reply?: Reply;
  reactions?: Reactions;
  dur?: number;
  file?: { name: string; size: number; mime: string };
  progress?: number;
};
type Convo = { peer: string; handle: string; name: string; messages: Msg[]; unread: number; typing: boolean };
type ConnState = { conn: any; keyPair?: CryptoKeyPair; keys?: SessionKeys; ready: boolean; handle: string };
type CallKind = "audio" | "video" | "screen";
type Call = { kind: CallKind; dir: "in" | "out" | "active"; peer: string; handle: string; mc: any } | null;

const EMOJI = ["👍", "❤️", "🔥", "😂", "🎉", "🙏", "✅", "👀"];
const CHUNK = 48000;
const MAX_FILE = 8_000_000;
const MAX_VOICE_MS = 120_000;

function blip(kind: "in" | "out" | "ring") {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = kind === "in" ? 620 : kind === "ring" ? 480 : 880;
    o.type = "sine";
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    o.start();
    o.stop(ctx.currentTime + 0.18);
    o.onended = () => ctx.close();
  } catch {}
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const urlRe = /(https?:\/\/[^\s]+)/g;
function Linkify({ text }: { text: string }) {
  const parts = text.split(urlRe);
  return (
    <>
      {parts.map((p, i) =>
        urlRe.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline decoration-2 underline-offset-2 opacity-90">{p}</a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

const peerIdFromHandle = (u: string, tag: string) => `cipher-${sanitize(u)}-${tag}`;
const contextFor = (a: string, b: string) => [a, b].sort().join("|");

function parseTarget(raw: string) {
  let s = raw.trim();
  const m = s.match(/[?&]to=([^&]+)/);
  if (m) s = decodeURIComponent(m[1]);
  s = s.replace(/^@/, "").trim();
  const parts = s.split("#");
  if (parts.length === 2 && parts[0] && /^[0-9a-f]{3,8}$/i.test(parts[1])) {
    const user = sanitize(parts[0]);
    const tag = parts[1].toLowerCase();
    if (!user) return null;
    return { user, tag, peerId: peerIdFromHandle(user, tag), handle: `${parts[0].trim()}#${tag}` };
  }
  return null;
}

/* voice-message player with a decorative animated bar row */
function VoicePlayer({ src, dur, mine }: { src?: string; dur?: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const bars = useMemo(() => Array.from({ length: 26 }, (_, i) => 30 + Math.abs(Math.sin(i * 1.7)) * 70), []);
  const toggle = () => {
    if (!src) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };
  const col = mine ? "var(--on-accent)" : "var(--fg-2)";
  return (
    <div className="flex items-center gap-3" style={{ minWidth: "12rem" }}>
      <button onClick={toggle} className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: mine ? "rgba(0,0,0,0.15)" : "var(--bg-2)" }}>
        {playing ? "⏸" : "▶"}
      </button>
      <div className="flex flex-1 items-center gap-[2px]">
        {bars.map((h, i) => (
          <span key={i} className="w-[3px] rounded-full" style={{ height: `${h * 0.22}px`, background: col, opacity: playing ? 1 : 0.55, animation: playing ? `vbar .9s ${i * 0.03}s ease-in-out infinite alternate` : "none" }} />
        ))}
      </div>
      <span className="mono text-[10px]" style={{ opacity: 0.7 }}>{fmtDur(dur || 0)}</span>
    </div>
  );
}

export default function MessengerPage() {
  const { lang } = useLang();
  const { toggleMode } = useThemeScene();
  const fa = lang === "fa";

  const [stage, setStage] = useState<"auth" | "chat">("auth");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [handle, setHandle] = useState("");
  const [tagPreview, setTagPreview] = useState("");
  const [status, setStatus] = useState<"offline" | "connecting" | "online">("offline");
  const [convos, setConvos] = useState<Record<string, Convo>>({});
  const [active, setActive] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [peerInput, setPeerInput] = useState("");
  const [connectErr, setConnectErr] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [copied, setCopied] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showSafety, setShowSafety] = useState(false);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [latency, setLatency] = useState<Record<string, number>>({});
  const [atBottom, setAtBottom] = useState(true);
  const [reactFor, setReactFor] = useState<string | null>(null);
  // media
  const [call, setCall] = useState<Call>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [attaching, setAttaching] = useState(false);

  const peerRef = useRef<any>(null);
  const connsRef = useRef<Record<string, ConnState>>({});
  const vaultRef = useRef<Vault | null>(null);
  const activeRef = useRef<string | null>(null);
  const meRef = useRef({ user: "", tag: "", handle: "", id: "" });
  const soundRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<Record<string, any>>({});
  const pingTimer = useRef<Record<string, any>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recCancelRef = useRef(false);
  const recTimer = useRef<any>(null);
  const recStart = useRef(0);
  const fileRecv = useRef<Record<string, { name: string; mime: string; total: number; parts: string[]; got: number }>>({});

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // attach media streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream, call]);
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream, call]);

  useEffect(() => {
    if (user.trim().length >= 3 && pass.length >= 4) sha256Hex(sanitize(user) + ":" + pass).then((h) => setTagPreview(h.slice(0, 4)));
    else setTagPreview("");
  }, [user, pass]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useEffect(() => { if (atBottom) scrollToBottom(); }, [convos, active, atBottom, scrollToBottom]);

  const T = fa
    ? {
        title: "Cipher", tag: "پیام‌رسانِ رمزنگاری‌شده‌ی همتا‌به‌همتا",
        u: "نام کاربری", p: "رمز عبور", go: "ورود و آنلاین‌شدن", yourHandle: "هندلِ تو",
        handleNote: "هرکسی می‌تواند نام «saleh» را بردارد؛ اما تگِ یکتای تو (که از رمزت ساخته می‌شود) هندل را مالِ تو می‌کند. برای اتصال، هندلِ کامل یا لینکِ دعوت را بفرست.",
        online: "آنلاین", connecting: "در حال اتصال…", offline: "آفلاین", connect: "اتصال",
        peerPh: "هندلِ طرف مقابل — مثل sara#1b9c", badHandle: "هندلِ کامل را وارد کن، مثل sara#1b9c",
        share: "کپیِ لینکِ دعوت", copyHandle: "کپیِ هندل", copied: "کپی شد!", convos: "گفتگوها", none: "هنوز گفتگویی نیست.",
        emptyTitle: "یک کانالِ امن باز کن", emptyBody: "هندلِ یک نفر را وارد کن تا مستقیم و رمزنگاری‌شده چت کنید.",
        typeMsg: "یک پیام بنویس…", secured: "با ۴ لایه رمزنگاری محافظت می‌شود", typing: "در حال نوشتن…",
        established: "کانالِ امن برقرار شد با", left: "قطع شد", clear: "پاک‌کردن گفتگو", signout: "خروج",
        today: "امروز", yesterday: "دیروز", sound: "صدا", reply: "پاسخ", react: "واکنش", del: "حذف برای من",
        safety: "شماره‌ی امنیتی", safetyNote: "اگر این عدد نزد هر دو نفر یکسان است، کانالِ شما امن و بدونِ شنود است.",
        verify: "تأیید می‌کنم", verified: "تأییدشده", search: "جستجو در گفتگو…", ping: "ms", replyingTo: "در پاسخ به",
        voiceCall: "تماس صوتی", videoCall: "تماس تصویری", screen: "اشتراک صفحه", incoming: "تماسِ ورودی",
        calling: "در حال تماس…", accept: "پاسخ", decline: "رد", end: "پایان", mute: "بی‌صدا", unmute: "صدا", cam: "دوربین",
        rec: "در حال ضبط", holdRec: "برای ضبطِ ویس نگه دار", file: "فایل", download: "دانلود", sending: "در حال ارسال",
        receiving: "در حال دریافت", tooBig: "فایل باید کمتر از ۸ مگابایت باشد.", callBusy: "یک تماسِ دیگر در جریان است.",
        micDenied: "دسترسی به میکروفون/دوربین رد شد.",
      }
    : {
        title: "Cipher", tag: "End-to-end encrypted peer-to-peer messenger",
        u: "Username", p: "Password", go: "Sign in & go online", yourHandle: "Your handle",
        handleNote: "Anyone can pick the name “saleh” — but your unique tag (derived from your password) makes the handle yours. Share your full handle or invite link to connect.",
        online: "online", connecting: "connecting…", offline: "offline", connect: "Connect",
        peerPh: "friend's handle — e.g. sara#1b9c", badHandle: "Enter a full handle, e.g. sara#1b9c",
        share: "Copy invite link", copyHandle: "Copy handle", copied: "Copied!", convos: "Conversations", none: "No conversations yet.",
        emptyTitle: "Open a secure channel", emptyBody: "Enter someone's handle to start a direct, encrypted chat.",
        typeMsg: "Type a message…", secured: "Protected by 4 layers of encryption", typing: "typing…",
        established: "Secure channel established with", left: "disconnected", clear: "Clear conversation", signout: "Sign out",
        today: "Today", yesterday: "Yesterday", sound: "Sound", reply: "Reply", react: "React", del: "Delete for me",
        safety: "Safety number", safetyNote: "If this number matches on both sides, your channel is secure and free of eavesdroppers.",
        verify: "Mark as verified", verified: "Verified", search: "Search this conversation…", ping: "ms", replyingTo: "Replying to",
        voiceCall: "Voice call", videoCall: "Video call", screen: "Share screen", incoming: "Incoming call",
        calling: "Calling…", accept: "Accept", decline: "Decline", end: "End", mute: "Mute", unmute: "Unmute", cam: "Camera",
        rec: "Recording", holdRec: "Hold to record a voice note", file: "File", download: "Download", sending: "Sending",
        receiving: "Receiving", tooBig: "File must be under 8 MB.", callBusy: "Another call is already in progress.",
        micDenied: "Microphone / camera access denied.",
      };

  const nameOf = (c: Convo) => c.handle.split("#")[0];
  const storeKey = (peer: string) => `cipher:hist:${meRef.current.handle}:${peer}`;
  const verifKey = () => `cipher:verified:${meRef.current.handle}`;

  const saveConvo = useCallback(async (peer: string, c: Convo) => {
    if (!vaultRef.current) return;
    try {
      // don't persist heavy media blobs — keep history light
      const persist = c.messages
        .filter((m) => m.kind !== "system")
        .slice(-250)
        .map((m) => (m.kind === "file" || m.kind === "image" || m.kind === "voice" ? { ...m, dataUrl: undefined } : m));
      localStorage.setItem(storeKey(peer), await vaultEncrypt(vaultRef.current, { handle: c.handle, messages: persist }));
    } catch {}
  }, []);

  const upsert = useCallback(
    (peer: string, updater: (c: Convo) => Convo, persist = true) => {
      setConvos((prev) => {
        const cur = prev[peer] || { peer, handle: connsRef.current[peer]?.handle || peer, name: peer, messages: [], unread: 0, typing: false };
        const next = updater({ ...cur, messages: [...cur.messages] });
        if (persist) saveConvo(peer, next);
        return { ...prev, [peer]: next };
      });
    },
    [saveConvo]
  );

  const addMsg = useCallback(
    (peer: string, msg: Msg) => {
      upsert(peer, (c) => {
        const isActive = activeRef.current === peer;
        return { ...c, messages: [...c.messages, msg], unread: msg.mine || isActive ? c.unread : c.unread + 1, typing: false };
      });
      if (!msg.mine && msg.kind !== "system" && soundRef.current) blip("in");
    },
    [upsert]
  );

  const send = (peer: string, obj: any) => {
    const cs = connsRef.current[peer];
    if (cs?.conn?.open) cs.conn.send(JSON.stringify(obj));
  };

  const beginHandshake = useCallback(async (peer: string) => {
    const cs = connsRef.current[peer];
    if (!cs) return;
    cs.keyPair = await genECDH();
    send(peer, { t: "hs", pub: await exportPub(cs.keyPair), handle: meRef.current.handle });
  }, []);

  const startPing = useCallback((peer: string) => {
    clearInterval(pingTimer.current[peer]);
    pingTimer.current[peer] = setInterval(() => send(peer, { t: "ping", ts: Date.now() }), 4000);
  }, []);

  const onData = useCallback(
    async (peer: string, raw: any) => {
      let data: any;
      try { data = JSON.parse(raw); } catch { return; }
      const cs = connsRef.current[peer];
      if (!cs) return;

      if (data.t === "hs") {
        if (data.handle) cs.handle = data.handle;
        if (!cs.keyPair) cs.keyPair = await genECDH();
        try {
          cs.keys = await deriveShared(cs.keyPair, data.pub, contextFor(meRef.current.handle, cs.handle));
          cs.ready = true;
          upsert(peer, (c) => ({ ...c, handle: cs.handle, name: cs.handle.split("#")[0], messages: [...c.messages, { id: crypto.randomUUID(), mine: false, kind: "system", text: `🔒 ${T.established} ${cs.handle}`, ts: Date.now() }] }), false);
          startPing(peer);
        } catch {}
      } else if (data.t === "msg" && cs.keys) {
        try {
          const text = await openSeal(cs.keys, data.c);
          if (data.kind === "image") addMsg(peer, { id: data.id || crypto.randomUUID(), mine: false, kind: "image", dataUrl: text, ts: Date.now(), reply: data.reply || null });
          else if (data.kind === "voice") addMsg(peer, { id: data.id || crypto.randomUUID(), mine: false, kind: "voice", dataUrl: text, dur: data.dur, ts: Date.now() });
          else addMsg(peer, { id: data.id || crypto.randomUUID(), mine: false, kind: "text", text, ts: Date.now(), reply: data.reply || null });
          if (activeRef.current === peer) send(peer, { t: "seen" });
        } catch {}
      } else if (data.t === "file-meta") {
        fileRecv.current[data.id] = { name: data.name, mime: data.mime, total: data.total, parts: new Array(data.total), got: 0 };
        addMsg(peer, { id: data.id, mine: false, kind: "file", file: { name: data.name, size: data.size, mime: data.mime }, progress: 0, ts: Date.now() });
      } else if (data.t === "file-chunk") {
        const rec = fileRecv.current[data.id];
        if (rec && rec.parts[data.i] === undefined) {
          rec.parts[data.i] = data.d;
          rec.got++;
          if (rec.got % 8 === 0 || rec.got === rec.total) {
            const prog = Math.round((rec.got / rec.total) * 100);
            upsert(peer, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === data.id ? { ...m, progress: prog } : m)) }), false);
          }
        }
      } else if (data.t === "file-done") {
        const rec = fileRecv.current[data.id];
        if (rec && cs.keys) {
          try {
            const payload = await openSeal(cs.keys, rec.parts.join(""));
            const obj = JSON.parse(payload);
            upsert(peer, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === data.id ? { ...m, dataUrl: obj.dataUrl, progress: 100 } : m)) }));
          } catch {}
          delete fileRecv.current[data.id];
        }
      } else if (data.t === "typing") {
        upsert(peer, (c) => ({ ...c, typing: !!data.on }), false);
      } else if (data.t === "seen") {
        upsert(peer, (c) => ({ ...c, messages: c.messages.map((m) => (m.mine ? { ...m, status: "seen" } : m)) }));
      } else if (data.t === "react") {
        upsert(peer, (c) => ({
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== data.id) return m;
            const r: Reactions = { ...(m.reactions || {}) };
            r[data.emoji] = { me: r[data.emoji]?.me || false, them: !!data.on };
            if (!r[data.emoji].me && !r[data.emoji].them) delete r[data.emoji];
            return { ...m, reactions: r };
          }),
        }));
      } else if (data.t === "ping") {
        send(peer, { t: "pong", ts: data.ts });
      } else if (data.t === "pong") {
        setLatency((l) => ({ ...l, [peer]: Date.now() - data.ts }));
      }
    },
    [addMsg, upsert, startPing, T.established]
  );

  const wireConn = useCallback(
    (conn: any) => {
      const peer = conn.peer;
      connsRef.current[peer] = connsRef.current[peer] || { conn, ready: false, handle: peer };
      connsRef.current[peer].conn = conn;
      conn.on("open", () => {
        setConvos((prev) => (prev[peer] ? prev : { ...prev, [peer]: { peer, handle: connsRef.current[peer].handle, name: connsRef.current[peer].handle.split("#")[0], messages: [], unread: 0, typing: false } }));
        setActive((a) => a ?? peer);
        beginHandshake(peer);
      });
      conn.on("data", (raw: any) => onData(peer, raw));
      conn.on("close", () => {
        if (connsRef.current[peer]) connsRef.current[peer].ready = false;
        clearInterval(pingTimer.current[peer]);
        setLatency((l) => { const n = { ...l }; delete n[peer]; return n; });
        upsert(peer, (c) => ({ ...c, messages: [...c.messages, { id: crypto.randomUUID(), mine: false, kind: "system", text: `⚠︎ ${c.handle} ${T.left}`, ts: Date.now() }] }), false);
      });
      conn.on("error", () => {});
    },
    [beginHandshake, onData, upsert, T.left]
  );

  const connectTo = useCallback(
    (raw: string) => {
      setConnectErr("");
      const tgt = parseTarget(raw);
      if (!tgt) { setConnectErr(T.badHandle); return; }
      if (!peerRef.current || tgt.peerId === meRef.current.id) return;
      connsRef.current[tgt.peerId] = connsRef.current[tgt.peerId] || { conn: null, ready: false, handle: tgt.handle };
      connsRef.current[tgt.peerId].handle = tgt.handle;
      const conn = peerRef.current.connect(tgt.peerId, { reliable: true });
      wireConn(conn);
      setConvos((prev) => (prev[tgt.peerId] ? prev : { ...prev, [tgt.peerId]: { peer: tgt.peerId, handle: tgt.handle, name: tgt.handle.split("#")[0], messages: [], unread: 0, typing: false } }));
      setActive(tgt.peerId);
      setShowSidebar(false);
    },
    [wireConn, T.badHandle]
  );

  /* ---------- media calls ---------- */
  const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

  const endCall = useCallback(() => {
    try { call?.mc?.close(); } catch {}
    stopStream(localStreamRef.current);
    setLocalStream(null);
    setRemoteStream(null);
    setCall(null);
    setMuted(false);
    setCamOff(false);
  }, [call]);

  const getMedia = async (kind: CallKind): Promise<MediaStream> => {
    if (kind === "screen") {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach((t) => s.addTrack(t));
      } catch {}
      return s;
    }
    return navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
  };

  const startCall = useCallback(
    async (kind: CallKind) => {
      if (!active || !peerRef.current) return;
      if (call) { alert(T.callBusy); return; }
      let stream: MediaStream;
      try { stream = await getMedia(kind); } catch { alert(T.micDenied); return; }
      setLocalStream(stream);
      const mc = peerRef.current.call(active, stream, { metadata: { kind, handle: meRef.current.handle } });
      setCall({ kind, dir: "out", peer: active, handle: connsRef.current[active]?.handle || active, mc });
      mc.on("stream", (rs: MediaStream) => { setRemoteStream(rs); setCall((c) => (c ? { ...c, dir: "active" } : c)); });
      mc.on("close", () => endCall());
      mc.on("error", () => endCall());
    },
    [active, call, endCall, T.callBusy, T.micDenied]
  );

  const answerCall = useCallback(async () => {
    if (!call || call.dir !== "in") return;
    const kind = call.kind === "screen" ? "video" : call.kind;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" }); } catch { alert(T.micDenied); endCall(); return; }
    setLocalStream(stream);
    call.mc.answer(stream);
    call.mc.on("stream", (rs: MediaStream) => setRemoteStream(rs));
    call.mc.on("close", () => endCall());
    call.mc.on("error", () => endCall());
    setCall({ ...call, dir: "active" });
  }, [call, endCall, T.micDenied]);

  const toggleMute = () => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted((m) => !m);
  };
  const toggleCam = () => {
    const s = localStreamRef.current;
    if (!s) return;
    s.getVideoTracks().forEach((t) => (t.enabled = camOff));
    setCamOff((c) => !c);
  };

  /* ---------- boot ---------- */
  const boot = useCallback(async () => {
    const mod = await import("peerjs");
    const Peer: any = mod.default;
    const primary = meRef.current.id;
    const mk = (id: string) => new Peer(id, { debug: 1, config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] } });
    setStatus("connecting");
    const attach = (peer: any) => {
      peer.on("open", () => {
        setStatus("online");
        const to = new URLSearchParams(window.location.search).get("to");
        if (to) setTimeout(() => connectTo(to), 500);
      });
      peer.on("connection", (conn: any) => wireConn(conn));
      peer.on("call", (mc: any) => {
        setCall((cur) => {
          if (cur) { try { mc.close(); } catch {} return cur; }
          if (soundRef.current) blip("ring");
          return { kind: (mc.metadata?.kind as CallKind) || "audio", dir: "in", peer: mc.peer, handle: mc.metadata?.handle || connsRef.current[mc.peer]?.handle || mc.peer, mc };
        });
      });
      peer.on("error", (err: any) => {
        if (err?.type === "unavailable-id") {
          const np = mk(primary + "-" + Math.random().toString(36).slice(2, 5));
          peerRef.current = np;
          attach(np);
        } else setStatus("connecting");
      });
    };
    const p = mk(primary);
    peerRef.current = p;
    attach(p);
  }, [connectTo, wireConn]);

  const loadHistory = useCallback(async () => {
    if (!vaultRef.current) return;
    const prefix = `cipher:hist:${meRef.current.handle}:`;
    const loaded: Record<string, Convo> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const peer = k.slice(prefix.length);
        try {
          const data = await vaultDecrypt<{ handle: string; messages: Msg[] }>(vaultRef.current, localStorage.getItem(k) as string);
          const h = data.handle || peer;
          loaded[peer] = { peer, handle: h, name: h.split("#")[0], messages: data.messages || [], unread: 0, typing: false };
          connsRef.current[peer] = connsRef.current[peer] || { conn: null, ready: false, handle: h };
        } catch {}
      }
    }
    if (Object.keys(loaded).length) setConvos((prev) => ({ ...loaded, ...prev }));
    try { const v = localStorage.getItem(verifKey()); if (v) setVerified(JSON.parse(v)); } catch {}
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = user.trim();
    if (u.length < 3 || pass.length < 4) return;
    const tag = (await sha256Hex(sanitize(u) + ":" + pass)).slice(0, 4);
    meRef.current = { user: u, tag, handle: `${u}#${tag}`, id: peerIdFromHandle(u, tag) };
    setHandle(meRef.current.handle);
    const saltKey = `cipher:salt:${meRef.current.handle}`;
    let salt: string | undefined;
    try { salt = localStorage.getItem(saltKey) || undefined; } catch {}
    vaultRef.current = await deriveVaultKey(pass, salt);
    try { if (!salt) localStorage.setItem(saltKey, vaultRef.current.salt); } catch {}
    setStage("chat");
    await loadHistory();
    await boot();
  };

  /* ---------- send actions ---------- */
  const sendText = async () => {
    const text = input.trim();
    const cs = active ? connsRef.current[active] : null;
    if (!text || !active || !cs?.keys || !cs.conn?.open) return;
    setInput("");
    const id = crypto.randomUUID();
    const reply: Reply = replyTo ? { id: replyTo.id, preview: (replyTo.text || (replyTo.kind === "voice" ? "🎙️" : "🖼️")).slice(0, 70), mine: replyTo.mine } : null;
    setReplyTo(null);
    try {
      send(active, { t: "msg", id, kind: "text", c: await seal(cs.keys, text), reply });
      addMsg(active, { id, mine: true, kind: "text", text, ts: Date.now(), status: "sent", reply });
      if (soundRef.current) blip("out");
    } catch {}
  };

  const sendImage = async (file: File) => {
    const cs = active ? connsRef.current[active] : null;
    if (!file || !active || !cs?.keys) return;
    if (file.size > 400_000) return sendFile(file);
    const dataUrl = await blobToDataURL(file);
    const id = crypto.randomUUID();
    try {
      send(active, { t: "msg", id, kind: "image", c: await seal(cs.keys, dataUrl) });
      addMsg(active, { id, mine: true, kind: "image", dataUrl, ts: Date.now(), status: "sent" });
    } catch {}
  };

  const sendFile = async (file: File) => {
    const cs = active ? connsRef.current[active] : null;
    if (!file || !active || !cs?.keys || !cs.conn?.open) return;
    if (file.size > MAX_FILE) { alert(T.tooBig); return; }
    setAttaching(true);
    try {
      const dataUrl = await blobToDataURL(file);
      const sealed = await seal(cs.keys, JSON.stringify({ name: file.name, mime: file.type, dataUrl }));
      const total = Math.ceil(sealed.length / CHUNK);
      const id = crypto.randomUUID();
      const isImg = file.type.startsWith("image/");
      send(active, { t: "file-meta", id, name: file.name, size: file.size, mime: file.type, total });
      addMsg(active, { id, mine: true, kind: isImg ? "image" : "file", dataUrl, file: { name: file.name, size: file.size, mime: file.type }, ts: Date.now(), status: "sent", progress: 0 });
      for (let i = 0; i < total; i++) {
        send(active, { t: "file-chunk", id, i, d: sealed.slice(i * CHUNK, (i + 1) * CHUNK) });
        if (i % 6 === 0) {
          const prog = Math.round(((i + 1) / total) * 100);
          upsert(active, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, progress: prog } : m)) }), false);
          await delay(8);
        }
      }
      send(active, { t: "file-done", id });
      upsert(active, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, progress: 100 } : m)) }), false);
    } catch {}
    setAttaching(false);
  };

  /* voice notes */
  const startRec = async () => {
    if (recording) return;
    const cs = active ? connsRef.current[active] : null;
    if (!active || !cs?.keys) return;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { alert(T.micDenied); return; }
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    recCancelRef.current = false;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(recTimer.current);
      const dur = Math.round((Date.now() - recStart.current) / 1000);
      setRecording(false);
      setRecSecs(0);
      if (recCancelRef.current || dur < 1) return;
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      const dataUrl = await blobToDataURL(blob);
      const csNow = connsRef.current[active];
      if (!csNow?.keys) return;
      const id = crypto.randomUUID();
      try {
        send(active, { t: "msg", id, kind: "voice", dur, c: await seal(csNow.keys, dataUrl) });
        addMsg(active, { id, mine: true, kind: "voice", dataUrl, dur, ts: Date.now(), status: "sent" });
      } catch {}
    };
    recorderRef.current = rec;
    recStart.current = Date.now();
    rec.start();
    setRecording(true);
    setRecSecs(0);
    recTimer.current = setInterval(() => {
      const s = Math.round((Date.now() - recStart.current) / 1000);
      setRecSecs(s);
      if (Date.now() - recStart.current > MAX_VOICE_MS) stopRec();
    }, 250);
  };
  const stopRec = () => { recCancelRef.current = false; recorderRef.current?.state !== "inactive" && recorderRef.current?.stop(); };
  const cancelRec = () => { recCancelRef.current = true; recorderRef.current?.state !== "inactive" && recorderRef.current?.stop(); };

  const react = (msg: Msg, emoji: string) => {
    if (!active) return;
    setReactFor(null);
    const on = !msg.reactions?.[emoji]?.me;
    send(active, { t: "react", id: msg.id, emoji, on });
    upsert(active, (c) => ({
      ...c,
      messages: c.messages.map((m) => {
        if (m.id !== msg.id) return m;
        const r: Reactions = { ...(m.reactions || {}) };
        r[emoji] = { me: on, them: r[emoji]?.them || false };
        if (!r[emoji].me && !r[emoji].them) delete r[emoji];
        return { ...m, reactions: r };
      }),
    }));
  };
  const deleteMsg = (msg: Msg) => { if (active) upsert(active, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== msg.id) })); };

  const onType = () => {
    if (!active) return;
    send(active, { t: "typing", on: true });
    clearTimeout(typingTimer.current[active]);
    typingTimer.current[active] = setTimeout(() => send(active, { t: "typing", on: false }), 1500);
  };
  const openConvo = (peer: string) => {
    setActive(peer); setShowSidebar(false); setSearchOpen(false); setQuery(""); setAtBottom(true);
    upsert(peer, (c) => ({ ...c, unread: 0 }), false);
    if (connsRef.current[peer]?.conn?.open) send(peer, { t: "seen" });
  };
  const clearConvo = () => { if (!active) return; try { localStorage.removeItem(storeKey(active)); } catch {} upsert(active, (c) => ({ ...c, messages: [] }), false); };
  const markVerified = () => {
    if (!active) return;
    const h = connsRef.current[active]?.handle;
    if (!h) return;
    setVerified((v) => { const n = { ...v, [h]: true }; try { localStorage.setItem(verifKey(), JSON.stringify(n)); } catch {} return n; });
    setShowSafety(false);
  };
  const copy = (text: string, key: string) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1600); };
  const signOut = () => { try { endCall(); peerRef.current?.destroy(); } catch {} location.reload(); };
  const onScroll = () => { const el = scrollRef.current; if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80); };

  const dayLabel = (ts: number) => {
    const d = new Date(ts), today = new Date(), y = new Date();
    y.setDate(today.getDate() - 1);
    const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (same(d, today)) return T.today;
    if (same(d, y)) return T.yesterday;
    return new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", { day: "numeric", month: "short" }).format(d);
  };
  const time = (ts: number) => new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));

  const convoList = useMemo(() => Object.values(convos).sort((a, b) => (b.messages[b.messages.length - 1]?.ts || 0) - (a.messages[a.messages.length - 1]?.ts || 0)), [convos]);
  const cur = active ? convos[active] : null;
  const curCs = active ? connsRef.current[active] : null;
  const curReady = curCs?.ready;
  const curFp = curCs?.keys?.fingerprint || "";
  const curVerified = curCs ? verified[curCs.handle] : false;
  const curLat = active ? latency[active] : undefined;
  const shown = cur ? (query.trim() ? cur.messages.filter((m) => (m.text || "").toLowerCase().includes(query.toLowerCase())) : cur.messages) : [];

  /* ================= AUTH ================= */
  if (stage === "auth") {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5">
        <div className="pointer-events-none absolute inset-0 dotfield" aria-hidden />
        <div className="aurora left-[14%] top-[10%] h-72 w-72" style={{ background: "var(--accent)" }} aria-hidden />
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
          <Link href="/" className="mono rounded-full border px-3 py-1.5 text-xs text-[var(--fg-2)] backdrop-blur hover:text-[var(--fg)]" style={{ borderColor: "var(--line-2)" }}>← saleh.im</Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
            <LangToggle />
          </div>
        </div>
        <div className="panel elev relative w-full max-w-md p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>◆</span>
            <div><h1 className="display text-3xl">{T.title}</h1><p className="text-xs text-[var(--fg-2)]">{T.tag}</p></div>
          </div>
          <form onSubmit={signIn} className="grid gap-4" autoComplete="off">
            <label className="grid gap-2 text-sm text-[var(--fg-2)]">{T.u}
              <input value={user} onChange={(e) => setUser(e.target.value)} minLength={3} maxLength={24} required className="rounded-xl border px-4 py-3 text-[var(--fg)] outline-none force-ltr" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} placeholder="saleh" />
            </label>
            <label className="grid gap-2 text-sm text-[var(--fg-2)]">{T.p}
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} minLength={4} required className="rounded-xl border px-4 py-3 text-[var(--fg)] outline-none force-ltr" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} placeholder="••••••" />
            </label>
            {tagPreview && (
              <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                <span className="text-[var(--fg-2)]">{T.yourHandle}: </span>
                <b className="mono force-ltr" style={{ color: "var(--accent)" }}>{sanitize(user)}#{tagPreview}</b>
              </div>
            )}
            <button type="submit" className="btn btn-accent mt-1">{T.go}</button>
            <p className="text-xs leading-relaxed text-[var(--fg-2)]">{T.handleNote}</p>
          </form>
          <div className="mt-6 flex flex-wrap gap-2 border-t pt-5" style={{ borderColor: "var(--line)" }}>
            {["ECDH P-256", "AES-256-GCM ×2", "HMAC-SHA256", "WebRTC calls"].map((c) => (
              <span key={c} className="mono rounded-lg border px-2.5 py-1 text-[10px] force-ltr" style={{ borderColor: "var(--line-2)", color: "var(--accent)" }}>{c}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ================= CHAT ================= */
  const showVideo = call && (call.kind === "video" || call.kind === "screen") && call.dir === "active";

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2.5 sm:flex">
            <Logo size={28} />
            <span className="font-display text-lg">{T.title}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundOn((s) => !s)} title={T.sound} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)", opacity: soundOn ? 1 : 0.5 }}>{soundOn ? "🔔" : "🔕"}</button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
          <LangToggle />
          <button onClick={signOut} className="btn btn-outline h-9 px-4 py-0 text-sm">{T.signout}</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className={`${showSidebar ? "flex" : "hidden"} w-full flex-col border-e sm:flex sm:w-80 sm:shrink-0`} style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
          <div className="border-b p-4" style={{ borderColor: "var(--line)" }}>
            <div className="mb-3 flex items-center justify-between rounded-xl border p-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-[var(--fg-2)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: status === "online" ? "#27c93f" : "#eab308", boxShadow: status === "online" ? "0 0 8px #27c93f" : "none" }} />
                  {status === "online" ? T.online : status === "connecting" ? T.connecting : T.offline}
                </div>
                <b className="mono block truncate text-sm force-ltr" style={{ color: "var(--accent)" }}>{handle}</b>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => copy(handle, "h")} className="tip rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }} data-tip={T.copyHandle}>{copied === "h" ? "✓" : "@"}</button>
                <button onClick={() => copy(`${window.location.origin}${BASE_PATH}/messenger/?to=${encodeURIComponent(handle)}`, "l")} className="tip rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }} data-tip={T.share}>{copied === "l" ? "✓" : "🔗"}</button>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border p-1.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
              <input value={peerInput} onChange={(e) => { setPeerInput(e.target.value); setConnectErr(""); }} onKeyDown={(e) => e.key === "Enter" && peerInput.trim() && (connectTo(peerInput.trim()), setPeerInput(""))} placeholder={T.peerPh} className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none force-ltr" />
              <button onClick={() => peerInput.trim() && connectTo(peerInput.trim())} className="btn btn-accent px-4 py-2 text-sm">{T.connect}</button>
            </div>
            {connectErr && <p className="mt-2 text-xs" style={{ color: "#ff6a6a" }}>{connectErr}</p>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
            <p className="label px-2 py-2">{T.convos}</p>
            {convoList.length === 0 && <p className="px-3 text-sm text-[var(--fg-2)]">{T.none}</p>}
            {convoList.map((c) => {
              const last = c.messages[c.messages.length - 1];
              const on = connsRef.current[c.peer]?.conn?.open;
              const preview = c.typing ? T.typing : last ? (last.kind === "image" ? "🖼️" : last.kind === "voice" ? "🎙️" : last.kind === "file" ? "📎 " + (last.file?.name || "") : last.text) : "…";
              return (
                <button key={c.peer} onClick={() => openConvo(c.peer)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-start transition-colors" style={{ background: active === c.peer ? "var(--bg-3)" : "transparent" }}>
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg uppercase" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}>
                    {nameOf(c).charAt(0)}
                    <span className="absolute -bottom-0 -end-0 h-3 w-3 rounded-full border-2" style={{ background: on ? "#27c93f" : "#71717a", borderColor: "var(--bg-2)" }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-sm force-ltr">{c.handle}</b>
                      {last && <span className="mono shrink-0 text-[10px] text-[var(--fg-2)]">{time(last.ts)}</span>}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-[var(--fg-2)]">{preview}</span>
                      {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{c.unread}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* chat */}
        <main className={`${showSidebar ? "hidden" : "flex"} relative min-w-0 flex-1 flex-col sm:flex`}>
          {!cur ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl text-3xl" style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--accent)" }}>◆</div>
                <h2 className="font-display text-2xl">{T.emptyTitle}</h2>
                <p className="mt-2 text-[var(--fg-2)]">{T.emptyBody}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <div className="flex min-w-0 items-center gap-3">
                  <button onClick={() => setShowSidebar(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border sm:hidden" style={{ borderColor: "var(--line-2)" }}>←</button>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-lg uppercase" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}>{nameOf(cur).charAt(0)}</span>
                  <div className="min-w-0">
                    <b className="flex items-center gap-1.5 truncate text-sm force-ltr">{cur.handle}{curVerified && <span title={T.verified} style={{ color: "var(--accent)" }}>✔</span>}</b>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--fg-2)]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: curReady ? "#27c93f" : "#eab308" }} />
                      {curReady ? T.secured : T.connecting}{curLat != null && <span className="mono">· {curLat}{T.ping}</span>}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => startCall("audio")} disabled={!curReady} className="grid h-9 w-9 place-items-center rounded-full border disabled:opacity-40" style={{ borderColor: "var(--line-2)" }} title={T.voiceCall}>📞</button>
                  <button onClick={() => startCall("video")} disabled={!curReady} className="grid h-9 w-9 place-items-center rounded-full border disabled:opacity-40" style={{ borderColor: "var(--line-2)" }} title={T.videoCall}>🎥</button>
                  <button onClick={() => startCall("screen")} disabled={!curReady} className="hidden h-9 w-9 place-items-center rounded-full border disabled:opacity-40 sm:grid" style={{ borderColor: "var(--line-2)" }} title={T.screen}>🖥️</button>
                  <button onClick={() => { setSearchOpen((s) => !s); setQuery(""); }} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title="search">🔍</button>
                  {curFp && <button onClick={() => setShowSafety((s) => !s)} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: curVerified ? "var(--accent)" : "var(--line-2)" }} title={T.safety}>🛡</button>}
                  <button onClick={clearConvo} className="hidden h-9 w-9 place-items-center rounded-full border sm:grid" style={{ borderColor: "var(--line-2)" }} title={T.clear}>🗑</button>
                </div>
              </div>

              {searchOpen && (
                <div className="border-b px-4 py-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                  <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.search} className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--line)" }} />
                </div>
              )}
              {showSafety && curFp && (
                <div className="border-b px-4 py-4" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                  <p className="label mb-2">{T.safety}</p>
                  <p className="mono select-all text-sm force-ltr" style={{ color: "var(--accent)", letterSpacing: "0.15em" }}>{safetyNumber(curFp)}</p>
                  <p className="mt-2 text-xs text-[var(--fg-2)]">{T.safetyNote}</p>
                  {!curVerified ? <button onClick={markVerified} className="btn btn-accent mt-3 px-4 py-2 text-sm">{T.verify}</button> : <p className="mt-3 text-sm" style={{ color: "var(--accent)" }}>✔ {T.verified}</p>}
                </div>
              )}

              {/* messages */}
              <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4 thin-scroll" style={{ background: "var(--bg)" }}>
                {shown.map((m, i) => {
                  const prev = shown[i - 1];
                  const showDay = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString();
                  if (m.kind === "system")
                    return (<div key={m.id}>{showDay && <DayDivider label={dayLabel(m.ts)} />}<p className="py-1 text-center text-xs text-[var(--fg-2)]">{m.text}</p></div>);
                  const reactions = m.reactions ? Object.entries(m.reactions) : [];
                  return (
                    <div key={m.id}>
                      {showDay && <DayDivider label={dayLabel(m.ts)} />}
                      <div className={`group flex items-end gap-1.5 ${m.mine ? "flex-row-reverse" : ""}`}>
                        <div className="relative max-w-[80%]">
                          <div className="rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed shadow-sm" style={m.mine ? { background: "var(--accent)", color: "var(--on-accent)", borderEndEndRadius: 5 } : { background: "var(--bg-3)", borderEndStartRadius: 5 }}>
                            {m.reply && <div className="mb-1.5 rounded-lg border-s-2 px-2 py-1 text-xs opacity-80" style={{ borderColor: m.mine ? "rgba(0,0,0,0.35)" : "var(--accent)", background: m.mine ? "rgba(0,0,0,0.08)" : "var(--bg-2)" }}>{m.reply.preview}</div>}
                            {m.kind === "image" ? (
                              m.dataUrl ? <img src={m.dataUrl} alt="" className="max-h-64 rounded-lg" /> : <div className="grid h-32 w-48 place-items-center rounded-lg" style={{ background: "rgba(0,0,0,0.1)" }}>{m.progress ?? 0}%</div>
                            ) : m.kind === "voice" ? (
                              <VoicePlayer src={m.dataUrl} dur={m.dur} mine={m.mine} />
                            ) : m.kind === "file" ? (
                              <a href={m.dataUrl} download={m.file?.name} className="flex items-center gap-3" style={{ pointerEvents: m.dataUrl ? "auto" : "none" }}>
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg" style={{ background: m.mine ? "rgba(0,0,0,0.15)" : "var(--bg-2)" }}>📄</span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium force-ltr">{m.file?.name}</span>
                                  <span className="mono text-[11px]" style={{ opacity: 0.7 }}>{m.file ? fmtSize(m.file.size) : ""} {m.progress != null && m.progress < 100 ? `· ${m.progress}%` : m.dataUrl ? `· ${T.download}` : ""}</span>
                                </span>
                              </a>
                            ) : (
                              <span className="whitespace-pre-wrap break-words"><Linkify text={m.text || ""} /></span>
                            )}
                            {m.progress != null && m.progress < 100 && (m.kind === "file" || m.kind === "image") && (
                              <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "rgba(0,0,0,0.15)" }}><div className="h-full rounded-full" style={{ width: `${m.progress}%`, background: m.mine ? "var(--on-accent)" : "var(--accent)" }} /></div>
                            )}
                            <span className="mt-1 flex items-center justify-end gap-1 text-[10px]" style={{ opacity: 0.7 }}>
                              <span className="mono force-ltr">{time(m.ts)}</span>
                              {m.mine && <span>{m.status === "seen" ? "✓✓" : "✓"}</span>}
                            </span>
                          </div>
                          {reactions.length > 0 && (
                            <div className={`mt-0.5 flex flex-wrap gap-1 ${m.mine ? "justify-end" : ""}`}>
                              {reactions.map(([e]) => <span key={e} className="rounded-full border px-1.5 py-0.5 text-xs" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}>{e}</span>)}
                            </div>
                          )}
                          {reactFor === m.id && (
                            <div className={`absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full border p-1 shadow-lg ${m.mine ? "end-0" : "start-0"}`} style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}>
                              {EMOJI.map((e) => <button key={e} onClick={() => react(m, e)} className="rounded-full px-1.5 py-0.5 text-base transition-transform hover:scale-125">{e}</button>)}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => setReactFor(reactFor === m.id ? null : m.id)} className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.react}>☺</button>
                          <button onClick={() => setReplyTo(m)} className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.reply}>↩</button>
                          <button onClick={() => deleteMsg(m)} className="grid h-6 w-6 place-items-center rounded-full text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.del}>✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {cur.typing && (
                  <div className="flex justify-start"><div className="flex gap-1 rounded-2xl px-4 py-3" style={{ background: "var(--bg-3)" }}>{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--fg-2)", animation: `td 1s ${d * 0.15}s infinite` }} />)}</div></div>
                )}
              </div>

              {!atBottom && <button onClick={() => { setAtBottom(true); scrollToBottom(true); }} className="absolute bottom-24 z-10 grid h-10 w-10 place-items-center rounded-full border shadow-lg" style={{ insetInlineEnd: "1.25rem", background: "var(--bg-2)", borderColor: "var(--line-2)" }}>↓</button>}

              {/* composer */}
              <div className="border-t p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                {replyTo && (
                  <div className="mb-2 flex items-center justify-between rounded-lg border-s-2 px-3 py-1.5 text-xs" style={{ borderColor: "var(--accent)", background: "var(--bg-3)" }}>
                    <span className="truncate"><span className="text-[var(--fg-2)]">{T.replyingTo}: </span>{(replyTo.text || "🎙️").slice(0, 60)}</span>
                    <button onClick={() => setReplyTo(null)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button>
                  </div>
                )}
                {recording ? (
                  <div className="flex items-center gap-3">
                    <button onClick={cancelRec} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg" style={{ borderColor: "var(--line-2)", color: "#ff5f56" }}>✕</button>
                    <div className="flex flex-1 items-center gap-2 rounded-xl border px-4" style={{ borderColor: "var(--line)", background: "var(--bg-3)", height: 44 }}>
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: "#ff5f56" }} />
                      <span className="text-sm">{T.rec}</span>
                      <span className="mono ms-auto text-sm">{fmtDur(recSecs)}</span>
                    </div>
                    <button onClick={stopRec} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>➤</button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <button onClick={() => fileRef.current?.click()} disabled={attaching} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg disabled:opacity-50" style={{ borderColor: "var(--line-2)" }} title={T.file}>{attaching ? "…" : "📎"}</button>
                    <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) (f.type.startsWith("image/") ? sendImage(f) : sendFile(f)); e.currentTarget.value = ""; }} />
                    <textarea value={input} onChange={(e) => { setInput(e.target.value); onType(); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }} rows={1} placeholder={T.typeMsg} disabled={!curReady} className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border px-4 py-2.5 text-[var(--fg)] outline-none disabled:opacity-50" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} />
                    {input.trim() ? (
                      <button onClick={sendText} disabled={!curReady} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl disabled:opacity-40" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                      </button>
                    ) : (
                      <button onClick={startRec} disabled={!curReady} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg disabled:opacity-40" style={{ borderColor: "var(--line-2)" }} title={T.holdRec}>🎙️</button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* CALL OVERLAY */}
      {call && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "color-mix(in srgb, var(--bg) 92%, #000)" }}>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
            {showVideo ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline className="max-h-full max-w-full rounded-2xl" style={{ background: "#000" }} />
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 end-4 h-32 w-24 rounded-xl object-cover shadow-2xl sm:h-40 sm:w-32" style={{ background: "#000", border: "2px solid var(--line-2)", transform: "scaleX(-1)" }} />
              </>
            ) : (
              <div className="text-center">
                <div className="relative mx-auto grid h-32 w-32 place-items-center rounded-full font-display text-5xl uppercase" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}>
                  {call.handle.charAt(0)}
                  {call.dir !== "active" && <span className="absolute inset-0 animate-ping rounded-full" style={{ border: "2px solid var(--accent)" }} />}
                </div>
                <p className="mt-6 font-display text-2xl force-ltr">{call.handle}</p>
                <p className="mt-1 text-[var(--fg-2)]">
                  {call.dir === "in" ? `${T.incoming} · ${call.kind === "video" ? T.videoCall : T.voiceCall}` : call.dir === "out" ? T.calling : T.voiceCall}
                </p>
                {/* hidden audio sink for voice calls */}
                <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 border-t p-6" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
            {call.dir === "in" ? (
              <>
                <button onClick={endCall} className="grid h-14 w-14 place-items-center rounded-full text-xl text-white" style={{ background: "#ff5f56" }} title={T.decline}>✕</button>
                <button onClick={answerCall} className="grid h-14 w-14 place-items-center rounded-full text-xl text-white" style={{ background: "#27c93f" }} title={T.accept}>✓</button>
              </>
            ) : (
              <>
                <button onClick={toggleMute} className="grid h-12 w-12 place-items-center rounded-full border text-lg" style={{ borderColor: "var(--line-2)", background: muted ? "var(--accent)" : "var(--bg-3)", color: muted ? "var(--on-accent)" : "var(--fg)" }} title={muted ? T.unmute : T.mute}>{muted ? "🔇" : "🎤"}</button>
                {(call.kind === "video") && <button onClick={toggleCam} className="grid h-12 w-12 place-items-center rounded-full border text-lg" style={{ borderColor: "var(--line-2)", background: camOff ? "var(--accent)" : "var(--bg-3)", color: camOff ? "var(--on-accent)" : "var(--fg)" }} title={T.cam}>{camOff ? "📷" : "🎥"}</button>}
                <button onClick={endCall} className="grid h-14 w-14 place-items-center rounded-full text-xl text-white" style={{ background: "#ff5f56" }} title={T.end}>✕</button>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes td { 0%,60%,100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
        @keyframes vbar { from { transform: scaleY(.5); } to { transform: scaleY(1); } }
      `}</style>
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <span className="h-px flex-1" style={{ background: "var(--line)" }} />
      <span className="mono rounded-full border px-2.5 py-0.5 text-[10px] text-[var(--fg-2)]" style={{ borderColor: "var(--line)" }}>{label}</span>
      <span className="h-px flex-1" style={{ background: "var(--line)" }} />
    </div>
  );
}
