export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => min + Math.random() * (max - min);
export const choose = (list) => list[(Math.random() * list.length) | 0];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function circleRectCollision(circle, rect) {
  const x = clamp(circle.x, rect.x, rect.x + rect.width);
  const y = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - x;
  const dy = circle.y - y;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

export function segmentPointDistance(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const len2 = vx * vx + vy * vy || 1;
  const t = clamp((wx * vx + wy * vy) / len2, 0, 1);
  const sx = x1 + vx * t;
  const sy = y1 + vy * t;
  return Math.hypot(px - sx, py - sy);
}

export function circleSegmentCollision(circle, segment) {
  return segmentPointDistance(circle.x, circle.y, segment.x1, segment.y1, segment.x2, segment.y2) <= circle.radius + (segment.thickness || 0) / 2;
}
