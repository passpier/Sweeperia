import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const tmpColor = new THREE.Color();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();

/**
 * Merges primitives into one flat-shaded, vertex-coloured geometry. Each vertex also carries a `glow`
 * float (emissive strength) and a baked height-based AO tint. `at()/size()/glow()` are sticky modifiers
 * so composite models (a grove = three trees) can be assembled from the same recipe.
 */
class Builder {
  private parts: THREE.BufferGeometry[] = [];
  private ox = 0;
  private oz = 0;
  private sc = 1;
  private gl = 0;

  at(x: number, z: number): this {
    this.ox = x;
    this.oz = z;
    return this;
  }
  size(s: number): this {
    this.sc = s;
    return this;
  }
  glow(g: number): this {
    this.gl = g;
    return this;
  }

  private push(g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): this {
    const geo = g.index ? g.toNonIndexed() : g;
    q.setFromEuler(e.set(rx, ry, rz));
    m4.compose(v3.set(x * this.sc + this.ox, y * this.sc, z * this.sc + this.oz), q, s3.setScalar(this.sc));
    geo.applyMatrix4(m4);
    geo.deleteAttribute('uv');
    geo.computeVertexNormals(); // non-indexed → flat facets
    tmpColor.setHex(color);
    const pos = geo.getAttribute('position');
    const n = pos.count;
    const arr = new Float32Array(n * 3);
    const gArr = new Float32Array(n).fill(this.gl);
    for (let i = 0; i < n; i++) {
      const ao = this.gl > 0 ? 1 : 0.78 + 0.22 * Math.min(1, pos.getY(i) / 0.75);
      arr[i * 3] = tmpColor.r * ao;
      arr[i * 3 + 1] = tmpColor.g * ao;
      arr[i * 3 + 2] = tmpColor.b * ao;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    geo.setAttribute('glow', new THREE.BufferAttribute(gArr, 1));
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
  /** Gable roof: triangle (width w, rise h) extruded along z by d, base at y. */
  prism(w: number, h: number, d: number, c: number, x: number, y: number, z: number, ry = 0): this {
    const sh = new THREE.Shape().moveTo(-w / 2, 0).lineTo(w / 2, 0).lineTo(0, h).closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return this.push(g, c, x, y, z, 0, ry, 0);
  }
  /** Grid of lit windows on a +z facing wall at z, centred on x0. */
  windows(x0: number, y0: number, z: number, cols: number, rows: number, dx: number, dy: number, w: number, h: number, c = 0xffd27a, g = 1): this {
    const prev = this.gl;
    this.gl = g;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        this.box(w, h, 0.02, c, x0 + (i - (cols - 1) / 2) * dx, y0 + j * dy, z);
      }
    }
    this.gl = prev;
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    for (const p of this.parts) p.dispose();
    g.computeBoundingSphere();
    return g;
  }
}

/** Chimney / flue top (x,y,z) in model space per age, for [house, landmark]; null = no smoke. */
export const SMOKE_POINTS: Array<[ [number, number, number] | null, [number, number, number] | null ]> = [
  [[0, 0.62, 0], [0, 0.36, 0]],
  [[0.2, 0.62, -0.1], null],
  [[0.2, 0.66, -0.1], null],
  [[0.22, 0.78, -0.08], null],
  [null, null],
];

function pine(bd: Builder, x: number, z: number, s: number, hue = 0): void {
  bd.at(x, z).size(s);
  bd.cyl(0.045, 0.07, 0.28, 6, 0x5e4126, 0, 0.14, 0);
  bd.cone(0.3, 0.3, 7, 0x2a5f35 + hue, 0, 0.36, 0).cone(0.24, 0.3, 7, 0x32703d + hue, 0, 0.56, 0).cone(0.17, 0.3, 7, 0x3c8447 + hue, 0, 0.76, 0).cone(0.09, 0.2, 7, 0x4a9a55 + hue, 0, 0.94, 0);
  bd.at(0, 0).size(1);
}

function oak(bd: Builder, x: number, z: number, s: number, hue = 0): void {
  bd.at(x, z).size(s);
  bd.cyl(0.05, 0.08, 0.34, 6, 0x6b4a2b, 0, 0.17, 0);
  bd.ico(0.24, 0x2f7a3a + hue, 0, 0.5, 0, 1, 0.85).ico(0.17, 0x3d8e46 + hue, 0.15, 0.62, 0.06, 1).ico(0.16, 0x45a050 + hue, -0.13, 0.58, -0.08, 1).ico(0.14, 0x56b05c + hue, 0.02, 0.76, -0.02, 1);
  bd.at(0, 0).size(1);
}

const b = () => new Builder();

export const Models = {
  pine: () => { const bd = b(); pine(bd, 0, 0, 1); return bd.build(); },
  oak: () => { const bd = b(); oak(bd, 0, 0, 1); return bd.build(); },
  grove: () => {
    const bd = b();
    pine(bd, -0.2, -0.12, 0.95);
    oak(bd, 0.22, -0.1, 0.9, 0x000800);
    pine(bd, 0.0, 0.24, 0.8, 0x000400);
    return bd.build();
  },
  tuft: () => {
    const bd = b();
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399;
      const r = 0.12 + (i % 4) * 0.08;
      const h = 0.14 + ((i * 7) % 5) * 0.03;
      bd.cone(0.025, h, 3, i % 2 ? 0x5fae48 : 0x74c35a, Math.cos(a) * r, h / 2, Math.sin(a) * r);
    }
    return bd.build();
  },
  rock: () =>
    b().ico(0.27, 0x8a8a88, 0, 0.14, 0, 1, 0.7).ico(0.16, 0x9b9b97, 0.2, 0.08, 0.1, 1, 0.7).ico(0.1, 0x77776f, -0.2, 0.05, -0.08, 1, 0.8).ico(0.12, 0x5f7f4a, -0.02, 0.2, 0.02, 0, 0.3).build(),
  goldRock: () =>
    b().ico(0.27, 0x7d7b78, 0, 0.14, 0, 1, 0.7).glow(0.9).ico(0.1, 0xf2c230, 0.1, 0.3, 0.05).ico(0.08, 0xffd54a, -0.12, 0.22, 0.12).ico(0.07, 0xf2c230, 0.05, 0.2, -0.16).ico(0.06, 0xffe27a, -0.1, 0.12, -0.14).build(),
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

  // ---- Age buildings: [A: common dwelling, B: landmark]; footprint ≈ 0.75 of a cell ----
  buildings: [
    // Stone age
    [
      () =>
        b().cyl(0.3, 0.33, 0.24, 9, 0xa88458, 0, 0.12, 0).cone(0.46, 0.46, 9, 0xcaa74e, 0, 0.45, 0).cone(0.1, 0.12, 6, 0xb89440, 0, 0.74, 0)
          .glow(0.9).box(0.1, 0.16, 0.02, 0xff9a3a, 0, 0.09, 0.33).build(),
      () => {
        const bd = b();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          bd.ico(0.06, 0x8d8a82, Math.cos(a) * 0.17, 0.04, Math.sin(a) * 0.17);
        }
        bd.box(0.32, 0.05, 0.06, 0x5e4126, 0, 0.07, 0, 0.5).box(0.32, 0.05, 0.06, 0x4e351f, 0, 0.1, 0, -0.5).box(0.3, 0.05, 0.06, 0x6b4a2b, 0, 0.13, 0, 1.6);
        return bd.glow(1).cone(0.1, 0.3, 5, 0xff7a1f, 0, 0.27, 0).cone(0.06, 0.24, 5, 0xffd24a, 0, 0.3, 0).build();
      },
    ],
    // Bronze age
    [
      () =>
        b().box(0.64, 0.06, 0.5, 0x8c8478, 0, 0.03, 0).box(0.56, 0.3, 0.42, 0xd3b184, 0, 0.21, 0).prism(0.74, 0.28, 0.56, 0xa5532f, 0, 0.36, 0, 0)
          .box(0.1, 0.62 - 0.4, 0.1, 0x8c8478, 0.2, 0.5, -0.1).box(0.12, 0.2, 0.02, 0x4a3320, 0.12, 0.16, 0.215)
          .windows(-0.14, 0.24, 0.215, 1, 1, 0, 0, 0.1, 0.1).build(),
      () =>
        b().box(0.7, 0.12, 0.7, 0xd9c9a0, 0, 0.06, 0).box(0.52, 0.12, 0.52, 0xe6d8b0, 0, 0.18, 0).box(0.34, 0.12, 0.34, 0xd9c9a0, 0, 0.3, 0)
          .box(0.12, 0.2, 0.02, 0x4a3320, 0, 0.1, 0.355).glow(0.7).cone(0.16, 0.22, 4, 0xe3b94a, 0, 0.47, 0, Math.PI / 4).build(),
    ],
    // Medieval
    [
      () =>
        b().box(0.66, 0.1, 0.5, 0x7b7a74, 0, 0.05, 0).box(0.58, 0.3, 0.44, 0xe4d7b8, 0, 0.25, 0)
          .box(0.04, 0.3, 0.46, 0x5a4026, -0.29, 0.25, 0).box(0.04, 0.3, 0.46, 0x5a4026, 0.29, 0.25, 0).box(0.6, 0.04, 0.46, 0x5a4026, 0, 0.3, 0)
          .prism(0.78, 0.36, 0.58, 0x9a3b2c, 0, 0.4, 0).box(0.1, 0.26, 0.1, 0x7b7a74, 0.2, 0.62, -0.1).box(0.12, 0.2, 0.02, 0x4a3320, -0.12, 0.2, 0.225)
          .windows(0.14, 0.28, 0.225, 1, 1, 0, 0, 0.1, 0.1).build(),
      () => {
        const g = b().box(0.24, 0.16, 0.24, 0xcfc4a8, 0, 0.08, 0).cyl(0.13, 0.19, 0.5, 8, 0xe2d6bd, 0, 0.4, 0).cone(0.2, 0.22, 8, 0x8a4b2d, 0, 0.76, 0).glow(0.8).box(0.07, 0.1, 0.02, 0xffd27a, 0, 0.5, 0.15);
        g.glow(0);
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          g.box(0.05, 0.42, 0.015, 0xf1e6c3, Math.sin(a) * 0.2, 0.7 + Math.cos(a) * 0.2, 0.2, 0, 0, a);
        }
        return g.build();
      },
    ],
    // Gunpowder age
    [
      () =>
        b().box(0.68, 0.1, 0.52, 0x6e6a66, 0, 0.05, 0).box(0.6, 0.34, 0.46, 0xb5543b, 0, 0.27, 0).prism(0.8, 0.3, 0.6, 0x3f4650, 0, 0.44, 0)
          .box(0.12, 0.38, 0.12, 0x8a4332, 0.22, 0.66, -0.08).box(0.14, 0.04, 0.14, 0x4a3a30, 0.22, 0.86, -0.08)
          .windows(-0.12, 0.3, 0.235, 2, 1, 0.24, 0, 0.1, 0.12).box(0.12, 0.22, 0.02, 0x3a2a1c, 0.0, 0.21, 0.235).build(),
      () =>
        b().box(0.54, 0.34, 0.4, 0xe8e2d4, -0.04, 0.17, 0).prism(0.64, 0.2, 0.46, 0x8a3b2a, -0.04, 0.34, 0).box(0.18, 0.7, 0.18, 0xdcd5c4, 0.2, 0.35, 0)
          .cone(0.15, 0.3, 4, 0x8a3b2a, 0.2, 0.85, 0, Math.PI / 4).glow(0.9).box(0.07, 0.14, 0.02, 0xffd27a, 0.2, 0.58, 0.095).box(0.1, 0.16, 0.02, 0xffd27a, -0.1, 0.2, 0.205).build(),
    ],
    // Modern
    [
      () =>
        b().box(0.56, 0.74, 0.44, 0xaeb4ba, 0, 0.37, 0).box(0.58, 0.04, 0.46, 0x6f757b, 0, 0.76, 0).box(0.16, 0.08, 0.14, 0x8c9399, -0.14, 0.82, 0.04)
          .windows(0, 0.14, 0.225, 3, 5, 0.17, 0.13, 0.09, 0.08, 0x9fd8ff, 0.9).build(),
      () =>
        b().box(0.34, 1.1, 0.34, 0x7fa3bd, 0, 0.55, 0).box(0.38, 0.05, 0.38, 0x4a6478, 0, 1.12, 0).cyl(0.012, 0.012, 0.3, 4, 0xcfd6dc, 0, 1.29, 0)
          .windows(0, 0.1, 0.175, 3, 7, 0.1, 0.14, 0.055, 0.09, 0xcfeaff, 0.9).glow(1.2).ico(0.03, 0xff4040, 0, 1.45, 0).build(),
    ],
  ] as Array<[() => THREE.BufferGeometry, () => THREE.BufferGeometry]>,
};
