const KEY = 'pocket-golf-deluxe-save';

const defaultState = {
  unlockedHoles: 1,
  bestStrokes: {},
  medals: {},
  mute: false,
  lastMode: 'menu',
  completed: {},
};

export function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    return { ...defaultState, ...(parsed || {}) };
  } catch {
    return { ...defaultState };
  }
}

export function saveProgress(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetProgress() {
  localStorage.removeItem(KEY);
  return { ...defaultState };
}
