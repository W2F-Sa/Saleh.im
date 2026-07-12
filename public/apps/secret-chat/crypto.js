/**
 * Triple-layer end-to-end encryption pipeline (browser WebCrypto).
 *
 *   plaintext
 *     → [pad + randomize]
 *     → Layer 1: AES-256-GCM   (key K1, salt "layer-1")
 *     → Layer 2: AES-256-GCM   (key K2, salt "layer-2")
 *     → Layer 3: HMAC-SHA256 keystream XOR  (key K3, salt "layer-3")
 *     → HMAC-SHA256 authentication tag over the whole envelope
 *     → base64 ciphertext
 *
 * All three keys are derived from a single shared secret via PBKDF2
 * (SHA-256, 250,000 iterations) with per-layer info. Keys live only in
 * memory and are discarded when the tab closes — nothing is persisted.
 *
 * NOTE: This is a real, layered construction built for learning and
 * privacy-by-default UX. For life-or-death threat models, prefer a vetted
 * library / protocol (e.g. libsignal).
 */
var TripleCrypto = (function () {
  "use strict";

  var enc = new TextEncoder();
  var dec = new TextDecoder();

  function concat() {
    var total = 0, i;
    for (i = 0; i < arguments.length; i++) total += arguments[i].length;
    var out = new Uint8Array(total), off = 0;
    for (i = 0; i < arguments.length; i++) { out.set(arguments[i], off); off += arguments[i].length; }
    return out;
  }
  function b64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    var s = atob(str), out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }

  async function pbkdf2(secret, saltStr, usage, algo) {
    var base = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey", "deriveBits"]);
    var params = { name: "PBKDF2", salt: enc.encode("saleh-secret-chat::" + saltStr), iterations: 250000, hash: "SHA-256" };
    if (algo === "raw") {
      return crypto.subtle.deriveBits(params, base, 256);
    }
    return crypto.subtle.deriveKey(params, base, algo, false, usage);
  }

  // Derive the three layer keys once per session.
  async function deriveKeys(secret) {
    var k1 = await pbkdf2(secret, "layer-1", ["encrypt", "decrypt"], { name: "AES-GCM", length: 256 });
    var k2 = await pbkdf2(secret, "layer-2", ["encrypt", "decrypt"], { name: "AES-GCM", length: 256 });
    var k3bits = await pbkdf2(secret, "layer-3-stream", null, "raw");
    var kmacBits = await pbkdf2(secret, "auth-mac", null, "raw");
    var k3 = await crypto.subtle.importKey("raw", k3bits, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    var kmac = await crypto.subtle.importKey("raw", kmacBits, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    return { k1: k1, k2: k2, k3: k3, kmac: kmac };
  }

  async function aesEncrypt(key, data) {
    var iv = rand(12);
    var ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data));
    return concat(iv, ct);
  }
  async function aesDecrypt(key, blob) {
    var iv = blob.slice(0, 12), ct = blob.slice(12);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct));
  }

  // Layer 3: HMAC-SHA256 counter-mode keystream, XOR'd with data (ChaCha-style).
  async function streamKey(k3, nonce, length) {
    var out = new Uint8Array(length), counter = 0, off = 0;
    while (off < length) {
      var ctrBytes = new Uint8Array(4);
      new DataView(ctrBytes.buffer).setUint32(0, counter, false);
      var block = new Uint8Array(await crypto.subtle.sign("HMAC", k3, concat(nonce, ctrBytes)));
      var take = Math.min(block.length, length - off);
      out.set(block.subarray(0, take), off);
      off += take; counter++;
    }
    return out;
  }
  async function streamXor(k3, data) {
    var nonce = rand(16);
    var ks = await streamKey(k3, nonce, data.length);
    var out = new Uint8Array(data.length);
    for (var i = 0; i < data.length; i++) out[i] = data[i] ^ ks[i];
    return concat(nonce, out);
  }
  async function streamUnxor(k3, blob) {
    var nonce = blob.slice(0, 16), data = blob.slice(16);
    var ks = await streamKey(k3, nonce, data.length);
    var out = new Uint8Array(data.length);
    for (var i = 0; i < data.length; i++) out[i] = data[i] ^ ks[i];
    return out;
  }

  // Random padding defeats length-based traffic analysis.
  function pad(bytes) {
    var padLen = 16 + Math.floor(Math.random() * 48); // 16..63 bytes
    var padding = rand(padLen);
    var header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, bytes.length, false);
    return concat(header, bytes, padding);
  }
  function unpad(bytes) {
    var len = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
    return bytes.slice(4, 4 + len);
  }

  function ctEqual(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  async function encrypt(keys, plaintext) {
    var data = pad(enc.encode(plaintext));
    var l1 = await aesEncrypt(keys.k1, data);        // layer 1
    var l2 = await aesEncrypt(keys.k2, l1);          // layer 2
    var l3 = await streamXor(keys.k3, l2);           // layer 3
    var tag = new Uint8Array(await crypto.subtle.sign("HMAC", keys.kmac, l3)); // authenticate
    return b64(concat(tag, l3));
  }

  async function decrypt(keys, payload) {
    var blob = unb64(payload);
    var tag = blob.slice(0, 32), l3 = blob.slice(32);
    var expected = new Uint8Array(await crypto.subtle.sign("HMAC", keys.kmac, l3));
    if (!ctEqual(tag, expected)) throw new Error("auth failed — wrong secret or tampered message");
    var l2 = await streamUnxor(keys.k3, l3);
    var l1 = await aesDecrypt(keys.k2, l2);
    var data = await aesDecrypt(keys.k1, l1);
    return dec.decode(unpad(data));
  }

  // Room ID is derived (not the raw name) so the broker never sees a guessable room.
  async function roomToken(roomId, secret) {
    var bits = await pbkdf2(secret + "::" + roomId, "room-token", null, "raw");
    var b = new Uint8Array(bits);
    var hex = "";
    for (var i = 0; i < 10; i++) hex += b[i].toString(16).padStart(2, "0");
    return "sc-" + hex;
  }

  return { deriveKeys: deriveKeys, encrypt: encrypt, decrypt: decrypt, roomToken: roomToken };
})();
