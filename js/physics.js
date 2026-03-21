const EPSILON = 0.00001;

export const BALL_RADIUS = 13;
export const STOP_SPEED = 8;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function length(x, y) {
  return Math.hypot(x, y);
}

export function normalize(x, y) {
  const len = length(x, y) || 1;
  return { x: x / len, y: y / len };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointInRoundedRect(point, rect) {
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.width;
  const rh = rect.height;
  const r = Math.min(rect.radius || 0, rw / 2, rh / 2);
  const cx = clamp(point.x, rx + r, rx + rw - r);
  const cy = clamp(point.y, ry + r, ry + rh - r);
  const dx = point.x - cx;
  const dy = point.y - cy;
  return dx * dx + dy * dy <= r * r + 1;
}

export function pointInEllipse(point, ellipse) {
  const dx = (point.x - ellipse.x) / ellipse.rx;
  const dy = (point.y - ellipse.y) / ellipse.ry;
  return dx * dx + dy * dy <= 1;
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  const points = polygon.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function shapeContains(shape, point) {
  if (shape.type === 'roundedRect') return pointInRoundedRect(point, shape);
  if (shape.type === 'ellipse') return pointInEllipse(point, shape);
  if (shape.type === 'polygon') return pointInPolygon(point, shape);
  return false;
}

export function getSurfaceFriction(level, point) {
  let friction = 1;
  for (const zone of level.sand || []) {
    if (shapeContains(zone, point)) friction = Math.max(friction, zone.friction || 2.5);
  }
  for (const zone of level.rough || []) {
    if (shapeContains(zone, point)) friction = Math.max(friction, zone.friction || 2.1);
  }
  for (const zone of level.sticky || []) {
    if (shapeContains(zone, point)) friction = Math.max(friction, zone.friction || 3);
  }
  return friction;
}

export function inHazard(level, point, key) {
  return (level[key] || []).some((zone) => shapeContains(zone, point));
}

export function moveObstacle(obstacle, time) {
  const offset = Math.sin(time * obstacle.speed) * obstacle.range;
  return {
    x: obstacle.x + (obstacle.axis === 'x' ? offset : 0),
    y: obstacle.y + (obstacle.axis === 'y' ? offset : 0),
    width: obstacle.width,
    height: obstacle.height,
  };
}

export function rotateArms(rotator, time) {
  return rotator.angle + time * rotator.speed;
}

export function segmentCollision(ball, segment) {
  const vx = segment.b.x - segment.a.x;
  const vy = segment.b.y - segment.a.y;
  const wx = ball.x - segment.a.x;
  const wy = ball.y - segment.a.y;
  const lenSq = vx * vx + vy * vy || 1;
  const t = clamp((wx * vx + wy * vy) / lenSq, 0, 1);
  const px = segment.a.x + vx * t;
  const py = segment.a.y + vy * t;
  const dx = ball.x - px;
  const dy = ball.y - py;
  const distSq = dx * dx + dy * dy;

  if (distSq > BALL_RADIUS * BALL_RADIUS) return null;
  const dist = Math.sqrt(distSq) || 0.0001;
  return {
    point: { x: px, y: py },
    normal: { x: dx / dist, y: dy / dist },
    penetration: BALL_RADIUS - dist,
  };
}

export function rectCollision(ball, rect) {
  const closestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const closestY = clamp(ball.y, rect.y, rect.y + rect.height);
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq > BALL_RADIUS * BALL_RADIUS) return null;
  const dist = Math.sqrt(distSq) || 0.0001;
  return {
    normal: { x: dx / dist, y: dy / dist },
    penetration: BALL_RADIUS - dist,
  };
}

export function applyBounce(ball, normal, damping = 0.82) {
  const velocity = { x: ball.vx, y: ball.vy };
  const impact = dot(velocity, normal);
  if (impact >= 0) return 0;
  ball.vx -= (1 + damping) * impact * normal.x;
  ball.vy -= (1 + damping) * impact * normal.y;
  return Math.abs(impact);
}

export function portalTransfer(ball, portal) {
  const da = distance(ball, portal.a);
  const db = distance(ball, portal.b);
  if (da < portal.a.radius + BALL_RADIUS) return { x: portal.b.x, y: portal.b.y };
  if (db < portal.b.radius + BALL_RADIUS) return { x: portal.a.x, y: portal.a.y };
  return null;
}

export function getScoreLabel(diff) {
  if (diff <= -3) return 'Albatross';
  if (diff === -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double Bogey';
  return 'Over Par';
}

export function getMedal(par, strokes) {
  if (strokes <= par - 1) return 'Gold';
  if (strokes <= par + 1) return 'Silver';
  return 'Bronze';
}
