import { BIOMES, GAME_HEIGHT, GAME_WIDTH, SHAFT_WIDTH, WALL_PADDING } from './config.js';
import { circleRectCollision, circleSegmentCollision, lerp } from './physics.js';

export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = effects;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.clientWidth || window.innerWidth;
    this.height = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = Math.min(this.width / GAME_WIDTH, this.height / GAME_HEIGHT);
  }

  toScreen(x, y, cameraY) {
    const playX = (this.width - SHAFT_WIDTH * this.scale) / 2 + x * this.scale;
    const playY = (y - cameraY) * this.scale;
    return { x: playX, y: playY };
  }

  render(game) {
    const ctx = this.ctx;
    const shake = this.effects.screenShake();
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.translate(shake.x, shake.y);

    const biome = game.biome;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, biome.bg[0]);
    grad.addColorStop(1, biome.bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawParallax(ctx, game);
    this.drawShaft(ctx, game);
    this.drawEntities(ctx, game);
    this.drawEffects(ctx, game.cameraY);
    if (game.state.event?.key === 'blackout') this.drawBlackout(ctx, game);
    ctx.restore();
  }

  drawParallax(ctx, game) {
    for (let i = 0; i < 20; i += 1) {
      const y = ((i * 110 + game.distance * 0.4) % (this.height + 160)) - 80;
      const x = (i % 2 ? 0.18 : 0.82) * this.width + Math.sin(i + game.time) * 16;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.045)' : 'rgba(108, 231, 255, .05)';
      ctx.beginPath();
      ctx.arc(x, y, 18 + (i % 4) * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawShaft(ctx, game) {
    const shaftLeft = (this.width - SHAFT_WIDTH * this.scale) / 2;
    const shaftRight = shaftLeft + SHAFT_WIDTH * this.scale;
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(shaftLeft, 0, SHAFT_WIDTH * this.scale, this.height);

    const wallGlow = ctx.createLinearGradient(shaftLeft, 0, shaftRight, 0);
    wallGlow.addColorStop(0, `${game.biome.colors[0]}55`);
    wallGlow.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    wallGlow.addColorStop(1, `${game.biome.colors[1]}55`);
    ctx.fillStyle = wallGlow;
    ctx.fillRect(shaftLeft, 0, SHAFT_WIDTH * this.scale, this.height);

    [WALL_PADDING * this.scale, (SHAFT_WIDTH - WALL_PADDING) * this.scale].forEach((offset) => {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(shaftLeft + offset - 4, 0, 8, this.height);
    });
  }

  drawEntities(ctx, game) {
    const cameraY = game.cameraY;
    for (const coin of game.coins) {
      const { x, y } = this.toScreen(coin.x, coin.y + Math.sin(game.time * 6 + coin.bob) * 4, cameraY);
      if (y < -40 || y > this.height + 40) continue;
      ctx.fillStyle = '#ffd36e';
      ctx.shadowColor = '#ffd36e';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(x, y, coin.radius * this.scale, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const power of game.powerups) {
      const { x, y } = this.toScreen(power.x, power.y + Math.sin(game.time * 4 + power.bob) * 6, cameraY);
      if (y < -40 || y > this.height + 40) continue;
      ctx.strokeStyle = game.powerDefs[power.kind].color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, power.radius * this.scale, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `${game.powerDefs[power.kind].color}55`;
      ctx.beginPath(); ctx.arc(x, y, power.radius * this.scale * 0.62, 0, Math.PI * 2); ctx.fill();
    }

    for (const obstacle of game.obstacles) this.drawObstacle(ctx, obstacle, game);

    const p = game.player;
    const s = this.toScreen(p.x, p.y, cameraY);
    const skin = game.selectedSkin;
    const aura = game.selectedAura;
    ctx.save();
    ctx.shadowColor = aura.color;
    ctx.shadowBlur = 25;
    ctx.strokeStyle = aura.color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, (p.radius + 9 + Math.sin(game.time * 8) * 2) * this.scale, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = skin.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, p.radius * this.scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x - 3 * this.scale, s.y - 4 * this.scale, 3.2 * this.scale, 0, Math.PI * 2); ctx.fill();
    if (game.activePowerups.shield) {
      ctx.strokeStyle = '#b8ff8b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, (p.radius + 7) * this.scale, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  drawObstacle(ctx, obstacle, game) {
    const t = obstacle.spawnedAt == null ? 0 : game.time - obstacle.spawnedAt;
    const danger = t >= obstacle.activeAfter;
    const alpha = Math.min(1, t / Math.max(0.1, obstacle.telegraph));
    const color = danger ? game.biome.hazard : 'rgba(255,255,255,0.35)';
    const pulse = 0.6 + Math.sin(game.time * 10 + obstacle.y * 0.01) * 0.2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = danger ? color : 'rgba(255,255,255,0.12)';
    ctx.shadowColor = color;
    ctx.shadowBlur = danger ? 18 : 8;

    const y = this.toScreen(0, obstacle.y, game.cameraY).y;
    if (y < -120 || y > this.height + 120) { ctx.restore(); return; }
    const shaftLeft = (this.width - SHAFT_WIDTH * this.scale) / 2;

    if (obstacle.type === 'spike') {
      const x = shaftLeft + obstacle.x * this.scale;
      const w = obstacle.width * this.scale;
      const h = obstacle.height * this.scale;
      ctx.beginPath();
      if (obstacle.side === 'left') {
        ctx.moveTo(x, y); ctx.lineTo(x + w, y - h / 2); ctx.lineTo(x + w, y + h / 2);
      } else {
        ctx.moveTo(x + w, y); ctx.lineTo(x, y - h / 2); ctx.lineTo(x, y + h / 2);
      }
      ctx.closePath(); ctx.fill();
    } else if (obstacle.type === 'movingSpike') {
      const x = shaftLeft + (obstacle.x + Math.sin(game.time * obstacle.speed) * obstacle.range) * this.scale;
      ctx.fillRect(x, y - obstacle.height * this.scale / 2, obstacle.width * this.scale, obstacle.height * this.scale);
    } else if (obstacle.type === 'laser') {
      const on = ((game.time - obstacle.spawnedAt) % obstacle.pulse) > obstacle.pulse * 0.3;
      if (danger && on) ctx.globalAlpha = 1;
      ctx.lineWidth = (danger && on ? 6 : 2) * this.scale;
      const left = shaftLeft + obstacle.x1 * this.scale;
      const right = shaftLeft + obstacle.x2 * this.scale;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    } else if (obstacle.type === 'rotatingBar') {
      const center = this.toScreen(obstacle.x, obstacle.y, game.cameraY);
      const angle = obstacle.angle + game.time * obstacle.speed;
      const len = obstacle.length * this.scale;
      ctx.lineWidth = 10 * this.scale;
      ctx.beginPath();
      ctx.moveTo(center.x - Math.cos(angle) * len, center.y - Math.sin(angle) * len);
      ctx.lineTo(center.x + Math.cos(angle) * len, center.y + Math.sin(angle) * len);
      ctx.stroke();
    } else if (obstacle.type === 'gate') {
      const gapStart = obstacle.gapCenter - obstacle.gapSize / 2;
      const gapEnd = obstacle.gapCenter + obstacle.gapSize / 2;
      ctx.fillRect(shaftLeft + WALL_PADDING * this.scale, y - 8, (gapStart - WALL_PADDING) * this.scale, 16);
      ctx.fillRect(shaftLeft + gapEnd * this.scale, y - 8, (SHAFT_WIDTH - WALL_PADDING - gapEnd) * this.scale, 16);
    } else if (obstacle.type === 'fakeZone' || obstacle.type === 'collapseGrip') {
      const x = obstacle.side === 'left' ? shaftLeft + (WALL_PADDING - 10) * this.scale : shaftLeft + (SHAFT_WIDTH - WALL_PADDING - 16) * this.scale;
      ctx.fillRect(x, y - obstacle.height * this.scale / 2, 26 * this.scale, obstacle.height * this.scale);
    } else if (obstacle.type === 'drone') {
      const targetX = lerp(obstacle.x, game.player.x, 0.03 * obstacle.speed);
      obstacle.x = targetX;
      const pos = this.toScreen(obstacle.x, obstacle.y, game.cameraY);
      ctx.beginPath(); ctx.arc(pos.x, pos.y, obstacle.radius * this.scale, 0, Math.PI * 2); ctx.fill();
    }
    if (!danger) {
      ctx.globalAlpha = pulse * 0.8;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.strokeRect(shaftLeft + 40 * this.scale, y - 20, (SHAFT_WIDTH - 80) * this.scale, 40);
    }
    ctx.restore();
  }

  drawEffects(ctx, cameraY) {
    for (const p of this.effects.particles) {
      const s = this.toScreen(p.x, p.y, cameraY);
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, p.size * this.scale, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const text of this.effects.floatingTexts) {
      const s = this.toScreen(text.x, text.y, cameraY);
      ctx.globalAlpha = text.life / text.maxLife;
      ctx.fillStyle = text.color;
      ctx.font = '700 16px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(text.label, s.x, s.y);
    }
    ctx.globalAlpha = 1;
  }

  drawBlackout(ctx, game) {
    const p = this.toScreen(game.player.x, game.player.y, game.cameraY);
    const mask = ctx.createRadialGradient(p.x, p.y, 30, p.x, p.y, 170);
    mask.addColorStop(0, 'rgba(0,0,0,0)');
    mask.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, this.width, this.height);
  }
}
