const KEY = "vault_captured";
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");

let data = [];
let filter = "";

const load = async () => {
  const o = await chrome.storage.local.get(KEY);
  data = Array.isArray(o[KEY]) ? o[KEY] : [];
  render();
};
const persist = async () => {
  await chrome.storage.local.set({ [KEY]: data });
  try {
    chrome.action.setBadgeText({ text: data.length ? String(data.length) : "" });
  } catch (_) {}
};

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );

function render() {
  countEl.textContent = `${data.length} saved login${data.length === 1 ? "" : "s"}`;
  const q = filter.trim().toLowerCase();
  const rows = data.filter(
    (c) => !q || (c.site + " " + (c.username || "") + " " + (c.title || "")).toLowerCase().includes(q),
  );

  emptyEl.hidden = data.length !== 0;
  listEl.innerHTML = "";
  if (!rows.length) return;

  rows.forEach((c) => {
    const idx = data.indexOf(c);
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="fav">${esc((c.site || "?")[0].toUpperCase())}</div>
      <div class="info">
        <div class="site">${esc(c.site || c.title || c.origin)}</div>
        <div class="user">${esc(c.username || "(no username)")}</div>
        <div class="pw" data-pw="${esc(c.password)}">••••••••</div>
      </div>
      <div class="actions">
        <button class="icon-btn reveal" title="Show / hide password">👁</button>
        <button class="icon-btn copy" title="Copy password">⧉</button>
        <button class="icon-btn del" title="Delete">✕</button>
      </div>`;

    row.querySelector(".reveal").addEventListener("click", () => {
      const el = row.querySelector(".pw");
      el.textContent = el.textContent === "••••••••" ? c.password : "••••••••";
    });
    row.querySelector(".copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(c.password); } catch (_) {}
    });
    row.querySelector(".del").addEventListener("click", async () => {
      data.splice(idx, 1);
      await persist();
      render();
    });
    listEl.appendChild(row);
  });
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CSV shaped exactly how the Vault importer expects (name,url,username,password)
function toCsv(rows) {
  const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const head = "name,url,username,password";
  const body = rows.map((c) => [c.title || c.site, c.url || c.origin, c.username || "", c.password].map(q).join(","));
  return [head, ...body].join("\r\n");
}

document.getElementById("exportJson").addEventListener("click", () => {
  const out = data.map((c) => ({ title: c.title || c.site, url: c.url || c.origin, username: c.username || "", password: c.password }));
  download("vault-logins.json", JSON.stringify(out, null, 2), "application/json");
});
document.getElementById("exportCsv").addEventListener("click", () => {
  download("vault-logins.csv", toCsv(data), "text/csv");
});
document.getElementById("clear").addEventListener("click", async () => {
  if (!data.length) return;
  if (!confirm("Delete all captured logins?")) return;
  data = [];
  await persist();
  render();
});
searchEl.addEventListener("input", (e) => { filter = e.target.value; render(); });

load();
