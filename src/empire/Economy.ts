import { Terrain } from '../core/Terrain';
import type { Cost, ResKey } from './Ages';

const TERRAIN_RES: Record<number, ResKey> = {
  [Terrain.Grass]: 'food',
  [Terrain.Forest]: 'wood',
  [Terrain.Rock]: 'stone',
  [Terrain.Gold]: 'gold',
  [Terrain.Water]: 'food',
};

export class Economy {
  food = 0;
  wood = 0;
  stone = 0;
  gold = 0;

  /** Resource yielded by revealing a cell; higher numbers pay more (risk/reward). */
  static yieldFor(terrain: number, adj: number): { res: ResKey; amount: number } {
    const res = TERRAIN_RES[terrain] ?? 'food';
    const base = res === 'gold' ? 2 : 3;
    return { res, amount: base + adj * 2 };
  }

  add(res: ResKey, amount: number): void {
    this[res] += amount;
  }

  canAfford(cost: Cost): boolean {
    return (
      this.food >= (cost.food ?? 0) &&
      this.wood >= (cost.wood ?? 0) &&
      this.stone >= (cost.stone ?? 0) &&
      this.gold >= (cost.gold ?? 0)
    );
  }

  spend(cost: Cost): boolean {
    if (!this.canAfford(cost)) return false;
    this.food -= cost.food ?? 0;
    this.wood -= cost.wood ?? 0;
    this.stone -= cost.stone ?? 0;
    this.gold -= cost.gold ?? 0;
    return true;
  }

  get total(): number {
    return this.food + this.wood + this.stone + this.gold;
  }
}
