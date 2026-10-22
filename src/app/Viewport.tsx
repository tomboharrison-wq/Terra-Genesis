import { useEffect, useRef } from 'react';
import { TerrainScene } from '../renderer/TerrainScene';
import { attachScene, engine, syncSim } from './runtime';
import { useUi, isBrushTool, type HoverInfo } from '../state/uiStore';
import type { BrushParams } from '../tools/brush';
import { slopeAt } from '../terrain/heightfield';
import { materialById } from '../terrain/materials';

function currentBrush(): BrushParams | null {
  const s = useUi.getState();
  if (!isBrushTool(s.tool)) return null;
  return { kind: s.tool, radiusM: s.radiusM, rate: s.rates[s.tool], hardness: s.hardness, materialId: s.paintMaterialId };
}

/** Radius of the cursor ring for the active tool, or null if no ring. */
function ringRadius(): number | null {
  const s = useUi.getState();
  if (isBrushTool(s.tool) || s.tool === 'water-add' || s.tool === 'water-drain') return s.radiusM;
  if (s.tool === 'spring') return (s.world?.cellSizeM ?? 10) * 2;
  return null;
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
    isSea: engine.water.sea[i] === 1,
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
    const unsubView = useUi.subscribe((st, prev) => {
      if (st.waterView !== prev.waterView) scene.setWaterView(st.waterView);
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
