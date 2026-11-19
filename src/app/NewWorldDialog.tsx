import { useMemo, useState } from 'react';
import { Dialog } from './Dialog';
import { PRESETS, presetById, type GenerateOptions, type PresetId } from '../terrain/generate';
import { randomSeed } from '../utils/rng';
import { CLASSROOM_SIZE, engine, getScene, newWorld, replaceWorld, syncSim } from './runtime';
import { useUi } from '../state/uiStore';
import { Icon } from './icons';
import { buildLiveWaterfallWorld } from '../sim/river/solidWaterfall';
import { buildLiveHeadlandWorld } from '../sim/coast/solidHeadland';
import { buildLiveLeveeWorld } from '../education/lessons/liveLevees';
import { playGeo, setGeoMode, setGeoSpeed } from './geoRunner';

const SIZES = [
  { v: 128, label: '128² (fast)' },
  { v: 256, label: '256² (standard)' },
  { v: 512, label: '512² (detailed)' },
  { v: 1024, label: '1024² (experimental)' },
];

export function NewWorldDialog() {
  const close = () => useUi.getState().set({ dialog: null });
  const [presetId, setPresetId] = useState<PresetId>('river-basin');
  const [seed, setSeed] = useState(() => randomSeed());
  const [size, setSize] = useState(() => (useUi.getState().classroom ? CLASSROOM_SIZE : 256));
  const [d, setD] = useState(() => ({ ...presetById('river-basin').defaults }));
  const [name, setName] = useState('');
  const [rain, setRain] = useState(() => presetById('river-basin').defaults.rainMmH ?? 0);
  const [boundary, setBoundary] = useState<'open' | 'closed'>('open');
  const [autoplay, setAutoplay] = useState(true);
  const [erosion, setErosion] = useState(() => presetById('river-basin').defaults.erosion ?? false);
  const [waves, setWaves] = useState(() => presetById('river-basin').defaults.waves ?? false);

  const pick = (id: PresetId) => {
    setPresetId(id);
    setD({ ...presetById(id).defaults });
    setRain(presetById(id).defaults.rainMmH ?? 0);
    setErosion(presetById(id).defaults.erosion ?? false);
    setWaves(presetById(id).defaults.waves ?? false);
  };
  const extentKm = useMemo(() => ((size - 1) * d.cellSizeM) / 1000, [size, d.cellSizeM]);

  const generate = () => {
    const o: GenerateOptions = { presetId, seed, size, ...d, rainMmH: rain, boundary, erosion, waves, name: name.trim() || `${presetById(presetId).name} ${seed}` };
    newWorld(o, autoplay && (rain > 0 || waves));
    close();
  };

  const num = (k: 'cellSizeM' | 'reliefM' | 'seaLevelM', label: string, unit: string, min: number, max: number, step: number) => (
    <label className="field">
      <span className="field-label">
        {label} <small>{unit}</small>
      </span>
      <input type="number" min={min} max={max} step={step} value={d[k]} onChange={(e) => setD({ ...d, [k]: Math.min(max, Math.max(min, +e.target.value || 0)) })} />
    </label>
  );

  return (
    <Dialog title="New world" onClose={close} wide>
      <div style={{ marginBottom: 12, background: 'rgba(255, 230, 39, 0.08)', border: '1px solid rgba(255, 230, 39, 0.3)', borderRadius: 8, padding: 10 }}>
        <div style={{ fontWeight: 700, color: 'var(--scouts-yellow)', marginBottom: 6, fontSize: 13 }}>
          🎬 Live 3D GCSE Landform Showcases — Click to Launch &amp; Watch Form Live on the 3D Model
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button
            className="small"
            onClick={() => {
              replaceWorld(buildLiveWaterfallWorld());
              setGeoMode(true);
              setGeoSpeed(10);
              playGeo();
              close();
            }}
            title="1 m solid rock waterfall: watch the falling river jet scour a plunge pool, undercut the soft shale overhang, collapse the hard caprock, and retreat into a gorge"
          >
            🌊 Live 3D Waterfall, Overhang &amp; Gorge
          </button>
          <button
            className="small"
            onClick={() => {
              replaceWorld(buildLiveHeadlandWorld());
              setGeoMode(true);
              setGeoSpeed(100);
              playGeo();
              close();
            }}
            title="1 m solid chalk headland: watch waves attack the rock joint to carve a sea cave, break through a 3D arch, collapse the roof into a stack, and leave a stump"
          >
            🪨 Live 3D Cave → Arch → Stack → Stump
          </button>
          <button
            className="small"
            onClick={() => {
              replaceWorld(buildLiveLeveeWorld());
              setGeoMode(true);
              setGeoSpeed(20);
              playGeo();
              close();
            }}
            title="4 m floodplain reach: watch repeated overbank flood deposition build real raised natural levees on both banks"
          >
            🛡 Live 3D Floodplain &amp; Natural Levees
          </button>
          <button
            className="small"
            onClick={() => {
              newWorld({ ...presetById('river-basin').defaults, presetId: 'river-basin', seed: 1700, size }, false);
              setGeoMode(true);
              const pWf = engine.enableEmbeddedWaterfall();
              setGeoSpeed(10000);
              playGeo();
              if (pWf) setTimeout(() => getScene()?.focusPoint(pWf.xM, pWf.yM, Math.max(260, 110 * pWf.scaleM)), 120);
              close();
            }}
            title="Full upland river basin with coupled 3D waterfall, vertical erosion carving a V-shaped valley, and interlocking spurs"
          >
            ⛰ Live 3D V-Valley, Spurs &amp; Coupled Waterfall
          </button>
          <button
            className="small"
            onClick={() => {
              newWorld({ ...presetById('river-delta').defaults, presetId: 'river-delta', seed: 1701, size }, false);
              setGeoMode(true);
              engine.enableLowlandMeander();
              engine.enableEmbeddedWaterfall();
              setGeoSpeed(1000);
              playGeo();
              syncSim();
              close();
            }}
            title="Full river-to-sea floodplain: watch meanders migrate, river cliffs & point bars form, necks cut off into oxbow lakes, and the mouth widen into a tidal estuary"
          >
            🔄 Live 3D Meanders, Oxbow Lakes &amp; Estuary
          </button>
          <button
            className="small"
            onClick={() => {
              newWorld({ ...presetById('coastal-headland').defaults, presetId: 'coastal-headland', seed: 1704, size, waves: true }, false);
              engine.world.coast.wavesOn = true;
              setGeoMode(true);
              const pHd = engine.enableEmbeddedHeadland();
              setGeoSpeed(1000);
              playGeo();
              if (pHd) setTimeout(() => getScene()?.focusPoint(pHd.xM, pHd.yM, Math.max(240, 100 * pHd.scaleM)), 120);
              close();
            }}
            title="Full discordant coast with coupled 3D headland arch/stack, differential bay retreat, wave-cut platforms, and bay beaches"
          >
            🏖 Live 3D Headlands, Bays, Beaches &amp; Arch
          </button>
          <button
            className="small"
            onClick={() => {
              newWorld({ ...presetById('alpine-glaciers').defaults, presetId: 'alpine-glaciers', seed: 1705, size }, false);
              engine.setClimateParams({ enabled: true, seaLevelTempC: -1 });
              engine.setGlacierParams({ enabled: true, slidingCoupling: 3, aspectBalance: 0.35, maxErosionMmYr: 10 });
              setGeoMode(true);
              setGeoSpeed(10000);
              playGeo();
              close();
            }}
            title="Full glaciated mountain range: watch glaciers fill the valleys and carve corries, arêtes, pyramidal peaks, U-shaped troughs, hanging valleys, and moraines"
          >
            🏔 Live 3D Glaciers: Corries, Arêtes &amp; U-Troughs
          </button>
        </div>
      </div>
      <div className="preset-grid">
        {PRESETS.map((p) => (
          <button key={p.id} className={`preset ${presetId === p.id ? 'active' : ''}`} onClick={() => pick(p.id)}>
            <b>{p.name}</b>
            <span>{p.description}</span>
          </button>
        ))}
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Name</span>
          <input value={name} placeholder={`${presetById(presetId).name} ${seed}`} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Seed</span>
          <div className="row">
            <input type="number" value={seed} onChange={(e) => setSeed(Math.abs(Math.floor(+e.target.value || 0)))} />
            <button className="icon" onClick={() => setSeed(randomSeed())} title="Random seed" aria-label="Random seed">
              <Icon name="dice" />
            </button>
          </div>
        </label>
        <label className="field">
          <span className="field-label">Map size</span>
          <select value={size} onChange={(e) => setSize(+e.target.value)}>
            {SIZES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {num('cellSizeM', 'Cell size', 'm', 1, 500, 1)}
        {num('reliefM', 'Vertical relief', 'm', 0, 6000, 10)}
        {num('seaLevelM', 'Sea level', 'm', -2000, 2000, 1)}
        <label className="field">
          <span className="field-label">
            Rainfall <small>mm/h</small>
          </span>
          <input type="number" min={0} max={300} step={1} value={rain} onChange={(e) => setRain(Math.min(300, Math.max(0, +e.target.value || 0)))} />
        </label>
        <label className="field">
          <span className="field-label">Map edges</span>
          <select value={boundary} onChange={(e) => setBoundary(e.target.value as 'open' | 'closed')}>
            <option value="open">Open outflow</option>
            <option value="closed">Closed walls</option>
          </select>
        </label>
        <label className="field check">
          <input type="checkbox" checked={erosion} onChange={(e) => setErosion(e.target.checked)} />
          <span>Erosion &amp; deposition on</span>
        </label>
        <label className="field check">
          <input type="checkbox" checked={waves} onChange={(e) => setWaves(e.target.checked)} />
          <span>Waves on</span>
        </label>
        <label className="field check">
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          <span>Start simulation if raining or waves on</span>
        </label>
        <label className="field">
          <span className="field-label">
            Roughness <b>{Math.round(d.roughness * 100)}%</b>
          </span>
          <input type="range" min={0} max={100} value={Math.round(d.roughness * 100)} onChange={(e) => setD({ ...d, roughness: +e.target.value / 100 })} />
        </label>
      </div>
      <div className="dialog-foot">
        <span className="muted">
          Extent {extentKm.toFixed(extentKm < 10 ? 2 : 1)} km × {extentKm.toFixed(extentKm < 10 ? 2 : 1)} km. Same seed + settings → identical terrain.
          {size >= 1024 && ' 1024² is experimental and may be slow.'}
        </span>
        <button className="primary" onClick={generate}>
          Generate world
        </button>
      </div>
    </Dialog>
  );
}
