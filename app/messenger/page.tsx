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
  status?: "pending" | "sent" | "seen";
  reply?: Reply;
  reactions?: Reactions;
  dur?: number;
  file?: { name: string; size: number; mime: string };
  progress?: number;
  edited?: boolean;
  deleted?: boolean;
  pinned?: boolean;
  starred?: boolean;
  fwd?: boolean; // forwarded from another chat
};
type Convo = { peer: string; handle: string; name: string; messages: Msg[]; unread: number; typing: boolean };
type ConnState = { conn: any; keyPair?: CryptoKeyPair; keys?: SessionKeys; ready: boolean; handle: string };
type CallKind = "audio" | "video" | "screen";
type Call = { kind: CallKind; dir: "in" | "out" | "active"; peer: string; handle: string; mc: any } | null;

const EMOJI = ["👍", "❤️", "🔥", "😂", "🎉", "🙏", "✅", "👀"];
const EMOJI_PICKER = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😎", "🤩", "😉", "😏",
  "😅", "😭", "🥲", "😴", "🤔", "🤨", "🙄", "😬", "😮", "😇",
  "👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "✌️", "🤙", "👋",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💯", "🔥", "✨",
  "🎉", "🎊", "🥳", "🚀", "⭐", "🌟", "⚡", "💡", "✅", "❌",
  "🤗", "😤", "😡", "🥺", "😱", "🤯", "🫡", "🤖", "👀", "🎯",
];
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
  const [editing, setEditing] = useState<Msg | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [notify, setNotify] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // media
  const [call, setCall] = useState<Call>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [attaching, setAttaching] = useState(false);
  // --- new features ---
  const [globalQuery, setGlobalQuery] = useState("");           // search across all conversations
  const [aliases, setAliases] = useState<Record<string, string>>({}); // local contact nicknames (by handle)
  const [mutedPeers, setMutedPeers] = useState<Record<string, boolean>>({});
  const [disappear, setDisappear] = useState<Record<string, number>>({}); // peer -> seconds (0 = off)
  const [forwarding, setForwarding] = useState<Msg | null>(null); // message being forwarded
  const [showSaved, setShowSaved] = useState(false);             // saved (starred) messages panel
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showConvoMenu, setShowConvoMenu] = useState(false);
  const [privacy, setPrivacy] = useState({ readReceipts: true, typingIndicator: true, fontScale: 1 });
  const draftsRef = useRef<Record<string, string>>({});

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const notifyRef = useRef(false);
  const mutedRef = useRef<Record<string, boolean>>({});
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recCancelRef = useRef(false);
  const recTimer = useRef<any>(null);
  const recStart = useRef(0);
  const fileRecv = useRef<Record<string, { name: string; mime: string; total: number; parts: string[]; got: number }>>({});
  // Reliability: text messages composed while the channel is down are queued
  // here and flushed the moment the secure handshake completes.
  const outboxRef = useRef<Record<string, { id: string; text: string; reply: Reply }[]>>({});
  // Auto-reconnect bookkeeping per peer (attempt count + pending timer).
  const reconnectRef = useRef<Record<string, { attempts: number; timer: any }>>({});

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  useEffect(() => { notifyRef.current = notify; }, [notify]);
  useEffect(() => { mutedRef.current = mutedPeers; }, [mutedPeers]);
  const privacyRef = useRef(privacy);
  useEffect(() => { privacyRef.current = privacy; }, [privacy]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Reflect the total unread count in the browser tab title so a background
  // conversation is noticeable without the tab focused.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const total = Object.values(convos).reduce((n, c) => n + (mutedPeers[c.peer] ? 0 : c.unread), 0);
    const base = "Cipher — encrypted messenger";
    document.title = total > 0 ? `(${total}) ${base}` : base;
    return () => { document.title = base; };
  }, [convos, mutedPeers]);

  // Tidy up all timers + the peer connection when the page unmounts.
  useEffect(() => {
    const reconnects = reconnectRef.current;
    const pings = pingTimer.current;
    return () => {
      Object.values(reconnects).forEach((r) => r?.timer && clearTimeout(r.timer));
      Object.values(pings).forEach((t) => clearInterval(t));
      try { peerRef.current?.destroy(); } catch {}
    };
  }, []);

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
        edit: "ویرایش", copyText: "کپیِ متن", save: "ذخیره", edited: "ویرایش‌شده", emoji: "ایموجی",
        editing: "در حالِ ویرایش", dropHere: "فایل را برای ارسال اینجا رها کن", notif: "اعلانِ دسکتاپ", jump: "پرش به پیام",
        deleteEveryone: "حذف برای همه", msgDeleted: "این پیام حذف شد", reconnecting: "در حالِ اتصالِ دوباره…", queued: "در صف — با اتصال ارسال می‌شود", sentWhenOnline: "وقتی طرف آنلاین شود ارسال می‌شود",
        pin: "سنجاق", unpin: "برداشتنِ سنجاق", pinned: "پیام‌های سنجاق‌شده", star: "ذخیره", saved: "ذخیره‌شده‌ها", noSaved: "پیامِ ذخیره‌شده‌ای نیست.", forward: "هدایت", forwardTo: "هدایت به…", forwarded: "هدایت‌شده", searchAll: "جستجو در همهٔ گفتگوها…", rename: "تغییرِ نام", renamePh: "نامِ نمایشی", muteChat: "بی‌صدا", unmuteChat: "باصدا", mutedTag: "بی‌صدا", disappearing: "پیام‌های ناپدیدشونده", off: "خاموش", exportChat: "خروجیِ گفتگو", privacy: "حریمِ خصوصی", readReceipts: "رسیدِ خواندن", typingInd: "نشانگرِ تایپ", textSize: "اندازهٔ متن", menu: "بیشتر", noResults: "چیزی یافت نشد", secs: "ثانیه", mins: "دقیقه",
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
        edit: "Edit", copyText: "Copy text", save: "Save", edited: "edited", emoji: "Emoji",
        editing: "Editing", dropHere: "Drop file to send", notif: "Desktop notifications", jump: "Jump to message",
        deleteEveryone: "Delete for everyone", msgDeleted: "This message was deleted", reconnecting: "reconnecting…", queued: "Queued — will send when connected", sentWhenOnline: "Will send once they're online",
        pin: "Pin", unpin: "Unpin", pinned: "Pinned messages", star: "Save", saved: "Saved messages", noSaved: "No saved messages.", forward: "Forward", forwardTo: "Forward to…", forwarded: "Forwarded", searchAll: "Search all chats…", rename: "Rename contact", renamePh: "Display name", muteChat: "Mute", unmuteChat: "Unmute", mutedTag: "Muted", disappearing: "Disappearing messages", off: "Off", exportChat: "Export chat", privacy: "Privacy", readReceipts: "Read receipts", typingInd: "Typing indicator", textSize: "Text size", menu: "More", noResults: "No matches", secs: "sec", mins: "min",
      };

  const displayName = (handle: string) => aliases[handle] || handle.split("#")[0];
  const nameOf = (c: Convo) => displayName(c.handle);
  const storeKey = (peer: string) => `cipher:hist:${meRef.current.handle}:${peer}`;
  const verifKey = () => `cipher:verified:${meRef.current.handle}`;
  const prefsKey = () => `cipher:prefs:${meRef.current.handle}`;
  const draftsKey = () => `cipher:drafts:${meRef.current.handle}`;

  // persist per-account preferences (aliases, mutes, disappearing timers, privacy)
  const savePrefs = useCallback((partial?: { aliases?: Record<string, string>; muted?: Record<string, boolean>; disappear?: Record<string, number>; privacy?: typeof privacy }) => {
    try {
      const cur = { aliases, muted: mutedPeers, disappear, privacy, ...partial };
      localStorage.setItem(prefsKey(), JSON.stringify(cur));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aliases, mutedPeers, disappear, privacy]);
  useEffect(() => { if (stage === "chat") savePrefs(); }, [aliases, mutedPeers, disappear, privacy, stage, savePrefs]);

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
      if (!msg.mine && msg.kind !== "system" && !mutedRef.current[peer]) {
        if (soundRef.current) blip("in");
        // desktop notification when the tab is in the background
        if (notifyRef.current && typeof document !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
          try {
            const h = connsRef.current[peer]?.handle || peer;
            const body = msg.kind === "image" ? "🖼️" : msg.kind === "voice" ? "🎙️" : msg.kind === "file" ? "📎 " + (msg.file?.name || "") : (msg.text || "").slice(0, 120);
            const n = new Notification(h, { body, tag: peer, silent: true });
            n.onclick = () => { window.focus(); n.close(); };
          } catch {}
        }
      }
    },
    [upsert]
  );

  const send = (peer: string, obj: any) => {
    const cs = connsRef.current[peer];
    if (cs?.conn?.open) cs.conn.send(JSON.stringify(obj));
  };

  // Holds the latest wireConn so the auto-reconnect timer can re-wire a fresh
  // connection without a circular hook dependency.
  const wireConnRef = useRef<((conn: any) => void) | null>(null);

  // Flush any text messages that were queued while the channel was down. Called
  // as soon as the secure handshake completes.
  const flushOutbox = useCallback(async (peer: string) => {
    const q = outboxRef.current[peer];
    const cs = connsRef.current[peer];
    if (!q || !q.length || !cs?.keys || !cs.conn?.open) return;
    outboxRef.current[peer] = [];
    for (const item of q) {
      try {
        send(peer, { t: "msg", id: item.id, kind: "text", c: await seal(cs.keys, item.text), reply: item.reply });
        upsert(peer, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === item.id ? { ...m, status: "sent" } : m)) }), false);
      } catch {
        (outboxRef.current[peer] = outboxRef.current[peer] || []).push(item);
      }
    }
  }, [upsert]);

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
          flushOutbox(peer); // send anything queued while we were offline
        } catch {}
      } else if (data.t === "msg" && cs.keys) {
        try {
          const text = await openSeal(cs.keys, data.c);
          if (data.kind === "image") addMsg(peer, { id: data.id || crypto.randomUUID(), mine: false, kind: "image", dataUrl: text, ts: Date.now(), reply: data.reply || null });
          else if (data.kind === "voice") addMsg(peer, { id: data.id || crypto.randomUUID(), mine: false, kind: "voice", dataUrl: text, dur: data.dur, ts: Date.now() });
          else addMsg(peer, { id: data.id || crypto.randomUUID(), mine: false, kind: "text", text, ts: Date.now(), reply: data.reply || null, fwd: !!data.fwd });
          if (activeRef.current === peer && privacyRef.current.readReceipts) send(peer, { t: "seen" });
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
      } else if (data.t === "edit" && cs.keys) {
        try {
          const text = await openSeal(cs.keys, data.c);
          upsert(peer, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === data.id ? { ...m, text, edited: true } : m)) }));
        } catch {}
      } else if (data.t === "unsend") {
        // The sender retracted a message — replace it with a tombstone.
        upsert(peer, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === data.id ? { ...m, deleted: true, text: "", dataUrl: undefined, reactions: {}, kind: "text" } : m)) }));
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
    [addMsg, upsert, startPing, flushOutbox, T.established]
  );

  const wireConn = useCallback(
    (conn: any) => {
      const peer = conn.peer;
      connsRef.current[peer] = connsRef.current[peer] || { conn, ready: false, handle: peer };
      connsRef.current[peer].conn = conn;
      conn.on("open", () => {
        setConvos((prev) => (prev[peer] ? prev : { ...prev, [peer]: { peer, handle: connsRef.current[peer].handle, name: connsRef.current[peer].handle.split("#")[0], messages: [], unread: 0, typing: false } }));
        setActive((a) => a ?? peer);
        // a successful (re)connect clears the auto-reconnect backoff
        if (reconnectRef.current[peer]) { clearTimeout(reconnectRef.current[peer].timer); reconnectRef.current[peer] = { attempts: 0, timer: null }; }
        beginHandshake(peer);
      });
      conn.on("data", (raw: any) => onData(peer, raw));
      conn.on("close", () => {
        if (connsRef.current[peer]) connsRef.current[peer].ready = false;
        clearInterval(pingTimer.current[peer]);
        setLatency((l) => { const n = { ...l }; delete n[peer]; return n; });
        upsert(peer, (c) => ({ ...c, messages: [...c.messages, { id: crypto.randomUUID(), mine: false, kind: "system", text: `⚠︎ ${c.handle} ${T.left}`, ts: Date.now() }] }), false);
        // Auto-reconnect with exponential backoff so a dropped peer silently
        // re-establishes the channel (and flushes any queued messages) without
        // the user re-typing the handle.
        const rec = reconnectRef.current[peer] || { attempts: 0, timer: null };
        if (!rec.timer && rec.attempts < 6 && peerRef.current) {
          const delayMs = Math.min(15000, 2500 * Math.pow(1.6, rec.attempts));
          rec.attempts += 1;
          rec.timer = setTimeout(() => {
            rec.timer = null;
            if (!connsRef.current[peer]?.conn?.open && peerRef.current) {
              try {
                const nc = peerRef.current.connect(peer, { reliable: true });
                wireConnRef.current?.(nc);
              } catch {}
            }
          }, delayMs);
        }
        reconnectRef.current[peer] = rec;
      });
      conn.on("error", () => {});
    },
    [beginHandshake, onData, upsert, T.left]
  );
  // Keep the ref pointed at the latest wireConn for the reconnect timer.
  wireConnRef.current = wireConn;

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
    try {
      const s = localStorage.getItem(prefsKey());
      if (s) { const j = JSON.parse(s); setAliases(j.aliases || {}); setMutedPeers(j.muted || {}); setDisappear(j.disappear || {}); setPrivacy((p) => ({ ...p, ...(j.privacy || {}) })); }
    } catch {}
    try { const d = localStorage.getItem(draftsKey()); if (d) draftsRef.current = JSON.parse(d); } catch {}
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
    if (editing) return saveEdit();
    const text = input.trim();
    if (!text || !active) return;
    const cs = connsRef.current[active];
    setInput("");
    const id = crypto.randomUUID();
    const reply: Reply = replyTo ? { id: replyTo.id, preview: (replyTo.text || (replyTo.kind === "voice" ? "🎙️" : "🖼️")).slice(0, 70), mine: replyTo.mine } : null;
    setReplyTo(null);
    if (cs?.keys && cs.conn?.open) {
      try {
        send(active, { t: "msg", id, kind: "text", c: await seal(cs.keys, text), reply });
        addMsg(active, { id, mine: true, kind: "text", text, ts: Date.now(), status: "sent", reply });
        if (soundRef.current) blip("out");
      } catch {}
    } else {
      // Channel isn't up yet — queue the message, show it as pending, and try
      // to (re)establish the connection so the outbox flushes on handshake.
      (outboxRef.current[active] = outboxRef.current[active] || []).push({ id, text, reply });
      addMsg(active, { id, mine: true, kind: "text", text, ts: Date.now(), status: "pending", reply });
      const handle = connsRef.current[active]?.handle;
      if (handle && !cs?.conn?.open) connectTo(handle);
    }
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
  const deleteForEveryone = (msg: Msg) => {
    if (!active || !msg.mine) return;
    send(active, { t: "unsend", id: msg.id });
    if (outboxRef.current[active]) outboxRef.current[active] = outboxRef.current[active].filter((o) => o.id !== msg.id);
    upsert(active, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msg.id ? { ...m, deleted: true, text: "", dataUrl: undefined, reactions: {}, kind: "text" } : m)) }));
  };

  const startEdit = (msg: Msg) => { if (!msg.mine || msg.kind !== "text") return; setReplyTo(null); setEditing(msg); setInput(msg.text || ""); requestAnimationFrame(() => textareaRef.current?.focus()); };
  const cancelEdit = () => { setEditing(null); setInput(""); };
  const saveEdit = async () => {
    const text = input.trim();
    const id = editing?.id;
    const orig = editing?.text;
    setEditing(null);
    setInput("");
    if (!id || !active || !text || text === orig) return;
    const cs = connsRef.current[active];
    if (!cs?.keys) return;
    try {
      send(active, { t: "edit", id, c: await seal(cs.keys, text) });
      upsert(active, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, text, edited: true } : m)) }));
    } catch {}
  };
  const insertEmoji = (e: string) => {
    const ta = textareaRef.current;
    if (!ta) { setInput((v) => v + e); return; }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    const next = input.slice(0, start) + e + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => { ta.focus(); const pos = start + e.length; try { ta.setSelectionRange(pos, pos); } catch {} });
  };
  const copyMsgText = (m: Msg) => { if (m.text) copy(m.text, "m-" + m.id); };
  const jumpTo = (id: string) => {
    const el = document.getElementById("msg-" + id);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setHighlightId(id); setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1600); }
  };
  const onDropFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !active) return;
    f.type.startsWith("image/") ? sendImage(f) : sendFile(f);
  };
  const requestNotify = () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") { setNotify((n) => !n); return; }
    Notification.requestPermission().then((p) => setNotify(p === "granted"));
  };

  const onType = () => {
    if (!active || !privacyRef.current.typingIndicator) return;
    send(active, { t: "typing", on: true });
    clearTimeout(typingTimer.current[active]);
    typingTimer.current[active] = setTimeout(() => send(active, { t: "typing", on: false }), 1500);
  };
  const openConvo = (peer: string) => {
    setActive(peer); setShowSidebar(false); setSearchOpen(false); setQuery(""); setAtBottom(true);
    upsert(peer, (c) => ({ ...c, unread: 0 }), false);
    if (connsRef.current[peer]?.conn?.open && privacyRef.current.readReceipts) send(peer, { t: "seen" });
    // restore any saved draft for this conversation
    setInput(draftsRef.current[peer] || "");
  };
  const clearConvo = () => { if (!active) return; try { localStorage.removeItem(storeKey(active)); } catch {} upsert(active, (c) => ({ ...c, messages: [] }), false); };

  // --- persist drafts as you type (per conversation) ---
  useEffect(() => {
    if (stage !== "chat" || !active || editing) return;
    draftsRef.current[active] = input;
    try { localStorage.setItem(draftsKey(), JSON.stringify(draftsRef.current)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, active, editing, stage]);

  // --- disappearing messages: prune expired messages on a short cadence ---
  useEffect(() => {
    if (!Object.values(disappear).some((s) => s > 0)) return;
    const iv = setInterval(() => {
      const now = Date.now();
      setConvos((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const peer in prev) {
          const secs = disappear[peer];
          if (!secs) continue;
          const kept = prev[peer].messages.filter((m) => m.starred || m.pinned || m.kind === "system" || now - m.ts < secs * 1000);
          if (kept.length !== prev[peer].messages.length) { next[peer] = { ...prev[peer], messages: kept }; changed = true; }
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(iv);
  }, [disappear]);

  // --- message actions: pin / star / forward ---
  const togglePin = (m: Msg) => { if (!active) return; upsert(active, (c) => ({ ...c, messages: c.messages.map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : x)) })); };
  const toggleStar = (m: Msg, peer: string | null = active) => { if (!peer) return; upsert(peer, (c) => ({ ...c, messages: c.messages.map((x) => (x.id === m.id ? { ...x, starred: !x.starred } : x)) })); };

  const forwardTo = async (peer: string) => {
    const m = forwarding;
    setForwarding(null);
    if (!m || !peer) return;
    const cs = connsRef.current[peer];
    const id = crypto.randomUUID();
    const openConn = !!(cs?.keys && cs.conn?.open);
    try {
      if (m.kind === "text" && m.text) {
        if (openConn) { send(peer, { t: "msg", id, kind: "text", c: await seal(cs!.keys!, m.text), fwd: true }); addMsg(peer, { id, mine: true, kind: "text", text: m.text, ts: Date.now(), status: "sent", fwd: true }); }
        else { (outboxRef.current[peer] = outboxRef.current[peer] || []).push({ id, text: m.text, reply: null }); addMsg(peer, { id, mine: true, kind: "text", text: m.text, ts: Date.now(), status: "pending", fwd: true }); const h = connsRef.current[peer]?.handle; if (h && !cs?.conn?.open) connectTo(h); }
      } else if (m.kind === "image" && m.dataUrl && openConn) {
        send(peer, { t: "msg", id, kind: "image", c: await seal(cs!.keys!, m.dataUrl), fwd: true }); addMsg(peer, { id, mine: true, kind: "image", dataUrl: m.dataUrl, ts: Date.now(), status: "sent", fwd: true });
      } else if (m.kind === "voice" && m.dataUrl && openConn) {
        send(peer, { t: "msg", id, kind: "voice", dur: m.dur, c: await seal(cs!.keys!, m.dataUrl) }); addMsg(peer, { id, mine: true, kind: "voice", dataUrl: m.dataUrl, dur: m.dur, ts: Date.now(), status: "sent" });
      }
    } catch {}
    openConvo(peer);
  };

  // --- conversation-level: rename / mute / disappearing / export ---
  const renameContact = () => {
    if (!cur) return;
    const v = window.prompt(T.renamePh, aliases[cur.handle] || nameOf(cur));
    if (v === null) return;
    const h = cur.handle;
    setAliases((a) => { const n = { ...a }; if (v.trim() && v.trim() !== h.split("#")[0]) n[h] = v.trim(); else delete n[h]; return n; });
    setShowConvoMenu(false);
  };
  const toggleMuteChat = () => { if (!active) return; setMutedPeers((m) => ({ ...m, [active]: !m[active] })); setShowConvoMenu(false); };
  const setDisappearFor = (secs: number) => { if (!active) return; setDisappear((d) => { const n = { ...d }; if (secs > 0) n[active] = secs; else delete n[active]; return n; }); };
  const exportChat = () => {
    if (!cur) return;
    const lines = cur.messages.filter((m) => m.kind !== "system").map((m) => {
      const who = m.mine ? "You" : nameOf(cur);
      const body = m.deleted ? "(deleted)" : m.kind === "text" ? (m.text || "") : m.kind === "image" ? "(image)" : m.kind === "voice" ? `(voice ${fmtDur(m.dur || 0)})` : m.kind === "file" ? `(file: ${m.file?.name})` : "";
      return `[${new Date(m.ts).toLocaleString()}] ${who}: ${body}`;
    });
    const blob = new Blob([`Cipher — chat with ${cur.handle}\nExported ${new Date().toLocaleString()}\n\n${lines.join("\n")}\n`], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `cipher-${nameOf(cur)}.txt`; a.click(); URL.revokeObjectURL(a.href);
    setShowConvoMenu(false);
  };
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
  const pinnedMsgs = cur ? cur.messages.filter((m) => m.pinned && !m.deleted) : [];
  const savedMsgs = useMemo(() => {
    const out: { peer: string; handle: string; m: Msg }[] = [];
    for (const p in convos) for (const m of convos[p].messages) if (m.starred && !m.deleted) out.push({ peer: p, handle: convos[p].handle, m });
    return out.sort((a, b) => b.m.ts - a.m.ts);
  }, [convos]);
  const gq = globalQuery.trim().toLowerCase();
  const visibleConvos = gq
    ? convoList.filter((c) => c.handle.toLowerCase().includes(gq) || (aliases[c.handle] || "").toLowerCase().includes(gq) || c.messages.some((m) => (m.text || "").toLowerCase().includes(gq)))
    : convoList;
  const curDisappear = active ? disappear[active] || 0 : 0;

  /* ================= AUTH ================= */
  if (stage === "auth") {
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5">
        <div className="pointer-events-none absolute inset-0 dotfield" aria-hidden />
        <div className="aurora left-[14%] top-[10%] h-72 w-72" style={{ background: "var(--accent)" }} aria-hidden />
        <div className="aurora right-[10%] bottom-[12%] h-64 w-64" style={{ background: "var(--accent-2)", opacity: 0.2, animationDelay: "-8s" }} aria-hidden />
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
          <Link href="/" className="mono rounded-full border px-3 py-1.5 text-xs text-[var(--fg-2)] backdrop-blur hover:text-[var(--fg)]" style={{ borderColor: "var(--line-2)" }}>← saleh.im</Link>
          <div className="flex items-center gap-2">
            <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }}>◑</button>
            <LangToggle />
          </div>
        </div>
        <div className="panel elev shine glow-border relative w-full max-w-md overflow-hidden p-8">
          <div className="conic-sheen" aria-hidden style={{ opacity: 0.12 }} />
          <div className="relative mb-6 flex items-center gap-3">
            <span className="pulse-ring relative grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "var(--on-accent)", boxShadow: "0 10px 30px -8px var(--glow)" }}>◆</span>
            <div><h1 className="display gradient-text text-3xl">{T.title}</h1><p className="text-xs text-[var(--fg-2)]">{T.tag}</p></div>
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
          <div className="relative mt-6 border-t pt-5" style={{ borderColor: "var(--line)" }}>
            <div className="stagger grid grid-cols-2 gap-2">
              {[
                { ic: "shield", en: "End-to-end encrypted", fa: "رمزنگاریِ سرتاسری" },
                { ic: "screen", en: "No servers, peer-to-peer", fa: "بدون سرور، همتا‌به‌همتا" },
                { ic: "phone", en: "Voice, video & screen", fa: "صوت، ویدیو و صفحه" },
                { ic: "mic", en: "No account, no history", fa: "بدون حساب و تاریخچه" },
              ].map((f) => (
                <div key={f.ic} className="flex items-center gap-2.5 rounded-xl border p-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}><Icon name={f.ic} size={15} /></span>
                  <span className="text-[11px] leading-tight text-[var(--fg-2)]">{fa ? f.fa : f.en}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["ECDH P-256", "AES-256-GCM ×2", "HMAC-SHA256", "WebRTC"].map((c) => (
                <span key={c} className="mono rounded-lg border px-2 py-0.5 text-[10px] force-ltr" style={{ borderColor: "var(--line-2)", color: "var(--accent)" }}>{c}</span>
              ))}
            </div>
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
          <button onClick={() => setSoundOn((s) => !s)} title={T.sound} className="grid h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:text-[var(--accent)]" style={{ borderColor: "var(--line-2)", opacity: soundOn ? 1 : 0.5 }}><Icon name={soundOn ? "bell" : "bellOff"} size={16} /></button>
          <button onClick={requestNotify} title={T.notif} className="hidden h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:text-[var(--accent)] sm:grid" style={{ borderColor: "var(--line-2)", opacity: notify ? 1 : 0.5 }}><Icon name="bell" size={16} /></button>
          <button onClick={toggleMode} className="grid h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:rotate-45 hover:text-[var(--accent)]" style={{ borderColor: "var(--line-2)" }}><Icon name="moon" size={16} /></button>
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
          <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--line)" }}>
            <input value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} placeholder={T.searchAll} className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-1.5 text-sm outline-none" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }} />
            <button onClick={() => setShowSaved(true)} title={T.saved} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border" style={{ borderColor: "var(--line-2)", color: savedMsgs.length ? "var(--accent)" : undefined }}>★</button>
            <button onClick={() => setShowPrivacy(true)} title={T.privacy} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border" style={{ borderColor: "var(--line-2)" }}><Icon name="shield" size={14} /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
            <p className="label px-2 py-2">{T.convos}</p>
            {visibleConvos.length === 0 && <p className="px-3 text-sm text-[var(--fg-2)]">{gq ? T.noResults : T.none}</p>}
            {visibleConvos.map((c) => {
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
                      <b className="truncate text-sm force-ltr">{aliases[c.handle] || c.handle}{mutedPeers[c.peer] ? <span className="ms-1">🔕</span> : null}</b>
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
                <h2 className="font-display gradient-text text-2xl">{T.emptyTitle}</h2>
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
                    <b className="flex items-center gap-1.5 truncate text-sm force-ltr">{aliases[cur.handle] || cur.handle}{mutedPeers[cur.peer] ? <span title={T.mutedTag}>🔕</span> : null}{curVerified && <span title={T.verified} style={{ color: "var(--accent)" }}>✔</span>}</b>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--fg-2)]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: curReady ? "#27c93f" : "#eab308" }} />
                      {curReady ? T.secured : T.connecting}{curLat != null && <span className="mono">· {curLat}{T.ping}</span>}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => startCall("audio")} disabled={!curReady} className="grid h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40" style={{ borderColor: "var(--line-2)" }} title={T.voiceCall}><Icon name="phone" size={16} /></button>
                  <button onClick={() => startCall("video")} disabled={!curReady} className="grid h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40" style={{ borderColor: "var(--line-2)" }} title={T.videoCall}><Icon name="video" size={16} /></button>
                  <button onClick={() => startCall("screen")} disabled={!curReady} className="hidden h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 sm:grid" style={{ borderColor: "var(--line-2)" }} title={T.screen}><Icon name="screen" size={16} /></button>
                  <button onClick={() => { setSearchOpen((s) => !s); setQuery(""); }} className="grid h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:border-[var(--accent)] hover:text-[var(--accent)]" style={{ borderColor: "var(--line-2)" }} title="search"><Icon name="search" size={16} /></button>
                  {curFp && <button onClick={() => setShowSafety((s) => !s)} className="grid h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:text-[var(--accent)]" style={{ borderColor: curVerified ? "var(--accent)" : "var(--line-2)", color: curVerified ? "var(--accent)" : undefined }} title={T.safety}><Icon name="shield" size={16} /></button>}
                  <div className="relative">
                    <button onClick={() => setShowConvoMenu((s) => !s)} className="grid h-9 w-9 place-items-center rounded-full border transition-all hover:scale-110 hover:text-[var(--accent)]" style={{ borderColor: showConvoMenu ? "var(--accent)" : "var(--line-2)" }} title={T.menu}>⋯</button>
                    {showConvoMenu && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setShowConvoMenu(false)} />
                        <div className="absolute end-0 z-30 mt-1 w-60 rounded-2xl border p-1.5 text-sm shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)", boxShadow: "0 24px 48px -20px var(--shadow)" }}>
                          <button onClick={renameContact} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start hover:bg-[var(--bg-3)]"><Icon name="edit" size={14} /> {T.rename}</button>
                          <button onClick={toggleMuteChat} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start hover:bg-[var(--bg-3)]"><Icon name={mutedPeers[cur.peer] ? "bell" : "bellOff"} size={14} /> {mutedPeers[cur.peer] ? T.unmuteChat : T.muteChat}</button>
                          <button onClick={exportChat} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start hover:bg-[var(--bg-3)]"><Icon name="down" size={14} /> {T.exportChat}</button>
                          <button onClick={() => { setShowSaved(true); setShowConvoMenu(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start hover:bg-[var(--bg-3)]">★ {T.saved}</button>
                          <button onClick={clearConvo} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[#ff6a6a] hover:bg-[var(--bg-3)]"><Icon name="trash" size={14} /> {T.clear}</button>
                          <div className="mt-1 border-t px-3 pb-1 pt-2" style={{ borderColor: "var(--line)" }}>
                            <div className="label mb-1.5">⏱ {T.disappearing}</div>
                            <div className="flex flex-wrap gap-1">
                              {[[0, T.off], [30, `30${T.secs}`], [300, `5${T.mins}`], [3600, `60${T.mins}`]].map(([s, lab]) => (
                                <button key={s as number} onClick={() => setDisappearFor(s as number)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: curDisappear === s ? "var(--accent)" : "var(--line-2)", color: curDisappear === s ? "var(--accent)" : "var(--fg-2)" }}>{lab}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
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

              {pinnedMsgs.length > 0 && (
                <div className="flex items-center gap-2 border-b px-4 py-1.5 text-xs" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                  <span style={{ color: "var(--accent)" }}>📌</span>
                  <button onClick={() => jumpTo(pinnedMsgs[pinnedMsgs.length - 1].id)} className="min-w-0 flex-1 truncate text-start text-[var(--fg-2)] hover:text-[var(--fg)]">
                    {(pinnedMsgs[pinnedMsgs.length - 1].text || (pinnedMsgs[pinnedMsgs.length - 1].kind === "image" ? "🖼️" : pinnedMsgs[pinnedMsgs.length - 1].kind === "voice" ? "🎙️" : "📎")).slice(0, 80)}
                  </button>
                  <span className="mono shrink-0 text-[10px] text-[var(--fg-2)]">{pinnedMsgs.length} {T.pinned}</span>
                </div>
              )}
              {curDisappear > 0 && (
                <div className="border-b px-4 py-1 text-center text-[11px]" style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-2))", color: "var(--accent)" }}>
                  ⏱ {T.disappearing}: {curDisappear >= 60 ? `${curDisappear / 60}${T.mins}` : `${curDisappear}${T.secs}`}
                </div>
              )}

              {/* messages */}
              <div
                ref={scrollRef}
                onScroll={onScroll}
                onDragOver={(e) => { if (curReady) { e.preventDefault(); setDragOver(true); } }}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (curReady) onDropFiles(e.dataTransfer?.files || null); }}
                className="relative min-h-0 flex-1 space-y-1 overflow-y-auto p-4 thin-scroll"
                style={{ background: "var(--bg)" }}
              >
                {dragOver && (
                  <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border-2 border-dashed" style={{ borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
                    <span className="font-display text-lg" style={{ color: "var(--accent)" }}>⬇ {T.dropHere}</span>
                  </div>
                )}
                {shown.map((m, i) => {
                  const prev = shown[i - 1];
                  const showDay = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString();
                  if (m.kind === "system")
                    return (<div key={m.id}>{showDay && <DayDivider label={dayLabel(m.ts)} />}<p className="py-1 text-center text-xs text-[var(--fg-2)]">{m.text}</p></div>);
                  const reactions = m.reactions ? Object.entries(m.reactions) : [];
                  return (
                    <div key={m.id}>
                      {showDay && <DayDivider label={dayLabel(m.ts)} />}
                      <div className={`msg-row group flex items-end gap-1.5 ${m.mine ? "flex-row-reverse" : ""}`}>
                        <div id={`msg-${m.id}`} className="relative max-w-[80%] transition-all duration-300 hover:-translate-y-0.5" style={highlightId === m.id ? { boxShadow: "0 0 0 2px var(--accent)", borderRadius: 18 } : undefined}>
                          <div className="msg-bubble rounded-2xl px-3.5 py-2 leading-relaxed" style={{ fontSize: `${(14.5 * privacy.fontScale).toFixed(1)}px`, ...(m.mine ? { background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 78%, var(--accent-2)))", color: "var(--on-accent)", borderEndEndRadius: 5, boxShadow: "0 6px 18px -10px var(--glow)" } : { background: "var(--bg-3)", borderEndStartRadius: 5, boxShadow: "0 4px 14px -10px var(--shadow)" }) }}>
                            {m.fwd && !m.deleted && <div className="mb-1 flex items-center gap-1 text-[10px] italic" style={{ opacity: 0.7 }}>⤳ {T.forwarded}</div>}
                            {m.reply && <button onClick={() => m.reply && jumpTo(m.reply.id)} className="mb-1.5 block w-full rounded-lg border-s-2 px-2 py-1 text-start text-xs opacity-80 transition-opacity hover:opacity-100" style={{ borderColor: m.mine ? "rgba(0,0,0,0.35)" : "var(--accent)", background: m.mine ? "rgba(0,0,0,0.08)" : "var(--bg-2)" }}>{m.reply.preview}</button>}
                            {m.deleted ? (
                              <span className="flex items-center gap-1.5 italic opacity-70"><Icon name="trash" size={13} /> {T.msgDeleted}</span>
                            ) : m.kind === "image" ? (
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
                              {m.pinned && <span title={T.pinned}>📌</span>}
                              {m.starred && <span style={{ color: "var(--accent)" }}>★</span>}
                              {m.edited && <span className="italic">{T.edited}</span>}
                              <span className="mono force-ltr">{time(m.ts)}</span>
                              {m.mine && <span title={m.status === "pending" ? T.queued : undefined}>{m.status === "pending" ? "🕓" : m.status === "seen" ? "✓✓" : "✓"}</span>}
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
                        <div className="flex shrink-0 flex-wrap gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => setReactFor(reactFor === m.id ? null : m.id)} className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 hover:text-[var(--accent)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.react}><Icon name="smile" size={12} /></button>
                          <button onClick={() => setReplyTo(m)} className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 hover:text-[var(--accent)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.reply}><Icon name="reply" size={12} /></button>
                          {!m.deleted && <button onClick={() => setForwarding(m)} className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 hover:text-[var(--accent)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.forward}>⤳</button>}
                          {!m.deleted && <button onClick={() => toggleStar(m)} className="grid h-6 w-6 place-items-center rounded-full text-[11px] transition-transform hover:scale-110 hover:text-[var(--accent)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: m.starred ? "var(--accent)" : undefined }} title={T.star}>★</button>}
                          {!m.deleted && <button onClick={() => togglePin(m)} className="grid h-6 w-6 place-items-center rounded-full text-[11px] transition-transform hover:scale-110 hover:text-[var(--accent)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: m.pinned ? "var(--accent)" : undefined }} title={m.pinned ? T.unpin : T.pin}>📌</button>}
                          {m.kind === "text" && <button onClick={() => copyMsgText(m)} className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 hover:text-[var(--accent)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.copyText}><Icon name={copied === "m-" + m.id ? "check" : "copy"} size={12} /></button>}
                          {m.mine && m.kind === "text" && !m.deleted && <button onClick={() => startEdit(m)} className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 hover:text-[var(--accent)]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.edit}><Icon name="edit" size={12} /></button>}
                          {m.mine && !m.deleted && <button onClick={() => deleteForEveryone(m)} className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 hover:text-[#ff6a6a]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.deleteEveryone}><Icon name="trash" size={12} /></button>}
                          <button onClick={() => deleteMsg(m)} className="grid h-6 w-6 place-items-center rounded-full transition-transform hover:scale-110 hover:text-[#ff6a6a]" style={{ background: "var(--bg-2)", border: "1px solid var(--line)" }} title={T.del}><Icon name="x" size={12} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {cur.typing && (
                  <div className="flex justify-start"><div className="flex gap-1 rounded-2xl px-4 py-3" style={{ background: "var(--bg-3)" }}>{[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--fg-2)", animation: `td 1s ${d * 0.15}s infinite` }} />)}</div></div>
                )}
              </div>

              {!atBottom && <button onClick={() => { setAtBottom(true); scrollToBottom(true); }} className="absolute bottom-24 z-10 grid h-10 w-10 animate-[msgIn_.3s_ease] place-items-center rounded-full border shadow-lg transition-transform hover:scale-110 hover:border-[var(--accent)]" style={{ insetInlineEnd: "1.25rem", background: "var(--bg-2)", borderColor: "var(--line-2)" }}><Icon name="down" size={18} /></button>}

              {/* composer */}
              <div className="border-t p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                {replyTo && !editing && (
                  <div className="mb-2 flex items-center justify-between rounded-lg border-s-2 px-3 py-1.5 text-xs" style={{ borderColor: "var(--accent)", background: "var(--bg-3)" }}>
                    <span className="truncate"><span className="text-[var(--fg-2)]">{T.replyingTo}: </span>{(replyTo.text || "🎙️").slice(0, 60)}</span>
                    <button onClick={() => setReplyTo(null)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button>
                  </div>
                )}
                {editing && (
                  <div className="mb-2 flex items-center justify-between rounded-lg border-s-2 px-3 py-1.5 text-xs" style={{ borderColor: "var(--accent)", background: "var(--bg-3)" }}>
                    <span className="truncate"><span className="text-[var(--fg-2)]">✎ {T.editing}: </span>{(editing.text || "").slice(0, 60)}</span>
                    <button onClick={cancelEdit} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button>
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
                  <div className="relative flex items-end gap-2">
                    {showEmoji && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowEmoji(false)} />
                        <div className="absolute bottom-full z-20 mb-2 grid max-h-52 w-[19rem] grid-cols-8 gap-1 overflow-y-auto rounded-2xl border p-2 thin-scroll" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)", insetInlineStart: 0, boxShadow: "0 24px 48px -20px var(--shadow)" }}>
                          {EMOJI_PICKER.map((e, i) => <button key={e + i} onClick={() => insertEmoji(e)} className="rounded-lg p-1 text-lg transition-transform hover:scale-125 hover:bg-[var(--bg-3)]">{e}</button>)}
                        </div>
                      </>
                    )}
                    <button onClick={() => fileRef.current?.click()} disabled={attaching} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-all hover:scale-105 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50" style={{ borderColor: "var(--line-2)" }} title={T.file}>{attaching ? <span className="animate-pulse">…</span> : <Icon name="clip" size={18} />}</button>
                    <button onClick={() => setShowEmoji((s) => !s)} className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl border transition-all hover:scale-105 hover:border-[var(--accent)] hover:text-[var(--accent)] sm:grid" style={{ borderColor: "var(--line-2)", color: showEmoji ? "var(--accent)" : undefined }} title={T.emoji}><Icon name="smile" size={18} /></button>
                    <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) (f.type.startsWith("image/") ? sendImage(f) : sendFile(f)); e.currentTarget.value = ""; }} />
                    <textarea ref={textareaRef} value={input} onChange={(e) => { setInput(e.target.value); if (!editing && curReady) onType(); }} onPaste={(e) => { const f = e.clipboardData?.files?.[0]; if (f && f.type.startsWith("image/")) { e.preventDefault(); sendImage(f); } }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } else if (e.key === "Escape" && editing) cancelEdit(); }} rows={1} placeholder={editing ? `${T.editing}…` : curReady ? T.typeMsg : T.sentWhenOnline} className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border px-4 py-2.5 text-[var(--fg)] outline-none" style={{ background: "var(--bg-3)", borderColor: editing ? "var(--accent)" : "var(--line)" }} />
                    {input.trim() ? (
                      <button onClick={sendText} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: "var(--accent)", color: "var(--on-accent)" }} title={editing ? T.save : undefined}>
                        {editing ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                        )}
                      </button>
                    ) : (
                      <button onClick={startRec} disabled={!curReady} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-all hover:scale-105 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40" style={{ borderColor: "var(--line-2)" }} title={T.holdRec}><Icon name="mic" size={18} /></button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* FORWARD PICKER */}
      {forwarding && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", backdropFilter: "blur(4px)" }} onClick={() => setForwarding(null)}>
          <div className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-2xl border p-4 shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-display text-lg">{T.forwardTo}</h3><button onClick={() => setForwarding(null)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button></div>
            <p className="mb-2 truncate rounded-lg border-s-2 px-2 py-1 text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--accent)", background: "var(--bg-3)" }}>{(forwarding.text || (forwarding.kind === "image" ? "🖼️" : forwarding.kind === "voice" ? "🎙️" : "📎")).slice(0, 80)}</p>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto thin-scroll">
              {convoList.length === 0 && <p className="px-2 py-4 text-center text-sm text-[var(--fg-2)]">{T.none}</p>}
              {convoList.map((c) => (
                <button key={c.peer} onClick={() => forwardTo(c.peer)} className="flex w-full items-center gap-3 rounded-xl p-2 text-start hover:bg-[var(--bg-3)]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-display uppercase" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}>{nameOf(c).charAt(0)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm force-ltr">{aliases[c.handle] || c.handle}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SAVED MESSAGES */}
      {showSaved && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", backdropFilter: "blur(4px)" }} onClick={() => setShowSaved(false)}>
          <div className="flex max-h-[75vh] w-full max-w-md flex-col rounded-2xl border p-4 shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-lg">★ {T.saved}</h3><button onClick={() => setShowSaved(false)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button></div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto thin-scroll">
              {savedMsgs.length === 0 ? <p className="py-8 text-center text-sm text-[var(--fg-2)]">{T.noSaved}</p> : savedMsgs.map(({ peer, handle, m }) => (
                <div key={m.id} className="rounded-xl border p-2.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--fg-2)]">
                    <span className="truncate force-ltr">{aliases[handle] || handle}</span>
                    <span className="mono shrink-0">{new Intl.DateTimeFormat(fa ? "fa-IR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(m.ts))}</span>
                  </div>
                  <div className="text-sm">{m.kind === "text" ? <Linkify text={m.text || ""} /> : m.kind === "image" ? "🖼️ image" : m.kind === "voice" ? "🎙️ voice" : "📎 " + (m.file?.name || "file")}</div>
                  <div className="mt-1.5 flex gap-2">
                    <button onClick={() => { openConvo(peer); setShowSaved(false); setTimeout(() => jumpTo(m.id), 200); }} className="text-xs" style={{ color: "var(--accent)" }}>{T.jump}</button>
                    <button onClick={() => toggleStar(m, peer)} className="text-xs text-[var(--fg-2)] hover:text-[var(--fg)]">★ {T.star}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", backdropFilter: "blur(4px)" }} onClick={() => setShowPrivacy(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl border p-5 shadow-2xl" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-display text-lg">{T.privacy}</h3><button onClick={() => setShowPrivacy(false)} className="text-[var(--fg-2)] hover:text-[var(--fg)]">✕</button></div>
            <label className="flex items-center justify-between text-sm"><span>{T.readReceipts}</span><input type="checkbox" checked={privacy.readReceipts} onChange={(e) => setPrivacy((p) => ({ ...p, readReceipts: e.target.checked }))} className="h-4 w-4" /></label>
            <label className="flex items-center justify-between text-sm"><span>{T.typingInd}</span><input type="checkbox" checked={privacy.typingIndicator} onChange={(e) => setPrivacy((p) => ({ ...p, typingIndicator: e.target.checked }))} className="h-4 w-4" /></label>
            <div>
              <div className="mb-1.5 flex justify-between text-sm"><span>{T.textSize}</span><span className="mono text-[var(--fg-2)]">{Math.round(privacy.fontScale * 100)}%</span></div>
              <input type="range" min={0.85} max={1.4} step={0.05} value={privacy.fontScale} onChange={(e) => setPrivacy((p) => ({ ...p, fontScale: +e.target.value }))} className="w-full" />
            </div>
          </div>
        </div>
      )}

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
        @keyframes msgIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
        .msg-row { animation: msgIn .32s cubic-bezier(.22,1,.36,1) both; }
        .msg-bubble { transition: box-shadow .3s ease; }
        @media (prefers-reduced-motion: reduce) { .msg-row { animation: none; } }
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

/* Crisp, consistent line-icon set (replaces emoji chrome for a pro feel). */
const ICON_PATHS: Record<string, string> = {
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
  video: "M23 7l-7 5 7 5V7zM1 5h15v14H1z",
  screen: "M2 3h20v14H2zM8 21h8M12 17v4",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  clip: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
  mic: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8",
  smile: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  bellOff: "M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.9 17.9 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5M1 1l22 22",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  back: "M19 12H5M12 19l-7-7 7-7",
  close: "M18 6 6 18M6 6l12 12",
  reply: "M9 17l-6-5 6-5M3 12h10a6 6 0 0 1 6 6v2",
  copy: "M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-2M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  x: "M18 6 6 18M6 6l12 12",
  down: "M12 5v14M19 12l-7 7-7-7",
  send: "m22 2-7 20-4-9-9-4Z M22 2 11 13",
  check: "M20 6 9 17l-5-5",
};
function Icon({ name, size = 18, stroke = 2 }: { name: string; size?: number; stroke?: number }) {
  const d = ICON_PATHS[name] || "";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split(" M").map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : "M" + seg)} />
      ))}
    </svg>
  );
}
