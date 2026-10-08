import * as THREE from 'three';

const CAP = 900;

/** Pooled cube particles in one InstancedMesh. Spawning never allocates. */
export class Effects {
  readonly mesh: THREE.InstancedMesh;
  private readonly pos = new Float32Array(CAP * 3);
  private readonly vel = new Float32Array(CAP * 3);
  private readonly life = new Float32Array(CAP);
  private readonly maxLife = new Float32Array(CAP);
  private readonly size = new Float32Array(CAP);
  private n = 0;
  private readonly color = new THREE.Color();

  constructor() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, CAP);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, this.color.setHex(0xffffff));
  }

  get active(): boolean {
    return this.n > 0;
  }

  burst(x: number, y: number, z: number, count: number, colors: readonly number[], speed = 3.2, size = 0.12): void {
    for (let i = 0; i < count && this.n < CAP; i++) {
      const p = this.n++;
      const a = Math.random() * Math.PI * 2;
      const up = 0.4 + Math.random() * 0.9;
      const s = speed * (0.35 + Math.random() * 0.8);
      this.pos[p * 3] = x;
      this.pos[p * 3 + 1] = y;
      this.pos[p * 3 + 2] = z;
      this.vel[p * 3] = Math.cos(a) * s;
      this.vel[p * 3 + 1] = up * speed;
      this.vel[p * 3 + 2] = Math.sin(a) * s;
      this.maxLife[p] = this.life[p] = 0.6 + Math.random() * 0.7;
      this.size[p] = size * (0.6 + Math.random() * 0.8);
      this.mesh.setColorAt(p, this.color.setHex(colors[(Math.random() * colors.length) | 0]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.count = this.n;
  }

  update(dt: number): void {
    if (this.n === 0) return;
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    const ci = this.mesh.instanceColor!.array as Float32Array;
    let p = 0;
    while (p < this.n) {
      this.life[p] -= dt;
      if (this.life[p] <= 0) {
        // swap-remove
        const l = --this.n;
        if (p !== l) {
          for (let j = 0; j < 3; j++) {
            this.pos[p * 3 + j] = this.pos[l * 3 + j];
            this.vel[p * 3 + j] = this.vel[l * 3 + j];
            ci[p * 3 + j] = ci[l * 3 + j];
          }
          this.life[p] = this.life[l];
          this.maxLife[p] = this.maxLife[l];
          this.size[p] = this.size[l];
        }
        continue;
      }
      this.vel[p * 3 + 1] -= 9.8 * dt;
      this.pos[p * 3] += this.vel[p * 3] * dt;
      this.pos[p * 3 + 1] += this.vel[p * 3 + 1] * dt;
      this.pos[p * 3 + 2] += this.vel[p * 3 + 2] * dt;
      const sc = this.size[p] * Math.min(1, (this.life[p] / this.maxLife[p]) * 2);
      const o = p * 16;
      arr[o] = sc;
      arr[o + 5] = sc;
      arr[o + 10] = sc;
      arr[o + 12] = this.pos[p * 3];
      arr[o + 13] = this.pos[p * 3 + 1];
      arr[o + 14] = this.pos[p * 3 + 2];
      arr[o + 15] = 1;
      p++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
}
