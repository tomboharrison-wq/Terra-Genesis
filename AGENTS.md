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
- `node scripts/screenshot.mjs [url] [out.png]` — headless Chromium capture (needs dev/preview server)

## Folder map
- `src/engine/`   WorldState contract, Engine (world owner, dirty regions, history)
- `src/terrain/`  materials registry, procedural generation, heightfield sampling/raycast
- `src/tools/`    sculpt brushes (physical edits), undo/redo stroke recorder
- `src/renderer/` Three.js scene (imperative; React never touches Three objects)
- `src/persistence/` binary world format + IndexedDB slots
- `src/state/`    zustand UI store (NO per-cell data)
- `src/app/`      React shell components + styles
- `src/utils/`    rng, noise, rect helpers, axis conventions
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
