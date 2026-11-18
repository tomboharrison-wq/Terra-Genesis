import { describe, expect, it } from 'vitest';
import { automaticCameraPose } from '../src/renderer/cameraPaths';

describe('M18-C08 automatic camera paths', () => {
  const ground = (x: number, y: number) => 100 + 0.02 * x + 0.01 * y;

  it('flyover moves through the world, stays above terrain and looks ahead', () => {
    const a = automaticCameraPose('flyover', 0, 4000, 3000, 800, ground);
    const b = automaticCameraPose('flyover', 20, 4000, 3000, 800, ground);
    expect(b.position).not.toEqual(a.position);
    expect(a.position[0]).toBeGreaterThanOrEqual(0);
    expect(a.position[0]).toBeLessThanOrEqual(4000);
    expect(-a.position[2]).toBeGreaterThanOrEqual(0);
    expect(-a.position[2]).toBeLessThanOrEqual(3000);
    expect(a.position[1]).toBeGreaterThan(ground(a.position[0], -a.position[2]));
    expect(a.target).not.toEqual(a.position);
  });

  it('cinematic orbit circles the complete landscape from a high stable altitude', () => {
    const poses = [0, 30, 60, 90].map((t) => automaticCameraPose('cinematic', t, 4000, 3000, 800, ground));
    expect(new Set(poses.map((p) => p.position.map((v) => Math.round(v)).join(','))).size).toBe(4);
    for (const p of poses) {
      expect(p.position[1]).toBeGreaterThan(1500);
      expect(p.target[0]).toBeGreaterThan(1500);
      expect(p.target[0]).toBeLessThan(2500);
    }
  });
});
