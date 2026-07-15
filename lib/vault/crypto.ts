/* ============================================================================
   Vault — cryptographic core.

   A zero-knowledge, browser-only encryption engine. The master password never
   leaves the device and is never stored; the vault is protected by an
   eight-stage cascade built entirely on the audited primitives of the Web
   Crypto API (SubtleCrypto). No third-party crypto, no network, no telemetry.

   THE EIGHT STAGES (seal, innermost → outermost)
   ─────────────────────────────────────────────────────────────────────────
     1. PBKDF2-HMAC-SHA-512  — 600 000 iterations stretch the master password
                               into a 512-bit master secret (slow by design).
     2. HKDF-SHA-512         — domain-separated expansion into six independent
                               sub-keys, one per downstream primitive.
     3. Anti-analysis padding — random-length padding hides the true plaintext
                               size from an observer.
     4. AES-256-GCM (inner)  — authenticated encryption, unique 96-bit IV.
     5. AES-256-CTR          — a second, independent keystream layer.
     6. AES-256-CBC + EtM    — a third cipher, sealed with an Encrypt-then-MAC
                               HMAC-SHA-512 tag over IV‖ciphertext.
     7. AES-256-GCM (outer)  — final authenticated layer, binding the versioned
                               header as additional authenticated data (AAD).
     8. HMAC-SHA-512 envelope — a whole-container MAC; verified first on open,
                               so tampering/typos fail fast before any decrypt.

   Every stage uses an independently derived key. Opening reverses the cascade
   and verifies three separate authentication tags; any mismatch aborts.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Low-level byte helpers
   ------------------------------------------------------------------------ */

const subtle = (): SubtleCrypto => {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto API unavailable (a secure context is required).");
  }
  return crypto.subtle;
};

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Constant-time equality — never leaks where two tags first differ. */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export const utf8ToBytes = (s: string): Uint8Array => enc.encode(s);
export const bytesToUtf8 = (b: Uint8Array): string => dec.decode(b);

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

function u32be(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}

function readU32be(b: Uint8Array, off: number): number {
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
}

/* --------------------------------------------------------------------------
   Stage 1 — PBKDF2 master-secret derivation
   ------------------------------------------------------------------------ */

export const DEFAULT_KDF_ITERATIONS = 600_000;
const MASTER_SECRET_BYTES = 64; // 512-bit
const MAGIC = utf8ToBytes("SVLT"); // Saleh VauLT
const FORMAT_VERSION = 1;

/**
 * Composite key material (KeePass-style two-factor). When a keyfile is present
 * the effective secret becomes SHA-512( password ‖ SHA-512(keyfile) ), so an
 * attacker needs BOTH the master password AND the exact keyfile bytes. Without
 * a keyfile the password bytes are used directly (unchanged behaviour).
 */
async function compositeMaterial(password: string, keyfile?: Uint8Array | null): Promise<Uint8Array> {
  const pw = utf8ToBytes(password);
  if (!keyfile || keyfile.length === 0) return pw;
  const kfHash = new Uint8Array(await subtle().digest("SHA-512", keyfile as BufferSource));
  return new Uint8Array(await subtle().digest("SHA-512", concatBytes(pw, kfHash) as BufferSource));
}

async function deriveMasterSecret(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyfile?: Uint8Array | null
): Promise<Uint8Array> {
  const material = await compositeMaterial(password, keyfile);
  const baseKey = await subtle().importKey("raw", material as BufferSource, "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "PBKDF2", hash: "SHA-512", salt: salt as BufferSource, iterations },
    baseKey,
    MASTER_SECRET_BYTES * 8
  );
  return new Uint8Array(bits);
}

/* --------------------------------------------------------------------------
   Stage 2 — HKDF domain-separated sub-keys
   ------------------------------------------------------------------------ */

type SubKeys = {
  gcm1: CryptoKey; // stage 4
  ctr: CryptoKey; // stage 5
  cbc: CryptoKey; // stage 6 cipher
  macEtm: CryptoKey; // stage 6 Encrypt-then-MAC
  gcm2: CryptoKey; // stage 7
  macEnv: CryptoKey; // stage 8 envelope
};

async function hkdfBytes(hkdfKey: CryptoKey, salt: Uint8Array, info: string, len: number): Promise<Uint8Array> {
  const bits = await subtle().deriveBits(
    { name: "HKDF", hash: "SHA-512", salt: salt as BufferSource, info: utf8ToBytes(info) as BufferSource },
    hkdfKey,
    len * 8
  );
  return new Uint8Array(bits);
}

async function importAes(raw: Uint8Array, name: "AES-GCM" | "AES-CTR" | "AES-CBC"): Promise<CryptoKey> {
  return subtle().importKey("raw", raw as BufferSource, { name }, false, ["encrypt", "decrypt"]);
}

async function importHmac(raw: Uint8Array, hash: "SHA-512" | "SHA-256" | "SHA-1"): Promise<CryptoKey> {
  return subtle().importKey("raw", raw as BufferSource, { name: "HMAC", hash }, false, ["sign", "verify"]);
}

async function deriveSubKeys(masterSecret: Uint8Array, salt: Uint8Array): Promise<SubKeys> {
  const hkdfKey = await subtle().importKey("raw", masterSecret as BufferSource, "HKDF", false, ["deriveBits"]);
  const [gcm1Raw, ctrRaw, cbcRaw, macEtmRaw, gcm2Raw, macEnvRaw] = await Promise.all([
    hkdfBytes(hkdfKey, salt, "vault:v1:aes-gcm:inner", 32),
    hkdfBytes(hkdfKey, salt, "vault:v1:aes-ctr:stream", 32),
    hkdfBytes(hkdfKey, salt, "vault:v1:aes-cbc:cipher", 32),
    hkdfBytes(hkdfKey, salt, "vault:v1:hmac:etm", 32),
    hkdfBytes(hkdfKey, salt, "vault:v1:aes-gcm:outer", 32),
    hkdfBytes(hkdfKey, salt, "vault:v1:hmac:envelope", 32),
  ]);
  const [gcm1, ctr, cbc, macEtm, gcm2, macEnv] = await Promise.all([
    importAes(gcm1Raw, "AES-GCM"),
    importAes(ctrRaw, "AES-CTR"),
    importAes(cbcRaw, "AES-CBC"),
    importHmac(macEtmRaw, "SHA-512"),
    importAes(gcm2Raw, "AES-GCM"),
    importHmac(macEnvRaw, "SHA-512"),
  ]);
  return { gcm1, ctr, cbc, macEtm, gcm2, macEnv };
}

/* --------------------------------------------------------------------------
   Stage 3 — anti-analysis padding
   Layout: [4-byte real length BE][plaintext][random pad]. The pad length is
   randomised (16–271 bytes) so ciphertext size no longer reveals content size.
   ------------------------------------------------------------------------ */

function pad(plaintext: Uint8Array): Uint8Array {
  const padLen = 16 + (randomBytes(1)[0] & 0xff); // 16..271
  const padding = randomBytes(padLen);
  return concatBytes(u32be(plaintext.length), plaintext, padding);
}

function unpad(padded: Uint8Array): Uint8Array {
  if (padded.length < 4) throw new Error("corrupt padding");
  const realLen = readU32be(padded, 0);
  if (realLen > padded.length - 4) throw new Error("corrupt length header");
  return padded.slice(4, 4 + realLen);
}

/* --------------------------------------------------------------------------
   Header (bound as AAD in stage 7 and MAC'd in stage 8)
   MAGIC(4) | version(1) | iters(4) | salt(16) | ivGcm1(12) | ivCtr(16) |
   ivCbc(16) | ivGcm2(12)
   ------------------------------------------------------------------------ */

type Header = {
  version: number;
  iterations: number;
  salt: Uint8Array;
  ivGcm1: Uint8Array;
  ivCtr: Uint8Array;
  ivCbc: Uint8Array;
  ivGcm2: Uint8Array;
};

function serializeHeader(h: Header): Uint8Array {
  return concatBytes(
    MAGIC,
    new Uint8Array([h.version]),
    u32be(h.iterations),
    h.salt,
    h.ivGcm1,
    h.ivCtr,
    h.ivCbc,
    h.ivGcm2
  );
}

/* --------------------------------------------------------------------------
   The container written to disk (JSON, base64 fields)
   ------------------------------------------------------------------------ */

export type VaultContainer = {
  v: number;
  it: number;
  salt: string;
  ivGcm1: string;
  ivCtr: string;
  ivCbc: string;
  ivGcm2: string;
  ct: string; // stage-7 ciphertext
  mac: string; // stage-8 envelope tag
};

/* --------------------------------------------------------------------------
   SEAL — run the full eight-stage cascade
   ------------------------------------------------------------------------ */

export async function seal(
  password: string,
  plaintext: string,
  iterations: number = DEFAULT_KDF_ITERATIONS,
  keyfile?: Uint8Array | null
): Promise<VaultContainer> {
  const salt = randomBytes(16);
  const master = await deriveMasterSecret(password, salt, iterations, keyfile); // stage 1
  const keys = await deriveSubKeys(master, salt); // stage 2

  const ivGcm1 = randomBytes(12);
  const ivCtr = randomBytes(16);
  const ivCbc = randomBytes(16);
  const ivGcm2 = randomBytes(12);

  const header: Header = {
    version: FORMAT_VERSION,
    iterations,
    salt,
    ivGcm1,
    ivCtr,
    ivCbc,
    ivGcm2,
  };
  const headerBytes = serializeHeader(header);

  // stage 3 — padding
  const padded = pad(utf8ToBytes(plaintext));

  // stage 4 — AES-256-GCM (inner)
  const c4 = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv: ivGcm1 as BufferSource, tagLength: 128 }, keys.gcm1, padded as BufferSource)
  );

  // stage 5 — AES-256-CTR
  const c5 = new Uint8Array(
    await subtle().encrypt({ name: "AES-CTR", counter: ivCtr as BufferSource, length: 64 }, keys.ctr, c4 as BufferSource)
  );

  // stage 6 — AES-256-CBC then Encrypt-then-MAC
  const c6 = new Uint8Array(
    await subtle().encrypt({ name: "AES-CBC", iv: ivCbc as BufferSource }, keys.cbc, c5 as BufferSource)
  );
  const macCbc = new Uint8Array(
    await subtle().sign("HMAC", keys.macEtm, concatBytes(ivCbc, c6) as BufferSource)
  );

  // stage 7 — AES-256-GCM (outer) over macCbc‖c6, header as AAD
  const outerPlain = concatBytes(macCbc, c6);
  const c7 = new Uint8Array(
    await subtle().encrypt(
      { name: "AES-GCM", iv: ivGcm2 as BufferSource, additionalData: headerBytes as BufferSource, tagLength: 128 },
      keys.gcm2,
      outerPlain as BufferSource
    )
  );

  // stage 8 — HMAC-SHA-512 envelope over header‖ciphertext
  const macEnv = new Uint8Array(
    await subtle().sign("HMAC", keys.macEnv, concatBytes(headerBytes, c7) as BufferSource)
  );

  return {
    v: FORMAT_VERSION,
    it: iterations,
    salt: bytesToB64(salt),
    ivGcm1: bytesToB64(ivGcm1),
    ivCtr: bytesToB64(ivCtr),
    ivCbc: bytesToB64(ivCbc),
    ivGcm2: bytesToB64(ivGcm2),
    ct: bytesToB64(c7),
    mac: bytesToB64(macEnv),
  };
}

/* --------------------------------------------------------------------------
   OPEN — reverse the cascade, verifying every authentication tag
   ------------------------------------------------------------------------ */

export class VaultAuthError extends Error {
  constructor(message = "Authentication failed — wrong password or tampered data.") {
    super(message);
    this.name = "VaultAuthError";
  }
}

export async function open(password: string, container: VaultContainer, keyfile?: Uint8Array | null): Promise<string> {
  const salt = b64ToBytes(container.salt);
  const ivGcm1 = b64ToBytes(container.ivGcm1);
  const ivCtr = b64ToBytes(container.ivCtr);
  const ivCbc = b64ToBytes(container.ivCbc);
  const ivGcm2 = b64ToBytes(container.ivGcm2);
  const c7 = b64ToBytes(container.ct);
  const macEnv = b64ToBytes(container.mac);
  const iterations = container.it || DEFAULT_KDF_ITERATIONS;

  const master = await deriveMasterSecret(password, salt, iterations, keyfile); // stage 1
  const keys = await deriveSubKeys(master, salt); // stage 2

  const header: Header = {
    version: container.v || FORMAT_VERSION,
    iterations,
    salt,
    ivGcm1,
    ivCtr,
    ivCbc,
    ivGcm2,
  };
  const headerBytes = serializeHeader(header);

  // stage 8 — verify envelope MAC first (fast fail on wrong password/tamper)
  const envOk = await subtle().verify("HMAC", keys.macEnv, macEnv as BufferSource, concatBytes(headerBytes, c7) as BufferSource);
  if (!envOk) throw new VaultAuthError();

  // stage 7 — outer GCM decrypt (AAD-bound)
  let outerPlain: Uint8Array;
  try {
    outerPlain = new Uint8Array(
      await subtle().decrypt(
        { name: "AES-GCM", iv: ivGcm2 as BufferSource, additionalData: headerBytes as BufferSource, tagLength: 128 },
        keys.gcm2,
        c7 as BufferSource
      )
    );
  } catch {
    throw new VaultAuthError();
  }
  if (outerPlain.length < 64) throw new VaultAuthError();
  const macCbc = outerPlain.slice(0, 64);
  const c6 = outerPlain.slice(64);

  // stage 6 — verify Encrypt-then-MAC, then CBC decrypt
  const macCheck = new Uint8Array(await subtle().sign("HMAC", keys.macEtm, concatBytes(ivCbc, c6) as BufferSource));
  if (!timingSafeEqual(macCheck, macCbc)) throw new VaultAuthError();
  let c5: Uint8Array;
  try {
    c5 = new Uint8Array(await subtle().decrypt({ name: "AES-CBC", iv: ivCbc as BufferSource }, keys.cbc, c6 as BufferSource));
  } catch {
    throw new VaultAuthError();
  }

  // stage 5 — CTR decrypt
  const c4 = new Uint8Array(
    await subtle().decrypt({ name: "AES-CTR", counter: ivCtr as BufferSource, length: 64 }, keys.ctr, c5 as BufferSource)
  );

  // stage 4 — inner GCM decrypt
  let padded: Uint8Array;
  try {
    padded = new Uint8Array(
      await subtle().decrypt({ name: "AES-GCM", iv: ivGcm1 as BufferSource, tagLength: 128 }, keys.gcm1, c4 as BufferSource)
    );
  } catch {
    throw new VaultAuthError();
  }

  // stage 3 — remove padding
  return bytesToUtf8(unpad(padded));
}

/** Cheap check that a blob looks like one of our containers. */
export function isVaultContainer(x: unknown): x is VaultContainer {
  const c = x as VaultContainer;
  return !!c && typeof c === "object" && typeof c.ct === "string" && typeof c.mac === "string" && typeof c.salt === "string";
}

/* ==========================================================================
   VERIFIER HASH — lets us tell "wrong password" from "corrupt vault" quickly,
   and gates the unlock screen without decrypting the whole vault. Derived from
   a separate HKDF label so it reveals nothing about the encryption keys.
   ========================================================================== */

export async function passwordVerifier(password: string, salt: Uint8Array, iterations: number, keyfile?: Uint8Array | null): Promise<string> {
  const master = await deriveMasterSecret(password, salt, iterations, keyfile);
  const hkdfKey = await subtle().importKey("raw", master as BufferSource, "HKDF", false, ["deriveBits"]);
  const v = await hkdfBytes(hkdfKey, salt, "vault:v1:verifier", 32);
  return bytesToB64(v);
}

/* ==========================================================================
   SHA-256 helper (used for reuse-detection fingerprints — never stores the
   plaintext password, only a local hash prefix).
   ========================================================================== */

export async function sha256Hex(input: string): Promise<string> {
  const buf = await subtle().digest("SHA-256", utf8ToBytes(input) as BufferSource);
  return bytesToHex(new Uint8Array(buf));
}

/* ==========================================================================
   TOTP — RFC 6238 time-based one-time passwords (HMAC-SHA-1 over a counter).
   Real, standards-compliant; interoperates with Google Authenticator, etc.
   ========================================================================== */

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

export function isValidBase32(input: string): boolean {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  return clean.length > 0 && /^[A-Z2-7]+$/.test(clean);
}

export async function totp(
  secretBase32: string,
  opts: { digits?: number; period?: number; timestamp?: number; algorithm?: "SHA-1" | "SHA-256" | "SHA-512" } = {}
): Promise<{ code: string; secondsRemaining: number }> {
  const digits = opts.digits ?? 6;
  const period = opts.period ?? 30;
  const now = Math.floor((opts.timestamp ?? Date.now()) / 1000);
  const counter = Math.floor(now / period);

  const key = base32Decode(secretBase32);
  const hmacKey = await importHmac(key, opts.algorithm ?? "SHA-1");

  const counterBytes = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const mac = new Uint8Array(await subtle().sign("HMAC", hmacKey, counterBytes as BufferSource));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  const code = (binary % 10 ** digits).toString().padStart(digits, "0");
  return { code, secondsRemaining: period - (now % period) };
}

/** Parse an otpauth:// URI into a base32 secret + metadata. */
export function parseOtpAuth(uri: string): { secret: string; issuer?: string; label?: string; digits?: number; period?: number } | null {
  try {
    if (!uri.startsWith("otpauth://")) {
      // treat a bare string as a raw secret
      return isValidBase32(uri) ? { secret: uri.replace(/\s+/g, "") } : null;
    }
    const url = new URL(uri);
    const secret = url.searchParams.get("secret") || "";
    if (!isValidBase32(secret)) return null;
    return {
      secret,
      issuer: url.searchParams.get("issuer") || undefined,
      label: decodeURIComponent(url.pathname.replace(/^\/+/, "")) || undefined,
      digits: url.searchParams.get("digits") ? Number(url.searchParams.get("digits")) : undefined,
      period: url.searchParams.get("period") ? Number(url.searchParams.get("period")) : undefined,
    };
  } catch {
    return null;
  }
}

/* ==========================================================================
   PASSWORD & PASSPHRASE GENERATION — unbiased selection via getRandomValues
   with rejection sampling.
   ========================================================================== */

const CHARSETS = {
  lower: "abcdefghijkmnopqrstuvwxyz", // no l
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", // no I, O
  digits: "23456789", // no 0, 1
  lowerFull: "abcdefghijklmnopqrstuvwxyz",
  upperFull: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digitsFull: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};

export type GenOptions = {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
};

/** Uniform integer in [0, max) via rejection sampling. */
function randInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

function pickChar(set: string): string {
  return set[randInt(set.length)];
}

export function generatePassword(opts: GenOptions): string {
  const pools: string[] = [];
  if (opts.lower) pools.push(opts.avoidAmbiguous ? CHARSETS.lower : CHARSETS.lowerFull);
  if (opts.upper) pools.push(opts.avoidAmbiguous ? CHARSETS.upper : CHARSETS.upperFull);
  if (opts.digits) pools.push(opts.avoidAmbiguous ? CHARSETS.digits : CHARSETS.digitsFull);
  if (opts.symbols) pools.push(CHARSETS.symbols);
  if (pools.length === 0) pools.push(CHARSETS.lowerFull);

  const all = pools.join("");
  const chars: string[] = [];
  // guarantee at least one from each selected pool
  for (const pool of pools) chars.push(pickChar(pool));
  for (let i = chars.length; i < opts.length; i++) chars.push(pickChar(all));

  // Fisher–Yates shuffle so the guaranteed chars aren't front-loaded
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.slice(0, Math.max(opts.length, pools.length)).join("");
}

/** A compact EFF-style wordlist for memorable passphrases. */
export const WORDLIST = [
  "anchor", "amber", "arrow", "atlas", "aurora", "beacon", "birch", "bison", "blaze", "bloom",
  "borealis", "boulder", "breeze", "bridge", "bronze", "cactus", "canyon", "cedar", "cinder", "cipher",
  "citadel", "clover", "cobalt", "comet", "compass", "copper", "coral", "cosmos", "crater", "crystal",
  "cyclone", "delta", "dune", "ember", "eagle", "echo", "eclipse", "falcon", "fern", "flint",
  "forest", "fjord", "galaxy", "garnet", "geyser", "glacier", "granite", "harbor", "hawk", "hazel",
  "helix", "horizon", "ignite", "indigo", "island", "ivory", "jade", "jaguar", "jasmine", "jupiter",
  "kelp", "kestrel", "lagoon", "lantern", "laurel", "ledger", "lichen", "lunar", "lynx", "magnet",
  "maple", "marble", "meadow", "meteor", "mirage", "mosaic", "nebula", "nectar", "nimbus", "nova",
  "oasis", "obsidian", "onyx", "opal", "orbit", "otter", "oxide", "pebble", "phoenix", "pigment",
  "pine", "plasma", "plateau", "prairie", "prism", "quartz", "quasar", "quill", "raven", "reef",
  "ridge", "river", "rocket", "rune", "saffron", "sable", "sage", "sapphire", "savanna", "sequoia",
  "shadow", "silver", "slate", "solar", "spruce", "storm", "summit", "talon", "tempest", "thistle",
  "thunder", "timber", "topaz", "tundra", "umber", "valley", "vertex", "vesper", "vortex", "walnut",
  "willow", "wander", "wavelength", "zenith", "zephyr", "zircon",
];

export type PassphraseOptions = {
  words: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
};

export function generatePassphrase(opts: PassphraseOptions): string {
  const parts: string[] = [];
  for (let i = 0; i < opts.words; i++) {
    let w = WORDLIST[randInt(WORDLIST.length)];
    if (opts.capitalize) w = w[0].toUpperCase() + w.slice(1);
    parts.push(w);
  }
  if (opts.includeNumber) {
    const pos = randInt(parts.length);
    parts[pos] = parts[pos] + randInt(100).toString().padStart(2, "0");
  }
  return parts.join(opts.separator);
}

/* ==========================================================================
   STRENGTH ANALYSIS — a lightweight, dependency-free estimator. Combines a
   charset-entropy floor with pattern penalties (repeats, sequences, common
   words/dates) to produce a score, entropy estimate and crack-time guess.
   ========================================================================== */

export type Strength = {
  score: 0 | 1 | 2 | 3 | 4;
  entropyBits: number;
  guessesLog10: number;
  crackTime: { label: string; faLabel: string };
  warnings: string[];
  faWarnings: string[];
};

const COMMON = [
  "password", "123456", "qwerty", "admin", "letmein", "welcome", "iloveyou",
  "monkey", "dragon", "master", "sunshine", "princess", "football", "shadow",
  "saleh", "saghafiani", "tehran", "iran",
];

function charsetSize(pw: string): number {
  let size = 0;
  if (/[a-z]/.test(pw)) size += 26;
  if (/[A-Z]/.test(pw)) size += 26;
  if (/[0-9]/.test(pw)) size += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) size += 33;
  return size || 1;
}

function hasSequential(pw: string): boolean {
  const lower = pw.toLowerCase();
  for (let i = 0; i < lower.length - 2; i++) {
    const a = lower.charCodeAt(i);
    const b = lower.charCodeAt(i + 1);
    const c = lower.charCodeAt(i + 2);
    if (b - a === 1 && c - b === 1) return true;
    if (a - b === 1 && b - c === 1) return true;
  }
  return false;
}

function hasRepeats(pw: string): boolean {
  return /(.)\1\1/.test(pw);
}

export function analyzeStrength(pw: string): Strength {
  const warnings: string[] = [];
  const faWarnings: string[] = [];

  if (!pw) {
    return {
      score: 0,
      entropyBits: 0,
      guessesLog10: 0,
      crackTime: { label: "instantly", faLabel: "آنی" },
      warnings: ["Empty password."],
      faWarnings: ["رمز خالی است."],
    };
  }

  const size = charsetSize(pw);
  let entropy = pw.length * Math.log2(size);

  const lower = pw.toLowerCase();
  if (COMMON.some((w) => lower.includes(w))) {
    entropy *= 0.4;
    warnings.push("Contains a very common word.");
    faWarnings.push("شاملِ یک واژه‌ی بسیار رایج است.");
  }
  if (hasRepeats(pw)) {
    entropy *= 0.75;
    warnings.push("Repeated characters are predictable.");
    faWarnings.push("کاراکترهای تکراری قابل‌حدس‌اند.");
  }
  if (hasSequential(pw)) {
    entropy *= 0.75;
    warnings.push("Sequential runs (abc, 123) are weak.");
    faWarnings.push("دنباله‌های پشت‌سرهم (abc، ۱۲۳) ضعیف‌اند.");
  }
  if (/^\d+$/.test(pw)) {
    entropy *= 0.6;
    warnings.push("Digits only — easily brute-forced.");
    faWarnings.push("فقط رقم — به‌سادگی brute-force می‌شود.");
  }
  if (pw.length < 8) {
    warnings.push("Too short — aim for 14+ characters.");
    faWarnings.push("خیلی کوتاه — به ۱۴+ کاراکتر برسان.");
  }

  entropy = Math.max(0, Math.round(entropy));
  const guessesLog10 = entropy * Math.log10(2);

  // 10^10 guesses/sec offline attacker assumption
  const seconds = Math.pow(10, Math.max(0, guessesLog10 - 10));
  const crackTime = humanTime(seconds);

  let score: Strength["score"] = 0;
  if (entropy >= 100) score = 4;
  else if (entropy >= 70) score = 3;
  else if (entropy >= 45) score = 2;
  else if (entropy >= 28) score = 1;
  else score = 0;

  return { score, entropyBits: entropy, guessesLog10, crackTime, warnings, faWarnings };
}

function humanTime(seconds: number): { label: string; faLabel: string } {
  if (seconds < 1) return { label: "instantly", faLabel: "آنی" };
  const units: [number, string, string][] = [
    [60, "second", "ثانیه"],
    [60, "minute", "دقیقه"],
    [24, "hour", "ساعت"],
    [365, "day", "روز"],
    [100, "year", "سال"],
    [Infinity, "century", "قرن"],
  ];
  let value = seconds;
  let idx = 0;
  while (idx < units.length - 1 && value >= units[idx][0]) {
    value /= units[idx][0];
    idx++;
  }
  const rounded = Math.round(value);
  if (idx >= units.length - 1 && rounded > 100) {
    return { label: "centuries", faLabel: "قرن‌ها" };
  }
  return {
    label: `${rounded} ${units[idx][1]}${rounded !== 1 ? "s" : ""}`,
    faLabel: `${rounded} ${units[idx][2]}`,
  };
}
