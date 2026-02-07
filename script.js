const canvas = document.getElementById("life-canvas");
const ctx = canvas.getContext("2d");

const toggleButton = document.getElementById("toggle");
const stepButton = document.getElementById("step");
const randomButton = document.getElementById("random");
const clearButton = document.getElementById("clear");
const speedInput = document.getElementById("speed");
const scaleInput = document.getElementById("scale");

let scale = Number(scaleInput.value);
let cols = 0;
let rows = 0;
let grid = [];
let running = false;
let lastTick = 0;

const neonPalette = [
  "#ff2bd4",
  "#3bf0ff",
  "#5dff91",
  "#b25cff",
];

const resizeCanvas = () => {
  const parentWidth = canvas.parentElement.offsetWidth;
  canvas.width = parentWidth;
  canvas.height = Math.min(520, Math.round(parentWidth * 0.6));
  cols = Math.floor(canvas.width / scale);
  rows = Math.floor(canvas.height / scale);
  grid = createGrid(cols, rows, false);
  drawGrid();
};

const createGrid = (width, height, randomize = false) => {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => (randomize ? Math.random() > 0.7 : false))
  );
};

const drawGrid = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#05020c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!grid[y][x]) continue;
      const color = neonPalette[(x + y) % neonPalette.length];
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2);
    }
  }

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(59, 240, 255, 0.08)";
  for (let x = 0; x <= cols; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * scale, 0);
    ctx.lineTo(x * scale, rows * scale);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * scale);
    ctx.lineTo(cols * scale, y * scale);
    ctx.stroke();
  }
};

const getNeighborCount = (gridData, x, y) => {
  let count = 0;
  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      if (xOffset === 0 && yOffset === 0) continue;
      const col = (x + xOffset + cols) % cols;
      const row = (y + yOffset + rows) % rows;
      if (gridData[row][col]) count += 1;
    }
  }
  return count;
};

const stepSimulation = () => {
  const nextGrid = createGrid(cols, rows, false);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const neighbors = getNeighborCount(grid, x, y);
      if (grid[y][x]) {
        nextGrid[y][x] = neighbors === 2 || neighbors === 3;
      } else {
        nextGrid[y][x] = neighbors === 3;
      }
    }
  }
  grid = nextGrid;
  drawGrid();
};

const loop = (timestamp) => {
  if (!running) return;
  const interval = 1000 / Number(speedInput.value);
  if (timestamp - lastTick >= interval) {
    stepSimulation();
    lastTick = timestamp;
  }
  requestAnimationFrame(loop);
};

const toggleRunning = () => {
  running = !running;
  toggleButton.textContent = running ? "Pause" : "Démarrer";
  if (running) requestAnimationFrame(loop);
};

const randomize = () => {
  grid = createGrid(cols, rows, true);
  drawGrid();
};

const clearGrid = () => {
  grid = createGrid(cols, rows, false);
  drawGrid();
};

let isDrawing = false;

const getCellFromEvent = (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / scale);
  const y = Math.floor((event.clientY - rect.top) / scale);
  return { x, y };
};

const paintCell = (event) => {
  const { x, y } = getCellFromEvent(event);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return;
  grid[y][x] = true;
  drawGrid();
};

canvas.addEventListener("mousedown", (event) => {
  isDrawing = true;
  paintCell(event);
});

canvas.addEventListener("mousemove", (event) => {
  if (!isDrawing) return;
  paintCell(event);
});

canvas.addEventListener("mouseup", () => {
  isDrawing = false;
});

canvas.addEventListener("mouseleave", () => {
  isDrawing = false;
});

canvas.addEventListener("click", (event) => {
  const { x, y } = getCellFromEvent(event);
  grid[y][x] = !grid[y][x];
  drawGrid();
});

scaleInput.addEventListener("input", () => {
  scale = Number(scaleInput.value);
  resizeCanvas();
});

toggleButton.addEventListener("click", toggleRunning);
stepButton.addEventListener("click", stepSimulation);
randomButton.addEventListener("click", randomize);
clearButton.addEventListener("click", clearGrid);

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
randomize();
