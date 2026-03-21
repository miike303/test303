import { COSMETICS } from './config.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      title: document.getElementById('titleScreen'),
      hud: document.getElementById('hud'),
      pause: document.getElementById('pauseScreen'),
      gameOver: document.getElementById('gameOverScreen'),
      tutorial: document.getElementById('tutorialOverlay'),
      rotate: document.getElementById('rotateOverlay'),
      runSummary: document.getElementById('runSummary'),
      powerupTimers: document.getElementById('powerupTimers'),
      bestScore: document.getElementById('bestScoreValue'),
      totalCoins: document.getElementById('totalCoinsValue'),
      bestHeight: document.getElementById('bestHeightValue'),
      hudScore: document.getElementById('hudScore'),
      hudCoins: document.getElementById('hudCoins'),
      hudCombo: document.getElementById('hudCombo'),
      comboFill: document.getElementById('comboFill'),
      hudHeight: document.getElementById('hudHeight'),
      hudBest: document.getElementById('hudBest'),
      hudBiome: document.getElementById('hudBiome'),
      hudSpeed: document.getElementById('hudSpeed'),
      shopCoins: document.getElementById('shopCoinsValue'),
      selectedSkin: document.getElementById('selectedSkinValue'),
      selectedTrail: document.getElementById('selectedTrailValue'),
      skinGrid: document.getElementById('skinGrid'),
      trailGrid: document.getElementById('trailGrid'),
      auraGrid: document.getElementById('auraGrid'),
      missionsList: document.getElementById('missionsList'),
      audioToggle: document.getElementById('audioToggle'),
      effectsToggle: document.getElementById('effectsToggle'),
      vibrationToggle: document.getElementById('vibrationToggle'),
      totalCoinsLabel: document.getElementById('totalCoinsValue'),
    };
    this.bind();
  }

  bind() {
    document.getElementById('playButton').addEventListener('click', () => this.game.startRun());
    document.getElementById('restartButton').addEventListener('click', () => this.game.startRun());
    document.getElementById('menuButton').addEventListener('click', () => this.game.showTitle());
    document.getElementById('pauseButton').addEventListener('click', () => this.game.togglePause());
    document.getElementById('resumeButton').addEventListener('click', () => this.game.togglePause(false));
    document.getElementById('restartPauseButton').addEventListener('click', () => this.game.startRun());
    document.getElementById('quitButton').addEventListener('click', () => this.game.showTitle());
    document.getElementById('tutorialStartButton').addEventListener('click', () => this.game.startRun(true));
    document.getElementById('tutorialSkipButton').addEventListener('click', () => this.game.skipTutorial());
    document.getElementById('resetProgressButton').addEventListener('click', () => this.game.resetProgress());
    document.getElementById('audioToggle').addEventListener('click', () => this.game.toggleSetting('audioMuted'));
    document.getElementById('effectsToggle').addEventListener('click', () => this.game.toggleSetting('reduceEffects'));
    document.getElementById('vibrationToggle').addEventListener('click', () => this.game.toggleSetting('vibration'));

    document.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => this.openModal(button.dataset.open)));
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => this.closeModals()));
  }

  showRotate(visible) { this.el.rotate.classList.toggle('hidden', !visible); }
  showTitle() { this.el.title.classList.remove('hidden'); this.el.title.classList.add('active'); }
  hideTitle() { this.el.title.classList.add('hidden'); this.el.title.classList.remove('active'); }
  showHUD(visible) { this.el.hud.classList.toggle('hidden', !visible); }
  showPause(visible) { this.el.pause.classList.toggle('hidden', !visible); }
  showGameOver(visible) { this.el.gameOver.classList.toggle('hidden', !visible); }
  showTutorial(visible) { this.el.tutorial.classList.toggle('hidden', !visible); }

  openModal(id) { document.getElementById(id).classList.remove('hidden'); this.game.audio.click(); this.renderStatic(); }
  closeModals() { document.querySelectorAll('.modal-screen').forEach((node) => node.classList.add('hidden')); this.game.audio.click(); }

  renderStatic() {
    const save = this.game.save;
    this.el.bestScore.textContent = Math.floor(save.bestScore).toLocaleString();
    this.el.totalCoins.textContent = save.totalCoins.toLocaleString();
    this.el.bestHeight.textContent = `${Math.floor(save.bestHeight)}m`;
    this.el.shopCoins.textContent = save.totalCoins.toLocaleString();
    this.el.selectedSkin.textContent = COSMETICS.skins.find((s) => s.id === save.selected.skin)?.name || 'Default';
    this.el.selectedTrail.textContent = COSMETICS.trails.find((s) => s.id === save.selected.trail)?.name || 'Pulse';
    this.renderShop();
    this.renderMissions();
    this.el.audioToggle.textContent = `Audio: ${save.settings.audioMuted ? 'Off' : 'On'}`;
    this.el.effectsToggle.textContent = `Reduced Effects: ${save.settings.reduceEffects ? 'On' : 'Off'}`;
    this.el.vibrationToggle.textContent = `Vibration Placeholder: ${save.settings.vibration ? 'On' : 'Off'}`;
  }

  renderHUD() {
    const g = this.game;
    this.el.hudScore.textContent = Math.floor(g.score).toLocaleString();
    this.el.hudCoins.textContent = g.runCoins.toString();
    this.el.hudCombo.textContent = `x${g.combo.toFixed(1)}`;
    this.el.comboFill.style.width = `${Math.min(100, g.comboCharge * 100)}%`;
    this.el.hudHeight.textContent = `${Math.floor(g.distance)}m`;
    this.el.hudBest.textContent = Math.floor(g.save.bestScore).toLocaleString();
    this.el.hudBiome.textContent = g.biome.name;
    this.el.hudSpeed.textContent = `${g.speedFactor.toFixed(1)}x`;
    this.el.powerupTimers.innerHTML = Object.entries(g.activePowerups)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => `<div class="power-chip">${g.powerDefs[key].label} ${(value).toFixed(1)}s</div>`)
      .join('');
  }

  renderGameOver(run) {
    this.el.runSummary.innerHTML = `
      <article class="summary-item"><span>Score</span><strong>${Math.floor(run.score).toLocaleString()}</strong></article>
      <article class="summary-item"><span>Height</span><strong>${Math.floor(run.height)}m</strong></article>
      <article class="summary-item"><span>Coins</span><strong>${run.coins}</strong></article>
      <article class="summary-item"><span>Near Misses</span><strong>${run.nearMisses}</strong></article>
      <article class="summary-item"><span>Best Combo</span><strong>x${run.combo.toFixed(1)}</strong></article>
      <article class="summary-item"><span>Biome</span><strong>${run.biome}</strong></article>
    `;
  }

  renderShop() {
    const build = (group, root, selectedKey) => {
      root.innerHTML = COSMETICS[group].map((item) => {
        const unlocked = this.game.save.unlocks[group][item.id];
        const selected = this.game.save.selected[selectedKey] === item.id;
        return `
          <button class="shop-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-group="${group}" data-id="${item.id}">
            <strong>${item.name}</strong>
            <p>${unlocked ? (selected ? 'Equipped' : 'Tap to equip') : `${item.cost} coins`}</p>
          </button>`;
      }).join('');
      root.querySelectorAll('.shop-card').forEach((button) => button.addEventListener('click', () => this.game.handleShop(button.dataset.group, button.dataset.id)));
    };
    build('skins', this.el.skinGrid, 'skin');
    build('trails', this.el.trailGrid, 'trail');
    build('auras', this.el.auraGrid, 'aura');
  }

  renderMissions() {
    this.el.missionsList.innerHTML = this.game.missions.list.map((mission) => `
      <article class="mission-card ${mission.completed ? 'done' : ''}">
        <strong>${mission.text}</strong>
        <p>Reward: ${mission.reward} coins</p>
        <div class="mission-meta"><span>${mission.progress}/${mission.goal}</span>${mission.completed && !mission.claimed ? `<button class="secondary-button claim-button" data-claim="${mission.id}">Claim</button>` : `<span>${mission.claimed ? 'Claimed' : 'In Progress'}</span>`}</div>
        <div class="progress-track"><div style="width:${(mission.progress / mission.goal) * 100}%"></div></div>
      </article>
    `).join('');
    this.el.missionsList.querySelectorAll('[data-claim]').forEach((button) => button.addEventListener('click', () => this.game.claimMission(button.dataset.claim)));
  }
}
