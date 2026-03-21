(() => {
  const canvas = document.getElementById('simulation');
  const hint = document.getElementById('hint');
  const fallback = document.getElementById('canvasFallback');

  if (!canvas || !canvas.getContext) {
    fallback?.classList.remove('fallback-hidden');
    return;
  }

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

  if (!ctx) {
    fallback?.classList.remove('fallback-hidden');
    return;
  }

  const config = {
    density: 70000,
    minPoints: 320,
    maxPoints: 1150,
    radiusMin: 0.5,
    radiusMax: 1.7,
    influenceRadius: 170,
    colorRadius: 68,
    haloRadius: 110,
    maxSpeed: 32,
    driftStrength: 5.5,
    homePull: 8,
    friction: 0.9,
    interactionEase: 0.11,
    idleFlicker: 0.12,
    glowAlpha: 0.18,
    colors: {
      rest: [226, 233, 244],
      cool: [112, 225, 240],
      hot: [182, 136, 255],
    },
  };

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    particles: [],
    interaction: {
      active: false,
      engaged: false,
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
    },
    lastTime: performance.now(),
  };

  class Particle {
    constructor(x, y, radius, seed) {
      this.homeX = x;
      this.homeY = y;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.radius = radius;
      this.seed = seed;
      this.phase = Math.random() * Math.PI * 2;
      this.colorMix = 0;
      this.glowMix = 0;
    }

    update(dt, interaction, time) {
      const driftX = Math.cos(time * 0.0004 + this.phase) * config.driftStrength;
      const driftY = Math.sin(time * 0.00055 + this.phase * 1.3) * config.driftStrength;
      const homeDx = this.homeX + driftX - this.x;
      const homeDy = this.homeY + driftY - this.y;

      this.vx += homeDx * config.homePull * dt;
      this.vy += homeDy * config.homePull * dt;

      let targetColorMix = 0;
      let targetGlowMix = 0;

      if (interaction.active) {
        const dx = interaction.x - this.x;
        const dy = interaction.y - this.y;
        const distSq = dx * dx + dy * dy;
        const maxInfluence = config.influenceRadius;

        if (distSq < maxInfluence * maxInfluence) {
          const dist = Math.sqrt(distSq) || 0.001;
          const normalized = 1 - dist / maxInfluence;
          const ease = normalized * normalized;
          const attraction = ease * 18;
          this.vx += (dx / dist) * attraction * dt * 60;
          this.vy += (dy / dist) * attraction * dt * 60;

          if (dist < config.colorRadius) {
            targetColorMix = 1 - dist / config.colorRadius;
          } else {
            targetColorMix = normalized * 0.35;
          }

          if (dist < config.haloRadius) {
            targetGlowMix = 1 - dist / config.haloRadius;
          }
        }
      }

      this.colorMix += (targetColorMix - this.colorMix) * config.interactionEase;
      this.glowMix += (targetGlowMix - this.glowMix) * 0.08;

      this.vx *= Math.pow(config.friction, dt * 60);
      this.vy *= Math.pow(config.friction, dt * 60);

      const speed = Math.hypot(this.vx, this.vy);
      if (speed > config.maxSpeed) {
        const scale = config.maxSpeed / speed;
        this.vx *= scale;
        this.vy *= scale;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    draw(ctx, time) {
      const shimmer = 0.88 + Math.sin(time * 0.002 + this.phase + this.seed) * config.idleFlicker;
      const coolMix = Math.min(1, this.colorMix * 1.15);
      const hotMix = Math.max(0, this.colorMix - 0.45) / 0.55;
      const color = mixPalette(config.colors.rest, config.colors.cool, config.colors.hot, coolMix, hotMix);
      const alpha = 0.3 + this.colorMix * 0.55 + shimmer * 0.15;

      if (this.glowMix > 0.01) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${this.glowMix * config.glowAlpha})`;
        ctx.arc(this.x, this.y, this.radius * (2.6 + this.glowMix * 2.2), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function mixPalette(rest, cool, hot, coolMix, hotMix) {
    const baseToCool = [
      lerp(rest[0], cool[0], coolMix),
      lerp(rest[1], cool[1], coolMix),
      lerp(rest[2], cool[2], coolMix),
    ];

    return [
      Math.round(lerp(baseToCool[0], hot[0], hotMix)),
      Math.round(lerp(baseToCool[1], hot[1], hotMix)),
      Math.round(lerp(baseToCool[2], hot[2], hotMix)),
    ];
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pointCountForArea(area) {
    const preferred = Math.round(area / config.density);
    return clamp(preferred, config.minPoints, config.maxPoints);
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    state.width = width;
    state.height = height;
    state.dpr = dpr;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildParticles();
  }

  function buildParticles() {
    const nextParticles = [];
    const count = pointCountForArea(state.width * state.height);
    const margin = 12;

    for (let i = 0; i < count; i += 1) {
      const x = Math.random() * (state.width - margin * 2) + margin;
      const y = Math.random() * (state.height - margin * 2) + margin;
      const radius = lerp(config.radiusMin, config.radiusMax, Math.pow(Math.random(), 2.4));
      nextParticles.push(new Particle(x, y, radius, i * 0.173));
    }

    state.particles = nextParticles;
  }

  function updateInteractionPosition(x, y) {
    state.interaction.targetX = clamp(x, 0, state.width);
    state.interaction.targetY = clamp(y, 0, state.height);
    if (!state.interaction.engaged) {
      state.interaction.x = state.interaction.targetX;
      state.interaction.y = state.interaction.targetY;
    }
  }

  function beginInteraction(x, y) {
    state.interaction.active = true;
    state.interaction.engaged = true;
    updateInteractionPosition(x, y);
    hint.classList.add('is-hidden');
  }

  function moveInteraction(x, y) {
    if (!state.interaction.engaged) return;
    updateInteractionPosition(x, y);
  }

  function endInteraction() {
    state.interaction.active = false;
    state.interaction.engaged = false;
  }

  function getEventPoint(event) {
    if (event.touches && event.touches[0]) {
      return event.touches[0];
    }
    if (event.changedTouches && event.changedTouches[0]) {
      return event.changedTouches[0];
    }
    return event;
  }

  function onPointerDown(event) {
    const point = getEventPoint(event);
    beginInteraction(point.clientX, point.clientY);
  }

  function onPointerMove(event) {
    const point = getEventPoint(event);
    moveInteraction(point.clientX, point.clientY);
  }

  function onPointerUp() {
    endInteraction();
  }

  function animate(now) {
    const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0.016);
    state.lastTime = now;

    state.interaction.x += (state.interaction.targetX - state.interaction.x) * 0.16;
    state.interaction.y += (state.interaction.targetY - state.interaction.y) * 0.16;

    ctx.clearRect(0, 0, state.width, state.height);

    for (let i = 0; i < state.particles.length; i += 1) {
      const particle = state.particles[i];
      particle.update(dt, state.interaction, now);
      particle.draw(ctx, now);
    }

    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(resize, 120), { passive: true });

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    onPointerDown(event);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!state.interaction.engaged) return;
    event.preventDefault();
    onPointerMove(event);
  });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('pointercancel', onPointerUp, { passive: true });

  canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    onPointerDown(event);
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    onPointerMove(event);
  }, { passive: false });
  window.addEventListener('touchend', onPointerUp, { passive: true });
  window.addEventListener('touchcancel', onPointerUp, { passive: true });

  canvas.addEventListener('mousedown', (event) => {
    event.preventDefault();
    onPointerDown(event);
  });
  window.addEventListener('mousemove', (event) => {
    if ((event.buttons & 1) === 1) {
      moveInteraction(event.clientX, event.clientY);
    }
  }, { passive: true });
  window.addEventListener('mouseup', onPointerUp, { passive: true });

  resize();
  requestAnimationFrame((time) => {
    state.lastTime = time;
    requestAnimationFrame(animate);
  });
})();
