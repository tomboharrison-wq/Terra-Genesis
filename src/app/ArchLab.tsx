import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Dialog } from './Dialog';
import { useUi } from '../state/uiStore';
import { ArchModel, BED_Z, defaultArchParams, NX, NY, NZ, type Stage } from '../local/arch/model';
import { Icon } from './icons';

const STAGES: { id: Stage; label: string; text: string }[] = [
  { id: 'headland', label: 'Headland', text: 'Resistant rock juts out to sea. Waves refract around it and concentrate their energy on its sides.' },
  { id: 'cave', label: 'Cave', text: 'Hydraulic action and abrasion exploit a joint (a line of weakness) at sea level and hollow out a cave.' },
  { id: 'arch', label: 'Arch', text: 'Caves on either side of the headland meet: the sea now passes right through under a rock roof.' },
  { id: 'stack', label: 'Stack', text: 'The arch widens upward and is weathered from above until the roof collapses, leaving an isolated stack.' },
  { id: 'stump', label: 'Stump', text: 'Waves notch the base of the stack until its top collapses. The stump that remains is covered at high tide.' },
];

/** Voxels with at least one empty neighbour (only these can be seen). */
function exposed(m: ArchModel): number[] {
  const out: number[] = [];
  for (let z = 0; z < NZ; z++)
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        if (!m.isSolid(x, y, z)) continue;
        if (!m.isSolid(x + 1, y, z) || !m.isSolid(x - 1, y, z) || !m.isSolid(x, y + 1, z) || !m.isSolid(x, y - 1, z) || !m.isSolid(x, y, z + 1) || (z > 0 && !m.isSolid(x, y, z - 1)))
          out.push((z * NY + y) * NX + x);
      }
  return out;
}

/**
 * Cave → arch → stack → stump lab — a guided local model (spec E6/G3), separate from the global
 * heightfield physics. Every voxel drawn is the state of src/local/arch/model.ts; stages are
 * detected from the rock's geometry, not scripted.
 */
export function ArchLab() {
  const close = () => useUi.getState().set({ dialog: null });
  const host = useRef<HTMLDivElement>(null);
  const model = useRef<ArchModel>(new ArchModel());
  const [jointFactor, setJoint] = useState(defaultArchParams().jointFactor);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [, setTick] = useState(0);
  const redraw = useRef<() => void>(() => {});
  const playRef = useRef({ playing, speed });
  playRef.current = { playing, speed };

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcfe0ec);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 500);
    // Model x → three x (along the coast), z → up, y (seaward) → −z.
    camera.position.set(NX + 26, 30, -NY - 14);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(NX * 0.5, 9, -20);
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a48, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(30, 60, -80);
    scene.add(sun);

    const box = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial();
    const mesh = new THREE.InstancedMesh(box, mat, NX * NY * NZ);
    scene.add(mesh);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(NX + 20, NY + 20),
      new THREE.MeshLambertMaterial({ color: 0x2f78b0, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(NX / 2, model.current.p.seaLevel + 0.5, -NY / 2 - 10);
    scene.add(sea);

    const mtx = new THREE.Matrix4();
    const col = new THREE.Color();
    const chalk = new THREE.Color(0xd8d1bd);
    const jointCol = new THREE.Color(0xa99d84);
    const bed = new THREE.Color(0x7d7466);
    const build = () => {
      const m = model.current;
      const list = exposed(m);
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        const z = Math.floor(i / (NX * NY));
        const y = Math.floor((i % (NX * NY)) / NX);
        const x = i % NX;
        mtx.makeTranslation(x + 0.5, z + 0.5, -(y + 0.5));
        mesh.setMatrixAt(k, mtx);
        const inJoint = Math.abs(y - m.p.jointY) <= 1 && x >= m.p.headX0 && x < m.p.headX1;
        col.copy(z < BED_Z ? bed : inJoint ? jointCol : chalk).multiplyScalar(0.82 + 0.18 * (z / NZ));
        mesh.setColorAt(k, col);
      }
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    redraw.current = () => {
      build();
      setTick((t) => t + 1);
    };
    build();

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let raf = 0;
    const frame = () => {
      const { playing: on, speed: n } = playRef.current;
      const m = model.current;
      if (on) {
        if (m.currentStage === 'stump' || m.currentStage === 'gone') setPlaying(false);
        else {
          for (let k = 0; k < n; k++) m.advance();
          redraw.current();
        }
      }
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      box.dispose();
      mat.dispose();
      mesh.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const m = model.current;
  const stage = m.currentStage;
  const at = STAGES.findIndex((s) => s.id === stage);
  const reached = (id: Stage) => m.stageHistory.find((h) => h.stage === id);
  const reset = (jf = jointFactor) => {
    setPlaying(false);
    m.p = { ...m.p, jointFactor: jf };
    m.reset();
    redraw.current();
  };
  const done = stage === 'stump' || stage === 'gone';

  return (
    <Dialog title="Cave, arch, stack and stump lab (guided model)" onClose={close} wide>
      <ol className="arch-stages" aria-label="Stages">
        {STAGES.map((s, k) => (
          <li key={s.id} className={`${s.id} ${k === at ? 'now' : ''} ${k < at ? 'past' : ''}`} data-stage={s.id}>
            <b>{s.label}</b>
            <span>{reached(s.id) ? `step ${reached(s.id)!.step}` : '—'}</span>
          </li>
        ))}
      </ol>
      <p className="arch-text" data-testid="arch-stage-text">
        <b>{STAGES[Math.max(0, at)]?.label ?? 'Gone'}:</b> {STAGES[Math.max(0, at)]?.text}
      </p>
      <div className="arch-view" ref={host} />
      <div className="slump-readout">
        <span>
          Step <b>{m.step}</b>
        </span>
        <span>
          Eroded by the sea and weather <b>{m.erodedVoxels.toLocaleString()} m³</b>
        </span>
        <span>
          Fallen in collapses <b>{m.collapsedVoxels.toLocaleString()} m³</b>
        </span>
      </div>
      <div className="dialog-foot">
        <div className="row">
          <button className="primary" disabled={done} onClick={() => setPlaying(!playing)}>
            <Icon name={playing ? 'pause' : 'play'} size={16} /> {playing ? 'Pause' : 'Play'}
          </button>
          <button
            disabled={done || playing}
            onClick={() => {
              for (let k = 0; k < 10; k++) m.advance();
              redraw.current();
            }}
          >
            Step ×10
          </button>
          <button onClick={() => reset()}>Reset</button>
          <label className="field inline">
            <span className="field-label">Speed {speed}×</span>
            <input type="range" min={1} max={6} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
          </label>
          <label className="field inline">
            <span className="field-label">Joint weakness {jointFactor}× (resets)</span>
            <input
              type="range"
              min={1}
              max={10}
              value={jointFactor}
              onChange={(e) => {
                setJoint(+e.target.value);
                reset(+e.target.value);
              }}
            />
          </label>
        </div>
      </div>
      <p className="muted small">
        Guided model: 1 m chalk voxels attacked by waves at sea level (energy fading into caves, rising inside them) and slowly weathered
        above it; rock with no connection to the seabed falls. Steps are model time, not years. Drag to orbit.
      </p>
    </Dialog>
  );
}
