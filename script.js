/*
README
Structure:
1. DOM references and app state
2. Local storage helpers and achievements
3. Audio engine using Web Audio API
4. Game state machine and round flow
5. UI rendering, modals, and event binding
6. Boot sequence and first-launch tutorial
*/

(() => {
  const STORAGE_KEYS = {
    settings: 'simon-pulse-settings',
    leaderboard: 'simon-pulse-leaderboard',
    best: 'simon-pulse-best-score',
    achievements: 'simon-pulse-achievements',
    tutorial: 'simon-pulse-tutorial-seen',
  };

  const PAD_CONFIG = [
    { id: 0, name: 'Green', key: 'q', frequency: 261.63, colorClass: 'pad-green' },
    { id: 1, name: 'Red', key: 'w', frequency: 329.63, colorClass: 'pad-red' },
    { id: 2, name: 'Yellow', key: 'a', frequency: 392.0, colorClass: 'pad-yellow' },
    { id: 3, name: 'Blue', key: 's', frequency: 523.25, colorClass: 'pad-blue' },
  ];

  const ACHIEVEMENTS = [
    { id: 'first_win', label: 'First Win', test: (stats) => stats.bestRound >= 1 },
    { id: 'round_5', label: 'Reach Round 5', test: (stats) => stats.bestRound >= 5 },
    { id: 'round_10', label: 'Reach Round 10', test: (stats) => stats.bestRound >= 10 },
    { id: 'round_20', label: 'Reach Round 20', test: (stats) => stats.bestRound >= 20 },
    { id: 'sound_off', label: 'Sound Off Challenger', test: (stats) => stats.soundOffWin },
    { id: 'strict_master', label: 'Strict Master', test: (stats) => stats.strictRound >= 10 },
  ];

  const elements = {
    scoreValue: document.getElementById('scoreValue'),
    bestScoreValue: document.getElementById('bestScoreValue'),
    roundValue: document.getElementById('roundValue'),
    speedValue: document.getElementById('speedValue'),
    statusMessage: document.getElementById('statusMessage'),
    milestoneLabel: document.getElementById('milestoneLabel'),
    milestoneBar: document.getElementById('milestoneBar'),
    startButton: document.getElementById('startButton'),
    restartButton: document.getElementById('restartButton'),
    pauseButton: document.getElementById('pauseButton'),
    leaderboardButton: document.getElementById('leaderboardButton'),
    strictToggle: document.getElementById('strictToggle'),
    zenToggle: document.getElementById('zenToggle'),
    soundToggle: document.getElementById('soundToggle'),
    themeToggle: document.getElementById('themeToggle'),
    comboValue: document.getElementById('comboValue'),
    modeValue: document.getElementById('modeValue'),
    perfectValue: document.getElementById('perfectValue'),
    dailySeedValue: document.getElementById('dailySeedValue'),
    difficultyLabel: document.getElementById('difficultyLabel'),
    pads: Array.from(document.querySelectorAll('.pad')),
    achievementList: document.getElementById('achievementList'),
    achievementCount: document.getElementById('achievementCount'),
    leaderboardModal: document.getElementById('leaderboardModal'),
    leaderboardList: document.getElementById('leaderboardList'),
    clearLeaderboardButton: document.getElementById('clearLeaderboardButton'),
    summaryModal: document.getElementById('summaryModal'),
    summaryHeadline: document.getElementById('summaryHeadline'),
    summaryScore: document.getElementById('summaryScore'),
    summaryBest: document.getElementById('summaryBest'),
    summaryRounds: document.getElementById('summaryRounds'),
    summaryMode: document.getElementById('summaryMode'),
    summaryBadges: document.getElementById('summaryBadges'),
    nicknameForm: document.getElementById('nicknameForm'),
    nicknameInput: document.getElementById('nicknameInput'),
    rematchButton: document.getElementById('rematchButton'),
    tutorialModal: document.getElementById('tutorialModal'),
    howToPlayButton: document.getElementById('howToPlayButton'),
    startFromTutorialButton: document.getElementById('startFromTutorialButton'),
    progressBar: document.querySelector('.progress-bar'),
  };

  const state = {
    phase: 'idle',
    sequence: [],
    playerIndex: 0,
    round: 0,
    score: 0,
    combo: 0,
    bestScore: Number(localStorage.getItem(STORAGE_KEYS.best) || 0),
    strict: false,
    zen: false,
    soundOn: true,
    theme: 'neon',
    perfectRun: true,
    showingTimeouts: [],
    leaderboard: loadJSON(STORAGE_KEYS.leaderboard, []),
    achievements: loadJSON(STORAGE_KEYS.achievements, {}),
    stats: {
      bestRound: 0,
      strictRound: 0,
      soundOffWin: false,
    },
    pendingLeaderboardEntry: null,
    lastSummary: null,
  };

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  const settings = loadJSON(STORAGE_KEYS.settings, { strict: false, zen: false, soundOn: true, theme: 'neon' });
  state.strict = settings.strict;
  state.zen = settings.zen;
  state.soundOn = settings.soundOn;
  state.theme = settings.theme;

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
    }
    ensure() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.12;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    tone(freq, duration = 0.18, type = 'sine', volume = 0.16, delay = 0) {
      if (!state.soundOn || !this.ensure()) return;
      const start = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    }
    startSound() { this.tone(260, 0.12, 'triangle', 0.12); this.tone(392, 0.16, 'triangle', 0.14, 0.08); }
    correctSound() { this.tone(620, 0.08, 'sine', 0.1); }
    wrongSound() { this.tone(180, 0.22, 'sawtooth', 0.14); this.tone(120, 0.3, 'sawtooth', 0.12, 0.05); }
    milestoneSound() { this.tone(523, 0.1, 'triangle', 0.12); this.tone(659, 0.12, 'triangle', 0.12, 0.08); this.tone(784, 0.16, 'triangle', 0.13, 0.16); }
    victorySound() { this.tone(523, 0.12, 'triangle', 0.12); this.tone(659, 0.12, 'triangle', 0.12, 0.1); this.tone(880, 0.22, 'triangle', 0.14, 0.2); }
  }

  const audio = new AudioEngine();

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ strict: state.strict, zen: state.zen, soundOn: state.soundOn, theme: state.theme }));
  }

  function persistBoard() {
    localStorage.setItem(STORAGE_KEYS.best, String(state.bestScore));
    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(state.leaderboard));
    localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify(state.achievements));
  }

  function getModeLabel() {
    if (state.strict) return 'Strict';
    if (state.zen) return 'Zen';
    return 'Classic';
  }

  function getSpeedProfile(round = state.round) {
    const strictBoost = state.strict ? 90 : 0;
    const showDuration = Math.max(240, 520 - round * 14 - strictBoost);
    const gapDuration = Math.max(120, 180 - round * 3 - Math.floor(strictBoost / 3));
    const label = showDuration > 450 ? 'Calm' : showDuration > 360 ? 'Focused' : showDuration > 290 ? 'Swift' : 'Pulse';
    return { showDuration, gapDuration, label };
  }

  function getDailySeed() {
    const today = new Date();
    const stamp = `${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`;
    let seed = 0;
    for (const char of stamp) seed = (seed * 31 + char.charCodeAt(0)) % 100000;
    return `${stamp} · ${seed}`;
  }

  function seededValue(step) {
    const seedString = getDailySeed();
    let seed = 0;
    for (const char of `${seedString}-${step}`) seed = (seed * 33 + char.charCodeAt(0)) % 2147483647;
    return seed % 4;
  }

  function resetRoundTimers() {
    state.showingTimeouts.forEach((id) => clearTimeout(id));
    state.showingTimeouts = [];
  }

  function setPhase(phase) {
    state.phase = phase;
    elements.pauseButton.textContent = phase === 'paused' ? 'Resume' : 'Pause';
  }

  function updateStatus(message) {
    elements.statusMessage.textContent = message;
  }

  function flashPad(index, duration) {
    const pad = elements.pads[index];
    if (!pad) return;
    pad.classList.add('active');
    window.setTimeout(() => pad.classList.remove('active'), duration);
  }

  function animateScore() {
    elements.scoreValue.animate([
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1.12)', offset: 0.4 },
      { transform: 'scale(1)', offset: 1 },
    ], { duration: 220, easing: 'ease-out' });
  }

  function render() {
    elements.scoreValue.textContent = state.score;
    elements.bestScoreValue.textContent = state.bestScore;
    elements.roundValue.textContent = state.round;
    const speed = getSpeedProfile();
    elements.speedValue.textContent = speed.label;
    elements.comboValue.textContent = `Combo ×${state.combo}`;
    elements.modeValue.textContent = `Mode: ${getModeLabel()}`;
    elements.perfectValue.textContent = state.perfectRun ? 'Perfect run active' : 'Perfect run broken';
    elements.dailySeedValue.textContent = `Daily seed: ${getDailySeed()}`;
    elements.difficultyLabel.textContent = getModeLabel();
    const nextMilestone = Math.ceil(Math.max(1, state.round + 1) / 5) * 5;
    const lastMilestone = Math.max(0, nextMilestone - 5);
    const progress = ((state.round - lastMilestone) / (nextMilestone - lastMilestone || 1)) * 100;
    elements.milestoneLabel.textContent = `${state.round} / ${nextMilestone}`;
    elements.milestoneBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    elements.progressBar.setAttribute('aria-valuenow', String(Math.round(progress)));
    elements.strictToggle.checked = state.strict;
    elements.zenToggle.checked = state.zen;
    elements.soundToggle.checked = state.soundOn;
    elements.themeToggle.checked = state.theme === 'luxury';
    document.body.dataset.theme = state.theme === 'luxury' ? 'luxury' : 'neon';
    renderAchievements();
    renderLeaderboard();
  }

  function renderAchievements() {
    const unlockedCount = Object.keys(state.achievements).length;
    elements.achievementCount.textContent = `${unlockedCount} unlocked`;
    elements.achievementList.innerHTML = ACHIEVEMENTS.map((achievement) => {
      const unlocked = Boolean(state.achievements[achievement.id]);
      return `<span class="achievement-badge ${unlocked ? '' : 'locked'}">${unlocked ? '★' : '•'} ${achievement.label}</span>`;
    }).join('');
  }

  function renderLeaderboard() {
    if (!state.leaderboard.length) {
      elements.leaderboardList.innerHTML = '<li>No runs saved yet. Start building your streak.</li>';
      return;
    }
    elements.leaderboardList.innerHTML = state.leaderboard.map((entry, index) => `
      <li>
        <div class="leaderboard-entry">
          <strong>#${index + 1}</strong>
          <div>
            <strong>${escapeHtml(entry.name)}</strong>
            <small>${entry.mode} · Round ${entry.round} · ${new Date(entry.timestamp).toLocaleString()}</small>
          </div>
          <div>
            <strong>${entry.score}</strong>
            <small>pts</small>
          </div>
        </div>
      </li>
    `).join('');
  }

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function unlockAchievements() {
    const newlyUnlocked = [];
    ACHIEVEMENTS.forEach((achievement) => {
      if (!state.achievements[achievement.id] && achievement.test(state.stats)) {
        state.achievements[achievement.id] = new Date().toISOString();
        newlyUnlocked.push(achievement.label);
      }
    });
    return newlyUnlocked;
  }

  function qualifiesForLeaderboard(score) {
    if (score <= 0) return false;
    if (state.leaderboard.length < 10) return true;
    return score > state.leaderboard[state.leaderboard.length - 1].score;
  }

  function upsertLeaderboard(entry) {
    state.leaderboard.push(entry);
    state.leaderboard.sort((a, b) => b.score - a.score || b.round - a.round || b.timestamp - a.timestamp);
    state.leaderboard = state.leaderboard.slice(0, 10);
    persistBoard();
    renderLeaderboard();
  }

  function nextSequenceValue() {
    return state.round % 5 === 4 ? seededValue(state.sequence.length + 1) : Math.floor(Math.random() * 4);
  }

  async function startGame() {
    resetRoundTimers();
    state.sequence = [];
    state.playerIndex = 0;
    state.round = 0;
    state.score = 0;
    state.combo = 0;
    state.perfectRun = true;
    state.pendingLeaderboardEntry = null;
    state.lastSummary = null;
    closeModal(elements.summaryModal);
    updateStatus('Get ready…');
    audio.startSound();
    render();
    setPhase('idle');
    await countdown();
    await beginNextRound();
  }

  function countdown() {
    return new Promise((resolve) => {
      const steps = ['3', '2', '1', 'Watch closely'];
      steps.forEach((step, index) => {
        const timeoutId = window.setTimeout(() => {
          updateStatus(step);
          if (index === steps.length - 1) resolve();
        }, index * 380);
        state.showingTimeouts.push(timeoutId);
      });
    });
  }

  async function beginNextRound(replayExisting = false) {
    resetRoundTimers();
    setPhase('showing');
    state.playerIndex = 0;
    if (!replayExisting) {
      state.round += 1;
      state.sequence.push(nextSequenceValue());
    }
    updateStatus(replayExisting ? 'Retry this round' : 'Watch closely');
    render();
    await playSequence();
    if (state.phase === 'paused') return;
    setPhase('player');
    updateStatus('Your turn');
    render();
  }

  function playSequence() {
    return new Promise((resolve) => {
      const { showDuration, gapDuration } = getSpeedProfile();
      let totalDelay = 180;
      state.sequence.forEach((padIndex, index) => {
        const startId = window.setTimeout(() => {
          if (state.phase !== 'showing') return;
          flashPad(padIndex, showDuration - 20);
          audio.tone(PAD_CONFIG[padIndex].frequency, Math.max(0.1, showDuration / 1000 * 0.8), 'sine', 0.12);
        }, totalDelay);
        state.showingTimeouts.push(startId);
        totalDelay += showDuration + gapDuration;
        if (index === state.sequence.length - 1) {
          const endId = window.setTimeout(resolve, totalDelay);
          state.showingTimeouts.push(endId);
        }
      });
    });
  }

  function handlePlayerInput(index) {
    if (state.phase !== 'player') return;
    const expected = state.sequence[state.playerIndex];
    flashPad(index, 180);
    audio.tone(PAD_CONFIG[index].frequency, 0.14, 'sine', 0.12);

    if (index !== expected) {
      state.perfectRun = false;
      state.combo = 0;
      render();
      return onMistake();
    }

    state.playerIndex += 1;
    audio.correctSound();

    if (state.playerIndex < state.sequence.length) {
      updateStatus('Correct… keep going');
      return;
    }

    state.score += 1 + (state.strict ? 1 : 0) + Math.floor(state.combo / 3);
    state.combo += 1;
    const milestoneHit = state.round % 5 === 0;
    if (milestoneHit) {
      state.score += 3;
      updateStatus(`Milestone! Round ${state.round}`);
      audio.milestoneSound();
    } else {
      updateStatus('Round cleared');
    }
    animateScore();
    render();

    window.setTimeout(() => beginNextRound(false), 650);
  }

  function onMistake() {
    audio.wrongSound();
    updateStatus(state.zen ? 'Wrong sequence — retrying round' : 'Wrong sequence');
    document.body.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-4px)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(0)' },
    ], { duration: state.strict ? 280 : 220, easing: 'ease-out' });

    if (state.zen) {
      setPhase('roundSuccess');
      window.setTimeout(() => beginNextRound(true), 900);
      return;
    }
    finishGame();
  }

  function finishGame() {
    resetRoundTimers();
    setPhase('gameover');
    state.stats.bestRound = Math.max(state.stats.bestRound, state.round);
    if (state.strict) state.stats.strictRound = Math.max(state.stats.strictRound, state.round);
    if (!state.soundOn && state.round >= 1) state.stats.soundOffWin = true;

    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      updateStatus('New high score');
    }

    const newlyUnlocked = unlockAchievements();
    if (state.round >= 5) audio.victorySound();

    const summaryBadges = [];
    if (state.perfectRun) summaryBadges.push('Perfect run');
    if (newlyUnlocked.length) summaryBadges.push(...newlyUnlocked);
    if (state.score === state.bestScore && state.score > 0) summaryBadges.push('New record');

    state.lastSummary = {
      score: state.score,
      best: state.bestScore,
      round: state.round,
      mode: getModeLabel(),
      badges: summaryBadges,
    };

    if (qualifiesForLeaderboard(state.score)) {
      state.pendingLeaderboardEntry = {
        name: '',
        score: state.score,
        round: state.round,
        mode: getModeLabel(),
        timestamp: Date.now(),
      };
    }

    persistBoard();
    render();
    openSummary();
  }

  function openSummary() {
    if (!state.lastSummary) return;
    const { score, best, round, mode, badges } = state.lastSummary;
    elements.summaryHeadline.textContent = score > 0 ? 'Great run. Ready for another?' : 'Warm up and try again.';
    elements.summaryScore.textContent = score;
    elements.summaryBest.textContent = best;
    elements.summaryRounds.textContent = round;
    elements.summaryMode.textContent = mode;
    elements.summaryBadges.innerHTML = badges.length ? badges.map((badge) => `<span>${badge}</span>`).join('') : '<span>Keep pushing for your first badge</span>';
    const showNickname = Boolean(state.pendingLeaderboardEntry);
    elements.nicknameForm.classList.toggle('hidden', !showNickname);
    if (showNickname) elements.nicknameInput.focus();
    openModal(elements.summaryModal);
  }

  function openModal(modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function pauseOrResume() {
    if (state.phase === 'showing' || state.phase === 'player') {
      resetRoundTimers();
      setPhase('paused');
      updateStatus('Paused');
      render();
      return;
    }
    if (state.phase === 'paused') {
      beginNextRound(true);
    }
  }

  function bindEvents() {
    elements.pads.forEach((pad) => {
      const handler = () => handlePlayerInput(Number(pad.dataset.pad));
      pad.addEventListener('click', handler);
      pad.addEventListener('touchstart', (event) => {
        event.preventDefault();
        handler();
      }, { passive: false });
    });

    document.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      const pad = PAD_CONFIG.find((item) => item.key === key);
      if (pad) {
        event.preventDefault();
        handlePlayerInput(pad.id);
      }
      if (key === ' ') {
        event.preventDefault();
        if (state.phase === 'idle' || state.phase === 'gameover') startGame();
      }
      if (key === 'escape') {
        closeModal(elements.leaderboardModal);
        closeModal(elements.summaryModal);
        closeModal(elements.tutorialModal);
      }
    });

    elements.startButton.addEventListener('click', startGame);
    elements.restartButton.addEventListener('click', startGame);
    elements.rematchButton.addEventListener('click', startGame);
    elements.pauseButton.addEventListener('click', pauseOrResume);
    elements.leaderboardButton.addEventListener('click', () => openModal(elements.leaderboardModal));
    elements.howToPlayButton.addEventListener('click', () => openModal(elements.tutorialModal));
    elements.startFromTutorialButton.addEventListener('click', () => {
      closeModal(elements.tutorialModal);
      startGame();
    });

    elements.strictToggle.addEventListener('change', () => {
      state.strict = elements.strictToggle.checked;
      if (state.strict) state.zen = false;
      saveSettings();
      render();
    });

    elements.zenToggle.addEventListener('change', () => {
      state.zen = elements.zenToggle.checked;
      if (state.zen) state.strict = false;
      saveSettings();
      render();
    });

    elements.soundToggle.addEventListener('change', () => {
      state.soundOn = elements.soundToggle.checked;
      saveSettings();
      render();
    });

    elements.themeToggle.addEventListener('change', () => {
      state.theme = elements.themeToggle.checked ? 'luxury' : 'neon';
      saveSettings();
      render();
    });

    elements.clearLeaderboardButton.addEventListener('click', () => {
      if (!window.confirm('Clear all saved runs from this device?')) return;
      state.leaderboard = [];
      persistBoard();
      render();
    });

    document.querySelectorAll('.close-modal').forEach((button) => {
      button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.close)));
    });

    elements.nicknameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!state.pendingLeaderboardEntry) return;
      state.pendingLeaderboardEntry.name = (elements.nicknameInput.value.trim() || 'Player').slice(0, 16);
      upsertLeaderboard(state.pendingLeaderboardEntry);
      state.pendingLeaderboardEntry = null;
      elements.nicknameForm.classList.add('hidden');
      elements.nicknameInput.value = '';
      closeModal(elements.summaryModal);
      openModal(elements.leaderboardModal);
    });
  }

  function boot() {
    render();
    bindEvents();
    updateStatus('Tap start to begin.');
    if (!localStorage.getItem(STORAGE_KEYS.tutorial)) {
      openModal(elements.tutorialModal);
      localStorage.setItem(STORAGE_KEYS.tutorial, 'true');
    }
  }

  boot();
})();
