import { useEffect, useRef, useState } from 'react';
import { ArchModel, archParamsFor, STAGE_ORDER, type Stage } from '../local/arch/model';
import { defaultShorelineParams, NX, NY, ShorelineModel, type ShorelineParams } from '../local/shoreline/model';
import { createArchScene } from './archScene';
import { drawShoreline, PX } from './shorelineDraw';

/**
 * Coastal guided-model views for Education Mode. Each shows the real state of a guided local model
 * (src/local/arch, src/local/shoreline), run forward to the lesson stage; going back re-runs the
 * deterministic model from its start, so a stage always looks the same.
 */

const ARCH_ROCK = 'chalk'; // Old Harry Rocks, Dorset

/** Cave → arch → stack → stump: runs the voxel model until it reaches `stage`. */
export function ArchLessonView({ stage }: { stage: Stage }) {
  const host = useRef<HTMLDivElement>(null);
  const model = useRef(new ArchModel(archParamsFor(ARCH_ROCK, 2, 8, 5)));
  const target = useRef(stage);
  target.current = stage;
  const [now, setNow] = useState<Stage>('headland');
  useEffect(() => {
    const view = createArchScene(
      host.current!,
      () => model.current,
      () => ARCH_ROCK,
    );
    view.rebuild();
    let raf = 0;
    const frame = () => {
      const m = model.current;
      const want = STAGE_ORDER.indexOf(target.current);
      if (STAGE_ORDER.indexOf(m.currentStage) > want) {
        m.reset(); // going back: re-run the same model from its start
        while (STAGE_ORDER.indexOf(m.currentStage) < want) m.advance();
        view.rebuild();
      } else if (STAGE_ORDER.indexOf(m.currentStage) < want) {
        for (let k = 0; k < 3 && STAGE_ORDER.indexOf(m.currentStage) < want; k++) m.advance();
        view.rebuild();
      }
      setNow(m.currentStage); // React skips the render when unchanged
      view.render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      view.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const label: Record<Stage, string> = {
    headland: 'Headland',
    cave: 'Cave',
    arch: 'Arch',
    stack: 'Stack',
    stump: 'Stump',
    gone: 'Worn away',
  };
  return (
    <div className="lesson-3d">
      <div ref={host} className="lesson-3d-host" />
      <div className="lesson-chip">
        Now: <b>{label[now]}</b> · chalk headland, 2 m waves · darker band = joint (line of weakness) · drag to turn
      </div>
    </div>
  );
}

/** Shoreline plan view: runs the one-line model to `years` for the given coast layout. */
export function ShorelineLessonView({ layout, years }: { layout: ShorelineParams['layout']; years: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const model = useRef<ShorelineModel | null>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!model.current || model.current.p.layout !== layout)
      model.current = new ShorelineModel({
        ...defaultShorelineParams(),
        layout,
      });
    const m = model.current;
    const draw = () => canvas.current && drawShoreline(canvas.current.getContext('2d')!, m);
    if (m.day / 365 > years + 1e-6) m.reset(); // going back: re-run from the start
    let raf = 0;
    const tick = () => {
      // Run as much model time as fits in ~20 ms of this frame, so slow classroom machines keep up.
      const t0 = performance.now();
      do {
        const left = years * 365 - m.day;
        if (left <= 0) break;
        m.step(Math.min(left, 60));
      } while (performance.now() - t0 < 20);
      draw();
      setShown(m.day / 365);
      if (years * 365 - m.day > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout, years]);
  return (
    <div className="lesson-3d">
      <canvas ref={canvas} width={NX * PX} height={NY * PX} className="lesson-canvas" />
      <div className="lesson-chip">
        {shown.toFixed(0)} years · plan view (sea at the top) · <span style={{ color: '#e8d49a' }}>■</span> sand · <span style={{ color: '#5ca096' }}>■</span>{' '}
        lagoon · dashed line = original coast · white arrows = today’s waves
      </div>
    </div>
  );
}
