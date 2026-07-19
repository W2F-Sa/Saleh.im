# Vault Capture — browser extension

Automatically saves the **username + password you submit on any website** and
keeps them in one list, ready to import into [Vault](https://saleh.im/vault).

## Why an extension (and not the website)?

A web page — including `saleh.im/vault` — **cannot** read the login form of a
different website. Browsers isolate every site from every other site (the
same-origin policy), so a page can never see what you type on `gmail.com`,
`instagram.com`, etc. That is a hard security boundary, not a bug.

The **only** software that is allowed to watch the form on the page you're
actually on is a browser extension. That's exactly what this is: a tiny
content script that notices when you sign in and records the credentials
locally — nothing is sent anywhere.

## Install (Chrome / Edge / Brave)

1. Go to `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin **Vault Capture** to the toolbar.

## How it works

- On every page, `content.js` listens for a login: a form submit, an Enter
  press inside a password field, or a click on a "Log in / Sign in" button.
- When that happens it reads the password field and the nearest
  username/email field and sends them to `background.js`.
- `background.js` stores them in the extension's local storage
  (`chrome.storage.local`), de-duplicating by site + username and updating the
  password if it changed. The toolbar badge shows how many are saved.

## Getting them into Vault

Open the popup and choose **Export CSV** (or **Export JSON**). The CSV uses the
`name,url,username,password` header, which the Vault **Import & Detect** screen
reads directly — open Vault, unlock, click **Import**, and drop the file in.

## Privacy

- Credentials never leave your device. There is no server, no analytics, no
  network request of any kind.
- Everything lives in the extension's local storage; **Clear all** wipes it.
- Review the source — it's three small, unminified files.
