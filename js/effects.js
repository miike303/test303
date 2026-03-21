export class EffectsSystem {
  constructor() {
    this.particles = [];
    this.shakes = [];
  }

  burst(x, y, options = {}) {
    const count = options.count || 14;
    const speed = options.speed || 120;
    const palette = options.palette || ['#f7fffb', '#a8f1a0', '#ffe18f'];
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const velocity = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 0.25 + Math.random() * 0.6,
        maxLife: 0.25 + Math.random() * 0.6,
        size: 2 + Math.random() * 4,
        color: palette[(Math.random() * palette.length) | 0],
      });
    }
  }

  trail(x, y) {
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.22, maxLife: 0.22, size: 1.8 + Math.random() * 1.8, color: 'rgba(255,255,255,0.35)' });
  }

  shake(amount, duration = 0.12) {
    this.shakes.push({ amount, duration, elapsed: 0 });
  }

  update(dt) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      return p.life > 0;
    });

    this.shakes = this.shakes.filter((shake) => {
      shake.elapsed += dt;
      return shake.elapsed < shake.duration;
    });
  }

  getShakeOffset() {
    if (!this.shakes.length) return { x: 0, y: 0 };
    const total = this.shakes.reduce((sum, shake) => sum + shake.amount * (1 - shake.elapsed / shake.duration), 0);
    return {
      x: (Math.random() - 0.5) * total,
      y: (Math.random() - 0.5) * total,
    };
  }
}
