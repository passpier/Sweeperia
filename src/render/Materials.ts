import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import {
  attribute, cameraPosition, clamp, dot, float, fract, max, mix, normalize, pow, positionGeometry, positionLocal,
  normalWorld, positionWorld, sin, smoothstep, step, texture, time, uniform, uv, vec2, vec3, vec4,
} from 'three/tsl';

/** Sky colour, mirrored from World.setAtmosphere so the water can reflect it. */
export const skyColor = uniform(new THREE.Color(0x9fc4d8));
/** 0..1 multiplier for ambient motion (sway, water flow, smoke). 0 on the low quality tier. */
export const motion = uniform(1);

/** Render-detail switches, set once from the quality setting before any view is built. */
export const gfx = { detail: true };

export const SUN_DIR = new THREE.Vector3(-50, 58, 34).normalize();

/** Props: vertex colours, optional wind sway, and a `glow` vertex attribute that drives emissive. */
export function propMaterial(sway: boolean): MeshLambertNodeMaterial {
  const m = new MeshLambertNodeMaterial({ vertexColors: true });
  const col = attribute('color', 'vec3');
  const glow = attribute('glow', 'float');
  const pulse = float(1).add(sin(time.mul(2.4).add(positionLocal.x.mul(7)).add(positionLocal.z.mul(5))).mul(0.35).mul(motion));
  (m as unknown as { emissiveNode: unknown }).emissiveNode = col.mul(glow).mul(pulse).mul(1.4);
  if (sway) {
    // positionLocal is already in world space here (instancing is applied first); geometry y is the lever arm.
    const h = positionGeometry.y;
    const ph = positionLocal.x.mul(1.7).add(positionLocal.z.mul(1.3));
    const a = sin(time.mul(1.7).add(ph)).mul(0.035).mul(h).mul(h).mul(motion);
    const b = sin(time.mul(1.3).add(ph.mul(0.8)).add(1.9)).mul(0.025).mul(h).mul(h).mul(motion);
    m.positionNode = positionLocal.add(vec3(a, 0, b));
  }
  return m;
}

/** Tileable value-noise lattice sample (smoothstep-interpolated, wraps at `period`). */
function tileNoise(lat: Float32Array, period: number, u: number, v: number): number {
  const x = u * period, y = v * period;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const at = (i: number, j: number) => lat[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
  const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

/** 256² tileable noise: r = soft blotches, g = fine grain, b = smooth field whose contours become cracks. */
function makeTerrainNoise(): THREE.DataTexture {
  const N = 256;
  let seed = 1337;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const lattice = (p: number) => Float32Array.from({ length: p * p }, rnd);
  const L = { 4: lattice(4), 8: lattice(8), 16: lattice(16), 32: lattice(32), 64: lattice(64), 6: lattice(6), 12: lattice(12) } as Record<number, Float32Array>;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      const r = tileNoise(L[4], 4, u, v) * 0.5 + tileNoise(L[8], 8, u, v) * 0.3 + tileNoise(L[16], 16, u, v) * 0.2;
      const g = tileNoise(L[32], 32, u, v) * 0.55 + tileNoise(L[64], 64, u, v) * 0.45;
      const b = tileNoise(L[6], 6, u, v) * 0.65 + tileNoise(L[12], 12, u, v) * 0.35;
      const o = (y * N + x) * 4;
      data[o] = r * 255;
      data[o + 1] = g * 255;
      data[o + 2] = b * 255;
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/**
 * Board tiles. Instance colour carries the base hue; this adds per-terrain surface detail
 * (blotches, grass streaks, rock cracks, gold glints), a centre-lit bevel and side ambient occlusion.
 * Without `gfx.detail` it falls back to the cheap hash-grain version.
 */
export function tileMaterial(): MeshLambertNodeMaterial {
  const m = new MeshLambertNodeMaterial();
  const e = uv().sub(0.5).abs().mul(2); // 0 centre → 1 edge
  const d = float(1).sub(max(e.x, e.y));
  if (!gfx.detail) {
    const grad = mix(float(0.8), float(1.04), smoothstep(0.0, 0.3, d));
    const p = positionWorld.xz.mul(23.7);
    const grain = fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453)).mul(0.1).add(0.95);
    const streak = sin(positionWorld.x.mul(41).add(positionWorld.z.mul(7))).mul(0.025).add(1);
    m.colorNode = vec4(vec3(grad.mul(grain).mul(streak)), 1);
    return m;
  }
  const noise = makeTerrainNoise();
  const xz = positionWorld.xz;
  const blot = texture(noise, xz.mul(0.21)).x;
  const fine = texture(noise, xz.mul(0.9).add(vec2(0.37, 0.11))).y;
  const grain = texture(noise, xz.mul(3.1)).y;
  const veins = texture(noise, xz.mul(0.33).add(vec2(0.5, 0.2))).z;
  const t = attribute('terrain', 'float');
  const isForest = step(0.5, t).mul(step(t, 1.5));
  const isRock = step(1.5, t).mul(step(t, 2.5));
  const isGold = step(2.5, t).mul(step(t, 3.5));
  const isGrass = step(t, 0.5);

  const top = smoothstep(0.5, 0.9, normalWorld.y);
  const tone = float(1).add(blot.sub(0.5).mul(0.34)).add(fine.sub(0.5).mul(0.2)).add(grain.sub(0.5).mul(0.12));
  const blades = sin(xz.x.mul(38).add(fine.mul(14))).mul(sin(xz.y.mul(31).add(blot.mul(9)))).mul(0.045).mul(isGrass.add(isForest));
  const crack = smoothstep(0.03, 0.0, veins.sub(0.5).abs()).mul(isRock).mul(0.42);
  const glint = step(0.88, fine).mul(sin(time.mul(2.6).add(blot.mul(40))).mul(0.5).add(0.5)).mul(isGold).mul(0.55).mul(motion);
  const surface = tone.add(blades).sub(crack).add(glint.mul(top));

  const bevel = mix(float(0.84), float(1.03), smoothstep(0.0, 0.22, d));
  const rim = mix(float(1), bevel, top);
  const ao = mix(float(1), float(0.55).add(smoothstep(0.0, 0.45, positionWorld.y).mul(0.45)), float(1).sub(top));
  m.colorNode = vec4(vec3(surface.mul(rim).mul(ao)), 1);
  return m;
}

/** Tileable gradient map (rg) + value noise (b), generated once — much cheaper than per-pixel noise. */
function makeWaterMap(): THREE.DataTexture {
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  const waves: Array<[number, number, number, number]> = [
    [1, 2, 1.0, 0.3], [3, 1, 0.8, 1.7], [2, 5, 0.5, 4.1], [6, 3, 0.35, 2.2], [5, 8, 0.2, 0.9],
  ];
  const T = Math.PI * 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let gx = 0, gy = 0, v = 0;
      for (const [fx, fy, a, ph] of waves) {
        const arg = (x / N) * T * fx + (y / N) * T * fy + ph;
        const c = Math.cos(arg) * a;
        gx += c * fx;
        gy += c * fy;
        v += Math.sin(arg) * a;
      }
      const o = (y * N + x) * 4;
      data[o] = Math.max(0, Math.min(255, 128 + gx * 9));
      data[o + 1] = Math.max(0, Math.min(255, 128 + gy * 9));
      data[o + 2] = Math.max(0, Math.min(255, 128 + v * 40));
      data[o + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/**
 * One water surface for the whole board + surrounding sea. `mask` is a W×H texture (linear filtered),
 * 1 where water is revealed; outside the board it is treated as 1 (sea).
 */
export function waterMaterial(mask: THREE.DataTexture, w: number, h: number): MeshBasicNodeMaterial {
  const m = new MeshBasicNodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  const map = makeWaterMap();
  const wp = positionWorld;
  const t = time.mul(motion);
  const g1 = texture(map, wp.xz.mul(0.16).add(vec2(t.mul(0.045), t.mul(0.018))));
  const g2 = texture(map, wp.xz.mul(0.27).add(vec2(t.mul(-0.03), t.mul(0.05))));
  const nrm = normalize(vec3(g1.x.add(g2.x).sub(1).mul(0.9), 1, g1.y.add(g2.y).sub(1).mul(0.9)));

  const muv = vec2(wp.x.div(w).add(0.5), wp.z.div(h).add(0.5));
  const inside = step(0, muv.x).mul(step(muv.x, 1)).mul(step(0, muv.y)).mul(step(muv.y, 1));
  const msk = mix(float(1), texture(mask, muv).x, inside);

  const view = normalize(cameraPosition.sub(wp));
  const fres = pow(float(1).sub(max(dot(nrm, view), 0)), 3).mul(0.75).add(0.06);
  const half = normalize(vec3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).add(view));
  const spec = pow(max(dot(nrm, half), 0), 140).mul(2.2);

  const shallow = vec3(0.07, 0.42, 0.46);
  const deep = vec3(0.01, 0.12, 0.26);
  const depthK = smoothstep(0.55, 1.0, msk);
  const body = mix(shallow, deep, depthK).add(g1.z.sub(0.5).mul(0.06));
  const col = mix(body, skyColor, fres).add(vec3(1, 0.95, 0.82).mul(spec));

  // Foam along shorelines (where the mask ramps 1→0.5) with a travelling pulse.
  const edge = float(1).sub(smoothstep(0.52, 0.86, msk));
  const noise = texture(map, wp.xz.mul(0.55).add(vec2(t.mul(0.02), 0))).z;
  const pulseF = sin(t.mul(2.2).add(msk.mul(18)).add(noise.mul(6))).mul(0.25).add(0.75);
  const foam = clamp(edge.mul(smoothstep(0.35, 0.75, noise.add(edge.mul(0.5)))).mul(pulseF).mul(1.6), 0, 1);

  m.colorNode = mix(col, vec3(0.95, 0.98, 1.0), foam);
  m.opacityNode = smoothstep(0.42, 0.52, msk).mul(mix(float(0.9), float(1), foam));
  return m;
}

/** Billboard puffs driven entirely in the vertex stage: base+phase per instance, no CPU work per frame. */
export function smokeMaterial(): SpriteNodeMaterial {
  const m = new SpriteNodeMaterial();
  m.transparent = true;
  m.depthWrite = false;
  const base = attribute('sBase', 'vec4');
  const age = fract(time.mul(0.22).mul(motion).add(base.w));
  const drift = vec3(age.mul(0.16).add(sin(base.w.mul(40).add(age.mul(3))).mul(0.03)), age.mul(0.85), age.mul(0.06));
  m.positionNode = base.xyz.add(drift);
  m.scaleNode = float(0.07).add(age.mul(0.2));
  const r = uv().sub(0.5).length().mul(2);
  const soft = float(1).sub(smoothstep(0.2, 1.0, r));
  m.colorNode = vec4(vec3(0.82, 0.82, 0.8), 1);
  m.opacityNode = soft.mul(float(1).sub(age)).mul(smoothstep(0.0, 0.12, age)).mul(0.55);
  return m;
}
