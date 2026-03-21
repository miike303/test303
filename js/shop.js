import { COSMETICS } from './config.js';

export class ShopSystem {
  constructor(save) { this.save = save; }

  purchase(group, id) {
    const item = COSMETICS[group].find((entry) => entry.id === id);
    if (!item || this.save.unlocks[group][id] || this.save.totalCoins < item.cost) return false;
    this.save.totalCoins -= item.cost;
    this.save.unlocks[group][id] = true;
    return true;
  }

  select(group, id) {
    if (!this.save.unlocks[group][id]) return false;
    this.save.selected[group.slice(0, -1)] = id;
    return true;
  }
}
