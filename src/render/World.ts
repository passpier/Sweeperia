import * as THREE from 'three';
import { SUN_DIR, skyColor } from './Materials';

/** Scene, lighting and fog. Shadows are static: re-rendered only when `dirtyShadows()` was called. */
export class World {
  readonly scene = new THREE.Scene();
  readonly sun = new THREE.DirectionalLight(0xffe6bc, 2.8);
  readonly hemi = new THREE.HemisphereLight(0xbcd8ff, 0x4f4a38, 1.25);
  shadowsEnabled = true;
  private shadowDirty = true;
  private shadowRes = 2048;

  constructor(private readonly shadowSpan = 34) {
    this.scene.background = new THREE.Color(0x9fc4d8);
    this.scene.fog = new THREE.Fog(0xb7d2e0, 60, 220);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 3;
    const c = this.sun.shadow.camera;
    c.left = -shadowSpan;
    c.right = shadowSpan;
    c.top = shadowSpan;
    c.bottom = -shadowSpan;
    c.near = 1;
    c.far = 160;
    // WebGL honours renderer.shadowMap.*, WebGPU honours the per-light flags; set both.
    this.sun.shadow.autoUpdate = false;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
  }

  setShadows(on: boolean, res = 2048): void {
    this.sun.shadow.mapSize.set(res, res);
    this.shadowRes = res;
    this.shadowsEnabled = on;
    this.sun.castShadow = on;
    this.shadowDirty = on;
  }

  /** Re-centre the shadow frustum on the camera focus. */
  followTarget(x: number, z: number): void {
    // Snap to texel-ish grid to avoid swimming while panning.
    const step = (this.shadowSpan * 2) / this.shadowRes;
    const sx = Math.round(x / step) * step;
    const sz = Math.round(z / step) * step;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + SUN_DIR.x * 80, SUN_DIR.y * 80, sz + SUN_DIR.z * 80);
    this.sun.target.updateMatrixWorld();
    this.shadowDirty = true;
  }

  dirtyShadows(): void {
    this.shadowDirty = this.shadowsEnabled;
  }

  /** Call once per frame before render: schedules a shadow refresh only if something changed. */
  flushShadows(): void {
    if (!this.shadowDirty || !this.shadowsEnabled) return;
    this.shadowDirty = false;
    this.sun.shadow.needsUpdate = true;
  }

  setAtmosphere(sky: number, fog: number, sun = 0xffe6bc): void {
    (this.scene.background as THREE.Color).setHex(sky);
    skyColor.value.setHex(sky);
    this.sun.color.setHex(sun);
    (this.scene.fog as THREE.Fog).color.setHex(fog);
  }
}
