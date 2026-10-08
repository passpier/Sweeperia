import * as THREE from 'three';

const PITCH = (56 * Math.PI) / 180;
const SIN_PITCH = Math.sin(PITCH);
const COS_PITCH = Math.cos(PITCH);

/** RTS-style orbit camera: fixed pitch, pan on the ground plane, 90-degree yaw steps, zoom by distance. */
export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  yaw = 0;
  private yawGoal = 0;
  private tx = 0;
  private tz = 0;
  private gx = 0;
  private gz = 0;
  private dist = 30;
  private distGoal = 30;
  minDist = 5;
  maxDist = 120;
  readonly keys = new Set<string>();
  /** Set when the camera moved this frame (drives shadow refresh). */
  moved = true;
  /** True while the yaw is still easing; consumers re-orient decals. */
  yawChanged = false;

  constructor(private halfW: number, private halfH: number) {
    this.fit();
  }

  fit(): void {
    const span = Math.max(this.halfW, this.halfH) * 2;
    this.maxDist = Math.max(30, span * 1.5);
    this.distGoal = this.dist = Math.min(this.maxDist, 60, Math.max(14, span * 0.62));
    this.gx = this.tx = 0;
    this.gz = this.tz = 0;
    this.yaw = this.yawGoal = 0;
    this.moved = true;
  }

  setBoard(halfW: number, halfH: number): void {
    this.halfW = halfW;
    this.halfH = halfH;
    this.fit();
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.moved = true;
  }

  get targetX(): number {
    return this.tx;
  }
  get targetZ(): number {
    return this.tz;
  }

  /** Pan by screen-space pixel deltas (content follows the pointer). */
  dragPixels(dx: number, dy: number, viewportH: number): void {
    const upp = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.dist) / viewportH;
    this.panLocal(-dx * upp, (dy * upp) / SIN_PITCH, true);
  }

  /** right/forward in camera-yaw space (forward = away from viewer). */
  private panLocal(right: number, forward: number, snap = false): void {
    const s = Math.sin(this.yawGoal);
    const c = Math.cos(this.yawGoal);
    this.gx += right * c - forward * s;
    this.gz += -right * s - forward * c;
    this.clampGoal();
    if (snap) {
      this.tx = this.gx;
      this.tz = this.gz;
      this.moved = true;
    }
  }

  private clampGoal(): void {
    this.gx = Math.max(-this.halfW, Math.min(this.halfW, this.gx));
    this.gz = Math.max(-this.halfH, Math.min(this.halfH, this.gz));
  }

  zoom(factor: number): void {
    this.distGoal = Math.max(this.minDist, Math.min(this.maxDist, this.distGoal * factor));
  }

  rotate(dir: 1 | -1): void {
    this.yawGoal += (dir * Math.PI) / 2;
  }

  update(dt: number): void {
    let kr = 0;
    let kf = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) kr -= 1;
    if (k.has('d') || k.has('arrowright')) kr += 1;
    if (k.has('w') || k.has('arrowup')) kf += 1;
    if (k.has('s') || k.has('arrowdown')) kf -= 1;
    if (kr || kf) {
      const sp = this.dist * 0.9 * dt * (k.has('shift') ? 2.2 : 1);
      this.panLocal(kr * sp, kf * sp);
    }
    const a = 1 - Math.exp(-dt * 14);
    const dx = this.gx - this.tx;
    const dz = this.gz - this.tz;
    const dd = this.distGoal - this.dist;
    const dy = this.yawGoal - this.yaw;
    this.yawChanged = false;
    if (Math.abs(dx) + Math.abs(dz) > 1e-4 || Math.abs(dd) > 1e-3 || Math.abs(dy) > 1e-4) {
      this.tx += dx * a;
      this.tz += dz * a;
      this.dist += dd * a;
      if (Math.abs(dy) > 1e-4) {
        this.yaw += dy * (1 - Math.exp(-dt * 10));
        this.yawChanged = true;
      } else {
        this.yaw = this.yawGoal;
      }
      this.moved = true;
    }
    if (this.moved) {
      const d = this.dist;
      this.camera.position.set(
        this.tx + Math.sin(this.yaw) * COS_PITCH * d,
        SIN_PITCH * d,
        this.tz + Math.cos(this.yaw) * COS_PITCH * d,
      );
      this.camera.lookAt(this.tx, 0, this.tz);
      this.camera.updateMatrixWorld();
    }
  }
}
