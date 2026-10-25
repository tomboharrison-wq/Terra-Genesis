import { NX, NY, type ShorelineModel } from '../local/shoreline/model';

export const PX = 6; // canvas pixels per cell
const SEA = [61, 132, 184];
const LAGOON = [92, 160, 150];
const LAND = [122, 140, 88];
const SAND = [232, 212, 154];

/** Draw the shoreline model's sand fill, original coastline and today's waves (shared by lab and lessons). */
export function drawShoreline(ctx: CanvasRenderingContext2D, m: ShorelineModel): void {
  const img = ctx.createImageData(NX * PX, NY * PX);
  m.lagoonCells();
  const open = m.lagoonMask;
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) {
      const i = y * NX + x;
      const f = Math.min(1, Math.max(0, m.f[i]));
      const water = f < 0.5 && !open[i] ? LAGOON : SEA;
      const land = m.f0[i] >= 0.5 && f >= 0.5 ? LAND : SAND;
      const col = water.map((w, k) => Math.round(w + (land[k] - w) * f));
      for (let py = 0; py < PX; py++)
        for (let px = 0; px < PX; px++) {
          const o = (((NY - 1 - y) * PX + py) * NX * PX + x * PX + px) * 4;
          img.data[o] = col[0];
          img.data[o + 1] = col[1];
          img.data[o + 2] = col[2];
          img.data[o + 3] = 255;
        }
    }
  ctx.putImageData(img, 0, 0);
  // Original coastline (dashed).
  ctx.strokeStyle = 'rgba(29,26,22,0.55)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x < NX; x++) {
    let yy = 0;
    while (yy < NY && m.f0[yy * NX + x] >= 0.5) yy++;
    const sy = (NY - yy) * PX;
    if (x === 0) ctx.moveTo(0, sy);
    else ctx.lineTo(x * PX, sy);
    ctx.lineTo((x + 1) * PX, sy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Today's waves: arrows travelling landward from the open sea.
  const a = m.waveAngle;
  const dx = Math.sin(a);
  const dy = Math.cos(a); // canvas y down = landward
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (const cx of [NX * PX * 0.2, NX * PX * 0.5, NX * PX * 0.8]) {
    const x0 = cx - dx * 28;
    const y0 = 30 - dy * 20;
    const x1 = cx + dx * 28;
    const y1 = 30 + dy * 20;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.lineTo(x1 - 8 * Math.cos(ang - 0.5), y1 - 8 * Math.sin(ang - 0.5));
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 8 * Math.cos(ang + 0.5), y1 - 8 * Math.sin(ang + 0.5));
    ctx.stroke();
  }
  ctx.font = 'bold 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText("Today's waves", 8, 16);
}
