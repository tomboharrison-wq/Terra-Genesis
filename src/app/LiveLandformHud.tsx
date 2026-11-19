import { useEffect, useMemo, useState } from 'react';
import { useUi } from '../state/uiStore';
import { engine, getScene, syncSim } from './runtime';
import { detectLiveLandforms, type LiveLandformItem } from '../education/liveDetector';

/**
 * M20-C02: Live On-Map GCSE Landform & Process HUD.
 * Runs in the main simulator viewport (both Water Time and Geological Time),
 * continuously detecting emerging GCSE landforms on the 3D terrain, pinning
 * measured 3D labels to their world coordinates, and offering one-click camera focus
 * + live 3D voxel waterfall / headland attachment.
 */
export function LiveLandformHud() {
  const ed = useUi((s) => s.education);
  const dialog = useUi((s) => s.dialog);
  const sim = useUi((s) => s.sim);
  const geoYears = useUi((s) => s.geo.years);
  const geoMode = useUi((s) => s.geo.mode);
  const worldMeta = useUi((s) => s.world);
  const mapLabelsVisible = useUi((s) => s.mapLabelsVisible);
  const set = useUi((s) => s.set);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [bump, setBump] = useState(0);

  // Re-detect live landforms at ~1 Hz while playing or whenever world / time changes
  const simBucket = Math.floor((sim?.simTimeS ?? 0) / 120);
  const items = useMemo(() => {
    void simBucket;
    void geoYears;
    void worldMeta?.name;
    void bump;
    return detectLiveLandforms(engine);
  }, [simBucket, geoYears, worldMeta?.name, bump]);

  // Keep 3D on-map labels synced with live detected landforms whenever outside a scripted lesson
  useEffect(() => {
    if (ed) return;
    if (!mapLabelsVisible) return;
    set({
      lessonLabels: items.map((it) => ({
        text: it.text,
        xM: it.xM,
        yM: it.yM,
      })),
    });
  }, [items, ed, mapLabelsVisible, set]);

  // Do not show the sandbox HUD while inside a full-screen scripted lesson or Landform Show dialog
  if (ed || dialog === 'landforms') return null;

  const selected = items.find((x) => x.id === selectedId) ?? null;
  const isDedicatedSolid = !!(engine.world.meta.solidHeadland || engine.world.meta.solidWaterfall);
  const hasCoast = engine.world.bedrockElevationM.some((b, i) => b + engine.world.looseSedimentThicknessM[i] < engine.world.seaLevelM);

  const focusItem = (it: LiveLandformItem) => {
    setSelectedId((prev) => (prev === it.id ? null : it.id));
    if (!mapLabelsVisible) set({ mapLabelsVisible: true });
    getScene()?.focusPoint(it.xM, it.yM, it.distanceM);
  };

  const spawnOrFocus3DWaterfall = () => {
    const p = engine.enableEmbeddedWaterfall();
    if (!p) {
      useUi.getState().toast('No trunk river channel found on this world for a 3D waterfall', 'info');
      return;
    }
    if (!engine.world.erosion.enabled) engine.setErosionParams({ enabled: true, speedup: Math.max(20, engine.world.erosion.speedup) });
    syncSim();
    setBump((b) => b + 1);
    set({ mapLabelsVisible: true });
    getScene()?.focusPoint(p.xM, p.yM, Math.max(115, 78 * p.scaleM));
    setSelectedId('waterfall-3d');
    useUi.getState().toast('Coupled 3D Waterfall, Overhang & Plunge Pool embedded on river — press Play or Time-lapse!', 'success');
  };

  const spawnOrFocus3DHeadland = () => {
    const p = engine.enableEmbeddedHeadland();
    if (!p) {
      useUi.getState().toast('No coastline found on this world for a 3D headland', 'info');
      return;
    }
    engine.world.coast.wavesOn = true;
    syncSim();
    setBump((b) => b + 1);
    set({ mapLabelsVisible: true });
    getScene()?.focusPoint(p.xM, p.yM, Math.max(105, 72 * p.scaleM));
    setSelectedId('headland-3d');
    useUi.getState().toast('Coupled 3D Headland (Cave → Arch → Stack → Stump) embedded on coast — press Play or Geological Time!', 'success');
  };

  const spawnOrFocusMeanders = () => {
    const ok = engine.enableLowlandMeander();
    if (!ok) {
      useUi.getState().toast('No lowland floodplain river found on this world', 'info');
      return;
    }
    syncSim();
    setBump((b) => b + 1);
    set({ mapLabelsVisible: true });
    const m = engine.geoMeander!;
    const mid = Math.floor(m.xs.length * 0.5);
    getScene()?.focusPoint(m.xs[mid], m.ys[mid], Math.max(480, engine.world.cellSizeM * 20));
    setSelectedId('meander-belt');
    useUi.getState().toast('Lowland meandering river & tidal estuary activated!', 'success');
  };

  return (
    <div
      className="live-landform-hud"
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 104,
        zIndex: 4,
        maxWidth: 'calc(100vw - 440px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {selected && (
        <div
          style={{
            pointerEvents: 'auto',
            background: 'var(--panel-solid)',
            border: '1px solid var(--scouts-yellow)',
            borderRadius: 10,
            padding: '8px 12px',
            maxWidth: 680,
            boxShadow: '0 8px 26px rgba(0,0,0,0.48)',
            fontSize: 12.5,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 3 }}>
            <b style={{ color: 'var(--scouts-yellow)' }}>{selected.text}</b>
            <button className="small ghost" onClick={() => setSelectedId(null)} style={{ padding: '1px 6px' }}>
              ×
            </button>
          </div>
          <div style={{ color: 'var(--text)', lineHeight: 1.4 }}>
            <b style={{ color: '#5ce080' }}>Live GCSE Process:</b> {selected.process}
          </div>
        </div>
      )}

      <div
        style={{
          pointerEvents: 'auto',
          background: 'var(--panel)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--panel-border)',
          borderRadius: 10,
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <button
          className={mapLabelsVisible ? 'active-toggle small' : 'small'}
          onClick={() => set({ mapLabelsVisible: !mapLabelsVisible })}
          title="Show or hide live measured GCSE landform labels pinned to the 3D terrain"
        >
          🏷 3D Labels {mapLabelsVisible ? 'ON' : 'OFF'} ({items.length})
        </button>

        <button
          className="small ghost"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Show live landform chips' : 'Minimize landform chips'}
        >
          {collapsed ? '▲ Show Landforms' : '▼'}
        </button>

        {!collapsed && (
          <>
            {!isDedicatedSolid && !engine.world.meta.embeddedWaterfall && (
              <button
                className="small"
                style={{ borderColor: 'var(--scouts-blue)', color: '#9fd0ea' }}
                onClick={spawnOrFocus3DWaterfall}
                title="Embed a coupled 3D voxel waterfall (overhang, plunge pool, caprock collapse & falling water jet) on this world's main river"
              >
                + 3D Waterfall
              </button>
            )}
            {!isDedicatedSolid && hasCoast && !engine.world.meta.embeddedHeadland && (
              <button
                className="small"
                style={{ borderColor: 'var(--scouts-orange)', color: '#ffd1a3' }}
                onClick={spawnOrFocus3DHeadland}
                title="Embed a coupled 3D voxel coastal headland (cave → arch → stack → stump) on this world's coastline"
              >
                + 3D Cave/Arch/Stack
              </button>
            )}
            {!isDedicatedSolid && !engine.geoMeander && geoMode && (
              <button
                className="small"
                style={{ borderColor: 'var(--scouts-green)', color: '#9ef0b6' }}
                onClick={spawnOrFocusMeanders}
                title="Activate lateral meander migration, oxbow cut-offs, levees, and tidal estuary on this world"
              >
                + Meanders &amp; Estuary
              </button>
            )}

            {items.map((it) => (
              <button
                key={it.id}
                className={selectedId === it.id ? 'active-toggle small' : 'small'}
                onClick={() => focusItem(it)}
                title={`${it.text} — Click to fly 3D camera here and inspect the GCSE process`}
              >
                {it.badge}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
