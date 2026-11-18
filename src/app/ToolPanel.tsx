import { useUi, DEFAULT_RATES, isBrushTool, isWaterTool } from '../state/uiStore';
import { WaterPanel } from './WaterPanel';
import { ErosionPanel } from './ErosionPanel';
import { ProfilePanel } from './ProfilePanel';
import { ClimatePanel } from './ClimatePanel';
import { PlatesPanel } from './PlatesPanel';
import { QuakePanel } from './QuakePanel';
import { VolcanoPanel } from './VolcanoPanel';
import { MeasurePanel } from './MeasurePanel';
import { CoastPanel } from './CoastPanel';
import { HazardsPanel } from './HazardsPanel';
import { MeteorPanel } from './MeteorPanel';
import { toolById } from './tools';
import { BEDROCK_MATERIALS } from '../terrain/materials';
import { getScene } from './runtime';
import { Icon } from './icons';
import type { LandformKind } from '../tools/brush';
import { enableAudio, playSfx } from './audio';
import { SolidHeadlandPanel } from './SolidHeadlandPanel';
import { SolidWaterfallPanel } from './SolidWaterfallPanel';

const LANDFORMS: { id: LandformKind; label: string }[] = [
  { id: 'ridge', label: 'Ridge' },
  { id: 'valley', label: 'Valley' },
  { id: 'plateau', label: 'Plateau' },
  { id: 'depression', label: 'Depression' },
  { id: 'slope', label: 'Graded slope' },
  { id: 'channel', label: 'Channel' },
  { id: 'embankment', label: 'Embankment' },
];

/** Log-scale slider helper: position 0..1000 ↔ value in [min, max]. */
function LogSlider(props: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void; digits?: number }) {
  const { min, max, value } = props;
  const toPos = (v: number) => (Math.log(v / min) / Math.log(max / min)) * 1000;
  const fromPos = (p: number) => min * Math.pow(max / min, p / 1000);
  const digits = props.digits ?? (value < 1 ? 2 : value < 10 ? 1 : 0);
  return (
    <label className="field">
      <span className="field-label">
        {props.label}
        <b>
          {value.toFixed(digits)} {props.unit}
        </b>
      </span>
      <input type="range" min={0} max={1000} value={toPos(Math.min(max, Math.max(min, value)))} onChange={(e) => props.onChange(fromPos(+e.target.value))} />
    </label>
  );
}

function fmtM(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`;
}

export function ToolPanel() {
  const s = useUi();
  if (s.world?.presetId === 'solid-waterfall') return <SolidWaterfallPanel />;
  if (s.world?.presetId === 'solid-headland') return <SolidHeadlandPanel />;
  const t = toolById(s.tool);
  const world = s.world;
  if (!s.panelOpen) {
    return (
      <button className="panel-reopen" onClick={() => s.set({ panelOpen: true })} title="Show panel">
        <Icon name="panel" />
      </button>
    );
  }
  const cs = world?.cellSizeM ?? 10;
  const extent = world ? (Math.max(world.width, world.height) - 1) * cs : 1000;
  const brush = isBrushTool(t.id);
  const water = isWaterTool(t.id);
  const measure = t.id === 'profile' || t.id === 'measure';
  const events = t.id === 'landslide';
  const coastTool = t.id === 'coast';
  const climateTool = t.id === 'climate';
  const platesTool = t.id === 'plates';
  const quakeTool = t.id === 'earthquake' || t.id === 'volcano' || t.id === 'meteor'; // tools with their own event panel

  return (
    <aside className="panel" aria-label="Tool settings">
      <div className="panel-head">
        <h2>{t.label}</h2>
        <button className="icon ghost" onClick={() => s.set({ panelOpen: false })} aria-label="Hide panel">
          <Icon name="close" size={16} />
        </button>
      </div>
      <p className="hint">{t.hint}</p>

      {brush && (
        <>
          <LogSlider label="Radius" unit="m" value={s.radiusM} min={cs * 1.5} max={extent / 3} onChange={(v) => s.set({ radiusM: v })} />
          {t.rateLabel && (
            <LogSlider
              label={t.rateLabel}
              unit=""
              value={s.rates[s.tool as keyof typeof DEFAULT_RATES]}
              min={t.rateMin!}
              max={t.rateMax!}
              onChange={(v) => s.setRate(s.tool as keyof typeof DEFAULT_RATES, v)}
            />
          )}
          <label className="field">
            <span className="field-label">
              Edge hardness <b>{Math.round(s.hardness * 100)}%</b>
            </span>
            <input type="range" min={0} max={95} value={Math.round(s.hardness * 100)} onChange={(e) => s.set({ hardness: +e.target.value / 100 })} />
          </label>
          {s.tool === 'paint' && (
            <div className="field">
              <span className="field-label">Bedrock lithology</span>
              <div className="swatches">
                {BEDROCK_MATERIALS.map((m) => (
                  <button
                    key={m.id}
                    className={`swatch ${s.paintMaterialId === m.id ? 'active' : ''}`}
                    onClick={() => s.set({ paintMaterialId: m.id })}
                    title={`${m.name} — relative erodibility ${m.erodibility} (used from erosion milestone)`}
                  >
                    <i style={{ background: `#${m.colour.toString(16).padStart(6, '0')}` }} />
                    {m.name}
                  </button>
                ))}
              </div>
              <p className="hint small">Tip: use “Strip soil” to expose painted rock under thick sediment.</p>
            </div>
          )}
          {s.tool === 'flatten' && <p className="hint small">Target elevation is sampled where each stroke starts.</p>}
          {s.tool === 'landform' && (
            <div className="landform-controls">
              <label className="field">
                <span className="field-label">Landform profile</span>
                <select value={s.landform.kind} onChange={(e) => s.set({ landform: { ...s.landform, kind: e.target.value as LandformKind } })}>
                  {LANDFORMS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Direction <b>{s.landform.directionDeg}°</b></span>
                <input type="range" min={0} max={359} value={s.landform.directionDeg} onChange={(e) => s.set({ landform: { ...s.landform, directionDeg: +e.target.value } })} />
              </label>
              {s.landform.kind === 'slope' && (
                <label className="field">
                  <span className="field-label">Slope angle <b>{s.landform.slopeDeg}°</b></span>
                  <input type="range" min={1} max={45} value={s.landform.slopeDeg} onChange={(e) => s.set({ landform: { ...s.landform, slopeDeg: +e.target.value } })} />
                </label>
              )}
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Minimum height (m)</span>
                  <input type="number" value={s.landform.minElevationM} onChange={(e) => s.set({ landform: { ...s.landform, minElevationM: +e.target.value } })} />
                </label>
                <label className="field">
                  <span className="field-label">Maximum height (m)</span>
                  <input type="number" value={s.landform.maxElevationM} onChange={(e) => s.set({ landform: { ...s.landform, maxElevationM: +e.target.value } })} />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Geology mask</span>
                <select value={s.landform.materialMask} onChange={(e) => s.set({ landform: { ...s.landform, materialMask: +e.target.value } })}>
                  <option value={-1}>All exposed rocks</option>
                  {BEDROCK_MATERIALS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </label>
              <p className="hint small">Plateaux and slopes use the height at the start of the stroke. A pressure-sensitive pen controls strength.</p>
            </div>
          )}
          <button
            className="ghost small"
            onClick={() => {
              s.setRate(s.tool as keyof typeof DEFAULT_RATES, DEFAULT_RATES[s.tool as keyof typeof DEFAULT_RATES]);
              s.set({ hardness: 0.3, radiusM: Math.min(extent / 6, Math.max(cs * 8, 300)) });
            }}
          >
            Reset to defaults
          </button>
          <div className="keys">
            <kbd>[</kbd> <kbd>]</kbd> radius · hold <kbd>Space</kbd> or <kbd>⌥</kbd> to orbit while sculpting
          </div>
        </>
      )}

      {water && (
        <>
          {t.id !== 'spring' && (
            <>
              <LogSlider label="Radius" unit="m" value={s.radiusM} min={cs * 1.5} max={extent / 3} onChange={(v) => s.set({ radiusM: v })} />
              <LogSlider label={t.rateLabel!} unit="" value={s.waterRate} min={t.rateMin!} max={t.rateMax!} onChange={(v) => s.set({ waterRate: v })} />
            </>
          )}
          {t.id === 'spring' && (
            <LogSlider label="New spring discharge" unit="m³/s" value={s.springRate} min={0.1} max={2000} onChange={(v) => s.set({ springRate: v })} />
          )}
          <p className="hint small">Water tools act on the simulated water directly and are not undoable (use saves as checkpoints).</p>
        </>
      )}

      {events && (
        <>
          <LogSlider label="Zone radius" unit="m" value={s.radiusM} min={cs * 1.5} max={extent / 3} onChange={(v) => s.set({ radiusM: v })} />
          <p className="hint small">
            Saturation lowers the stable angle of debris to half its dry value and weakens rock in the zone. Where nothing is steep enough, nothing moves.
          </p>
          <button className="small" onClick={() => s.set({ dialog: 'slump' })}>
            Open rotational slump lab (cross-section)
          </button>
          <p className="hint small">The map shows generalised mass movement; curved-slip rotational slumping is shown in its own guided cross-section model.</p>
        </>
      )}
      {coastTool && <CoastPanel />}
      {climateTool && <ClimatePanel />}
      {platesTool && <PlatesPanel />}
      {t.id === 'earthquake' && <QuakePanel />}
      {t.id === 'volcano' && <VolcanoPanel />}
      {t.id === 'measure' && <MeasurePanel />}
      {t.id === 'hazards' && <HazardsPanel />}
      {t.id === 'meteor' && <MeteorPanel />}
      {(t.id === 'profile' || s.profile) && <ProfilePanel />}
      {(water || (!brush && !measure && !events && !coastTool && !climateTool && !platesTool && !quakeTool)) && <WaterPanel />}
      {(water || (!brush && !measure && !coastTool && !climateTool && !platesTool && !quakeTool)) && <ErosionPanel />}

      {!brush && !water && !measure && !events && !coastTool && !climateTool && !platesTool && !quakeTool && (
        <div className="cam-buttons">
          <button onClick={() => { s.set({ cameraMode: 'orbit' }); getScene()?.fitWorld(); }}>
            <Icon name="fit" /> Fit world <kbd>F</kbd>
          </button>
          <button onClick={() => { s.set({ cameraMode: 'orbit' }); getScene()?.topDown(); }}>
            <Icon name="top" /> Top-down <kbd>T</kbd>
          </button>
          <button onClick={() => { s.set({ cameraMode: 'orbit' }); getScene()?.oblique(); }}>
            <Icon name="oblique" /> Oblique <kbd>O</kbd>
          </button>
          <div className="camera-modes">
            <button className={s.cameraMode === 'orbit' ? 'active-toggle' : ''} onClick={() => s.set({ cameraMode: 'orbit' })}>Orbit</button>
            <button className={s.cameraMode === 'first-person' ? 'active-toggle' : ''} onClick={() => s.set({ cameraMode: 'first-person' })}>Explore on foot</button>
            <button className={s.cameraMode === 'flyover' ? 'active-toggle' : ''} onClick={() => s.set({ cameraMode: 'flyover' })}>Fly over</button>
            <button className={s.cameraMode === 'cinematic' ? 'active-toggle' : ''} onClick={() => s.set({ cameraMode: 'cinematic' })}>Cinematic orbit</button>
          </div>
          <button
            disabled={s.pins.length === 0 && !s.hover}
            onClick={() => {
              const p = s.pins[s.pins.length - 1] ?? (s.hover ? { xM: s.hover.xM, yM: s.hover.yM } : null);
              if (p) {
                s.set({ cameraMode: 'orbit' });
                getScene()?.focusPoint(p.xM, p.yM);
              }
            }}
          >
            Focus selected point
          </button>
          <label className="field" style={{ marginTop: 8 }}>
            <span className="field-label">
              Sun elevation (raking light) <b>{s.sunElevationDeg}°</b>
            </span>
            <input
              type="range"
              min={8}
              max={82}
              value={s.sunElevationDeg}
              onChange={(e) => s.set({ sunElevationDeg: +e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Sun azimuth <b>{s.sunAzimuthDeg}°</b>
            </span>
            <input
              type="range"
              min={0}
              max={360}
              value={s.sunAzimuthDeg}
              onChange={(e) => s.set({ sunAzimuthDeg: +e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Vertical exaggeration <b>{s.verticalExaggeration.toFixed(1)}×</b>
            </span>
            <input
              type="range"
              min={10}
              max={30}
              value={Math.round(s.verticalExaggeration * 10)}
              onChange={(e) => s.set({ verticalExaggeration: +e.target.value / 10 })}
            />
          </label>
          <p className="hint small">Arrow keys / WASD move. In Explore on foot the camera follows the ground. Trackpad: two-finger scroll zooms, pinch zooms, click-drag orbits.</p>
          <h3>Sound</h3>
          <button
            className={s.audio.enabled ? 'active-toggle' : ''}
            onClick={() => {
              const audio = { ...s.audio, enabled: !s.audio.enabled };
              s.set({ audio });
              if (audio.enabled) void enableAudio(audio, s.classroom).then(() => playSfx('success'));
            }}
          >
            {s.audio.enabled ? 'Sound on' : 'Turn sound on'}
          </button>
          {s.audio.enabled && (
            <>
              <label className="field">
                <span className="field-label">Master <b>{Math.round(s.audio.master * 100)}%</b></span>
                <input type="range" min={0} max={100} value={Math.round(s.audio.master * 100)} onChange={(e) => s.set({ audio: { ...s.audio, master: +e.target.value / 100 } })} />
              </label>
              <label className="field">
                <span className="field-label">Effects <b>{Math.round(s.audio.sfx * 100)}%</b></span>
                <input type="range" min={0} max={100} value={Math.round(s.audio.sfx * 100)} onChange={(e) => s.set({ audio: { ...s.audio, sfx: +e.target.value / 100 } })} />
              </label>
              <label className="field">
                <span className="field-label">Music and ambience <b>{Math.round(s.audio.music * 100)}%</b></span>
                <input type="range" min={0} max={100} value={Math.round(s.audio.music * 100)} onChange={(e) => s.set({ audio: { ...s.audio, music: +e.target.value / 100 } })} />
              </label>
              <label className="field check">
                <input type="checkbox" checked={s.audio.classroomMute} onChange={(e) => s.set({ audio: { ...s.audio, classroomMute: e.target.checked } })} />
                <span>Mute automatically in Classroom mode</span>
              </label>
            </>
          )}
          <p className="hint small">Sound is off by default and starts only after you turn it on.</p>
        </div>
      )}

      {world && (
        <section className="world-facts">
          <h3>World</h3>
          <dl>
            <dt>Grid</dt>
            <dd>
              {world.width} × {world.height} cells
            </dd>
            <dt>Cell size</dt>
            <dd>{world.cellSizeM} m</dd>
            <dt>Extent</dt>
            <dd>
              {fmtM((world.width - 1) * cs)} × {fmtM((world.height - 1) * cs)}
            </dd>
            <dt>Sea level</dt>
            <dd>{world.seaLevelM} m</dd>
            <dt>Seed</dt>
            <dd>{world.seed}</dd>
          </dl>
        </section>
      )}
    </aside>
  );
}
