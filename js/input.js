import { clamp, distance } from './physics.js';

export class InputSystem {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.pointer = { active: false, x: 0, y: 0, worldX: 0, worldY: 0, dragStart: null, cancelled: false };
    this.bind();
  }

  bind() {
    const start = (event) => {
      if (!this.game.canAim()) return;
      const point = this.getPoint(event);
      const ball = this.game.ball;
      if (distance(point, ball) > 42) return;
      this.pointer.active = true;
      this.pointer.cancelled = false;
      this.pointer.dragStart = point;
      this.updatePoint(event);
      this.game.audio.unlock();
      event.preventDefault();
    };

    const move = (event) => {
      this.updatePoint(event);
      if (!this.pointer.active) return;
      const drag = this.getAimVector();
      this.game.setAimPreview(drag);
      event.preventDefault();
    };

    const end = (event) => {
      if (!this.pointer.active) return;
      const drag = this.getAimVector();
      this.pointer.active = false;
      if (!this.pointer.cancelled && drag.power > 0.06) this.game.takeShot(drag);
      this.game.clearAimPreview();
      event.preventDefault();
    };

    const cancel = () => {
      if (!this.pointer.active) return;
      this.pointer.active = false;
      this.pointer.cancelled = true;
      this.game.clearAimPreview();
    };

    this.canvas.addEventListener('pointerdown', start, { passive: false });
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end, { passive: false });
    window.addEventListener('pointercancel', cancel, { passive: true });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.game.togglePause();
      if (event.key.toLowerCase() === 'r') this.game.restartHole();
      if (event.key.toLowerCase() === 'n') this.game.nextHole();
    });
  }

  updatePoint(event) {
    const point = this.getPoint(event);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
  }

  getPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const source = event.touches ? event.touches[0] : event;
    const x = source.clientX - rect.left;
    const y = source.clientY - rect.top;
    return this.game.renderer.screenToWorld(x, y);
  }

  getAimVector() {
    const ball = this.game.ball;
    const dx = ball.x - this.pointer.x;
    const dy = ball.y - this.pointer.y;
    const dragDistance = Math.hypot(dx, dy);
    const maxDrag = 180;
    return {
      dx,
      dy,
      power: clamp(dragDistance / maxDrag, 0, 1),
      angle: Math.atan2(dy, dx),
    };
  }
}
