import { describe, expect, it } from 'vitest';
import { Board, FLAGGED, HIDDEN, REVEALED } from '../../src/core/Board';

function countMines(b: Board): number {
  let n = 0;
  for (let i = 0; i < b.size; i++) n += b.mines[i];
  return n;
}

describe('Board', () => {
  it('first click is always safe with a clear 3x3', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const b = new Board(9, 9, 10, seed);
      const first = 4 * 9 + 4;
      const r = b.reveal(first);
      expect(r.hitMine).toBe(false);
      expect(countMines(b)).toBe(10);
      expect(b.adj[first]).toBe(0);
      expect(b.status).toBe('playing');
    }
  });

  it('is deterministic for a given seed', () => {
    const a = new Board(16, 16, 40, 42);
    const b = new Board(16, 16, 40, 42);
    a.reveal(0);
    b.reveal(0);
    expect(Array.from(a.mines)).toEqual(Array.from(b.mines));
  });

  it('flood fill reveals a connected region in BFS order with consistent counts', () => {
    const b = new Board(30, 16, 99, 7);
    const r = b.reveal(15 * 30 + 15);
    expect(r.count).toBe(b.revealedCount);
    expect(r.count).toBeGreaterThan(1);
    for (let k = 0; k < r.count; k++) {
      expect(b.state[b.order[k]]).toBe(REVEALED);
      expect(b.mines[b.order[k]]).toBe(0);
      if (k > 0) expect(b.dist[k]).toBeGreaterThanOrEqual(b.dist[k - 1]);
    }
  });

  it('flags block reveal and toggle back', () => {
    const b = new Board(9, 9, 10, 3);
    expect(b.toggleFlag(0)).toBe(true);
    expect(b.state[0]).toBe(FLAGGED);
    expect(b.reveal(0).count).toBe(0);
    b.toggleFlag(0);
    expect(b.state[0]).toBe(HIDDEN);
    expect(b.flagCount).toBe(0);
  });

  it('hitting a mine loses', () => {
    const b = new Board(9, 9, 10, 5);
    b.reveal(40);
    const mine = Array.from(b.mines).findIndex((m) => m === 1);
    const r = b.reveal(mine);
    expect(r.hitMine).toBe(true);
    expect(b.status).toBe('lost');
    expect(b.explodedAt).toBe(mine);
  });

  it('revealing every safe cell wins', () => {
    const b = new Board(9, 9, 10, 11);
    b.reveal(40);
    for (let i = 0; i < b.size; i++) if (!b.mines[i]) b.reveal(i);
    expect(b.status).toBe('won');
  });

  it('chord reveals neighbours when flags match, and loses on a wrong flag', () => {
    const b = new Board(9, 9, 10, 21);
    b.reveal(40);
    // find a revealed number with a hidden non-mine neighbour
    const nb = new Int32Array(8);
    let target = -1;
    for (let i = 0; i < b.size && target < 0; i++) {
      if (b.state[i] !== REVEALED || b.adj[i] === 0) continue;
      const n = b.neighbors(i, nb);
      for (let k = 0; k < n; k++) if (b.state[nb[k]] === HIDDEN && !b.mines[nb[k]]) target = i;
    }
    expect(target).toBeGreaterThanOrEqual(0);
    const n = b.neighbors(target, nb);
    for (let k = 0; k < n; k++) if (b.mines[nb[k]]) b.toggleFlag(nb[k]);
    const r = b.chord(target);
    expect(r.hitMine).toBe(false);
    expect(r.count).toBeGreaterThan(0);

    // wrong flag: flag a safe cell instead of a mine next to a number
    const c = new Board(9, 9, 10, 21);
    c.reveal(40);
    const m = Array.from(c.mines).findIndex((v, i) => v === 1 && c.neighbors(i, nb) > 0);
    c.neighbors(m, nb);
    let num = -1;
    for (let k = 0; k < 8 && num < 0; k++) if (c.state[nb[k]] === REVEALED && c.adj[nb[k]] > 0) num = nb[k];
    if (num >= 0 && c.adj[num] === 1) {
      const nn = c.neighbors(num, nb);
      for (let k = 0; k < nn; k++) {
        if (c.state[nb[k]] === HIDDEN && !c.mines[nb[k]]) {
          c.toggleFlag(nb[k]);
          break;
        }
      }
      const r2 = c.chord(num);
      expect(r2.hitMine).toBe(true);
      expect(c.status).toBe('lost');
    }
  });

  it('defuse flags a mine without ending the game', () => {
    const b = new Board(9, 9, 10, 5);
    b.reveal(40);
    const mine = Array.from(b.mines).findIndex((m) => m === 1);
    b.defuse(mine);
    expect(b.state[mine]).toBe(FLAGGED);
    expect(b.status).toBe('playing');
  });
});
