import { COSMETICS, MISSIONS, STORAGE_KEY } from './config.js';

const defaultUnlocks = {
  skins: Object.fromEntries(COSMETICS.skins.map((item) => [item.id, item.cost === 0])),
  trails: Object.fromEntries(COSMETICS.trails.map((item) => [item.id, item.cost === 0])),
  auras: Object.fromEntries(COSMETICS.auras.map((item) => [item.id, item.cost === 0])),
};

const missionState = Object.fromEntries(MISSIONS.map((m) => [m.id, { progress: 0, completed: false, claimed: false }]));

export function defaultSave() {
  return {
    bestScore: 0,
    bestHeight: 0,
    totalCoins: 0,
    totalRuns: 0,
    totalDistance: 0,
    stats: { nearMisses: 0, powerupsUsed: 0, totalTime: 0 },
    settings: { audioMuted: false, reduceEffects: false, vibration: false, tutorialSeen: false },
    unlocks: structuredClone(defaultUnlocks),
    selected: { skin: 'default', trail: 'pulse', aura: 'soft' },
    missions: structuredClone(missionState),
    achievements: [],
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return {
      ...defaultSave(),
      ...parsed,
      settings: { ...defaultSave().settings, ...(parsed.settings || {}) },
      stats: { ...defaultSave().stats, ...(parsed.stats || {}) },
      selected: { ...defaultSave().selected, ...(parsed.selected || {}) },
      unlocks: {
        skins: { ...defaultUnlocks.skins, ...(parsed.unlocks?.skins || {}) },
        trails: { ...defaultUnlocks.trails, ...(parsed.unlocks?.trails || {}) },
        auras: { ...defaultUnlocks.auras, ...(parsed.unlocks?.auras || {}) },
      },
      missions: Object.fromEntries(MISSIONS.map((m) => [m.id, { ...missionState[m.id], ...(parsed.missions?.[m.id] || {}) }])),
    };
  } catch {
    return defaultSave();
  }
}

export function persistSave(save) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

export function resetSave() {
  const fresh = defaultSave();
  persistSave(fresh);
  return fresh;
}
