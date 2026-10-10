import * as THREE from 'three';
import { PropLayer } from './PropLayer';

const COLORS = ['', '#1f6fe0', '#1f9a3a', '#e03a2f', '#1a2c8a', '#9a1f1f', '#14909a', '#222222', '#6b6b6b'];

function makeAtlas(): THREE.CanvasTexture {
  const cell = 128;
  const canvas = document.createElement('canvas');
  canvas.width = cell * 8;
  canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${cell * 0.82}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  ctx.lineJoin = 'round';
  for (let n = 1; n <= 8; n++) {
    const cx = (n - 1) * cell + cell / 2;
    ctx.lineWidth = cell * 0.12;
    ctx.strokeStyle = 'rgba(255,248,230,0.95)';
    ctx.strokeText(String(n), cx, cell / 2 + 4);
    ctx.fillStyle = COLORS[n];
    ctx.fillText(String(n), cx, cell / 2 + 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Digits 1..8 as flat decals: eight InstancedMeshes sharing one atlas (no custom shaders). */
export class NumberLayer {
  readonly layers: PropLayer[] = [];
  readonly group = new THREE.Group();
  private yaw = 0;

  /** Atlas + material are built once and shared by every board. */
  static material(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ map: makeAtlas(), transparent: true, alphaTest: 0.35, depthWrite: true });
  }

  constructor(cells: number, mat: THREE.Material) {
    for (let n = 1; n <= 8; n++) {
      const g = new THREE.PlaneGeometry(0.78, 0.78);
      g.rotateX(-Math.PI / 2);
      const uv = g.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) + (n - 1)) / 8);
      const layer = new PropLayer(g, mat, cells, false, false);
      this.layers.push(layer);
      this.group.add(layer.mesh);
    }
  }

  add(cell: number, n: number, x: number, y: number, z: number, now: number, delay: number): void {
    const l = this.layers[n - 1];
    l.yawOffset = this.yaw;
    l.add(cell, x, y, z, 0, 1, now, delay);
  }

  setYaw(yaw: number, now: number): void {
    this.yaw = yaw;
    for (const l of this.layers) {
      l.yawOffset = yaw;
      l.refreshAll(now);
    }
  }

  update(now: number): boolean {
    let busy = false;
    for (const l of this.layers) busy = l.update(now) || busy;
    return busy;
  }

  clear(): void {
    for (const l of this.layers) l.clear();
  }

  dispose(): void {
    for (const l of this.layers) l.mesh.geometry.dispose();
  }
}
