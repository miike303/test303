import { LEVELS, TOTAL_PAR } from './levels.js';
import { AudioSystem } from './audio.js';
import { EffectsSystem } from './effects.js';
import { Renderer } from './renderer.js';
import { InputSystem } from './input.js';
import { loadProgress, resetProgress, saveProgress } from './storage.js';
import {
  BALL_RADIUS,
  STOP_SPEED,
  applyBounce,
  clamp,
  distance,
  getMedal,
  getScoreLabel,
  getSurfaceFriction,
  inHazard,
  moveObstacle,
  portalTransfer,
  rectCollision,
  rotateArms,
  segmentCollision,
} from './physics.js';
import { UI } from './ui.js';

const MAX_POWER = 780;
const BASE_FRICTION = 0.985;
const WALL_DAMPING = 0.84;
const HOLE_CAPTURE_SPEED = 120;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.levels = LEVELS;
    this.progress = loadProgress();
    this.audio = new AudioSystem();
    this.audio.setMuted(this.progress.mute);
    this.effects = new EffectsSystem();
    this.renderer = new Renderer(canvas, this.effects);
    this.ui = new UI(this);
    this.input = new InputSystem(canvas, this);

    this.state = 'menu';
    this.mode = 'campaign';
    this.currentHoleIndex = 0;
    this.level = null;
    this.ball = { x: 0, y: 0, vx: 0, vy: 0 };
    this.lastSafeSpot = { x: 0, y: 0 };
    this.strokes = 0;
    this.campaignStrokes = 0;
    this.campaignCompletedStrokes = 0;
    this.time = 0;
    this.aimPreview = null;
    this.portalCooldown = 0;
    this.pendingComplete = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  init() {
    this.ui.showScreen('mainMenu');
    this.ui.showHUD(false);
    this.ui.updateHUD(this);
    this.ui.renderCourseGrid(this);
    window.addEventListener('resize', () => this.renderer.resize());
  }

  handleAction(action) {
    this.audio.ui();
    if (action === 'play-campaign') return this.startCampaign();
    if (action === 'quick-play') return this.startHole(0, 'quick');
    if (action === 'practice') return this.startHole(this.currentHoleIndex, 'practice');
    if (action === 'course-select') return this.openCourseSelect();
    if (action === 'back-to-menu') return this.openMenu();
    if (action === 'resume') return this.resume();
    if (action === 'restart-hole') return this.restartHole();
    if (action === 'replay-hole') return this.restartHole();
    if (action === 'replay-campaign') return this.startCampaign(true);
    if (action === 'reset-progress') return this.confirmReset();
  }

  openMenu() {
    this.state = 'menu';
    this.ui.showScreen('mainMenu');
    this.ui.showHUD(false);
    this.ui.updateHUD(this);
  }

  openCourseSelect() {
    this.state = 'course-select';
    this.ui.renderCourseGrid(this);
    this.ui.showScreen('courseSelect');
    this.ui.showHUD(false);
  }

  startCampaign(resetRun = false) {
    this.mode = 'campaign';
    if (resetRun || this.state === 'menu' || this.state === 'course-select') {
      this.campaignStrokes = 0;
      this.campaignCompletedStrokes = 0;
    }
    this.startHole(0, 'campaign');
  }

  startHole(index, sourceMode = 'campaign') {
    this.mode = sourceMode;
    this.currentHoleIndex = clamp(index, 0, this.levels.length - 1);
    this.level = structuredClone(this.levels[this.currentHoleIndex]);
    this.ball.x = this.level.tee.x;
    this.ball.y = this.level.tee.y;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.lastSafeSpot = { x: this.ball.x, y: this.ball.y };
    this.strokes = 0;
    this.state = 'playing';
    this.pendingComplete = 0;
    this.aimPreview = null;
    this.ui.showScreen('');
    this.ui.showHUD(true);
    this.ui.updateHUD(this);
    this.progress.lastMode = sourceMode;
    saveProgress(this.progress);
  }

  canAim() {
    return this.state === 'playing' && this.level && this.speed() < STOP_SPEED;
  }

  setAimPreview(vector) {
    if (!this.canAim()) return;
    this.aimPreview = vector;
    this.ui.updateHUD(this);
  }

  clearAimPreview() {
    this.aimPreview = null;
    this.ui.updateHUD(this);
  }

  takeShot(vector) {
    const power = vector.power;
    this.ball.vx = Math.cos(vector.angle) * power * MAX_POWER;
    this.ball.vy = Math.sin(vector.angle) * power * MAX_POWER;
    this.strokes += 1;
    if (this.mode === 'campaign') this.campaignStrokes = this.campaignCompletedStrokes + this.strokes;
    this.audio.hit(power);
    this.effects.burst(this.ball.x, this.ball.y, { count: 16, speed: 100 + power * 120 });
    this.ui.updateHUD(this);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.ui.showScreen('pause');
      this.ui.showHUD(false);
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  resume() {
    if (!this.level) return;
    this.state = 'playing';
    this.ui.showScreen('');
    this.ui.showHUD(true);
  }

  restartHole() {
    if (!this.level) return;
    this.startHole(this.currentHoleIndex, this.mode);
  }

  toggleMute() {
    this.progress.mute = !this.progress.mute;
    this.audio.setMuted(this.progress.mute);
    saveProgress(this.progress);
    this.ui.updateHUD(this);
  }

  confirmReset() {
    if (window.confirm('Reset all Pocket Golf Deluxe progress? This cannot be undone.')) {
      this.progress = resetProgress();
      this.audio.setMuted(this.progress.mute);
      this.ui.renderCourseGrid(this);
      this.ui.updateHUD(this);
      this.ui.showToast('Progress reset. Fresh fairways await.');
    }
  }

  speed() {
    return Math.hypot(this.ball.vx, this.ball.vy);
  }

  predictShotPath() {
    if (!this.aimPreview) return [];
    const points = [];
    const sim = { x: this.ball.x, y: this.ball.y, vx: Math.cos(this.aimPreview.angle) * this.aimPreview.power * 420, vy: Math.sin(this.aimPreview.angle) * this.aimPreview.power * 420 };
    for (let i = 0; i < 38; i += 1) {
      sim.x += sim.vx * 0.03;
      sim.y += sim.vy * 0.03;
      sim.vx *= 0.98;
      sim.vy *= 0.98;
      for (const wall of this.level.walls || []) {
        const hit = segmentCollision(sim, wall);
        if (hit) applyBounce(sim, hit.normal, 0.78);
      }
      points.push({ x: sim.x, y: sim.y });
      if (points.length > 1 && i % 14 === 0 && points.length > 28) break;
    }
    return points;
  }

  update(dt) {
    this.time += dt;
    this.effects.update(dt);
    if (this.portalCooldown > 0) this.portalCooldown -= dt;
    if (this.pendingComplete > 0) {
      this.pendingComplete -= dt;
      if (this.pendingComplete <= 0) this.finishHole();
    }
    if (this.state !== 'playing' || !this.level) return;

    this.stepBall(dt);
    this.ui.updateHUD(this);
  }

  stepBall(dt) {
    if (this.speed() > 40) this.effects.trail(this.ball.x, this.ball.y);
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    const friction = getSurfaceFriction(this.level, this.ball);
    const frictionDecay = Math.pow(BASE_FRICTION, dt * 60 * friction);
    this.ball.vx *= frictionDecay;
    this.ball.vy *= frictionDecay;

    this.resolveBounds();
    this.resolveWalls();
    this.resolveDynamicObstacles();
    this.resolveBoosts();
    this.resolvePortals();
    this.resolveHazards();
    this.resolveHole();

    if (this.speed() < STOP_SPEED) {
      this.ball.vx = 0;
      this.ball.vy = 0;
      if (!inHazard(this.level, this.ball, 'water')) this.lastSafeSpot = { x: this.ball.x, y: this.ball.y };
    }
  }

  resolveBounds() {
    const minX = 42;
    const minY = 42;
    const maxX = this.level.size.width - 42;
    const maxY = this.level.size.height - 42;
    if (this.ball.x < minX || this.ball.x > maxX) {
      this.ball.x = clamp(this.ball.x, minX, maxX);
      const hit = Math.abs(this.ball.vx);
      this.ball.vx *= -WALL_DAMPING;
      if (hit > 40) this.onImpact(hit / 220);
    }
    if (this.ball.y < minY || this.ball.y > maxY) {
      this.ball.y = clamp(this.ball.y, minY, maxY);
      const hit = Math.abs(this.ball.vy);
      this.ball.vy *= -WALL_DAMPING;
      if (hit > 40) this.onImpact(hit / 220);
    }
  }

  resolveWalls() {
    for (const wall of this.level.walls || []) {
      const collision = segmentCollision(this.ball, wall);
      if (!collision) continue;
      this.ball.x += collision.normal.x * collision.penetration;
      this.ball.y += collision.normal.y * collision.penetration;
      const impact = applyBounce(this.ball, collision.normal, WALL_DAMPING);
      if (impact > 20) this.onImpact(impact / 260);
    }
  }

  resolveDynamicObstacles() {
    for (const mover of this.level.movers || []) {
      const rect = moveObstacle(mover, this.time);
      const collision = rectCollision(this.ball, { x: rect.x - rect.width / 2, y: rect.y - rect.height / 2, width: rect.width, height: rect.height });
      if (!collision) continue;
      this.ball.x += collision.normal.x * collision.penetration;
      this.ball.y += collision.normal.y * collision.penetration;
      const impact = applyBounce(this.ball, collision.normal, 0.88);
      if (impact > 10) this.onImpact(impact / 220);
    }

    for (const rotator of this.level.rotators || []) {
      const angle = rotateArms(rotator, this.time);
      const arms = [angle, angle + Math.PI / 2];
      for (const armAngle of arms) {
        const segment = {
          a: { x: rotator.x - Math.cos(armAngle) * rotator.armLength, y: rotator.y - Math.sin(armAngle) * rotator.armLength },
          b: { x: rotator.x + Math.cos(armAngle) * rotator.armLength, y: rotator.y + Math.sin(armAngle) * rotator.armLength },
        };
        const collision = segmentCollision(this.ball, segment);
        if (!collision) continue;
        this.ball.x += collision.normal.x * collision.penetration;
        this.ball.y += collision.normal.y * collision.penetration;
        const impact = applyBounce(this.ball, collision.normal, 0.9);
        if (impact > 8) this.onImpact(impact / 220);
      }
    }
  }

  resolveBoosts() {
    for (const pad of this.level.boostPads || []) {
      if (distance(this.ball, pad) < pad.radius + BALL_RADIUS) {
        this.ball.vx += Math.cos(pad.angle) * pad.force * 0.02;
        this.ball.vy += Math.sin(pad.angle) * pad.force * 0.02;
      }
    }
  }

  resolvePortals() {
    if (this.portalCooldown > 0) return;
    for (const portal of this.level.portals || []) {
      const destination = portalTransfer(this.ball, portal);
      if (destination) {
        this.ball.x = destination.x;
        this.ball.y = destination.y;
        this.portalCooldown = 0.6;
        this.effects.burst(this.ball.x, this.ball.y, { count: 22, palette: ['#ffffff', '#d3b7ff', '#ffb5dd'], speed: 140 });
        break;
      }
    }
  }

  resolveHazards() {
    if (inHazard(this.level, this.ball, 'water')) {
      this.ball.x = this.lastSafeSpot.x;
      this.ball.y = this.lastSafeSpot.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.strokes += 1;
      if (this.mode === 'campaign') this.campaignStrokes = this.campaignCompletedStrokes + this.strokes;
      this.audio.splash();
      this.effects.burst(this.ball.x, this.ball.y, { count: 18, palette: ['#8dd2ff', '#d8f8ff'], speed: 90 });
      this.ui.showToast('Splash! +1 stroke penalty.');
    }
  }

  resolveHole() {
    const hole = this.level.hole;
    const dist = distance(this.ball, hole);
    if (dist < 18 && this.speed() < HOLE_CAPTURE_SPEED && this.pendingComplete <= 0) {
      this.ball.vx *= 0.8;
      this.ball.vy *= 0.8;
      this.ball.x += (hole.x - this.ball.x) * 0.16;
      this.ball.y += (hole.y - this.ball.y) * 0.16;
      if (dist < 6 && this.speed() < 28) {
        this.pendingComplete = this.reducedMotion ? 0.2 : 0.7;
        this.state = 'transition';
        this.audio.success();
        this.effects.burst(hole.x, hole.y, { count: 36, palette: ['#ffffff', '#9cf8a2', '#ffe183', '#ff9cc7'], speed: 190 });
      }
    }
  }

  onImpact(intensity) {
    this.audio.wall(intensity);
    this.effects.shake(clamp(intensity * 10, 1.6, 6));
    this.effects.burst(this.ball.x, this.ball.y, { count: 6, speed: 70 });
  }

  finishHole() {
    const diff = this.strokes - this.level.par;
    const title = this.strokes === 1 ? 'Hole in One!' : getScoreLabel(diff);
    const medal = getMedal(this.level.par, this.strokes);

    this.progress.unlockedHoles = Math.max(this.progress.unlockedHoles, Math.min(this.levels.length, this.currentHoleIndex + 2));
    const previousBest = this.progress.bestStrokes[this.level.id];
    if (!previousBest || this.strokes < previousBest) this.progress.bestStrokes[this.level.id] = this.strokes;
    this.progress.medals[this.level.id] = medal;
    this.progress.completed[this.level.id] = true;
    saveProgress(this.progress);
    this.ui.renderCourseGrid(this);

    const hasNext = this.currentHoleIndex < this.levels.length - 1;
    if (this.mode === 'campaign') {
      this.campaignCompletedStrokes += this.strokes;
      this.campaignStrokes = this.campaignCompletedStrokes;
    }
    this.ui.fillHoleComplete({
      title,
      summary: `You finished ${this.level.name} in ${this.strokes} stroke${this.strokes === 1 ? '' : 's'}.`,
      strokes: this.strokes,
      score: diff,
      medal,
      hasNext,
    });

    if (this.mode === 'campaign' && !hasNext) {
      const medalCounts = Object.values(this.progress.medals).reduce((acc, medalName) => {
        acc[medalName] = (acc[medalName] || 0) + 1;
        return acc;
      }, {});
      this.ui.fillCampaignComplete(this, this.campaignStrokes - TOTAL_PAR, medalCounts);
      this.state = 'campaign-complete';
      this.ui.showHUD(false);
      this.ui.showScreen('campaignComplete');
      return;
    }

    this.state = 'hole-complete';
    this.ui.showHUD(false);
    this.ui.showScreen('holeComplete');
  }

  nextHole() {
    if (this.state === 'hole-complete' || this.state === 'campaign-complete' || this.state === 'playing') {
      const nextIndex = this.currentHoleIndex + 1;
      if (nextIndex >= this.levels.length) {
        this.openMenu();
        return;
      }
      this.startHole(nextIndex, this.mode === 'select' ? 'select' : this.mode);
    }
  }
}
