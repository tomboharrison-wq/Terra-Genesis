# Terra Genesis Phase 1 review

Date: 2026-10-27
Branch reviewed: GitHub `main` at `a8c1316` (`feat(desktop): Mac app — Electron wrapper...`)
Scope: review only. No application code changed.

## Baseline

I reviewed `AGENTS.md`, `docs/PROJECT_STATE.md`, `docs/NEXT_TASK.md`, `docs/BACKLOG.md`, `docs/DECISIONS.md`, `docs/SPEC_INDEX.md`, and only the indexed sections of the master spec. The repository is substantially more complete than the earlier local foundation snapshot: the education Landform Show, CPU/GPU water solver, Time-lapse, persistence, tests, and Mac wrapper are present.

The requested commands were attempted exactly in this Git worktree. `npm install`, `npm run typecheck`, `npm test`, and `npm run build` all failed before execution because this environment has no `npm`, `node`, or `corepack` on PATH (`command not found`). Therefore the committed `PROJECT_STATE` claims (`typecheck`, 262 tests, build, GPU 12/12, e2e 56/56) could not be independently reproduced here.

## Findings

### High — requested checks are not reproducible in this environment
- **File:line:** repository tooling / `package-lock.json`, `package.json`
- **Problem:** the repository has a committed npm lockfile, but the review environment has no Node/npm runtime. No fresh install, typecheck, unit test, or build result can be verified.
- **Fix:** run the exact commands in CI or a Node-enabled machine and attach the logs; keep the pinned lockfile as the source of truth.

### High — GPU backend is coupled to Three.js internals
- **File:line:** `src/renderer/waterLayer.ts:119-120`; `src/sim/water/gpuWater.ts:38`
- **Problem:** GPU state and bed textures are injected through `renderer.properties` (`__webglTexture`) rather than a stable public Three.js texture path. A Three.js upgrade, renderer disposal, context loss, or texture reallocation can leave stale bindings or silently render stale water while the CPU mirror continues.
- **Fix:** centralise the binding contract, validate texture identity after context restore, and add a context-loss/reinitialisation test that proves CPU/GPU parity after recovery.

### High — float32 water-depth drift is a known scientific correctness issue
- **File:line:** `docs/PROJECT_STATE.md` known failures; `docs/BACKLOG.md` M02-C07; `src/sim/water/*`
- **Problem:** the project explicitly records percent-scale ledger drift in closed-basin lakes over simulated years. That undermines conservation claims and can change classroom conclusions about lake level and discharge.
- **Fix:** use compensated/float64 accumulation or periodic mass correction with a visible conservation diagnostic, then add a long-run closed-basin acceptance test.

### High — GPU and CPU are not continuously authoritative together
- **File:line:** `src/engine/engine.ts:185-220,258-367`; `src/sim/water/gpuWater.ts:38`
- **Problem:** while attached, GPU textures are authoritative and CPU arrays are mirrors refreshed on a cadence. UI inspection, save, hazards, climate, coast, glacier, plate, lava, and vegetation paths repeatedly pull/push state. A mid-run save, reload, or exception between those transitions can capture a stale mirror or lose GPU-only state.
- **Fix:** make synchronization an explicit transaction boundary; block/flush save and world replacement until a completed sync, and test save/reload at every cadence boundary while running.

### Medium — time-lapse speed is intentionally approximate but the UI can imply exact physical timing
- **File:line:** `src/engine/clock.ts:1-...`; `src/app/TimeBar.tsx:74-110`; `src/app/LandformShow.tsx:159-162`
- **Problem:** the engine caps work per frame and reports achieved speed, while the Landform Show displays a real-world years clock from hand-authored keyframes. Users can read the displayed multiplier/years as a calibrated physical prediction even though model rates are illustrative and several scenes are purely animated SVG.
- **Fix:** label model time as illustrative in the primary readout, expose achieved rather than requested speed everywhere, and keep the “model rates” limitation adjacent to the clock.

### Medium — Landform Show contains examiner-sensitive simplifications that need explicit qualification
- **File:line:** `src/education/landforms/content.ts:924-1047,1128-1160`
- **Problem:** examples include broad claims such as “prevailing wind ... sets the direction waves arrive from” and simplified glacier processes (e.g. pressure melting and rotational movement) that are acceptable teaching models only with context. The current prose does not consistently distinguish a simplified diagram from a universal mechanism. `bars` says Slapton Ley formed “a few thousand years ago” while the exact age and formation history are more nuanced; `waterfalls-gorges` combines model years with Niagara’s retreat rate.
- **Fix:** have a geography subject specialist check every stage, example, timescale and process against Edexcel Topic 1; mark model-only claims as simplified and separate UK case-study facts from generic mechanisms. Add a reviewed source note per formation.

### Medium — scene animation is decorative unless tied to measured process state
- **File:line:** `src/app/landforms/coastScenes.tsx:10-45,80-87`; `src/app/landforms/riverScenes.tsx:6-19,208-234`; corresponding glacial scenes
- **Problem:** pebbles, bubbles, waves and flowing dashes are periodic SVG animation driven by wall-clock `time`; they are explanatory illustrations, not solver outputs. In a product that otherwise advertises a physical sandbox, this distinction is easy to miss.
- **Fix:** label the Landform Show as an illustrated process model, and reserve “simulation” wording for scenes backed by authoritative state.

### Medium — desktop wrapper allows arbitrary HTTPS window-open destinations
- **File:line:** `desktop/main.cjs:24-28`
- **Problem:** any page content that opens an `http`/`https` window is handed to the system browser. This is preferable to embedding remote content, but it is broader than the documented teacher links and gives compromised local content an external-navigation capability.
- **Fix:** allowlist the documented domains/URLs, reject non-HTTPS explicitly, and add a test for `file:`, `javascript:`, and unapproved HTTPS URLs. Keep `contextIsolation` and `sandbox` enabled.

### Medium — desktop protocol handler has no MIME/content policy and relies on path checks
- **File:line:** `desktop/main.cjs:43-50`
- **Problem:** the handler normalizes a decoded URL path and serves any existing file below `desktop/web`. It does not restrict extensions or set headers; a packaged accidental file can become browser-served content. Symlink behavior should also be tested against the package layout.
- **Fix:** serve a fixed asset manifest or extension allowlist, verify the resolved real path remains under the packaged root, and add offline package smoke tests.

### Medium — classroom accessibility is present but still has risk areas
- **File:line:** `src/app/styles.css:90-110`; `src/app/LandformShow.tsx:124-215`; `src/app/ToolRail.tsx`
- **Problem:** focus styles and named controls exist, but projector usability depends on many small controls, dense tool panels and animated content. Full-screen/presentation, keyboard navigation, Escape handling, and contrast are tested in the repository but cannot be rerun here; the known backlog specifically records earlier fixes in these areas.
- **Fix:** rerun the accessibility/e2e suite on the release build at projector resolution and manually verify focus order, readable labels from the back of a room, and recovery after opening/closing dialogs.

### Medium — performance remains unverified on target hardware
- **File:line:** `docs/PROJECT_STATE.md` known failures; `src/renderer/TerrainScene.ts:194-290`; `src/engine/clock.ts`
- **Problem:** real GPU speed is explicitly unmeasured, Firefox/WebKit and a real Mac are untested, and the app combines Three rendering, GPU passes, overlays and time-lapse. Frame-rate independence tests do not establish frame time or memory behavior on an integrated school laptop.
- **Fix:** collect 1%, median and worst frame times, memory growth and achieved simulated speed for representative 256²/512² worlds on Intel UHD and Apple integrated GPUs, including long Time-lapse runs.

### Low — test suite does not appear to cover every documented known gap
- **File:line:** `tests/` and `docs/BACKLOG.md`
- **Problem:** there are strong domain tests and e2e claims, but known gaps (float32 lake drift, real GPU speed, browser compatibility, mid-run GPU save/reload) remain open. A green suite therefore does not mean those risks are controlled.
- **Fix:** add explicit regression tests/benchmarks for each known gap or keep the limitation visible in classroom-facing help.

### Low — documentation status is inconsistent
- **File:line:** `docs/PROJECT_STATE.md`, `docs/BACKLOG.md`
- **Problem:** PROJECT_STATE says all planned milestones are complete and READY, while BACKLOG still lists several technically meaningful limitations and `M01-C07` as partial. This can cause a maintainer or teacher to overestimate readiness.
- **Fix:** distinguish “feature complete” from “verified on target hardware/scientifically reviewed” in status docs and link each known limitation to its acceptance test.

## Coverage notes

- **Simulation:** CPU water, GPU water, sediment, climate, coasts, glaciers, plants, tectonics, lava and hazards are present. The main unresolved correctness concern is long-run float32 conservation and synchronization boundaries.
- **Save/load and undo/redo:** binary versioned persistence and history implementations are present; the required runtime validation could not be executed because Node/npm is unavailable. Mid-run GPU save/reload should be treated as a priority test.
- **Empty/tiny/huge worlds:** code and tests exist, but execution was blocked; inspect results from CI before relying on them in lessons.
- **Edexcel accuracy:** the full content and scenes are now present. A code review can flag terminology and model framing, but final examiner accuracy still needs subject-specialist sign-off.
- **Honesty:** the Landform Show’s wall-clock SVG animations are illustrative and should be labelled as such; the main engine controls appear connected to authoritative state by architecture, subject to runtime verification.

## Prioritised top 10

1. Run the full npm/typecheck/test/build/e2e/GPU checks in a Node-enabled CI environment and preserve logs.
2. Fix or quantify float32 water conservation drift in long closed basins.
3. Make GPU↔CPU synchronization transactional for save, reload, hazards and other solver hand-offs.
4. Add WebGL context-loss/recovery tests and remove dependence on fragile Three.js internal texture injection where possible.
5. Measure frame time, memory and long Time-lapse behavior on representative integrated GPUs and browsers.
6. Add explicit “illustrated model / approximate timescale” wording to the Landform Show clock and process animations.
7. Obtain geography-teacher/examiner review of all 27 Topic 1 landforms, stages, terminology, examples and timescales.
8. Harden the Electron protocol handler with an asset allowlist, real-path check and URL allowlist tests.
9. Add mid-run save/reload, empty/tiny/huge-world and GPU fallback regression tests.
10. Align PROJECT_STATE/BACKLOG language so feature completion and real-device/scientific verification are clearly separate.

Phase 1 complete. No application code was changed.
