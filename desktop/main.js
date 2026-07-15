/* ============================================================================
   Vault — Electron main process (Linux desktop wrapper).

   A deliberately minimal, hardened shell around the Vault web app so it can be
   installed as a native application on Ubuntu / Kubuntu (and any Debian-based
   distro). The renderer runs fully sandboxed with no Node access; the app has
   no menu, opens external links in the system browser, and denies every
   permission request (a password vault needs none). All cryptography still
   happens client-side — this wrapper never sees your data.
   ========================================================================== */

const { app, BrowserWindow, shell, session, Menu, nativeTheme } = require("electron");
const path = require("path");

// Where the vault lives. Defaults to the hosted app (its crypto is fully
// client-side and it caches offline via a service worker). Point this at a
// self-hosted / localhost instance for a 100% offline, air-gapped setup:
//   VAULT_URL=http://localhost:3000/vault npm start
const VAULT_URL = process.env.VAULT_URL || "https://saleh.im/vault";
const BASE_ORIGIN = new URL(VAULT_URL).origin;

// Harden the process before anything loads.
app.enableSandbox();
app.setName("Vault");

function isSameOrigin(url) {
  try {
    return new URL(url).origin === BASE_ORIGIN;
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 800,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0b0c0e" : "#f2eee4",
    title: "Vault",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
      // isolate storage in a dedicated, persistent partition
      partition: "persist:vault",
    },
  });

  // No application menu — this is a single-purpose app.
  Menu.setApplicationMenu(null);

  win.once("ready-to-show", () => win.show());
  win.loadURL(VAULT_URL);

  // External links → system browser, never inside the vault window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Block navigation away from the vault origin.
  win.webContents.on("will-navigate", (event, url) => {
    if (!isSameOrigin(url)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  return win;
}

app.whenReady().then(() => {
  // Deny every permission request (camera, mic, geolocation, notifications…).
  const ses = session.fromPartition("persist:vault");
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);

  // Never allow <webview> embedding or extra window attachments.
  app.on("web-contents-created", (_e, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) shell.openExternal(url);
      return { action: "deny" };
    });
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Refuse a second instance from hijacking the window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}
