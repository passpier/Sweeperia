import * as THREE from 'three';
import { HIDDEN, REVEALED, type Board } from '../core/Board';
import { Terrain } from '../core/Terrain';
import { AGES } from '../empire/Ages';
import { easeOutBack, hash01 } from './ease';

export const HIDDEN_H = 0.5;
export const REVEALED_H = 0.1;
/** Revealed water cells sink to a river bed under the water surface (y ≈ 0.07). */
export const WATER_BED_H = 0.02;
const ANIM_SEC = 0.34;
/** Hidden tiles keep a visible gap (clear click targets); revealed ground closes up into one surface. */
const GAP_SCALE = 0.95;
const FLUSH_SCALE = 1.0;

const HIDDEN_BASE = [0x78a050, 0x4f7a3f, 0x86857f, 0x9a8f4a, 0x4a98a0];
const REVEALED_BASE = [0xd2c08c, 0xa89a6c, 0xa2a39e, 0xcfae52, 0x6f6a52];

/**
 * All board cells in a single InstancedMesh. A cell's matrix is a translate+scale of a unit
 * box, so "raising/lowering" a tile is just a Y scale; colours live in instanceColor.
 */
export class TileLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly h: Float32Array;
  private readonly start: Float32Array;
  private readonly phase: Uint8Array; // 0 idle, 1 waiting, 2 animating
  private readonly active: Int32Array;
  private activeCount = 0;
  private minDirty = Infinity;
  private maxDirty = -1;
  private readonly col = new THREE.Color();
  private age = 0;

  constructor(private readonly board: Board, private readonly terrain: Uint8Array, mat: THREE.Material) {
    const n = board.size;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const tAttr = new Float32Array(n);
    for (let i = 0; i < n; i++) tAttr[i] = terrain[i];
    geo.setAttribute('terrain', new THREE.InstancedBufferAttribute(tAttr, 1));
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.h = new Float32Array(n).fill(HIDDEN_H);
    this.start = new Float32Array(n);
    this.phase = new Uint8Array(n);
    this.active = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      this.writeMatrix(i);
      this.mesh.setColorAt(i, this.colorFor(i, false));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }

  centerX(i: number): number {
    return (i % this.board.width) - this.board.width / 2 + 0.5;
  }
  centerZ(i: number): number {
    return ((i / this.board.width) | 0) - this.board.height / 2 + 0.5;
  }

  private colorFor(i: number, revealed: boolean): THREE.Color {
    const t = this.terrain[i];
    const x = i % this.board.width;
    const y = (i / this.board.width) | 0;
    const swing = revealed ? 0.015 : 0.04;
    const checker = (x + y) & 1 ? 1 - swing : 1 + swing;
    const noise = 0.94 + hash01(i) * 0.12;
    const c = this.col;
    const a = AGES[this.age];
    if (revealed) {
      c.setHex(REVEALED_BASE[t]).lerp(tmp.setHex(a.revealed), t === Terrain.Gold ? 0.15 : t === Terrain.Water ? 0.05 : 0.45);
    } else {
      c.setHex(HIDDEN_BASE[t]).lerp(tmp.setHex(a.hidden), 0.35);
    }
    return c.multiplyScalar(checker * noise);
  }

  private writeMatrix(i: number): void {
    const a = this.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    const h = this.h[i];
    const k = Math.min(1, Math.max(0, (HIDDEN_H - h) / (HIDDEN_H - REVEALED_H)));
    const sc = GAP_SCALE + (FLUSH_SCALE - GAP_SCALE) * k;
    a[o] = sc;
    a[o + 5] = h;
    a[o + 10] = sc;
    a[o + 12] = this.centerX(i);
    a[o + 13] = h / 2;
    a[o + 14] = this.centerZ(i);
    a[o + 15] = 1;
    if (i < this.minDirty) this.minDirty = i;
    if (i > this.maxDirty) this.maxDirty = i;
  }

  reveal(cell: number, nowSec: number, delaySec: number): void {
    if (this.phase[cell] === 0) this.active[this.activeCount++] = cell;
    this.phase[cell] = 1;
    this.start[cell] = nowSec + delaySec;
  }

  /** Recolour every tile for the given age. */
  setAge(age: number): void {
    this.age = age;
    const n = this.board.size;
    for (let i = 0; i < n; i++) {
      this.mesh.setColorAt(i, this.colorFor(i, this.board.state[i] === REVEALED && this.phase[i] !== 1));
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }

  explode(cell: number): void {
    this.mesh.setColorAt(cell, this.col.setHex(0xc23a2a));
    this.mesh.instanceColor!.needsUpdate = true;
    this.phase[cell] = 0;
    this.h[cell] = REVEALED_H;
    this.writeMatrix(cell);
    this.flush();
  }

  /** Tint a hidden cell as a "highlight" (radar). Pass restore=true to put the normal colour back. */
  tint(cell: number, on: boolean): void {
    const st = this.board.state[cell];
    this.mesh.setColorAt(cell, on ? this.col.setHex(0xe35d4a) : this.colorFor(cell, st === REVEALED));
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(now: number): boolean {
    if (this.activeCount === 0) return false;
    let n = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const cell = this.active[k];
      const target = this.revealedH(cell);
      const t = (now - this.start[cell]) / ANIM_SEC;
      if (t < 0) {
        this.active[n++] = cell;
        continue;
      }
      if (this.phase[cell] === 1) {
        this.phase[cell] = 2;
        this.mesh.setColorAt(cell, this.colorFor(cell, true));
        this.mesh.instanceColor!.needsUpdate = true;
      }
      if (t >= 1) {
        this.h[cell] = target;
        this.phase[cell] = 0;
      } else {
        this.h[cell] = HIDDEN_H + (target - HIDDEN_H) * easeOutBack(t);
        this.active[n++] = cell;
      }
      this.writeMatrix(cell);
    }
    this.activeCount = n;
    this.flush();
    return n > 0;
  }

  private flush(): void {
    if (this.maxDirty < 0) return;
    const attr = this.mesh.instanceMatrix;
    attr.clearUpdateRanges();
    attr.addUpdateRange(this.minDirty * 16, (this.maxDirty - this.minDirty + 1) * 16);
    attr.needsUpdate = true;
    this.minDirty = Infinity;
    this.maxDirty = -1;
  }

  get animating(): boolean {
    return this.activeCount > 0;
  }

  private revealedH(cell: number): number {
    return this.terrain[cell] === Terrain.Water ? WATER_BED_H : REVEALED_H;
  }

  /** Height of the top surface for a cell (for prop placement). */
  topOf(cell: number): number {
    return this.board.state[cell] === HIDDEN ? HIDDEN_H : this.revealedH(cell);
  }
}

const tmp = new THREE.Color();
