(() => {
  'use strict';

  const STORAGE_KEY = 'simon-test-2-state-v1';
  const PAD_ORDER = ['green', 'red', 'yellow', 'blue'];
  const PAD_CONFIG = {
    green: { index: 0, frequency: 329.63 },
    red: { index: 1, frequency: 392.0 },
    yellow: { index: 2, frequency: 493.88 },
    blue: { index: 3, frequency: 587.33 },
  };
  const ACHIEVEMENTS = {
    firstWin: 'First Win',
    round5: 'Reach Round 5',
    round10: 'Reach Round 10',
    round20: 'Reach Round 20',
    strictMaster: 'Strict Master',
    silentChallenger: 'Silent Challenger',
  };

  const elements = {
    pads: Array.from(document.querySelectorAll('.pad')),
    score: document.getElementById('scoreValue'),
    bestScore: document.getElementById('bestScoreValue'),
    round: document.getElementById('roundValue'),
    status: document.getElementById('statusText'),
    combo: document.getElementById('comboText'),
    modeLabel: document.getElementById('modeLabel'),
    start: document.getElementById('startButton'),
    restart: document.getElementById('restartButton'),
    sound: document.getElementById('soundToggle'),
    leaderboard: document.getElementById('leaderboardButton'),
    help: document.getElementById('helpButton'),
    summaryModal: document.getElementById('summaryModal'),
    summaryTitle: document.getElementById('summaryTitle'),
    summaryMessage: document.getElementById('summaryMessage'),
    summaryMode: document.getElementById('summaryMode'),
    summaryRound: document.getElementById('summaryRound'),
    summaryScore: document.getElementById('summaryScore'),
    summaryAchievements: document.getElementById('summaryAchievements'),
    playAgain: document.getElementById('playAgainButton'),
    closeSummary: document.getElementById('closeSummaryButton'),
    leaderboardModal: document.getElementById('leaderboardModal'),
    closeLeaderboard: document.getElementById('closeLeaderboardButton'),
    leaderboardList: document.getElementById('leaderboardList'),
    leaderboardBest: document.getElementById('leaderboardBest'),
    achievementCount: document.getElementById('achievementCount'),
    nicknameForm: document.getElementById('nicknameForm'),
    nicknameInput: document.getElementById('nicknameInput'),
    resetLeaderboard: document.getElementById('resetLeaderboardButton'),
    helpModal: document.getElementById('helpModal'),
    closeHelp: document.getElementById('closeHelpButton'),
    modeInputs: Array.from(document.querySelectorAll('input[name="mode"]')),
    backdrops: Array.from(document.querySelectorAll('.modal__backdrop')),
  };

  const state = {
    mode: 'classic',
    score: 0,
    bestScore: 0,
    round: 0,
    sequence: [],
    playerStep: 0,
    acceptingInput: false,
    playingSequence: false,
    isRunning: false,
    combo: 0,
    soundOn: true,
    pendingLeaderboardEntry: null,
    storage: loadStorage(),
    timers: new Set(),
  };

  state.bestScore = state.storage.bestScore || 0;
  state.soundOn = state.storage.settings?.soundOn ?? true;
  state.mode = state.storage.settings?.mode ?? 'classic';

  let audioContext = null;

  function loadStorage() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        bestScore: parsed.bestScore || 0,
        leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
        achievements: parsed.achievements || {},
        settings: parsed.settings || {},
      };
    } catch {
      return { bestScore: 0, leaderboard: [], achievements: {}, settings: {} };
    }
  }

  function saveStorage() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bestScore: state.bestScore,
        leaderboard: state.storage.leaderboard,
        achievements: state.storage.achievements,
        settings: { soundOn: state.soundOn, mode: state.mode },
      }),
    );
  }

  function init() {
    elements.modeInputs.forEach((input) => {
      input.checked = input.value === state.mode;
      input.addEventListener('change', () => setMode(input.value));
    });

    elements.pads.forEach((pad) => {
      pad.addEventListener('pointerdown', () => handlePadPress(Number(pad.dataset.pad)));
    });

    window.addEventListener('keydown', handleKeydown);
    elements.start.addEventListener('click', startGame);
    elements.restart.addEventListener('click', restartGame);
    elements.sound.addEventListener('click', toggleSound);
    elements.leaderboard.addEventListener('click', () => openModal(elements.leaderboardModal));
    elements.help.addEventListener('click', () => openModal(elements.helpModal));
    elements.playAgain.addEventListener('click', () => {
      closeModal(elements.summaryModal);
      startGame();
    });
    elements.closeSummary.addEventListener('click', () => closeModal(elements.summaryModal));
    elements.closeLeaderboard.addEventListener('click', () => closeModal(elements.leaderboardModal));
    elements.closeHelp.addEventListener('click', () => closeModal(elements.helpModal));
    elements.resetLeaderboard.addEventListener('click', resetLeaderboard);
    elements.nicknameForm.addEventListener('submit', saveLeaderboardEntry);
    elements.backdrops.forEach((backdrop) => {
      backdrop.addEventListener('click', () => closeModal(backdrop.parentElement));
    });

    syncUi();
    renderLeaderboard();
    updateStatus('Pick a mode, then tap Start.');
  }

  function setMode(mode) {
    state.mode = mode;
    state.combo = 0;
    elements.modeLabel.textContent = modeName(mode);
    elements.combo.textContent = 'Combo calm';
    saveStorage();
  }

  function modeName(mode) {
    if (mode === 'strict') return 'Strict Mode';
    if (mode === 'zen') return 'Zen Practice';
    return 'Classic Mode';
  }

  function startGame() {
    clearTimers();
    ensureAudio();
    state.score = 0;
    state.round = 0;
    state.sequence = [];
    state.combo = 0;
    state.playerStep = 0;
    state.isRunning = true;
    state.pendingLeaderboardEntry = null;
    closeModal(elements.summaryModal);
    playStartSound();
    updateStatus('Watch the sequence.');
    nextRound();
  }

  function restartGame() {
    if (!state.isRunning && state.round === 0) {
      updateStatus('Fresh board ready. Tap Start when you are set.');
      flashAllPads();
      return;
    }
    playStartSound();
    startGame();
  }

  function nextRound() {
    state.round += 1;
    state.sequence.push(Math.floor(Math.random() * PAD_ORDER.length));
    state.playerStep = 0;
    state.acceptingInput = false;
    state.playingSequence = true;
    updateScore();
    celebrateMilestone(false);
    updateStatus(`Round ${state.round}. Memorize the pattern.`);
    playbackSequence();
  }

  function playbackSequence() {
    const stepDuration = getStepDuration();
    state.sequence.forEach((padIndex, index) => {
      schedule(() => activatePad(padIndex, stepDuration * 0.6, true), index * stepDuration);
    });
    schedule(() => {
      state.playingSequence = false;
      state.acceptingInput = true;
      updateStatus(`Your turn. Repeat ${state.sequence.length} step${state.sequence.length > 1 ? 's' : ''}.`);
    }, state.sequence.length * stepDuration + 40);
  }

  function getStepDuration() {
    const base = state.mode === 'strict' ? 500 : 620;
    const reduction = state.mode === 'strict' ? 22 : 14;
    return Math.max(state.mode === 'strict' ? 220 : 300, base - state.round * reduction);
  }

  function handlePadPress(index) {
    if (!state.acceptingInput || state.playingSequence) return;
    activatePad(index, 220, true);
    const expected = state.sequence[state.playerStep];
    if (index === expected) {
      state.playerStep += 1;
      state.combo += 1;
      elements.combo.textContent = comboMessage();
      if (state.playerStep === state.sequence.length) {
        handleRoundSuccess();
      }
      return;
    }
    handleMistake(index);
  }

  function comboMessage() {
    if (state.combo >= 12) return 'Combo blazing';
    if (state.combo >= 8) return 'Combo electric';
    if (state.combo >= 4) return 'Combo rising';
    return 'Combo calm';
  }

  function handleRoundSuccess() {
    state.acceptingInput = false;
    state.score += calculateRoundScore();
    updateScore();
    pulsePads('is-correct');
    playMilestoneSound(state.round % 5 === 0);
    celebrateMilestone(true);
    unlockAchievementsForRound();
    updateStatus(`Clean round. Get ready for round ${state.round + 1}.`);
    schedule(() => nextRound(), 900);
  }

  function calculateRoundScore() {
    const comboBonus = Math.min(12, Math.floor(state.combo / 3));
    const strictBonus = state.mode === 'strict' ? 4 : 0;
    return state.round * 2 + comboBonus + strictBonus;
  }

  function handleMistake(index) {
    state.acceptingInput = false;
    state.combo = 0;
    elements.combo.textContent = 'Combo broken';
    const pad = elements.pads[index];
    pad.classList.add('is-wrong');
    playWrongSound();
    schedule(() => pad.classList.remove('is-wrong'), 520);

    if (state.mode === 'zen') {
      updateStatus('Not quite. Zen mode lets you retry this round.');
      schedule(() => {
        state.playerStep = 0;
        playbackSequence();
      }, 900);
      return;
    }

    finishGame();
  }

  function finishGame() {
    state.isRunning = false;
    updateBestScore();
    unlockAchievement('firstWin', state.round >= 1);
    unlockAchievement('strictMaster', state.mode === 'strict' && state.round >= 10);
    unlockAchievement('silentChallenger', !state.soundOn && state.round >= 5);
    maybeQueueLeaderboardEntry();
    showSummary();
    updateStatus('Run over. Tap Start to chase a new record.');
  }

  function updateBestScore() {
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      updateStatus(`New high score: ${state.score}!`);
      saveStorage();
    }
  }

  function maybeQueueLeaderboardEntry() {
    const leaderboard = state.storage.leaderboard;
    const qualifies = leaderboard.length < 10 || leaderboard.some((entry) => state.score > entry.score);
    if (state.score <= 0 || !qualifies) {
      renderLeaderboard();
      return;
    }
    state.pendingLeaderboardEntry = {
      score: state.score,
      round: state.round,
      mode: modeName(state.mode),
      createdAt: new Date().toLocaleString(),
    };
    renderLeaderboard();
    openModal(elements.leaderboardModal);
    elements.nicknameForm.hidden = false;
    elements.nicknameInput.value = '';
    elements.nicknameInput.focus();
  }

  function saveLeaderboardEntry(event) {
    event.preventDefault();
    if (!state.pendingLeaderboardEntry) return;
    const nickname = (elements.nicknameInput.value.trim() || 'Player').slice(0, 14);
    state.storage.leaderboard.push({ ...state.pendingLeaderboardEntry, nickname });
    state.storage.leaderboard.sort((a, b) => b.score - a.score || b.round - a.round);
    state.storage.leaderboard = state.storage.leaderboard.slice(0, 10);
    state.pendingLeaderboardEntry = null;
    elements.nicknameForm.hidden = true;
    saveStorage();
    renderLeaderboard();
  }

  function renderLeaderboard() {
    elements.leaderboardBest.textContent = String(state.bestScore);
    const achievements = Object.values(state.storage.achievements).filter(Boolean);
    elements.achievementCount.textContent = String(achievements.length);
    const entries = state.storage.leaderboard;
    elements.leaderboardList.innerHTML = '';

    if (!entries.length) {
      const item = document.createElement('li');
      item.textContent = 'No records yet. Start a run and claim the first spot.';
      elements.leaderboardList.appendChild(item);
    } else {
      entries.forEach((entry, index) => {
        const item = document.createElement('li');
        item.innerHTML = `
          <strong><span>#${index + 1} ${escapeHtml(entry.nickname)}</span><span>${entry.score}</span></strong>
          <span>${escapeHtml(entry.mode)} · Round ${entry.round}</span>
          <span>${escapeHtml(entry.createdAt)}</span>
        `;
        elements.leaderboardList.appendChild(item);
      });
    }

    if (!state.pendingLeaderboardEntry) {
      elements.nicknameForm.hidden = true;
    }
    syncUi();
  }

  function resetLeaderboard() {
    const confirmed = window.confirm('Reset the local leaderboard and achievements?');
    if (!confirmed) return;
    state.storage.leaderboard = [];
    state.storage.achievements = {};
    state.bestScore = 0;
    saveStorage();
    renderLeaderboard();
    syncUi();
  }

  function unlockAchievementsForRound() {
    unlockAchievement('round5', state.round >= 5);
    unlockAchievement('round10', state.round >= 10);
    unlockAchievement('round20', state.round >= 20);
  }

  function unlockAchievement(key, condition) {
    if (!condition || state.storage.achievements[key]) return;
    state.storage.achievements[key] = true;
    saveStorage();
  }

  function showSummary() {
    const earned = Object.entries(state.storage.achievements)
      .filter(([, active]) => active)
      .map(([key]) => ACHIEVEMENTS[key]);
    elements.summaryTitle.textContent = state.score >= state.bestScore && state.score > 0 ? 'New high score!' : 'Run complete.';
    elements.summaryMessage.textContent = `You reached round ${state.round} with a score of ${state.score}.`;
    elements.summaryMode.textContent = modeName(state.mode);
    elements.summaryRound.textContent = String(state.round);
    elements.summaryScore.textContent = String(state.score);
    elements.summaryAchievements.innerHTML = '';
    if (earned.length) {
      earned.slice(-4).forEach((badge) => {
        const item = document.createElement('div');
        item.className = 'achievement-badge';
        item.textContent = badge;
        elements.summaryAchievements.appendChild(item);
      });
    } else {
      const item = document.createElement('div');
      item.className = 'achievement-badge';
      item.textContent = 'No badges yet — warm up and dive back in.';
      elements.summaryAchievements.appendChild(item);
    }
    openModal(elements.summaryModal);
  }

  function celebrateMilestone(playEffect) {
    if (!playEffect || state.round % 5 !== 0) return;
    updateStatus(`Milestone reached: Round ${state.round}!`);
    flashAllPads();
  }

  function flashAllPads() {
    elements.pads.forEach((pad, index) => {
      schedule(() => {
        pad.classList.add('is-lit');
        schedule(() => pad.classList.remove('is-lit'), 170);
      }, index * 90);
    });
  }

  function updateScore() {
    elements.score.textContent = String(state.score);
    elements.bestScore.textContent = String(state.bestScore);
    elements.round.textContent = String(state.round);
    elements.modeLabel.textContent = modeName(state.mode);
  }

  function updateStatus(message) {
    elements.status.textContent = message;
  }

  function syncUi() {
    elements.sound.textContent = state.soundOn ? 'Sound On' : 'Sound Off';
    elements.sound.setAttribute('aria-pressed', String(state.soundOn));
    updateScore();
    elements.modeLabel.textContent = modeName(state.mode);
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    saveStorage();
    syncUi();
    if (state.soundOn) playStartSound();
  }

  function activatePad(index, duration = 220, withSound = false) {
    const pad = elements.pads[index];
    if (!pad) return;
    pad.classList.add('is-lit');
    if (withSound) playPadTone(index, duration);
    schedule(() => pad.classList.remove('is-lit'), duration);
  }

  function pulsePads(className) {
    elements.pads.forEach((pad) => {
      pad.classList.add(className);
      schedule(() => pad.classList.remove(className), 450);
    });
  }

  function handleKeydown(event) {
    const map = { ArrowUp: 0, q: 0, ArrowRight: 1, w: 1, ArrowLeft: 2, a: 2, ArrowDown: 3, s: 3 };
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key in map) {
      event.preventDefault();
      handlePadPress(map[key]);
    }
  }

  function ensureAudio() {
    if (!state.soundOn || audioContext) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = new AudioCtx();
  }

  function playPadTone(index, duration) {
    if (!state.soundOn) return;
    ensureAudio();
    if (!audioContext) return;
    const frequency = Object.values(PAD_CONFIG).find((config) => config.index === index)?.frequency || 440;
    playTone(frequency, duration / 1000, 'triangle', 0.05, 0.18);
  }

  function playStartSound() {
    if (!state.soundOn) return;
    ensureAudio();
    if (!audioContext) return;
    playTone(392, 0.08, 'sine', 0.03, 0.14, audioContext.currentTime);
    playTone(523.25, 0.12, 'triangle', 0.02, 0.16, audioContext.currentTime + 0.08);
  }

  function playWrongSound() {
    if (!state.soundOn) return;
    ensureAudio();
    if (!audioContext) return;
    playTone(180, 0.22, 'sawtooth', 0.02, 0.2);
    playTone(120, 0.3, 'sine', 0.02, 0.15, audioContext.currentTime + 0.08);
  }

  function playMilestoneSound(isBigMilestone) {
    if (!state.soundOn) return;
    ensureAudio();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    playTone(523.25, 0.1, 'triangle', 0.02, 0.13, now);
    playTone(659.25, 0.1, 'triangle', 0.02, 0.14, now + 0.1);
    if (isBigMilestone) {
      playTone(783.99, 0.16, 'triangle', 0.02, 0.18, now + 0.2);
    }
  }

  function playTone(frequency, duration, type, attack, volume, startTime = audioContext.currentTime) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }

  function openModal(modal) {
    modal.hidden = false;
  }

  function closeModal(modal) {
    modal.hidden = true;
  }

  function schedule(fn, delay) {
    const timer = window.setTimeout(() => {
      state.timers.delete(timer);
      fn();
    }, delay);
    state.timers.add(timer);
  }

  function clearTimers() {
    state.timers.forEach((timer) => window.clearTimeout(timer));
    state.timers.clear();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  init();
})();
