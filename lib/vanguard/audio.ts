// ============================================================================
//  Vanguard — procedural audio.
//
//  All sound is synthesized at runtime with the Web Audio API so the game
//  ships zero binary assets and stays instant to load. Each weapon report,
//  explosion, footstep and UI blip is generated from oscillators and shaped
//  noise. A tiny master bus adds gentle compression + reverb for punch.
// ============================================================================

export type SoundName =
  | "pistol" | "smg" | "shotgun" | "rifle" | "sniper" | "lmg" | "rocket" | "knife"
  | "hit" | "headshot" | "kill" | "hurt" | "reload" | "empty" | "pickup"
  | "footstep" | "explosion" | "ui" | "spawn" | "victory" | "defeat" | "countdown";

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled = true;
  private lastFootstep = 0;
  private musicTimer: number | null = null;
  private musicStep = 0;

  masterVolume = 0.8;
  sfxVolume = 0.9;
  musicVolume = 0.35;

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
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);

    // Simple synthetic impulse response for a short room reverb.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(1.4, 2.2);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.22;
    this.reverb.connect(reverbGain);
    reverbGain.connect(this.master);

    this.noiseBuffer = this.makeNoise(1.0);
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? this.masterVolume : 0;
  }

  setMaster(v: number) {
    this.masterVolume = v;
    if (this.master && this.enabled) this.master.gain.value = v;
  }

  setSfx(v: number) {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMusic(v: number) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  private makeImpulse(duration: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  private makeNoise(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    return src;
  }

  // Short shaped noise burst — the backbone of gunfire and explosions.
  private burst(opts: {
    duration: number;
    gain: number;
    filterType: BiquadFilterType;
    freqStart: number;
    freqEnd: number;
    q?: number;
    reverb?: number;
  }) {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const src = this.noiseSource();
    if (!src) return;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.frequency.setValueAtTime(opts.freqStart, this.now());
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), this.now() + opts.duration);
    filter.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain, this.now());
    g.gain.exponentialRampToValueAtTime(0.0001, this.now() + opts.duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    if (opts.reverb && this.reverb) g.connect(this.reverb);
    src.start();
    src.stop(this.now() + opts.duration + 0.02);
  }

  // A pitched tone with an envelope — used for beeps, hits and stingers.
  private tone(opts: {
    type: OscillatorType;
    freqStart: number;
    freqEnd?: number;
    duration: number;
    gain: number;
    delay?: number;
    target?: "sfx" | "music";
  }) {
    if (!this.ctx) return;
    const bus = opts.target === "music" ? this.musicGain : this.sfxGain;
    if (!bus) return;
    const ctx = this.ctx;
    const t0 = this.now() + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freqStart, t0);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t0 + opts.duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
    osc.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.02);
  }

  play(name: SoundName, volume = 1) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    switch (name) {
      case "pistol":
        this.burst({ duration: 0.12, gain: 0.5 * volume, filterType: "bandpass", freqStart: 1800, freqEnd: 400, q: 1.2, reverb: 0.3 });
        this.tone({ type: "square", freqStart: 220, freqEnd: 90, duration: 0.08, gain: 0.15 * volume });
        break;
      case "smg":
        this.burst({ duration: 0.07, gain: 0.35 * volume, filterType: "bandpass", freqStart: 2200, freqEnd: 700, q: 1.5 });
        this.tone({ type: "square", freqStart: 180, freqEnd: 100, duration: 0.05, gain: 0.1 * volume });
        break;
      case "rifle":
        this.burst({ duration: 0.14, gain: 0.55 * volume, filterType: "bandpass", freqStart: 1600, freqEnd: 300, q: 1.1, reverb: 0.4 });
        this.tone({ type: "sawtooth", freqStart: 160, freqEnd: 70, duration: 0.1, gain: 0.18 * volume });
        break;
      case "shotgun":
        this.burst({ duration: 0.22, gain: 0.7 * volume, filterType: "lowpass", freqStart: 1200, freqEnd: 120, q: 0.8, reverb: 0.5 });
        this.tone({ type: "sawtooth", freqStart: 130, freqEnd: 50, duration: 0.16, gain: 0.22 * volume });
        break;
      case "sniper":
        this.burst({ duration: 0.3, gain: 0.75 * volume, filterType: "bandpass", freqStart: 1400, freqEnd: 200, q: 0.9, reverb: 0.7 });
        this.tone({ type: "sawtooth", freqStart: 140, freqEnd: 45, duration: 0.24, gain: 0.24 * volume });
        break;
      case "lmg":
        this.burst({ duration: 0.11, gain: 0.5 * volume, filterType: "bandpass", freqStart: 1500, freqEnd: 350, q: 1.0, reverb: 0.3 });
        this.tone({ type: "square", freqStart: 150, freqEnd: 80, duration: 0.08, gain: 0.16 * volume });
        break;
      case "rocket":
        this.burst({ duration: 0.4, gain: 0.4 * volume, filterType: "lowpass", freqStart: 800, freqEnd: 60, q: 0.7 });
        this.tone({ type: "sawtooth", freqStart: 200, freqEnd: 40, duration: 0.3, gain: 0.2 * volume });
        break;
      case "explosion":
        this.burst({ duration: 0.7, gain: 0.9 * volume, filterType: "lowpass", freqStart: 900, freqEnd: 40, q: 0.6, reverb: 0.8 });
        this.tone({ type: "sawtooth", freqStart: 90, freqEnd: 30, duration: 0.5, gain: 0.3 * volume });
        break;
      case "knife":
        this.burst({ duration: 0.14, gain: 0.4 * volume, filterType: "highpass", freqStart: 3000, freqEnd: 1200, q: 2 });
        break;
      case "hit":
        this.tone({ type: "triangle", freqStart: 900, freqEnd: 500, duration: 0.06, gain: 0.25 * volume });
        break;
      case "headshot":
        this.tone({ type: "triangle", freqStart: 1400, freqEnd: 700, duration: 0.09, gain: 0.3 * volume });
        this.tone({ type: "sine", freqStart: 1800, freqEnd: 900, duration: 0.12, gain: 0.2 * volume, delay: 0.02 });
        break;
      case "kill":
        this.tone({ type: "sine", freqStart: 660, duration: 0.1, gain: 0.25 * volume });
        this.tone({ type: "sine", freqStart: 990, duration: 0.14, gain: 0.25 * volume, delay: 0.09 });
        break;
      case "hurt":
        this.burst({ duration: 0.16, gain: 0.3 * volume, filterType: "bandpass", freqStart: 500, freqEnd: 180, q: 1 });
        break;
      case "reload":
        this.tone({ type: "square", freqStart: 300, freqEnd: 200, duration: 0.05, gain: 0.12 * volume });
        this.tone({ type: "square", freqStart: 420, freqEnd: 300, duration: 0.05, gain: 0.12 * volume, delay: 0.14 });
        break;
      case "empty":
        this.tone({ type: "square", freqStart: 260, freqEnd: 240, duration: 0.04, gain: 0.12 * volume });
        break;
      case "pickup":
        this.tone({ type: "sine", freqStart: 620, freqEnd: 880, duration: 0.12, gain: 0.2 * volume });
        break;
      case "footstep":
        this.burst({ duration: 0.05, gain: 0.12 * volume, filterType: "lowpass", freqStart: 320, freqEnd: 120, q: 0.6 });
        break;
      case "ui":
        this.tone({ type: "sine", freqStart: 520, freqEnd: 640, duration: 0.06, gain: 0.18 * volume });
        break;
      case "spawn":
        this.tone({ type: "sine", freqStart: 300, freqEnd: 600, duration: 0.25, gain: 0.2 * volume });
        break;
      case "countdown":
        this.tone({ type: "sine", freqStart: 700, duration: 0.12, gain: 0.25 * volume });
        break;
      case "victory":
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone({ type: "triangle", freqStart: f, duration: 0.24, gain: 0.25 * volume, delay: i * 0.14 }),
        );
        break;
      case "defeat":
        [392, 330, 262, 196].forEach((f, i) =>
          this.tone({ type: "sawtooth", freqStart: f, duration: 0.3, gain: 0.22 * volume, delay: i * 0.16 }),
        );
        break;
    }
  }

  footstep(t: number) {
    if (t - this.lastFootstep < 0.32) return;
    this.lastFootstep = t;
    this.play("footstep");
  }

  // A minimal generative combat loop — a pulsing bass with sparse arps.
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const scale = [110, 138.6, 164.8, 220, 277.2, 329.6];
    const tick = () => {
      if (!this.enabled) return;
      const step = this.musicStep++;
      if (step % 2 === 0) {
        this.tone({ type: "sine", freqStart: 55, freqEnd: 55, duration: 0.4, gain: 0.5, target: "music" });
      }
      if (step % 4 === 0) {
        const note = scale[Math.floor(Math.random() * scale.length)];
        this.tone({ type: "triangle", freqStart: note, duration: 0.5, gain: 0.25, target: "music" });
      }
      if (step % 8 === 3) {
        const note = scale[Math.floor(Math.random() * scale.length)] * 2;
        this.tone({ type: "sawtooth", freqStart: note, duration: 0.3, gain: 0.12, target: "music" });
      }
    };
    this.musicTimer = window.setInterval(tick, 260);
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
