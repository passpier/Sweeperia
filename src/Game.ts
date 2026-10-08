import { Board, FLAGGED, HIDDEN, REVEALED } from './core/Board';
import { generateTerrain } from './core/Terrain';
import { ABILITIES, AGES, MAX_AGE, type AbilityDef } from './empire/Ages';
import { Economy } from './empire/Economy';

export type Mode = 'classic' | 'empire';

export interface Difficulty {
  id: string;
  label: string;
  w: number;
  h: number;
  mines: number;
  mode: Mode;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'easy', label: '初級 9×9', w: 9, h: 9, mines: 10, mode: 'classic' },
  { id: 'medium', label: '中級 16×16', w: 16, h: 16, mines: 40, mode: 'classic' },
  { id: 'hard', label: '高級 30×16', w: 30, h: 16, mines: 99, mode: 'classic' },
  { id: 'empire40', label: '帝國 40×40', w: 40, h: 40, mines: 240, mode: 'empire' },
  { id: 'empire70', label: '帝國 70×70', w: 70, h: 70, mines: 735, mode: 'empire' },
  { id: 'empire100', label: '帝國 100×100', w: 100, h: 100, mines: 1500, mode: 'empire' },
];

/** Callbacks the renderer / HUD subscribe to. All optional. */
export interface GameEvents {
  revealed?(cells: Int32Array, dist: Uint16Array, count: number): void;
  flagChanged?(index: number, flagged: boolean): void;
  exploded?(index: number): void;
  shielded?(index: number): void;
  ended?(won: boolean): void;
  ageChanged?(age: number): void;
  hud?(): void;
  highlight?(cells: number[], ms: number): void;
  toast?(msg: string): void;
}

export class Game {
  board!: Board;
  terrain!: Uint8Array;
  readonly economy = new Economy();
  age = 0;
  shield = 0;
  startedAt = 0;
  endedAt = 0;
  /** Pending targeted ability, if the player is choosing a cell. */
  targeting: AbilityDef | null = null;
  readonly cooldownUntil: Record<string, number> = {};
  readonly events: GameEvents = {};
  private tmp = new Int32Array(8);

  constructor(public diff: Difficulty, public seed = (Math.random() * 2 ** 31) | 0) {
    this.reset(diff, seed);
  }

  get empire(): boolean {
    return this.diff.mode === 'empire';
  }

  reset(diff: Difficulty, seed = (Math.random() * 2 ** 31) | 0): void {
    this.diff = diff;
    this.seed = seed;
    this.board = new Board(diff.w, diff.h, diff.mines, seed);
    this.terrain = generateTerrain(diff.w, diff.h, seed);
    const e = this.economy;
    e.food = e.wood = e.stone = e.gold = 0;
    this.age = 0;
    this.shield = 0;
    this.startedAt = 0;
    this.endedAt = 0;
    this.targeting = null;
    for (const k of Object.keys(this.cooldownUntil)) delete this.cooldownUntil[k];
  }

  get elapsedMs(): number {
    if (!this.startedAt) return 0;
    return (this.endedAt || performance.now()) - this.startedAt;
  }

  get minesLeft(): number {
    return this.board.mineCount - this.board.flagCount;
  }

  get over(): boolean {
    return this.board.status === 'won' || this.board.status === 'lost';
  }

  // ---- player actions ----

  reveal(i: number): void {
    if (this.over) return;
    if (this.targeting) return this.useTargeted(i);
    const b = this.board;
    if (b.state[i] === REVEALED) return this.chord(i);
    if (b.state[i] !== HIDDEN) return;
    if (!this.startedAt) this.startedAt = performance.now();
    // Shield absorbs a hit once the board is placed.
    if (b.placed && b.mines[i] && this.shield > 0) {
      this.shield--;
      b.defuse(i);
      this.events.shielded?.(i);
      this.events.flagChanged?.(i, true);
      this.events.toast?.('城牆擋下了伏兵！');
      this.events.hud?.();
      return;
    }
    this.afterReveal(b.reveal(i));
  }

  chord(i: number): void {
    if (this.over) return;
    const b = this.board;
    if (b.state[i] !== REVEALED) return;
    // Shield for chord-triggered hits: pre-defuse mines next to wrongly-flagged numbers is overkill;
    // keep it simple and let chord hits be real.
    this.afterReveal(b.chord(i));
  }

  private afterReveal(r: { hitMine: boolean; count: number }): void {
    const b = this.board;
    if (r.count > 0) {
      if (this.empire) {
        for (let k = 0; k < r.count; k++) {
          const c = b.order[k];
          const y = Economy.yieldFor(this.terrain[c], b.adj[c]);
          this.economy.add(y.res, y.amount);
        }
      }
      this.events.revealed?.(b.order, b.dist, r.count);
    }
    if (r.hitMine) {
      this.endedAt = performance.now();
      this.events.exploded?.(b.explodedAt);
      this.events.ended?.(false);
    } else if (b.status === 'won') {
      this.endedAt = performance.now();
      this.events.ended?.(true);
    }
    this.events.hud?.();
  }

  flag(i: number): void {
    if (this.over) return;
    if (this.targeting) {
      this.targeting = null;
      this.events.hud?.();
      return;
    }
    if (this.board.toggleFlag(i)) {
      this.events.flagChanged?.(i, this.board.state[i] === FLAGGED);
      this.events.hud?.();
    }
  }

  // ---- empire ----

  get nextAge() {
    return this.age < MAX_AGE ? AGES[this.age + 1] : null;
  }

  canAdvance(): boolean {
    const n = this.nextAge;
    return !!n && this.empire && !this.over && this.economy.canAfford(n.cost);
  }

  advance(): void {
    const n = this.nextAge;
    if (!n || !this.canAdvance()) return;
    this.economy.spend(n.cost);
    this.age = n.id;
    this.events.ageChanged?.(this.age);
    this.events.toast?.(`進入 ${n.name}！`);
    this.events.hud?.();
  }

  abilityReady(a: AbilityDef): boolean {
    return (
      this.empire &&
      !this.over &&
      this.age >= a.minAge &&
      performance.now() >= (this.cooldownUntil[a.id] ?? 0) &&
      this.economy.canAfford(a.cost)
    );
  }

  useAbility(id: AbilityDef['id']): void {
    const a = ABILITIES.find((x) => x.id === id)!;
    if (!this.abilityReady(a)) return;
    if (a.targeted) {
      this.targeting = this.targeting === a ? null : a;
      this.events.hud?.();
      return;
    }
    if (a.id === 'wall') {
      if (this.shield >= 3) return this.events.toast?.('城牆已達上限');
      this.commit(a);
      this.shield++;
    } else if (a.id === 'scout') {
      const cell = this.pickScoutCell();
      if (cell < 0) return this.events.toast?.('沒有可偵察的格子');
      this.commit(a);
      if (!this.startedAt) this.startedAt = performance.now();
      this.afterReveal(this.board.reveal(cell));
    }
    this.events.hud?.();
  }

  private commit(a: AbilityDef): void {
    this.economy.spend(a.cost);
    this.cooldownUntil[a.id] = performance.now() + a.cooldownMs;
  }

  /** Prefer a hidden safe cell touching revealed numbers; otherwise any hidden safe cell. */
  private pickScoutCell(): number {
    const b = this.board;
    if (!b.placed) return (b.size / 2 + b.width / 2) | 0;
    let fallback = -1;
    const start = (Math.random() * b.size) | 0;
    for (let k = 0; k < b.size; k++) {
      const i = (start + k) % b.size;
      if (b.state[i] !== HIDDEN || b.mines[i]) continue;
      if (fallback < 0) fallback = i;
      const n = b.neighbors(i, this.tmp);
      for (let j = 0; j < n; j++) if (b.state[this.tmp[j]] === REVEALED) return i;
    }
    return fallback;
  }

  private useTargeted(i: number): void {
    const a = this.targeting!;
    const b = this.board;
    if (!b.placed) {
      this.targeting = null;
      return this.events.toast?.('請先揭開一格');
    }
    this.commit(a);
    this.targeting = null;
    const x = i % b.width;
    const y = (i / b.width) | 0;
    const r = a.id === 'engineer' ? 2 : 1;
    const cells: number[] = [];
    for (let yy = Math.max(0, y - r); yy <= Math.min(b.height - 1, y + r); yy++) {
      for (let xx = Math.max(0, x - r); xx <= Math.min(b.width - 1, x + r); xx++) {
        const c = yy * b.width + xx;
        if (b.mines[c]) cells.push(c);
      }
    }
    if (a.id === 'engineer') this.events.toast?.(`5×5 範圍內有 ${cells.length} 顆地雷`);
    this.events.highlight?.(cells, a.id === 'engineer' ? 2500 : 4500);
    this.events.hud?.();
  }
}
