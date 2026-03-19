const canvas = document.getElementById('sim');
const ctx = canvas.getContext('2d');
const stats = document.getElementById('stats');
const overlay = document.getElementById('overlay');

const controls = {
  gravity: document.getElementById('gravity'),
  spawnRate: document.getElementById('spawnRate'),
  bounce: document.getElementById('bounce'),
  drag: document.getElementById('drag'),
  wind: document.getElementById('wind'),
  maxParticles: document.getElementById('maxParticles'),
  colorMode: document.getElementById('colorMode'),
  trails: document.getElementById('trails'),
  attractor: document.getElementById('attractor'),
  autoBurst: document.getElementById('autoBurst'),
  startBtn: document.getElementById('startBtn'),
  burstBtn: document.getElementById('burstBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  demoBtn: document.getElementById('demoBtn'),
  preset: document.getElementById('preset'),
  overlayStartBtn: document.getElementById('overlayStartBtn'),
  overlayDemoBtn: document.getElementById('overlayDemoBtn'),
};

const values = {
  gravity: document.getElementById('gravityValue'),
  spawnRate: document.getElementById('spawnRateValue'),
  bounce: document.getElementById('bounceValue'),
  drag: document.getElementById('dragValue'),
  wind: document.getElementById('windValue'),
  maxParticles: document.getElementById('maxParticlesValue'),
};

const state = {
  particles: [],
  lastTime: 0,
  paused: true,
  started: false,
  mouse: { x: 0, y: 0, active: false },
  burstTimer: 0,
};

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function readParams() {
  return {
    gravity: Number(controls.gravity.value),
    spawnRate: Number(controls.spawnRate.value),
    bounce: Number(controls.bounce.value),
    drag: Number(controls.drag.value),
    wind: Number(controls.wind.value),
    maxParticles: Number(controls.maxParticles.value),
    colorMode: controls.colorMode.value,
    trails: controls.trails.checked,
    attractor: controls.attractor.checked,
    autoBurst: controls.autoBurst.checked,
  };
}

function particleColor(p, mode) {
  if (mode === 'fire') return `hsl(${10 + p.life * 35}, 95%, ${45 + p.life * 15}%)`;
  if (mode === 'ice') return `hsl(${170 + p.life * 45}, 75%, 65%)`;
  if (mode === 'mono') return `hsl(205, 20%, ${35 + p.life * 40}%)`;
  return `hsl(${(p.hue + p.life * 120) % 360}, 90%, 60%)`;
}

function spawnParticle(x = random(0, canvas.clientWidth), y = 20) {
  state.particles.push({
    x,
    y,
    vx: random(-1.5, 1.5),
    vy: random(-0.5, 0.5),
    radius: random(2, 6),
    life: 1,
    hue: random(0, 360),
  });
}

function burst(count = 160, x = canvas.clientWidth / 2, y = canvas.clientHeight / 3) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: random(-5, 5),
      vy: random(-5, 5),
      radius: random(1.8, 5.5),
      life: 1,
      hue: random(0, 360),
    });
  }
}

function drawBackground(params) {
  ctx.fillStyle = params.trails ? 'rgba(8, 10, 20, 0.2)' : '#090b16';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function step(delta, params) {
  for (let i = 0; i < params.spawnRate; i += 1) spawnParticle();

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  state.particles.forEach((p) => {
    p.vy += params.gravity;
    p.vx += params.wind;

    if (params.attractor && state.mouse.active) {
      const dx = state.mouse.x - p.x;
      const dy = state.mouse.y - p.y;
      const dist = Math.hypot(dx, dy) + 0.01;
      const force = Math.min(0.35, 26 / dist);
      p.vx += (dx / dist) * force;
      p.vy += (dy / dist) * force;
    }

    p.vx *= params.drag;
    p.vy *= params.drag;

    p.x += p.vx * delta;
    p.y += p.vy * delta;

    if (p.x < p.radius) {
      p.x = p.radius;
      p.vx *= -params.bounce;
    } else if (p.x > w - p.radius) {
      p.x = w - p.radius;
      p.vx *= -params.bounce;
    }

    if (p.y > h - p.radius) {
      p.y = h - p.radius;
      p.vy *= -params.bounce;
      p.vx *= 0.97;
      p.life -= 0.004 * delta;
    } else if (p.y < p.radius) {
      p.y = p.radius;
      p.vy *= -params.bounce;
    }

    p.life -= 0.0012 * delta;
  });

  if (params.autoBurst) {
    state.burstTimer += delta;
    if (state.burstTimer > 180) {
      burst(random(70, 160), random(80, w - 80), random(40, h * 0.45));
      state.burstTimer = 0;
    }
  }

  state.particles = state.particles.filter((p) => p.life > 0);

  if (state.particles.length > params.maxParticles) {
    state.particles.splice(0, state.particles.length - params.maxParticles);
  }
}

function drawParticles(params) {
  state.particles.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = particleColor(p, params.colorMode);
    ctx.globalAlpha = Math.max(0.2, p.life);
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function updateLabel(id, digits = 2) {
  values[id].textContent = Number(controls[id].value).toFixed(digits);
}

function refreshPrimaryButtons() {
  controls.startBtn.textContent = state.started ? 'Simulation lancée' : 'Démarrer';
  controls.pauseBtn.textContent = state.paused ? 'Reprendre' : 'Pause';
}

function applyPreset(name) {
  const presets = {
    default: { gravity: 0.32, spawnRate: 6, bounce: 0.8, drag: 0.995, wind: 0, maxParticles: 700, colorMode: 'rainbow' },
    moon: { gravity: 0.09, spawnRate: 4, bounce: 0.88, drag: 0.998, wind: 0.02, maxParticles: 500, colorMode: 'ice' },
    storm: { gravity: 0.55, spawnRate: 14, bounce: 0.65, drag: 0.99, wind: 0.16, maxParticles: 1200, colorMode: 'mono' },
    lava: { gravity: 0.42, spawnRate: 12, bounce: 0.8, drag: 0.993, wind: -0.03, maxParticles: 900, colorMode: 'fire' },
  };

  const selected = presets[name];
  if (!selected) return;

  Object.entries(selected).forEach(([key, value]) => {
    controls[key].value = String(value);
  });

  updateLabel('gravity');
  updateLabel('spawnRate', 0);
  updateLabel('bounce');
  updateLabel('drag', 3);
  updateLabel('wind');
  updateLabel('maxParticles', 0);
}

function startSimulation() {
  state.started = true;
  state.paused = false;
  overlay.hidden = true;
  if (state.particles.length === 0) {
    burst(140, canvas.clientWidth / 2, canvas.clientHeight * 0.35);
  }
  refreshPrimaryButtons();
}

function resetSimulation() {
  state.particles = [];
  state.burstTimer = 0;
  state.started = false;
  state.paused = true;
  overlay.hidden = false;
  drawBackground(readParams());
  refreshPrimaryButtons();
}

function launchDemo() {
  applyPreset('storm');
  controls.preset.value = 'storm';
  controls.attractor.checked = true;
  controls.autoBurst.checked = true;
  startSimulation();
  burst(220, canvas.clientWidth * 0.35, canvas.clientHeight * 0.25);
  burst(220, canvas.clientWidth * 0.7, canvas.clientHeight * 0.35);
}

function tick(now) {
  const params = readParams();
  const delta = Math.min(2.4, (now - state.lastTime) / 16.666 || 1);
  state.lastTime = now;

  drawBackground(params);

  if (!state.paused) {
    step(delta, params);
  }

  drawParticles(params);

  const status = state.paused ? 'en pause' : 'en cours';
  stats.textContent = `Particules: ${state.particles.length} | État: ${status}`;
  requestAnimationFrame(tick);
}

window.addEventListener('resize', resize);
canvas.addEventListener('pointermove', (event) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = event.clientX - rect.left;
  state.mouse.y = event.clientY - rect.top;
  state.mouse.active = true;
});
canvas.addEventListener('pointerleave', () => {
  state.mouse.active = false;
});
canvas.addEventListener('pointerdown', (event) => {
  if (!state.started) {
    startSimulation();
  }
  const rect = canvas.getBoundingClientRect();
  burst(180, event.clientX - rect.left, event.clientY - rect.top);
});

controls.gravity.addEventListener('input', () => updateLabel('gravity'));
controls.spawnRate.addEventListener('input', () => updateLabel('spawnRate', 0));
controls.bounce.addEventListener('input', () => updateLabel('bounce'));
controls.drag.addEventListener('input', () => updateLabel('drag', 3));
controls.wind.addEventListener('input', () => updateLabel('wind'));
controls.maxParticles.addEventListener('input', () => updateLabel('maxParticles', 0));

controls.startBtn.addEventListener('click', startSimulation);
controls.overlayStartBtn.addEventListener('click', startSimulation);
controls.burstBtn.addEventListener('click', () => {
  if (!state.started) {
    startSimulation();
  }
  burst();
});
controls.pauseBtn.addEventListener('click', () => {
  if (!state.started) {
    startSimulation();
    return;
  }
  state.paused = !state.paused;
  refreshPrimaryButtons();
});
controls.resetBtn.addEventListener('click', resetSimulation);
controls.demoBtn.addEventListener('click', launchDemo);
controls.overlayDemoBtn.addEventListener('click', launchDemo);
controls.preset.addEventListener('change', () => applyPreset(controls.preset.value));

resize();
applyPreset('default');
refreshPrimaryButtons();
drawBackground(readParams());
requestAnimationFrame((now) => {
  state.lastTime = now;
  tick(now);
});
