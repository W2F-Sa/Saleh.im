/**
 * Peer — a serverless P2P messenger.
 *
 * Data travels directly browser-to-browser over a WebRTC DataChannel (via PeerJS).
 * Only the initial handshake uses PeerJS's free broker; message content never
 * touches a server. Credentials derive a stable peer ID and are kept locally.
 */
(function () {
  "use strict";

  var peer = null;
  var me = null;
  var conns = {};        // peerId -> DataConnection
  var histories = {};    // peerId -> [{mine, text, ts}]
  var active = null;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- helpers ---------- */
  async function sha256Hex(str) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  // Build a deterministic, DNS-safe peer id from username+password.
  async function deriveId(username, password) {
    var h = await sha256Hex(username.toLowerCase() + ":" + password);
    return "salehim-" + username.toLowerCase().replace(/[^a-z0-9]/g, "") + "-" + h.slice(0, 8);
  }

  // Public id others use to connect = just the username part.
  function publicId(username, password) {
    // Peers connect using the username; we resolve to the full derived id.
    return username.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function time() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------- rendering ---------- */
  function renderPeerList() {
    var ul = $("peer-list");
    ul.innerHTML = "";
    Object.keys(conns).forEach(function (id) {
      var li = document.createElement("li");
      li.className = id === active ? "active" : "";
      li.innerHTML = '<span class="p-dot"></span>' + escapeHtml(labelFor(id));
      li.onclick = function () { openChat(id); };
      ul.appendChild(li);
    });
  }

  function labelFor(id) {
    // id looks like "salehim-<user>-<hash>"; show the <user> chunk.
    var parts = id.split("-");
    return parts.length >= 3 ? parts[1] : id;
  }

  function renderMessages() {
    var box = $("messages");
    box.innerHTML = "";
    if (!active || !histories[active]) {
      box.innerHTML = '<div class="empty"><div class="empty-icon">🔗</div><p>Connect to a peer by their username to start a direct chat.</p></div>';
      return;
    }
    histories[active].forEach(function (m) {
      if (m.sys) {
        var s = document.createElement("div");
        s.className = "sys-msg";
        s.textContent = m.text;
        box.appendChild(s);
        return;
      }
      var d = document.createElement("div");
      d.className = "bubble " + (m.mine ? "me" : "them");
      d.innerHTML = escapeHtml(m.text) + '<span class="time">' + m.ts + "</span>";
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }

  function pushMsg(id, msg) {
    if (!histories[id]) histories[id] = [];
    histories[id].push(msg);
    if (id === active) renderMessages();
  }

  function openChat(id) {
    active = id;
    $("chat-title").textContent = labelFor(id);
    $("chat-status").textContent = "Peer-to-peer · connected";
    $("msg-input").disabled = false;
    $("send-btn").disabled = false;
    $("app").classList.add("chatting");
    renderPeerList();
    renderMessages();
    $("msg-input").focus();
  }

  /* ---------- connection wiring ---------- */
  function wireConnection(conn) {
    conn.on("open", function () {
      conns[conn.peer] = conn;
      pushMsg(conn.peer, { sys: true, text: "🔒 Connected to " + labelFor(conn.peer) });
      renderPeerList();
      if (!active) openChat(conn.peer);
    });
    conn.on("data", function (data) {
      pushMsg(conn.peer, { mine: false, text: String(data), ts: time() });
    });
    conn.on("close", function () {
      pushMsg(conn.peer, { sys: true, text: "⚠︎ " + labelFor(conn.peer) + " disconnected" });
      delete conns[conn.peer];
      renderPeerList();
    });
    conn.on("error", function () {
      pushMsg(conn.peer, { sys: true, text: "Connection error." });
    });
  }

  function connectTo(username) {
    var target = "salehim-" + username.toLowerCase().replace(/[^a-z0-9]/g, "");
    // We don't know the peer's password hash, so we connect to their public prefix id.
    var conn = peer.connect(target, { reliable: true, metadata: { from: me.user } });
    wireConnection(conn);
  }

  /* ---------- boot ---------- */
  async function signIn(username, password) {
    var pub = publicId(username, password);
    // Register under the public id so others can find us by username alone.
    peer = new Peer("salehim-" + pub, {
      debug: 1,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" }
        ]
      }
    });

    me = { user: username, id: "salehim-" + pub };

    $("me-name").textContent = username;
    $("me-avatar").textContent = username.charAt(0);
    $("my-share").textContent = username;

    peer.on("open", function () {
      $("me-status").innerHTML = '<i class="dot"></i> online';
      $("me-status").classList.add("online");
    });
    peer.on("connection", function (conn) { wireConnection(conn); });
    peer.on("error", function (err) {
      if (err && err.type === "unavailable-id") {
        // Someone already online with this username: append hash suffix.
        deriveId(username, password).then(function (fullId) {
          peer = new Peer(fullId, {});
          me.id = fullId;
          peer.on("open", function () {
            $("me-status").innerHTML = '<i class="dot"></i> online';
            $("me-status").classList.add("online");
          });
          peer.on("connection", function (conn) { wireConnection(conn); });
        });
      } else {
        $("me-status").innerHTML = '<i class="dot"></i> ' + (err.type || "error");
      }
    });

    $("login").classList.remove("active");
    $("app").classList.add("active");
  }

  /* ---------- events ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    $("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var u = $("username").value.trim();
      var p = $("password").value;
      if (u.length < 3 || p.length < 4) return;
      signIn(u, p);
    });

    $("connect-btn").addEventListener("click", function () {
      var v = $("peer-id").value.trim();
      if (v) { connectTo(v); $("peer-id").value = ""; }
    });
    $("peer-id").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("connect-btn").click();
    });

    $("send-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var text = $("msg-input").value.trim();
      if (!text || !active || !conns[active]) return;
      conns[active].send(text);
      pushMsg(active, { mine: true, text: text, ts: time() });
      $("msg-input").value = "";
    });

    $("logout").addEventListener("click", function () {
      if (peer) peer.destroy();
      location.reload();
    });
  });
})();
