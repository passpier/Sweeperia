import * as THREE from 'three';
import { easeOutBack } from './ease';

const ANIM_SEC = 0.38;

/**
 * One InstancedMesh holding at most one instance per board cell.
 * Slots are densely packed (swap-remove) so `mesh.count` is the draw size.
 * Pop-in animations run on typed arrays; no per-frame allocation.
 */
export class PropLayer {
  readonly mesh: THREE.InstancedMesh;
  count = 0;
  /** Added to every instance's yaw; used to keep flat number decals facing the camera. */
  yawOffset = 0;

  private readonly slotOf: Int32Array;
  private readonly cellOf: Int32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly yaw: Float32Array;
  private readonly scl: Float32Array;
  private readonly start: Float32Array;
  private readonly active: Int32Array;
  private activeCount = 0;
  private readonly color = new THREE.Color();

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    cells: number,
    private readonly tinted = false,
    castShadow = true,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, cells);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (tinted) this.mesh.setColorAt(0, this.color.setHex(0xffffff));
    this.slotOf = new Int32Array(cells).fill(-1);
    this.cellOf = new Int32Array(cells);
    this.px = new Float32Array(cells);
    this.py = new Float32Array(cells);
    this.pz = new Float32Array(cells);
    this.yaw = new Float32Array(cells);
    this.scl = new Float32Array(cells);
    this.start = new Float32Array(cells);
    this.active = new Int32Array(cells);
  }

  has(cell: number): boolean {
    return this.slotOf[cell] >= 0;
  }

  /** `now` and `delay` are seconds. Scale animates 0 -> `scale` starting at now+delay. */
  add(cell: number, x: number, y: number, z: number, yaw: number, scale: number, now: number, delay = 0, tint = 1): void {
    if (this.slotOf[cell] >= 0) this.remove(cell);
    const s = this.count++;
    this.mesh.count = this.count;
    this.slotOf[cell] = s;
    this.cellOf[s] = cell;
    this.px[s] = x;
    this.py[s] = y;
    this.pz[s] = z;
    this.yaw[s] = yaw;
    this.scl[s] = scale;
    this.start[s] = now + delay;
    this.write(s, 0);
    if (this.tinted && this.mesh.instanceColor) {
      this.color.setScalar(tint);
      this.mesh.setColorAt(s, this.color);
      this.mesh.instanceColor.needsUpdate = true;
    }
    this.active[this.activeCount++] = cell;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  remove(cell: number): void {
    const s = this.slotOf[cell];
    if (s < 0) return;
    const last = this.count - 1;
    if (s !== last) {
      const moved = this.cellOf[last];
      this.cellOf[s] = moved;
      this.slotOf[moved] = s;
      this.px[s] = this.px[last];
      this.py[s] = this.py[last];
      this.pz[s] = this.pz[last];
      this.yaw[s] = this.yaw[last];
      this.scl[s] = this.scl[last];
      this.start[s] = this.start[last];
      const mi = this.mesh.instanceMatrix.array as Float32Array;
      mi.copyWithin(s * 16, last * 16, last * 16 + 16);
      if (this.tinted && this.mesh.instanceColor) {
        const ci = this.mesh.instanceColor.array as Float32Array;
        ci.copyWithin(s * 3, last * 3, last * 3 + 3);
        this.mesh.instanceColor.needsUpdate = true;
      }
    }
    this.slotOf[cell] = -1;
    this.count--;
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.slotOf.fill(-1);
    this.count = 0;
    this.activeCount = 0;
    this.mesh.count = 0;
  }

  /** Re-run the pop animation on everything (e.g. after swapping geometry on age change). */
  replay(now: number, spread = 0.5): void {
    for (let s = 0; s < this.count; s++) {
      this.start[s] = now + ((s * 0.6180339) % 1) * spread;
      this.write(s, 0);
      this.active[this.activeCount++] = this.cellOf[s];
    }
    // activeCount can exceed capacity if replayed repeatedly while animating; compact duplicates.
    this.compactActive();
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private compactActive(): void {
    let n = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const c = this.active[k];
      let dup = false;
      for (let j = 0; j < n; j++) if (this.active[j] === c) { dup = true; break; }
      if (!dup) this.active[n++] = c;
    }
    this.activeCount = n;
  }

  /** Rewrite every matrix (after yawOffset changes). */
  refreshAll(now: number): void {
    for (let s = 0; s < this.count; s++) this.write(s, this.progress(s, now));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private progress(s: number, now: number): number {
    const t = (now - this.start[s]) / ANIM_SEC;
    return t <= 0 ? 0 : t >= 1 ? 1 : easeOutBack(t);
  }

  /** Returns true while animations are still running. */
  update(now: number): boolean {
    if (this.activeCount === 0) return false;
    let n = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const cell = this.active[k];
      const s = this.slotOf[cell];
      if (s < 0) continue;
      const t = (now - this.start[s]) / ANIM_SEC;
      this.write(s, t <= 0 ? 0 : t >= 1 ? 1 : easeOutBack(t));
      if (t < 1) this.active[n++] = cell;
    }
    this.activeCount = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    return n > 0;
  }

  private write(s: number, k: number): void {
    const a = this.mesh.instanceMatrix.array as Float32Array;
    const o = s * 16;
    const sc = this.scl[s] * k;
    const yaw = this.yaw[s] + this.yawOffset;
    const c = Math.cos(yaw) * sc;
    const sn = Math.sin(yaw) * sc;
    a[o] = c;
    a[o + 1] = 0;
    a[o + 2] = -sn;
    a[o + 3] = 0;
    a[o + 4] = 0;
    a[o + 5] = sc;
    a[o + 6] = 0;
    a[o + 7] = 0;
    a[o + 8] = sn;
    a[o + 9] = 0;
    a[o + 10] = c;
    a[o + 11] = 0;
    a[o + 12] = this.px[s];
    a[o + 13] = this.py[s];
    a[o + 14] = this.pz[s];
    a[o + 15] = 1;
  }

  setGeometry(g: THREE.BufferGeometry): void {
    this.mesh.geometry = g;
  }
}
