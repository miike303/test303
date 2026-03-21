import { MISSIONS } from './config.js';

export class MissionsSystem {
  constructor(save) { this.save = save; }

  get list() { return MISSIONS.map((mission) => ({ ...mission, ...(this.save.missions[mission.id] || {}) })); }

  updateFromRun(runStats) {
    for (const mission of MISSIONS) {
      const slot = this.save.missions[mission.id];
      if (slot.completed) continue;
      let value = slot.progress;
      if (mission.type === 'time') value = Math.max(value, Math.floor(runStats.time));
      if (mission.type === 'coinsRun') value = Math.max(value, runStats.coins);
      if (mission.type === 'nearRun') value = Math.max(value, runStats.nearMisses);
      if (mission.type === 'biome2') value = Math.max(value, runStats.biomeIndex >= 1 ? 1 : 0);
      if (mission.type === 'powerRun') value = Math.max(value, runStats.powerupsUsed);
      if (mission.type === 'comboEnd') value = Math.max(value, Math.floor(runStats.combo));
      slot.progress = Math.min(mission.goal, value);
      slot.completed = slot.progress >= mission.goal;
    }
  }

  claim(id) {
    const mission = MISSIONS.find((item) => item.id === id);
    const slot = this.save.missions[id];
    if (!mission || !slot.completed || slot.claimed) return 0;
    slot.claimed = true;
    this.save.totalCoins += mission.reward;
    return mission.reward;
  }
}
