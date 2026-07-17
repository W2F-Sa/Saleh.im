# Vault — native Linux app (C++ · Qt6 · libsodium)

A real, native desktop password manager for **Ubuntu / Kubuntu** and any
Debian-based distro — written in **C++ with Qt6** and **libsodium**. Not a web
wrapper: it launches straight from your applications menu and runs entirely
offline. Nothing is ever uploaded.

## Security

- **Argon2id** memory-hard key derivation (Fast 64 MB / Recommended 256 MB /
  Paranoid 1 GB presets).
- **XChaCha20-Poly1305** authenticated encryption; the file header is bound as
  additional authenticated data, so any tampering fails loudly.
- Optional **keyfile** second factor — the effective key becomes
  `BLAKE2b(password ‖ BLAKE2b(keyfile))`.
- Keys derived into wiped buffers (`sodium_memzero`); the vault file is `0600`.
- The crypto core ships with a self-test (`./build.sh --test`) validated
  against RFC 6238 / RFC 2202 vectors.

## Features (40+)

**12 item types** — login, 2FA code, secure note, payment card, identity, SSH
key, API credential, Wi-Fi network, bank account, crypto wallet, server/database
and software licence — each with a tailored form, plus **user-defined custom
fields** (any label/value, optionally hidden) on every item.

- **Command palette** (Ctrl+K): fuzzy-search every action and entry, keyboard-first.
- **18 colour themes** across dark & light, chosen from a live visual **theme
  gallery** (Carbon Lime, Obsidian Violet, Midnight, Nord, Dracula, Gruvbox,
  Deep Forest, Ember Rose, Solarized, Ocean, Wine, Graphite, Warm Paper, Frost,
  Rose Quartz, Sand, Mint…).
- **Dashboard** — a statistics & security-health view: totals, per-type
  breakdown, 2FA coverage, entropy, expiring items and a health score.
- **Security audit** — weak / reused / aging / no-2FA / insecure-URL / expiring.
- **Generator** with five modes — password, passphrase (200-word list), PIN,
  memorable/pronounceable, hex key — with exclude-characters, minimum
  digit/symbol constraints and a recent-results history.
- **Trash** (soft delete → restore or delete-forever, Empty Trash).
- **Folder manager** (create/rename/re-icon/delete), tags, favorites.
- **Browser import** — scans Chrome, Chromium, Brave, Edge, Vivaldi, Opera and
  Firefox for saved logins and shows, per site, **how you sign in** ("Sign in
  with Google / GitHub / Microsoft…", or a username + password), the
  **username**, and the **password** when the system keyring permits decryption
  (Linux `v10/v11` AES‑128‑CBC scheme; locked entries are clearly marked, never
  guessed). Search, filter by method and import straight into the vault. Reads a
  private snapshot of the browser's login DB — nothing is written back.
- **Import** (JSON + generic/browser CSV) and **Export** (JSON / CSV) plus
  fully **encrypted backups**.
- **Password history** (browse / copy / restore previous passwords).
- **Per-item expiry** with dashboard/audit reminders; custom per-item emoji.
- **RFC-6238 TOTP** with live countdown · **Quick Capture** (Ctrl+Shift+A) ·
  multi-term search · sort (recent/updated/created/title) · right-click actions ·
  copy & open · clipboard **auto-clear** · **auto-lock** on idle · auto re-hide ·
  lock on minimize · **system tray** · full **menu bar** · compact/comfortable
  list density · configurable Argon2 strength · secure wipe.

Keyboard: `Ctrl+K` palette · `Ctrl+F` search · `Ctrl+N` new · `Ctrl+G` generator ·
`Ctrl+D` dashboard · `Ctrl+L` lock · `Ctrl+Shift+A` Quick Capture · `Ctrl+Q` quit.

## Build & install

```bash
cd desktop
./build.sh --install-deps   # first time only (installs Qt6 + libsodium + cmake)
./build.sh                  # builds and packages saleh-vault_1.0.0_amd64.deb
sudo apt install ./build/saleh-vault_1.0.0_amd64.deb
```

Then launch **Vault** from your apps menu (GNOME or KDE), or run `saleh-vault`.

Other options:

```bash
./build.sh --run       # build & launch without packaging
./build.sh --test      # build & run the crypto self-test
./build.sh --install   # build then install system-wide (no .deb)
./build.sh --clean     # fresh build
```

Uninstall: `sudo apt remove saleh-vault`.

## Requirements

- Ubuntu/Kubuntu: `build-essential cmake qt6-base-dev libsodium-dev libssl-dev`
- Fedora: `gcc-c++ cmake qt6-qtbase-devel libsodium-devel openssl-devel rpm-build`
- Runtime (browser import): Qt SQLite driver (ships with Qt) + OpenSSL; install
  `libsecret-tools` (provides `secret-tool`) to unlock passwords stored behind
  the GNOME/KDE keyring.

Everything is local and open source. Your master password never leaves the
machine.
