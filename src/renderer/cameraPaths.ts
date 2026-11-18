export type CameraMode = 'orbit' | 'first-person' | 'flyover' | 'cinematic';

export interface AutoCameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/** Deterministic presentation paths in Three.js axes. */
export function automaticCameraPose(
  mode: 'flyover' | 'cinematic',
  seconds: number,
  extentX: number,
  extentY: number,
  reliefM: number,
  surfaceAt: (xM: number, yM: number) => number,
): AutoCameraPose {
  const cx = extentX / 2;
  const cy = extentY / 2;
  const size = Math.max(extentX, extentY);
  if (mode === 'cinematic') {
    const a = seconds * 0.055;
    const r = size * 0.82;
    const tx = cx + Math.cos(a * 0.45) * extentX * 0.08;
    const ty = cy + Math.sin(a * 0.45) * extentY * 0.08;
    return {
      position: [cx + Math.cos(a) * r, Math.max(surfaceAt(cx, cy), 0) + size * 0.42 + reliefM * 0.25, -(cy + Math.sin(a) * r)],
      target: [tx, surfaceAt(tx, ty), -ty],
    };
  }
  const a = seconds * 0.09;
  const x = cx + Math.cos(a) * extentX * 0.38;
  const y = cy + Math.sin(a * 0.72) * extentY * 0.38;
  const aheadA = a + 0.18;
  const tx = cx + Math.cos(aheadA) * extentX * 0.38;
  const ty = cy + Math.sin(aheadA * 0.72) * extentY * 0.38;
  return {
    position: [x, surfaceAt(x, y) + Math.max(20, size * 0.09), -y],
    target: [tx, surfaceAt(tx, ty) + reliefM * 0.03, -ty],
  };
}
