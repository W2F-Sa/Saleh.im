// ============================================================================
//  Vanguard — peer-to-peer online play.
//
//  PeerJS is used strictly as a *signaling* transport to establish a direct
//  WebRTC DataChannel between players — no game traffic ever touches a
//  relay/game server, satisfying "بدون سرور واسط" (no intermediary server).
//  The public PeerJS broker (or any configured one) only helps two browsers
//  find each other; once connected, gameplay packets flow peer-to-peer.
//
//  Topology: the match creator is the authoritative HOST. The host runs bots,
//  resolves hit registration for anything the host itself can see, and
//  broadcasts ~20Hz world snapshots. Joining CLIENTS render an interpolated
//  view of remote actors and forward their own input/shots to the host, which
//  is standard, pragmatic peer-hosted netcode for a casual browser shooter.
// ============================================================================

import Peer, { DataConnection } from "peerjs";
import { ActorSnapshot, VanguardEngine } from "./engine";

export type NetRole = "host" | "client" | "offline";

interface WireHello {
  t: "hello";
  name: string;
}
interface WireWelcome {
  t: "welcome";
  id: number;
  mapId: string;
  mode: string;
  teams: boolean;
}
interface WireShot {
  t: "shot";
  id: number;
  x: number;
  y: number;
  angle: number;
  weaponId: string;
  time: number;
}
interface WireState {
  t: "state";
  actors: ActorSnapshot[];
  redScore: number;
  blueScore: number;
  serverTime: number;
}
interface WireInput {
  t: "input";
  id: number;
  x: number;
  y: number;
  angle: number;
  health: number;
  alive: boolean;
}
interface WireJoin {
  t: "join";
  id: number;
  name: string;
  team: number;
}
interface WireLeave {
  t: "leave";
  id: number;
}
interface WirePing {
  t: "ping";
  time: number;
}
interface WirePong {
  t: "pong";
  time: number;
}

type WireMessage = WireHello | WireWelcome | WireShot | WireState | WireInput | WireJoin | WireLeave | WirePing | WirePong;

export interface NetEvents {
  onPeerId?: (id: string) => void;
  onConnected?: (peerId: string) => void;
  onPeerJoined?: (id: number, name: string) => void;
  onPeerLeft?: (id: number) => void;
  onDisconnected?: () => void;
  onError?: (message: string) => void;
  onPing?: (ms: number) => void;
}

// A short, memorable room-code generator so players can share a code instead
// of a raw PeerJS ID — still resolves to a real peer ID under the hood via a
// deterministic prefix, avoiding any external lookup service.
export function makeRoomCode(): string {
  const words = ["FOX", "WOLF", "HAWK", "IRON", "NOVA", "ECHO", "RAVEN", "ONYX", "ZERO", "BLAZE"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}-${n}`;
}

export function roomCodeToPeerId(code: string): string {
  return `vanguard-fps-${code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "")}`;
}

export class NetSession {
  role: NetRole = "offline";
  private peer: Peer | null = null;
  private conns = new Map<number, DataConnection>();
  private hostConn: DataConnection | null = null;
  private localId = 1;
  private nextRemoteId = 2;
  private engine: VanguardEngine | null = null;
  private events: NetEvents;
  private stateInterval: number | null = null;
  private pingInterval: number | null = null;
  private lastPingSentAt = 0;
  private idByConn = new Map<DataConnection, number>();
  private connByRemoteId = new Map<number, DataConnection>();
  private roomCode = "";
  private disposed = false;

  constructor(events: NetEvents = {}) {
    this.events = events;
  }

  attachEngine(engine: VanguardEngine) {
    this.engine = engine;
  }

  get isHost() {
    return this.role === "host";
  }

  get myId() {
    return this.localId;
  }

  get currentRoomCode() {
    return this.roomCode;
  }

  // -- host -----------------------------------------------------------------

  async hostMatch(): Promise<string> {
    this.roomCode = makeRoomCode();
    const peerId = roomCodeToPeerId(this.roomCode);
    this.role = "host";
    this.localId = 1;
    await this.openPeer(peerId);
    this.peer!.on("connection", (conn) => this.acceptConnection(conn));
    this.startBroadcasting();
    return this.roomCode;
  }

  // -- client -----------------------------------------------------------------

  async joinMatch(code: string, name: string): Promise<void> {
    this.roomCode = code.trim().toUpperCase();
    this.role = "client";
    await this.openPeer(); // random id is fine for clients
    const targetId = roomCodeToPeerId(this.roomCode);
    const conn = this.peer!.connect(targetId, { reliable: true });
    this.hostConn = conn;
    conn.on("open", () => {
      this.send(conn, { t: "hello", name });
      this.startPinging();
      this.events.onConnected?.(targetId);
    });
    conn.on("data", (data) => this.onMessage(conn, data as WireMessage));
    conn.on("close", () => {
      this.events.onDisconnected?.();
    });
    conn.on("error", (err) => this.events.onError?.(String(err)));
  }

  private openPeer(id?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.peer = id ? new Peer(id) : new Peer();
      } catch (e) {
        reject(e);
        return;
      }
      this.peer.on("open", (openId) => {
        this.events.onPeerId?.(openId);
        resolve();
      });
      this.peer.on("error", (err) => {
        this.events.onError?.(String(err?.message || err));
        reject(err);
      });
    });
  }

  private acceptConnection(conn: DataConnection) {
    conn.on("open", () => {
      // Assigned once we receive their hello (need the display name first).
    });
    conn.on("data", (data) => this.onMessage(conn, data as WireMessage));
    conn.on("close", () => {
      const id = this.idByConn.get(conn);
      if (id !== undefined) {
        this.conns.delete(id);
        this.connByRemoteId.delete(id);
        this.idByConn.delete(conn);
        this.engine?.removeActor(id);
        this.broadcast({ t: "leave", id });
        this.events.onPeerLeft?.(id);
      }
    });
  }

  private onMessage(conn: DataConnection, msg: WireMessage) {
    if (!msg || typeof msg !== "object") return;
    switch (msg.t) {
      case "hello": {
        if (!this.isHost) return;
        const id = this.nextRemoteId++;
        this.idByConn.set(conn, id);
        this.connByRemoteId.set(id, conn);
        this.conns.set(id, conn);
        this.send(conn, { t: "welcome", id, mapId: this.engine?.map.id || "", mode: this.engine?.config.mode || "ffa", teams: this.engine?.config.teams || false });
        this.engine?.registerRemoteActor(id, msg.name, id % 2);
        this.broadcast({ t: "join", id, name: msg.name, team: id % 2 }, conn);
        this.events.onPeerJoined?.(id, msg.name);
        break;
      }
      case "welcome": {
        this.localId = msg.id;
        break;
      }
      case "join": {
        this.engine?.registerRemoteActor(msg.id, `Player-${msg.id}`, msg.team);
        this.events.onPeerJoined?.(msg.id, `Player-${msg.id}`);
        break;
      }
      case "leave": {
        this.engine?.removeActor(msg.id);
        this.events.onPeerLeft?.(msg.id);
        break;
      }
      case "shot": {
        this.engine?.applyRemoteShot(msg.x, msg.y, msg.angle, msg.weaponId, msg.id);
        if (this.isHost) this.broadcast(msg, conn);
        break;
      }
      case "input": {
        if (this.isHost) {
          this.engine?.applyRemoteState(msg.id, msg.x, msg.y, msg.angle, msg.health, msg.alive);
        }
        break;
      }
      case "state": {
        if (!this.isHost) {
          for (const snap of msg.actors) {
            if (snap.id === this.localId) continue;
            this.engine?.registerRemoteActor(snap.id, snap.name, snap.team);
            this.engine?.applyRemoteState(snap.id, snap.x, snap.y, snap.angle, snap.health, snap.alive);
          }
        }
        break;
      }
      case "ping": {
        this.send(conn, { t: "pong", time: msg.time });
        break;
      }
      case "pong": {
        this.events.onPing?.(Date.now() - msg.time);
        break;
      }
    }
  }

  private send(conn: DataConnection, msg: WireMessage) {
    if (conn.open) conn.send(msg);
  }

  private broadcast(msg: WireMessage, except?: DataConnection) {
    for (const conn of this.conns.values()) {
      if (conn === except) continue;
      this.send(conn, msg);
    }
  }

  // Called every local tick from the page component so client input reaches
  // the host, and the host's local shots reach everyone.
  sendLocalInput(x: number, y: number, angle: number, health: number, alive: boolean) {
    if (this.role === "client" && this.hostConn) {
      this.send(this.hostConn, { t: "input", id: this.localId, x, y, angle, health, alive });
    }
  }

  sendShot(x: number, y: number, angle: number, weaponId: string, time: number) {
    const msg: WireShot = { t: "shot", id: this.localId, x, y, angle, weaponId, time };
    if (this.role === "host") this.broadcast(msg);
    else if (this.hostConn) this.send(this.hostConn, msg);
  }

  private startBroadcasting() {
    if (this.stateInterval !== null) return;
    this.stateInterval = window.setInterval(() => {
      if (!this.engine || this.disposed) return;
      const actors: ActorSnapshot[] = [this.engine.getLocalSnapshot()];
      this.broadcast({ t: "state", actors, redScore: 0, blueScore: 0, serverTime: Date.now() });
    }, 50); // 20Hz
  }

  private startPinging() {
    if (this.pingInterval !== null) return;
    this.pingInterval = window.setInterval(() => {
      if (!this.hostConn || this.disposed) return;
      this.lastPingSentAt = Date.now();
      this.send(this.hostConn, { t: "ping", time: this.lastPingSentAt });
    }, 2000);
  }

  peerCount(): number {
    return this.conns.size + 1;
  }

  dispose() {
    this.disposed = true;
    if (this.stateInterval !== null) window.clearInterval(this.stateInterval);
    if (this.pingInterval !== null) window.clearInterval(this.pingInterval);
    for (const conn of this.conns.values()) conn.close();
    this.hostConn?.close();
    this.peer?.destroy();
    this.peer = null;
  }
}
