# saleh.im — Portfolio & Resume

The personal website of **Saleh Saghafiani** (محمدصالح ثقفیانی) — a self-taught
software & network engineer building fast, resilient systems at the edge since 2022.

Live sections: hero, about, skills, journey (since 2022), real GitHub projects,
a **live IP/geolocation API**, an **interactive Linux terminal**, and contact.
Plus two bundled apps — a **P2P messenger** and a **triple-layer encrypted secret chat**.

## ✨ Features

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, statically exported (`output: export`).
- **Light / dark theme** (white & black) with `next-themes`, dark by default.
- **Buttery-smooth, mobile-first** animations — compositor-only transforms, a single
  `IntersectionObserver` for reveals, `passive` scroll listeners, and
  `prefers-reduced-motion` support. No scroll-jank.
- **Live IP & Location API** — a Cloudflare Pages Function at `/api/ip` reading edge
  geo-data, with a public-provider fallback so it works everywhere.
- **Interactive terminal** — auto-typing boot sequence, then a real, typeable shell
  (`saleh@saleh.im`, black/green) with commands: `help`, `about`, `projects`,
  `neofetch`, `skills`, and more. Supports command history (↑/↓).
- **Two shipped apps** (see below), linked from the Projects section.
- Deploys to **Cloudflare Pages / Workers** via **GitHub Actions**.

## 🧩 Bundled apps

| App | Path | What it is |
|-----|------|-----------|
| **P2P Messenger** | [`/apps/messenger`](public/apps/messenger) | Serverless browser-to-browser chat over WebRTC DataChannels, with username/password sign-in. Content never touches a server. |
| **Secret Chat** | [`/apps/secret-chat`](public/apps/secret-chat) | Anti-surveillance chat with a **3-stage encryption pipeline** (AES-256-GCM → AES-256-GCM → HMAC-SHA256 keystream + HMAC auth), ephemeral keys, padded ciphertext, zero metadata and optional self-destruct. |

> The secret-chat crypto is a real, layered construction built for privacy-by-default
> UX and learning. For life-or-death threat models, prefer a vetted protocol (e.g. Signal).

## 🚀 Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to ./out
```

## ☁️ Deployment (Cloudflare Pages via GitHub Actions)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the static
site and deploys `./out` (plus the `/functions` edge API) to Cloudflare Pages.

Add two repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Token with the **Cloudflare Pages: Edit** permission |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

Without the secrets, CI still builds and uploads the site as an artifact.

Manual deploy:

```bash
npm run build
npx wrangler pages deploy out --project-name=saleh-im
```

## 🗂 Structure

```
app/                # Next.js App Router (layout, page, styles)
components/         # UI sections (hero, about, terminal, ip-tool, …)
lib/data.ts         # Real profile + project data (from github.com/W2F-Sa)
functions/api/ip.ts # Cloudflare Pages Function — GET /api/ip
public/apps/        # P2P messenger + Secret Chat
.github/workflows/  # Build & deploy pipeline
```

## 📬 Contact

- **Email:** salehcodez@gmail.com
- **Telegram:** [@dm_saleh](https://t.me/dm_saleh)
- **GitHub:** [@W2F-Sa](https://github.com/W2F-Sa)

---

© Saleh Saghafiani · MIT License
