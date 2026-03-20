/*
  Simon test 2
  - Standalone Simon memory game
  - Mobile-first UI with local leaderboard, achievements, and Web Audio synth tones
  - Board intentionally contains only four colored pads
*/

(() => {
  const STORAGE_KEYS = {
    settings: 'simon-test-2-settings',
    best: 'simon-test-2-best-score',
    leaderboard: 'simon-test-2-leaderboard',
    achievements: 'simon-test-2-achievements',
  };

  const PADS = [
    { index: 0, name: 'Green', key: 'q', frequency: 261.63 },
    { index: 1, name: 'Red', key: 'w', frequency: 329.63 },
    { index: 2, name: 'Yellow', key: 'a', frequency: 392.0 },
    { index: 3, name: 'Blue', key: 's', frequency: 523.25 },
  ];

  const ACHIEVEMENTS = [
    { id: 'first_win', label: 'First Win', test: (stats) => stats.bestRound >= 1 },
    { id: 'round_5', label: 'Reach Round 5', test: (stats) => stats.bestRound >= 5 },
    { id: 'round_10', label: 'Reach Round 10', test: (stats) => stats.bestRound >= 10 },
    { id: 'round_20', label: 'Reach Round 20', test: (stats) => stats.bestRound >= 20 },
    { id: 'strict_master', label: 'Strict Master', test: (stats) => stats.strictBest >= 10 },
    { id: 'silent_challenger', label: 'Silent Challenger', test: (stats) => stats.soundOffBest >= 5 },
  ];

  const milestoneRounds = [5, 10, 15, 20];

  const elements = {
    scoreValue: document.getElementById('scoreValue'),
    bestValue: document.getElementById('bestValue'),
    roundValue: document.getElementById('roundValue'),
    statusText: document.getElementById('statusText'),
    modePill: document.getElementById('modePill'),
    comboPill: document.getElementById('comboPill'),
    speedText: document.getElementById('speedText'),
    milestoneText: document.getElementById('milestoneText'),
    milestoneFill: document.getElementById('milestoneFill'),
    summaryTags: document.getElementById('summaryTags'),
    startButton: document.getElementById('startButton'),
    restartButton: document.getElementById('restartButton'),
    leaderboardButton: document.getElementById('leaderboardButton'),
    soundButton: document.getElementById('soundButton'),
    strictToggle: document.getElementById('strictToggle'),
    zenToggle: document.getElementById('zenToggle'),
    pads: Array.from(document.querySelectorAll('.pad')),
    achievementCount: document.getElementById('achievementCount'),
    achievementList: document.getElementById('achievementList'),
    leaderboardModal: document.getElementById('leaderboardModal'),
    leaderboardList: document.getElementById('leaderboardList'),
    resetLeaderboardButton: document.getElementById('resetLeaderboardButton'),
    summaryModal: document.getElementById('summaryModal'),
    summaryHeadline: document.getElementById('summaryHeadline'),
    summaryScore: document.getElementById('summaryScore'),
    summaryBest: document.getElementById('summaryBest'),
    summaryRound: document.getElementById('summaryRound'),
    summaryMode: document.getElementById('summaryMode'),
    summaryBadges: document.getElementById('summaryBadges'),
    nicknameForm: document.getElementById('nicknameForm'),
    nicknameInput: document.getElementById('nicknameInput'),
    playAgainButton: document.getElementById('playAgainButton'),
    helpButton: document.getElementById('helpButton'),
    helpModal: document.getElementById('helpModal'),
  };

  const settings = loadJSON(STORAGE_KEYS.settings, { soundOn: true, strict: false, zen: false });
  const state = {
    phase: 'idle',
    sequence: [],
    playerIndex: 0,
    round: 0,
    score: 0,
    combo: 0,
    allowInput: false,
    soundOn: settings.soundOn,
    strict: settings.strict,
    zen: settings.zen,
    bestScore: Number(localStorage.getItem(STORAGE_KEYS.best) || 0),
    leaderboard: loadJSON(STORAGE_KEYS.leaderboard, []),
    achievements: loadJSON(STORAGE_KEYS.achievements, {}),
    stats: {
      bestRound: 0,
      strictBest: 0,
      soundOffBest: 0,
    },
    timeoutIds: [],
    pendingEntry: null,
  };

  class AudioEngine {
    constructor() {
      this.context = null;
      this.master = null;
    }

    ensure() {
      if (!state.soundOn) return false;
      if (!this.context) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return false;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = 0.12;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') {
        this.context.resume();
      }
      return true;
    }

    playTone(frequency, duration = 0.18, type = 'sine', volume = 0.15, delay = 0) {
      if (!this.ensure()) return;
      const when = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(when);
      oscillator.stop(when + duration + 0.03);
    }

    playStart() {
      this.playTone(260, 0.11, 'triangle', 0.12);
      this.playTone(390, 0.13, 'triangle', 0.13, 0.08);
      this.playTone(520, 0.18, 'triangle', 0.14, 0.15);
    }

    playWrong() {
      this.playTone(160, 0.22, 'sawtooth', 0.14);
      this.playTone(110, 0.28, 'sawtooth', 0.13, 0.05);
    }

    playMilestone() {
      this.playTone(523, 0.1, 'triangle', 0.12);
      this.playTone(659, 0.12, 'triangle', 0.12, 0.08);
      this.playTone(784, 0.16, 'triangle', 0.13, 0.18);
    }

    playSuccess() {
      this.playTone(680, 0.09, 'sine', 0.11);
    }
  }

  const audio = new AudioEngine();

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({
      soundOn: state.soundOn,
      strict: state.strict,
      zen: state.zen,
    }));
  }

  function persistScores() {
    localStorage.setItem(STORAGE_KEYS.best, String(state.bestScore));
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(state.leaderboard));
    localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify(state.achievements));
  }

  function currentModeLabel() {
    if (state.zen) return 'Zen Practice';
    if (state.strict) return 'Strict Mode';
    return 'Classic Mode';
  }

  function getTempo(round = state.round) {
    const strictBonus = state.strict ? 110 : 0;
    const duration = Math.max(220, 520 - round * 14 - strictBonus);
    const gap = Math.max(115, 180 - round * 4 - Math.floor(strictBonus / 4));
    const label = duration > 430 ? 'Tempo: Calm' : duration > 340 ? 'Tempo: Focused' : duration > 270 ? 'Tempo: Fast' : 'Tempo: Fever';
    return { duration, gap, label };
  }

  function clearTimers() {
    state.timeoutIds.forEach((id) => clearTimeout(id));
    state.timeoutIds = [];
  }

  function setStatus(message) {
    elements.statusText.textContent = message;
  }

  function setPhase(nextPhase) {
    state.phase = nextPhase;
    state.allowInput = nextPhase === 'input';
  }

  function nextMilestone(round = state.round) {
    return milestoneRounds.find((value) => value > round) || 25;
  }

  function updateMilestoneUI() {
    const target = nextMilestone();
    const previous = target === 25 ? 20 : target - 5;
    const progress = ((state.round - previous) / Math.max(1, target - previous)) * 100;
    elements.milestoneFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    elements.milestoneText.textContent = target === 25
      ? 'Milestones cleared through round 20. Keep pushing for a longer streak.'
      : `Next celebration at round ${target}.`;
  }

  function flashPad(index, duration = getTempo().duration) {
    const pad = elements.pads[index];
    if (!pad) return;
    pad.classList.add('active');
    window.setTimeout(() => pad.classList.remove('active'), duration);
  }

  function playPad(index, duration = getTempo().duration * 0.9) {
    const pad = PADS[index];
    flashPad(index, duration);
    audio.playTone(pad.frequency, Math.max(0.1, duration / 1000), 'sine', 0.14);
  }

  function getRandomPad() {
    return Math.floor(Math.random() * PADS.length);
  }

  async function startGame() {
    clearTimers();
    state.sequence = [];
    state.playerIndex = 0;
    state.round = 0;
    state.score = 0;
    state.combo = 0;
    state.pendingEntry = null;
    setPhase('starting');
    audio.playStart();
    setStatus('Get ready...');
    render();
    await delay(280);
    addRound();
  }

  async function addRound() {
    state.round += 1;
    state.playerIndex = 0;
    state.sequence.push(getRandomPad());
    setPhase('playback');
    setStatus(`Round ${state.round}. Watch closely.`);
    render();
    await playbackSequence();
    setPhase('input');
    setStatus('Your turn. Repeat the pattern.');
    render();
  }

  async function playbackSequence() {
    clearTimers();
    const tempo = getTempo();

    return new Promise((resolve) => {
      state.sequence.forEach((padIndex, step) => {
        const startAt = step * (tempo.duration + tempo.gap);
        const playId = window.setTimeout(() => {
          playPad(padIndex, tempo.duration);
        }, startAt);
        state.timeoutIds.push(playId);
      });

      const endId = window.setTimeout(() => {
        clearTimers();
        resolve();
      }, state.sequence.length * (tempo.duration + tempo.gap));
      state.timeoutIds.push(endId);
    });
  }

  async function handlePadPress(index) {
    if (!state.allowInput) return;

    playPad(index, Math.max(140, getTempo().duration - 60));

    const expected = state.sequence[state.playerIndex];
    if (index !== expected) {
      await handleMistake(index, expected);
      return;
    }

    state.playerIndex += 1;
    state.combo += 1;
    state.score += state.strict ? 2 : 1;
    audio.playSuccess();
    setStatus(`Correct. ${state.sequence.length - state.playerIndex} step(s) left.`);
    render();

    if (state.playerIndex === state.sequence.length) {
      await completeRound();
    }
  }

  async function completeRound() {
    setPhase('transition');
    const milestoneHit = milestoneRounds.includes(state.round);
    setStatus(milestoneHit ? `Milestone reached: Round ${state.round}!` : 'Round cleared. Preparing next sequence...');

    if (milestoneHit) {
      audio.playMilestone();
      pushSummaryTag(`Milestone ${state.round}`);
    }

    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      pushSummaryTag('New high score');
    }

    state.stats.bestRound = Math.max(state.stats.bestRound, state.round);
    if (state.strict) state.stats.strictBest = Math.max(state.stats.strictBest, state.round);
    if (!state.soundOn) state.stats.soundOffBest = Math.max(state.stats.soundOffBest, state.round);
    unlockAchievements();
    persistScores();
    render();
    await delay(milestoneHit ? 850 : 540);
    addRound();
  }

  async function handleMistake(selected, expected) {
    setPhase('locked');
    state.combo = 0;
    audio.playWrong();
    flashPad(selected, 220);
    flashPad(expected, 280);

    if (state.zen) {
      setStatus('Not quite. Zen Practice is replaying the round.');
      render();
      await delay(850);
      state.playerIndex = 0;
      await playbackSequence();
      setPhase('input');
      setStatus('Try that round again.');
      render();
      return;
    }

    setStatus('Wrong pad. Run over.');
    render();
    await delay(700);
    endRun();
  }

  function endRun() {
    clearTimers();
    setPhase('ended');
    const unlockedNow = unlockAchievements();
    const isHighScore = state.score >= state.bestScore && state.score > 0;

    if (state.score > state.bestScore) {
      state.bestScore = state.score;
    }

    if (qualifiesForLeaderboard(state.score)) {
      state.pendingEntry = {
        score: state.score,
        round: state.round,
        mode: currentModeLabel(),
        timestamp: Date.now(),
      };
      elements.nicknameForm.classList.remove('hidden');
      elements.nicknameInput.value = '';
    } else {
      state.pendingEntry = null;
      elements.nicknameForm.classList.add('hidden');
    }

    persistScores();
    render();

    elements.summaryHeadline.textContent = state.zen
      ? 'Zen session complete. Ready for another try?'
      : isHighScore
        ? 'New high score. Excellent memory.'
        : 'Solid run. One more game?';
    elements.summaryScore.textContent = String(state.score);
    elements.summaryBest.textContent = String(state.bestScore);
    elements.summaryRound.textContent = String(state.round);
    elements.summaryMode.textContent = currentModeLabel();
    elements.summaryBadges.innerHTML = [
      isHighScore ? '<span>New high score</span>' : '',
      ...unlockedNow.map((badge) => `<span>${escapeHtml(badge)}</span>`),
    ].filter(Boolean).join('');

    openModal(elements.summaryModal);
  }

  function unlockAchievements() {
    const unlockedNow = [];
    ACHIEVEMENTS.forEach((achievement) => {
      if (!state.achievements[achievement.id] && achievement.test(state.stats)) {
        state.achievements[achievement.id] = new Date().toISOString();
        unlockedNow.push(achievement.label);
      }
    });
    return unlockedNow;
  }

  function pushSummaryTag(text) {
    const existing = Array.from(elements.summaryTags.querySelectorAll('span')).map((item) => item.textContent);
    if (existing.includes(text)) return;
    const tag = document.createElement('span');
    tag.textContent = text;
    elements.summaryTags.prepend(tag);
    while (elements.summaryTags.childElementCount > 4) {
      elements.summaryTags.removeChild(elements.summaryTags.lastElementChild);
    }
  }

  function qualifiesForLeaderboard(score) {
    if (score <= 0) return false;
    if (state.leaderboard.length < 10) return true;
    return score > state.leaderboard[state.leaderboard.length - 1].score;
  }

  function saveLeaderboardEntry(name) {
    if (!state.pendingEntry) return;
    state.leaderboard.push({
      ...state.pendingEntry,
      name: name || 'Player',
    });
    state.leaderboard.sort((a, b) => b.score - a.score || b.round - a.round || b.timestamp - a.timestamp);
    state.leaderboard = state.leaderboard.slice(0, 10);
    state.pendingEntry = null;
    elements.nicknameForm.classList.add('hidden');
    persistScores();
    renderLeaderboard();
  }

  function renderLeaderboard() {
    if (!state.leaderboard.length) {
      elements.leaderboardList.innerHTML = '<li>No scores saved yet. Start a run to claim the board.</li>';
      return;
    }

    elements.leaderboardList.innerHTML = state.leaderboard.map((entry, index) => `
      <li>
        <div class="leaderboard-item">
          <strong>#${index + 1}</strong>
          <div>
            <strong>${escapeHtml(entry.name)}</strong>
            <small>${escapeHtml(entry.mode)} · Round ${entry.round} · ${new Date(entry.timestamp).toLocaleString()}</small>
          </div>
          <div>
            <strong>${entry.score}</strong>
            <small>pts</small>
          </div>
        </div>
      </li>
    `).join('');
  }

  function renderAchievements() {
    const unlocked = Object.keys(state.achievements).length;
    elements.achievementCount.textContent = `${unlocked} unlocked`;
    elements.achievementList.innerHTML = ACHIEVEMENTS.map((achievement) => {
      const isUnlocked = Boolean(state.achievements[achievement.id]);
      return `<span class="achievement-chip ${isUnlocked ? '' : 'locked'}">${isUnlocked ? '★' : '•'} ${achievement.label}</span>`;
    }).join('');
  }

  function render() {
    elements.scoreValue.textContent = String(state.score);
    elements.bestValue.textContent = String(state.bestScore);
    elements.roundValue.textContent = String(state.round);
    elements.modePill.textContent = currentModeLabel();
    elements.comboPill.textContent = `Combo ×${state.combo}`;
    elements.soundButton.textContent = `Sound: ${state.soundOn ? 'On' : 'Off'}`;
    elements.soundButton.setAttribute('aria-pressed', String(state.soundOn));
    elements.strictToggle.checked = state.strict;
    elements.zenToggle.checked = state.zen;
    elements.speedText.textContent = getTempo().label;
    updateMilestoneUI();
    renderAchievements();
    renderLeaderboard();
    saveSettings();
  }

  function openModal(modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character]));
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function closeAllModals() {
    document.querySelectorAll('.modal').forEach(closeModal);
  }

  function bindEvents() {
    elements.startButton.addEventListener('click', () => {
      closeAllModals();
      startGame();
    });

    elements.restartButton.addEventListener('click', () => {
      closeAllModals();
      startGame();
    });

    elements.playAgainButton.addEventListener('click', () => {
      closeModal(elements.summaryModal);
      startGame();
    });

    elements.soundButton.addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      if (state.soundOn) audio.playStart();
      render();
    });

    elements.strictToggle.addEventListener('change', (event) => {
      state.strict = event.target.checked;
      if (state.strict) {
        state.zen = false;
        elements.zenToggle.checked = false;
      }
      render();
    });

    elements.zenToggle.addEventListener('change', (event) => {
      state.zen = event.target.checked;
      if (state.zen) {
        state.strict = false;
        elements.strictToggle.checked = false;
      }
      render();
    });

    elements.leaderboardButton.addEventListener('click', () => openModal(elements.leaderboardModal));
    elements.helpButton.addEventListener('click', () => openModal(elements.helpModal));

    document.querySelectorAll('.modal-close').forEach((button) => {
      button.addEventListener('click', () => {
        const modalId = button.getAttribute('data-close');
        closeModal(document.getElementById(modalId));
      });
    });

    elements.resetLeaderboardButton.addEventListener('click', () => {
      if (!window.confirm('Reset the saved top 10 leaderboard on this device?')) return;
      state.leaderboard = [];
      persistScores();
      renderLeaderboard();
    });

    elements.nicknameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      saveLeaderboardEntry(elements.nicknameInput.value.trim());
      closeModal(elements.summaryModal);
      openModal(elements.leaderboardModal);
    });

    elements.pads.forEach((pad) => {
      pad.addEventListener('click', () => handlePadPress(Number(pad.dataset.pad)));
    });

    document.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      const match = PADS.find((pad) => pad.key === event.key.toLowerCase());
      if (match) {
        handlePadPress(match.index);
      }
      if (event.key === 'Escape') {
        closeAllModals();
      }
    });
  }

  bindEvents();
  render();
})();
