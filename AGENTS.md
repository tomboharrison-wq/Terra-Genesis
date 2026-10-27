# Terra Genesis — agent orientation

Original browser landscape-evolution sandbox (TypeScript + React + Vite + Three.js).
Full requirements: `docs/MASTER_SPEC.md` (reference only — do NOT reread whole; use `docs/SPEC_INDEX.md`).

## Restart procedure (every session)
1. Read this file, `docs/PROJECT_STATE.md`, `docs/NEXT_TASK.md`.
2. `git status --short && git log --oneline -5`.
3. `npm test` (fast) to confirm green start.
4. Continue the active chunk in NEXT_TASK. Do not restart or re-architect.

## Commands
- `npm install` — once (lockfile committed)
- `npm run dev` — dev server (http://localhost:5173)
- `npm run typecheck` — `tsc --noEmit`, strict
- `npm test` — Vitest numerical/unit tests in `tests/`
- `npm run build` — typecheck + production build to `dist/` (Netlify publish dir)
- `npm run preview` — serve built `dist/`
- `npm run e2e` — headless Chromium e2e + screenshots to tests/screenshots (needs `npm run preview` on :4173)
- `npm run gpu-check` — CPU-vs-GPU water solver comparison in headless Chromium (needs preview)

## Folder map
- `src/engine/`   WorldState contract, Engine (world owner, dirty regions, history)
- `src/terrain/`  materials registry, procedural generation, drainage conditioning, heightfield sampling/raycast
- `src/sim/water/` WaterSim (CPU reference), GpuWater (WebGL2 water + sediment passes), ledger, GPU self-test
- `src/sim/climate/` ClimateField (temperature, rain/evaporation factors)
- `src/sim/sediment/` SedimentSim (CPU reference erosion/transport/deposition/creep) + sediment ledger
- `src/local/`    guided local models (slump, arch voxel lab, shoreline one-line model)
- `src/tools/`    sculpt brushes (physical edits), undo/redo stroke recorder
- `src/renderer/` Three.js scene (imperative; React never touches Three objects)
- `src/persistence/` binary world format + IndexedDB slots
- `src/state/`    zustand UI store (NO per-cell data)
- `src/app/`      React shell components + styles
- `src/utils/`    rng, noise, rect helpers, axis conventions
- `desktop/`     Mac app (Electron wrapper of dist/; see desktop/README.md)
- `tests/`        Vitest tests; `scripts/` dev tooling

## Non-negotiable rules
- Simulation fields are typed arrays in SI units (m, s, kg). Index `i = y*width + x`; x east, y north.
- Three mapping: three.x = east, three.y = elevation (up), three.z = -north. See `src/utils/axes.ts`.
- `surface = bedrockElevationM + looseSedimentThicknessM` is DERIVED; edit only bedrock/sediment.
- Every enabled control must change authoritative state. Unbuilt features are absent or labelled "planned".
- No fake simulations or decorative stand-ins for physics.
- Physics dt independent of frame rate; render loop independent of solver.
- Small chunks: implement → test → typecheck → build → commit `feat(Mxx-Cyy): …` → update docs.
- UI accent palette = Scouts colours (see `src/app/styles.css` tokens). Terrain palette stays natural.

## Continuity files
`docs/PROJECT_STATE.md` (≤4 KB) · `docs/NEXT_TASK.md` (≤2 KB) · `docs/BACKLOG.md` · `docs/DECISIONS.md`
· `docs/TEST_RESULTS.md` · `docs/CHANGELOG.md` · `docs/SPEC_INDEX.md`
