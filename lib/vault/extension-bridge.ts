/* ============================================================================
   Vault ⇄ "Vault Capture" browser-extension bridge (page side).

   The extension's content script and this page can't share memory, so they
   talk over window.postMessage — but the credentials never travel in the
   clear. We run an ephemeral ECDH (P-256) handshake and encrypt the payload
   with AES-256-GCM, so even other scripts on the page can't read what the
   extension hands over. The vault then stores everything with its normal
   at-rest encryption.

   Handshake:
     1. page  → { source: "vault-app",        type: "vault-ready", pub }
     2. ext   → { source: "vault-capture-ext", type: "vault-creds", pub, iv, data }
   The page also re-announces whenever the extension says "ext-hello", so the
   order the two load in doesn't matter.
   ========================================================================== */

export type IncomingCred = { title?: string; url?: string; username?: string; password: string };

const APP_SOURCE = "vault-app";
const EXT_SOURCE = "vault-capture-ext";

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function startExtensionBridge(onCreds: (creds: IncomingCred[]) => void): () => void {
  if (typeof window === "undefined" || !window.crypto?.subtle) return () => {};

  let priv: CryptoKey | null = null;

  const announce = async () => {
    try {
      const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
      priv = kp.privateKey;
      const pub = b64(await crypto.subtle.exportKey("raw", kp.publicKey));
      window.postMessage({ source: APP_SOURCE, type: "vault-ready", pub }, window.location.origin);
    } catch {
      /* WebCrypto unavailable — bridge simply stays idle */
    }
  };

  const onMessage = async (e: MessageEvent) => {
    if (e.source !== window || e.origin !== window.location.origin) return;
    const d = e.data;
    if (!d || typeof d !== "object" || d.source !== EXT_SOURCE) return;

    if (d.type === "ext-hello") {
      announce();
      return;
    }
    if (d.type === "vault-creds" && priv && d.pub && d.iv && d.data) {
      try {
        const theirPub = await crypto.subtle.importKey("raw", unb64(d.pub), { name: "ECDH", namedCurve: "P-256" }, false, []);
        const key = await crypto.subtle.deriveKey({ name: "ECDH", public: theirPub }, priv, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(d.iv) }, key, unb64(d.data));
        const arr = JSON.parse(new TextDecoder().decode(pt));
        if (Array.isArray(arr)) {
          const creds = arr.filter((c) => c && typeof c.password === "string" && c.password) as IncomingCred[];
          if (creds.length) onCreds(creds);
        }
      } catch {
        /* wrong key / tampered payload — ignore */
      }
    }
  };

  window.addEventListener("message", onMessage);
  announce();
  return () => window.removeEventListener("message", onMessage);
}
