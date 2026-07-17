// ============================================================================
//  Rift — procedural audio engine.
//
//  Zero binary assets: every shot, hit, explosion, pickup chime and the
//  ambient combat pulse are synthesized live with the Web Audio API. This
//  mirrors the pattern used by Vanguard's audio engine but is tuned for
//  Rift's neon-arcade tone — brighter, more melodic, less "military".
// ============================================================================

export type RiftSound =
  | "shoot" | "shotgunBlast" | "railShot" | "laserTick" | "missileLaunch" | "orbitalHit"
  | "hit" | "crit" | "kill" | "bossHit" | "bossSlam" | "explosion"
  | "hurt" | "coreHurt" | "shieldUp" | "shieldBreak" | "pickupGold" | "pickupHeal"
  | "levelUp" | "waveStart" | "bossIntro" | "victory" | "defeat" | "ui" | "abilityReady" | "abilityUse" | "achievement";

export class RiftAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private enabled = true;
  private musicEnabled = true;

  masterVolume = 0.85;
  sfxVolume = 0.9;
  musicVolume = 0.3;

  init() {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    } catch {
      this.enabled = false;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.masterVolume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);

    const len = Math.floor(ctx.sampleRate * 0.6);
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.masterVolume : 0;
  }
  setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
    if (this.musicGain) this.musicGain.gain.value = on ? this.musicVolume : 0;
    if (!on) this.stopMusic();
  }
  setMaster(v: number) { this.masterVolume = v; if (this.master && this.enabled) this.master.gain.value = v; }
  setSfx(v: number) { this.sfxVolume = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
  setMusicVolume(v: number) { this.musicVolume = v; if (this.musicGain && this.musicEnabled) this.musicGain.gain.value = v; }

  private now() { return this.ctx ? this.ctx.currentTime : 0; }

  private tone(o: { type: OscillatorType; f0: number; f1?: number; dur: number; gain: number; delay?: number }) {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const t0 = this.now() + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }

  private noise(o: { dur: number; gain: number; f0: number; f1: number; type?: BiquadFilterType; q?: number }) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type ?? "bandpass";
    filter.frequency.setValueAtTime(o.f0, this.now());
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), this.now() + o.dur);
    filter.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain, this.now());
    g.gain.exponentialRampToValueAtTime(0.0001, this.now() + o.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start();
    src.stop(this.now() + o.dur + 0.02);
  }

  play(name: RiftSound, volume = 1) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    switch (name) {
      case "shoot": this.tone({ type: "square", f0: 780, f1: 260, dur: 0.06, gain: 0.12 * volume }); break;
      case "shotgunBlast": this.noise({ dur: 0.18, gain: 0.4 * volume, f0: 1400, f1: 200, type: "lowpass" }); break;
      case "railShot": this.tone({ type: "sawtooth", f0: 1600, f1: 200, dur: 0.16, gain: 0.22 * volume }); break;
      case "laserTick": this.tone({ type: "sine", f0: 2200, f1: 1800, dur: 0.02, gain: 0.05 * volume }); break;
      case "missileLaunch": this.tone({ type: "sawtooth", f0: 200, f1: 500, dur: 0.3, gain: 0.16 * volume }); break;
      case "orbitalHit": this.tone({ type: "triangle", f0: 900, f1: 500, dur: 0.05, gain: 0.16 * volume }); break;
      case "hit": this.tone({ type: "triangle", f0: 700, f1: 400, dur: 0.05, gain: 0.15 * volume }); break;
      case "crit": this.tone({ type: "triangle", f0: 1300, f1: 700, dur: 0.09, gain: 0.22 * volume }); break;
      case "kill": this.tone({ type: "sine", f0: 660, dur: 0.09, gain: 0.2 * volume }); this.tone({ type: "sine", f0: 990, dur: 0.12, gain: 0.2 * volume, delay: 0.07 }); break;
      case "bossHit": this.tone({ type: "square", f0: 220, f1: 140, dur: 0.08, gain: 0.2 * volume }); break;
      case "bossSlam": this.noise({ dur: 0.4, gain: 0.6 * volume, f0: 700, f1: 50, type: "lowpass" }); break;
      case "explosion": this.noise({ dur: 0.55, gain: 0.7 * volume, f0: 900, f1: 40, type: "lowpass" }); this.tone({ type: "sawtooth", f0: 90, f1: 30, dur: 0.4, gain: 0.25 * volume }); break;
      case "hurt": this.noise({ dur: 0.13, gain: 0.25 * volume, f0: 500, f1: 180 }); break;
      case "coreHurt": this.tone({ type: "sawtooth", f0: 160, f1: 90, dur: 0.2, gain: 0.28 * volume }); break;
      case "shieldUp": this.tone({ type: "sine", f0: 400, f1: 800, dur: 0.25, gain: 0.2 * volume }); break;
      case "shieldBreak": this.noise({ dur: 0.3, gain: 0.4 * volume, f0: 1200, f1: 300 }); break;
      case "pickupGold": this.tone({ type: "sine", f0: 720, f1: 1080, dur: 0.1, gain: 0.16 * volume }); break;
      case "pickupHeal": this.tone({ type: "sine", f0: 500, f1: 760, dur: 0.16, gain: 0.18 * volume }); break;
      case "levelUp": [523, 659, 784].forEach((f, i) => this.tone({ type: "triangle", f0: f, dur: 0.2, gain: 0.2 * volume, delay: i * 0.08 })); break;
      case "waveStart": this.tone({ type: "sine", f0: 300, f1: 500, dur: 0.3, gain: 0.18 * volume }); break;
      case "bossIntro": [200, 150, 100].forEach((f, i) => this.tone({ type: "sawtooth", f0: f, dur: 0.5, gain: 0.22 * volume, delay: i * 0.2 })); break;
      case "victory": [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: "triangle", f0: f, dur: 0.25, gain: 0.22 * volume, delay: i * 0.13 })); break;
      case "defeat": [392, 330, 262, 196].forEach((f, i) => this.tone({ type: "sawtooth", f0: f, dur: 0.3, gain: 0.2 * volume, delay: i * 0.15 })); break;
      case "ui": this.tone({ type: "sine", f0: 520, f1: 640, dur: 0.05, gain: 0.14 * volume }); break;
      case "abilityReady": this.tone({ type: "sine", f0: 880, dur: 0.12, gain: 0.16 * volume }); break;
      case "abilityUse": this.tone({ type: "sawtooth", f0: 300, f1: 900, dur: 0.2, gain: 0.2 * volume }); break;
      case "achievement": [660, 880, 1100].forEach((f, i) => this.tone({ type: "sine", f0: f, dur: 0.18, gain: 0.2 * volume, delay: i * 0.1 })); break;
    }
  }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null || !this.musicEnabled) return;
    const scale = [220, 277.2, 329.6, 440, 554.4];
    this.musicTimer = window.setInterval(() => {
      if (!this.enabled || !this.musicEnabled) return;
      const step = this.musicStep++;
      if (step % 2 === 0) this.tone({ type: "sine", f0: 55, dur: 0.4, gain: 0.4, delay: 0 });
      if (step % 3 === 0) {
        const note = scale[Math.floor(Math.random() * scale.length)];
        if (this.musicGain && this.ctx) {
          const t0 = this.now();
          const osc = this.ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.value = note;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
          osc.connect(g);
          g.connect(this.musicGain);
          osc.start(t0);
          osc.stop(t0 + 0.45);
        }
      }
    }, 280);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  dispose() {
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
