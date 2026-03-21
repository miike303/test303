import { BIOMES, COSMETICS, GAME_HEIGHT, GAME_WIDTH, POWERUPS, SHAFT_WIDTH } from './config.js';
import { AudioSystem } from './audio.js';
import { EffectsSystem } from './effects.js';
import { Generator } from './generator.js';
import { InputSystem } from './input.js';
import { MissionsSystem } from './missions.js';
import { Player } from './player.js';
import { circleRectCollision, circleSegmentCollision, clamp, distance } from './physics.js';
import { Renderer } from './renderer.js';
import { ShopSystem } from './shop.js';
import { defaultSave, loadSave, persistSave, resetSave } from './storage.js';
import { UI } from './ui.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.save = loadSave();
    this.audio = new AudioSystem();
    this.audio.setMuted(this.save.settings.audioMuted);
    this.effects = new EffectsSystem();
    this.renderer = new Renderer(canvas, this.effects);
    this.generator = new Generator();
    this.player = new Player();
    this.input = new InputSystem(this);
    this.ui = new UI(this);
    this.missions = new MissionsSystem(this.save);
    this.shop = new ShopSystem(this.save);
    this.powerDefs = POWERUPS;
    this.state = { screen: 'title', paused: false, event: null };
    this.lastRun = null;
    this.resetRun();
  }

  init() {
    this.ui.renderStatic();
    if (!this.save.settings.tutorialSeen) this.ui.showTutorial(true);
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('orientationchange', () => this.handleResize());
  }

  handleResize() {
    this.renderer.resize();
    this.ui.showRotate(window.innerWidth > window.innerHeight);
  }

  get biome() { return this.generator.biomeFor(this.distance); }
  get selectedSkin() { return COSMETICS.skins.find((item) => item.id === this.save.selected.skin) || COSMETICS.skins[0]; }
  get selectedTrail() { return COSMETICS.trails.find((item) => item.id === this.save.selected.trail) || COSMETICS.trails[0]; }
  get selectedAura() { return COSMETICS.auras.find((item) => item.id === this.save.selected.aura) || COSMETICS.auras[0]; }
  get speedFactor() { return this.cameraSpeed / 210; }

  resetRun() {
    this.player.reset();
    this.time = 0;
    this.distance = 0;
    this.cameraY = 0;
    this.cameraSpeed = 210;
    this.score = 0;
    this.combo = 1;
    this.comboCharge = 0;
    this.bestComboRun = 1;
    this.runCoins = 0;
    this.obstacles = [];
    this.coins = [];
    this.powerups = [];
    this.activePowerups = Object.fromEntries(Object.keys(POWERUPS).map((key) => [key, 0]));
    this.nearMisses = 0;
    this.powerupsUsed = 0;
    this.generator.reset();
    this.state.paused = false;
    this.state.event = null;
    this.generator.generateUntil(this.distance, this);
  }

  startRun(fromTutorial = false) {
    this.save.settings.tutorialSeen = true;
    this.resetRun();
    this.state.screen = 'game';
    this.ui.hideTitle();
    this.ui.showTutorial(false);
    this.ui.showPause(false);
    this.ui.showGameOver(false);
    this.ui.closeModals();
    this.ui.showHUD(true);
    if (fromTutorial) this.effects.text(SHAFT_WIDTH / 2, this.player.y - 80, 'Tap rhythmically to climb', '#6be7ff');
    this.audio.click();
    persistSave(this.save);
  }

  showTitle() {
    this.state.screen = 'title';
    this.ui.closeModals();
    this.ui.showHUD(false);
    this.ui.showPause(false);
    this.ui.showGameOver(false);
    this.ui.showTitle();
    this.ui.renderStatic();
  }

  skipTutorial() {
    this.save.settings.tutorialSeen = true;
    persistSave(this.save);
    this.ui.showTutorial(false);
  }

  togglePause(force) {
    if (this.state.screen !== 'game') return;
    this.state.paused = typeof force === 'boolean' ? !force ? false : true : !this.state.paused;
    this.ui.showPause(this.state.paused);
    this.audio.click();
  }

  toggleSetting(key) {
    this.save.settings[key] = !this.save.settings[key];
    this.audio.setMuted(this.save.settings.audioMuted);
    persistSave(this.save);
    this.ui.renderStatic();
  }

  resetProgress() {
    this.save = resetSave();
    this.audio.setMuted(this.save.settings.audioMuted);
    this.missions = new MissionsSystem(this.save);
    this.shop = new ShopSystem(this.save);
    this.ui.renderStatic();
    this.showTitle();
  }

  handleShop(group, id) {
    this.audio.click();
    if (!this.save.unlocks[group][id]) this.shop.purchase(group, id);
    this.shop.select(group, id);
    persistSave(this.save);
    this.ui.renderStatic();
  }

  claimMission(id) {
    const reward = this.missions.claim(id);
    if (reward) this.effects.text(SHAFT_WIDTH / 2, this.player.y - 120, `+${reward} mission`, '#a7ff7d');
    persistSave(this.save);
    this.ui.renderStatic();
  }

  handleJumpInput() {
    if (this.state.screen === 'title') return this.startRun();
    if (this.state.screen !== 'game' || this.state.paused) return;
    if (this.player.canJump()) {
      this.player.triggerJump(this.activePowerups.slow > 0 ? 0.84 : 1);
      this.comboCharge = Math.min(1, this.comboCharge + 0.18 + (this.activePowerups.combo > 0 ? 0.08 : 0));
      this.audio.jump();
      this.effects.burst(this.player.x, this.player.y, this.selectedTrail.color, this.save.settings.reduceEffects ? 4 : 10, Math.PI, 120);
    }
  }

  update(dt) {
    if (this.state.screen !== 'game' || this.state.paused) return;
    this.time += dt;
    if (this.state.event) {
      this.state.event.elapsed += dt;
      if (this.state.event.elapsed >= this.state.event.duration) this.state.event = null;
    } else if (Math.random() < dt * 0.09) {
      this.state.event = this.generator.maybeEvent(this.distance);
      if (this.state.event) this.effects.text(SHAFT_WIDTH / 2, this.player.y - 150, this.state.event.label, '#ffd36e');
    }

    this.cameraSpeed += dt * 3.2;
    if (this.state.event?.key === 'overdrive') this.cameraSpeed += dt * 24;
    const gravityScale = this.state.event?.key === 'slowGravity' ? 0.68 : 1;
    this.player.update(dt, this.cameraSpeed * (this.activePowerups.slow > 0 ? 0.65 : 1), gravityScale, this.activePowerups.grip > 0);

    this.cameraY = Math.min(this.cameraY, this.player.y - GAME_HEIGHT * 0.66);
    this.distance = Math.max(this.distance, -this.cameraY);
    this.generator.generateUntil(this.distance, this);

    for (const key of Object.keys(this.activePowerups)) this.activePowerups[key] = Math.max(0, this.activePowerups[key] - dt);
    this.score += dt * 18 * this.combo * (this.activePowerups.multiplier > 0 ? 2 : 1);
    this.score += (this.distance / 1200) * dt * 8;

    this.collectCoins(dt);
    this.collectPowerups();
    this.updateObstacles(dt);
    this.cleanupWorld();
    this.effects.trail(this.player.x, this.player.y + 18, this.selectedTrail.color);
    this.effects.update(dt);

    if (this.player.y > this.cameraY + GAME_HEIGHT + 80) this.endRun('Fell behind the climb');
    this.ui.renderHUD();
  }

  collectCoins(dt) {
    const magnet = this.activePowerups.magnet > 0 ? 88 : 24;
    this.coins = this.coins.filter((coin) => {
      const d = distance(this.player, coin);
      if (d < magnet) {
        coin.x += (this.player.x - coin.x) * Math.min(1, dt * 8);
        coin.y += (this.player.y - coin.y) * Math.min(1, dt * 8);
      }
      if (d < this.player.radius + coin.radius + 3) {
        this.runCoins += 1;
        this.score += 16 * this.combo;
        this.audio.coin();
        this.effects.burst(coin.x, coin.y, '#ffd36e', this.save.settings.reduceEffects ? 4 : 8, Math.PI * 2, 100);
        return false;
      }
      return true;
    });
  }

  collectPowerups() {
    this.powerups = this.powerups.filter((power) => {
      if (distance(this.player, power) < this.player.radius + power.radius + 4) {
        this.activePowerups[power.kind] = Math.max(this.activePowerups[power.kind], POWERUPS[power.kind].duration);
        if (power.kind === 'shield') this.player.shield = 1;
        if (power.kind === 'phase') this.player.phaseCharges = 1;
        this.powerupsUsed += 1;
        this.audio.powerup();
        this.effects.text(power.x, power.y - 26, POWERUPS[power.kind].label, POWERUPS[power.kind].color);
        return false;
      }
      return true;
    });
  }

  updateObstacles(dt) {
    const p = { x: this.player.x, y: this.player.y, radius: this.player.radius };
    const now = this.time;
    for (const obstacle of this.obstacles) {
      if (obstacle.spawnedAt == null) obstacle.spawnedAt = now;
      const active = now - obstacle.spawnedAt >= obstacle.activeAfter;
      let hit = false;
      let near = false;
      if (obstacle.type === 'spike') {
        const rect = { x: obstacle.x, y: obstacle.y - obstacle.height / 2, width: obstacle.width, height: obstacle.height };
        hit = active && circleRectCollision(p, rect);
        near = !hit && distance(this.player, { x: rect.x + rect.width / 2, y: obstacle.y }) < 42;
      }
      if (obstacle.type === 'movingSpike') {
        const rect = { x: obstacle.x + Math.sin(now * obstacle.speed) * obstacle.range, y: obstacle.y - obstacle.height / 2, width: obstacle.width, height: obstacle.height };
        hit = active && circleRectCollision(p, rect);
        near = !hit && distance(this.player, { x: rect.x + rect.width / 2, y: obstacle.y }) < 44;
      }
      if (obstacle.type === 'laser') {
        const pulseOn = ((now - obstacle.spawnedAt) % obstacle.pulse) > obstacle.pulse * 0.3;
        hit = active && pulseOn && Math.abs(this.player.y - obstacle.y) < this.player.radius + 4;
        near = !hit && Math.abs(this.player.y - obstacle.y) < 26;
      }
      if (obstacle.type === 'rotatingBar') {
        const angle = obstacle.angle + now * obstacle.speed;
        const segment = { x1: obstacle.x - Math.cos(angle) * obstacle.length, y1: obstacle.y - Math.sin(angle) * obstacle.length, x2: obstacle.x + Math.cos(angle) * obstacle.length, y2: obstacle.y + Math.sin(angle) * obstacle.length, thickness: 10 };
        hit = active && circleSegmentCollision(p, segment);
        near = !hit && Math.min(distance(this.player, { x: segment.x1, y: segment.y1 }), distance(this.player, { x: segment.x2, y: segment.y2 })) < 38;
      }
      if (obstacle.type === 'gate') {
        const inBand = Math.abs(this.player.y - obstacle.y) < this.player.radius + 6;
        const safe = this.player.x > obstacle.gapCenter - obstacle.gapSize / 2 && this.player.x < obstacle.gapCenter + obstacle.gapSize / 2;
        hit = active && inBand && !safe;
        near = !hit && inBand && Math.abs(this.player.x - obstacle.gapCenter) > obstacle.gapSize / 2 - 18;
      }
      if (obstacle.type === 'fakeZone') {
        const wallSide = this.player.x < SHAFT_WIDTH / 2 ? 'left' : 'right';
        hit = active && obstacle.side === wallSide && Math.abs(this.player.y - obstacle.y) < obstacle.height / 2 && !this.player.jump;
      }
      if (obstacle.type === 'collapseGrip') {
        const wallSide = this.player.x < SHAFT_WIDTH / 2 ? 'left' : 'right';
        if (active && obstacle.side === wallSide && Math.abs(this.player.y - obstacle.y) < obstacle.height / 2 && !this.player.jump) {
          this.player.coyote = 0.03;
          this.effects.text(this.player.x, this.player.y - 30, 'Collapse!', '#ffb16d');
        }
      }
      if (obstacle.type === 'drone') {
        obstacle.y += dt * (this.state.event?.key === 'chase' ? 80 : 24);
        hit = active && distance(this.player, obstacle) < this.player.radius + obstacle.radius;
        near = !hit && distance(this.player, obstacle) < 38;
      }

      if (near && !obstacle.nearTriggered) {
        obstacle.nearTriggered = true;
        this.nearMisses += 1;
        this.combo = Math.min(15, this.combo + 0.45);
        this.comboCharge = Math.min(1, this.comboCharge + 0.2);
        this.score += 28 * this.combo;
        this.audio.combo();
        this.effects.text(this.player.x, this.player.y - 24, 'Near Miss', '#ffd36e');
      }

      if (hit) {
        if (this.player.phaseCharges > 0) {
          this.player.phaseCharges = 0;
          this.activePowerups.phase = 0;
          this.player.hitCooldown = 0.25;
          this.effects.text(this.player.x, this.player.y - 30, 'Phase', '#ff8bd0');
        } else if (this.player.shield > 0 || this.activePowerups.shield > 0) {
          this.player.shield = 0;
          this.activePowerups.shield = 0;
          this.effects.addShake(12);
          this.audio.shield();
          this.effects.text(this.player.x, this.player.y - 28, 'Shield Break', '#b8ff8b');
          this.player.hitCooldown = 0.4;
          obstacle.hitConsumed = true;
        } else if (this.player.hitCooldown <= 0) {
          this.endRun('Hit a hazard');
          return;
        }
      }
    }

    this.comboCharge = Math.max(0, this.comboCharge - dt * (this.activePowerups.combo > 0 ? 0.04 : 0.07));
    if (this.comboCharge <= 0 && this.combo > 1) this.combo = Math.max(1, this.combo - dt * 1.4);
    this.bestComboRun = Math.max(this.bestComboRun, this.combo);
  }

  cleanupWorld() {
    const lower = this.cameraY - 220;
    const upper = this.cameraY + GAME_HEIGHT + 220;
    this.obstacles = this.obstacles.filter((item) => item.y > lower - 360 && item.y < upper + 480);
    this.coins = this.coins.filter((item) => item.y > lower - 180 && item.y < upper + 300);
    this.powerups = this.powerups.filter((item) => item.y > lower - 180 && item.y < upper + 320);
  }

  endRun(reason) {
    this.state.screen = 'gameover';
    this.ui.showHUD(false);
    this.ui.showPause(false);
    this.ui.showGameOver(true);
    this.ui.closeModals();
    this.audio.death();
    this.effects.addShake(18);

    const biomeIndex = BIOMES.findIndex((item) => item.name === this.biome.name);
    const coinsEarned = this.runCoins + Math.floor(this.score / 250);
    this.save.totalCoins += coinsEarned;
    this.save.totalRuns += 1;
    this.save.totalDistance += this.distance;
    this.save.stats.nearMisses += this.nearMisses;
    this.save.stats.powerupsUsed += this.powerupsUsed;
    this.save.stats.totalTime += this.time;
    this.save.bestScore = Math.max(this.save.bestScore, this.score);
    this.save.bestHeight = Math.max(this.save.bestHeight, this.distance);

    const run = { score: this.score, height: this.distance, coins: coinsEarned, nearMisses: this.nearMisses, combo: this.bestComboRun, biome: this.biome.name, time: this.time, powerupsUsed: this.powerupsUsed, biomeIndex };
    this.missions.updateFromRun(run);
    persistSave(this.save);
    this.lastRun = run;
    this.ui.renderGameOver(run);
    this.ui.renderStatic();
    document.getElementById('gameOverTitle').textContent = reason;
  }
}
