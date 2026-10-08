import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const tmpColor = new THREE.Color();

class Builder {
  private parts: THREE.BufferGeometry[] = [];

  private push(g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): this {
    const geo = g.index ? g.toNonIndexed() : g;
    q.setFromEuler(e.set(rx, ry, rz));
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m4);
    geo.deleteAttribute('uv');
    tmpColor.setHex(color);
    tmpColor.convertSRGBToLinear();
    const n = geo.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = tmpColor.r;
      arr[i * 3 + 1] = tmpColor.g;
      arr[i * 3 + 2] = tmpColor.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.parts.push(geo);
    return this;
  }

  box(w: number, h: number, d: number, c: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): this {
    return this.push(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz);
  }
  cyl(rt: number, rb: number, h: number, seg: number, c: number, x: number, y: number, z: number, rx = 0, rz = 0): this {
    return this.push(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z, rx, 0, rz);
  }
  cone(r: number, h: number, seg: number, c: number, x: number, y: number, z: number, ry = 0): this {
    return this.push(new THREE.ConeGeometry(r, h, seg), c, x, y, z, 0, ry, 0);
  }
  ico(r: number, c: number, x: number, y: number, z: number, detail = 0, sy = 1): this {
    const g = new THREE.IcosahedronGeometry(r, detail);
    g.scale(1, sy, 1);
    return this.push(g, c, x, y, z);
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    g.computeBoundingSphere();
    return g;
  }
}

const b = () => new Builder();

export const Models = {
  tree: () =>
    b().cyl(0.05, 0.07, 0.25, 6, 0x6b4a2b, 0, 0.125, 0).cone(0.26, 0.4, 7, 0x2f6b3a, 0, 0.42, 0).cone(0.19, 0.34, 7, 0x3a8045, 0, 0.66, 0).build(),
  rock: () => b().ico(0.26, 0x8a8a88, 0, 0.14, 0, 0, 0.7).ico(0.15, 0x9b9b97, 0.2, 0.08, 0.1, 0, 0.7).build(),
  goldRock: () =>
    b().ico(0.26, 0x7d7b78, 0, 0.14, 0, 0, 0.7).ico(0.1, 0xf2c230, 0.1, 0.3, 0.05).ico(0.08, 0xffd54a, -0.12, 0.22, 0.12).ico(0.07, 0xf2c230, 0.05, 0.2, -0.16).build(),
  flag: () => b().cyl(0.02, 0.02, 0.55, 5, 0x4a3a2a, 0, 0.275, 0).box(0.26, 0.17, 0.02, 0xd1342c, 0.13, 0.46, 0).cyl(0.07, 0.09, 0.05, 8, 0x5a4a3a, 0, 0.025, 0).build(),
  mine: () => {
    const bd = b().ico(0.2, 0x2a2a30, 0, 0.22, 0, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      bd.cone(0.045, 0.16, 5, 0xa3281f, Math.cos(a) * 0.22, 0.22, Math.sin(a) * 0.22);
    }
    return bd.cone(0.045, 0.16, 5, 0xa3281f, 0, 0.45, 0).build();
  },
  marker: () => b().cone(0.16, 0.36, 4, 0xff3b3b, 0, 0.62, 0).build(),

  // ---- Age buildings: [A: common dwelling/unit, B: landmark] ----
  buildings: [
    [
      () => b().cone(0.3, 0.5, 5, 0xc9a77a, 0, 0.25, 0).box(0.1, 0.18, 0.02, 0x3b2a1a, 0, 0.09, 0.27).build(),
      () => b().cyl(0.1, 0.12, 0.05, 8, 0x4a4a48, 0, 0.025, 0).cone(0.05, 0.22, 5, 0xff8a1f, 0, 0.16, 0).box(0.3, 0.05, 0.05, 0x6b4a2b, 0, 0.06, 0, 0.5).box(0.3, 0.05, 0.05, 0x6b4a2b, 0, 0.06, 0, -0.5).build(),
    ],
    [
      () => b().box(0.5, 0.3, 0.5, 0xb98a5a, 0, 0.15, 0).cone(0.42, 0.25, 4, 0x7a5a30, 0, 0.42, 0, Math.PI / 4).build(),
      () => b().box(0.22, 0.12, 0.22, 0xd9c9a0, 0, 0.06, 0).cyl(0.07, 0.11, 0.7, 4, 0xe6d8b0, 0, 0.45, 0).cone(0.08, 0.14, 4, 0xe3b94a, 0, 0.87, 0).build(),
    ],
    [
      () => {
        const bd = b().box(0.62, 0.4, 0.62, 0xa6a9b0, 0, 0.2, 0).box(0.14, 0.2, 0.02, 0x3b2a1a, 0, 0.1, 0.32);
        for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
          bd.cyl(0.1, 0.11, 0.62, 8, 0x9a9da6, x, 0.31, z).cone(0.13, 0.22, 8, 0xb23a30, x, 0.73, z);
        }
        return bd.build();
      },
      () => {
        const g = b().cyl(0.14, 0.2, 0.6, 8, 0xe2d6bd, 0, 0.3, 0).cone(0.2, 0.2, 8, 0x8a4b2d, 0, 0.7, 0);
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          g.box(0.05, 0.4, 0.015, 0xf1e6c3, Math.sin(a) * 0.2, 0.62 + Math.cos(a) * 0.2, 0.17, 0, 0, a);
        }
        return g.build();
      },
    ],
    [
      () => b().box(0.5, 0.1, 0.34, 0x6b5a45, 0, 0.1, 0).cyl(0.07, 0.08, 0.5, 8, 0x3d3f45, 0.05, 0.28, 0, 0, Math.PI / 2 - 0.4).cyl(0.14, 0.14, 0.04, 10, 0x4a3a2a, -0.15, 0.14, 0.2, Math.PI / 2).cyl(0.14, 0.14, 0.04, 10, 0x4a3a2a, -0.15, 0.14, -0.2, Math.PI / 2).build(),
      () => b().box(0.5, 0.32, 0.36, 0xe8e2d4, 0, 0.16, 0).cone(0.4, 0.16, 4, 0x8a3b2a, 0, 0.4, 0, Math.PI / 4).box(0.16, 0.6, 0.16, 0xdcd5c4, 0.18, 0.5, 0).cone(0.13, 0.32, 4, 0x8a3b2a, 0.18, 0.96, 0, Math.PI / 4).build(),
    ],
    [
      () => {
        const bd = b().box(0.7, 0.28, 0.5, 0x9aa1a8, 0, 0.14, 0);
        for (let i = -1; i <= 1; i++) bd.box(0.2, 0.08, 0.5, 0x7b838b, i * 0.22, 0.32, 0, 0, 0, 0);
        return bd.cyl(0.05, 0.05, 0.5, 8, 0x555a60, -0.25, 0.5, -0.12).cyl(0.045, 0.045, 0.38, 8, 0x555a60, -0.12, 0.45, -0.12).build();
      },
      () => b().cyl(0.04, 0.06, 0.62, 6, 0xbfc4c9, 0, 0.31, 0).cyl(0.3, 0.02, 0.1, 14, 0xe8eef2, 0, 0.66, 0.05, -0.9).ico(0.04, 0xff4040, 0, 0.7, 0.12).build(),
    ],
  ] as Array<[() => THREE.BufferGeometry, () => THREE.BufferGeometry]>,
};
