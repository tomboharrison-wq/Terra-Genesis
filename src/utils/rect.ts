/** Inclusive-exclusive integer cell rectangle: x0 <= x < x1, y0 <= y < y1. */
export interface CellRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function clampRect(r: CellRect, width: number, height: number): CellRect | null {
  const x0 = Math.max(0, r.x0);
  const y0 = Math.max(0, r.y0);
  const x1 = Math.min(width, r.x1);
  const y1 = Math.min(height, r.y1);
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

export function unionRect(a: CellRect | null, b: CellRect | null): CellRect | null {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

export function expandRect(r: CellRect, by: number): CellRect {
  return { x0: r.x0 - by, y0: r.y0 - by, x1: r.x1 + by, y1: r.y1 + by };
}
