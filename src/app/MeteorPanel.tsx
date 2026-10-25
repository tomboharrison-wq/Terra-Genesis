import { useUi } from '../state/uiStore';
import { craterSize } from '../sim/events/meteor';

export const IMPACTORS = [
  { id: 'stony', label: 'Stony asteroid', density: 3000 },
  { id: 'iron', label: 'Iron asteroid', density: 7800 },
  { id: 'comet', label: 'Comet (ice)', density: 1000 },
] as const;

const fmtLen = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 2)} km` : `${Math.round(m)} m`);
const fmtEnergy = (mt: number) => (mt >= 1 ? `${mt.toPrecision(3)} megatonnes of TNT` : `${(mt * 1000).toPrecision(3)} kilotonnes of TNT`);

/** Meteor impact settings and the crater the pi-scaling laws predict (spec E12). */
export function MeteorPanel() {
  const m = useUi((s) => s.meteor);
  const world = useUi((s) => s.world);
  const set = useUi((s) => s.set);
  const upd = (p: Partial<typeof m>) => set({ meteor: { ...m, ...p } });
  const density = IMPACTORS.find((k) => k.id === m.kind)!.density;
  const c = craterSize({ diameterM: m.diameterM, speedMS: m.speedKmS * 1000, densityKgM3: density, angleDeg: m.angleDeg });
  const mapM = world ? Math.max(world.width, world.height) * world.cellSizeM : 0;
  const posLog = (v: number) => Math.round(Math.log10(v) * 100);
  return (
    <section className="meteor-panel">
      <label className="field">
        <span className="field-label">Impactor</span>
        <select value={m.kind} onChange={(e) => upd({ kind: e.target.value as typeof m.kind })}>
          {IMPACTORS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} ({k.density.toLocaleString()} kg/m³)
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">
          Diameter <b>{fmtLen(m.diameterM)}</b>
        </span>
        <input type="range" min={0} max={270} value={posLog(m.diameterM)} onChange={(e) => upd({ diameterM: Math.round(10 ** (+e.target.value / 100)) })} />
      </label>
      <label className="field">
        <span className="field-label">
          Speed <b>{m.speedKmS} km/s</b>
        </span>
        <input type="range" min={11} max={72} value={m.speedKmS} onChange={(e) => upd({ speedKmS: +e.target.value })} />
      </label>
      <label className="field">
        <span className="field-label">
          Angle from horizontal <b>{m.angleDeg}°</b>
        </span>
        <input type="range" min={15} max={90} step={5} value={m.angleDeg} onChange={(e) => upd({ angleDeg: +e.target.value })} />
      </label>
      <dl className="budget">
        <dt>Energy</dt>
        <dd>{fmtEnergy(c.megatons)}</dd>
        <dt>Crater</dt>
        <dd>
          {fmtLen(c.diameterM)} wide, {fmtLen(c.depthM)} deep
        </dd>
        <dt>Type</dt>
        <dd>{c.complex ? 'complex (flat floor)' : 'simple bowl'}</dd>
      </dl>
      {c.diameterM > 0.8 * mapM && (
        <p className="hint small tight warn">This crater is about as wide as the whole map: most ejecta will land beyond its edge.</p>
      )}
      {c.diameterM < 3 * (world?.cellSizeM ?? 10) && (
        <p className="hint small tight">Smaller than three map cells: the crater will be hard to see at this map scale.</p>
      )}
      <p className="hint small tight">
        Click the map to drop it. Crater size from the pi-scaling laws (Collins, Melosh &amp; Marcus 2005); the dug-out rock is thrown out as an ejecta blanket
        that thins with distance and builds the rim. Simplified: no central peak in large craters, no melt, and no break-up in the air (small stony bodies
        really explode high up). Undo (Ctrl+Z) removes it.
      </p>
    </section>
  );
}
