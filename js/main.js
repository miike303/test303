const COLS = 10;
const ROWS = 20;
const CELL = 40;

const COLORS = {
  I: '#43e7ff',
  O: '#ffe066',
  T: '#bd93ff',
  S: '#6fff8f',
  Z: '#ff7b9b',
  J: '#6da4ff',
  L: '#ffb36f',
};

const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

const LINE_SCORES = [0, 100, 300, 500, 800];

const boardCanvas = document.getElementById('board');
const boardCtx = boardCanvas.getContext('2d');
const nextCtx = document.getElementById('next').getContext('2d');
const holdCtx = document.getElementById('hold').getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const gameOverEl = document.getElementById('gameOver');
const restartBtn = document.getElementById('restartBtn');

let board;
let current;
let nextQueue;
let holdPiece;
let holdUsed;
let score;
let level;
let lines;
let dropTimer;
let lastTime;
let running;
let paused;
let clearFlash = [];

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function makeBag() {
  const bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function spawn(type) {
  const matrix = SHAPES[type].map((row) => [...row]);
  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: -1,
  };
}

function collides(piece, dx = 0, dy = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const nx = piece.x + x + dx;
      const ny = piece.y + y + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateMatrix(matrix) {
  const size = matrix.length;
  const out = Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      out[x][size - 1 - y] = matrix[y][x];
    }
  }
  return out;
}

function rotatePiece() {
  const rotated = rotateMatrix(current.matrix);
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (!collides(current, k, 0, rotated)) {
      current.matrix = rotated;
      current.x += k;
      return;
    }
  }
}

function mergePiece(piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (!val) return;
      const by = piece.y + y;
      if (by >= 0) board[by][piece.x + x] = piece.type;
    });
  });
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      clearFlash.push({ y, life: 150 });
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }

  if (cleared > 0) {
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    score += LINE_SCORES[cleared] * level;
  }
}

function nextPiece() {
  if (nextQueue.length < 7) nextQueue.push(...makeBag());
  current = spawn(nextQueue.shift());
  holdUsed = false;
  if (collides(current, 0, 0)) {
    running = false;
    gameOverEl.classList.remove('hidden');
  }
}

function hold() {
  if (holdUsed || !running || paused) return;
  const prev = holdPiece;
  holdPiece = current.type;
  if (prev) current = spawn(prev);
  else nextPiece();
  holdUsed = true;
}

function hardDrop() {
  if (!running || paused) return;
  while (!collides(current, 0, 1)) {
    current.y += 1;
    score += 2;
  }
  lockPiece();
}

function lockPiece() {
  mergePiece(current);
  clearLines();
  nextPiece();
}

function getGhostY() {
  let y = current.y;
  while (!collides(current, 0, y - current.y + 1)) y += 1;
  return y;
}

function drawCell(ctx, x, y, color, alpha = 1) {
  const px = x * CELL;
  const py = y * CELL;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
  ctx.globalAlpha = 1;
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      boardCtx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
      boardCtx.fillRect(x * CELL, y * CELL, CELL, CELL);
      const cell = board[y][x];
      if (cell) drawCell(boardCtx, x, y, COLORS[cell]);
    }
  }

  for (const flash of clearFlash) {
    boardCtx.fillStyle = `rgba(255,255,255,${flash.life / 220})`;
    boardCtx.fillRect(0, flash.y * CELL, COLS * CELL, CELL);
  }

  if (!running) return;

  const ghostY = getGhostY();
  current.matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (!val) return;
      const gx = current.x + x;
      const gy = ghostY + y;
      if (gy >= 0) drawCell(boardCtx, gx, gy, COLORS[current.type], 0.22);
    });
  });

  current.matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (!val) return;
      const bx = current.x + x;
      const by = current.y + y;
      if (by >= 0) drawCell(boardCtx, bx, by, COLORS[current.type]);
    });
  });
}

function drawPreview(ctx, type) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!type) return;

  const shape = SHAPES[type];
  const size = Math.floor(canvas.width / 5.2);
  const ox = (canvas.width - shape[0].length * size) / 2;
  const oy = (canvas.height - shape.length * size) / 2;

  shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (!val) return;
      ctx.fillStyle = COLORS[type];
      ctx.fillRect(ox + x * size + 1, oy + y * size + 1, size - 2, size - 2);
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.strokeRect(ox + x * size + 1.5, oy + y * size + 1.5, size - 3, size - 3);
    });
  });
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString('fr-FR');
  levelEl.textContent = level;
  linesEl.textContent = lines;
  drawPreview(nextCtx, nextQueue[0]);
  drawPreview(holdCtx, holdPiece);
}

function reset() {
  board = emptyBoard();
  nextQueue = makeBag();
  holdPiece = null;
  holdUsed = false;
  score = 0;
  level = 1;
  lines = 0;
  dropTimer = 0;
  lastTime = performance.now();
  paused = false;
  running = true;
  clearFlash = [];
  gameOverEl.classList.add('hidden');
  nextPiece();
  updateHUD();
}

function tick(now) {
  const dt = Math.min(48, now - lastTime);
  lastTime = now;

  clearFlash = clearFlash.filter((f) => {
    f.life -= dt;
    return f.life > 0;
  });

  if (running && !paused) {
    dropTimer += dt;
    const interval = Math.max(90, 800 - (level - 1) * 65);
    if (dropTimer >= interval) {
      dropTimer = 0;
      if (!collides(current, 0, 1)) current.y += 1;
      else lockPiece();
    }
  }

  drawBoard();
  updateHUD();
  requestAnimationFrame(tick);
}

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key.toLowerCase() === 'p') paused = !paused;
  if (!running || paused) return;

  if (e.key === 'ArrowLeft' && !collides(current, -1, 0)) current.x -= 1;
  else if (e.key === 'ArrowRight' && !collides(current, 1, 0)) current.x += 1;
  else if (e.key === 'ArrowDown') {
    if (!collides(current, 0, 1)) {
      current.y += 1;
      score += 1;
    }
  } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'x') rotatePiece();
  else if (e.code === 'Space') hardDrop();
  else if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'shift') hold();
});

restartBtn.addEventListener('click', reset);

reset();
requestAnimationFrame(tick);
