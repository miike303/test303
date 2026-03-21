(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) return;

  const hudHole = document.getElementById('hudHole');
  const hudPar = document.getElementById('hudPar');
  const hudStrokes = document.getElementById('hudStrokes');
  const hudBest = document.getElementById('hudBest');
  const powerFill = document.getElementById('powerFill');
  const aimHint = document.getElementById('aimHint');
  const cameraModeLabel = document.getElementById('cameraModeLabel');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const completeOverlay = document.getElementById('completeOverlay');
  const completeTitle = document.getElementById('completeTitle');
  const completeSummary = document.getElementById('completeSummary');
  const completeScore = document.getElementById('completeScore');
  const completeBest = document.getElementById('completeBest');
  const completeTotal = document.getElementById('completeTotal');
  const muteButton = document.getElementById('muteButton');
  const pauseButton = document.getElementById('pauseButton');
  const restartButton = document.getElementById('restartButton');
  const resumeButton = document.getElementById('resumeButton');
  const pauseRestartButton = document.getElementById('pauseRestartButton');
  const nextHoleButton = document.getElementById('nextHoleButton');
  const replayButton = document.getElementById('replayButton');

  const STORAGE_KEY = 'pocket-golf-deluxe-best-v1';
  const LEVELS = [
    {
      name: 'Glow Lane',
      par: 3,
      width: 1320,
      height: 860,
      ballStart: { x: 170, y: 650 },
      hole: { x: 1105, y: 270, r: 22 },
      obstacles: [
        { x: 380, y: 490, w: 120, h: 220, r: 24 },
        { x: 612, y: 190, w: 110, h: 320, r: 24 },
        { x: 850, y: 468, w: 220, h: 96, r: 26 },
      ],
      fairway: [
        { x: 60, y: 120 }, { x: 1240, y: 120 }, { x: 1240, y: 760 }, { x: 60, y: 760 },
      ],
    },
    {
      name: 'Canal Bend',
      par: 4,
      width: 1480,
      height: 960,
      ballStart: { x: 175, y: 165 },
      hole: { x: 1258, y: 756, r: 22 },
      obstacles: [
        { x: 260, y: 292, w: 900, h: 90, r: 30 },
        { x: 402, y: 540, w: 110, h: 220, r: 22 },
        { x: 760, y: 610, w: 112, h: 230, r: 22 },
        { x: 1046, y: 250, w: 122, h: 240, r: 26 },
      ],
      fairway: [
        { x: 60, y: 60 }, { x: 1420, y: 60 }, { x: 1420, y: 900 }, { x: 60, y: 900 },
      ],
    },
    {
      name: 'Summit Split',
      par: 5,
      width: 1680,
      height: 980,
      ballStart: { x: 232, y: 860 },
      hole: { x: 1440, y: 165, r: 22 },
      obstacles: [
        { x: 390, y: 710, w: 280, h: 90, r: 22 },
        { x: 720, y: 260, w: 90, h: 510, r: 26 },
        { x: 990, y: 160, w: 110, h: 260, r: 22 },
        { x: 1130, y: 500, w: 310, h: 90, r: 22 },
      ],
      fairway: [
        { x: 70, y: 70 }, { x: 1610, y: 70 }, { x: 1610, y: 910 }, { x: 70, y: 910 },
      ],
    },
    {
      name: 'Harbor Arc',
      par: 4,
      width: 1360,
      height: 1120,
      ballStart: { x: 180, y: 220 },
      hole: { x: 1142, y: 946, r: 22 },
      obstacles: [
        { x: 250, y: 392, w: 760, h: 90, r: 28 },
        { x: 840, y: 592, w: 92, h: 320, r: 24 },
        { x: 474, y: 742, w: 250, h: 90, r: 24 },
      ],
      fairway: [
        { x: 65, y: 65 }, { x: 1295, y: 65 }, { x: 1295, y: 1055 }, { x: 65, y: 1055 },
      ],
    },
  ];

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    safeViewport: { width: 0, height: 0 },
    levelIndex: 0,
    totalStrokes: 0,
    strokes: 0,
    paused: false,
    soundEnabled: true,
    completed: false,
    pointerId: null,
    pointer: { x: 0, y: 0 },
    aim: { active: false, dragStart: null, dragCurrent: null, power: 0, dir: { x: 0, y: 0 } },
    ball: { x: 0, y: 0, vx: 0, vy: 0, r: 18, moving: false },
    holePulse: 0,
    lastTime: 0,
    bestScores: loadBestScores(),
  };

  const camera = {
    x: 0,
    y: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1,
    mode: 'aim',
    lookAhead: { x: 0, y: 0 },
    update(dt) {
      const positionEase = this.mode === 'follow' ? 1 - Math.pow(0.002, dt) : 1 - Math.pow(0.0008, dt);
      const zoomEase = this.mode === 'follow' ? 1 - Math.pow(0.01, dt) : 1 - Math.pow(0.0025, dt);
      this.x += (this.targetX - this.x) * positionEase;
      this.y += (this.targetY - this.y) * positionEase;
      this.zoom += (this.targetZoom - this.zoom) * zoomEase;
    },
  };

  function loadBestScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveBestScores() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bestScores));
  }

  function currentLevel() {
    return LEVELS[state.levelIndex];
  }

  function setLevel(index, resetTotal = false) {
    state.levelIndex = (index + LEVELS.length) % LEVELS.length;
    if (resetTotal) state.totalStrokes = 0;
    resetHole();
  }

  function resetHole() {
    const level = currentLevel();
    state.strokes = 0;
    state.completed = false;
    state.paused = false;
    state.aim.active = false;
    state.aim.power = 0;
    state.ball.x = level.ballStart.x;
    state.ball.y = level.ballStart.y;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.moving = false;
    pauseOverlay.hidden = true;
    completeOverlay.hidden = true;
    updateHUD();
    syncCamera(true);
  }

  function updateHUD() {
    const level = currentLevel();
    const best = state.bestScores[level.name];
    hudHole.textContent = `${state.levelIndex + 1}/${LEVELS.length}`;
    hudPar.textContent = level.par;
    hudStrokes.textContent = state.strokes;
    hudBest.textContent = Number.isFinite(best) ? best : '—';
  }

  function resize() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    const horizontalMargin = Math.max(92, state.width * 0.12);
    const topMargin = Math.max(190, state.height * 0.2);
    const bottomMargin = Math.max(190, state.height * 0.24);
    state.safeViewport.width = Math.max(220, state.width - horizontalMargin * 2);
    state.safeViewport.height = Math.max(220, state.height - topMargin - bottomMargin);

    syncCamera(true);
  }

  function syncCamera(immediate = false) {
    updateCameraTargets();
    if (immediate) {
      camera.x = camera.targetX;
      camera.y = camera.targetY;
      camera.zoom = camera.targetZoom;
    }
  }

  function updateCameraTargets() {
    const level = currentLevel();
    if (state.ball.moving) {
      camera.mode = 'follow';
      const velocityLead = {
        x: clamp(state.ball.vx * 0.15, -120, 120),
        y: clamp(state.ball.vy * 0.15, -120, 120),
      };
      const followBox = expandBox({
        minX: state.ball.x - 180,
        maxX: state.ball.x + 180,
        minY: state.ball.y - 180,
        maxY: state.ball.y + 180,
      }, 140, 140);
      const fitted = fitCameraToBox(followBox, 0.9, level);
      camera.targetX = fitted.x + velocityLead.x * 0.32;
      camera.targetY = fitted.y + velocityLead.y * 0.32;
      camera.targetZoom = Math.min(fitted.zoom, camera.zoom + 0.025);
      return;
    }

    camera.mode = 'aim';
    const smartBox = computeAimingBox(level);
    const fitted = fitCameraToBox(smartBox, 1, level);
    camera.targetX = fitted.x;
    camera.targetY = fitted.y;
    camera.targetZoom = fitted.zoom;
  }

  function computeAimingBox(level) {
    const ball = state.ball;
    const hole = level.hole;
    const box = {
      minX: Math.min(ball.x, hole.x),
      maxX: Math.max(ball.x, hole.x),
      minY: Math.min(ball.y, hole.y),
      maxY: Math.max(ball.y, hole.y),
    };

    const shotVector = normalize({ x: hole.x - ball.x, y: hole.y - ball.y });
    const lookAhead = state.aim.active
      ? { x: shotVector.x * 70, y: shotVector.y * 70 }
      : { x: shotVector.x * 34, y: shotVector.y * 34 };

    box.minX = Math.min(box.minX, ball.x + lookAhead.x, hole.x + lookAhead.x * 0.15);
    box.maxX = Math.max(box.maxX, ball.x + lookAhead.x, hole.x + lookAhead.x * 0.15);
    box.minY = Math.min(box.minY, ball.y + lookAhead.y, hole.y + lookAhead.y * 0.15);
    box.maxY = Math.max(box.maxY, ball.y + lookAhead.y, hole.y + lookAhead.y * 0.15);

    for (const obstacle of level.obstacles) {
      const cx = obstacle.x + obstacle.w * 0.5;
      const cy = obstacle.y + obstacle.h * 0.5;
      if (distanceToSegment(cx, cy, ball.x, ball.y, hole.x, hole.y) < 170) {
        box.minX = Math.min(box.minX, obstacle.x);
        box.maxX = Math.max(box.maxX, obstacle.x + obstacle.w);
        box.minY = Math.min(box.minY, obstacle.y);
        box.maxY = Math.max(box.maxY, obstacle.y + obstacle.h);
      }
    }

    const distance = Math.hypot(hole.x - ball.x, hole.y - ball.y);
    const padX = clamp(distance * 0.14, 170, 330);
    const padY = clamp(distance * 0.18, 150, 340);
    return expandBox(box, padX, padY);
  }

  function fitCameraToBox(box, zoomBias, level) {
    const safeWidth = state.safeViewport.width || state.width;
    const safeHeight = state.safeViewport.height || state.height;
    const boxWidth = Math.max(220, box.maxX - box.minX);
    const boxHeight = Math.max(220, box.maxY - box.minY);
    const zoomX = safeWidth / boxWidth;
    const zoomY = safeHeight / boxHeight;
    const maxZoom = Math.min(1.75, Math.max(state.width / level.width, state.height / level.height) * 2.6);
    const minZoom = Math.min(state.width / level.width, state.height / level.height) * 0.9;
    const zoom = clamp(Math.min(zoomX, zoomY) * zoomBias, minZoom, maxZoom);
    const halfViewWidth = state.width / zoom / 2;
    const halfViewHeight = state.height / zoom / 2;
    return {
      x: clamp((box.minX + box.maxX) / 2, halfViewWidth, level.width - halfViewWidth),
      y: clamp((box.minY + box.maxY) / 2, halfViewHeight, level.height - halfViewHeight),
      zoom,
    };
  }

  function expandBox(box, padX, padY) {
    return {
      minX: box.minX - padX,
      maxX: box.maxX + padX,
      minY: box.minY - padY,
      maxY: box.maxY + padY,
    };
  }

  function worldToScreen(x, y) {
    return {
      x: (x - camera.x) * camera.zoom + state.width / 2,
      y: (y - camera.y) * camera.zoom + state.height / 2,
    };
  }

  function screenToWorld(x, y) {
    return {
      x: (x - state.width / 2) / camera.zoom + camera.x,
      y: (y - state.height / 2) / camera.zoom + camera.y,
    };
  }

  function isPointerNearBall(x, y) {
    const screenBall = worldToScreen(state.ball.x, state.ball.y);
    return Math.hypot(screenBall.x - x, screenBall.y - y) <= Math.max(40, state.ball.r * camera.zoom + 22);
  }

  function beginAim(clientX, clientY, pointerId) {
    if (state.paused || state.completed || state.ball.moving) return;
    if (!isPointerNearBall(clientX, clientY)) return;
    state.pointerId = pointerId;
    const worldPoint = screenToWorld(clientX, clientY);
    state.aim.active = true;
    state.aim.dragStart = { x: state.ball.x, y: state.ball.y };
    state.aim.dragCurrent = worldPoint;
    aimHint.textContent = 'Release to strike. The camera keeps the ball and cup in view.';
  }

  function updateAim(clientX, clientY) {
    if (!state.aim.active) return;
    state.pointer.x = clientX;
    state.pointer.y = clientY;
    const worldPoint = screenToWorld(clientX, clientY);
    state.aim.dragCurrent = worldPoint;
    const drag = { x: state.ball.x - worldPoint.x, y: state.ball.y - worldPoint.y };
    const distance = Math.min(Math.hypot(drag.x, drag.y), 220);
    state.aim.power = distance / 220;
    state.aim.dir = normalize(drag);
  }

  function releaseAim(pointerId) {
    if (!state.aim.active || (state.pointerId !== null && pointerId !== undefined && pointerId !== state.pointerId)) return;
    state.pointerId = null;
    if (state.aim.power > 0.05) {
      const impulse = 980 * Math.pow(state.aim.power, 1.15);
      state.ball.vx = state.aim.dir.x * impulse;
      state.ball.vy = state.aim.dir.y * impulse;
      state.ball.moving = true;
      state.strokes += 1;
      state.totalStrokes += 1;
      playTone(220 + state.aim.power * 180, 0.07, 'triangle');
      updateHUD();
    }
    state.aim.active = false;
    state.aim.power = 0;
    aimHint.textContent = 'Drag near the ball to pull back, line up the hole, and release.';
  }

  function togglePause(force) {
    state.paused = typeof force === 'boolean' ? force : !state.paused;
    pauseOverlay.hidden = !state.paused;
  }

  function updatePhysics(dt) {
    const level = currentLevel();
    if (!state.ball.moving) return;

    state.ball.x += state.ball.vx * dt;
    state.ball.y += state.ball.vy * dt;
    state.ball.vx *= Math.pow(0.985, dt * 60);
    state.ball.vy *= Math.pow(0.985, dt * 60);

    collideWorldBounds(level);
    for (const obstacle of level.obstacles) {
      collideRoundedRect(obstacle);
    }

    const speed = Math.hypot(state.ball.vx, state.ball.vy);
    const holeDx = level.hole.x - state.ball.x;
    const holeDy = level.hole.y - state.ball.y;
    const holeDistance = Math.hypot(holeDx, holeDy);

    if (holeDistance < level.hole.r - 4 && speed < 210) {
      state.ball.x += holeDx * Math.min(1, dt * 7);
      state.ball.y += holeDy * Math.min(1, dt * 7);
      state.ball.vx *= 0.9;
      state.ball.vy *= 0.9;
    }

    if (holeDistance < level.hole.r - 2 && speed < 90) {
      finishHole();
      return;
    }

    if (speed < 12) {
      state.ball.vx = 0;
      state.ball.vy = 0;
      state.ball.moving = false;
    }
  }

  function collideWorldBounds(level) {
    const ball = state.ball;
    const minX = ball.r + 26;
    const minY = ball.r + 26;
    const maxX = level.width - ball.r - 26;
    const maxY = level.height - ball.r - 26;

    if (ball.x < minX) {
      ball.x = minX;
      ball.vx *= -0.82;
      playTone(140, 0.03, 'square');
    } else if (ball.x > maxX) {
      ball.x = maxX;
      ball.vx *= -0.82;
      playTone(140, 0.03, 'square');
    }

    if (ball.y < minY) {
      ball.y = minY;
      ball.vy *= -0.82;
      playTone(140, 0.03, 'square');
    } else if (ball.y > maxY) {
      ball.y = maxY;
      ball.vy *= -0.82;
      playTone(140, 0.03, 'square');
    }
  }

  function collideRoundedRect(obstacle) {
    const ball = state.ball;
    const nearestX = clamp(ball.x, obstacle.x, obstacle.x + obstacle.w);
    const nearestY = clamp(ball.y, obstacle.y, obstacle.y + obstacle.h);
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > ball.r * ball.r) return;

    if (distanceSq < 0.0001) {
      const left = Math.abs(ball.x - obstacle.x);
      const right = Math.abs(obstacle.x + obstacle.w - ball.x);
      const top = Math.abs(ball.y - obstacle.y);
      const bottom = Math.abs(obstacle.y + obstacle.h - ball.y);
      const minEdge = Math.min(left, right, top, bottom);

      if (minEdge === left) {
        ball.x = obstacle.x - ball.r;
        ball.vx = -Math.abs(ball.vx) * 0.82;
      } else if (minEdge === right) {
        ball.x = obstacle.x + obstacle.w + ball.r;
        ball.vx = Math.abs(ball.vx) * 0.82;
      } else if (minEdge === top) {
        ball.y = obstacle.y - ball.r;
        ball.vy = -Math.abs(ball.vy) * 0.82;
      } else {
        ball.y = obstacle.y + obstacle.h + ball.r;
        ball.vy = Math.abs(ball.vy) * 0.82;
      }
      playTone(180, 0.025, 'square');
      return;
    }

    const distance = Math.sqrt(distanceSq);
    const overlap = ball.r - distance;
    const normalX = dx / distance;
    const normalY = dy / distance;
    ball.x += normalX * overlap;
    ball.y += normalY * overlap;
    const velocityDot = ball.vx * normalX + ball.vy * normalY;
    if (velocityDot < 0) {
      ball.vx -= 1.86 * velocityDot * normalX;
      ball.vy -= 1.86 * velocityDot * normalY;
      ball.vx *= 0.92;
      ball.vy *= 0.92;
      playTone(180, 0.025, 'square');
    }
  }

  function finishHole() {
    if (state.completed) return;
    state.completed = true;
    state.ball.moving = false;
    state.ball.vx = 0;
    state.ball.vy = 0;

    const level = currentLevel();
    const score = state.strokes - level.par;
    const previousBest = state.bestScores[level.name];
    if (!Number.isFinite(previousBest) || state.strokes < previousBest) {
      state.bestScores[level.name] = state.strokes;
      saveBestScores();
    }
    updateHUD();

    completeTitle.textContent = score <= -2 ? 'Albatross Energy' : score <= -1 ? 'Birdie Beauty' : score === 0 ? 'Par Precision' : 'Keep Rolling';
    completeSummary.textContent = `You cleared ${level.name} in ${state.strokes} stroke${state.strokes === 1 ? '' : 's'}.`;
    completeScore.textContent = score > 0 ? `+${score}` : `${score}`;
    completeBest.textContent = state.bestScores[level.name];
    completeTotal.textContent = state.totalStrokes;
    completeOverlay.hidden = false;
    playTone(520, 0.12, 'sine');
    setTimeout(() => playTone(660, 0.1, 'sine'), 90);
  }

  function draw(now) {
    const level = currentLevel();
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.fillStyle = '#0a1510';
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.save();
    ctx.translate(state.width / 2, state.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    drawCourse(level, now);
    drawHole(level, now);
    drawAimGuides(level);
    drawBall(now);

    ctx.restore();
  }

  function drawCourse(level, now) {
    const gradient = ctx.createLinearGradient(0, 0, level.width, level.height);
    gradient.addColorStop(0, '#1c5d3e');
    gradient.addColorStop(1, '#123a2d');

    roundedRectPath(24, 24, level.width - 48, level.height - 48, 40);
    ctx.fillStyle = '#0c1713';
    ctx.fill();

    roundedRectPath(46, 46, level.width - 92, level.height - 92, 34);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 12; i += 1) {
      const y = 120 + i * ((level.height - 240) / 11);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.01)';
      roundedRectPath(70, y, level.width - 140, 28, 14);
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 8;
    roundedRectPath(46, 46, level.width - 92, level.height - 92, 34);
    ctx.stroke();

    for (const obstacle of level.obstacles) {
      const obstacleGradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x + obstacle.w, obstacle.y + obstacle.h);
      obstacleGradient.addColorStop(0, '#182b24');
      obstacleGradient.addColorStop(1, '#0d1a14');
      ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
      ctx.shadowBlur = 22;
      roundedRectPath(obstacle.x, obstacle.y, obstacle.w, obstacle.h, obstacle.r);
      ctx.fillStyle = obstacleGradient;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(197,255,215,0.08)';
      ctx.lineWidth = 4;
      roundedRectPath(obstacle.x, obstacle.y, obstacle.w, obstacle.h, obstacle.r);
      ctx.stroke();
    }

    const sparkle = (Math.sin(now * 0.0014) + 1) * 0.5;
    ctx.fillStyle = `rgba(157, 255, 182, ${0.06 + sparkle * 0.035})`;
    ctx.beginPath();
    ctx.arc(level.hole.x, level.hole.y, 110, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHole(level, now) {
    const pulse = (Math.sin(now * 0.004) + 1) * 0.5;
    ctx.save();
    ctx.translate(level.hole.x, level.hole.y);
    ctx.fillStyle = 'rgba(20, 28, 24, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, level.hole.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(150, 255, 196, ${0.45 + pulse * 0.35})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, level.hole.r + 8 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#d5ffd7';
    ctx.fillRect(12, -78, 8, 84);
    ctx.beginPath();
    ctx.moveTo(18, -78);
    ctx.lineTo(72, -54);
    ctx.lineTo(18, -26);
    ctx.closePath();
    ctx.fillStyle = '#7bf0a0';
    ctx.fill();
    ctx.restore();
  }

  function drawAimGuides(level) {
    const ball = state.ball;
    const hole = level.hole;

    if (!state.ball.moving) {
      ctx.save();
      ctx.setLineDash([18, 18]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(225, 255, 230, 0.16)';
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(hole.x, hole.y);
      ctx.stroke();
      ctx.restore();
    }

    if (!state.aim.active) return;
    const dir = state.aim.dir;
    const guideLength = 170 + state.aim.power * 170;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + dir.x * guideLength, ball.y + dir.y * guideLength);
    ctx.stroke();

    ctx.setLineDash([12, 12]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(142, 242, 138, 0.75)';
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x - dir.x * Math.min(state.aim.power * 150, 110), ball.y - dir.y * Math.min(state.aim.power * 150, 110));
    ctx.stroke();
    ctx.restore();
  }

  function drawBall(now) {
    const ball = state.ball;
    const glow = 16 + Math.sin(now * 0.004) * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(135, 255, 170, 0.35)';
    ctx.shadowBlur = glow;
    ctx.fillStyle = '#f5fff7';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(133, 170, 145, 0.38)';
    ctx.beginPath();
    ctx.arc(ball.x - 5, ball.y - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundedRectPath(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function animate(now) {
    if (!state.lastTime) state.lastTime = now;
    const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0.016);
    state.lastTime = now;

    if (!state.paused && !state.completed) {
      updatePhysics(dt);
      updateCameraTargets();
      camera.update(dt);
    }

    cameraModeLabel.textContent = camera.mode === 'follow' ? 'Tracking Shot' : 'Aiming View';
    powerFill.style.width = `${Math.round(state.aim.power * 100)}%`;
    draw(now);
    requestAnimationFrame(animate);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalize(vector) {
    const length = Math.hypot(vector.x, vector.y) || 1;
    return { x: vector.x / length, y: vector.y / length };
  }

  function distanceToSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const abLengthSq = abx * abx + aby * aby || 1;
    const t = clamp(((px - ax) * abx + (py - ay) * aby) / abLengthSq, 0, 1);
    const closestX = ax + abx * t;
    const closestY = ay + aby * t;
    return Math.hypot(px - closestX, py - closestY);
  }

  let audioContext;
  function playTone(frequency, duration, type) {
    if (!state.soundEnabled) return;
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function onPointerDown(event) {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    beginAim(event.clientX, event.clientY, event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.aim.active || (state.pointerId !== null && event.pointerId !== state.pointerId)) return;
    event.preventDefault();
    updateAim(event.clientX, event.clientY);
  }

  function onPointerUp(event) {
    releaseAim(event?.pointerId);
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: true });
  canvas.addEventListener('touchstart', (event) => event.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });

  restartButton.addEventListener('click', () => resetHole());
  pauseButton.addEventListener('click', () => togglePause());
  resumeButton.addEventListener('click', () => togglePause(false));
  pauseRestartButton.addEventListener('click', () => {
    togglePause(false);
    resetHole();
  });
  muteButton.addEventListener('click', async () => {
    state.soundEnabled = !state.soundEnabled;
    muteButton.textContent = state.soundEnabled ? '🔊' : '🔈';
    if (state.soundEnabled && audioContext?.state === 'suspended') {
      await audioContext.resume();
    }
  });
  replayButton.addEventListener('click', () => resetHole());
  nextHoleButton.addEventListener('click', () => {
    completeOverlay.hidden = true;
    setLevel(state.levelIndex + 1, false);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'r' || event.key === 'R') resetHole();
    if (event.key === 'm' || event.key === 'M') muteButton.click();
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') togglePause();
    if (state.completed && event.key === 'Enter') nextHoleButton.click();
  });

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(resize, 140), { passive: true });

  resize();
  setLevel(0, true);
  requestAnimationFrame(animate);
})();
