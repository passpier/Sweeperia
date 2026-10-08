import * as THREE from 'three';
import { SMOKE_POINTS } from './PropFactory';
import { smokeMaterial } from './Materials';

const PUFFS = 4;

interface Source {
  x: number;
  y: number;
  z: number;
  yaw: number;
  landmark: boolean;
}

/** Chimney smoke. Each source is 4 billboard puffs whose whole life cycle is computed in the vertex shader. */
export class SmokeLayer {
  readonly mesh: THREE.Mesh;
  private readonly sources = new Map<number, Source>();
  private readonly base: THREE.InstancedBufferAttribute;
  private age = 0;

  constructor(cells: number) {
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    geo.setAttribute('uv', quad.getAttribute('uv'));
    this.base = new THREE.InstancedBufferAttribute(new Float32Array(cells * PUFFS * 4), 4);
    this.base.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('sBase', this.base);
    geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(geo, smokeMaterial());
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  add(cell: number, x: number, y: number, z: number, yaw: number, landmark: boolean): void {
    this.sources.set(cell, { x, y, z, yaw, landmark });
    this.rebuild();
  }

  setAge(age: number): void {
    this.age = age;
    this.rebuild();
  }

  clear(): void {
    this.sources.clear();
    this.rebuild();
  }

  private rebuild(): void {
    const a = this.base.array as Float32Array;
    let n = 0;
    for (const [cell, s] of this.sources) {
      const p = SMOKE_POINTS[this.age][s.landmark ? 1 : 0];
      if (!p) continue;
      const c = Math.cos(s.yaw);
      const sn = Math.sin(s.yaw);
      const x = s.x + p[0] * c + p[2] * sn;
      const z = s.z - p[0] * sn + p[2] * c;
      for (let k = 0; k < PUFFS; k++) {
        const o = n++ * 4;
        a[o] = x;
        a[o + 1] = s.y + p[1];
        a[o + 2] = z;
        a[o + 3] = (k + ((cell * 0.37) % 1)) / PUFFS;
      }
    }
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
    this.base.needsUpdate = true;
  }
}
