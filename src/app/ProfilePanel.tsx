import { useMemo, useState } from 'react';
import { useUi } from '../state/uiStore';
import { engine } from './runtime';
import { transect, transectCsv, type TransectSample } from '../terrain/measure';
import { PLATE_COLOURS } from '../sim/tectonics/plates';

// Validated (dataviz validator, dark surface #12291f): Scouts orange / pink / blue steps.
const C_SURFACE = '#d9781c';
const C_REF = '#bf62a8';
const C_WATER = '#3a86f0';
// Layer fills (natural terrain palette, as on the map).
const F_ROCK = '#6b6560';
const F_SOIL = '#a0794f';
const F_ICE = '#cfe2ee';
const F_LAVA = '#e8551a';

const N = 160;
const W = 244;
const H = 156;
const M = { l: 44, r: 6, t: 8, b: 30 };

function niceTicks(lo: number, hi: number, n: number): number[] {
  const span = Math.max(1e-6, hi - lo);
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(v);
  return ticks;
}

const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km` : `${Math.round(m)} m`);

/** Elevation transect (spec M09 preview, used for valley/delta cross-sections). */
export function ProfilePanel() {
  const profile = useUi((s) => s.profile);
  const pending = useUi((s) => s.profileStart);
  const tick = useUi((s) => s.stats?.fps); // re-sample at the stats cadence (~2 Hz)
  const simT = useUi((s) => s.sim?.simTimeS);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const data = useMemo(
    () => (profile ? transect(engine, engine.referenceSurface, profile.ax, profile.ay, profile.bx, profile.by, N) : null),
    [profile, tick, simT],
  );

  if (!profile || !data) {
    return (
      <section className="profile-panel">
        <h3>Cross-section</h3>
        <p className="hint small">{pending ? 'Now click the end point.' : 'Click a start point on the terrain, then an end point.'}</p>
      </section>
    );
  }

  let lo = Infinity;
  let hi = -Infinity;
  for (const s of data) {
    lo = Math.min(lo, s.surfaceM, s.referenceM);
    hi = Math.max(hi, s.surfaceM, s.referenceM, s.iceTopM, s.lavaTopM, s.waterM ?? -Infinity);
  }
  const pad = Math.max(1, (hi - lo) * 0.08);
  lo -= pad;
  hi += pad;
  const len = data[data.length - 1].distM;
  const px = (d: number) => M.l + (d / Math.max(1e-6, len)) * (W - M.l - M.r);
  const py = (z: number) => M.t + (1 - (z - lo) / (hi - lo)) * (H - M.t - M.b);
  const path = (get: (s: TransectSample) => number | null) => {
    let p = '';
    let pen = false;
    for (const s of data) {
      const v = get(s);
      if (v === null) {
        pen = false;
        continue;
      }
      p += `${pen ? 'L' : 'M'}${px(s.distM).toFixed(1)},${py(Math.max(lo, v)).toFixed(1)}`;
      pen = true;
    }
    return p;
  };
  /** Closed band between two layer tops (only where the upper is above the lower). */
  const band = (top: (s: TransectSample) => number, bottom: (s: TransectSample) => number) => {
    let p = '';
    for (const s of data) p += `${p ? 'L' : 'M'}${px(s.distM).toFixed(1)},${py(Math.max(lo, top(s))).toFixed(1)}`;
    for (let k = data.length - 1; k >= 0; k--) p += `L${px(data[k].distM).toFixed(1)},${py(Math.max(lo, bottom(data[k]))).toFixed(1)}`;
    return p + 'Z';
  };
  const hasIce = data.some((s) => s.iceTopM - s.surfaceM > 0.5);
  const hasLava = data.some((s) => s.lavaTopM - s.surfaceM > 0.05);
  // Vertical exaggeration: metres per pixel across ÷ metres per pixel up.
  const ve = len / Math.max(1e-6, W - M.l - M.r) / ((hi - lo) / (H - M.t - M.b));
  const yTicks = niceTicks(lo, hi, 4);
  const xTicks = niceTicks(0, len, 3);
  const h = hover !== null ? data[hover] : null;
  // Plate strip (schematic): one coloured segment per plate crossed, arrow = motion along the line.
  const plates = engine.world.tectonics.plates;
  const ux = (profile.bx - profile.ax) / Math.max(1e-9, len);
  const uy = (profile.by - profile.ay) / Math.max(1e-9, len);
  const plateSegs: { d0: number; d1: number; colour: string; along: number; dir: number }[] = [];
  if (plates.length > 1) {
    let start = 0;
    for (let k = 1; k <= data.length; k++) {
      if (k < data.length && data[k].plate === data[start].plate) continue;
      const pl = plates[data[start].plate];
      const along = pl ? pl.vxMmYr * ux + pl.vyMmYr * uy : 0;
      plateSegs.push({
        d0: data[start].distM,
        d1: data[k - 1].distM,
        colour: `#${PLATE_COLOURS[data[start].plate % PLATE_COLOURS.length].toString(16).padStart(6, '0')}`,
        along,
        dir: along >= 0 ? 1 : -1,
      });
      start = k;
    }
  }
  const last = data[data.length - 1];

  return (
    <section className="profile-panel">
      <h3>Cross-section</h3>
      <div className="legend-row" aria-label="Series">
        <span>
          <i style={{ background: C_SURFACE }} />
          Surface now
        </span>
        <span>
          <i className="dash" style={{ borderColor: C_REF }} />
          Reference
        </span>
        <span>
          <i style={{ background: C_WATER }} />
          Water level
        </span>
        <span>
          <i style={{ background: F_SOIL }} />
          Soil / loose
        </span>
        <span>
          <i style={{ background: F_ROCK }} />
          Bedrock
        </span>
        {hasIce && (
          <span>
            <i style={{ background: F_ICE }} />
            Ice
          </span>
        )}
        {hasLava && (
          <span>
            <i style={{ background: F_LAVA }} />
            Lava
          </span>
        )}
      </div>
      <div className="chart-wrap">
        <svg
          width={W}
          height={H}
          role="img"
          aria-label={`Elevation profile over ${fmtDist(len)}`}
          onMouseMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const t = (e.clientX - r.left - M.l) / (W - M.l - M.r);
            setHover(t < 0 || t > 1 ? null : Math.round(t * (N - 1)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={M.l} x2={W - M.r} y1={py(v)} y2={py(v)} className="grid" />
              <text x={M.l - 4} y={py(v) + 3} className="tick" textAnchor="end">
                {Math.round(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={px(v)} y={H - 16} className="tick" textAnchor="middle">
              {fmtDist(v)}
            </text>
          ))}
          <path
            d={band(
              (s) => s.bedrockM,
              () => lo,
            )}
            fill={F_ROCK}
            opacity={0.55}
          />
          <path
            d={band(
              (s) => s.surfaceM,
              (s) => s.bedrockM,
            )}
            fill={F_SOIL}
            opacity={0.75}
          />
          {hasIce && (
            <path
              d={band(
                (s) => s.iceTopM,
                (s) => s.surfaceM,
              )}
              fill={F_ICE}
              opacity={0.9}
            />
          )}
          {hasLava && (
            <path
              d={band(
                (s) => s.lavaTopM,
                (s) => s.surfaceM,
              )}
              fill={F_LAVA}
              opacity={0.9}
            />
          )}
          <text x={10} y={(M.t + H - M.b) / 2} className="tick" textAnchor="middle" transform={`rotate(-90 10 ${(M.t + H - M.b) / 2})`}>
            Elevation (m)
          </text>
          <path d={path((s) => s.referenceM)} fill="none" stroke={C_REF} strokeWidth={2} strokeDasharray="4 3" strokeLinecap="round" />
          <path d={path((s) => s.waterM)} fill="none" stroke={C_WATER} strokeWidth={2} strokeLinecap="round" />
          <path d={path((s) => s.surfaceM)} fill="none" stroke={C_SURFACE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {plateSegs.map((g, k) => (
            <g key={`p${k}`}>
              <rect x={px(g.d0)} y={H - M.b - 7} width={Math.max(1, px(g.d1) - px(g.d0))} height={6} fill={g.colour} opacity={0.85} />
              {Math.abs(g.along) > 0.5 && (
                <path
                  d={`M${(px(g.d0) + px(g.d1)) / 2 - g.dir * 9},${H - M.b - 12}l${g.dir * 18},0l${-g.dir * 5},-3m${g.dir * 5},3l${-g.dir * 5},3`}
                  stroke="#f4f1ea"
                  strokeWidth={1.5}
                  fill="none"
                />
              )}
            </g>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 3} className="tick" textAnchor="middle">
            Distance along the line · heights ×{ve >= 10 ? Math.round(ve) : ve.toFixed(1)}
          </text>
          <text x={W - M.r} y={py(last.surfaceM) - 5} className="direct" textAnchor="end">
            now
          </text>
          {h && (
            <g>
              <line x1={px(h.distM)} x2={px(h.distM)} y1={M.t} y2={H - M.b} className="crosshair" />
              <circle cx={px(h.distM)} cy={py(h.surfaceM)} r={4} fill={C_SURFACE} stroke="#12291f" strokeWidth={2} />
            </g>
          )}
        </svg>
      </div>
      <div className="chart-readout" aria-live="off">
        {h ? (
          <>
            <b>{fmtDist(h.distM)}</b>
            <span>surface {h.surfaceM.toFixed(1)} m</span>
            <span>soil {(h.surfaceM - h.bedrockM).toFixed(2)} m</span>
            <span>
              change {h.surfaceM - h.referenceM >= 0 ? '+' : ''}
              {(h.surfaceM - h.referenceM).toFixed(2)} m
            </span>
            <span>{h.waterM === null ? 'dry' : `water ${(h.waterM - h.surfaceM).toFixed(2)} m deep`}</span>
            {h.iceTopM - h.surfaceM > 0.5 && <span>ice {(h.iceTopM - h.surfaceM).toFixed(0)} m</span>}
            {h.lavaTopM - h.surfaceM > 0.05 && <span>lava {(h.lavaTopM - h.surfaceM).toFixed(1)} m</span>}
          </>
        ) : (
          <span>Hover the chart to read values</span>
        )}
      </div>
      <p className="hint small tight">
        Elevation (m) along {fmtDist(len)}; heights drawn ×{ve >= 10 ? Math.round(ve) : ve.toFixed(1)} (vertical exaggeration). Reset the reference in Erosion
        to compare from a new start.
        {plateSegs.length > 1 ? ' Coloured strip: plates crossed (schematic); arrows show each plate’s motion along this line.' : ''}
      </p>
      <div className="row">
        <button className="small" onClick={() => setTable(!table)}>
          {table ? 'Hide values' : 'Show values'}
        </button>
        <button
          className="small"
          onClick={() => {
            const blob = new Blob([transectCsv(transect(engine, engine.referenceSurface, profile.ax, profile.ay, profile.bx, profile.by, N))], {
              type: 'text/csv',
            });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${engine.world.meta.name.replace(/[^\w-]+/g, '_')}-transect.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }}
        >
          Download CSV
        </button>
        <button className="small ghost" onClick={() => useUi.getState().set({ profile: null, profileStart: null })}>
          Clear
        </button>
      </div>
      {table && (
        <table className="values">
          <thead>
            <tr>
              <th>Distance</th>
              <th>Surface</th>
              <th>Soil</th>
              <th>Change</th>
              <th>Water</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((_, k) => k % 16 === 0 || k === N - 1)
              .map((s) => (
                <tr key={s.distM}>
                  <td>{fmtDist(s.distM)}</td>
                  <td>{s.surfaceM.toFixed(1)} m</td>
                  <td>{(s.surfaceM - s.bedrockM).toFixed(2)} m</td>
                  <td>{(s.surfaceM - s.referenceM).toFixed(2)} m</td>
                  <td>{s.waterM === null ? '—' : `${(s.waterM - s.surfaceM).toFixed(2)} m`}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
