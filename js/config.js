export const STORAGE_KEY = 'wall-shift-save-v1';
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;
export const SHAFT_WIDTH = 292;
export const WALL_PADDING = 34;
export const PLAYER_RADIUS = 16;
export const CHUNK_HEIGHT = 520;
export const SAFE_START_DISTANCE = 1200;

export const BIOMES = [
  { name: 'Neon Core', distance: 0, colors: ['#5be3ff', '#2a6bff', '#ff69a7'], bg: ['#091324', '#03050d'], hazard: '#ff5e73' },
  { name: 'Industrial Shaft', distance: 1400, colors: ['#ffcf6c', '#7a6242', '#ff7d54'], bg: ['#1a130f', '#09070b'], hazard: '#ff9f54' },
  { name: 'Frozen Reactor', distance: 3200, colors: ['#b7f8ff', '#86baff', '#7af0ff'], bg: ['#0a1827', '#02070d'], hazard: '#90edff' },
  { name: 'Digital Void', distance: 5400, colors: ['#7b7dff', '#d96fff', '#5ce7ff'], bg: ['#11071f', '#02030a'], hazard: '#df70ff' },
  { name: 'Inferno Circuit', distance: 7800, colors: ['#ff8e57', '#ff4d6d', '#ffdf6b'], bg: ['#200b10', '#070205'], hazard: '#ffb16d' },
];

export const POWERUPS = {
  magnet: { label: 'Magnet', duration: 8, color: '#70efff' },
  shield: { label: 'Shield', duration: 12, color: '#9eff7a' },
  slow: { label: 'Slow', duration: 6, color: '#96a6ff' },
  multiplier: { label: 'x2 Score', duration: 10, color: '#ffd36e' },
  phase: { label: 'Phase Dash', duration: 7, color: '#ff8bd0' },
  combo: { label: 'Combo+', duration: 10, color: '#ffaf6d' },
  grip: { label: 'Grip', duration: 9, color: '#d2f6ff' },
};

export const EVENTS = [
  { key: 'coinRush', label: 'Coin Rush', duration: 10 },
  { key: 'slowGravity', label: 'Low Gravity', duration: 8 },
  { key: 'hazardStorm', label: 'Hazard Storm', duration: 9 },
  { key: 'blackout', label: 'Blackout', duration: 7 },
  { key: 'overdrive', label: 'Overdrive', duration: 7 },
  { key: 'chase', label: 'Pursuit', duration: 8 },
];

export const COSMETICS = {
  skins: [
    { id: 'default', name: 'Glowing Orb', cost: 0, color: '#6be7ff' },
    { id: 'cube', name: 'Cube Core', cost: 140, color: '#ffd36e' },
    { id: 'crystal', name: 'Crystal Shard', cost: 220, color: '#c1f4ff' },
    { id: 'plasma', name: 'Plasma Eye', cost: 300, color: '#ff6fb1' },
    { id: 'drone', name: 'Mini Drone', cost: 420, color: '#b0ff79' },
    { id: 'gold', name: 'Gold Pulse', cost: 560, color: '#ffd35c' },
    { id: 'shadow', name: 'Shadow Core', cost: 700, color: '#8b93ff' },
    { id: 'rainbow', name: 'Rainbow Glitch', cost: 860, color: '#ffffff' },
    { id: 'icy', name: 'Icy Orb', cost: 980, color: '#9ee4ff' },
    { id: 'ember', name: 'Ember Spark', cost: 1100, color: '#ff9c5a' },
  ],
  trails: [
    { id: 'pulse', name: 'Pulse Trail', cost: 0, color: '#6be7ff' },
    { id: 'comet', name: 'Comet Trail', cost: 160, color: '#ffd36e' },
    { id: 'ion', name: 'Ion Trail', cost: 260, color: '#ff8bd0' },
    { id: 'frost', name: 'Frost Trail', cost: 380, color: '#d8fbff' },
  ],
  auras: [
    { id: 'soft', name: 'Soft Aura', cost: 0, color: '#6be7ff' },
    { id: 'halo', name: 'Halo Aura', cost: 180, color: '#ffe07b' },
    { id: 'void', name: 'Void Aura', cost: 340, color: '#9d8bff' },
    { id: 'ember', name: 'Ember Aura', cost: 460, color: '#ff916d' },
  ],
};

export const MISSIONS = [
  { id: 'survive30', text: 'Survive 30 seconds', goal: 30, type: 'time', reward: 70 },
  { id: 'coins50', text: 'Collect 50 coins in one run', goal: 50, type: 'coinsRun', reward: 80 },
  { id: 'near3', text: 'Trigger 3 near-misses in one run', goal: 3, type: 'nearRun', reward: 90 },
  { id: 'biome2', text: 'Reach Industrial Shaft', goal: 1, type: 'biome2', reward: 60 },
  { id: 'power2', text: 'Use 2 power-ups in one run', goal: 2, type: 'powerRun', reward: 85 },
  { id: 'combo10', text: 'Finish with combo x10', goal: 10, type: 'comboEnd', reward: 95 },
];
