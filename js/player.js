import { PLAYER_RADIUS, SHAFT_WIDTH, WALL_PADDING } from './config.js';
import { clamp, lerp } from './physics.js';

export class Player {
  constructor() { this.reset(); }

  reset() {
    this.radius = PLAYER_RADIUS;
    this.wall = 'left';
    this.x = WALL_PADDING + this.radius;
    this.y = 820;
    this.vy = -10;
    this.jump = null;
    this.coyote = 0;
    this.phaseCharges = 0;
    this.shield = 0;
    this.hitCooldown = 0;
    this.alive = true;
  }

  worldWallX(side) {
    return side === 'left' ? WALL_PADDING + this.radius : SHAFT_WIDTH - WALL_PADDING - this.radius;
  }

  canJump() {
    return !this.jump || this.coyote > 0;
  }

  triggerJump(timeScale = 1) {
    const from = this.wall;
    const to = from === 'left' ? 'right' : 'left';
    const startX = this.worldWallX(from);
    const endX = this.worldWallX(to);
    this.jump = { t: 0, duration: 0.36 / timeScale, startX, endX, startY: this.y, apex: this.y - 92 };
    this.wall = null;
    this.coyote = 0;
    this.vy = -90;
    return to;
  }

  update(dt, cameraSpeed, gravityScale = 1, gripActive = false) {
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    if (this.jump) {
      this.jump.t += dt / this.jump.duration;
      const t = clamp(this.jump.t, 0, 1);
      const arc = Math.sin(t * Math.PI);
      this.x = lerp(this.jump.startX, this.jump.endX, t);
      this.y = lerp(this.jump.startY, this.jump.startY - 16, t) - arc * 108;
      this.vy += 420 * gravityScale * dt;
      this.y += (this.vy - cameraSpeed * 0.9) * dt;
      if (t >= 1) {
        this.wall = this.x < SHAFT_WIDTH / 2 ? 'left' : 'right';
        this.x = this.worldWallX(this.wall);
        this.jump = null;
        this.coyote = gripActive ? 0.18 : 0.11;
        this.vy = gripActive ? -18 : 20;
      }
    } else {
      this.x = this.worldWallX(this.wall || 'left');
      this.vy += 300 * gravityScale * dt;
      this.y += (this.vy - cameraSpeed * (gripActive ? 0.72 : 0.92)) * dt;
      this.coyote = gripActive ? 0.18 : 0.11;
    }
  }
}
