import * as THREE from 'three';

/** Scene, lighting and fog. Shadows are static: re-rendered only when `dirtyShadows()` was called. */
export class World {
  readonly scene = new THREE.Scene();
  readonly sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  readonly hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5b5a40, 1.5);
  shadowsEnabled = true;
  private shadowDirty = true;

  constructor(private readonly shadowSpan = 34) {
    this.scene.background = new THREE.Color(0x9fc4d8);
    this.scene.fog = new THREE.Fog(0xb7d2e0, 60, 220);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
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

  setShadows(on: boolean): void {
    this.shadowsEnabled = on;
    this.sun.castShadow = on;
    this.shadowDirty = on;
  }

  /** Re-centre the shadow frustum on the camera focus. */
  followTarget(x: number, z: number): void {
    // Snap to texel-ish grid to avoid swimming while panning.
    const step = (this.shadowSpan * 2) / 2048;
    const sx = Math.round(x / step) * step;
    const sz = Math.round(z / step) * step;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx - 40, 70, sz + 30);
    this.sun.target.updateMatrixWorld();
    this.shadowDirty = true;
  }

  dirtyShadows(): void {
    this.shadowDirty = this.shadowsEnabled;
  }

  /** Call once per frame before render: schedules a shadow refresh only if something changed. */
  flushShadows(renderer: THREE.WebGLRenderer): void {
    if (!this.shadowDirty || !this.shadowsEnabled) return;
    this.shadowDirty = false;
    renderer.shadowMap.needsUpdate = true;
    this.sun.shadow.needsUpdate = true;
  }

  setAtmosphere(sky: number, fog: number): void {
    (this.scene.background as THREE.Color).setHex(sky);
    (this.scene.fog as THREE.Fog).color.setHex(fog);
  }
}
