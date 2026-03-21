(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) return;

  const ui = {
    health: document.getElementById('hudHealth'),
    money: document.getElementById('hudMoney'),
    wave: document.getElementById('hudWave'),
    weapons: document.getElementById('hudWeapons'),
    score: document.getElementById('hudScore'),
    kills: document.getElementById('hudKills'),
    instruction: document.getElementById('instructionText'),
    waveState: document.getElementById('waveStateLabel'),
    bestScore: document.getElementById('bestScoreLabel'),
    shopMoney: document.getElementById('shopMoney'),
    shopWave: document.getElementById('shopWave'),
    shopGrid: document.getElementById('shopGrid'),
    finalScore: document.getElementById('finalScore'),
    finalWave: document.getElementById('finalWave'),
    finalKills: document.getElementById('finalKills'),
    finalBest: document.getElementById('finalBest'),
    overlays: {
      start: document.getElementById('startOverlay'),
      shop: document.getElementById('shopOverlay'),
      pause: document.getElementById('pauseOverlay'),
      gameOver: document.getElementById('gameOverOverlay'),
    },
    buttons: {
      start: document.getElementById('startButton'),
      nextWave: document.getElementById('nextWaveButton'),
      pauseResume: document.getElementById('pauseResumeButton'),
      pause: document.getElementById('pauseButton'),
      resume: document.getElementById('resumeButton'),
      restart: document.getElementById('restartButton'),
      restartGame: document.getElementById('restartGameButton'),
      mute: document.getElementById('muteButton'),
    },
  };

  const STORAGE = {
    best: 'neon-tunnel-sentinel-best-v1',
    unlocks: 'neon-tunnel-sentinel-unlocks-v1',
  };

  const TWO_PI = Math.PI * 2;
  const CENTER_WEAPON = 'gun';
  const weaponOrder = ['gun', 'laser', 'sprinkler'];

  const weaponTemplates = {
    gun: { unlocked: true, level: 1, cooldown: 0.14, damage: 15, speed: 760, life: 1.1, size: 5, color: '#ffffff', price: 65 },
    laser: { unlocked: false, level: 0, cooldown: 0.56, damage: 48, range: 560, width: 5, color: '#d47aff', price: 150 },
    sprinkler: { unlocked: false, level: 0, cooldown: 1.15, damage: 18, speed: 420, life: 0.95, size: 4.5, count: 9, color: '#ff78c6', price: 165 },
  };

  const shopItems = [
    { id: 'gun-level', label: 'Gun Upgrade', getPrice: (s) => 60 + s.weapons.gun.level * 45, action: (s) => { s.weapons.gun.level += 1; s.stats.damageBonus += 0.08; }, desc: (s) => `Rapid-fire bullets hit harder. Gun level ${s.weapons.gun.level} → ${s.weapons.gun.level + 1}.` },
    { id: 'laser', label: 'Laser Unlock / Upgrade', getPrice: (s) => s.weapons.laser.unlocked ? 120 + s.weapons.laser.level * 95 : 150, action: (s) => { s.weapons.laser.unlocked = true; s.weapons.laser.level += 1; }, desc: (s) => s.weapons.laser.unlocked ? `Boost the beam. Laser level ${s.weapons.laser.level} → ${s.weapons.laser.level + 1}.` : 'Unlock a piercing purple-white beam weapon.' },
    { id: 'sprinkler', label: 'Sprinkler Unlock / Upgrade', getPrice: (s) => s.weapons.sprinkler.unlocked ? 130 + s.weapons.sprinkler.level * 95 : 165, action: (s) => { s.weapons.sprinkler.unlocked = true; s.weapons.sprinkler.level += 1; }, desc: (s) => s.weapons.sprinkler.unlocked ? `Increase radial burst output. Sprinkler level ${s.weapons.sprinkler.level} → ${s.weapons.sprinkler.level + 1}.` : 'Unlock crowd control bursts that fire in a radial spread.' },
    { id: 'fire-rate', label: 'Fire Rate Upgrade', getPrice: (s) => 90 + s.stats.fireRateLevel * 80, action: (s) => { s.stats.fireRateLevel += 1; s.stats.fireRateBoost += 0.08; }, desc: (s) => `All weapons cycle faster. Fire rate ${Math.round((1 + s.stats.fireRateBoost) * 100)}%.` },
    { id: 'damage', label: 'Damage Upgrade', getPrice: (s) => 100 + s.stats.damageLevel * 90, action: (s) => { s.stats.damageLevel += 1; s.stats.damageBonus += 0.12; }, desc: (s) => `Increase raw weapon damage. Bonus ${Math.round(s.stats.damageBonus * 100)}% → ${Math.round((s.stats.damageBonus + 0.12) * 100)}%.` },
    { id: 'projectile', label: 'Projectile Size / Pierce', getPrice: (s) => 85 + s.stats.projectileLevel * 70, action: (s) => { s.stats.projectileLevel += 1; s.stats.projectileScale += 0.12; s.stats.pierceBonus += 1; }, desc: (s) => `Bigger shots and more piercing. Pierce bonus ${s.stats.pierceBonus} → ${s.stats.pierceBonus + 1}.` },
    { id: 'repair', label: 'Core Health Repair', getPrice: () => 90, action: (s) => { s.core.hp = Math.min(s.core.maxHp, s.core.hp + 30); }, desc: () => 'Restore 30 core health. Expensive, but lifesaving in late waves.' },
    { id: 'shield', label: 'Shield Charge', getPrice: (s) => 110 + s.stats.shieldLevel * 90, action: (s) => { s.stats.shieldLevel += 1; s.core.shield = Math.min(s.core.shield + 20, 100); s.core.shieldTimer = 15; }, desc: (s) => `Adds a temporary defensive shield and stores ${Math.min(s.core.shield + 20, 100)} shield energy.` },
  ];

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    center: { x: 0, y: 0 },
    time: 0,
    lastTime: 0,
    pointer: { x: 0, y: -1, active: false },
    running: false,
    paused: false,
    inShop: false,
    gameOver: false,
    audioEnabled: true,
    screenShake: 0,
    firstRun: !localStorage.getItem(STORAGE.best),
    bestScore: Number(localStorage.getItem(STORAGE.best) || 0),
    persistentUnlocks: loadPersistentUnlocks(),
    core: { hp: 100, maxHp: 100, shield: 0, shieldTimer: 0, hitFlash: 0, angle: -Math.PI / 2 },
    stats: { score: 0, kills: 0, money: 0, wave: 1, fireRateLevel: 0, fireRateBoost: 0, damageLevel: 0, damageBonus: 0, projectileLevel: 0, projectileScale: 0, pierceBonus: 0, shieldLevel: 0 },
    wave: { number: 1, active: false, complete: false, spawnTimer: 0, enemiesToSpawn: 0, aliveTarget: 0 },
    weapons: resetWeapons(loadPersistentUnlocks()),
    projectiles: [],
    enemies: [],
    particles: [],
    trails: [],
    rings: createTunnelRings(),
    audio: null,
  };

  function loadPersistentUnlocks() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.unlocks) || '{}');
    } catch {
      return {};
    }
  }

  function savePersistentUnlocks() {
    localStorage.setItem(STORAGE.unlocks, JSON.stringify({
      laser: state.weapons.laser.unlocked,
      sprinkler: state.weapons.sprinkler.unlocked,
      bestScore: state.bestScore,
    }));
  }

  function resetWeapons(saved) {
    return {
      gun: { ...weaponTemplates.gun },
      laser: { ...weaponTemplates.laser, unlocked: Boolean(saved.laser) },
      sprinkler: { ...weaponTemplates.sprinkler, unlocked: Boolean(saved.sprinkler) },
    };
  }

  function createTunnelRings() {
    return Array.from({ length: 9 }, (_, i) => {
      const radius = 120 + i * 64;
      const points = 10 + (i % 4);
      const offsets = Array.from({ length: points }, (_, p) => 0.78 + Math.sin(p * 1.7 + i * 0.4) * 0.12 + Math.cos(p * 0.8 + i) * 0.06);
      return { radius, points, offsets, pulse: Math.random() * TWO_PI, spin: (i % 2 === 0 ? 1 : -1) * (0.03 + i * 0.003) };
    });
  }

  function setup() {
    resize();
    bindEvents();
    renderShop();
    updateHud();
    requestAnimationFrame(loop);
  }

  function bindEvents() {
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onPointer);
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerenter', onPointer);
    window.addEventListener('pointerup', () => { state.pointer.active = false; });
    window.addEventListener('pointercancel', () => { state.pointer.active = false; });

    ui.buttons.start.addEventListener('click', () => {
      ensureAudio();
      ui.overlays.start.hidden = true;
      state.running = true;
      state.wave.active = false;
      openShop('Tap Start Next Wave to begin the run.');
    });
    ui.buttons.nextWave.addEventListener('click', () => { closeShop(); startWave(); });
    ui.buttons.pauseResume.addEventListener('click', restartGame);
    ui.buttons.pause.addEventListener('click', () => togglePause());
    ui.buttons.resume.addEventListener('click', () => togglePause(false));
    ui.buttons.restart.addEventListener('click', restartGame);
    ui.buttons.restartGame.addEventListener('click', restartGame);
    ui.buttons.mute.addEventListener('click', toggleMute);
  }

  function resize() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.center.x = state.width / 2;
    state.center.y = state.height / 2;
  }

  function onPointer(event) {
    const rect = canvas.getBoundingClientRect();
    state.pointer.x = event.clientX - rect.left - state.center.x;
    state.pointer.y = event.clientY - rect.top - state.center.y;
    state.pointer.active = true;
    if (!state.running) return;
    ensureAudio();
  }

  function ensureAudio() {
    if (state.audio || !window.AudioContext) return;
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.06;
    master.connect(context.destination);
    state.audio = { context, master };
  }

  function playSound(type) {
    if (!state.audioEnabled || !state.audio) return;
    const { context, master } = state.audio;
    if (context.state === 'suspended') context.resume();
    const now = context.currentTime;
    const gain = context.createGain();
    const osc = context.createOscillator();
    const osc2 = context.createOscillator();
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(master);

    const defs = {
      gun: [300, 180, 'square', 0.04],
      laser: [520, 260, 'sawtooth', 0.08],
      sprinkler: [220, 120, 'triangle', 0.09],
      hit: [180, 90, 'square', 0.03],
      explode: [120, 40, 'sawtooth', 0.12],
      buy: [640, 880, 'triangle', 0.08],
      wave: [420, 680, 'sine', 0.14],
      over: [280, 80, 'sine', 0.24],
      hurt: [160, 70, 'square', 0.09],
    };
    const [start, end, waveType, duration] = defs[type] || defs.gun;
    osc.type = waveType;
    osc2.type = 'sine';
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, end), now + duration);
    osc2.frequency.setValueAtTime(start * 1.5, now);
    osc2.frequency.exponentialRampToValueAtTime(Math.max(40, end * 1.2), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(type === 'explode' ? 0.13 : 0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + duration);
    osc2.stop(now + duration);
  }

  function toggleMute() {
    state.audioEnabled = !state.audioEnabled;
    ui.buttons.mute.textContent = state.audioEnabled ? '🔊' : '🔇';
  }

  function togglePause(force) {
    if (!state.running || state.inShop || state.gameOver) return;
    state.paused = typeof force === 'boolean' ? force : !state.paused;
    ui.overlays.pause.hidden = !state.paused;
  }

  function restartGame() {
    state.running = true;
    state.paused = false;
    state.inShop = false;
    state.gameOver = false;
    state.screenShake = 0;
    state.core.hp = state.core.maxHp = 100;
    state.core.shield = 0;
    state.core.shieldTimer = 0;
    state.core.hitFlash = 0;
    state.stats = { score: 0, kills: 0, money: 0, wave: 1, fireRateLevel: 0, fireRateBoost: 0, damageLevel: 0, damageBonus: 0, projectileLevel: 0, projectileScale: 0, pierceBonus: 0, shieldLevel: 0 };
    state.wave = { number: 1, active: false, complete: false, spawnTimer: 0, enemiesToSpawn: 0, aliveTarget: 0 };
    state.weapons = resetWeapons(state.persistentUnlocks);
    state.projectiles.length = 0;
    state.enemies.length = 0;
    state.particles.length = 0;
    state.trails.length = 0;
    ui.overlays.pause.hidden = true;
    ui.overlays.gameOver.hidden = true;
    ui.overlays.start.hidden = true;
    openShop('Run reset. Start the next wave when ready.');
    updateHud();
  }

  function startWave() {
    state.wave.active = true;
    state.wave.complete = false;
    state.wave.number = state.stats.wave;
    state.wave.enemiesToSpawn = 5 + state.wave.number * 3;
    state.wave.aliveTarget = state.wave.enemiesToSpawn;
    state.wave.spawnTimer = 0.4;
    ui.waveState.textContent = `Wave ${state.wave.number} live`;
    ui.instruction.textContent = 'Drag to rotate the turret. Weapons auto-fire while targets are in range.';
    playSound('wave');
    updateHud();
  }

  function openShop(message) {
    state.inShop = true;
    state.wave.active = false;
    ui.waveState.textContent = 'Upgrade phase';
    ui.overlays.shop.hidden = false;
    if (message) ui.instruction.textContent = message;
    renderShop();
  }

  function closeShop() {
    state.inShop = false;
    ui.overlays.shop.hidden = true;
  }

  function endWave() {
    state.wave.active = false;
    state.stats.money += 40 + state.wave.number * 18;
    state.stats.score += 100 + state.wave.number * 30;
    state.stats.wave += 1;
    playSound('buy');
    openShop('Spend your credits and prepare for the next assault.');
    updateHud();
  }

  function renderShop() {
    ui.shopMoney.textContent = state.stats.money;
    ui.shopWave.textContent = state.stats.wave;
    ui.shopGrid.innerHTML = '';

    for (const item of shopItems) {
      const price = item.getPrice(state);
      const affordable = state.stats.money >= price;
      const button = document.createElement('button');
      button.className = 'shop-card';
      button.disabled = !affordable;
      button.innerHTML = `
        <div class="shop-card__top">
          <div>
            <div class="shop-card__meta">Upgrade</div>
            <h3>${item.label}</h3>
          </div>
          <div class="shop-card__price">$${price}</div>
        </div>
        <p class="shop-card__desc">${item.desc(state)}</p>
        <div class="shop-card__state">${affordable ? 'Available now' : 'Need more credits'}</div>
      `;
      button.addEventListener('click', () => {
        if (state.stats.money < price) return;
        state.stats.money -= price;
        item.action(state);
        state.persistentUnlocks.laser = state.weapons.laser.unlocked;
        state.persistentUnlocks.sprinkler = state.weapons.sprinkler.unlocked;
        savePersistentUnlocks();
        playSound('buy');
        renderShop();
        updateHud();
      });
      ui.shopGrid.appendChild(button);
    }
  }

  function loop(timestamp) {
    const dt = Math.min(0.033, (timestamp - (state.lastTime || timestamp)) / 1000 || 0.016);
    state.lastTime = timestamp;
    state.time += dt;

    if (state.running && !state.paused && !state.inShop && !state.gameOver) update(dt);
    render(dt);
    requestAnimationFrame(loop);
  }

  function update(dt) {
    updateAim(dt);
    updateWeapons(dt);
    spawnEnemies(dt);
    updateProjectiles(dt);
    updateEnemies(dt);
    updateParticles(dt);
    updateTrails(dt);
    updateCore(dt);
    updateRings(dt);

    if (state.wave.active && state.wave.enemiesToSpawn <= 0 && state.enemies.length === 0) endWave();
    updateHud();
  }

  function updateAim(dt) {
    const pointerAngle = Math.atan2(state.pointer.y || -1, state.pointer.x || 0);
    const targetAngle = Number.isFinite(pointerAngle) ? pointerAngle : state.core.angle;
    state.core.angle = lerpAngle(state.core.angle, targetAngle, 1 - Math.pow(0.00001, dt));
  }

  function updateWeapons(dt) {
    const enemiesExist = state.enemies.length > 0;
    for (const key of weaponOrder) {
      const weapon = state.weapons[key];
      weapon.cooldownLeft = Math.max(0, (weapon.cooldownLeft || 0) - dt);
      if (!weapon.unlocked || !enemiesExist || weapon.cooldownLeft > 0) continue;
      if (key === 'gun') fireGun(weapon);
      if (key === 'laser') fireLaser(weapon);
      if (key === 'sprinkler') fireSprinkler(weapon);
      weapon.cooldownLeft = weapon.cooldown / (1 + state.stats.fireRateBoost + weapon.level * 0.03);
    }
  }

  function spawnEnemies(dt) {
    if (!state.wave.active || state.wave.enemiesToSpawn <= 0) return;
    state.wave.spawnTimer -= dt;
    if (state.wave.spawnTimer > 0) return;
    state.wave.spawnTimer = Math.max(0.22, 0.9 - state.wave.number * 0.035 + Math.random() * 0.12);
    const typeRoll = Math.random();
    let type = 'runner';
    if (state.wave.number > 2 && typeRoll > 0.72) type = 'fast';
    if (state.wave.number > 3 && typeRoll > 0.87) type = 'tank';
    if (state.wave.number > 5 && typeRoll > 0.94) type = 'zigzag';
    state.enemies.push(createEnemy(type));
    state.wave.enemiesToSpawn -= 1;
  }

  function createEnemy(type) {
    const distance = Math.max(state.width, state.height) * 0.62 + 220;
    const angle = Math.random() * TWO_PI;
    const px = state.center.x + Math.cos(angle) * distance;
    const py = state.center.y + Math.sin(angle) * distance;
    const defs = {
      runner: { hp: 34, speed: 68, size: 15, damage: 12, reward: 18, color: '#ff77cb' },
      fast: { hp: 22, speed: 108, size: 11, damage: 10, reward: 15, color: '#ffd0ff' },
      tank: { hp: 110, speed: 42, size: 21, damage: 24, reward: 36, color: '#ff9cae' },
      zigzag: { hp: 42, speed: 82, size: 14, damage: 14, reward: 24, color: '#c88cff' },
    };
    const base = defs[type];
    return {
      type,
      x: px,
      y: py,
      angle,
      hp: base.hp + state.wave.number * (type === 'tank' ? 12 : 5),
      maxHp: base.hp + state.wave.number * (type === 'tank' ? 12 : 5),
      speed: base.speed + state.wave.number * 2.3,
      size: base.size + Math.random() * 2,
      damage: base.damage,
      reward: base.reward,
      color: base.color,
      pulse: Math.random() * TWO_PI,
      wiggle: Math.random() * TWO_PI,
      hitFlash: 0,
    };
  }

  function fireGun(weapon) {
    const target = findNearestEnemyInArc(0.92);
    if (!target) return;
    const angle = Math.atan2(target.y - state.center.y, target.x - state.center.x);
    const scale = 1 + state.stats.projectileScale + weapon.level * 0.06;
    spawnProjectile({
      x: state.center.x + Math.cos(angle) * 26,
      y: state.center.y + Math.sin(angle) * 26,
      vx: Math.cos(angle) * weapon.speed,
      vy: Math.sin(angle) * weapon.speed,
      damage: weapon.damage * (1 + state.stats.damageBonus + weapon.level * 0.14),
      life: weapon.life,
      size: weapon.size * scale,
      color: weapon.color,
      pierce: state.stats.pierceBonus,
      trail: '#ff9be2',
    });
    playSound('gun');
  }

  function fireLaser(weapon) {
    const target = findNearestEnemyInArc(0.5);
    if (!target) return;
    const angle = Math.atan2(target.y - state.center.y, target.x - state.center.x);
    const range = weapon.range + weapon.level * 50;
    const width = weapon.width + state.stats.projectileScale * 4 + weapon.level * 0.6;
    const damage = weapon.damage * (1 + state.stats.damageBonus + weapon.level * 0.18);
    const hits = [];
    for (const enemy of state.enemies) {
      const hit = distanceToSegment(enemy.x, enemy.y, state.center.x, state.center.y, state.center.x + Math.cos(angle) * range, state.center.y + Math.sin(angle) * range);
      if (hit < enemy.size + width) hits.push(enemy);
    }
    hits.sort((a, b) => distSq(a.x, a.y, state.center.x, state.center.y) - distSq(b.x, b.y, state.center.x, state.center.y));
    hits.slice(0, 3 + state.stats.pierceBonus).forEach((enemy) => damageEnemy(enemy, damage, angle));
    state.trails.push({ type: 'laser', angle, life: 0.13, range, width, color: weapon.color });
    playSound('laser');
  }

  function fireSprinkler(weapon) {
    const shots = weapon.count + weapon.level + state.stats.pierceBonus;
    const speed = weapon.speed + weapon.level * 12;
    for (let i = 0; i < shots; i += 1) {
      const angle = state.core.angle + (i / shots) * TWO_PI;
      spawnProjectile({
        x: state.center.x + Math.cos(angle) * 24,
        y: state.center.y + Math.sin(angle) * 24,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: weapon.damage * (1 + state.stats.damageBonus + weapon.level * 0.12),
        life: weapon.life + weapon.level * 0.05,
        size: weapon.size * (1 + state.stats.projectileScale),
        color: weapon.color,
        pierce: Math.floor(state.stats.pierceBonus / 2),
        trail: '#ffd6ff',
      });
    }
    playSound('sprinkler');
  }

  function findNearestEnemyInArc(arcWidth) {
    let best = null;
    let bestDist = Infinity;
    for (const enemy of state.enemies) {
      const angle = Math.atan2(enemy.y - state.center.y, enemy.x - state.center.x);
      const diff = Math.abs(normalizeAngle(angle - state.core.angle));
      const d = distSq(enemy.x, enemy.y, state.center.x, state.center.y);
      if (diff < arcWidth && d < bestDist) {
        best = enemy;
        bestDist = d;
      }
    }
    if (best) return best;
    return state.enemies[0] || null;
  }

  function spawnProjectile(projectile) {
    state.projectiles.push(projectile);
  }

  function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
      const p = state.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      state.trails.push({ type: 'projectile', x: p.x, y: p.y, size: p.size * 1.5, color: p.trail, life: 0.12 });
      let remove = p.life <= 0;
      for (let e = state.enemies.length - 1; e >= 0 && !remove; e -= 1) {
        const enemy = state.enemies[e];
        const radius = enemy.size + p.size;
        if (distSq(p.x, p.y, enemy.x, enemy.y) > radius * radius) continue;
        damageEnemy(enemy, p.damage, Math.atan2(p.vy, p.vx));
        p.pierce -= 1;
        remove = p.pierce < 0;
      }
      if (remove) state.projectiles.splice(i, 1);
    }
  }

  function damageEnemy(enemy, damage, angle) {
    enemy.hp -= damage;
    enemy.hitFlash = 0.14;
    createImpact(enemy.x, enemy.y, enemy.color, 10, 1.6);
    playSound('hit');
    if (enemy.hp <= 0) killEnemy(enemy, angle);
  }

  function killEnemy(enemy, angle) {
    const index = state.enemies.indexOf(enemy);
    if (index >= 0) state.enemies.splice(index, 1);
    state.stats.kills += 1;
    state.stats.score += enemy.reward * 4;
    state.stats.money += enemy.reward;
    state.screenShake = Math.max(state.screenShake, enemy.type === 'tank' ? 10 : 5);
    createImpact(enemy.x, enemy.y, enemy.color, enemy.type === 'tank' ? 32 : 20, 3.2);
    if (enemy.type === 'zigzag') {
      for (let i = 0; i < 2; i += 1) {
        const split = createEnemy('fast');
        split.x = enemy.x + Math.cos(angle + i) * 18;
        split.y = enemy.y + Math.sin(angle + i) * 18;
        split.hp *= 0.6;
        split.maxHp = split.hp;
        split.size *= 0.8;
        state.enemies.push(split);
      }
    }
    playSound('explode');
  }

  function updateEnemies(dt) {
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      enemy.pulse += dt * 3.4;
      enemy.wiggle += dt * (enemy.type === 'zigzag' ? 5.5 : 2.1);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      const dx = state.center.x - enemy.x;
      const dy = state.center.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      const nx = dx / distance;
      const ny = dy / distance;
      let moveX = nx;
      let moveY = ny;
      if (enemy.type === 'zigzag') {
        moveX += -ny * Math.sin(enemy.wiggle) * 0.75;
        moveY += nx * Math.sin(enemy.wiggle) * 0.75;
      }
      const len = Math.hypot(moveX, moveY) || 1;
      enemy.x += (moveX / len) * enemy.speed * dt;
      enemy.y += (moveY / len) * enemy.speed * dt;
      if (distance < enemy.size + 24) {
        state.enemies.splice(i, 1);
        hitCore(enemy.damage);
      }
    }
  }

  function hitCore(damage) {
    let remaining = damage;
    if (state.core.shield > 0) {
      const absorbed = Math.min(state.core.shield, remaining);
      state.core.shield -= absorbed;
      remaining -= absorbed;
    }
    state.core.hp = Math.max(0, state.core.hp - remaining);
    state.core.hitFlash = 0.35;
    state.screenShake = Math.max(state.screenShake, 14);
    createImpact(state.center.x, state.center.y, '#ffffff', 26, 3.8);
    playSound('hurt');
    if (state.core.hp <= 0) triggerGameOver();
  }

  function triggerGameOver() {
    state.gameOver = true;
    state.wave.active = false;
    state.inShop = false;
    ui.overlays.shop.hidden = true;
    ui.overlays.pause.hidden = true;
    ui.overlays.gameOver.hidden = false;
    state.bestScore = Math.max(state.bestScore, state.stats.score);
    localStorage.setItem(STORAGE.best, String(state.bestScore));
    savePersistentUnlocks();
    ui.finalScore.textContent = state.stats.score;
    ui.finalWave.textContent = Math.max(1, state.stats.wave);
    ui.finalKills.textContent = state.stats.kills;
    ui.finalBest.textContent = state.bestScore;
    ui.waveState.textContent = 'Core destroyed';
    playSound('over');
  }

  function updateCore(dt) {
    state.core.hitFlash = Math.max(0, state.core.hitFlash - dt);
    if (state.core.shieldTimer > 0) state.core.shieldTimer -= dt;
    else state.core.shield = Math.max(0, state.core.shield - dt * 4);
    state.screenShake = Math.max(0, state.screenShake - dt * 18);
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function updateTrails(dt) {
    for (let i = state.trails.length - 1; i >= 0; i -= 1) {
      state.trails[i].life -= dt;
      if (state.trails[i].life <= 0) state.trails.splice(i, 1);
    }
  }

  function updateRings(dt) {
    for (const ring of state.rings) ring.pulse += dt * (0.8 + ring.radius * 0.0008);
  }

  function createImpact(x, y, color, amount, speed) {
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * TWO_PI;
      const velocity = (0.3 + Math.random()) * 110 * speed;
      state.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: 0.25 + Math.random() * 0.45, size: 2 + Math.random() * 4, color });
    }
  }

  function updateHud() {
    ui.health.textContent = `${Math.ceil(state.core.hp)}${state.core.shield > 0 ? ` +${Math.ceil(state.core.shield)}` : ''}`;
    ui.money.textContent = state.stats.money;
    ui.wave.textContent = state.stats.wave;
    ui.score.textContent = state.stats.score;
    ui.kills.textContent = state.stats.kills;
    ui.bestScore.textContent = `Best ${state.bestScore}`;
    ui.weapons.textContent = `Gun Lv${state.weapons.gun.level} · Laser ${state.weapons.laser.unlocked ? `Lv${state.weapons.laser.level}` : 'Locked'} · Sprinkler ${state.weapons.sprinkler.unlocked ? `Lv${state.weapons.sprinkler.level}` : 'Locked'}`;
    if (state.inShop) renderShop();
  }

  function render() {
    ctx.save();
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, state.width, state.height);

    const shakeX = (Math.random() - 0.5) * state.screenShake;
    const shakeY = (Math.random() - 0.5) * state.screenShake;
    ctx.translate(shakeX, shakeY);

    drawBackground();
    drawTunnel();
    drawTrails();
    drawProjectiles();
    drawEnemies();
    drawCore();
    drawParticles();
    ctx.restore();
  }

  function drawBackground() {
    const g = ctx.createRadialGradient(state.center.x, state.center.y, 60, state.center.x, state.center.y, Math.max(state.width, state.height) * 0.7);
    g.addColorStop(0, '#3b0919');
    g.addColorStop(0.35, '#1c0410');
    g.addColorStop(1, '#060006');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 131.7 + state.time * 12) % (state.width + 60);
      const y = (i * 87.3) % (state.height + 40);
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function drawTunnel() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ring of state.rings) {
      const pulse = 1 + Math.sin(state.time * 1.3 + ring.pulse) * 0.04;
      const radius = ring.radius * pulse;
      ctx.beginPath();
      for (let i = 0; i <= ring.points; i += 1) {
        const index = i % ring.points;
        const angle = (index / ring.points) * TWO_PI + state.time * ring.spin;
        const wobble = ring.offsets[index] * (1 + Math.sin(state.time * 1.2 + index * 0.7) * 0.05);
        const x = state.center.x + Math.cos(angle) * radius * wobble;
        const y = state.center.y + Math.sin(angle) * radius * wobble;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const alpha = Math.max(0.14, 0.42 - ring.radius * 0.00045);
      ctx.strokeStyle = `rgba(255, 87, 191, ${alpha})`;
      ctx.lineWidth = Math.max(1.6, 4.4 - ring.radius * 0.005);
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#ff62c9';
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.42})`;
      ctx.lineWidth = Math.max(0.6, 1.3 - ring.radius * 0.001);
      ctx.shadowBlur = 10;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCore() {
    const pulse = 1 + Math.sin(state.time * 2.5) * 0.04;
    ctx.save();
    ctx.translate(state.center.x, state.center.y);
    ctx.rotate(state.core.angle);
    ctx.globalCompositeOperation = 'lighter';

    ctx.beginPath();
    ctx.arc(0, 0, 30 * pulse, 0, TWO_PI);
    ctx.fillStyle = state.core.hitFlash > 0 ? '#fff2f8' : '#ffd6f1';
    ctx.shadowBlur = 28;
    ctx.shadowColor = state.core.hitFlash > 0 ? '#ffffff' : '#ff66c8';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(12, -10);
    ctx.lineTo(48, 0);
    ctx.lineTo(12, 10);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#d07cff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TWO_PI);
    ctx.fillStyle = '#44091f';
    ctx.fill();
    ctx.restore();

    if (state.core.shield > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(state.center.x, state.center.y, 44 + Math.sin(state.time * 4) * 2, 0, TWO_PI);
      ctx.strokeStyle = `rgba(198,132,255,${0.32 + state.core.shield / 220})`;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#bb83ff';
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemies() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const enemy of state.enemies) {
      const pulse = 1 + Math.sin(enemy.pulse) * 0.08;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.size * pulse, 0, TWO_PI);
      ctx.fillStyle = enemy.hitFlash > 0 ? '#fff' : enemy.color;
      ctx.shadowBlur = enemy.type === 'tank' ? 28 : 20;
      ctx.shadowColor = enemy.color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.size * 0.42, 0, TWO_PI);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();

      const hpWidth = enemy.size * 2.4;
      const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(enemy.x - hpWidth / 2, enemy.y + enemy.size + 10, hpWidth, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(enemy.x - hpWidth / 2, enemy.y + enemy.size + 10, hpWidth * hpRatio, 4);
    }
    ctx.restore();
  }

  function drawProjectiles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 18;
      ctx.shadowColor = p.color;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTrails() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const trail of state.trails) {
      if (trail.type === 'laser') {
        const alpha = trail.life / 0.13;
        const x2 = state.center.x + Math.cos(trail.angle) * trail.range;
        const y2 = state.center.y + Math.sin(trail.angle) * trail.range;
        ctx.strokeStyle = `rgba(212,122,255,${alpha})`;
        ctx.lineWidth = trail.width + 4;
        ctx.shadowBlur = 30;
        ctx.shadowColor = trail.color;
        ctx.beginPath();
        ctx.moveTo(state.center.x, state.center.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
        ctx.lineWidth = Math.max(2, trail.width * 0.45);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.size, 0, TWO_PI);
        ctx.fillStyle = withAlpha(trail.color, trail.life / 0.12 * 0.4);
        ctx.shadowBlur = 12;
        ctx.shadowColor = trail.color;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 1.6);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function lerpAngle(a, b, t) {
    return a + normalizeAngle(b - a) * t;
  }

  function normalizeAngle(a) {
    while (a > Math.PI) a -= TWO_PI;
    while (a < -Math.PI) a += TWO_PI;
    return a;
  }

  function distSq(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
  }

  function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    return Math.hypot(px - x, py - y);
  }

  function withAlpha(color, alpha) {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    }
    return color;
  }

  setup();
})();
