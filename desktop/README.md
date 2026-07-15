# Vault — Linux desktop app

A hardened [Electron](https://www.electronjs.org/) wrapper around the **Vault**
password manager so it installs and runs like a native application on
**Ubuntu**, **Kubuntu** and any Debian‑based distribution. The renderer is fully
sandboxed (no Node, no filesystem, no IPC bridges); all cryptography stays
client‑side, exactly as in the web app.

> One `.deb` covers **both Ubuntu (GNOME) and Kubuntu (KDE)** — they share the
> same package format and base. The portable **AppImage** runs on virtually any
> modern Linux distro without installing anything.

---

## Build the installers

Requirements: **Node.js 18+** and **npm** on a Linux machine.

```bash
cd desktop
npm install
npm run dist          # builds both .deb and .AppImage into desktop/dist/
# or individually:
npm run dist:deb
npm run dist:appimage
```

Artifacts land in `desktop/dist/`:

- `Vault-1.0.0-x64.deb`      → Ubuntu / Kubuntu installer
- `Vault-1.0.0-x64.AppImage` → portable, no install required

---

## Install on Ubuntu / Kubuntu

**Option A — `.deb` (recommended):**

```bash
sudo apt install ./dist/Vault-1.0.0-x64.deb
# (older systems)  sudo dpkg -i ./dist/Vault-1.0.0-x64.deb && sudo apt -f install
```

Then launch **Vault** from the applications menu (works in both GNOME Shell and
KDE Plasma), or run `vault` from a terminal.

**Option B — AppImage (no install):**

```bash
chmod +x ./dist/Vault-1.0.0-x64.AppImage
./dist/Vault-1.0.0-x64.AppImage
```

Uninstall the `.deb` with: `sudo apt remove vault`.

---

## Security model

- **Sandboxed renderer** — `sandbox: true`, `contextIsolation: true`,
  `nodeIntegration: false`. The web page cannot touch the OS.
- **No menu, no new windows** — external links open in your system browser.
- **All permissions denied** — camera, microphone, geolocation, notifications
  and clipboard prompts are refused; a vault needs none of them.
- **Single instance** — a second launch just focuses the existing window.
- **Zero‑knowledge** — your master password (and optional **keyfile** second
  factor) never leave the machine; only ciphertext is stored, in a dedicated
  persistent partition scoped to the app.

## Fully offline / self‑hosted

By default the app loads the hosted Vault (its service worker caches everything
for offline use, and the crypto is client‑side). For an air‑gapped setup, point
it at a local instance:

```bash
VAULT_URL=http://localhost:3000/vault npm start
```

To bake a different default URL into a build, edit `VAULT_URL` in `main.js`
before running `npm run dist`.
