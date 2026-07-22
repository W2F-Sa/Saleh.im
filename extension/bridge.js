/* Vault Capture — saleh.im bridge.
 *
 * Runs only on the Vault site. When the Vault page announces itself, this
 * script performs an ECDH handshake with it and hands over every captured
 * login encrypted with AES-256-GCM (derived from the shared secret). The
 * credentials are never posted in the clear, and the Vault imports + stores
 * them automatically. */
(function () {
  const APP_SOURCE = "vault-app";
  const EXT_SOURCE = "vault-capture-ext";

  const b64 = (buf) => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function loadCaptured() {
    try {
      const o = await chrome.storage.local.get("vault_captured");
      return Array.isArray(o.vault_captured) ? o.vault_captured : [];
    } catch (_) {
      return [];
    }
  }

  window.addEventListener("message", async (e) => {
    if (e.source !== window || !e.data || e.data.source !== APP_SOURCE) return;
    if (e.data.type !== "vault-ready" || !e.data.pub) return;

    try {
      const creds = await loadCaptured();
      if (!creds.length) return;

      const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
      const theirPub = await crypto.subtle.importKey("raw", unb64(e.data.pub), { name: "ECDH", namedCurve: "P-256" }, false, []);
      const key = await crypto.subtle.deriveKey({ name: "ECDH", public: theirPub }, kp.privateKey, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
      const myPub = b64(await crypto.subtle.exportKey("raw", kp.publicKey));

      const payload = new TextEncoder().encode(
        JSON.stringify(
          creds.map((c) => ({
            title: c.title || c.site || c.origin,
            url: c.url || c.origin,
            username: c.username || "",
            password: c.password,
          })),
        ),
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);

      window.postMessage(
        { source: EXT_SOURCE, type: "vault-creds", pub: myPub, iv: b64(iv), data: b64(ct) },
        e.origin,
      );
    } catch (_) {
      /* ignore — page may not be the vault */
    }
  });

  // say hello so the page re-announces even if it loaded before us
  window.postMessage({ source: EXT_SOURCE, type: "ext-hello" }, "*");
})();
