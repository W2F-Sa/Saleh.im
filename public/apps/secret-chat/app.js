/**
 * Secret Chat — anti-surveillance P2P messenger.
 *
 * Two peers agree on a Room ID + shared secret out-of-band. A room *token*
 * is derived from both (so the signalling broker never sees the real room),
 * peers connect over WebRTC, and every message is run through the
 * TripleCrypto 3-layer pipeline before it crosses the wire.
 *
 * Anti-tracking: ephemeral in-memory keys, random ciphertext padding,
 * zero persistence/logging, optional 60s self-destruct of the transcript.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var peer = null;
  var keys = null;
  var conn = null;
  var handle = "anon";
  var isInitiator = false;
  var destructTimers = [];

  function time() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function sys(text) {
    var d = document.createElement("div");
    d.className = "sys-msg";
    d.innerHTML = text;
    $("messages").appendChild(d);
    $("messages").scrollTop = $("messages").scrollHeight;
  }

  function bubble(mine, text) {
    var d = document.createElement("div");
    d.className = "bubble " + (mine ? "me" : "them");
    d.innerHTML = escapeHtml(text) + '<span class="time">' + time() + " · 🔒</span>";
    $("messages").appendChild(d);
    $("messages").scrollTop = $("messages").scrollHeight;

    if ($("self-destruct").checked) {
      var t = setTimeout(function () {
        d.classList.add("burning");
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 600);
      }, 60000);
      destructTimers.push(t);
    }
  }

  function setConnected(ok) {
    if (ok) {
      $("conn-status").innerHTML = '<i class="dot"></i> secure channel established';
      $("conn-status").classList.add("online");
      $("msg-input").disabled = false;
      $("send-btn").disabled = false;
      $("msg-input").focus();
    } else {
      $("conn-status").innerHTML = '<i class="dot"></i> peer disconnected';
      $("conn-status").classList.remove("online");
      $("msg-input").disabled = true;
      $("send-btn").disabled = true;
    }
  }

  function wire(c) {
    conn = c;
    c.on("open", function () {
      setConnected(true);
      sys("🔒 Encrypted channel open. Messages are protected by <b>3 layers</b> of encryption.");
    });
    c.on("data", async function (payload) {
      try {
        var text = await TripleCrypto.decrypt(keys, String(payload));
        bubble(false, text);
      } catch (e) {
        sys("⚠︎ Dropped a message that failed authentication (" + escapeHtml(e.message) + ").");
      }
    });
    c.on("close", function () { setConnected(false); });
    c.on("error", function () { sys("⚠︎ Connection error."); });
  }

  async function establish(h, room, secret) {
    handle = h;
    keys = await TripleCrypto.deriveKeys(secret);
    var token = await TripleCrypto.roomToken(room, secret);

    $("room-name").textContent = room;
    $("setup").classList.remove("active");
    $("chat").classList.add("active");
    sys("Deriving keys locally (PBKDF2 · 250k rounds)… done.");

    // Deterministic rendezvous: initiator claims <token>-a, else connects to it.
    peer = new Peer(token + "-a", { debug: 1, config: { iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ] } });

    peer.on("open", function () {
      isInitiator = true;
      sys("Waiting for your peer to join room <b>" + escapeHtml(room) + "</b>…");
    });

    peer.on("connection", function (c) { wire(c); });

    peer.on("error", function (err) {
      if (err && err.type === "unavailable-id") {
        // Someone is already the initiator → we join as the guest.
        peer = new Peer(token + "-b", { debug: 1 });
        peer.on("open", function () {
          var c = peer.connect(token + "-a", { reliable: true });
          wire(c);
        });
        peer.on("connection", function (c) { wire(c); });
        peer.on("error", function () { sys("⚠︎ Could not reach the room. Check the Room ID."); });
      } else {
        sys("⚠︎ " + (err.type || "connection error"));
      }
    });
  }

  function burn() {
    destructTimers.forEach(clearTimeout);
    if (conn) try { conn.close(); } catch (e) {}
    if (peer) try { peer.destroy(); } catch (e) {}
    keys = null; // drop keys from memory
    $("messages").innerHTML = "";
    sys("🔥 Session burned. Keys destroyed. Reloading…");
    setTimeout(function () { location.reload(); }, 900);
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("gen-room").addEventListener("click", function () {
      var bytes = crypto.getRandomValues(new Uint8Array(4));
      var s = "";
      for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
      $("room").value = "room-" + s;
    });

    $("setup-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var h = $("handle").value.trim() || "anon";
      var room = $("room").value.trim();
      var secret = $("secret").value;
      if (!room || secret.length < 6) return;
      establish(h, room, secret);
    });

    $("send-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var text = $("msg-input").value.trim();
      if (!text || !conn || !keys) return;
      $("msg-input").value = "";
      try {
        var payload = await TripleCrypto.encrypt(keys, text);
        conn.send(payload);
        bubble(true, text);
      } catch (err) {
        sys("⚠︎ Encryption failed: " + escapeHtml(err.message));
      }
    });

    $("burn").addEventListener("click", burn);
    window.addEventListener("beforeunload", function () { keys = null; });
  });
})();
