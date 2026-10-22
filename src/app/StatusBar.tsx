import { useUi } from '../state/uiStore';

const f1 = (v: number) => v.toFixed(1);

export function StatusBar() {
  const hover = useUi((s) => s.hover);
  const stats = useUi((s) => s.stats);
  const lastSaved = useUi((s) => s.lastSavedIso);
  return (
    <footer className="statusbar">
      <div className="inspect" aria-live="off">
        {hover ? (
          <>
            <span title="Position east, north (m) and cell index">
              x {Math.round(hover.xM)} m · y {Math.round(hover.yM)} m <em>[{hover.cellX}, {hover.cellY}]</em>
            </span>
            <span title="Surface = bedrock + loose sediment">
              <b>Surface</b> {f1(hover.surfaceM)} m
            </span>
            <span>
              <b>Bedrock</b> {f1(hover.bedrockM)} m
            </span>
            <span>
              <b>Sediment</b> {hover.sedimentM.toFixed(2)} m
            </span>
            <span>
              <b>Slope</b> {f1(hover.slopeDeg)}°
            </span>
            <span>
              <b>Rock</b> {hover.materialName}
            </span>
            {hover.vegPct !== undefined && (
              <span title="Plant cover">
                <b>Plants</b> {Math.round(hover.vegPct)}%
              </span>
            )}
            {hover.iceM !== undefined && (
              <span title="Glacier ice thickness">
                <b>Ice</b> {hover.iceM < 10 ? hover.iceM.toFixed(1) : Math.round(hover.iceM)} m
              </span>
            )}
            {hover.snowSweM !== undefined && (
              <span title="Snowpack as water equivalent (fresh snow is roughly ten times deeper)">
                <b>Snow</b> {(hover.snowSweM * 1000).toFixed(0)} mm water
              </span>
            )}
            {hover.temperatureC !== undefined && (
              <span title="Climate: temperature and rainfall at this point">
                <b>Climate</b> {f1(hover.temperatureC)} °C · rain {f1(hover.rainHereMmH ?? 0)} mm/h
              </span>
            )}
            {hover.isSea ? (
              <span>
                <b>Sea</b> below sea level
              </span>
            ) : (
              <span title="Simulated surface water depth and depth-averaged speed">
                <b>Water</b> {hover.waterDepthM < 0.001 ? 'dry' : `${hover.waterDepthM < 1 ? (hover.waterDepthM * 100).toFixed(1) + ' cm' : hover.waterDepthM.toFixed(2) + ' m'} · ${hover.waterSpeedMS.toFixed(2)} m/s`}
              </span>
            )}
          </>
        ) : (
          <span className="muted">Point at the terrain to inspect it</span>
        )}
      </div>
      <div className="perf">
        {lastSaved && <span className="muted">Saved {new Date(lastSaved).toLocaleTimeString()}</span>}
        {stats && (
          <span title="Frames per second · CPU time to submit render · triangles">
            {Math.round(stats.fps)} fps · {stats.frameMs.toFixed(1)} ms · {(stats.triangles / 1000).toFixed(0)}k tris
          </span>
        )}
      </div>
    </footer>
  );
}
