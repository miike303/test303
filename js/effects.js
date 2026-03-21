export class EffectsSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.shake = 0;
  }

  burst(x, y, color, count = 10, spread = Math.PI * 2, speed = 180) {
    for (let i = 0; i < count; i += 1) {
      const angle = (spread === Math.PI * 2 ? Math.random() * spread : -spread / 2 + Math.random() * spread) - Math.PI / 2;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed * (0.35 + Math.random()), vy: Math.sin(angle) * speed * (0.35 + Math.random()), life: 0.25 + Math.random() * 0.4, maxLife: 0.65, size: 2 + Math.random() * 5, color });
    }
  }

  trail(x, y, color) { this.particles.push({ x, y, vx: 0, vy: 18, life: 0.22, maxLife: 0.22, size: 2 + Math.random() * 3, color }); }

  text(x, y, label, color = '#fff') { this.floatingTexts.push({ x, y, label, color, life: 0.9, maxLife: 0.9 }); }

  addShake(amount) { this.shake = Math.min(24, this.shake + amount); }

  update(dt) {
    this.shake *= Math.max(0, 1 - dt * 8);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
      return p.life > 0;
    });
    this.floatingTexts = this.floatingTexts.filter((t) => {
      t.life -= dt;
      t.y -= 36 * dt;
      return t.life > 0;
    });
  }

  screenShake() {
    return { x: (Math.random() - 0.5) * this.shake, y: (Math.random() - 0.5) * this.shake };
  }
}
