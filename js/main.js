import { Game } from './game.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);
game.init();

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  game.update(dt);
  game.renderer.render(game, dt);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
