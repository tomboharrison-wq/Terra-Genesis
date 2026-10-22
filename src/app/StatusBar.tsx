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
