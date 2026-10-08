/** Rolling frame statistics shown by the F3 overlay. */
export class FrameStats {
  readonly el = document.createElement('pre');
  private visible = false;
  private frames = 0;
  private renders = 0;
  private acc = 0;
  private worst = 0;
  private lastUpdate = performance.now();
  fps = 0;
  avgMs = 0;
  /** Monitor refresh interval estimate (ms): the smallest sustained frame delta. */
  vsyncMs = 1000 / 60;
  extra = '';

  constructor() {
    this.el.className = 'stats';
    this.el.hidden = true;
    document.body.appendChild(this.el);
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
    return this.visible;
  }

  get shown(): boolean {
    return this.visible;
  }

  frame(dtMs: number, rendered: boolean): void {
    this.frames++;
    if (rendered) this.renders++;
    this.acc += dtMs;
    if (dtMs > this.worst) this.worst = dtMs;
    if (dtMs > 3 && dtMs < this.vsyncMs * 1.15) this.vsyncMs += (dtMs - this.vsyncMs) * 0.02;
    const now = performance.now();
    if (now - this.lastUpdate >= 500) {
      this.fps = (this.frames * 1000) / this.acc;
      this.avgMs = this.acc / this.frames;
      if (this.visible) {
        this.el.textContent =
          `${this.fps.toFixed(0)} fps  avg ${this.avgMs.toFixed(1)} ms  worst ${this.worst.toFixed(1)} ms\n` +
          `rendered ${this.renders}/${this.frames}  refresh≈${(1000 / this.vsyncMs).toFixed(0)} Hz\n${this.extra}`;
      }
      this.frames = this.renders = 0;
      this.acc = 0;
      this.worst = 0;
      this.lastUpdate = now;
    }
  }
}
