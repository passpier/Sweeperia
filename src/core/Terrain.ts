import { mulberry32 } from './rng';

export const enum Terrain {
  Grass = 0,
  Forest = 1,
  Rock = 2,
  Gold = 3,
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Assign a terrain to every cell with two noise fields (moisture + ruggedness) and sparse gold. */
export function generateTerrain(width: number, height: number, seed: number): Uint8Array {
  const out = new Uint8Array(width * height);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const moisture = valueNoise(x / 5, y / 5, seed) * 0.7 + valueNoise(x / 2, y / 2, seed + 7) * 0.3;
      const rugged = valueNoise(x / 6, y / 6, seed + 101);
      let t = Terrain.Grass;
      if (rugged > 0.64) t = Terrain.Rock;
      else if (moisture > 0.56) t = Terrain.Forest;
      if (t === Terrain.Rock && rng() < 0.22) t = Terrain.Gold;
      out[y * width + x] = t;
    }
  }
  return out;
}
