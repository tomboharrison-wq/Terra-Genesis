import { craterSize } from '../sim/events/meteor';
import { IMPACTORS } from './MeteorPanel';
import { useEffect, useRef } from 'react';
import { TerrainScene } from '../renderer/TerrainScene';
import { overlayById } from '../renderer/overlays';
import { attachScene, engine, getScene, runVolcanoBuild, syncSim } from './runtime';
import { MAX_PINS, useUi, isBrushTool, type HoverInfo } from '../state/uiStore';
import type { BrushParams } from '../tools/brush';
import { slopeAt } from '../terrain/heightfield';
import { materialById } from '../terrain/materials';
import { MM_PER_H } from '../engine/world';

function currentBrush(): BrushParams | null {
  const s = useUi.getState();
  if (!isBrushTool(s.tool)) return null;
  return { kind: s.tool, radiusM: s.radiusM, rate: s.rates[s.tool], hardness: s.hardness, materialId: s.paintMaterialId };
}

/** Radius of the cursor ring for the active tool, or null if no ring. */
function ringRadius(): number | null {
  const s = useUi.getState();
  if (isBrushTool(s.tool) || s.tool === 'water-add' || s.tool === 'water-drain' || s.tool === 'landslide') return s.radiusM;
  if (s.tool === 'meteor') {
    const m = s.meteor;
    const c = craterSize({
      diameterM: m.diameterM,
      speedMS: m.speedKmS * 1000,
      densityKgM3: IMPACTORS.find((k) => k.id === m.kind)!.density,
      angleDeg: m.angleDeg,
    });
    return Math.max(c.diameterM / 2, (s.world?.cellSizeM ?? 10) * 2);
  }
  if (s.tool === 'spring' || s.tool === 'profile' || s.tool === 'measure' || s.tool === 'earthquake' || s.tool === 'volcano')
    return (s.world?.cellSizeM ?? 10) * 2;
  return null;
}

/** The active map overlay's own reading at cell i (real value + unit), if any. */
function overlayAt(i: number): { overlay?: { label: string; text: string } } {
  const def = overlayById(useUi.getState().terrainOverlay);
  if (!def) return {};
  const text = def.describe(engine, i, getScene()?.currentOverlayData ?? { zMin: 0, zMax: 0 });
  return text === null ? {} : { overlay: { label: def.label, text } };
}

function hoverFrom(xM: number, yM: number): HoverInfo {
  const w = engine.world;
  const cx = Math.min(w.width - 1, Math.max(0, Math.round(xM / w.cellSizeM)));
  const cy = Math.min(w.height - 1, Math.max(0, Math.round(yM / w.cellSizeM)));
  const i = cy * w.width + cx;
  return {
    xM,
    yM,
    cellX: cx,
    cellY: cy,
    surfaceM: engine.surface[i],
    bedrockM: w.bedrockElevationM[i],
    sedimentM: w.looseSedimentThicknessM[i],
    slopeDeg: (Math.atan(slopeAt(engine.heightfield, cx, cy)) * 180) / Math.PI,
    materialName: materialById(w.materialId[i]).name,
    waterDepthM: w.waterDepthM[i],
    waterSpeedMS: Math.hypot(engine.water.vx[i], engine.water.vy[i]),
    ...(w.snowSweM[i] > 0 ? { snowSweM: w.snowSweM[i] } : {}),
    ...(w.iceThicknessM[i] > 0 ? { iceM: w.iceThicknessM[i] } : {}),
    ...(w.lavaDepthM[i] > 0 ? { lavaM: w.lavaDepthM[i], lavaC: w.lavaTempC[i] } : {}),
    ...(w.tephraM[i] > 0.001 ? { ashM: Math.min(w.tephraM[i], w.looseSedimentThicknessM[i]) } : {}),
    ...(w.vegCover[i] > 0.005 ? { vegPct: 100 * w.vegCover[i] } : {}),
    ...(w.climate.enabled ? { temperatureC: engine.climate.temperatureC[i], rainHereMmH: (w.water.rainMPerS / MM_PER_H) * engine.climate.rainFactor[i] } : {}),
    isSea: engine.water.sea[i] === 1,
    ...overlayAt(i),
  };
}

/**
 * Mounts the TerrainScene and routes pointer input: brush strokes are intercepted in the
 * capture phase (before OrbitControls) so camera and brush never fight over one drag.
 */
export function Viewport() {
  const ref = useRef<HTMLDivElement>(null);
  const quality = useUi((s) => s.quality);
  const tool = useUi((s) => s.tool);

  useEffect(() => {
    const el = ref.current!;
    let scene: TerrainScene;
    try {
      scene = new TerrainScene(el, engine, quality);
    } catch (err) {
      useUi.getState().toast(`WebGL unavailable: ${(err as Error).message}`, 'error');
      return;
    }
    attachScene(scene);
    syncSim(); // backend (GPU/CPU) is known once the renderer exists

    let client: { x: number; y: number } | null = null;
    let brushing = false;
    let watering = false;
    let spaceHeld = false;
    let hoverTimer = 0;

    const toolAllowed = (e?: { altKey: boolean }) => !spaceHeld && !(e?.altKey ?? false) && ringRadius() !== null;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !toolAllowed(e)) return;
      const hit = scene.pick(e.clientX, e.clientY);
      if (!hit) return;
      e.stopPropagation();
      e.preventDefault();
      const ui = useUi.getState();
      if (ui.tool === 'volcano') {
        const v = ui.volcano;
        if (v.mode === 'caldera') {
          const r = engine.caldera({ xM: hit.xM, yM: hit.yM, radiusM: v.calderaRadiusM, depthM: v.calderaDepthM });
          syncSim();
          ui.toast(
            `Caldera: ${r.volumeM3 >= 1e6 ? `${(r.volumeM3 / 1e6).toFixed(1)} million` : Math.round(r.volumeM3).toLocaleString()} m³ of rock dropped ${v.calderaDepthM} m. Rain will fill it. Ctrl+Z undoes it.`,
            'success',
          );
          return;
        }
        if (v.mode !== 'eruption') {
          if (!ui.volcanoBuild) runVolcanoBuild(hit.xM, hit.yM, v.mode, v.episodes);
          return;
        }
        const vent = engine.addVent(hit.xM, hit.yM, v.rateM3PerS, v.kind, v.hours * 3600, v.style);
        syncSim();
        ui.toast(
          `Vent ${vent.id}: ${v.style === 'lava' ? '' : v.style + ' '}${v.kind} eruption, ${v.rateM3PerS} m³/s for ${v.hours} h${engine.clock.playing ? '' : ' — press Play to run time'}`,
          'success',
        );
        return;
      }
      if (ui.tool === 'earthquake') {
        const q = ui.quake;
        const r = engine.earthquake({ xM: hit.xM, yM: hit.yM, mw: q.mw, type: q.type, strikeDeg: q.strikeDeg, landslides: q.landslides });
        ui.set({
          lastQuake: {
            mw: q.mw,
            type: q.type,
            ruptureKm: r.ruptureKm,
            avgSlipM: r.avgSlipM,
            maxUpM: r.maxUpM,
            maxDownM: r.maxDownM,
            lateralCells: r.lateralCells,
            landslides: r.landslides,
          },
        });
        if (q.shake) getScene()?.shake(q.mw);
        const move =
          q.type === 'strike-slip'
            ? r.lateralCells
              ? `ground shifted ${r.lateralCells} cell${r.lateralCells > 1 ? 's' : ''} sideways`
              : 'sideways slip smaller than one map cell'
            : `up to ${r.maxUpM.toFixed(2)} m raised, ${r.maxDownM.toFixed(2)} m dropped`;
        ui.toast(
          `M${q.mw.toFixed(1)} earthquake: ${r.ruptureKm.toFixed(1)} km rupture, ${move}${r.landslides ? `, ${r.landslides} landslide${r.landslides > 1 ? 's' : ''}` : ''}`,
          'success',
        );
        return;
      }
      if (ui.tool === 'meteor') {
        const m = ui.meteor;
        const density = IMPACTORS.find((k) => k.id === m.kind)!.density;
        const r = engine.impact({ xM: hit.xM, yM: hit.yM, diameterM: m.diameterM, speedMS: m.speedKmS * 1000, densityKgM3: density, angleDeg: m.angleDeg });
        getScene()?.shake(Math.min(9, 5 + 0.67 * Math.log10(Math.max(1e-3, r.megatons))));
        ui.toast(
          `Impact: crater ${Math.round(r.diameterM)} m across and ${Math.round(r.depthM)} m deep; ${Math.round(r.excavatedM3).toLocaleString()} m³ thrown out${
            r.ejectaOffMapM3 > 0.05 * r.excavatedM3 ? ` (${Math.round((100 * r.ejectaOffMapM3) / r.excavatedM3)}% beyond the map edge)` : ''
          }`,
          'success',
        );
        return;
      }
      if (ui.tool === 'landslide') {
        const r = engine.landslide(hit.xM, hit.yM, ui.radiusM);
        const total = r.failedRockM3 + r.movedM3;
        ui.toast(
          total > 1
            ? `Landslide: ${Math.round(r.movedM3).toLocaleString()} m³ displaced downslope; ${Math.round(r.failedRockM3).toLocaleString()} m³ of rock broke up`
            : 'Slope is stable here even when saturated',
          total > 1 ? 'success' : 'info',
        );
        return;
      }
      if (ui.tool === 'measure') {
        if (ui.pins.length >= MAX_PINS) {
          ui.toast(`Up to ${MAX_PINS} pins: remove one first`, 'info');
          return;
        }
        const used = new Set(ui.pins.map((p) => p.label));
        const label = 'ABCDEFGH'.split('').find((l) => !used.has(l))!;
        // Snap to the cell centre: every value shown for the pin then refers to that one map cell.
        const cs = engine.world.cellSizeM;
        ui.set({ pins: [...ui.pins, { label, xM: Math.round(hit.xM / cs) * cs, yM: Math.round(hit.yM / cs) * cs }] });
        return;
      }
      if (ui.tool === 'profile') {
        if (!ui.profileStart || ui.profile) {
          ui.set({ profileStart: { x: hit.xM, y: hit.yM }, profile: null });
        } else {
          ui.set({ profile: { ax: ui.profileStart.x, ay: ui.profileStart.y, bx: hit.xM, by: hit.yM }, profileStart: null });
        }
        return;
      }
      if (ui.tool === 'spring') {
        const src = engine.addSource(hit.xM, hit.yM, ui.springRate);
        ui.toast(`Spring #${src.id} placed: ${ui.springRate.toFixed(1)} m³/s`, 'success');
        return;
      }
      el.setPointerCapture(e.pointerId);
      client = { x: e.clientX, y: e.clientY };
      const p = currentBrush();
      if (p) {
        brushing = true;
        engine.beginStroke(p, hit.xM, hit.yM, labelFor(p));
      } else {
        watering = true;
      }
    };
    const onMove = (e: PointerEvent) => {
      client = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!brushing && !watering) return;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (brushing) engine.endStroke();
      brushing = watering = false;
    };
    const onLeave = () => {
      if (!brushing && !watering) {
        client = null;
        scene.setBrush(false);
        useUi.getState().set({ hover: null });
      }
    };

    scene.onFrame = (dt) => {
      const r = ringRadius();
      const hit = client ? scene.pick(client.x, client.y) : null;
      if (brushing && hit) engine.strokeStep(hit.xM, hit.yM, dt);
      if (watering && hit) {
        const ui = useUi.getState();
        const sign = ui.tool === 'water-drain' ? -1 : 1;
        engine.addWater(hit.xM, hit.yM, ui.radiusM, sign * ui.waterRate * dt);
      }
      scene.setBrush(!!(hit && r !== null && !spaceHeld), hit?.xM, hit?.yM, r ?? undefined);
      hoverTimer += dt;
      if (hoverTimer > 0.1) {
        hoverTimer = 0;
        useUi.getState().set({ hover: hit ? hoverFrom(hit.xM, hit.yM) : null });
      }
    };
    scene.onStats = (s) => useUi.getState().set({ stats: s });
    let simUiTimer = 0;
    scene.onSim = () => {
      const now = performance.now();
      if (now - simUiTimer > 250) {
        simUiTimer = now;
        syncSim();
      }
    };
    scene.setWaterView(useUi.getState().waterView);
    scene.setTerrainOverlay(useUi.getState().terrainOverlay);
    scene.setPins(useUi.getState().pins);
    const unsubView = useUi.subscribe((st, prev) => {
      if (st.waterView !== prev.waterView) scene.setWaterView(st.waterView);
      if (st.terrainOverlay !== prev.terrainOverlay) scene.setTerrainOverlay(st.terrainOverlay);
      if (st.pins !== prev.pins) scene.setPins(st.pins);
      if (st.profile !== prev.profile || st.profileStart !== prev.profileStart) {
        const p = st.profile;
        const a = st.profileStart;
        scene.setProfileLine(p ? [p.ax, p.ay, p.bx, p.by] : a ? [a.x, a.y, a.x, a.y] : null);
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e)) {
        spaceHeld = e.type === 'keydown';
        el.classList.toggle('nav-override', spaceHeld);
        if (spaceHeld) e.preventDefault();
      }
    };

    el.addEventListener('pointerdown', onDown, { capture: true });
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true });
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      if (brushing) engine.endStroke();
      unsubView();
      attachScene(null);
      scene.dispose();
    };
  }, [quality]);

  return <div ref={ref} className={`viewport ${tool === 'navigate' ? 'tool-nav' : 'tool-brush'}`} data-testid="viewport" />;
}

function labelFor(p: BrushParams): string {
  return p.kind === 'paint' ? `Paint ${materialById(p.materialId ?? 0).name}` : p.kind.replace('-', ' ');
}

export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
