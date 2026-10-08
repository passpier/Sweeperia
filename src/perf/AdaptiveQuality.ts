/**
 * Scales the render resolution to hold the display's refresh rate. Frame-time is compared with
 * the monitor's own interval (measured by FrameStats), so it works on 60/120/144 Hz screens alike.
 */
export class AdaptiveQuality {
  scale = 1;
  private slow = 0;
  private fast = 0;
  private tier = 0;

  /**
   * `tiers` are cheaper-first-to-drop effects (e.g. bloom): they are switched off before any resolution
   * is sacrificed, and switched back on only once the resolution is fully restored.
   */
  constructor(
    private readonly min: number,
    private readonly onChange: (scale: number) => void,
    private readonly tiers: ReadonlyArray<{ off: () => void; on: () => void }> = [],
  ) {}

  /** Call once per *rendered* frame. */
  sample(dtMs: number, vsyncMs: number): void {
    if (dtMs > vsyncMs * 1.45) {
      this.slow++;
      this.fast = 0;
    } else if (dtMs < vsyncMs * 1.15) {
      this.fast++;
      this.slow = Math.max(0, this.slow - 1);
    }
    if (this.slow > 45) {
      this.slow = 0;
      if (this.tier < this.tiers.length) this.tiers[this.tier++].off();
      else if (this.scale > this.min) this.set(Math.max(this.min, this.scale - 0.1));
    } else if (this.fast > 400) {
      this.fast = 0;
      if (this.scale < 1) this.set(Math.min(1, this.scale + 0.05));
      else if (this.tier > 0) this.tiers[--this.tier].on();
    }
  }

  private set(s: number): void {
    this.scale = s;
    this.onChange(s);
  }
}
