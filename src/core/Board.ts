import { mulberry32 } from './rng';

export const HIDDEN = 0;
export const REVEALED = 1;
export const FLAGGED = 2;

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface RevealResult {
  /** true if a mine was uncovered (game lost). */
  hitMine: boolean;
  /** Newly revealed cells of this action, written to `order[0..count)` in BFS order. */
  count: number;
}

/**
 * Pure minesweeper logic. Cells are addressed by index `y * width + x`.
 * No allocation happens inside reveal/chord hot paths (BFS uses preallocated buffers).
 */
export class Board {
  readonly size: number;
  readonly mines: Uint8Array;
  readonly state: Uint8Array;
  readonly adj: Uint8Array;
  /** BFS order of the most recent reveal; `dist[k]` is the BFS depth of `order[k]`. */
  readonly order: Int32Array;
  readonly dist: Uint16Array;

  status: GameStatus = 'ready';
  placed = false;
  /** The cell the mines were laid out around (the first reveal), or -1. */
  firstCell = -1;
  flagCount = 0;
  revealedCount = 0;
  /** Index of the mine that ended the game, or -1. */
  explodedAt = -1;

  private readonly queue: Int32Array;
  private readonly rng: () => number;
  private result: RevealResult = { hitMine: false, count: 0 };

  constructor(
    readonly width: number,
    readonly height: number,
    readonly mineCount: number,
    readonly seed: number,
  ) {
    this.size = width * height;
    if (mineCount < 0 || mineCount >= this.size) throw new Error('invalid mine count');
    this.mines = new Uint8Array(this.size);
    this.state = new Uint8Array(this.size);
    this.adj = new Uint8Array(this.size);
    this.order = new Int32Array(this.size);
    this.dist = new Uint16Array(this.size);
    this.queue = new Int32Array(this.size);
    this.rng = mulberry32(seed);
  }

  get safeCells(): number {
    return this.size - this.mineCount;
  }

  /** Place mines avoiding the 3x3 around `safe` (falls back to just `safe` on tiny boards). */
  private place(safe: number): void {
    const { width: w, height: h } = this;
    const sx = safe % w;
    const sy = (safe / w) | 0;
    const radius = this.size - 9 >= this.mineCount ? 1 : 0;
    const candidates: number[] = [];
    for (let i = 0; i < this.size; i++) {
      const x = i % w;
      const y = (i / w) | 0;
      if (Math.abs(x - sx) <= radius && Math.abs(y - sy) <= radius) continue;
      candidates.push(i);
    }
    // partial Fisher-Yates
    for (let k = 0; k < this.mineCount; k++) {
      const j = k + Math.floor(this.rng() * (candidates.length - k));
      const t = candidates[k];
      candidates[k] = candidates[j];
      candidates[j] = t;
      this.mines[candidates[k]] = 1;
    }
    for (let i = 0; i < this.size; i++) {
      if (this.mines[i]) continue;
      const x = i % w;
      const y = (i / w) | 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          n += this.mines[ny * w + nx];
        }
      }
      this.adj[i] = n;
    }
    this.firstCell = safe;
    this.placed = true;
    this.status = 'playing';
  }

  /** Reveal a cell (flood-filling zeros). The returned object is reused between calls. */
  reveal(index: number): RevealResult {
    const res = this.result;
    res.hitMine = false;
    this.logLen = 0;
    this.revealInner(index, res);
    res.count = this.logLen;
    return res;
  }

  private revealInner(index: number, res: RevealResult): void {
    if (this.status === 'won' || this.status === 'lost') return;
    if (this.state[index] !== HIDDEN) return;
    if (!this.placed) this.place(index);

    if (this.mines[index]) {
      this.state[index] = REVEALED;
      this.explodedAt = index;
      this.status = 'lost';
      res.hitMine = true;
      return;
    }
    this.flood(index);
    this.checkWin();
  }

  private logLen = 0;

  private flood(start: number): void {
    const { width: w, height: h, state, adj, queue, order, dist, mines } = this;
    const depth = (this.depthBuf ??= new Uint16Array(this.size));
    let head = 0;
    let tail = 0;
    state[start] = REVEALED;
    depth[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      order[this.logLen] = i;
      dist[this.logLen] = depth[i];
      this.logLen++;
      this.revealedCount++;
      if (adj[i] !== 0) continue;
      const x = i % w;
      const y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const n = ny * w + nx;
          if (state[n] !== HIDDEN || mines[n]) continue;
          state[n] = REVEALED;
          depth[n] = depth[i] + 1;
          queue[tail++] = n;
        }
      }
    }
  }

  private depthBuf: Uint16Array | null = null;

  /** Reveal all hidden neighbours of a satisfied number. Stops at first mine hit. */
  chord(index: number): RevealResult {
    const res = this.result;
    res.hitMine = false;
    this.logLen = 0;
    res.count = 0;
    if (this.status !== 'playing' || this.state[index] !== REVEALED) return res;
    const n = this.adj[index];
    if (n === 0) return res;
    const { width: w, height: h } = this;
    const x = index % w;
    const y = (index / w) | 0;
    let flags = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (this.state[ny * w + nx] === FLAGGED) flags++;
      }
    }
    if (flags !== n) return res;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        this.revealInner(ny * w + nx, res);
        if (res.hitMine) break;
      }
      if (res.hitMine) break;
    }
    res.count = this.logLen;
    return res;
  }

  toggleFlag(index: number): boolean {
    if (this.status === 'won' || this.status === 'lost') return false;
    const s = this.state[index];
    if (s === REVEALED) return false;
    if (s === FLAGGED) {
      this.state[index] = HIDDEN;
      this.flagCount--;
    } else {
      this.state[index] = FLAGGED;
      this.flagCount++;
    }
    return true;
  }

  /** Force-flag a mine cell (used when a shield absorbs a hit). Counts as safe for win check. */
  defuse(index: number): void {
    if (!this.mines[index]) return;
    if (this.state[index] !== FLAGGED) {
      this.state[index] = FLAGGED;
      this.flagCount++;
    }
  }

  checkWin(): void {
    if (this.status === 'playing' && this.revealedCount >= this.safeCells) {
      this.status = 'won';
    }
  }

  neighbors(index: number, out: Int32Array): number {
    const { width: w, height: h } = this;
    const x = index % w;
    const y = (index / w) | 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        out[n++] = ny * w + nx;
      }
    }
    return n;
  }
}
