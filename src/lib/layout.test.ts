import { describe, expect, it } from 'vitest';
import { CENTER_NODE_RADIUS, MAX_NODE_RADIUS, MIN_NODE_RADIUS, layoutConstellation, nodeRadius } from './layout';

describe('nodeRadius', () => {
  it('grows with interaction count between the min and max radius', () => {
    expect(nodeRadius(0, 10)).toBe(MIN_NODE_RADIUS);
    expect(nodeRadius(10, 10)).toBe(MAX_NODE_RADIUS);
    const mid = nodeRadius(5, 10);
    expect(mid).toBeGreaterThan(MIN_NODE_RADIUS);
    expect(mid).toBeLessThan(MAX_NODE_RADIUS);
  });

  it('is stable when nothing has weight', () => {
    expect(nodeRadius(0, 0)).toBe(MIN_NODE_RADIUS);
  });
});

describe('layoutConstellation', () => {
  const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, weight: 40 - i }));

  it('is deterministic', () => {
    const a = layoutConstellation(nodes);
    const b = layoutConstellation(nodes);
    expect([...a.points.entries()]).toEqual([...b.points.entries()]);
  });

  it('places the busiest star closest to the centre and never overlaps the centre', () => {
    const result = layoutConstellation(nodes);
    const first = result.points.get('n0')!;
    const last = result.points.get('n39')!;
    expect(Math.hypot(first.x, first.y)).toBeLessThan(Math.hypot(last.x, last.y));
    for (const point of result.points.values()) {
      expect(Math.hypot(point.x, point.y)).toBeGreaterThanOrEqual(CENTER_NODE_RADIUS + point.r);
    }
  });

  it('keeps stars from overlapping each other', () => {
    const result = layoutConstellation(nodes);
    const points = [...result.points.values()];
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]!;
        const b = points[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - 0.5);
      }
    }
  });

  it('returns bounds that contain every star', () => {
    const result = layoutConstellation(nodes);
    for (const point of result.points.values()) {
      expect(point.x - point.r).toBeGreaterThanOrEqual(result.bounds.minX - 0.01);
      expect(point.x + point.r).toBeLessThanOrEqual(result.bounds.maxX + 0.01);
      expect(point.y - point.r).toBeGreaterThanOrEqual(result.bounds.minY - 0.01);
      expect(point.y + point.r).toBeLessThanOrEqual(result.bounds.maxY + 0.01);
    }
  });

  it('handles an empty map', () => {
    const result = layoutConstellation([]);
    expect(result.points.size).toBe(0);
    expect(result.bounds).toEqual({ minX: -20, minY: -20, maxX: 20, maxY: 20 });
  });
});
