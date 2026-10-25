import { useState } from 'react';
import { useUi } from '../state/uiStore';
import { Dialog } from './Dialog';
import { exportWorldFile } from './runtime';
import { exportHeightmapPng, exportMapImage, exportRawElevation, exportViewImage } from './exportImages';
import { overlayById } from '../renderer/overlays';

/** Export choices (spec F7): every item writes a real file from the current world. */
export function ExportDialog() {
  const set = useUi((s) => s.set);
  const overlay = useUi((s) => s.terrainOverlay);
  const [busy, setBusy] = useState(false);
  const close = () => set({ dialog: null });
  const run = (fn: () => unknown) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      useUi.getState().toast(`Export failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  const ov = overlayById(overlay);
  const mapLabel = ov?.colour ? ov.label : 'Elevation';
  const items = [
    {
      id: 'project',
      title: 'Project file (.tgw)',
      text: 'The whole world — rock, soil, water, ice, plants, settings and time. Open it again with Import.',
      fn: exportWorldFile,
    },
    { id: 'view', title: 'View image (PNG)', text: 'The 3D view exactly as it looks now.', fn: exportViewImage },
    {
      id: 'map',
      title: `Map image (PNG): ${mapLabel}`,
      text: 'Top-down map, one block per cell, north at the top, with title, legend and scale bar. Uses the map overlay chosen in the time bar.',
      fn: exportMapImage,
    },
    {
      id: 'heightmap',
      title: 'Heightmap (16-bit PNG)',
      text: 'Ground height as 65,536 grey levels, north at the top; the lowest and highest heights are stored inside the file. For GIS and 3D programs.',
      fn: exportHeightmapPng,
    },
    {
      id: 'raw',
      title: 'Elevation data (float32 .raw + .json)',
      text: 'Exact heights in metres as 32-bit floats, with a .json file giving the size, cell size and row order.',
      fn: exportRawElevation,
    },
  ];
  return (
    <Dialog title="Export" onClose={close}>
      <ul className="export-list">
        {items.map((it) => (
          <li key={it.id}>
            <div>
              <b>{it.title}</b>
              <p className="hint small tight">{it.text}</p>
            </div>
            <button className="small" disabled={busy} onClick={run(it.fn)} data-export={it.id}>
              Download
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
