/* Vault desktop — preload.
   Intentionally empty of privileged bridges. With contextIsolation on and
   nodeIntegration off, the renderer is a plain, sandboxed web page: it gets no
   access to Node, the filesystem or IPC. This is by design — the vault is a
   pure client-side web app and must not gain extra powers from the wrapper. */

window.addEventListener("DOMContentLoaded", () => {
  // Tag the document so the web app could (optionally) tailor UI for desktop.
  try {
    document.documentElement.setAttribute("data-runtime", "electron-desktop");
  } catch {
    /* no-op */
  }
});
