/**
 * Coordinate conventions (spec C6).
 * World: x = east (m), y = north (m), z = elevation (m). Cell (cx, cy) centre is at
 * (cx * cellSizeM, cy * cellSizeM). Array index i = cy * width + cx.
 * Three.js: three.x = world x, three.y = world z (up), three.z = -world y.
 */
export function worldToThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, -y];
}

export function threeToWorld(tx: number, ty: number, tz: number): [number, number, number] {
  return [tx, -tz, ty];
}
