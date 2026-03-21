export class UI {
  constructor(game) {
    this.game = game;
    this.elements = {
      hud: document.getElementById('hud'),
      aimPanel: document.getElementById('aimPanel'),
      powerFill: document.getElementById('powerFill'),
      aimHint: document.getElementById('aimHint'),
      courseGrid: document.getElementById('courseGrid'),
      toast: document.getElementById('toast'),
      screens: {
        mainMenu: document.getElementById('mainMenu'),
        courseSelect: document.getElementById('courseSelectScreen'),
        pause: document.getElementById('pauseScreen'),
        holeComplete: document.getElementById('holeCompleteScreen'),
        campaignComplete: document.getElementById('campaignCompleteScreen'),
      },
    };

    this.bind();
  }

  bind() {
    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => this.game.handleAction(button.dataset.action));
    });
    document.getElementById('pauseButton').addEventListener('click', () => this.game.togglePause());
    document.getElementById('muteButton').addEventListener('click', () => this.game.toggleMute());
    document.getElementById('menuMuteButton').addEventListener('click', () => this.game.toggleMute());
    document.getElementById('nextHoleButton').addEventListener('click', () => this.game.nextHole());
  }

  showScreen(name) {
    Object.entries(this.elements.screens).forEach(([key, node]) => {
      node.classList.toggle('active', key === name);
    });
  }

  showHUD(visible) {
    this.elements.hud.classList.toggle('hidden', !visible);
    this.elements.aimPanel.classList.toggle('hidden', !visible);
  }

  updateHUD(game) {
    const { currentHoleIndex, level, strokes, progress, aimPreview } = game;
    document.getElementById('hudHole').textContent = `${currentHoleIndex + 1}`;
    document.getElementById('hudPar').textContent = level ? `${level.par}` : '—';
    document.getElementById('hudStrokes').textContent = `${strokes}`;
    document.getElementById('hudBest').textContent = level ? progress.bestStrokes[level.id] ?? '—' : '—';
    document.getElementById('muteButton').textContent = progress.mute ? '🔈' : '🔊';
    document.getElementById('menuMuteButton').textContent = progress.mute ? 'Audio Off' : 'Audio On';
    this.elements.powerFill.style.width = `${Math.round((aimPreview?.power || 0) * 100)}%`;
    this.elements.aimHint.textContent = level?.hint || 'Line up your shot.';
    document.getElementById('campaignSummary').textContent = `${progress.unlockedHoles}/${game.levels.length} holes unlocked • best scores saved locally`;
  }

  renderCourseGrid(game) {
    const root = this.elements.courseGrid;
    root.innerHTML = '';
    game.levels.forEach((level, index) => {
      const unlocked = index < game.progress.unlockedHoles || game.mode === 'practice';
      const best = game.progress.bestStrokes[level.id];
      const medal = game.progress.medals[level.id] || '—';
      const button = document.createElement('button');
      button.className = `course-card ${unlocked ? '' : 'locked'}`;
      button.disabled = !unlocked;
      button.innerHTML = `
        <div class="course-card__top"><strong>Hole ${level.id}</strong><span>Par ${level.par}</span></div>
        <p>${level.name}</p>
        <small>Best: ${best ?? '—'} • Medal: ${medal}</small>
      `;
      if (unlocked) button.addEventListener('click', () => game.startHole(index, 'select'));
      root.appendChild(button);
    });
  }

  showToast(message) {
    const { toast } = this.elements;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.classList.add('hidden'), 220);
    }, 1800);
  }

  fillHoleComplete({ title, summary, strokes, score, medal, hasNext }) {
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultSummary').textContent = summary;
    document.getElementById('resultStrokes').textContent = strokes;
    document.getElementById('resultScore').textContent = score > 0 ? `+${score}` : `${score}`;
    document.getElementById('resultMedal').textContent = medal;
    document.getElementById('nextHoleButton').textContent = hasNext ? 'Next Hole' : 'Finish Campaign';
  }

  fillCampaignComplete(game, totalScore, medalCounts) {
    document.getElementById('campaignResultCopy').textContent = `You completed all 12 holes in ${game.campaignStrokes} strokes, ${totalScore > 0 ? `${totalScore} over par` : `${Math.abs(totalScore)} under par`}.`;
    const stats = document.getElementById('campaignStats');
    stats.innerHTML = `
      <div class="result-stat"><span>Total Strokes</span><strong>${game.campaignStrokes}</strong></div>
      <div class="result-stat"><span>Gold</span><strong>${medalCounts.Gold || 0}</strong></div>
      <div class="result-stat"><span>Silver</span><strong>${medalCounts.Silver || 0}</strong></div>
      <div class="result-stat"><span>Bronze</span><strong>${medalCounts.Bronze || 0}</strong></div>
    `;
  }
}
