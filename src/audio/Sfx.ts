/** Tiny procedural WebAudio sound set; no assets. The context is created lazily on first gesture. */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slide = 0): void {
    const c = this.ensure();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  reveal(count = 1): void {
    this.tone(count > 6 ? 330 : 520, 0.07, 'triangle', 0.07, 0, -60);
  }
  flag(): void {
    this.tone(700, 0.06, 'square', 0.04);
    this.tone(930, 0.07, 'square', 0.04, 0.05);
  }
  shield(): void {
    this.tone(240, 0.25, 'sawtooth', 0.07, 0, 200);
  }
  ability(): void {
    this.tone(500, 0.1, 'sine', 0.08);
    this.tone(750, 0.14, 'sine', 0.08, 0.08);
  }
  age(): void {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.09, i * 0.11));
  }
  win(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.09, i * 0.12));
  }
  explode(): void {
    const c = this.ensure();
    if (!c) return;
    if (!this.noise) {
      this.noise = c.createBuffer(1, c.sampleRate * 0.9, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    }
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = c.createGain();
    g.gain.value = 0.5;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
    this.tone(90, 0.5, 'sine', 0.25, 0, -50);
  }
}
