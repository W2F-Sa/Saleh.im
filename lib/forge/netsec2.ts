/* ============================================================================
   Forge — extended network & security engine (50-tool pack).

   Pure, dependency-free, browser-only helpers. Everything runs locally; the
   security tools are educational and never touch a network or a real target.
   ========================================================================== */

/* ------------------------------------------------------------------ */
/* IPv4                                                               */
/* ------------------------------------------------------------------ */

export function isValidIpv4(ip: string): boolean {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((o) => +o >= 0 && +o <= 255);
}

export function ipToInt(ip: string): number {
  if (!isValidIpv4(ip)) throw new Error(`Invalid IPv4 address: ${ip}`);
  return ip.trim().split(".").reduce((acc, o) => (acc << 8) + (+o), 0) >>> 0;
}

export function intToIp(n: number): string {
  n = n >>> 0;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function ipToBinary(ip: string): string {
  return ip.split(".").map((o) => (+o).toString(2).padStart(8, "0")).join(".");
}

export function maskFromPrefix(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export function prefixFromMask(mask: string): number | null {
  if (!isValidIpv4(mask)) return null;
  const n = ipToInt(mask);
  // must be a run of 1s followed by 0s
  const inv = (~n) >>> 0;
  if (((inv + 1) & inv) !== 0 && n !== 0xffffffff) return null;
  let count = 0, x = n;
  while (x & 0x80000000) { count++; x = (x << 1) >>> 0; }
  return count;
}

export function ipClass(ip: string): string {
  const first = +ip.split(".")[0];
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D (multicast)";
  return "E (reserved)";
}

export function ipv4Scope(ip: string): string {
  const n = ipToInt(ip);
  const inR = (a: string, b: string) => n >= ipToInt(a) && n <= ipToInt(b);
  if (inR("10.0.0.0", "10.255.255.255") || inR("172.16.0.0", "172.31.255.255") || inR("192.168.0.0", "192.168.255.255")) return "Private (RFC 1918)";
  if (inR("127.0.0.0", "127.255.255.255")) return "Loopback";
  if (inR("169.254.0.0", "169.254.255.255")) return "Link-local (APIPA)";
  if (inR("100.64.0.0", "100.127.255.255")) return "CGNAT (RFC 6598)";
  if (inR("224.0.0.0", "239.255.255.255")) return "Multicast";
  if (n === 0xffffffff) return "Limited broadcast";
  return "Public";
}

export type SubnetInfo = {
  cidr: string; prefix: number; mask: string; wildcard: string;
  network: string; broadcast: string; firstHost: string; lastHost: string;
  totalAddresses: number; usableHosts: number; ipClass: string; scope: string;
  binaryMask: string; binaryNetwork: string;
};

export function subnetV4(input: string): SubnetInfo {
  let ip: string, prefix: number;
  const s = input.trim();
  if (s.includes("/")) {
    const [a, p] = s.split("/");
    ip = a.trim();
    prefix = +p;
  } else if (s.includes(" ")) {
    const [a, m] = s.split(/\s+/);
    ip = a; const pf = prefixFromMask(m);
    if (pf === null) throw new Error("Invalid subnet mask.");
    prefix = pf;
  } else {
    ip = s; prefix = 32;
  }
  if (!isValidIpv4(ip)) throw new Error(`Invalid IPv4 address: ${ip}`);
  if (!(prefix >= 0 && prefix <= 32)) throw new Error("Prefix must be between /0 and /32.");

  const maskInt = maskFromPrefix(prefix);
  const ipInt = ipToInt(ip);
  const netInt = (ipInt & maskInt) >>> 0;
  const bcastInt = (netInt | (~maskInt >>> 0)) >>> 0;
  const total = prefix >= 31 ? 2 ** (32 - prefix) : 2 ** (32 - prefix);
  const usable = prefix >= 31 ? (prefix === 32 ? 1 : 2) : total - 2;
  const first = prefix >= 31 ? netInt : (netInt + 1) >>> 0;
  const last = prefix >= 31 ? bcastInt : (bcastInt - 1) >>> 0;

  return {
    cidr: `${intToIp(netInt)}/${prefix}`,
    prefix,
    mask: intToIp(maskInt),
    wildcard: intToIp((~maskInt) >>> 0),
    network: intToIp(netInt),
    broadcast: intToIp(bcastInt),
    firstHost: intToIp(first),
    lastHost: intToIp(last),
    totalAddresses: total,
    usableHosts: usable,
    ipClass: ipClass(ip),
    scope: ipv4Scope(ip),
    binaryMask: ipToBinary(intToIp(maskInt)),
    binaryNetwork: ipToBinary(intToIp(netInt)),
  };
}

export function splitSubnet(cidr: string, newPrefix: number): { cidr: string; network: string; broadcast: string; firstHost: string; lastHost: string }[] {
  const base = subnetV4(cidr);
  if (newPrefix < base.prefix) throw new Error("New prefix must be longer than the base prefix.");
  if (newPrefix > 32) throw new Error("Prefix cannot exceed /32.");
  const count = 2 ** (newPrefix - base.prefix);
  if (count > 1024) throw new Error("That would create more than 1024 subnets — narrow it down.");
  const step = 2 ** (32 - newPrefix);
  const start = ipToInt(base.network);
  const out = [];
  for (let i = 0; i < count; i++) {
    const net = (start + i * step) >>> 0;
    const bc = (net + step - 1) >>> 0;
    out.push({
      cidr: `${intToIp(net)}/${newPrefix}`,
      network: intToIp(net),
      broadcast: intToIp(bc),
      firstHost: newPrefix >= 31 ? intToIp(net) : intToIp((net + 1) >>> 0),
      lastHost: newPrefix >= 31 ? intToIp(bc) : intToIp((bc - 1) >>> 0),
    });
  }
  return out;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const info = subnetV4(cidr);
  const n = ipToInt(ip);
  return n >= ipToInt(info.network) && n <= ipToInt(info.broadcast);
}

export function summarizeCidrs(cidrs: string[]): string[] {
  // turn each into [start,end], merge, then emit aligned CIDR blocks
  const ranges = cidrs.map((c) => {
    const s = subnetV4(c);
    return [ipToInt(s.network), ipToInt(s.broadcast)] as [number, number];
  }).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const out: string[] = [];
  for (let [start, end] of merged) {
    while (start <= end) {
      let maxSize = 32;
      while (maxSize > 0) {
        const mask = maskFromPrefix(maxSize - 1);
        if ((start & mask) >>> 0 !== start) break;
        maxSize--;
      }
      let sizeByRange = 32 - Math.floor(Math.log2(end - start + 1));
      const prefix = Math.max(maxSize, sizeByRange);
      out.push(`${intToIp(start)}/${prefix}`);
      start = (start + 2 ** (32 - prefix)) >>> 0;
      if (start === 0) break; // wrapped
    }
  }
  return out;
}

export const MASK_TABLE = Array.from({ length: 33 }, (_, p) => ({
  prefix: p,
  mask: intToIp(maskFromPrefix(p)),
  wildcard: intToIp((~maskFromPrefix(p)) >>> 0),
  hosts: p >= 31 ? (p === 32 ? 1 : 2) : Math.max(0, 2 ** (32 - p) - 2),
  addresses: 2 ** (32 - p),
}));

export function reverseDnsV4(ip: string): string {
  if (!isValidIpv4(ip)) throw new Error("Invalid IPv4 address.");
  return ip.split(".").reverse().join(".") + ".in-addr.arpa";
}

/* ------------------------------------------------------------------ */
/* IPv6                                                               */
/* ------------------------------------------------------------------ */

export function expandIpv6(addr: string): string {
  let a = addr.trim().toLowerCase();
  a = a.replace(/^\[|\]$/g, "").split("%")[0].split("/")[0];
  if (!a.includes(":")) throw new Error("Not an IPv6 address.");
  let head: string[] = [], tail: string[] = [];
  if (a.includes("::")) {
    const [h, t] = a.split("::");
    head = h ? h.split(":") : [];
    tail = t ? t.split(":") : [];
  } else {
    head = a.split(":");
  }
  const missing = 8 - head.length - tail.length;
  if (missing < 0) throw new Error("Too many hextets.");
  const groups = [...head, ...Array(missing).fill("0"), ...tail];
  if (groups.length !== 8) throw new Error("Malformed IPv6 address.");
  return groups.map((g) => {
    if (!/^[0-9a-f]{1,4}$/.test(g)) throw new Error(`Invalid hextet: ${g}`);
    return g.padStart(4, "0");
  }).join(":");
}

export function compressIpv6(addr: string): string {
  const full = expandIpv6(addr);
  const groups = full.split(":").map((g) => g.replace(/^0+/, "") || "0");
  // find longest run of "0"
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  groups.forEach((g, i) => {
    if (g === "0") {
      if (curStart < 0) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else { curStart = -1; curLen = 0; }
  });
  if (bestLen < 2) return groups.join(":");
  const before = groups.slice(0, bestStart).join(":");
  const after = groups.slice(bestStart + bestLen).join(":");
  return `${before}::${after}`;
}

export function ipv6Info(cidr: string): { full: string; compressed: string; prefix: number; network: string; addresses: string; type: string } {
  const [addrPart, prefixPart] = cidr.includes("/") ? cidr.split("/") : [cidr, "128"];
  const prefix = +prefixPart;
  if (!(prefix >= 0 && prefix <= 128)) throw new Error("Prefix must be /0–/128.");
  const full = expandIpv6(addrPart);
  const hex = full.replace(/:/g, "");
  let bits = "";
  for (const ch of hex) bits += parseInt(ch, 16).toString(2).padStart(4, "0");
  const netBits = bits.slice(0, prefix).padEnd(128, "0");
  let netHex = "";
  for (let i = 0; i < 128; i += 4) netHex += parseInt(netBits.slice(i, i + 4), 16).toString(16);
  const netGroups = netHex.match(/.{4}/g)!.join(":");
  const first = +full.split(":")[0].slice(0, 2);
  let type = "Global unicast";
  const p2 = full.slice(0, 2);
  if (full.startsWith("fe80")) type = "Link-local";
  else if (p2 === "fc" || p2 === "fd") type = "Unique local (ULA)";
  else if (full.startsWith("ff")) type = "Multicast";
  else if (full === "0000:0000:0000:0000:0000:0000:0000:0001") type = "Loopback (::1)";
  return {
    full,
    compressed: compressIpv6(addrPart),
    prefix,
    network: compressIpv6(netGroups),
    addresses: `2^${128 - prefix}`,
    type,
  };
}

export function reverseDnsV6(addr: string): string {
  const hex = expandIpv6(addr).replace(/:/g, "");
  return hex.split("").reverse().join(".") + ".ip6.arpa";
}

/* ------------------------------------------------------------------ */
/* MAC                                                                */
/* ------------------------------------------------------------------ */

export function normalizeMac(mac: string): string | null {
  const hex = mac.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)!.join(":");
}

export function macInfo(mac: string): { normalized: string; oui: string; nic: string; unicast: boolean; universal: boolean; note: string } {
  const n = normalizeMac(mac);
  if (!n) throw new Error("A MAC address needs 12 hex digits.");
  const bytes = n.split(":").map((h) => parseInt(h, 16));
  const unicast = (bytes[0] & 1) === 0;
  const universal = (bytes[0] & 2) === 0;
  return {
    normalized: n.toUpperCase(),
    oui: n.slice(0, 8).toUpperCase(),
    nic: n.slice(9).toUpperCase(),
    unicast,
    universal,
    note: `${unicast ? "Unicast" : "Multicast/broadcast"} · ${universal ? "Universally (OUI) administered" : "Locally administered"}`,
  };
}

export function macToEui64(mac: string): string {
  const n = normalizeMac(mac);
  if (!n) throw new Error("Invalid MAC.");
  const b = n.split(":");
  const first = parseInt(b[0], 16) ^ 0x02; // flip the U/L bit
  const eui = [first.toString(16).padStart(2, "0"), b[1], b[2], "ff", "fe", b[3], b[4], b[5]];
  const groups = eui.join("").match(/.{4}/g)!.join(":");
  return groups;
}

export function macToLinkLocal(mac: string): string {
  return compressIpv6("fe80::" + macToEui64(mac));
}

/* ------------------------------------------------------------------ */
/* Transport / protocol helpers                                       */
/* ------------------------------------------------------------------ */

export const TCP_FLAGS: { bit: number; name: string; desc: string }[] = [
  { bit: 0x001, name: "FIN", desc: "No more data — begin closing the connection." },
  { bit: 0x002, name: "SYN", desc: "Synchronise sequence numbers — starts a handshake." },
  { bit: 0x004, name: "RST", desc: "Reset — abruptly tear the connection down." },
  { bit: 0x008, name: "PSH", desc: "Push buffered data to the application now." },
  { bit: 0x010, name: "ACK", desc: "Acknowledgement field is significant." },
  { bit: 0x020, name: "URG", desc: "Urgent pointer field is significant." },
  { bit: 0x040, name: "ECE", desc: "ECN-Echo — congestion experienced." },
  { bit: 0x080, name: "CWR", desc: "Congestion Window Reduced." },
  { bit: 0x100, name: "NS", desc: "ECN nonce concealment protection." },
];

export function decodeTcpFlags(value: number): { name: string; set: boolean; desc: string }[] {
  return TCP_FLAGS.map((f) => ({ name: f.name, set: (value & f.bit) !== 0, desc: f.desc }));
}

export const DSCP_MAP: Record<number, string> = {
  0: "CS0 / Default (best effort)", 8: "CS1 (scavenger)", 10: "AF11", 12: "AF12", 14: "AF13",
  16: "CS2", 18: "AF21", 20: "AF22", 22: "AF23", 24: "CS3", 26: "AF31", 28: "AF32", 30: "AF33",
  32: "CS4", 34: "AF41", 36: "AF42", 38: "AF43", 40: "CS5", 46: "EF (Expedited Forwarding — voice)",
  48: "CS6 (network control)", 56: "CS7",
};

export function decodeTos(byte: number): { dscp: number; dscpName: string; ecn: number; ecnName: string } {
  const dscp = (byte >> 2) & 0x3f;
  const ecn = byte & 0x03;
  const ecnNames = ["Not-ECT", "ECT(1)", "ECT(0)", "CE (congestion)"];
  return { dscp, dscpName: DSCP_MAP[dscp] || `DSCP ${dscp}`, ecn, ecnName: ecnNames[ecn] };
}

export const HTTP_STATUS: Record<number, { name: string; note: string }> = {
  100: { name: "Continue", note: "Keep sending the request body." },
  101: { name: "Switching Protocols", note: "Upgrading, e.g. to WebSocket." },
  200: { name: "OK", note: "Standard success." },
  201: { name: "Created", note: "A new resource was created." },
  204: { name: "No Content", note: "Success, empty body." },
  206: { name: "Partial Content", note: "Range request satisfied." },
  301: { name: "Moved Permanently", note: "Resource has a new permanent URL." },
  302: { name: "Found", note: "Temporary redirect." },
  304: { name: "Not Modified", note: "Cached copy is still valid." },
  307: { name: "Temporary Redirect", note: "Redirect, keep the method." },
  308: { name: "Permanent Redirect", note: "Permanent, keep the method." },
  400: { name: "Bad Request", note: "Malformed request." },
  401: { name: "Unauthorized", note: "Authentication required/failed." },
  403: { name: "Forbidden", note: "Authenticated but not allowed." },
  404: { name: "Not Found", note: "No such resource." },
  405: { name: "Method Not Allowed", note: "Verb not supported here." },
  409: { name: "Conflict", note: "State conflict, e.g. version." },
  418: { name: "I'm a teapot", note: "RFC 2324 joke status." },
  422: { name: "Unprocessable Entity", note: "Validation failed." },
  429: { name: "Too Many Requests", note: "Rate limited." },
  500: { name: "Internal Server Error", note: "Unhandled server fault." },
  502: { name: "Bad Gateway", note: "Upstream returned garbage." },
  503: { name: "Service Unavailable", note: "Overloaded or down for maintenance." },
  504: { name: "Gateway Timeout", note: "Upstream took too long." },
};

/* transfer-time + bandwidth-delay product */
export function transferTime(bytes: number, bitsPerSecond: number): string {
  if (bitsPerSecond <= 0) return "—";
  const secs = (bytes * 8) / bitsPerSecond;
  if (secs < 1) return `${(secs * 1000).toFixed(0)} ms`;
  if (secs < 60) return `${secs.toFixed(2)} s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${(secs % 60).toFixed(0)}s`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

export function bdp(mbps: number, rttMs: number): { bytes: number; kib: string; note: string } {
  const bytes = (mbps * 1e6 * (rttMs / 1000)) / 8;
  return {
    bytes: Math.round(bytes),
    kib: (bytes / 1024).toFixed(1),
    note: bytes > 65535 ? "Exceeds the 64 KiB TCP window — you need window scaling (RFC 1323)." : "Fits inside a standard 64 KiB TCP window.",
  };
}

/* ------------------------------------------------------------------ */
/* SECURITY                                                           */
/* ------------------------------------------------------------------ */

export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq: Record<string, number> = {};
  for (const ch of s) freq[ch] = (freq[ch] || 0) + 1;
  let h = 0;
  for (const k in freq) {
    const p = freq[k] / s.length;
    h -= p * Math.log2(p);
  }
  return h; // bits per symbol
}

export function passwordEntropyBits(pw: string): { poolSize: number; bits: number; verdict: string } {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const bits = pw.length * Math.log2(pool || 1);
  const verdict = bits < 28 ? "Very weak" : bits < 36 ? "Weak" : bits < 60 ? "Reasonable" : bits < 128 ? "Strong" : "Overkill";
  return { poolSize: pool, bits: Math.round(bits), verdict };
}

export function identifyHash(input: string): string[] {
  const h = input.trim();
  const guesses: string[] = [];
  if (/^[a-f0-9]{32}$/i.test(h)) guesses.push("MD5", "NTLM", "MD4");
  if (/^[a-f0-9]{40}$/i.test(h)) guesses.push("SHA-1", "RIPEMD-160");
  if (/^[a-f0-9]{56}$/i.test(h)) guesses.push("SHA-224");
  if (/^[a-f0-9]{64}$/i.test(h)) guesses.push("SHA-256", "SHA3-256", "BLAKE2s");
  if (/^[a-f0-9]{96}$/i.test(h)) guesses.push("SHA-384");
  if (/^[a-f0-9]{128}$/i.test(h)) guesses.push("SHA-512", "SHA3-512", "BLAKE2b");
  if (/^\$2[aby]\$\d{2}\$/.test(h)) guesses.push("bcrypt");
  if (/^\$argon2(id|i|d)\$/.test(h)) guesses.push("Argon2");
  if (/^\$6\$/.test(h)) guesses.push("sha512crypt");
  if (/^\$5\$/.test(h)) guesses.push("sha256crypt");
  if (/^\$1\$/.test(h)) guesses.push("md5crypt");
  if (/^[a-f0-9]{16}$/i.test(h)) guesses.push("MySQL(old) / CRC");
  return guesses.length ? guesses : ["Unrecognised — not a standard hex hash length."];
}

export const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "GitHub Token", re: /\bghp_[A-Za-z0-9]{36}\b/g },
  { name: "Google API Key", re: /\bAIza[0-9A-Za-z_\-]{35}\b/g },
  { name: "Slack Token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
  { name: "Stripe Secret Key", re: /\bsk_(live|test)_[0-9A-Za-z]{16,}\b/g },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { name: "Private Key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: "Bearer token", re: /\bBearer\s+[A-Za-z0-9._\-]{16,}\b/g },
  { name: "Hex secret (32B+)", re: /\b[a-f0-9]{64,}\b/gi },
];

export function scanSecrets(text: string): { name: string; match: string; line: number }[] {
  const out: { name: string; match: string; line: number }[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const p of SECRET_PATTERNS) {
      p.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = p.re.exec(line))) {
        const val = m[0];
        out.push({ name: p.name, match: val.length > 42 ? val.slice(0, 20) + "…" + val.slice(-8) : val, line: i + 1 });
      }
    }
  });
  return out;
}

export function analyzeCookie(setCookie: string): { checks: { label: string; ok: boolean; note: string }[]; attrs: Record<string, string> } {
  const parts = setCookie.split(";").map((p) => p.trim());
  const attrs: Record<string, string> = {};
  parts.slice(1).forEach((p) => {
    const [k, v] = p.split("=");
    attrs[k.toLowerCase()] = v ?? "true";
  });
  const sameSite = attrs["samesite"] || "";
  const checks = [
    { label: "Secure", ok: "secure" in attrs, note: "Only sent over HTTPS — prevents interception." },
    { label: "HttpOnly", ok: "httponly" in attrs, note: "Hidden from JavaScript — blocks XSS cookie theft." },
    { label: "SameSite", ok: !!sameSite, note: sameSite ? `Set to ${sameSite} — mitigates CSRF.` : "Missing — vulnerable to CSRF; use Lax or Strict." },
    { label: "Explicit expiry", ok: "expires" in attrs || "max-age" in attrs, note: "Bounded lifetime instead of a session cookie." },
    { label: "Path scoped", ok: "path" in attrs, note: "Restricts which paths receive the cookie." },
  ];
  return { checks, attrs };
}

export const CSP_DIRECTIVES = ["default-src", "script-src", "style-src", "img-src", "connect-src", "font-src", "frame-src", "frame-ancestors", "object-src", "base-uri", "form-action"];

export function analyzeCsp(policy: string): { directives: Record<string, string[]>; issues: string[] } {
  const directives: Record<string, string[]> = {};
  policy.split(";").forEach((d) => {
    const [name, ...vals] = d.trim().split(/\s+/);
    if (name) directives[name.toLowerCase()] = vals;
  });
  const issues: string[] = [];
  const flat = JSON.stringify(directives);
  if (flat.includes("'unsafe-inline'")) issues.push("'unsafe-inline' allows inline scripts/styles — a major XSS risk. Prefer nonces or hashes.");
  if (flat.includes("'unsafe-eval'")) issues.push("'unsafe-eval' permits eval() — avoid it.");
  if (flat.includes("*") && !flat.includes("*.")) issues.push("A bare '*' source allows any origin — tighten it.");
  if (!directives["default-src"] && !directives["script-src"]) issues.push("No default-src or script-src — nothing is actually restricted.");
  if (!directives["object-src"]) issues.push("Add object-src 'none' to block legacy plugin vectors.");
  if (!directives["frame-ancestors"]) issues.push("Add frame-ancestors to control who can iframe you (clickjacking).");
  if (!issues.length) issues.push("No obvious weaknesses — looks reasonably strict.");
  return { directives, issues };
}

/* TLS cipher-suite name explainer, e.g. TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 */
export function explainCipherSuite(name: string): { part: string; meaning: string }[] {
  const n = name.trim().toUpperCase();
  const out: { part: string; meaning: string }[] = [];
  const kx = /ECDHE/.test(n) ? "ECDHE — ephemeral elliptic-curve DH (forward secrecy ✓)"
    : /DHE/.test(n) ? "DHE — ephemeral finite-field DH (forward secrecy ✓)"
    : /ECDH/.test(n) ? "ECDH — static elliptic-curve DH (no forward secrecy)"
    : /RSA/.test(n) && !/WITH.*RSA/.test(n) ? "RSA key exchange (no forward secrecy)" : "";
  if (kx) out.push({ part: "Key exchange", meaning: kx });
  const auth = /ECDSA/.test(n) ? "ECDSA certificate" : /RSA/.test(n) ? "RSA certificate" : "";
  if (auth) out.push({ part: "Authentication", meaning: auth });
  const cipher = /AES_256_GCM/.test(n) ? "AES-256-GCM (AEAD, strong)"
    : /AES_128_GCM/.test(n) ? "AES-128-GCM (AEAD, strong)"
    : /CHACHA20_POLY1305/.test(n) ? "ChaCha20-Poly1305 (AEAD, great on mobile)"
    : /AES_256_CBC/.test(n) ? "AES-256-CBC (legacy, avoid)"
    : /AES_128_CBC/.test(n) ? "AES-128-CBC (legacy, avoid)"
    : /3DES|RC4/.test(n) ? "Broken legacy cipher — do not use" : "";
  if (cipher) out.push({ part: "Bulk cipher", meaning: cipher });
  const mac = /SHA384/.test(n) ? "SHA-384" : /SHA256/.test(n) ? "SHA-256" : /SHA\b/.test(n) ? "SHA-1 (legacy)" : "";
  if (mac) out.push({ part: "MAC / PRF hash", meaning: mac });
  if (!out.length) out.push({ part: "—", meaning: "Not a recognisable TLS cipher-suite name." });
  return out;
}

export function caesarShift(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}

export function xorHex(textUtf8: string, keyUtf8: string): string {
  if (!keyUtf8) return "";
  const t = new TextEncoder().encode(textUtf8);
  const k = new TextEncoder().encode(keyUtf8);
  return Array.from(t, (b, i) => (b ^ k[i % k.length]).toString(16).padStart(2, "0")).join("");
}
