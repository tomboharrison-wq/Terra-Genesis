import { useMemo, useState } from 'react';
import { Dialog } from './Dialog';
import { PRESETS, presetById, type GenerateOptions, type PresetId } from '../terrain/generate';
import { randomSeed } from '../utils/rng';
import { newWorld } from './runtime';
import { useUi } from '../state/uiStore';
import { Icon } from './icons';

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
  const [size, setSize] = useState(256);
  const [d, setD] = useState(() => ({ ...presetById('river-basin').defaults }));
  const [name, setName] = useState('');
  const [rain, setRain] = useState(() => presetById('river-basin').defaults.rainMmH ?? 0);
  const [boundary, setBoundary] = useState<'open' | 'closed'>('open');
  const [autoplay, setAutoplay] = useState(true);
  const [erosion, setErosion] = useState(() => presetById('river-basin').defaults.erosion ?? false);

  const pick = (id: PresetId) => {
    setPresetId(id);
    setD({ ...presetById(id).defaults });
    setRain(presetById(id).defaults.rainMmH ?? 0);
    setErosion(presetById(id).defaults.erosion ?? false);
  };
  const extentKm = useMemo(() => ((size - 1) * d.cellSizeM) / 1000, [size, d.cellSizeM]);

  const generate = () => {
    const o: GenerateOptions = { presetId, seed, size, ...d, rainMmH: rain, boundary, erosion, name: name.trim() || `${presetById(presetId).name} ${seed}` };
    newWorld(o, autoplay && rain > 0);
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
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          <span>Start simulation if raining</span>
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
