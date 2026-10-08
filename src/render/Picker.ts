import * as THREE from 'three';

const PICK_Y = 0.32;

/** Analytic ray/plane cell picking: O(1), no Raycaster and no scene traversal. */
export class Picker {
  private readonly v = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private width: number,
    private height: number,
  ) {}

  setBoard(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }

  /** Returns the cell index under the pointer, or -1. */
  cellAt(clientX: number, clientY: number): number {
    const r = this.canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = -((clientY - r.top) / r.height) * 2 + 1;
    const cam = this.camera;
    this.v.set(nx, ny, 0.5).unproject(cam);
    this.dir.copy(this.v).sub(cam.position);
    if (this.dir.y >= -1e-6) return -1;
    const t = (PICK_Y - cam.position.y) / this.dir.y;
    const x = cam.position.x + this.dir.x * t + this.width / 2;
    const z = cam.position.z + this.dir.z * t + this.height / 2;
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= this.width || cz >= this.height) return -1;
    return cz * this.width + cx;
  }
}
