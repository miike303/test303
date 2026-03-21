import { BALL_RADIUS, clamp, moveObstacle, rotateArms, shapeContains } from './physics.js';

export class Renderer {
  constructor(canvas, effects) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effects = effects;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.targetCamera = { x: 0, y: 0, zoom: 1 };
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setCamera(level, ball, dt) {
    const padding = 90;
    const zoom = Math.min((this.width - padding) / level.size.width, (this.height - padding) / level.size.height);
    this.targetCamera.zoom = clamp(zoom, 0.55, 1.15);
    this.targetCamera.x = ball.x;
    this.targetCamera.y = ball.y;
    const ease = 1 - Math.exp(-dt * 3.2);
    this.camera.x += (this.targetCamera.x - this.camera.x) * ease;
    this.camera.y += (this.targetCamera.y - this.camera.y) * ease;
    this.camera.zoom += (this.targetCamera.zoom - this.camera.zoom) * ease;
  }

  worldToScreen(x, y) {
    const zoom = this.camera.zoom;
    return {
      x: (x - this.camera.x) * zoom + this.width / 2,
      y: (y - this.camera.y) * zoom + this.height / 2,
    };
  }

  screenToWorld(x, y) {
    const zoom = this.camera.zoom;
    return {
      x: (x - this.width / 2) / zoom + this.camera.x,
      y: (y - this.height / 2) / zoom + this.camera.y,
    };
  }

  render(game, dt) {
    const { ctx } = this;
    const { level, ball } = game;
    if (!level) return;

    this.setCamera(level, ball, dt);
    const shake = this.effects.getShakeOffset();
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.translate(shake.x, shake.y);

    this.drawBackground(ctx, game.time);
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.drawCourse(ctx, level, game.time);
    this.drawAimGuide(ctx, game);
    this.drawBall(ctx, ball);
    this.drawEffects(ctx);
    ctx.restore();
    ctx.restore();
  }

  drawBackground(ctx, time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#11251a');
    gradient.addColorStop(1, '#061009');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    for (let i = 0; i < 8; i += 1) {
      const x = ((i * 170 + time * 8) % (this.width + 220)) - 110;
      const y = 70 + i * 85;
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.beginPath();
      ctx.arc(x, y, 38 + (i % 3) * 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCourse(ctx, level, time) {
    const bounds = { x: 30, y: 30, width: level.size.width - 60, height: level.size.height - 60 };
    ctx.fillStyle = '#183322';
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 24;
    this.pathRoundedRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, 58);
    ctx.fill();
    ctx.stroke();

    this.drawZones(ctx, level.fairway, '#4e9d5a', '#8ed48d');
    this.drawZones(ctx, level.rough, '#2b5e36', '#2a5232');
    this.drawZones(ctx, level.sand, '#dbc684', '#f8e8b8');
    this.drawZones(ctx, level.water, '#1c6fa3', '#69b7e6');
    this.drawZones(ctx, level.sticky, '#375438', '#456c46');

    for (const pad of level.boostPads || []) {
      const pulse = 0.12 + Math.sin(time * 4 + pad.x * 0.01) * 0.08;
      const gradient = ctx.createRadialGradient(pad.x, pad.y, 8, pad.x, pad.y, pad.radius + 12);
      gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(0.4, 'rgba(149, 255, 181, 0.85)');
      gradient.addColorStop(1, 'rgba(87, 209, 124, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, pad.radius + pulse * 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineCap = 'round';
    for (const wall of level.walls || []) {
      ctx.strokeStyle = '#e5f2de';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(wall.a.x, wall.a.y);
      ctx.lineTo(wall.b.x, wall.b.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(75, 49, 17, 0.72)';
      ctx.lineWidth = 9;
      ctx.stroke();
    }

    for (const mover of level.movers || []) {
      const rect = moveObstacle(mover, time);
      this.drawBlocker(ctx, rect.x, rect.y, rect.width, rect.height, '#a5b8bf');
    }

    for (const rotator of level.rotators || []) {
      const angle = rotateArms(rotator, time);
      ctx.save();
      ctx.translate(rotator.x, rotator.y);
      ctx.rotate(angle);
      this.drawBlocker(ctx, -rotator.armLength, -rotator.thickness / 2, rotator.armLength * 2, rotator.thickness, '#cfd7de');
      ctx.rotate(Math.PI / 2);
      this.drawBlocker(ctx, -rotator.armLength, -rotator.thickness / 2, rotator.armLength * 2, rotator.thickness, '#cfd7de');
      ctx.restore();
    }

    for (const portal of level.portals || []) {
      this.drawPortal(ctx, portal.a.x, portal.a.y, portal.a.radius, '#a8a6ff');
      this.drawPortal(ctx, portal.b.x, portal.b.y, portal.b.radius, '#ffafde');
    }

    this.drawCup(ctx, level.hole, time);
    this.drawDecorations(ctx, level);
  }

  drawZones(ctx, zones, fill, highlight) {
    for (const zone of zones || []) {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      this.pathShape(ctx, zone);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = highlight;
      for (let x = 0; x < 6; x += 1) {
        ctx.beginPath();
        const ox = (zone.x || zone.points?.[0]?.x || 0) + x * 28;
        const oy = (zone.y || zone.points?.[0]?.y || 0) + x * 10;
        ctx.arc(ox, oy, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  pathShape(ctx, shape) {
    if (shape.type === 'roundedRect') return this.pathRoundedRect(ctx, shape.x, shape.y, shape.width, shape.height, shape.radius);
    if (shape.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(shape.x, shape.y, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      return;
    }
    if (shape.type === 'polygon') {
      ctx.beginPath();
      shape.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
    }
  }

  pathRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  drawBlocker(ctx, x, y, width, height, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 16;
    this.pathRoundedRect(ctx, x - width / 2, y - height / 2, width, height, Math.min(width, height) / 2.4);
    ctx.fill();
    ctx.restore();
  }

  drawPortal(ctx, x, y, radius, color) {
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y, 4, x, y, radius + 14);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.28, color);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCup(ctx, hole, time) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#08120b';
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, 14, 0, Math.PI * 2);
    ctx.fill();

    const flagWave = Math.sin(time * 4.5) * 7;
    ctx.strokeStyle = '#f3f7f4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y - 12);
    ctx.lineTo(hole.x, hole.y - 62);
    ctx.stroke();

    ctx.fillStyle = '#ff7f7f';
    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y - 60);
    ctx.quadraticCurveTo(hole.x + 24, hole.y - 56 + flagWave * 0.08, hole.x + 32, hole.y - 42);
    ctx.lineTo(hole.x, hole.y - 34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawBall(ctx, ball) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(ball.x + 3, ball.y + 6, BALL_RADIUS * 0.9, BALL_RADIUS * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    const gradient = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 2, ball.x, ball.y, BALL_RADIUS + 1);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.65, '#f5f5f5');
    gradient.addColorStop(1, '#d5dde2');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawAimGuide(ctx, game) {
    if (!game.aimPreview) return;
    const { ball } = game;
    const vector = game.aimPreview;
    const strength = vector.power;
    const length = 120 * strength;
    const angle = vector.angle;
    const points = game.predictShotPath();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    for (const point of points) ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.translate(ball.x, ball.y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(152, 239, 151, 0.95)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, -10 - strength * 6);
    ctx.lineTo(length + 22, 0);
    ctx.lineTo(length, 10 + strength * 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawEffects(ctx) {
    for (const particle of this.effects.particles) {
      const alpha = particle.life / particle.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawDecorations(ctx, level) {
    for (const deco of level.decorations || []) {
      if (deco.type === 'flower') {
        ctx.fillStyle = '#f7b3db';
        for (let i = 0; i < 5; i += 1) {
          ctx.beginPath();
          ctx.arc(deco.x + Math.cos((Math.PI * 2 * i) / 5) * 6, deco.y + Math.sin((Math.PI * 2 * i) / 5) * 6, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffe68e';
        ctx.beginPath();
        ctx.arc(deco.x, deco.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.arc(deco.x, deco.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
