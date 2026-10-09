export const RES = ['food', 'wood', 'stone', 'gold'] as const;
export type ResKey = (typeof RES)[number];
export type Cost = Partial<Record<ResKey, number>>;

export interface AgeDef {
  id: number;
  /** Cost to advance INTO this age. */
  cost: Cost;
  /** Ground tint multiplier colours (revealed / hidden). */
  revealed: number;
  hidden: number;
  sky: number;
  fog: number;
  /** Sun colour: warm in the early ages, cooler and whiter towards the modern one. */
  sun: number;
  accent: string;
}

export const AGES: readonly AgeDef[] = [
  { id: 0, cost: {}, revealed: 0xb9a37a, hidden: 0x6f7a4c, sky: 0x9fc4d8, fog: 0xb7d2e0, sun: 0xffe2b0, accent: '#c9a36b' },
  { id: 1, cost: { food: 60, wood: 40 }, revealed: 0xc8b07e, hidden: 0x728354, sky: 0xa6cade, fog: 0xc4d9e3, sun: 0xffe6bc, accent: '#d08a43' },
  { id: 2, cost: { food: 140, wood: 110, stone: 60 }, revealed: 0xaaa79a, hidden: 0x5f7a52, sky: 0x93b4cf, fog: 0xb1c7d6, sun: 0xfff0d2, accent: '#9aa7b8' },
  { id: 3, cost: { food: 260, wood: 180, stone: 140, gold: 60 }, revealed: 0x9a958d, hidden: 0x586b55, sky: 0x8aa0b5, fog: 0xa4b4c0, sun: 0xfff4e0, accent: '#c85a3a' },
  { id: 4, cost: { food: 420, wood: 260, stone: 240, gold: 180 }, revealed: 0x8b8f94, hidden: 0x4f6360, sky: 0x7fa0c2, fog: 0x9db2c4, sun: 0xeef4ff, accent: '#4aa3df' },
];

export const MAX_AGE = AGES.length - 1;

export interface AbilityDef {
  id: 'scout' | 'wall' | 'engineer' | 'radar';
  minAge: number;
  cost: Cost;
  cooldownMs: number;
  /** Needs the player to click a target cell. */
  targeted: boolean;
}

export const ABILITIES: readonly AbilityDef[] = [
  { id: 'scout', minAge: 1, cost: { food: 30, wood: 10 }, cooldownMs: 8000, targeted: false },
  { id: 'wall', minAge: 2, cost: { stone: 40, wood: 30 }, cooldownMs: 6000, targeted: false },
  { id: 'engineer', minAge: 3, cost: { gold: 20, stone: 20 }, cooldownMs: 5000, targeted: true },
  { id: 'radar', minAge: 4, cost: { gold: 40, stone: 30 }, cooldownMs: 10000, targeted: true },
];
