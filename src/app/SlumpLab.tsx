import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { useUi } from "../state/uiStore";
import {
  analyse,
  blockPolygon,
  ground,
  slumpGeometry,
  SOIL_PRESETS,
  toeX,
  type Pt,
} from "../local/slump/model";
import { Icon } from "./icons";
import { CoastalSlump } from "./CoastalSlump";

const W = 660;
const H = 320;

/**
 * Rotational slump lab — a guided local model (spec E4/G3), clearly separate from the global
 * heightfield physics. Everything drawn comes from src/local/slump/model.ts.
 */
export function SlumpLab() {
  const close = () => useUi.getState().set({ dialog: null });
  const [soil, setSoil] = useState<keyof typeof SOIL_PRESETS>("clay");
  const [heightM, setHeight] = useState(18);
  const [faceDeg, setFace] = useState(35);
  const [saturation, setSat] = useState(0);
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const [mode, setMode] = useState<"single" | "coastal">("single");

  const params = useMemo(
    () => ({ ...SOIL_PRESETS[soil], heightM, faceDeg, saturation }),
    [soil, heightM, faceDeg, saturation],
  );
  const res = useMemo(() => analyse(params), [params]);
  const c = res.critical;
  const theta = res.failed ? res.thetaFinal * progress : 0;
  const geo = useMemo(
    () => (c && res.failed ? slumpGeometry(params, c, theta) : null),
    [params, c, res.failed, theta],
  );

  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / 2500);
      setProgress(t);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    setProgress(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  // View box in metres.
  const xt = toeX(params);
  const x0 = -1.6 * heightM;
  const x1 = xt + 1.4 * heightM;
  const z0 = -0.25 * heightM;
  const z1 = 1.35 * heightM;
  const sx = W / (x1 - x0);
  const sz = H / (z1 - z0);
  const s = Math.min(sx, sz);
  const X = (x: number) => (x - x0) * s;
  const Z = (z: number) => H - (z - z0) * s;
  const poly = (pts: Pt[]) =>
    pts.map((p) => `${X(p.x).toFixed(1)},${Z(p.z).toFixed(1)}`).join(" ");

  const groundPoly: Pt[] = [
    { x: x0, z: z0 },
    { x: x0, z: heightM },
    { x: 0, z: heightM },
    { x: xt, z: 0 },
    { x: x1, z: 0 },
    { x: x1, z: z0 },
  ];
  const block = c ? blockPolygon(params, c) : [];
  // Strata lines inside the original block (rotate with it to reveal the back-tilt).
  const strata: number[] = [];
  for (let z = heightM * 0.2; z < heightM; z += heightM * 0.2) strata.push(z);
  const waterZ = heightM * (0.15 + 0.8 * saturation);
  const rotDeg = (-theta * 180) / Math.PI; // SVG y-down → negate for CCW in world
  const fosColour = res.fos < 1 ? "var(--scouts-red)" : "var(--scouts-green)";

  return (
    <Dialog title="Rotational slump lab (guided model)" onClose={close} wide>
      <div className="seg slump-mode">
        <button
          className={mode === "single" ? "active" : ""}
          onClick={() => setMode("single")}
        >
          Single slump
        </button>
        <button
          className={mode === "coastal" ? "active" : ""}
          onClick={() => setMode("coastal")}
        >
          Coastal cycle (waves remove the toe)
        </button>
      </div>
      {mode === "coastal" ? (
        <CoastalSlump />
      ) : (
        <>
          <div className="slump-controls">
            <label className="field">
              <span className="field-label">Material</span>
              <select
                value={soil}
                onChange={(e) =>
                  setSoil(e.target.value as keyof typeof SOIL_PRESETS)
                }
              >
                {Object.entries(SOIL_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                Cliff height <b>{heightM} m</b>
              </span>
              <input
                type="range"
                min={8}
                max={40}
                value={heightM}
                onChange={(e) => setHeight(+e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">
                Face angle <b>{faceDeg}°</b>
              </span>
              <input
                type="range"
                min={20}
                max={70}
                value={faceDeg}
                onChange={(e) => setFace(+e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">
                Saturation <b>{Math.round(saturation * 100)}%</b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(saturation * 100)}
                onChange={(e) => setSat(+e.target.value / 100)}
              />
            </label>
          </div>
          <div className="slump-readout">
            <span>
              Factor of safety{" "}
              <b style={{ color: fosColour }}>
                {Number.isFinite(res.fos) ? res.fos.toFixed(2) : "—"}
              </b>
            </span>
            <span>
              {res.failed
                ? "Below 1: the slope fails along the curved slip plane."
                : "Above 1: resisting forces exceed driving forces — the cliff stands."}
            </span>
            {geo && (
              <span>
                Crown drop {geo.crownDrop.toFixed(1)} m · back-tilt{" "}
                {geo.tiltDeg.toFixed(0)}° · toe lobe {geo.areaLobe.toFixed(0)}{" "}
                m² per metre of cliff
              </span>
            )}
          </div>
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            className="slump-svg"
            role="img"
            aria-label="Cliff cross-section"
          >
            <defs>
              <clipPath id="slumpClipLeft">
                <rect x={0} y={0} width={c ? X(c.xOut) : W} height={H} />
              </clipPath>
            </defs>
            <rect x={0} y={0} width={W} height={H} fill="#cfe0ec" />
            {/* Sea / ground in front */}
            <rect
              x={X(xt + 0.25 * heightM)}
              y={Z(0) - 1}
              width={W}
              height={H}
              fill="#3d84b8"
              opacity={0.55}
            />
            {/* Intact ground */}
            <polygon points={poly(groundPoly)} fill="#9a7a5c" />
            {strata.map((z) => (
              <line
                key={`g${z}`}
                x1={X(x0)}
                x2={X(Math.min(xt, (1 - z / heightM) * xt))}
                y1={Z(z)}
                y2={Z(z)}
                stroke="#6d533d"
                strokeWidth={1.2}
              />
            ))}
            {/* Water table (piezometric line) */}
            <line
              x1={X(x0)}
              x2={X(Math.max(0, (1 - waterZ / heightM) * xt))}
              y1={Z(waterZ)}
              y2={Z(waterZ)}
              stroke="#1f6fd1"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            {c && res.failed && (
              <>
                {/* Cavity left by the block (scarp + slip surface exposed) */}
                <polygon points={poly(block)} fill="#cfe0ec" />
                {/* Rigid block, rotated about the circle centre, clipped at the exit point */}
                <g clipPath="url(#slumpClipLeft)">
                  <g transform={`rotate(${rotDeg} ${X(c.xc)} ${Z(c.zc)})`}>
                    <polygon
                      points={poly(block)}
                      fill="#a8865f"
                      stroke="#5a4330"
                      strokeWidth={1.5}
                    />
                    <clipPath id="slumpBlockClip">
                      <polygon points={poly(block)} />
                    </clipPath>
                    <g clipPath="url(#slumpBlockClip)">
                      {strata.map((z) => (
                        <line
                          key={`b${z}`}
                          x1={0}
                          x2={W}
                          y1={Z(z)}
                          y2={Z(z)}
                          stroke="#6d533d"
                          strokeWidth={1.2}
                        />
                      ))}
                    </g>
                  </g>
                </g>
                {geo && geo.lobe.length > 0 && (
                  <polygon
                    points={poly(geo.lobe)}
                    fill="#b48f66"
                    stroke="#5a4330"
                    strokeWidth={1}
                  />
                )}
                {/* Slip circle */}
                <path
                  d={`M${X(c.xIn)},${Z(ground(params, c.xIn))} A${c.r * s},${c.r * s} 0 0 0 ${X(c.xOut)},${Z(ground(params, c.xOut))}`}
                  fill="none"
                  stroke="var(--scouts-red)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                {geo && (
                  <polyline
                    points={poly(geo.scarp)}
                    fill="none"
                    stroke="#3b2a1c"
                    strokeWidth={3}
                  />
                )}
                <circle
                  cx={X(c.xc)}
                  cy={Z(c.zc)}
                  r={3}
                  fill="var(--scouts-red)"
                />
                {/* Labels */}
                <text
                  className="slump-label"
                  x={X(c.xIn) - 6}
                  y={Z(heightM) - 10}
                  textAnchor="end"
                >
                  Back scarp
                </text>
                <text
                  className="slump-label"
                  x={X((c.xIn + Math.min(0, c.xOut)) / 2)}
                  y={Z(heightM * 0.55)}
                  textAnchor="middle"
                >
                  Rotated block (tilts back)
                </text>
                <text
                  className="slump-label red"
                  x={X((c.xIn + c.xOut) / 2) + 10}
                  y={Z(Math.max(z0 + 2, heightM * 0.15))}
                >
                  Curved slip plane
                </text>
                {geo && geo.lobe.length > 0 && (
                  <text className="slump-label" x={X(c.xOut) + 8} y={Z(0) - 8}>
                    Toe
                  </text>
                )}
              </>
            )}
            {(!c || !res.failed) && c && (
              <path
                d={`M${X(c.xIn)},${Z(ground(params, c.xIn))} A${c.r * s},${c.r * s} 0 0 0 ${X(c.xOut)},${Z(ground(params, c.xOut))}`}
                fill="none"
                stroke="#5a4330"
                strokeWidth={1.5}
                strokeDasharray="3 5"
                opacity={0.6}
              />
            )}
            <text className="slump-label blue" x={X(x0) + 8} y={Z(waterZ) - 6}>
              Water table
            </text>
          </svg>
          <div className="dialog-foot">
            <div className="row">
              <button
                className="primary"
                disabled={!res.failed || playing}
                onClick={() => setPlaying(true)}
              >
                <Icon name="play" size={16} /> Play slump
              </button>
              <label className="field inline">
                <span className="field-label">Movement</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(progress * 100)}
                  disabled={!res.failed}
                  onChange={(e) => setProgress(+e.target.value / 100)}
                />
              </label>
            </div>
            <span className="muted small">
              Guided model: limit-equilibrium (method of slices) over a searched
              slip circle, rigid rotation, toe lobe of equal area. Not a design
              tool.
            </span>
          </div>
        </>
      )}
    </Dialog>
  );
}
