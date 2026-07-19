/* Vault Capture — background service worker.
 * Receives captured credentials from the content script and stores them in the
 * extension's own local storage (never leaves your machine). De-duplicates by
 * site + username, updating the password when it changes. */

const KEY = "vault_captured";

async function load() {
  const o = await chrome.storage.local.get(KEY);
  return Array.isArray(o[KEY]) ? o[KEY] : [];
}

async function save(list) {
  await chrome.storage.local.set({ [KEY]: list });
  setBadge(list.length);
}

function setBadge(n) {
  try {
    chrome.action.setBadgeText({ text: n ? String(n) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#6d5efc" });
  } catch (_) {}
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "vault-capture" && msg.cred && msg.cred.password) {
    (async () => {
      const list = await load();
      const c = msg.cred;
      const i = list.findIndex((x) => x.origin === c.origin && x.username === c.username);
      if (i >= 0) {
        list[i] = { ...list[i], ...c, updated: c.ts, count: (list[i].count || 1) + 1 };
      } else {
        list.unshift({ ...c, updated: c.ts, count: 1 });
      }
      await save(list);
      sendResponse({ ok: true, count: list.length });
    })();
    return true; // keep the message channel open for the async reply
  }
  return false;
});

chrome.runtime.onInstalled.addListener(async () => setBadge((await load()).length));
if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(async () => setBadge((await load()).length));
}
