import { useEffect, useRef } from 'react';
import { TerrainScene } from '../renderer/TerrainScene';
import { attachScene, engine } from './runtime';
import { useUi, type HoverInfo } from '../state/uiStore';
import type { BrushParams } from '../tools/brush';
import { slopeAt } from '../terrain/heightfield';
import { materialById } from '../terrain/materials';

function currentBrush(): BrushParams | null {
  const s = useUi.getState();
  if (s.tool === 'navigate') return null;
  return { kind: s.tool, radiusM: s.radiusM, rate: s.rates[s.tool], hardness: s.hardness, materialId: s.paintMaterialId };
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

    let client: { x: number; y: number } | null = null;
    let brushing = false;
    let spaceHeld = false;
    let hoverTimer = 0;

    const brushAllowed = (e?: { altKey: boolean }) => !spaceHeld && !(e?.altKey ?? false) && currentBrush() !== null;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !brushAllowed(e)) return;
      const hit = scene.pick(e.clientX, e.clientY);
      if (!hit) return;
      e.stopPropagation();
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      brushing = true;
      client = { x: e.clientX, y: e.clientY };
      const p = currentBrush()!;
      engine.beginStroke(p, hit.xM, hit.yM, labelFor(p));
    };
    const onMove = (e: PointerEvent) => {
      client = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!brushing) return;
      brushing = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      engine.endStroke();
    };
    const onLeave = () => {
      if (!brushing) {
        client = null;
        scene.setBrush(false);
        useUi.getState().set({ hover: null });
      }
    };

    scene.onFrame = (dt) => {
      const p = currentBrush();
      const hit = client ? scene.pick(client.x, client.y) : null;
      if (brushing && hit) engine.strokeStep(hit.xM, hit.yM, dt);
      scene.setBrush(!!(hit && p && !spaceHeld), hit?.xM, hit?.yM, p?.radiusM);
      hoverTimer += dt;
      if (hoverTimer > 0.1) {
        hoverTimer = 0;
        useUi.getState().set({ hover: hit ? hoverFrom(hit.xM, hit.yM) : null });
      }
    };
    scene.onStats = (s) => useUi.getState().set({ stats: s });

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
