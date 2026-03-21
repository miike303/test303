/*
README
File organization:
- index.html: application shell, menus, HUD, and touch control layout.
- style.css: responsive premium UI styling, overlays, HUD, and mobile controls.
- script.js: complete Tunnel Swarm game implementation including gameplay systems, rendering, UI, audio hooks, and save/meta progression.
How to run locally:
- Open index.html directly in a modern browser, or serve the folder with any static server.
How to publish on GitHub Pages:
- Push these files to a repository, enable GitHub Pages for the branch/folder containing index.html, and the game will run as a static site.
*/

(() => {
  'use strict';

  const STORAGE_KEY = 'tunnel-swarm-save-v1';
  const TAU = Math.PI * 2;
  const ARENA_W = 2200;
  const ARENA_H = 1400;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = (list) => list[(Math.random() * list.length) | 0];
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const RARITY_STYLE = {
    common: { color: '#d0d8ea', weight: 1, label: 'Common' },
    rare: { color: '#62dfff', weight: 0.52, label: 'Rare' },
    epic: { color: '#c085ff', weight: 0.24, label: 'Epic' },
    legendary: { color: '#ffbe64', weight: 0.08, label: 'Legendary' },
  };

  const WEAPON_DEFS = {
    pistol: { label: 'Mechanical Pistol', color: '#ffd27a' },
    shotgun: { label: 'Shotgun Burst', color: '#ff9357' },
    lightning: { label: 'Chain Emitter', color: '#7ce4ff' },
    saw: { label: 'Saw Blades', color: '#c7d1df' },
    flamethrower: { label: 'Flamethrower', color: '#ff834c' },
    drone: { label: 'Drone Turret', color: '#7ef5d0' },
    mines: { label: 'Mines', color: '#cb9bff' },
    orb: { label: 'Energy Orbs', color: '#85c8ff' },
    rail: { label: 'Rail Shot', color: '#f7f0ff' },
    toxic: { label: 'Toxic Launcher', color: '#8fff86' },
  };

  class SaveManager {
    static defaults() {
      return {
        currency: 0,
        bestScore: 0,
        bestTime: 0,
        totalRuns: 0,
        totalKills: 0,
        selectedSkin: 'default',
        meta: {
          startingHp: 0,
          startingDamage: 0,
          xpGain: 0,
          moveSpeed: 0,
          shielding: 0,
          unlockShotgun: 0,
          unlockLightning: 0,
          unlockSkinAmber: 0,
        },
      };
    }

    static load() {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        return { ...SaveManager.defaults(), ...(parsed || {}), meta: { ...SaveManager.defaults().meta, ...((parsed || {}).meta || {}) } };
      } catch {
        return SaveManager.defaults();
      }
    }

    static save(state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }

  class AudioManager {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }
    unlock() {
      if (this.ctx) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    }
    setEnabled(enabled) {
      this.enabled = enabled;
    }
    play({ type = 'sine', frequency = 440, duration = 0.08, gain = 0.03, slide = null }) {
      if (!this.enabled) return;
      if (!this.ctx) this.unlock();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      if (slide !== null) osc.frequency.linearRampToValueAtTime(slide, now + duration);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp);
      amp.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }
    ui() { this.play({ type: 'triangle', frequency: 620, duration: 0.06, gain: 0.025, slide: 750 }); }
    shoot() { this.play({ type: 'square', frequency: 260, duration: 0.05, gain: 0.02, slide: 180 }); }
    shotgun() { this.play({ type: 'sawtooth', frequency: 160, duration: 0.08, gain: 0.028, slide: 90 }); }
    hit() { this.play({ type: 'triangle', frequency: 160, duration: 0.08, gain: 0.028, slide: 80 }); }
    pickup() { this.play({ type: 'sine', frequency: 780, duration: 0.08, gain: 0.02, slide: 980 }); }
    levelUp() { this.play({ type: 'triangle', frequency: 560, duration: 0.15, gain: 0.03, slide: 920 }); }
    bossWarning() { this.play({ type: 'sawtooth', frequency: 120, duration: 0.28, gain: 0.035, slide: 70 }); }
    gameOver() { this.play({ type: 'triangle', frequency: 220, duration: 0.4, gain: 0.03, slide: 90 }); }
  }

  class InputManager {
    constructor(game) {
      this.game = game;
      this.keys = new Set();
      this.move = { x: 0, y: 0 };
      this.touchMove = { x: 0, y: 0 };
      this.bind();
    }
    bind() {
      window.addEventListener('keydown', (e) => {
        this.game.audio.unlock();
        this.keys.add(e.key.toLowerCase());
        if (e.key === ' ') { e.preventDefault(); this.game.tryDash(); }
        if (e.key.toLowerCase() === 'p' || e.key === 'Escape') this.game.togglePause();
      });
      window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    }
    update() {
      let x = 0;
      let y = 0;
      if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
      const touchActive = Math.abs(this.touchMove.x) + Math.abs(this.touchMove.y) > 0.02;
      if (touchActive) { x = this.touchMove.x; y = this.touchMove.y; }
      const mag = Math.hypot(x, y) || 1;
      this.move.x = x / mag * Math.min(1, Math.hypot(x, y));
      this.move.y = y / mag * Math.min(1, Math.hypot(x, y));
      return this.move;
    }
  }

  class TouchControls {
    constructor(game, input) {
      this.game = game;
      this.input = input;
      this.root = document.getElementById('touchUi');
      this.zone = document.getElementById('joystickZone');
      this.stick = document.getElementById('joystickStick');
      this.activeId = null;
      this.center = { x: 0, y: 0 };
      this.radius = 46;
      this.bind();
      this.refresh();
      window.addEventListener('resize', () => this.refresh());
    }
    bind() {
      const start = (e) => {
        const t = e.changedTouches[0];
        const rect = this.zone.getBoundingClientRect();
        this.center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.activeId = t.identifier;
        this.updateFromPoint(t.clientX, t.clientY);
      };
      const move = (e) => {
        for (const touch of e.changedTouches) {
          if (touch.identifier === this.activeId) {
            this.updateFromPoint(touch.clientX, touch.clientY);
            e.preventDefault();
          }
        }
      };
      const end = (e) => {
        for (const touch of e.changedTouches) {
          if (touch.identifier === this.activeId) {
            this.activeId = null;
            this.input.touchMove.x = 0;
            this.input.touchMove.y = 0;
            this.refresh();
          }
        }
      };
      this.zone.addEventListener('touchstart', start, { passive: true });
      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', end, { passive: true });
      window.addEventListener('touchcancel', end, { passive: true });
      document.getElementById('touchDash').addEventListener('click', () => this.game.tryDash());
      document.getElementById('touchPause').addEventListener('click', () => this.game.togglePause());
    }
    updateFromPoint(x, y) {
      const dx = x - this.center.x;
      const dy = y - this.center.y;
      const mag = Math.hypot(dx, dy);
      const scale = mag > this.radius ? this.radius / mag : 1;
      const px = dx * scale;
      const py = dy * scale;
      this.input.touchMove.x = px / this.radius;
      this.input.touchMove.y = py / this.radius;
      this.stick.style.transform = `translate(${px}px, ${py}px)`;
    }
    refresh() {
      this.stick.style.transform = 'translate(0px, 0px)';
      this.root.classList.toggle('hidden', !('ontouchstart' in window || navigator.maxTouchPoints > 0) || !this.game.inRun());
    }
  }

  class ParticleSystem {
    constructor() { this.items = []; }
    emit(x, y, opts = {}) {
      const count = opts.count || 8;
      for (let i = 0; i < count; i += 1) {
        const angle = opts.angleSpread ? opts.baseAngle + rand(-opts.angleSpread, opts.angleSpread) : rand(0, TAU);
        const speed = rand(opts.minSpeed ?? 20, opts.maxSpeed ?? 120);
        this.items.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: rand(opts.lifeMin ?? 0.2, opts.lifeMax ?? 0.6),
          maxLife: 1,
          size: rand(opts.sizeMin ?? 1.5, opts.sizeMax ?? 5.5),
          color: opts.color || pick(['#ffbe64', '#ffffff', '#67e4ff']),
          drag: opts.drag ?? 0.92,
          glow: opts.glow ?? 0,
        });
      }
    }
    text(x, y, label, color = '#fff') {
      this.items.push({ x, y, vx: rand(-10, 10), vy: -55, life: 0.8, maxLife: 0.8, size: 16, color, text: label, drag: 0.98 });
    }
    update(dt) {
      for (const p of this.items) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
      }
      this.items = this.items.filter((p) => p.life > 0);
    }
    render(ctx, camera) {
      for (const p of this.items) {
        const alpha = Math.max(0, p.life / (p.maxLife || 1));
        const x = (p.x - camera.x) * camera.zoom + camera.vw / 2;
        const y = (p.y - camera.y) * camera.zoom + camera.vh / 2;
        if (p.text) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.fillText(p.text, x, y);
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.glow) {
          ctx.shadowBlur = p.glow;
          ctx.shadowColor = p.color;
        }
        ctx.beginPath();
        ctx.arc(x, y, p.size * camera.zoom * 0.7, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  class Entity {
    constructor(x, y, radius) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.dead = false;
    }
  }

  class Projectile extends Entity {
    constructor(x, y, vx, vy, opts = {}) {
      super(x, y, opts.radius || 5);
      this.vx = vx;
      this.vy = vy;
      this.life = opts.life || 1.8;
      this.damage = opts.damage || 10;
      this.color = opts.color || '#fff';
      this.pierce = opts.pierce || 0;
      this.knockback = opts.knockback || 0;
      this.source = opts.source || 'player';
      this.status = opts.status || null;
      this.splash = opts.splash || 0;
      this.trail = opts.trail || false;
      this.rail = opts.rail || false;
    }
    update(dt, game) {
      this.life -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.trail) game.particles.emit(this.x, this.y, { count: 1, color: this.color, lifeMin: 0.08, lifeMax: 0.18, minSpeed: 4, maxSpeed: 20, sizeMin: 1, sizeMax: 2.5 });
      if (this.life <= 0 || this.x < 40 || this.y < 40 || this.x > ARENA_W - 40 || this.y > ARENA_H - 40) this.dead = true;
    }
  }

  class XPGem extends Entity {
    constructor(x, y, value) {
      super(x, y, 8 + Math.min(8, value));
      this.value = value;
      this.spin = rand(0, TAU);
    }
    update(dt, game) {
      this.spin += dt * 4;
      const d = distance(this, game.player);
      if (d < game.player.pickupRadius) {
        const pull = clamp(1 - d / game.player.pickupRadius, 0.1, 1.5);
        this.x += (game.player.x - this.x) * dt * 8 * pull;
        this.y += (game.player.y - this.y) * dt * 8 * pull;
      }
      if (d < game.player.radius + this.radius + 4) {
        game.gainXP(this.value);
        game.audio.pickup();
        game.particles.emit(this.x, this.y, { count: 5, color: '#74f6ff', lifeMin: 0.15, lifeMax: 0.35, minSpeed: 14, maxSpeed: 90, glow: 8 });
        this.dead = true;
      }
    }
  }

  class Hazard extends Entity {
    constructor(type, x, y, radius, duration = 6) {
      super(x, y, radius);
      this.type = type;
      this.duration = duration;
      this.time = 0;
      this.angle = rand(0, TAU);
    }
    update(dt, game) {
      this.time += dt;
      if (this.time >= this.duration) this.dead = true;
      const d = distance(this, game.player);
      if (d < this.radius + game.player.radius) {
        if (this.type === 'steam') game.player.takeDamage(10 * dt, { source: 'Steam Burst' });
        if (this.type === 'electric') game.player.applySlow(0.5, 0.1);
        if (this.type === 'fire') game.player.applyBurn(1.3);
        if (this.type === 'laser') game.player.takeDamage(14 * dt, { source: 'Laser Grid' });
      }
    }
  }

  class Enemy extends Entity {
    constructor(type, x, y, intensity, elite = false) {
      const defs = Enemy.defs[type];
      super(x, y, defs.radius * (elite ? 1.12 : 1));
      this.type = type;
      this.name = defs.name;
      this.color = elite ? '#ffce6a' : defs.color;
      this.speed = defs.speed * (1 + intensity * 0.03) * (elite ? 1.12 : 1);
      this.maxHp = defs.hp * (1 + intensity * 0.14) * (elite ? 1.85 : 1);
      this.hp = this.maxHp;
      this.damage = defs.damage * (1 + intensity * 0.08) * (elite ? 1.3 : 1);
      this.xp = defs.xp * (elite ? 2.2 : 1);
      this.rangedCooldown = rand(1, 2);
      this.attackCooldown = rand(0.3, 1.2);
      this.alpha = type === 'phantom' ? 0.45 : 1;
      this.elite = elite;
      this.phase = 0;
      this.flash = 0;
      this.shielded = false;
      this.status = { burn: 0, poison: 0, freeze: 0, slow: 0 };
      this.telegraph = 0;
    }
    static defs = {
      crawler: { name: 'Crawler', radius: 16, speed: 164, hp: 24, damage: 9, xp: 5, color: '#ff7a72' },
      brute: { name: 'Heavy Brute', radius: 28, speed: 76, hp: 108, damage: 20, xp: 16, color: '#c9a56d' },
      spitter: { name: 'Ranged Spitter', radius: 20, speed: 94, hp: 38, damage: 13, xp: 8, color: '#98ffb6' },
      phantom: { name: 'Stealth Phantom', radius: 18, speed: 132, hp: 34, damage: 15, xp: 11, color: '#8e95ff' },
      kamikaze: { name: 'Kamikaze Bot', radius: 18, speed: 180, hp: 26, damage: 22, xp: 10, color: '#ffb060' },
      swarmer: { name: 'Swarmer', radius: 10, speed: 210, hp: 12, damage: 5, xp: 3, color: '#f7d77d' },
      shield: { name: 'Shield Drone', radius: 17, speed: 110, hp: 46, damage: 8, xp: 9, color: '#7ce4ff' },
    };
    update(dt, game) {
      this.flash = Math.max(0, this.flash - dt * 5);
      this.attackCooldown -= dt;
      this.rangedCooldown -= dt;
      this.telegraph = Math.max(0, this.telegraph - dt);
      if (this.status.burn > 0) { this.status.burn -= dt; this.takeDamage(7 * dt, game, false); game.particles.emit(this.x, this.y, { count: 1, color: '#ff8b4d', minSpeed: 2, maxSpeed: 20, lifeMin: 0.1, lifeMax: 0.25 }); }
      if (this.status.poison > 0) { this.status.poison -= dt; this.takeDamage(5 * dt, game, false); game.particles.emit(this.x, this.y, { count: 1, color: '#8fff79', minSpeed: 2, maxSpeed: 18, lifeMin: 0.1, lifeMax: 0.3 }); }
      const slowFactor = this.status.freeze > 0 ? 0.25 : this.status.slow > 0 ? 0.62 : 1;
      this.status.freeze = Math.max(0, this.status.freeze - dt);
      this.status.slow = Math.max(0, this.status.slow - dt);

      if (this.type === 'phantom') this.alpha = 0.25 + 0.45 * (0.5 + Math.sin(game.time * 3 + this.x * 0.01) * 0.5);
      const dx = game.player.x - this.x;
      const dy = game.player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      let desiredX = dx / dist;
      let desiredY = dy / dist;
      if (this.type === 'spitter' && dist < 280) { desiredX *= -0.6; desiredY *= -0.6; }
      if (this.type === 'shield') {
        const ally = game.findShieldTarget(this);
        if (ally) {
          const adx = ally.x - this.x;
          const ady = ally.y - this.y;
          const ad = Math.hypot(adx, ady) || 1;
          desiredX = adx / ad;
          desiredY = ady / ad;
          game.applyShieldAura(this);
        }
      }

      const separation = game.computeEnemySeparation(this);
      desiredX += separation.x * 1.6;
      desiredY += separation.y * 1.6;
      const dm = Math.hypot(desiredX, desiredY) || 1;
      desiredX /= dm;
      desiredY /= dm;
      this.x += desiredX * this.speed * slowFactor * dt;
      this.y += desiredY * this.speed * slowFactor * dt;

      if (this.type === 'spitter' && dist < 480 && this.rangedCooldown <= 0) {
        this.rangedCooldown = rand(1.25, 2.15);
        const speed = 260;
        game.enemyProjectiles.push(new Projectile(this.x, this.y, dx / dist * speed, dy / dist * speed, { radius: 6, damage: this.damage, color: '#9dffb6', life: 2.5, source: 'enemy', trail: true }));
      }
      if (this.type === 'kamikaze' && dist < 90) {
        game.explodeEnemy(this, this.damage * 1.2, 70, '#ffac58');
        this.dead = true;
      }
      if (dist < this.radius + game.player.radius + 2 && this.attackCooldown <= 0) {
        this.attackCooldown = this.type === 'swarmer' ? 0.6 : 1;
        game.player.takeDamage(this.damage, { source: this.name });
        if (this.type === 'brute') game.shake += 6;
      }
      this.x = clamp(this.x, 70, ARENA_W - 70);
      this.y = clamp(this.y, 70, ARENA_H - 70);
    }
    takeDamage(amount, game, spawnText = true) {
      if (this.shielded) amount *= 0.72;
      this.hp -= amount;
      this.flash = 1;
      if (spawnText && amount > 1) game.particles.text(this.x + rand(-8, 8), this.y - 14, `${Math.round(amount)}`, '#fff0a2');
      if (this.hp <= 0 && !this.dead) this.kill(game);
    }
    kill(game) {
      this.dead = true;
      game.kills += 1;
      game.score += Math.round(this.maxHp * 2 + game.intensity * 4);
      game.meta.totalKills += 1;
      game.spawnXP(this.x, this.y, this.xp);
      game.particles.emit(this.x, this.y, { count: 10 + (this.elite ? 8 : 0), color: this.color, minSpeed: 30, maxSpeed: 180, lifeMin: 0.25, lifeMax: 0.65, glow: 10 });
      if (game.player.upgrades.explosionOnKill > 0) game.explodeAt(this.x, this.y, 55 + game.player.upgrades.explosionOnKill * 18, 14 + game.player.upgrades.explosionOnKill * 9, '#ff9b63');
      if (game.player.upgrades.lifesteal > 0) game.player.heal(0.7 * game.player.upgrades.lifesteal);
    }
  }

  class Boss extends Enemy {
    constructor(type, x, y, intensity) {
      super('brute', x, y, intensity, true);
      const defs = Boss.defs[type];
      this.type = type;
      this.name = defs.name;
      this.color = defs.color;
      this.radius = defs.radius;
      this.maxHp = defs.hp * (1 + intensity * 0.22);
      this.hp = this.maxHp;
      this.speed = defs.speed;
      this.damage = defs.damage;
      this.patternCooldown = 3;
      this.phase2 = false;
      this.segments = [];
      if (type === 'voltSerpent') {
        for (let i = 0; i < 7; i += 1) this.segments.push({ x: x - i * 24, y, r: Math.max(10, this.radius - i * 2) });
      }
    }
    static defs = {
      ironWarden: { name: 'Iron Warden', radius: 58, hp: 1500, speed: 70, damage: 24, color: '#f4ba70' },
      voltSerpent: { name: 'Volt Serpent', radius: 42, hp: 1300, speed: 150, damage: 18, color: '#74dcff' },
      furnaceCore: { name: 'Furnace Core', radius: 64, hp: 1800, speed: 38, damage: 16, color: '#ff8459' },
    };
    update(dt, game) {
      this.phase2 = this.hp < this.maxHp * 0.45;
      this.patternCooldown -= dt;
      if (this.type === 'ironWarden') this.updateIronWarden(dt, game);
      if (this.type === 'voltSerpent') this.updateVoltSerpent(dt, game);
      if (this.type === 'furnaceCore') this.updateFurnaceCore(dt, game);
      super.update(dt, game);
    }
    updateIronWarden(dt, game) {
      if (this.patternCooldown <= 0) {
        this.patternCooldown = this.phase2 ? 3 : 4.5;
        this.telegraph = 1.2;
        setTimeout(() => {
          if (this.dead || game.state !== 'running') return;
          game.explodeAt(this.x, this.y, 120, 26, '#ffcb77');
          for (let i = 0; i < (this.phase2 ? 6 : 4); i += 1) game.spawnEnemy(i % 2 === 0 ? 'crawler' : 'shield', true);
        }, 780);
      }
    }
    updateVoltSerpent(dt, game) {
      if (this.patternCooldown <= 0) {
        this.patternCooldown = this.phase2 ? 2.2 : 3.2;
        for (let i = 0; i < (this.phase2 ? 14 : 10); i += 1) {
          const a = (TAU / (this.phase2 ? 14 : 10)) * i + game.time * 0.6;
          game.enemyProjectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 210, Math.sin(a) * 210, { radius: 7, damage: 10, color: '#73dbff', life: 3, source: 'enemy', trail: true }));
        }
      }
      if (this.segments.length) {
        let lx = this.x;
        let ly = this.y;
        for (const seg of this.segments) {
          seg.x = lerp(seg.x, lx, 0.16);
          seg.y = lerp(seg.y, ly, 0.16);
          lx = seg.x - Math.cos(game.time * 4) * 8;
          ly = seg.y - Math.sin(game.time * 4) * 8;
        }
      }
    }
    updateFurnaceCore(dt, game) {
      if (this.patternCooldown <= 0) {
        this.patternCooldown = this.phase2 ? 2.8 : 4.4;
        for (let ring = 0; ring < (this.phase2 ? 2 : 1); ring += 1) {
          const count = this.phase2 ? 18 : 12;
          for (let i = 0; i < count; i += 1) {
            const a = (TAU / count) * i + ring * 0.15;
            game.enemyProjectiles.push(new Projectile(this.x, this.y, Math.cos(a) * (160 + ring * 30), Math.sin(a) * (160 + ring * 30), { radius: 6, damage: 9, color: '#ff8f6c', life: 3.4, source: 'enemy', trail: true }));
          }
        }
        game.hazards.push(new Hazard('fire', rand(280, ARENA_W - 280), rand(220, ARENA_H - 220), 80, 7));
      }
    }
  }

  class Player extends Entity {
    constructor(game) {
      super(ARENA_W / 2, ARENA_H / 2, 24);
      const meta = game.meta.meta;
      this.game = game;
      this.maxHp = 120 + meta.startingHp * 16;
      this.hp = this.maxHp;
      this.armor = meta.shielding * 2;
      this.speed = 300 + meta.moveSpeed * 12;
      this.pickupRadius = 110;
      this.critChance = 0.08;
      this.critDamage = 1.75;
      this.cooldownReduction = 0;
      this.dodgeChance = 0.04;
      this.regeneration = 0.4;
      this.damageMultiplier = 1 + meta.startingDamage * 0.08;
      this.burnChance = 0;
      this.poisonChance = 0;
      this.chainChance = 0;
      this.slowChance = 0;
      this.freezeChance = 0;
      this.projectileCount = 0;
      this.extraPierce = 0;
      this.revive = 0;
      this.xpGain = meta.xpGain * 0.06;
      this.lifesteal = 0;
      this.shieldRecharge = 0;
      this.magnetPulse = 0;
      this.vengeanceBurst = 0;
      this.skin = game.meta.selectedSkin;
      this.weapons = [];
      this.upgrades = { explosionOnKill: 0, extraOrbit: 0, mineCapacity: 0 };
      this.burnTimer = 0;
      this.flash = 0;
      this.bob = 0;
      this.dashCooldown = 0;
      this.dashTime = 0;
      this.invuln = 0;
      this.slow = 0;
      this.facing = 0;
      this.initWeapons();
    }
    initWeapons() {
      this.weapons.push(new WeaponSystem(this.game, this, 'pistol'));
      if (this.game.meta.meta.unlockShotgun > 0) this.weapons.push(new WeaponSystem(this.game, this, 'shotgun'));
      if (this.game.meta.meta.unlockLightning > 0) this.weapons.push(new WeaponSystem(this.game, this, 'lightning'));
    }
    update(dt, input) {
      this.flash = Math.max(0, this.flash - dt * 4);
      this.invuln = Math.max(0, this.invuln - dt);
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      this.dashTime = Math.max(0, this.dashTime - dt);
      this.slow = Math.max(0, this.slow - dt);
      this.hp = clamp(this.hp + this.regeneration * dt, 0, this.maxHp);
      this.bob += dt * 8;
      const move = input.update();
      const moveSpeed = this.speed * (this.dashTime > 0 ? 2.2 : 1) * (this.slow > 0 ? 0.65 : 1);
      this.x += move.x * moveSpeed * dt;
      this.y += move.y * moveSpeed * dt;
      if (Math.abs(move.x) + Math.abs(move.y) > 0.02) this.facing = Math.atan2(move.y, move.x);
      this.x = clamp(this.x, 80, ARENA_W - 80);
      this.y = clamp(this.y, 80, ARENA_H - 80);
      for (const weapon of this.weapons) weapon.update(dt);
      if (this.magnetPulse > 0 && Math.floor(this.game.time * 0.5) !== Math.floor((this.game.time - dt) * 0.5)) {
        this.game.particles.emit(this.x, this.y, { count: 18, color: '#7ff8ff', minSpeed: 80, maxSpeed: 220, lifeMin: 0.3, lifeMax: 0.5, glow: 12 });
      }
    }
    takeDamage(amount, source = {}) {
      if (this.invuln > 0) return;
      if (Math.random() < this.dodgeChance) {
        this.game.particles.text(this.x, this.y - 20, 'DODGE', '#77f6ff');
        return;
      }
      const dealt = Math.max(1, amount * (100 / (100 + this.armor * 8)));
      this.hp -= dealt;
      this.flash = 1;
      this.invuln = 0.18;
      this.game.audio.hit();
      this.game.shake += 8;
      this.game.particles.emit(this.x, this.y, { count: 10, color: '#ff8b7a', minSpeed: 20, maxSpeed: 180, lifeMin: 0.18, lifeMax: 0.4 });
      if (this.vengeanceBurst > 0) this.game.explodeAt(this.x, this.y, 70 + this.vengeanceBurst * 20, 10 + this.vengeanceBurst * 8, '#ffb07b');
      if (this.hp <= 0) {
        if (this.revive > 0) {
          this.revive -= 1;
          this.hp = this.maxHp * 0.45;
          this.invuln = 2.2;
          this.game.particles.text(this.x, this.y - 28, 'REVIVE', '#ffe08c');
          return;
        }
        this.game.endRun(source.source || 'Overrun');
      }
    }
    heal(value) { this.hp = clamp(this.hp + value, 0, this.maxHp); }
    applySlow(strength, duration) { this.slow = Math.max(this.slow, duration * strength); }
    applyBurn(duration) { this.burnTimer = Math.max(this.burnTimer, duration); }
  }

  class WeaponSystem {
    constructor(game, player, type) {
      this.game = game;
      this.player = player;
      this.type = type;
      this.level = 1;
      this.cooldown = 0;
      this.orbitAngle = rand(0, TAU);
      this.mineTimer = 0;
      this.droneAngle = rand(0, TAU);
    }
    update(dt) {
      this.cooldown -= dt;
      this.mineTimer -= dt;
      this.orbitAngle += dt * 1.6;
      this.droneAngle += dt * 1.4;
      if (this.type === 'saw' || this.type === 'orb') return;
      if (this.type === 'mines') {
        if (this.mineTimer <= 0) {
          this.mineTimer = Math.max(1.6, 4.5 - this.level * 0.35 - this.player.cooldownReduction * 0.25);
          this.game.placeMine(this.player.x + rand(-50, 50), this.player.y + rand(-50, 50), 18 + this.level * 6);
        }
        return;
      }
      const target = this.game.findNearestEnemy(this.player, this.getRange());
      if (!target) return;
      if (this.cooldown <= 0) {
        this.fire(target);
        this.cooldown = Math.max(0.08, this.getCooldown() * (1 - this.player.cooldownReduction * 0.08));
      }
    }
    getDamage() {
      const base = {
        pistol: 13, shotgun: 12, lightning: 18, flamethrower: 7.5, drone: 11, rail: 34, toxic: 12,
      }[this.type] || 14;
      return base * (1 + (this.level - 1) * 0.22) * this.player.damageMultiplier;
    }
    getCooldown() {
      return { pistol: 0.33, shotgun: 1.1, lightning: 1.4, flamethrower: 0.16, drone: 0.7, rail: 1.8, toxic: 1.3 }[this.type] || 0.8;
    }
    getRange() {
      return { pistol: 530, shotgun: 300, lightning: 360, flamethrower: 210, drone: 400, rail: 820, toxic: 420 }[this.type] || 360;
    }
    fire(target) {
      const dx = target.x - this.player.x;
      const dy = target.y - this.player.y;
      const ang = Math.atan2(dy, dx);
      const spreadCount = this.type === 'shotgun' ? 5 + this.level + this.player.projectileCount : 1 + this.player.projectileCount;
      const damage = this.getDamage();
      if (this.type === 'pistol') {
        for (let i = 0; i < spreadCount; i += 1) this.spawnProjectile(ang + rand(-0.07, 0.07), 620, damage, '#ffd278', 0.9, 0.18);
        this.game.audio.shoot();
      } else if (this.type === 'shotgun') {
        for (let i = 0; i < spreadCount + 3; i += 1) this.spawnProjectile(ang + rand(-0.28, 0.28), 460, damage, '#ff9c5b', 0.48, 0.12);
        this.game.audio.shotgun();
      } else if (this.type === 'lightning') {
        this.chainHit(target, damage, 3 + this.level);
        this.game.audio.play({ type: 'triangle', frequency: 820, duration: 0.12, gain: 0.02, slide: 520 });
      } else if (this.type === 'flamethrower') {
        for (let i = 0; i < 4 + this.level; i += 1) this.spawnProjectile(ang + rand(-0.36, 0.36), rand(250, 360), damage, '#ff8a4f', 0.35, 0.2, { splash: 18, status: 'burn', radius: 7 });
      } else if (this.type === 'drone') {
        const ox = Math.cos(this.droneAngle) * 52;
        const oy = Math.sin(this.droneAngle) * 52;
        this.game.projectiles.push(new Projectile(this.player.x + ox, this.player.y + oy, Math.cos(ang) * 500, Math.sin(ang) * 500, { damage, color: '#83ffe6', pierce: this.player.extraPierce, knockback: 10, life: 1.3, trail: true }));
      } else if (this.type === 'rail') {
        this.spawnProjectile(ang, 900, damage, '#fff6ff', 0.65, 0.4, { radius: 7, pierce: 5 + this.player.extraPierce, rail: true, trail: true });
        this.game.shake += 4;
      } else if (this.type === 'toxic') {
        this.spawnProjectile(ang + rand(-0.12, 0.12), 330, damage, '#8eff7f', 0.9, 0.28, { splash: 60, status: 'poison', radius: 9, trail: true });
      }
      this.game.particles.emit(this.player.x + Math.cos(ang) * 26, this.player.y + Math.sin(ang) * 26, { count: 5, color: WEAPON_DEFS[this.type].color, minSpeed: 20, maxSpeed: 120, lifeMin: 0.1, lifeMax: 0.22, baseAngle: ang, angleSpread: 0.3, glow: 8 });
    }
    spawnProjectile(angle, speed, damage, color, life, knockback, extra = {}) {
      this.game.projectiles.push(new Projectile(this.player.x + Math.cos(angle) * 24, this.player.y + Math.sin(angle) * 24, Math.cos(angle) * speed, Math.sin(angle) * speed, {
        damage,
        color,
        life,
        knockback,
        pierce: this.player.extraPierce + (extra.pierce || 0),
        splash: extra.splash || 0,
        status: extra.status || null,
        radius: extra.radius || 5,
        trail: !!extra.trail,
        rail: !!extra.rail,
      }));
    }
    chainHit(target, damage, jumps) {
      const hit = new Set();
      let current = target;
      let currentDamage = damage;
      while (current && jumps > 0) {
        hit.add(current);
        current.takeDamage(currentDamage, this.game);
        current.status.slow = Math.max(current.status.slow, 0.7);
        this.game.particles.emit(current.x, current.y, { count: 7, color: '#74dcff', minSpeed: 10, maxSpeed: 100, lifeMin: 0.1, lifeMax: 0.22, glow: 10 });
        current = this.game.enemies.filter((e) => !hit.has(e)).sort((a, b) => distance(a, current) - distance(b, current)).find((e) => distance(e, current) < 180);
        currentDamage *= 0.76;
        jumps -= 1;
      }
    }
  }

  class UpgradeSystem {
    constructor(game) {
      this.game = game;
      this.pool = this.buildPool();
    }
    buildPool() {
      const define = (id, title, rarity, desc, apply, weight = 1, condition = null) => ({ id, title, rarity, desc, apply, weight, condition });
      return [
        define('damage', '+Damage', 'common', 'Increase all weapon damage by 18%.', () => this.game.player.damageMultiplier += 0.18, 1.2),
        define('attackSpeed', '+Attack Speed', 'common', 'Reduce weapon cooldowns.', () => this.game.player.cooldownReduction += 0.12, 1.1),
        define('moveSpeed', '+Move Speed', 'common', 'Sprint faster through the tunnel.', () => this.game.player.speed += 28, 1),
        define('maxHp', '+Max HP', 'common', 'Increase max health and heal a little.', () => { this.game.player.maxHp += 24; this.game.player.heal(20); }, 1),
        define('armor', '+Armor Plating', 'common', 'Reduce incoming damage.', () => this.game.player.armor += 2, 1),
        define('pickup', 'Magnet Coil', 'common', 'Increase pickup radius.', () => this.game.player.pickupRadius += 28, 0.9),
        define('critChance', 'Crit Chance', 'rare', 'More shots critically strike.', () => this.game.player.critChance += 0.08, 0.7),
        define('critDamage', 'Crit Damage', 'rare', 'Critical hits hit harder.', () => this.game.player.critDamage += 0.35, 0.65),
        define('pierce', 'Pierce Rounds', 'rare', 'Projectiles pass through more targets.', () => this.game.player.extraPierce += 1, 0.7),
        define('projectiles', 'Extra Barrel', 'rare', 'Fire additional projectiles.', () => this.game.player.projectileCount += 1, 0.62),
        define('burn', 'Incendiary Rounds', 'rare', 'Hits can ignite enemies.', () => this.game.player.burnChance += 0.18, 0.62),
        define('poison', 'Toxic Coating', 'rare', 'Hits can poison enemies.', () => this.game.player.poisonChance += 0.18, 0.62),
        define('chain', 'Chain Effect', 'epic', 'Bullets can branch lightning to extra targets.', () => this.game.player.chainChance += 0.16, 0.42),
        define('slow', 'Cryo Dampener', 'rare', 'Hits may slow targets.', () => this.game.player.slowChance += 0.18, 0.5),
        define('freeze', 'Freeze Chance', 'epic', 'Hits may freeze enemies.', () => this.game.player.freezeChance += 0.12, 0.34),
        define('lifesteal', 'Lifesteal', 'epic', 'Recover HP when enemies die.', () => { this.game.player.lifesteal += 1; this.game.player.upgrades.lifesteal = this.game.player.lifesteal; }, 0.28),
        define('explosion', 'Explosion On Kill', 'epic', 'Defeated enemies detonate.', () => this.game.player.upgrades.explosionOnKill += 1, 0.28),
        define('drone', 'Summon Drone', 'rare', 'Add an auto-firing drone turret.', () => this.game.grantWeapon('drone'), 0.42, () => !this.game.hasWeapon('drone')),
        define('saw', 'Saw Halo', 'rare', 'Deploy rotating saw blades.', () => this.game.grantWeapon('saw'), 0.4, () => !this.game.hasWeapon('saw')),
        define('orb', 'Energy Orb', 'rare', 'Add orbiting energy orbs.', () => this.game.grantWeapon('orb'), 0.42, () => !this.game.hasWeapon('orb')),
        define('mines', 'Mine Rack', 'rare', 'Deploy proximity mines.', () => this.game.grantWeapon('mines'), 0.36, () => !this.game.hasWeapon('mines')),
        define('shotgun', 'Shotgun Burst', 'rare', 'Install a spread weapon.', () => this.game.grantWeapon('shotgun'), 0.32, () => !this.game.hasWeapon('shotgun')),
        define('lightningWeapon', 'Chain Emitter', 'epic', 'Install chain lightning.', () => this.game.grantWeapon('lightning'), 0.26, () => !this.game.hasWeapon('lightning')),
        define('flame', 'Flamethrower Cone', 'epic', 'Install a close-range inferno cone.', () => this.game.grantWeapon('flamethrower'), 0.3, () => !this.game.hasWeapon('flamethrower')),
        define('rail', 'Piercing Rail Shot', 'epic', 'Install a piercing rail cannon.', () => this.game.grantWeapon('rail'), 0.26, () => !this.game.hasWeapon('rail')),
        define('toxicLauncher', 'Toxic Launcher', 'epic', 'Install toxic payloads.', () => this.game.grantWeapon('toxic'), 0.3, () => !this.game.hasWeapon('toxic')),
        define('extraOrbit', 'Extra Orbiter', 'epic', 'Strengthen your orbiting weapon systems.', () => this.game.player.upgrades.extraOrbit += 1, 0.3),
        define('mineCap', 'Mine Capacity', 'rare', 'Increase mine strength and capacity.', () => this.game.player.upgrades.mineCapacity += 1, 0.36),
        define('shieldRecharge', 'Shield Recharge', 'rare', 'Gain armor and regen.', () => { this.game.player.armor += 1.5; this.game.player.regeneration += 0.35; }, 0.38),
        define('regenBoost', 'Regen Boost', 'rare', 'Significantly improve regeneration.', () => this.game.player.regeneration += 0.55, 0.35),
        define('magnetPulse', 'Magnet Pulse', 'epic', 'Pull distant XP more aggressively.', () => { this.game.player.magnetPulse += 1; this.game.player.pickupRadius += 45; }, 0.24),
        define('levelLightning', 'Level-Up Strike', 'legendary', 'Call lightning around you now and on later level-ups.', () => { this.game.levelUpStorm += 1; this.game.castLevelLightning(); }, 0.1),
        define('vengeance', 'Vengeance Burst', 'epic', 'Release a blast when hit.', () => this.game.player.vengeanceBurst += 1, 0.24),
        define('revive', 'Emergency Revive', 'legendary', 'Revive once after death.', () => this.game.player.revive += 1, 0.09),
        define('xpBoost', 'Bonus XP Gain', 'rare', 'Collect XP faster for the rest of the run.', () => this.game.player.xpGain += 0.12, 0.42),
        define('legendDamage', 'Overclock Core', 'legendary', 'Massive damage, crit, and speed boost.', () => { this.game.player.damageMultiplier += 0.42; this.game.player.critChance += 0.12; this.game.player.speed += 32; }, 0.08),
      ];
    }
    getChoices() {
      const available = this.pool.filter((entry) => !this.game.takenUpgrades.has(entry.id) && (!entry.condition || entry.condition()));
      const picks = [];
      while (picks.length < 3 && available.length) {
        const total = available.reduce((sum, item) => sum + item.weight * RARITY_STYLE[item.rarity].weight, 0);
        let roll = Math.random() * total;
        let selectedIndex = 0;
        for (let i = 0; i < available.length; i += 1) {
          roll -= available[i].weight * RARITY_STYLE[available[i].rarity].weight;
          if (roll <= 0) { selectedIndex = i; break; }
        }
        picks.push(available.splice(selectedIndex, 1)[0]);
      }
      return picks;
    }
  }

  class HazardManager {
    constructor(game) {
      this.game = game;
      this.cooldown = 18;
    }
    update(dt) {
      this.cooldown -= dt;
      if (this.game.elapsed < 55 || this.cooldown > 0) return;
      this.cooldown = rand(16, 28) / (1 + this.game.intensity * 0.03);
      const type = pick(['steam', 'electric', 'laser', 'debris']);
      if (type === 'steam') this.game.hazards.push(new Hazard('steam', rand(180, ARENA_W - 180), rand(180, ARENA_H - 180), 72, 5));
      if (type === 'electric') this.game.hazards.push(new Hazard('electric', rand(220, ARENA_W - 220), rand(200, ARENA_H - 200), 92, 6));
      if (type === 'laser') this.game.hazards.push(new Hazard('laser', rand(240, ARENA_W - 240), rand(220, ARENA_H - 220), 110, 6));
      if (type === 'debris') {
        for (let i = 0; i < 3; i += 1) this.game.hazards.push(new Hazard('fire', rand(160, ARENA_W - 160), rand(160, ARENA_H - 160), 64, 7));
      }
    }
  }

  class Spawner {
    constructor(game) {
      this.game = game;
      this.spawnTimer = 0;
      this.minibossTimer = 70;
      this.bossMilestones = [120, 240, 360];
      this.spawnIndex = 0;
    }
    update(dt) {
      this.spawnTimer -= dt;
      this.minibossTimer -= dt;
      const intensity = this.game.intensity;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.18, 1.25 - intensity * 0.03);
        const amount = 1 + Math.floor(intensity * 0.24);
        for (let i = 0; i < amount; i += 1) this.game.spawnEnemy();
      }
      if (this.minibossTimer <= 0) {
        this.minibossTimer = 78;
        this.game.spawnEnemy('brute', true, true);
      }
      if (this.bossMilestones.length && this.game.elapsed >= this.bossMilestones[0]) {
        this.bossMilestones.shift();
        this.game.spawnBoss();
      }
    }
  }

  class UIManager {
    constructor(game) {
      this.game = game;
      this.el = {
        titleScreen: document.getElementById('titleScreen'),
        metaScreen: document.getElementById('metaScreen'),
        helpScreen: document.getElementById('helpScreen'),
        levelUpScreen: document.getElementById('levelUpScreen'),
        pauseScreen: document.getElementById('pauseScreen'),
        gameOverScreen: document.getElementById('gameOverScreen'),
        hud: document.getElementById('hud'),
        hpFill: document.getElementById('hpFill'),
        xpFill: document.getElementById('xpFill'),
        hpText: document.getElementById('hpText'),
        xpText: document.getElementById('xpText'),
        timerText: document.getElementById('timerText'),
        killsText: document.getElementById('killsText'),
        scoreText: document.getElementById('scoreText'),
        waveText: document.getElementById('waveText'),
        weaponList: document.getElementById('weaponList'),
        passiveList: document.getElementById('passiveList'),
        weaponCountText: document.getElementById('weaponCountText'),
        passiveCountText: document.getElementById('passiveCountText'),
        dashCooldownText: document.getElementById('dashCooldownText'),
        upgradeChoices: document.getElementById('upgradeChoices'),
        summaryGrid: document.getElementById('summaryGrid'),
        gameOverTitle: document.getElementById('gameOverTitle'),
        bestTimeStat: document.getElementById('bestTimeStat'),
        bestScoreStat: document.getElementById('bestScoreStat'),
        currencyStat: document.getElementById('currencyStat'),
        metaCurrency: document.getElementById('metaCurrency'),
        metaGrid: document.getElementById('metaGrid'),
        skinStatus: document.getElementById('skinStatus'),
        touchUi: document.getElementById('touchUi'),
      };
      this.bind();
      this.renderMeta();
      this.syncTitleStats();
    }
    bind() {
      document.getElementById('playButton').addEventListener('click', () => this.game.startRun());
      document.getElementById('metaButton').addEventListener('click', () => this.show('metaScreen'));
      document.getElementById('postRunMetaButton').addEventListener('click', () => { this.hide('gameOverScreen'); this.show('metaScreen'); });
      document.getElementById('helpButton').addEventListener('click', () => this.show('helpScreen'));
      document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => this.hide(button.dataset.close)));
      document.getElementById('pauseButton').addEventListener('click', () => this.game.togglePause());
      document.getElementById('muteButton').addEventListener('click', () => this.game.toggleMute());
      document.getElementById('dashButton').addEventListener('click', () => this.game.tryDash());
      document.getElementById('resumeButton').addEventListener('click', () => this.game.togglePause(false));
      document.getElementById('quitButton').addEventListener('click', () => this.game.returnToTitle());
      document.getElementById('restartButton').addEventListener('click', () => this.game.startRun());
    }
    show(id) { document.getElementById(id).classList.add('active'); }
    hide(id) { document.getElementById(id).classList.remove('active'); }
    showOnly(id) {
      ['titleScreen', 'metaScreen', 'helpScreen', 'levelUpScreen', 'pauseScreen', 'gameOverScreen'].forEach((key) => this.hide(key));
      if (id) this.show(id);
    }
    setHUD(visible) {
      this.el.hud.classList.toggle('hidden', !visible);
      this.el.touchUi.classList.toggle('hidden', !visible || !('ontouchstart' in window || navigator.maxTouchPoints > 0));
    }
    updateHUD() {
      const p = this.game.player;
      if (!p) return;
      this.el.hpFill.style.width = `${(p.hp / p.maxHp) * 100}%`;
      this.el.xpFill.style.width = `${(this.game.xp / this.game.xpNext) * 100}%`;
      this.el.hpText.textContent = `${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;
      this.el.xpText.textContent = `Lv ${this.game.level}`;
      this.el.timerText.textContent = formatTime(this.game.elapsed);
      this.el.killsText.textContent = `${this.game.kills}`;
      this.el.scoreText.textContent = `${this.game.score}`;
      this.el.waveText.textContent = this.game.intensityLabel();
      this.el.dashCooldownText.textContent = p.dashCooldown <= 0 ? 'Dash Ready' : `Dash ${p.dashCooldown.toFixed(1)}s`;
      this.el.weaponCountText.textContent = `${p.weapons.length} online`;
      this.el.passiveCountText.textContent = `${this.game.takenUpgrades.size} active`;
      this.el.weaponList.innerHTML = p.weapons.map((w) => `<span class="weapon-pill">${WEAPON_DEFS[w.type]?.label || w.type} Lv${w.level}</span>`).join('');
      const passiveNames = [...this.game.takenUpgradeTitles].slice(-10);
      this.el.passiveList.innerHTML = passiveNames.length ? passiveNames.map((label) => `<span class="passive-pill">${label}</span>`).join('') : '<span class="passive-pill">No passives yet</span>';
    }
    showLevelUp(choices) {
      this.el.upgradeChoices.innerHTML = choices.map((choice, index) => `
        <article class="upgrade-card ${choice.rarity}">
          <h3>${choice.title}</h3>
          <p>${choice.desc}</p>
          <div class="rarity">${RARITY_STYLE[choice.rarity].label}</div>
          <button class="primary-button" data-upgrade-index="${index}">Choose</button>
        </article>
      `).join('');
      this.el.upgradeChoices.querySelectorAll('[data-upgrade-index]').forEach((button) => {
        button.addEventListener('click', () => this.game.chooseUpgrade(choices[Number(button.dataset.upgradeIndex)]));
      });
      this.show('levelUpScreen');
    }
    renderMeta() {
      const defs = [
        { id: 'startingHp', label: 'Reinforced Plating', desc: '+16 starting HP per rank.', cost: (lvl) => 14 + lvl * 18, max: 5 },
        { id: 'startingDamage', label: 'Calibrated Core', desc: '+8% starting damage per rank.', cost: (lvl) => 16 + lvl * 20, max: 5 },
        { id: 'xpGain', label: 'Analyzer Suite', desc: '+6% XP gain per rank.', cost: (lvl) => 12 + lvl * 16, max: 5 },
        { id: 'moveSpeed', label: 'Servo Actuators', desc: '+12 move speed per rank.', cost: (lvl) => 12 + lvl * 16, max: 5 },
        { id: 'shielding', label: 'Aegis Mesh', desc: '+2 armor per rank.', cost: (lvl) => 18 + lvl * 22, max: 4 },
        { id: 'unlockShotgun', label: 'Unlock Shotgun', desc: 'Start with the shotgun available.', cost: () => 65, max: 1 },
        { id: 'unlockLightning', label: 'Unlock Chain Emitter', desc: 'Start with chain lightning available.', cost: () => 85, max: 1 },
        { id: 'unlockSkinAmber', label: 'Amber Skin', desc: 'Unlock a cosmetic amber survivor shell.', cost: () => 45, max: 1 },
      ];
      this.el.metaGrid.innerHTML = defs.map((entry) => {
        const level = this.game.meta.meta[entry.id] || 0;
        const maxed = level >= entry.max;
        const cost = entry.cost(level);
        return `
          <article class="meta-card ${maxed ? 'locked' : ''}">
            <h3>${entry.label}</h3>
            <p>${entry.desc}</p>
            <div class="cost">${maxed ? 'Maxed' : `Cost: ${cost} alloy`}</div>
            <div class="chip">Rank ${level}/${entry.max}</div>
            <button class="secondary-button" data-meta-id="${entry.id}" ${maxed ? 'disabled' : ''}>${maxed ? 'Purchased' : 'Buy'}</button>
          </article>
        `;
      }).join('');
      this.el.metaGrid.querySelectorAll('[data-meta-id]').forEach((button) => button.addEventListener('click', () => this.game.buyMeta(button.dataset.metaId)));
      this.syncTitleStats();
    }
    syncTitleStats() {
      this.el.bestTimeStat.textContent = formatTime(this.game.meta.bestTime || 0);
      this.el.bestScoreStat.textContent = `${this.game.meta.bestScore || 0}`;
      this.el.currencyStat.textContent = `${this.game.meta.currency || 0}`;
      this.el.metaCurrency.textContent = `${this.game.meta.currency || 0}`;
      this.el.skinStatus.textContent = this.game.meta.meta.unlockSkinAmber ? 'Amber Shell unlocked' : 'Default';
    }
    showGameOver(summary) {
      this.el.gameOverTitle.textContent = summary.title;
      this.el.summaryGrid.innerHTML = Object.entries(summary.stats).map(([label, value]) => `<article class="summary-item"><span>${label}</span><strong>${value}</strong></article>`).join('');
      this.show('gameOverScreen');
      this.syncTitleStats();
    }
  }

  class Renderer {
    constructor(canvas, game) {
      this.canvas = canvas;
      this.game = game;
      this.ctx = canvas.getContext('2d');
      this.camera = { x: ARENA_W / 2, y: ARENA_H / 2, zoom: 1, vw: window.innerWidth, vh: window.innerHeight };
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(window.innerWidth * dpr);
      this.canvas.height = Math.round(window.innerHeight * dpr);
      this.canvas.style.width = `${window.innerWidth}px`;
      this.canvas.style.height = `${window.innerHeight}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.camera.vw = window.innerWidth;
      this.camera.vh = window.innerHeight;
    }
    updateCamera(dt) {
      if (!this.game.player) return;
      const zoomTarget = Math.max(0.56, Math.min(0.9, Math.min(this.camera.vw / ARENA_W * 1.5, this.camera.vh / ARENA_H * 1.45)));
      this.camera.zoom = lerp(this.camera.zoom, zoomTarget, 0.08);
      this.camera.x = lerp(this.camera.x, this.game.player.x, 0.08);
      this.camera.y = lerp(this.camera.y, this.game.player.y, 0.08);
    }
    worldToScreen(x, y) {
      return { x: (x - this.camera.x) * this.camera.zoom + this.camera.vw / 2, y: (y - this.camera.y) * this.camera.zoom + this.camera.vh / 2 };
    }
    render(dt) {
      this.updateCamera(dt);
      const ctx = this.ctx;
      const shakeX = rand(-this.game.shake, this.game.shake) * 0.2;
      const shakeY = rand(-this.game.shake, this.game.shake) * 0.2;
      this.game.shake *= 0.88;
      ctx.clearRect(0, 0, this.camera.vw, this.camera.vh);
      ctx.save();
      ctx.translate(shakeX, shakeY);
      this.drawBackground(ctx);
      ctx.save();
      ctx.translate(this.camera.vw / 2, this.camera.vh / 2);
      ctx.scale(this.camera.zoom, this.camera.zoom);
      ctx.translate(-this.camera.x, -this.camera.y);
      this.drawArena(ctx);
      this.drawHazards(ctx);
      this.drawXP(ctx);
      this.drawProjectiles(ctx, this.game.projectiles);
      this.drawProjectiles(ctx, this.game.enemyProjectiles);
      this.drawEnemies(ctx);
      this.drawBoss(ctx);
      this.drawPlayer(ctx);
      this.drawWeaponAuras(ctx);
      this.game.particles.render(ctx, { ...this.camera, vw: this.camera.vw, vh: this.camera.vh });
      ctx.restore();
      this.drawBossBar(ctx);
      ctx.restore();
    }
    drawBackground(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, this.camera.vh);
      g.addColorStop(0, '#0e1525');
      g.addColorStop(0.4, '#06090f');
      g.addColorStop(1, '#020307');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.camera.vw, this.camera.vh);
      for (let i = 0; i < 12; i += 1) {
        const x = ((i * 260 + this.game.time * 18) % (this.camera.vw + 340)) - 170;
        ctx.fillStyle = 'rgba(255,168,80,0.04)';
        ctx.beginPath();
        ctx.arc(x, 100 + i * 70, 60 + (i % 4) * 18, 0, TAU);
        ctx.fill();
      }
    }
    drawArena(ctx) {
      ctx.fillStyle = '#101624';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      for (let i = 0; i < 24; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(0, i * 60, ARENA_W, 28);
      }
      ctx.strokeStyle = '#293346';
      ctx.lineWidth = 40;
      ctx.strokeRect(18, 18, ARENA_W - 36, ARENA_H - 36);
      for (let i = 0; i < 10; i += 1) {
        const y = 100 + i * 128 + Math.sin(this.game.time + i) * 3;
        ctx.strokeStyle = 'rgba(99,120,156,0.22)';
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(ARENA_W - 50, y); ctx.stroke();
      }
      for (let i = 0; i < 7; i += 1) {
        const x = 140 + i * 300;
        ctx.fillStyle = 'rgba(255,184,87,0.12)';
        ctx.fillRect(x, 20, 24, 84);
        ctx.fillRect(x, ARENA_H - 104, 24, 84);
      }
      for (let i = 0; i < 4; i += 1) {
        const fanX = 320 + i * 520;
        const fanY = i % 2 === 0 ? 110 : ARENA_H - 110;
        ctx.save();
        ctx.translate(fanX, fanY);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.stroke();
        for (let b = 0; b < 4; b += 1) {
          ctx.rotate(this.game.time * 0.8 + b * (TAU / 4));
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(0, -5, 24, 10);
        }
        ctx.restore();
      }
    }
    drawPlayer(ctx) {
      const p = this.game.player;
      if (!p) return;
      const bob = Math.sin(p.bob) * 2;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.rotate(p.facing);
      ctx.shadowBlur = 16;
      ctx.shadowColor = p.skin === 'amber' ? '#ffbf6d' : '#71d8ff';
      ctx.fillStyle = p.skin === 'amber' ? '#ffbf6d' : '#8fdcff';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(4, 0, p.radius * 0.62, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#dceaff';
      ctx.fillRect(8, -4, 22, 8);
      ctx.fillStyle = p.flash > 0 ? '#fff1cf' : '#1f2e43';
      ctx.beginPath();
      ctx.moveTo(-14, -18);
      ctx.lineTo(10, 0);
      ctx.lineTo(-14, 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    drawEnemies(ctx) {
      for (const e of this.game.enemies) {
        ctx.save();
        ctx.globalAlpha = e.alpha;
        ctx.translate(e.x, e.y);
        if (e.telegraph > 0) {
          ctx.strokeStyle = `rgba(255,190,90,${e.telegraph})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, e.radius + 18 + Math.sin(this.game.time * 20) * 4, 0, TAU); ctx.stroke();
        }
        ctx.shadowBlur = e.elite ? 18 : 10;
        ctx.shadowColor = e.color;
        ctx.fillStyle = e.flash > 0 ? '#fff4cb' : e.color;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-e.radius * 0.5, -4, e.radius, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(-e.radius * 0.7, e.radius + 10, e.radius * 1.4, 5);
        ctx.fillStyle = e.elite ? '#ffe18c' : '#9fe6ff';
        ctx.fillRect(-e.radius * 0.7, e.radius + 10, e.radius * 1.4 * Math.max(0, e.hp / e.maxHp), 5);
        if (e.shielded) {
          ctx.strokeStyle = 'rgba(120,220,255,0.8)';
          ctx.beginPath(); ctx.arc(0, 0, e.radius + 6, 0, TAU); ctx.stroke();
        }
        ctx.restore();
      }
    }
    drawBoss(ctx) {
      const boss = this.game.boss;
      if (!boss || boss.dead) return;
      if (boss.type === 'voltSerpent' && boss.segments.length) {
        for (const seg of boss.segments) {
          ctx.save(); ctx.translate(seg.x, seg.y); ctx.fillStyle = 'rgba(116,220,255,0.75)'; ctx.beginPath(); ctx.arc(0, 0, seg.r, 0, TAU); ctx.fill(); ctx.restore();
        }
      }
    }
    drawBossBar(ctx) {
      const boss = this.game.boss;
      if (!boss || boss.dead) return;
      const w = Math.min(620, this.camera.vw - 80);
      const x = (this.camera.vw - w) / 2;
      const y = 24;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y, w, 18);
      ctx.fillStyle = boss.color;
      ctx.fillRect(x, y, w * Math.max(0, boss.hp / boss.maxHp), 18);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(x, y, w, 18);
      ctx.fillStyle = '#fff'; ctx.font = '600 14px Inter, sans-serif'; ctx.fillText(boss.name, x, y - 6);
    }
    drawProjectiles(ctx, projectiles) {
      for (const p of projectiles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.rail ? 18 : 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    drawXP(ctx) {
      for (const gem of this.game.gems) {
        ctx.save();
        ctx.translate(gem.x, gem.y);
        ctx.rotate(gem.spin);
        ctx.fillStyle = '#6df6ff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#6df6ff';
        ctx.beginPath();
        ctx.moveTo(0, -gem.radius);
        ctx.lineTo(gem.radius * 0.8, 0);
        ctx.lineTo(0, gem.radius);
        ctx.lineTo(-gem.radius * 0.8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    drawHazards(ctx) {
      for (const h of this.game.hazards) {
        ctx.save(); ctx.translate(h.x, h.y);
        const color = h.type === 'steam' ? '#d1e8ff' : h.type === 'electric' ? '#6de0ff' : h.type === 'laser' ? '#ff6468' : '#ff9358';
        ctx.globalAlpha = 0.26 + Math.sin(this.game.time * 6 + h.x * 0.01) * 0.08;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(0, 0, h.radius, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, h.radius - 8, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
    drawWeaponAuras(ctx) {
      const player = this.game.player;
      if (!player) return;
      const saw = player.weapons.find((w) => w.type === 'saw');
      if (saw) {
        const count = 2 + player.upgrades.extraOrbit;
        for (let i = 0; i < count; i += 1) {
          const ang = saw.orbitAngle + (TAU / count) * i;
          const x = player.x + Math.cos(ang) * 86;
          const y = player.y + Math.sin(ang) * 86;
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.game.time * 12 + i);
          ctx.fillStyle = '#cfd6e0'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
          for (let t = 0; t < 8; t += 1) { ctx.rotate(TAU / 8); ctx.fillRect(12, -2, 8, 4); }
          ctx.restore();
        }
      }
      const orb = player.weapons.find((w) => w.type === 'orb');
      if (orb) {
        const count = 3 + player.upgrades.extraOrbit;
        for (let i = 0; i < count; i += 1) {
          const ang = orb.orbitAngle * 1.3 + (TAU / count) * i;
          const x = player.x + Math.cos(ang) * 112;
          const y = player.y + Math.sin(ang) * 112;
          ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#86cfff'; ctx.shadowBlur = 14; ctx.shadowColor = '#86cfff'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill(); ctx.restore();
        }
      }
      for (const mine of this.game.mines) {
        ctx.save(); ctx.translate(mine.x, mine.y); ctx.fillStyle = '#d1a4ff'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke(); ctx.restore();
      }
    }
  }

  class Game {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.meta = SaveManager.load();
      this.audio = new AudioManager();
      this.input = new InputManager(this);
      this.particles = new ParticleSystem();
      this.renderer = new Renderer(this.canvas, this);
      this.ui = new UIManager(this);
      this.touch = new TouchControls(this, this.input);
      this.state = 'title';
      this.player = null;
      this.enemies = [];
      this.projectiles = [];
      this.enemyProjectiles = [];
      this.gems = [];
      this.hazards = [];
      this.mines = [];
      this.boss = null;
      this.spawner = null;
      this.hazardManager = null;
      this.upgrades = new UpgradeSystem(this);
      this.pendingChoices = [];
      this.takenUpgrades = new Set();
      this.takenUpgradeTitles = new Set();
      this.time = 0;
      this.elapsed = 0;
      this.level = 1;
      this.xp = 0;
      this.xpNext = 18;
      this.score = 0;
      this.kills = 0;
      this.shake = 0;
      this.levelUpStorm = 0;
      this.summaryReason = 'Overrun';
      this.lastFrame = performance.now();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }
    inRun() { return ['running', 'paused', 'levelup'].includes(this.state); }
    startRun() {
      this.audio.unlock();
      this.player = new Player(this);
      this.player.skin = this.meta.meta.unlockSkinAmber ? 'amber' : 'default';
      this.enemies = [];
      this.projectiles = [];
      this.enemyProjectiles = [];
      this.gems = [];
      this.hazards = [];
      this.mines = [];
      this.boss = null;
      this.spawner = new Spawner(this);
      this.hazardManager = new HazardManager(this);
      this.pendingChoices = [];
      this.takenUpgrades = new Set();
      this.takenUpgradeTitles = new Set();
      this.time = 0;
      this.elapsed = 0;
      this.level = 1;
      this.xp = 0;
      this.xpNext = 18;
      this.score = 0;
      this.kills = 0;
      this.state = 'running';
      this.ui.showOnly('');
      this.ui.hide('gameOverScreen');
      this.ui.setHUD(true);
      this.touch.refresh();
      this.ui.updateHUD();
    }
    returnToTitle() {
      this.state = 'title';
      this.ui.showOnly('titleScreen');
      this.ui.setHUD(false);
      this.touch.refresh();
    }
    togglePause(force = null) {
      if (!this.inRun() || this.state === 'levelup') return;
      if (force === false || this.state === 'paused') {
        this.state = 'running';
        this.ui.hide('pauseScreen');
      } else if (this.state === 'running') {
        this.state = 'paused';
        this.ui.show('pauseScreen');
      }
    }
    toggleMute() {
      this.audio.setEnabled(!this.audio.enabled);
      this.audio.ui();
    }
    intensityLabel() {
      if (this.intensity < 6) return 'Calm';
      if (this.intensity < 12) return 'Heating';
      if (this.intensity < 18) return 'Swarming';
      if (this.intensity < 24) return 'Critical';
      return 'Cataclysm';
    }
    get intensity() { return Math.floor(this.elapsed / 15) + this.level * 0.65; }
    gainXP(amount) {
      this.xp += amount * (1 + this.player.xpGain);
      while (this.xp >= this.xpNext) {
        this.xp -= this.xpNext;
        this.level += 1;
        this.xpNext = Math.round(this.xpNext * 1.25 + 8);
        this.triggerLevelUp();
      }
    }
    triggerLevelUp() {
      this.audio.levelUp();
      this.pendingChoices = this.upgrades.getChoices();
      this.state = 'levelup';
      this.castLevelLightning();
      this.ui.showLevelUp(this.pendingChoices);
    }
    castLevelLightning() {
      const hits = 5 + this.levelUpStorm * 2;
      for (let i = 0; i < hits; i += 1) {
        const target = this.enemies[(Math.random() * this.enemies.length) | 0];
        if (!target) break;
        target.takeDamage(22 + this.levelUpStorm * 12, this);
        this.particles.emit(target.x, target.y, { count: 8, color: '#7de2ff', minSpeed: 40, maxSpeed: 160, lifeMin: 0.16, lifeMax: 0.35, glow: 12 });
      }
    }
    chooseUpgrade(choice) {
      if (!choice) return;
      choice.apply();
      this.takenUpgrades.add(choice.id);
      this.takenUpgradeTitles.add(choice.title);
      const weapon = this.player.weapons.find((w) => choice.id.includes(w.type));
      if (weapon) weapon.level += 1;
      this.state = 'running';
      this.ui.hide('levelUpScreen');
      this.ui.updateHUD();
    }
    grantWeapon(type) {
      const existing = this.player.weapons.find((w) => w.type === type);
      if (existing) existing.level += 1;
      else this.player.weapons.push(new WeaponSystem(this, this.player, type));
    }
    hasWeapon(type) { return this.player && this.player.weapons.some((w) => w.type === type); }
    tryDash() {
      if (!this.player || this.player.dashCooldown > 0 || !this.inRun()) return;
      this.player.dashCooldown = 5.2;
      this.player.dashTime = 0.26;
      this.player.invuln = 0.34;
      this.shake += 3;
      this.particles.emit(this.player.x, this.player.y, { count: 14, color: '#ffe08b', minSpeed: 40, maxSpeed: 210, lifeMin: 0.18, lifeMax: 0.35 });
    }
    spawnEnemy(forcedType = null, eliteChanceBoost = false, guaranteedElite = false) {
      const edge = (Math.random() * 4) | 0;
      const pos = [{ x: rand(80, ARENA_W - 80), y: 60 }, { x: ARENA_W - 60, y: rand(80, ARENA_H - 80) }, { x: rand(80, ARENA_W - 80), y: ARENA_H - 60 }, { x: 60, y: rand(80, ARENA_H - 80) }][edge];
      if (distance(pos, this.player) < 300) return;
      const pool = this.elapsed < 45 ? ['crawler', 'swarmer'] : this.elapsed < 90 ? ['crawler', 'brute', 'spitter', 'swarmer'] : ['crawler', 'brute', 'spitter', 'phantom', 'kamikaze', 'swarmer', 'shield'];
      const type = forcedType || pick(pool);
      const elite = guaranteedElite || Math.random() < (eliteChanceBoost ? 0.3 : 0.08 + this.elapsed / 600);
      this.enemies.push(new Enemy(type, pos.x, pos.y, this.intensity, elite));
      if (type === 'swarmer') {
        for (let i = 0; i < 2 + (Math.random() * 3 | 0); i += 1) this.enemies.push(new Enemy('swarmer', pos.x + rand(-40, 40), pos.y + rand(-40, 40), this.intensity, false));
      }
    }
    spawnBoss() {
      if (this.boss && !this.boss.dead) return;
      const type = pick(['ironWarden', 'voltSerpent', 'furnaceCore']);
      this.boss = new Boss(type, ARENA_W / 2 + rand(-120, 120), 180, this.intensity);
      this.audio.bossWarning();
      this.particles.text(this.player.x, this.player.y - 80, `${this.boss.name} approaching`, '#ffcc7f');
    }
    spawnXP(x, y, amount) {
      const count = Math.max(1, Math.round(amount / 5));
      for (let i = 0; i < count; i += 1) this.gems.push(new XPGem(x + rand(-14, 14), y + rand(-14, 14), Math.max(1, amount / count)));
    }
    findNearestEnemy(origin, range) {
      let best = null; let bestDist = range;
      const all = this.boss && !this.boss.dead ? [...this.enemies, this.boss] : this.enemies;
      for (const enemy of all) {
        const d = distance(origin, enemy);
        if (d < bestDist) { best = enemy; bestDist = d; }
      }
      return best;
    }
    findShieldTarget(drone) {
      return this.enemies.filter((e) => e !== drone && !e.dead).sort((a, b) => b.maxHp - a.maxHp)[0] || this.boss;
    }
    applyShieldAura(drone) {
      for (const e of [...this.enemies, this.boss].filter(Boolean)) if (distance(e, drone) < 130) e.shielded = true;
    }
    computeEnemySeparation(enemy) {
      let sx = 0; let sy = 0;
      for (const other of this.enemies) {
        if (other === enemy || other.dead) continue;
        const dx = enemy.x - other.x;
        const dy = enemy.y - other.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < enemy.radius + other.radius + 18) { sx += dx / d; sy += dy / d; }
      }
      return { x: sx, y: sy };
    }
    placeMine(x, y, damage) {
      this.mines.push({ x, y, radius: 22 + this.player.upgrades.mineCapacity * 8, damage, life: 18 });
    }
    explodeEnemy(enemy, damage, radius, color) {
      this.explodeAt(enemy.x, enemy.y, radius, damage, color);
    }
    explodeAt(x, y, radius, damage, color) {
      for (const enemy of this.enemies) if (!enemy.dead && Math.hypot(enemy.x - x, enemy.y - y) < radius) enemy.takeDamage(damage, this);
      if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - x, this.boss.y - y) < radius + this.boss.radius) this.boss.takeDamage(damage, this);
      this.particles.emit(x, y, { count: 18, color, minSpeed: 50, maxSpeed: 220, lifeMin: 0.18, lifeMax: 0.5, glow: 14 });
      this.shake += 6;
    }
    endRun(reason) {
      if (this.state === 'gameover') return;
      this.state = 'gameover';
      this.summaryReason = reason;
      this.audio.gameOver();
      this.ui.setHUD(false);
      const alloy = Math.round(this.kills * 0.55 + this.level * 4 + this.elapsed * 0.3 + (this.boss && this.boss.dead ? 28 : 0));
      this.meta.currency += alloy;
      this.meta.totalRuns += 1;
      this.meta.bestScore = Math.max(this.meta.bestScore, this.score);
      this.meta.bestTime = Math.max(this.meta.bestTime, Math.floor(this.elapsed));
      this.meta.selectedSkin = this.meta.meta.unlockSkinAmber ? 'amber' : 'default';
      SaveManager.save(this.meta);
      this.ui.showGameOver({
        title: `${reason}`,
        stats: {
          Time: formatTime(this.elapsed),
          Score: this.score,
          Kills: this.kills,
          Level: this.level,
          Alloy: `+${alloy}`,
          Weapons: this.player ? this.player.weapons.length : 0,
        },
      });
      this.ui.renderMeta();
    }
    buyMeta(id) {
      const defs = {
        startingHp: (lvl) => 14 + lvl * 18,
        startingDamage: (lvl) => 16 + lvl * 20,
        xpGain: (lvl) => 12 + lvl * 16,
        moveSpeed: (lvl) => 12 + lvl * 16,
        shielding: (lvl) => 18 + lvl * 22,
        unlockShotgun: () => 65,
        unlockLightning: () => 85,
        unlockSkinAmber: () => 45,
      };
      const limits = { startingHp: 5, startingDamage: 5, xpGain: 5, moveSpeed: 5, shielding: 4, unlockShotgun: 1, unlockLightning: 1, unlockSkinAmber: 1 };
      const level = this.meta.meta[id] || 0;
      if (level >= limits[id]) return;
      const cost = defs[id](level);
      if (this.meta.currency < cost) return;
      this.meta.currency -= cost;
      this.meta.meta[id] += 1;
      SaveManager.save(this.meta);
      this.ui.renderMeta();
      this.audio.ui();
    }
    processProjectiles(list, dt) {
      for (const projectile of list) projectile.update(dt, this);
      for (const projectile of list) {
        if (projectile.dead) continue;
        const targets = projectile.source === 'enemy' ? [this.player] : [...this.enemies, ...(this.boss && !this.boss.dead ? [this.boss] : [])];
        for (const target of targets) {
          if (!target || target.dead) continue;
          if (Math.hypot(projectile.x - target.x, projectile.y - target.y) < projectile.radius + target.radius) {
            if (projectile.source === 'enemy') {
              this.player.takeDamage(projectile.damage, { source: 'Projectile' });
            } else {
              let damage = projectile.damage;
              let textColor = '#ffe28d';
              if (Math.random() < this.player.critChance) { damage *= this.player.critDamage; textColor = '#ffad6d'; }
              target.takeDamage(damage, this);
              if (projectile.status === 'burn' || Math.random() < this.player.burnChance) target.status.burn = Math.max(target.status.burn, 1.8);
              if (projectile.status === 'poison' || Math.random() < this.player.poisonChance) target.status.poison = Math.max(target.status.poison, 2.8);
              if (Math.random() < this.player.slowChance) target.status.slow = Math.max(target.status.slow, 1.1);
              if (Math.random() < this.player.freezeChance) target.status.freeze = Math.max(target.status.freeze, 0.85);
              if (Math.random() < this.player.chainChance) {
                const weapon = this.player.weapons.find((w) => w.type === 'lightning') || new WeaponSystem(this, this.player, 'lightning');
                weapon.chainHit(target, damage * 0.4, 2);
              }
              if (projectile.splash > 0) this.explodeAt(projectile.x, projectile.y, projectile.splash, damage * 0.35, projectile.color);
              this.particles.text(target.x, target.y - 10, `${Math.round(damage)}`, textColor);
              this.particles.emit(projectile.x, projectile.y, { count: 5, color: projectile.color, minSpeed: 12, maxSpeed: 80, lifeMin: 0.1, lifeMax: 0.18 });
            }
            projectile.pierce -= 1;
            if (projectile.pierce < 0) projectile.dead = true;
            break;
          }
        }
      }
    }
    updateMines(dt) {
      for (const mine of this.mines) {
        mine.life -= dt;
        const enemy = this.enemies.find((e) => !e.dead && distance(e, mine) < mine.radius + e.radius + 10);
        if (enemy) { this.explodeAt(mine.x, mine.y, 86, mine.damage, '#d79cff'); mine.life = 0; }
      }
      this.mines = this.mines.filter((m) => m.life > 0);
    }
    updateOrbitals(dt) {
      const saw = this.player.weapons.find((w) => w.type === 'saw');
      if (saw) {
        const count = 2 + this.player.upgrades.extraOrbit;
        for (let i = 0; i < count; i += 1) {
          const ang = saw.orbitAngle + (TAU / count) * i;
          const x = this.player.x + Math.cos(ang) * 86;
          const y = this.player.y + Math.sin(ang) * 86;
          for (const enemy of this.enemies) if (!enemy.dead && Math.hypot(enemy.x - x, enemy.y - y) < enemy.radius + 14) enemy.takeDamage(18 * dt * saw.level, this, false);
          if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - x, this.boss.y - y) < this.boss.radius + 14) this.boss.takeDamage(18 * dt * saw.level, this, false);
        }
      }
      const orb = this.player.weapons.find((w) => w.type === 'orb');
      if (orb) {
        const count = 3 + this.player.upgrades.extraOrbit;
        for (let i = 0; i < count; i += 1) {
          const ang = orb.orbitAngle * 1.3 + (TAU / count) * i;
          const x = this.player.x + Math.cos(ang) * 112;
          const y = this.player.y + Math.sin(ang) * 112;
          for (const enemy of this.enemies) if (!enemy.dead && Math.hypot(enemy.x - x, enemy.y - y) < enemy.radius + 11) enemy.takeDamage(24 * dt * orb.level, this, false);
          if (this.boss && !this.boss.dead && Math.hypot(this.boss.x - x, this.boss.y - y) < this.boss.radius + 11) this.boss.takeDamage(24 * dt * orb.level, this, false);
        }
      }
    }
    update(dt) {
      this.time += dt;
      this.particles.update(dt);
      if (this.state !== 'running') return;
      this.elapsed += dt;
      this.player.update(dt, this.input);
      this.spawner.update(dt);
      this.hazardManager.update(dt);
      this.processProjectiles(this.projectiles, dt);
      this.processProjectiles(this.enemyProjectiles, dt);
      this.updateOrbitals(dt);
      this.updateMines(dt);
      for (const enemy of this.enemies) enemy.shielded = false;
      for (const enemy of this.enemies) enemy.update(dt, this);
      if (this.boss && !this.boss.dead) this.boss.update(dt, this);
      for (const gem of this.gems) gem.update(dt, this);
      for (const hazard of this.hazards) hazard.update(dt, this);
      this.enemies = this.enemies.filter((e) => !e.dead);
      this.projectiles = this.projectiles.filter((p) => !p.dead);
      this.enemyProjectiles = this.enemyProjectiles.filter((p) => !p.dead);
      this.gems = this.gems.filter((g) => !g.dead);
      this.hazards = this.hazards.filter((h) => !h.dead);
      if (this.boss && this.boss.dead) { this.score += 500; this.spawnXP(this.boss.x, this.boss.y, 120); this.boss = null; }
      this.ui.updateHUD();
    }
    loop(now) {
      const dt = Math.min((now - this.lastFrame) / 1000, 0.033);
      this.lastFrame = now;
      this.update(dt);
      this.renderer.render(dt);
      requestAnimationFrame(this.loop);
    }
  }

  const game = new Game();
  window.tunnelSwarm = game;
})();
