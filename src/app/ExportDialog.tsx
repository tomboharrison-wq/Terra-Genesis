import { useState } from 'react';
import { useUi } from '../state/uiStore';
import { Dialog } from './Dialog';
import { exportWorldFile } from './runtime';
import { exportHeightmapPng, exportMapImage, exportMinecraftTerrain, exportRawElevation, exportTerrainGlb, exportViewImage, exportViewVideo } from './exportImages';
import { overlayById } from '../renderer/overlays';
import { TEACHER_SETUPS } from '../education/teacherSetups';
import { teacherSetupLink } from './teacherSetupRunner';

/** Export choices (spec F7): every item writes a real file from the current world. */
export function ExportDialog() {
  const set = useUi((s) => s.set);
  const overlay = useUi((s) => s.terrainOverlay);
  const solid = useUi((s) => s.world?.presetId.startsWith('solid-'));
  const [busy, setBusy] = useState(false);
  const [setupId, setSetupId] = useState(TEACHER_SETUPS[0].id);
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
    {
      id: 'glb',
      title: '3D terrain model (GLB)',
      text: 'Full-resolution coloured triangle mesh in real metres for Blender, GIS viewers and game engines.',
      fn: exportTerrainGlb,
    },
    {
      id: 'video',
      title: 'Record live view (10 second WebM)',
      text: 'Records the next ten seconds from the current camera. Start Fly over or Cinematic orbit first for a moving presentation shot.',
      fn: exportViewVideo,
    },
    {
      id: 'minecraft',
      title: 'Minecraft terrain (WorldPainter)',
      text: 'A 16-bit north-up height map plus exact Java 1.18+ import settings, with model sea level mapped to Minecraft Y=63.',
      fn: exportMinecraftTerrain,
    },
  ];
  return (
    <Dialog title="Export" onClose={close}>
      <ul className="export-list">
        {items.filter((it) => !solid || ['project', 'view', 'video'].includes(it.id)).map((it) => (
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
      <h3>Share a fixed lesson preset</h3>
      <p className="hint small tight">The link recreates the same terrain, seed and starting processes on any device running this deployed version.</p>
      <div className="row">
        <select value={setupId} onChange={(e) => setSetupId(e.target.value as typeof setupId)} aria-label="Lesson preset">
          {TEACHER_SETUPS.map((setup) => <option key={setup.id} value={setup.id}>{setup.title} · seed {setup.seed}</option>)}
        </select>
        <button
          className="small"
          onClick={run(async () => {
            await navigator.clipboard.writeText(teacherSetupLink(setupId));
            useUi.getState().toast('Lesson preset link copied', 'success');
          })}
        >
          Copy link
        </button>
      </div>
    </Dialog>
  );
}
