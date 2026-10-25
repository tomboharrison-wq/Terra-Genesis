import { engine, getScene } from './runtime';
import { useUi } from '../state/uiStore';
import { overlayById, prepareOverlay, type Legend, type OverlayId } from '../renderer/overlays';
import { encodePng, heightmap16, heightmapMeta, rawFloat32 } from '../persistence/exports';
import { fmtSimTime } from './TimeBar';

/** Exports (spec F7): view image, top-down map image with legend, heightmaps. Project file: runtime.exportWorldFile. */

const baseName = () => engine.world.meta.name.replace(/[^\w-]+/g, '_') || 'world';

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** The 3D view exactly as shown. */
export async function exportViewImage() {
  const sc = getScene();
  if (!sc) return;
  const name = `${baseName()}-view.png`;
  download(await sc.captureView(), name);
  useUi.getState().toast(`Exported ${name}`, 'success');
}

const toSrgb = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));

/**
 * Top-down map, one block of pixels per cell, coloured by the chosen overlay (elevation tint when the
 * overlay has no per-cell colouring), north at the top, with title, legend, scale bar and time.
 */
export async function mapImageCanvas(overlay: OverlayId): Promise<HTMLCanvasElement> {
  engine.syncWater();
  const w = engine.world;
  const W = w.width;
  const H = w.height;
  const def = overlayById(overlay)?.colour ? overlayById(overlay)! : overlayById('elevation')!;
  const data = prepareOverlay(def.id, engine);
  const img = new ImageData(W, H);
  const rgb = new Float32Array(3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      def.colour!(engine, y * W + x, data, rgb, 0);
      const o = ((H - 1 - y) * W + x) * 4;
      img.data[o] = toSrgb(rgb[0]);
      img.data[o + 1] = toSrgb(rgb[1]);
      img.data[o + 2] = toSrgb(rgb[2]);
      img.data[o + 3] = 255;
    }
  const s = Math.max(1, Math.floor(1024 / Math.max(W, H)));
  const pad = 16;
  const foot = 96;
  const cv = document.createElement('canvas');
  cv.width = W * s + 2 * pad;
  cv.height = H * s + 2 * pad + foot;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, cv.width, cv.height);
  const cells = document.createElement('canvas');
  cells.width = W;
  cells.height = H;
  cells.getContext('2d')!.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = false;
  g.drawImage(cells, pad, pad, W * s, H * s);
  g.strokeStyle = '#333';
  g.strokeRect(pad - 0.5, pad - 0.5, W * s + 1, H * s + 1);
  // North arrow.
  g.fillStyle = '#111';
  g.font = 'bold 16px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('N ↑', pad + W * s - 22, pad + 22);
  // Footer: title, legend, scale bar.
  const y0 = pad * 2 + H * s;
  g.textAlign = 'left';
  g.font = 'bold 15px system-ui, sans-serif';
  g.fillText(`${w.meta.name} — ${def.label}`, pad, y0 + 14);
  g.font = '12px system-ui, sans-serif';
  g.fillStyle = '#444';
  g.fillText(`${fmtSimTime(w.simTimeSeconds)} · ${W} × ${H} cells of ${w.cellSizeM} m · Terra Genesis`, pad, y0 + 32);
  drawLegend(g, def.legend(engine, data), pad, y0 + 44, Math.min(320, W * s * 0.5));
  // Scale bar: a round length near a quarter of the map width.
  const mapM = W * w.cellSizeM;
  const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const len = nice.reduce((b, v) => (v <= mapM / 4 ? v : b), nice[0]);
  const px = (len / mapM) * W * s;
  const sx = pad + W * s - px;
  const sy = y0 + 60;
  g.fillStyle = '#111';
  g.fillRect(sx, sy, px, 6);
  g.fillStyle = '#fff';
  g.fillRect(sx + px / 2, sy + 1, px / 2 - 1, 4);
  g.fillStyle = '#111';
  g.textAlign = 'right';
  g.fillText(len >= 1000 ? `${len / 1000} km` : `${len} m`, pad + W * s, sy - 6);
  return cv;
}

function drawLegend(g: CanvasRenderingContext2D, l: Legend, x: number, y: number, width: number) {
  g.textAlign = 'left';
  g.font = '11px system-ui, sans-serif';
  if (l.kind === 'ramp') {
    const stops = l.css.match(/#[0-9a-f]{6}/gi) ?? ['#000000', '#ffffff'];
    const grad = g.createLinearGradient(x, 0, x + width, 0);
    stops.forEach((c, k) => grad.addColorStop(k / Math.max(1, stops.length - 1), c));
    g.fillStyle = grad;
    g.fillRect(x, y, width, 12);
    g.strokeStyle = '#666';
    g.strokeRect(x - 0.5, y - 0.5, width + 1, 13);
    g.fillStyle = '#222';
    g.fillText(l.labels[0], x, y + 28);
    g.textAlign = 'center';
    g.fillText(l.labels[1], x + width / 2, y + 28);
    g.textAlign = 'right';
    g.fillText(l.labels[2] + (l.unit ? ` ${l.unit}` : ''), x + width, y + 28);
  } else {
    let cx = x;
    for (const it of l.items.slice(0, 8)) {
      g.fillStyle = it.colour;
      g.fillRect(cx, y, 12, 12);
      g.fillStyle = '#222';
      g.fillText(it.label, cx + 16, y + 10);
      cx += 22 + g.measureText(it.label).width;
      if (cx > x + 2 * width) break;
    }
  }
}

export async function exportMapImage() {
  const ov = useUi.getState().terrainOverlay;
  const cv = await mapImageCanvas(ov);
  const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Map image failed'))), 'image/png'));
  const name = `${baseName()}-${overlayById(ov)?.colour ? ov : 'elevation'}-map.png`;
  download(blob, name);
  useUi.getState().toast(`Exported ${name}`, 'success');
}

/** 16-bit greyscale PNG heightmap (north at the top) with min/max in its text chunks. */
export async function heightmapPngBytes(): Promise<Uint8Array> {
  engine.syncWater();
  const w = engine.world;
  const hm = heightmap16(engine.surface, w.width, w.height);
  return encodePng(w.width, w.height, 'grey16', hm.pixels, {
    Software: 'Terra Genesis',
    Description: `Heightmap of ${w.meta.name}: elevation = min + value/65535 x (max - min); north at the top`,
    MinElevationM: String(hm.minM),
    MaxElevationM: String(hm.maxM),
    CellSizeM: String(w.cellSizeM),
  });
}

export async function exportHeightmapPng() {
  const name = `${baseName()}-heightmap16.png`;
  download(new Blob([(await heightmapPngBytes()) as BlobPart], { type: 'image/png' }), name);
  useUi.getState().toast(`Exported ${name}`, 'success');
}

/** float32 .raw in world order + .json metadata (two downloads). */
export function exportRawElevation() {
  engine.syncWater();
  const w = engine.world;
  const hm = heightmap16(engine.surface, w.width, w.height);
  download(new Blob([rawFloat32(engine.surface) as BlobPart], { type: 'application/octet-stream' }), `${baseName()}-elevation-f32.raw`);
  setTimeout(
    () => download(new Blob([JSON.stringify(heightmapMeta(w, hm.minM, hm.maxM), null, 2)], { type: 'application/json' }), `${baseName()}-elevation.json`),
    400,
  );
  useUi.getState().toast(`Exported ${baseName()}-elevation-f32.raw + .json`, 'success');
}
