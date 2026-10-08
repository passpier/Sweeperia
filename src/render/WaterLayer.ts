import * as THREE from 'three';
import { waterMaterial } from './Materials';

export const WATER_Y = 0.07;
const FADE_SEC = 0.5;
const MARGIN = 44;

/**
 * A single plane (one draw call) covering the board plus a surrounding sea. A W×H mask texture marks the
 * revealed water cells; its linear filtering gives the shader a soft 0→1 ramp that becomes the shoreline foam.
 */
export class WaterLayer {
  readonly mesh: THREE.Mesh;
  private readonly data: Uint8Array;
  private readonly tex: THREE.DataTexture;
  private readonly start: Float32Array;
  private readonly active: Int32Array;
  private activeCount = 0;

  constructor(w: number, h: number) {
    this.data = new Uint8Array(w * h);
    this.start = new Float32Array(w * h);
    this.active = new Int32Array(w * h);
    this.tex = new THREE.DataTexture(this.data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(w + MARGIN * 2, h + MARGIN * 2);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, waterMaterial(this.tex, w, h));
    this.mesh.position.y = WATER_Y;
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
  }

  reveal(cell: number, nowSec: number, delaySec: number): void {
    this.start[cell] = nowSec + delaySec;
    this.active[this.activeCount++] = cell;
  }

  /** Returns true while a fade is running. */
  update(now: number): boolean {
    if (this.activeCount === 0) return false;
    let n = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const c = this.active[k];
      const t = (now - this.start[c]) / FADE_SEC;
      this.data[c] = t <= 0 ? 0 : t >= 1 ? 255 : (t * t * (3 - 2 * t) * 255) | 0;
      if (t < 1) this.active[n++] = c;
    }
    this.activeCount = n;
    this.tex.needsUpdate = true;
    return n > 0;
  }

  dispose(): void {
    this.tex.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
