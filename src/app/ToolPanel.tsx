import { useUi, DEFAULT_RATES, isBrushTool, isWaterTool } from '../state/uiStore';
import { WaterPanel } from './WaterPanel';
import { ErosionPanel } from './ErosionPanel';
import { ProfilePanel } from './ProfilePanel';
import { CoastPanel } from './CoastPanel';
import { toolById } from './tools';
import { BEDROCK_MATERIALS } from '../terrain/materials';
import { getScene } from './runtime';
import { Icon } from './icons';

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
  const measure = t.id === 'profile';
  const events = t.id === 'landslide';
  const coastTool = t.id === 'coast';

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
            <LogSlider label={t.rateLabel} unit="" value={s.rates[s.tool as keyof typeof DEFAULT_RATES]} min={t.rateMin!} max={t.rateMax!} onChange={(v) => s.setRate(s.tool as keyof typeof DEFAULT_RATES, v)} />
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
                  <button key={m.id} className={`swatch ${s.paintMaterialId === m.id ? 'active' : ''}`} onClick={() => s.set({ paintMaterialId: m.id })} title={`${m.name} — relative erodibility ${m.erodibility} (used from erosion milestone)`}>
                    <i style={{ background: `#${m.colour.toString(16).padStart(6, '0')}` }} />
                    {m.name}
                  </button>
                ))}
              </div>
              <p className="hint small">Tip: use “Strip soil” to expose painted rock under thick sediment.</p>
            </div>
          )}
          {s.tool === 'flatten' && <p className="hint small">Target elevation is sampled where each stroke starts.</p>}
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
          <p className="hint small">Saturation lowers the stable angle of debris to half its dry value and weakens rock in the zone. Where nothing is steep enough, nothing moves.</p>
          <button className="small" onClick={() => s.set({ dialog: 'slump' })}>
            Open rotational slump lab (cross-section)
          </button>
          <p className="hint small">The map shows generalised mass movement; curved-slip rotational slumping is shown in its own guided cross-section model.</p>
        </>
      )}
      {coastTool && <CoastPanel />}
      {(measure || s.profile) && <ProfilePanel />}
      {(water || (!brush && !measure && !events && !coastTool)) && <WaterPanel />}
      {(water || (!brush && !measure && !coastTool)) && <ErosionPanel />}

      {!brush && !water && !measure && !events && !coastTool && (
        <div className="cam-buttons">
          <button onClick={() => getScene()?.fitWorld()}>
            <Icon name="fit" /> Fit world <kbd>F</kbd>
          </button>
          <button onClick={() => getScene()?.topDown()}>
            <Icon name="top" /> Top-down <kbd>T</kbd>
          </button>
          <button onClick={() => getScene()?.oblique()}>
            <Icon name="oblique" /> Oblique <kbd>O</kbd>
          </button>
          <p className="hint small">Arrow keys / WASD pan. Trackpad: two-finger scroll zooms, pinch zooms, click-drag orbits.</p>
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
