/* Vault Capture — content script.
 *
 * Runs on every page. When you submit a login form (or press Enter / click a
 * login button next to a password field), it reads the username + password and
 * hands them to the background worker, which stores them. This is the ONLY way
 * a tool can auto-save credentials you type on other websites — a normal web
 * page (like saleh.im) can never see another site's form, but an extension
 * content script can, on the page you're actually on. */
(function () {
  if (window.__vaultCaptureLoaded) return;
  window.__vaultCaptureLoaded = true;

  const TEXTY = ["text", "email", "tel", "number", ""];
  const looksLikeUsername = (el) => {
    const s = [el.name, el.id, el.autocomplete, el.placeholder, el.getAttribute("aria-label")]
      .filter(Boolean).join(" ").toLowerCase();
    return el.type === "email" || /user|email|login|phone|mobile|account|mail|uname|nick|نام|ایمیل|کاربری|موبایل/.test(s);
  };

  function findUsername(pwEl) {
    const scope = pwEl.form || document;
    const inputs = Array.from(scope.querySelectorAll("input")).filter(
      (el) => !el.disabled && el.type !== "hidden",
    );
    const pwIndex = inputs.indexOf(pwEl);

    // 1) a username-ish field with a value, before the password
    for (let i = pwIndex - 1; i >= 0; i--) {
      const el = inputs[i];
      if (TEXTY.includes(el.type) && el.value && looksLikeUsername(el)) return el.value.trim();
    }
    // 2) any text field with a value, before the password
    for (let i = pwIndex - 1; i >= 0; i--) {
      const el = inputs[i];
      if (TEXTY.includes(el.type) && el.value) return el.value.trim();
    }
    // 3) any username-ish field anywhere on the page
    const any = inputs.find((el) => TEXTY.includes(el.type) && el.value && looksLikeUsername(el));
    return any ? any.value.trim() : "";
  }

  let lastKey = "";
  let lastAt = 0;

  function capture(pwEl) {
    if (!pwEl || !pwEl.value) return;
    const cred = {
      origin: location.origin,
      url: location.href.split("#")[0],
      site: location.hostname.replace(/^www\./, ""),
      title: (document.title || location.hostname).slice(0, 120),
      username: findUsername(pwEl),
      password: pwEl.value,
      ts: Date.now(),
    };
    const key = cred.origin + "|" + cred.username + "|" + cred.password;
    const now = Date.now();
    if (key === lastKey && now - lastAt < 4000) return; // dedupe rapid double-fires
    lastKey = key;
    lastAt = now;
    try {
      chrome.runtime.sendMessage({ type: "vault-capture", cred });
    } catch (_) {
      /* extension context invalidated (e.g. after reload) — ignore */
    }
  }

  const passwordIn = (node) => {
    const form = node && (node.form || (node.closest && node.closest("form")));
    return (form || document).querySelector('input[type="password"]');
  };

  // real form submissions
  document.addEventListener(
    "submit",
    (e) => {
      const pw = e.target && e.target.querySelector ? e.target.querySelector('input[type="password"]') : null;
      if (pw) capture(pw);
    },
    true,
  );

  // clicks on login / submit buttons (many SPAs never fire a form submit)
  const LOGIN_TEXT = /log ?in|sign ?in|submit|continue|next|ورود|وارد|ثبت|ادامه|登录|登入|로그인/i;
  document.addEventListener(
    "click",
    (e) => {
      const t = e.target && e.target.closest
        ? e.target.closest('button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]')
        : null;
      if (!t) return;
      const label = (t.value || t.textContent || t.getAttribute("aria-label") || "").trim();
      if (t.type !== "submit" && !LOGIN_TEXT.test(label)) return;
      const pw = passwordIn(t) || document.querySelector('input[type="password"]');
      if (pw) capture(pw);
    },
    true,
  );

  // Enter pressed inside a password field
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && e.target && e.target.type === "password") capture(e.target);
    },
    true,
  );
})();
