import { useEffect, useMemo, useRef } from 'react';
import { cloneWorld, type WorldState } from '../engine/world';
import { diffSummary } from '../engine/checkpoints';
import { terrainColour } from '../renderer/palette';
import { Dialog } from './Dialog';
import { engine } from './runtime';
import { useUi } from '../state/uiStore';

const toSrgb = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

/** Pure north-up landscape pixels used by the classroom comparison and its regression test. */
export function comparisonPixels(w: WorldState, surface: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w.width * w.height * 4);
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const z of surface) {
    zMin = Math.min(zMin, z);
    zMax = Math.max(zMax, z);
  }
  const relief = Math.max(1, zMax - Math.max(w.seaLevelM, zMin));
  const rgb = new Float32Array(3);
  for (let y = 0; y < w.height; y++)
    for (let x = 0; x < w.width; x++) {
      const i = y * w.width + x;
      const xl = Math.max(0, x - 1);
      const xr = Math.min(w.width - 1, x + 1);
      const yd = Math.max(0, y - 1);
      const yu = Math.min(w.height - 1, y + 1);
      const sx = (surface[y * w.width + xr] - surface[y * w.width + xl]) / (Math.max(1, xr - xl) * w.cellSizeM);
      const sy = (surface[yu * w.width + x] - surface[yd * w.width + x]) / (Math.max(1, yu - yd) * w.cellSizeM);
      terrainColour({ materialId: w.materialId[i], sedimentM: w.looseSedimentThicknessM[i], slope: Math.hypot(sx, sy), aboveSeaM: surface[i] - w.seaLevelM, reliefM: relief }, rgb, 0);
      let r = toSrgb(rgb[0]);
      let g = toSrgb(rgb[1]);
      let b = toSrgb(rgb[2]);
      if (surface[i] < w.seaLevelM) {
        const d = Math.min(1, (w.seaLevelM - surface[i]) / Math.max(10, relief * 0.2));
        r = mix(72, 18, d);
        g = mix(145, 68, d);
        b = mix(188, 120, d);
      } else {
        const veg = Math.min(0.78, w.vegCover[i] * 0.78);
        r = mix(r, 49, veg);
        g = mix(g, 103, veg);
        b = mix(b, 48, veg);
      }
      if (w.waterDepthM[i] > 0.01) {
        const a = Math.min(0.8, 0.25 + w.waterDepthM[i] / 3);
        r = mix(r, 43, a);
        g = mix(g, 126, a);
        b = mix(b, 196, a);
      }
      if (w.iceThicknessM[i] > 0.5) {
        const a = Math.min(0.95, w.iceThicknessM[i] / 5);
        r = mix(r, 220, a);
        g = mix(g, 238, a);
        b = mix(b, 246, a);
      }
      const o = ((w.height - 1 - y) * w.width + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  return out;
}

function MapCanvas({ w, surface, label }: { w: WorldState; surface: Float32Array; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    cv.width = w.width;
    cv.height = w.height;
    cv.getContext('2d')!.putImageData(new ImageData(comparisonPixels(w, surface), w.width, w.height), 0, 0);
  }, [w, surface]);
  return (
    <figure className="compare-map">
      <figcaption>{label}</figcaption>
      <canvas ref={ref} aria-label={`${label} landscape map`} />
      <span>N ↑</span>
    </figure>
  );
}

const fmtVol = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(2)} million m³` : `${Math.round(v).toLocaleString()} m³`);

export function BeforeAfterDialog() {
  const close = () => useUi.getState().set({ dialog: null });
  const cp = engine.compareCheckpoint;
  const now = useMemo(() => ({ world: cloneWorld(engine.world), surface: engine.surface.slice() }), []);
  if (!cp) return <Dialog title="Before and after" onClose={close}><p>No comparison checkpoint is selected.</p></Dialog>;
  const sum = diffSummary(cp, now.world, now.surface);
  return (
    <Dialog title={`Before and after: ${cp.label}`} onClose={close} wide>
      <p className="hint small tight">Both maps use the same north-up natural colouring and exact world cells. Before is the selected checkpoint. After is the world when this view opened.</p>
      <div className="compare-split">
        <MapCanvas w={cp.world} surface={cp.surface} label={`BEFORE: ${cp.label}`} />
        <MapCanvas w={now.world} surface={now.surface} label="AFTER: current world" />
      </div>
      <div className="compare-facts" aria-label="Measured changes">
        <span><b>{fmtVol(sum.loweredM3)}</b> ground lowered</span>
        <span><b>{fmtVol(sum.raisedM3)}</b> ground raised</span>
        <span><b>{(sum.changedAreaM2 / 1e6).toFixed(2)} km²</b> changed by over 5 cm</span>
        <span><b>{sum.maxLoweringM.toFixed(1)} m</b> biggest drop</span>
        <span><b>{sum.maxRaisingM.toFixed(1)} m</b> biggest rise</span>
      </div>
    </Dialog>
  );
}
