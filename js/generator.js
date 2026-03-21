import { BIOMES, CHUNK_HEIGHT, EVENTS, POWERUPS, SAFE_START_DISTANCE, SHAFT_WIDTH } from './config.js';
import { choose, rand } from './physics.js';
import { spawnPattern } from './obstacles.js';

export class Generator {
  constructor() { this.reset(); }

  reset() {
    this.nextChunkY = 760;
    this.lastEventY = 0;
    this.activeEvent = null;
  }

  biomeFor(distance) {
    let biome = BIOMES[0];
    for (const item of BIOMES) if (distance >= item.distance) biome = item;
    return biome;
  }

  difficulty(distance, time) {
    return 1 + distance / 700 + time / 18;
  }

  tier(distance) {
    if (distance < 1800) return 1;
    if (distance < 4200) return 2;
    if (distance < 7200) return 3;
    return 4;
  }

  maybeEvent(distance) {
    if (distance < 900 || distance - this.lastEventY < 1500 || Math.random() > 0.12) return null;
    this.lastEventY = distance;
    this.activeEvent = { ...choose(EVENTS), elapsed: 0 };
    return this.activeEvent;
  }

  generateUntil(distance, state) {
    while (this.nextChunkY > -distance - CHUNK_HEIGHT * 2) {
      this.buildChunk(this.nextChunkY, state);
      this.nextChunkY -= CHUNK_HEIGHT;
    }
  }

  buildChunk(chunkBaseY, state) {
    const distance = Math.max(0, -chunkBaseY + 820);
    const difficulty = this.difficulty(distance, state.time);
    const tier = this.tier(distance);
    const event = this.maybeEvent(distance);
    const eventKey = event?.key || state.event?.key || '';

    if (distance < SAFE_START_DISTANCE) {
      this.populateCoins(chunkBaseY, 6, state);
      if (Math.random() < 0.35) this.spawnPowerup(chunkBaseY - 180, state);
      return;
    }

    const patterns = 1 + (difficulty > 4 ? 1 : 0);
    for (let i = 0; i < patterns; i += 1) {
      const y = chunkBaseY - 90 - i * 220;
      state.obstacles.push(...spawnPattern(y, difficulty, tier, eventKey));
    }
    this.populateCoins(chunkBaseY, eventKey === 'coinRush' ? 14 : 7 + tier, state, eventKey === 'coinRush');
    if (Math.random() < 0.48) this.spawnPowerup(chunkBaseY - rand(120, 360), state);
  }

  populateCoins(chunkBaseY, count, state, rush = false) {
    for (let i = 0; i < count; i += 1) {
      const wave = i / Math.max(1, count - 1);
      state.coins.push({ x: 96 + wave * (SHAFT_WIDTH - 192) + Math.sin(i * 1.7) * 26, y: chunkBaseY - 60 - i * (rush ? 44 : 62), radius: 10, bob: Math.random() * Math.PI * 2 });
    }
  }

  spawnPowerup(y, state) {
    const keys = Object.keys(POWERUPS);
    state.powerups.push({ x: 92 + Math.random() * (SHAFT_WIDTH - 184), y, radius: 14, kind: choose(keys), bob: Math.random() * Math.PI * 2 });
  }
}
