import { SHAFT_WIDTH, WALL_PADDING } from './config.js';
import { choose, rand } from './physics.js';

export function wallSpike(side, y, difficulty) {
  const width = 34 + difficulty * 2;
  return { type: 'spike', side, y, height: 54, telegraph: 0.9, activeAfter: 0.8, x: side === 'left' ? WALL_PADDING : SHAFT_WIDTH - WALL_PADDING - width, width };
}

export function movingSpike(y, difficulty) {
  return { type: 'movingSpike', y, x: 120, width: 70, height: 18, range: 90 + difficulty * 6, speed: 1 + difficulty * 0.05, telegraph: 1.1, activeAfter: 0.9 };
}

export function laser(y, difficulty) {
  return { type: 'laser', y, x1: WALL_PADDING + 8, x2: SHAFT_WIDTH - WALL_PADDING - 8, telegraph: 1.2, activeAfter: 1.1, pulse: 1.1 - Math.min(0.5, difficulty * 0.02) };
}

export function rotatingBar(y, difficulty) {
  return { type: 'rotatingBar', y, x: SHAFT_WIDTH / 2, length: 160 - Math.min(40, difficulty * 2), angle: rand(0, Math.PI), speed: 1 + difficulty * 0.04, telegraph: 1, activeAfter: 0.9 };
}

export function gate(y, difficulty) {
  return { type: 'gate', y, gapCenter: choose([136, SHAFT_WIDTH / 2, SHAFT_WIDTH - 136]), gapSize: 82 - Math.min(18, difficulty), telegraph: 1.2, activeAfter: 1.0 };
}

export function fakeZone(y) { return { type: 'fakeZone', y, side: choose(['left', 'right']), height: 64, telegraph: 0.7, activeAfter: 0.7 }; }
export function collapseGrip(y) { return { type: 'collapseGrip', y, side: choose(['left', 'right']), height: 72, telegraph: 0.7, activeAfter: 0.7, collapse: false }; }
export function drone(y, difficulty) { return { type: 'drone', y, x: SHAFT_WIDTH / 2, radius: 15, telegraph: 1.0, activeAfter: 0.8, speed: 55 + difficulty * 4 }; }

export function spawnPattern(startY, difficulty, tier, eventKey = '') {
  const items = [];
  const spacing = 110 - Math.min(20, difficulty * 1.4);
  const patterns = [
    () => items.push(wallSpike('left', startY, difficulty), wallSpike('right', startY - spacing * 1.25, difficulty)),
    () => items.push(movingSpike(startY - 60, difficulty), wallSpike(choose(['left', 'right']), startY - spacing * 1.6, difficulty)),
    () => items.push(laser(startY - 30, difficulty), gate(startY - spacing * 1.5, difficulty)),
    () => items.push(rotatingBar(startY - 40, difficulty), wallSpike(choose(['left', 'right']), startY - spacing * 1.8, difficulty)),
    () => items.push(gate(startY, difficulty), fakeZone(startY - spacing * 1.4)),
  ];
  if (tier >= 2) patterns.push(() => items.push(collapseGrip(startY), laser(startY - spacing * 1.45, difficulty)));
  if (tier >= 3) patterns.push(() => items.push(drone(startY - 40, difficulty), gate(startY - spacing * 1.5, difficulty)));
  if (eventKey === 'hazardStorm') items.push(laser(startY - spacing * 0.6, difficulty + 4));
  choose(patterns)();
  return items.sort((a, b) => b.y - a.y);
}
