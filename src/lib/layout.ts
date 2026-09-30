/**
 * Deterministic "constellation" layout.
 *
 * The queried wallet sits at the origin. Counterparties are placed on a
 * golden-angle spiral ordered by interaction count, so the busiest stars orbit
 * closest to the centre, then a short relaxation pass separates overlapping
 * stars. The result depends only on the input order and weights, which keeps
 * the map stable between renders and easy to test.
 */

export interface LayoutInput {
  id: string;
  weight: number;
}

export interface LayoutPoint {
  x: number;
  y: number;
  r: number;
}

export interface LayoutResult {
  points: Map<string, LayoutPoint>;
  centerRadius: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export const MIN_NODE_RADIUS = 7;
export const MAX_NODE_RADIUS = 26;
export const CENTER_NODE_RADIUS = 20;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function nodeRadius(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return MIN_NODE_RADIUS;
  const t = Math.sqrt(Math.max(0, weight) / maxWeight);
  return MIN_NODE_RADIUS + (MAX_NODE_RADIUS - MIN_NODE_RADIUS) * t;
}

export function layoutConstellation(nodes: LayoutInput[]): LayoutResult {
  const points = new Map<string, LayoutPoint>();
  const maxWeight = nodes.reduce((m, n) => Math.max(m, n.weight), 0);
  const count = nodes.length;

  // Spread the spiral a little more on dense maps, but keep the whole
  // constellation compact enough to read at the initial zoom.
  const spacing = 30 + Math.min(14, count * 0.12);
  const innerRadius = CENTER_NODE_RADIUS + 96;

  const positions = nodes.map((node, index) => {
    const r = nodeRadius(node.weight, maxWeight);
    const distance = innerRadius + spacing * Math.sqrt(index);
    const angle = index * GOLDEN_ANGLE;
    return { id: node.id, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, r };
  });

  // Relax overlaps: a few iterations of pairwise separation keeps large
  // stars from covering their neighbours without needing a full force sim.
  const padding = 10;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    let moved = false;
    for (let i = 0; i < positions.length; i += 1) {
      const a = positions[i]!;
      for (let j = i + 1; j < positions.length; j += 1) {
        const b = positions[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const min = a.r + b.r + padding;
        if (dist < min) {
          const push = (min - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
          moved = true;
        }
      }
      // Keep every star clear of the centre.
      const centreDist = Math.hypot(a.x, a.y) || 0.001;
      const minCentre = CENTER_NODE_RADIUS + a.r + 40;
      if (centreDist < minCentre) {
        a.x = (a.x / centreDist) * minCentre;
        a.y = (a.y / centreDist) * minCentre;
        moved = true;
      }
    }
    if (!moved) break;
  }

  let minX = -CENTER_NODE_RADIUS;
  let minY = -CENTER_NODE_RADIUS;
  let maxX = CENTER_NODE_RADIUS;
  let maxY = CENTER_NODE_RADIUS;
  for (const p of positions) {
    points.set(p.id, { x: round(p.x), y: round(p.y), r: round(p.r) });
    minX = Math.min(minX, p.x - p.r);
    minY = Math.min(minY, p.y - p.r);
    maxX = Math.max(maxX, p.x + p.r);
    maxY = Math.max(maxY, p.y + p.r);
  }

  return {
    points,
    centerRadius: CENTER_NODE_RADIUS,
    bounds: { minX: round(minX), minY: round(minY), maxX: round(maxX), maxY: round(maxY) },
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
