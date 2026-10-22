# TERRA GENESIS
## Master product specification, engineering blueprint and low-context AI build protocol

**Document version:** 1.0  
**Prepared:** 21 October 2026  
**Target:** Original, browser-based, Terra Firma 2-inspired landscape simulation for an Apple M4 MacBook Air, with an optional UK geography education mode.  
**Primary deployment:** Netlify-compatible static web application.  
**Operating principle:** Deliver a small, *genuinely working* simulator, then extend it in independently testable, resumable chunks.  

> **IMPORTANT — HOW TO USE THIS DOCUMENT:** Give this file to your coding AI **once at project initiation**. It should place it at `docs/MASTER_SPEC.md` inside the repository and create the much smaller `AGENTS.md`, `docs/PROJECT_STATE.md`, `docs/NEXT_TASK.md`, `docs/DECISIONS.md`, and `docs/TEST_RESULTS.md` described in Part A. **Later sessions must read the small handoff files first, not this whole document.** Read individual sections of this master spec only when relevant to the current chunk. This is critical to reduce context consumption and avoid rebuilding completed work.

---

# A. INSTRUCTIONS FOR THE AI BUILD AGENT — READ FIRST

## A1. Mission and authority

You are acting as an autonomous lead engineer, numerical simulation developer, 3D technical artist, product designer, geographer and software tester. Your job is to **build the functioning application**, not merely write a plan, make mockups, or add menus for nonexistent systems. You may make routine technical choices without asking for approval. Respect the user's constraints, the existing codebase, and actual tool access. Never say you ran tests, created an artifact, or verified a browser result unless you did.

The final product is **original software** inspired by the genre and capabilities of evolving-terrain sandbox games. Do not copy Terra Firma 2's proprietary branding, code, textures, art or exact interface. Use original assets and openly licensed dependencies.

**Success depends on the relationship between systems:** edit a mountain → add rainfall → water flows downhill → it erodes and transports material → sediment is deposited elsewhere → persistent landforms evolve → vegetation/climate interact later. Visual polish must support physical clarity, never replace it.

## A2. The mandatory low-context rule

**Do not reread the entire master specification every session.** It exists as a reference, not recurring conversational context.

At the **first** session only:

1. Read this document (or enough of it to understand constraints and milestones).
2. Inspect the repository, if any; do not overwrite existing code blindly.
3. Create the small continuity files listed in A3, plus a minimal `AGENTS.md`.
4. Split the first milestone into self-contained chunks with testable outcomes.
5. Implement the first chunk immediately, run checks and update the continuity files.

At the **start of every later session**, including after a usage cap, crash, conversation change or context reset:

1. Read `AGENTS.md` (**short orientation and rules**).
2. Read `docs/PROJECT_STATE.md` (**current truth**, target 1–2 KB, absolute ceiling 4 KB).
3. Read `docs/NEXT_TASK.md` (**one work item**, target 1 KB, ceiling 2 KB).
4. Inspect `git status --short`, recent commits and *only the files listed as relevant*.
5. Run the smallest existing test or build needed to confirm the starting point.
6. Read only the relevant heading/lines from `docs/MASTER_SPEC.md` **if needed** for the current task; do not load the whole document.
7. Continue the *current unfinished chunk*. Do not restart the project, redesign the architecture or create duplicate modules.

If any continuity file is missing, reconstruct it conservatively from `git log`, repository contents and tests, then create it. Prefer code and test results over outdated status claims. If the repo contains uncommitted changes, determine whether they are part of the interrupted chunk before editing.

## A3. Persistent project memory files

Create these files in the project. They are *operational memory*, distinct from this full specification:

**`AGENTS.md` (maximum ~120 lines):** Stack, exact install/build/test commands, folder map, non-negotiable engineering rules, where continuity files live, and restart procedure. Keep it short and durable.

**`docs/PROJECT_STATE.md` (maximum 4 KB):**

```md
# Project state
Updated: YYYY-MM-DD, session N
Branch / HEAD: <branch> / <short hash>
Current milestone: M02 — <name>
Current chunk: M02-C03 — <name>
Status: READY | IN_PROGRESS | BLOCKED | COMPLETE
Verified working: <3–8 terse bullet facts, with test commands>
Known failures: <bullets, or none>
Architecture / relevant paths: <short list>
Last checks: npm run typecheck [PASS/FAIL], npm test [PASS/FAIL], npm run build [PASS/FAIL]
Uncommitted changes: <none or precisely named files and purpose>
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
```

**`docs/NEXT_TASK.md` (maximum 2 KB):**

```md
# One next executable task
ID: M02-C03
Goal: <single observable outcome>
Why now: <dependency>
Read only: <exact source/docs paths>
Change only: <expected source/test paths>
Acceptance tests: <exact commands and observable test>
Do not touch: <out-of-scope modules>
Done when: <binary criteria>
If interrupted: <precise point to restart>
Next candidate: M02-C04
```

**`docs/DECISIONS.md`:** Short append-only entries for consequential architectural decisions (date, choice, reason, trade-off). Do not repeat the whole specification.

**`docs/TEST_RESULTS.md`:** Latest commands and pass/fail summaries; noteworthy visual or physics regressions; reference screenshots if they actually exist.

**`docs/BACKLOG.md`:** Stable chunk IDs, dependencies and statuses; keep the active chunk at the top, archive completed details rather than inflating current context.

**`docs/CHANGELOG.md`:** Brief user-visible progress by completed milestone or chunk.

**Optional `docs/SPEC_INDEX.md`:** One screen of headings and line ranges for selective retrieval from the master specification.

## A4. Work in small, verifiable chunks

A **milestone** is a feature family (e.g., water simulation). A **chunk** is one atomic, independently verifiable change (e.g., water-depth field and mass-budget test). Each chunk must have:

- A unique immutable ID (`M03-C02`).
- One clearly described behaviour, not a vague large feature list.
- A small set of relevant code files.
- Dependencies already satisfied.
- Unit/integration tests and, where possible, an observable in-app check.
- Build and typecheck passing at completion.
- A git commit (if git is available) and handoff updates.

**Never** generate the entire game in one pass. Aim for a reviewable slice that leaves the application runnable. A chunk that needs too many unrelated files should be split. Prefer one working feature to five partially wired panels.

### End-of-chunk transaction — mandatory

1. Finish implementation, tests and basic error handling.
2. Run targeted tests, `npm run typecheck` and `npm run build` where tools allow. Do not claim a pass unless executed.
3. Inspect the UI in a browser if available; otherwise state that visual verification was not performed.
4. Verify no control is misleadingly active without behaviour.
5. Commit using `feat(M03-C02): ...` or similar if git is available.
6. Update `PROJECT_STATE.md`, `NEXT_TASK.md`, `TEST_RESULTS.md`, `BACKLOG.md` and `CHANGELOG.md` minimally.
7. Conclude with a **short** human-facing handoff using the format in A6.

**Checkpoint timing:** After every completed chunk and *before approaching tool, time, usage or context limits*. Do not wait for the conversation to end. If only a partial change exists, record the exact unfinished step and mark checks honestly; do not pretend completion.

## A5. Context and usage efficiency rules

- **No repeated full-spec summarisation.** This markdown is the single source of full requirements; operational status belongs in the small files.
- **No dumping all source code into chat.** Edit real files through available tools. Refer to paths, diffs and short snippets.
- **No repeated dependency installation** unless necessary; reuse the existing environment and lockfile.
- **Avoid giant logs.** Show failure summaries and relevant stack traces, not thousands of unchanged lines.
- **Prefer targeted reads** (`rg`, `sed -n`, `git diff -- <path>`, tests for changed modules) to opening entire directories.
- **Avoid lengthy internal replanning.** Follow `NEXT_TASK.md`; update only if evidence makes it obsolete.
- **Do not refactor working unrelated code** while implementing a chunk unless strictly required and recorded.
- **Do not create new versions of the same component** when an existing one can be extended.
- **Protect passing behaviour** with regression tests before significant changes.
- **Do not run expensive integration tests repeatedly** when a quick unit test identifies the issue. Run full checks at chunk boundaries.
- **Do not ask the user to resend this specification** if the file is present in the repository.
- **Do not infer unlimited AI usage.** Save state early enough to resume with an empty conversation.
- **No unnecessary web searches.** Use documentation when an API/algorithm is uncertain; otherwise implement from this local spec and existing dependencies.
- **Keep responses compact during implementation.** Most effort should go into code, tests and state files, not descriptions.
- **Distinguish planned / implemented / tested / visually verified** explicitly.

## A6. Standard minimal handoff at the end of every chunk

```text
COMPLETED: Mxx-Cyy — <name>
WORKS: <one or two concrete observable behaviours>
CHECKED: <commands with PASS/FAIL; browser checked yes/no>
FILES: <significant paths only>
COMMIT: <hash or not available>
NEXT: Mxx-Czz — <one line>
RESUME: Read AGENTS.md + docs/PROJECT_STATE.md + docs/NEXT_TASK.md; continue without rereading full spec.
```

Do not waste context repeatedly explaining the whole project's vision.

## A7. What to do if usage, rate limits or context are nearly exhausted

**Before the limit:** Save, test when feasible, write the precise handoff, commit if possible. If an unfinished chunk cannot pass checks, record it as `IN_PROGRESS` and identify the last known green commit. In this case do not make a misleading "completed" commit.

**After an abrupt stop:** Treat the repo as potentially dirty. Follow A2; examine git status/diff and the active chunk, validate what actually exists, then continue. Never delete work solely because it is incomplete.

**If the AI has no persistent filesystem:** Be honest about that limitation. At the end of each chunk, export a real project archive and a compact handoff file before continuing; if export is unavailable, provide the exact modified files and resume summary. Persistent tool access is strongly preferred.

## A8. Bootstrap prompt to use with this file

```text
Build the project defined in the attached TERRA_GENESIS_MASTER_BUILD_SPEC.md.
Use its Part A low-context build protocol as mandatory operating instructions.
On first use create AGENTS.md, docs/MASTER_SPEC.md, PROJECT_STATE.md,
NEXT_TASK.md, DECISIONS.md, TEST_RESULTS.md, BACKLOG.md and CHANGELOG.md.
Use small, tested and committed chunks; keep the app runnable.
Implement the first foundation chunk NOW, not just a plan.
Do not add inert controls or fake simulations. Do not reread the master spec
in later sessions unless a selected section is directly relevant.
Prioritise M1 3D editing, then M2 water, then M3 erosion and deposition.
```

## A9. Short resume prompt for a new AI session

```text
Resume Terra Genesis from the EXISTING REPOSITORY; do not restart.
Read ONLY AGENTS.md, docs/PROJECT_STATE.md and docs/NEXT_TASK.md first.
Inspect git status and relevant files/tests. Continue the active chunk.
Use docs/MASTER_SPEC.md only for specific sections if genuinely needed.
Implement, test, checkpoint and update the handoff files. Keep responses short.
```

---

# B. PRODUCT VISION, SCOPING AND USER EXPERIENCE

## B1. Core vision

Build an original, interactive, visually sophisticated 3D Earth-surface sandbox where users can generate terrain, change land elevation, add water and climate forcing, and observe physically motivated landscape evolution. The experience should feel like a miniature evolving world rather than an educational slide deck or a static art tool.

**Primary loop:** Generate → Sculpt → Set conditions → Run → Observe → Inspect → Modify → Compare → Save/export.

**Three modes:**

1. **Sandbox:** Free editing and interconnected environmental processes, no required objectives.
2. **Challenges/Experiments:** Preset starting conditions and measurable outcomes; unlock later.
3. **Geography Education:** Optional UK KS3/GCSE/A-level teaching layer with guided processes, explanatory overlays, lesson controls and exam-focused terminology. It must not force teaching UI into Sandbox.

## B2. Quality pillars

1. **Actual causation:** Environmental systems change persistent numeric world state. A coloured shader or particle animation alone does not count as implementation.
2. **Believable visual scale:** Continuous terrain, material shading, connected catchments, convincing slopes and river mouths; do not expose underlying square grids in the normal view.
3. **Scientific defensibility:** Simplified models are permitted if coherent and labelled. Do not advertise exact geophysical forecasts.
4. **Feedback between systems:** Rain affects water; water affects erosion; erosion affects relief; relief feeds back into flow; materials affect erosion; ecology and climate interact later.
5. **Smooth interaction:** Free camera at responsive frame rate; physics updates need not equal render refreshes.
6. **Progressive scope:** Foundational water and sediment models before ambitious tectonics or wildlife.
7. **Clear observability:** Players can inspect relevant variables and see why changes occurred.
8. **Local-first delivery:** Mac-compatible browser, no mandatory Windows, cloud account or backend; Netlify deployment.

## B3. What the product is not

- Not a copyright clone of Terra Firma 2.
- Not Minecraft-style visible voxels as the primary terrain renderer.
- Not a static landscape editor with fake blue flowing textures.
- Not a scientifically validated global Earth-system prediction model.
- Not a full geological solid mechanics solver or computational fluid dynamics package in its first releases.
- Not an all-at-once deliverable that can honestly be finished in a single coding-model response.

## B4. Initial definition of useful minimum product

A user on an M4 MacBook Air opens the app, generates a mountain, sculpts a valley, adds rain, sees water gather and flow downhill, runs erosion, observes a changed valley and sediment deposited downhill, inspects the height and water fields, saves the world and reloads it. The UI is polished and the terrain visually smooth. **This milestone is more valuable than implementing fifty disconnected menus.**

---

# C. TECHNICAL ARCHITECTURE

## C1. Platform and toolchain

- TypeScript + React + Vite, current compatible maintained versions.
- Three.js for 3D rendering (initially WebGL2); use direct Three integration or a carefully chosen React integration, but **one** renderer/scene ownership model.
- Zustand or equivalent lightweight state for UI, *not* a per-cell reactive store.
- Typed arrays (`Float32Array`, `Uint16Array`, etc.) for simulation fields.
- Web Workers for CPU-heavy work; transferable buffers or carefully designed double buffering.
- Optional WebAssembly for proven hot spots; optional WebGPU compute after CPU reference tests pass.
- IndexedDB for autosave and local worlds; versioned download format.
- Vitest for unit and numerical tests, browser automation where available, TypeScript strict mode, linting.
- `npm install`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`, `npm run preview`; implement these real scripts.
- Static deployment suitable for Netlify; create appropriate config and make any necessary asset-path arrangements.

Check versions and browser support before relying on experimental APIs. Safari on Apple Silicon is a target; do not assume WebGPU compute support is identical across browser versions.

## C2. Directory design

```text
terra-genesis/
  AGENTS.md
  docs/
    MASTER_SPEC.md
    PROJECT_STATE.md
    NEXT_TASK.md
    BACKLOG.md
    DECISIONS.md
    TEST_RESULTS.md
    CHANGELOG.md
  src/
    app/              # React shell, view composition and controls
    state/            # UI state and lightweight commands
    engine/           # World model, clock, simulation scheduling, commands
    terrain/          # Heightfields, materials, generation, sculpting
    sim/
      water/          # Flux, rainfall, routing, infiltration
      sediment/       # Advection, capacity, erosion, deposition
      slopes/         # Weathering, creep, landslides
      coastal/        # Shoreline, waves, alongshore sediment
      climate/        # Temperature, rainfall, seasons
      ice/            # Snow, glaciers and glacial erosion
      tectonics/      # Kinematic boundaries, uplift and faults
      lava/           # Eruption, flow and cooling
      ecology/        # Biomes, vegetation and soil moisture
      disasters/      # Flood, meteor, earthquake, tsunami, etc.
    renderer/         # Three scene, terrain, water, atmosphere, vegetation
    tools/            # Cursor brushes, inspectors, camera interactions
    education/        # Guided local geometry, annotations, lessons
    presets/          # Seeded reproducible world/scenario configurations
    persistence/      # Save/migrate/load/export
    utils/            # Numeric helpers, math, units and data structures
  public/             # Original or properly licensed assets
  tests/              # Numerical, integration and regression fixtures
  package.json
  vite.config.ts
  netlify.toml
```

Do not over-engineer empty modules before they are useful; this is a target architecture, not a requirement to create dozens of blank files.

## C3. World data contract

A central `WorldState` holds physically meaningful fields in **SI units**:

- `width`, `height`, `cellSizeM`, `seaLevelM`, `seed`, `simTimeSeconds` and modelling scale metadata.
- `bedrockElevationM` and `looseSedimentThicknessM` (initially); **surfaceElevationM** derived, not separately edited in contradictory ways.
- `materialId`, hardness/erodibility (lookup per material), optional stratigraphic layers.
- `waterDepthM`, directional flux or 2D velocity, water-source and sink terms.
- `sedimentSuspendedKgPerM2` or another consistently documented concentration/load field and `sedimentDepositedM` as appropriate.
- `rainfallMPerS`, `temperatureC`, `soilMoisture`, `infiltration` and `groundwater` (later).
- `snowWaterEquivalentM`, `iceThicknessM` (later).
- `vegetationDensity` and biome (later).
- `tectonicUpliftMPerS`, local fault displacement (later).
- `lavaThicknessM`, `lavaTemperatureC` (later).
- Version number, simulation parameters, selected events and reproducibility metadata.

Avoid storing full 3D rock voxels globally initially. **A 2.5D heightfield is the core**, with **local 3D volumetric modules** for caves, arches and curved slump surfaces; label transition semantics and persist them consistently.

## C4. Fixed-timestep simulation and rendering

Use a fixed or adaptively limited **numerical time step**, independent of display FPS. Render an interpolated snapshot. Process frequencies can differ: hydrology often substeps; ecology and geology update less often. Pause stops physical progression while allowing camera movement.

Suggested update contract:

1. Apply user world edits and source changes.
2. Update slowly varying environmental forcings.
3. Add rainfall/snowmelt/source water; update infiltration/evaporation.
4. Route water with positivity and stability constraints.
5. Transport sediment conservatively; erode/deposit with material constraints.
6. Update hillslope processes and derived terrain.
7. Update slower climate/ice/tectonics/lava/ecology systems as their schedules require.
8. Generate change regions and diagnostics for the renderer.

Avoid numerical circular dependency by defining data ownership and coupling order. User acceleration should change simulated elapsed time safely, not multiply numerical `dt` beyond stability limits. Include bounded substeps and a cap on work per rendering frame.

## C5. World dimensions and performance

Presets: 128×128, 256×256 (initial standard), 512×512, 1024×1024 experimental. The *simulated map extent* and metres-per-cell must be separately configurable: 256 cells do not imply 256 metres. Simulated area and observed landform details must reflect resolution. Do not promise a large map can resolve tiny caves or meander scroll bars without local refinement.

Target responsive ~60 FPS camera at standard settings, degrade gracefully towards 30 FPS under load. Keep a worker/render-time diagnostic HUD during development. Apple M4 Air is fanless, so minimise sustained unnecessary load. If a test requires GPU features not supported on a particular browser, feature detect and explain fallback.

## C6. Data conventions

- Standard coordinates: x east, y north (world horizontal axes), z elevation; document Three.js axis mapping (e.g. render y as up) centrally.
- No arbitrary mixing of cells, metres, seconds, kilograms and percent.
- Tests use exact fixtures, seeded pseudo-randomness and numerical tolerances.
- Distinguish *world physical state*, *camera/renderer state*, *user controls* and *education overlays*.
- Invalidation: updates specify dirty regions or chunks, so only affected terrain buffers/textures are refreshed.
- Explicitly version saved formats, snapshot compatibility and simulations.

---

# D. VISUAL WORLD, CAMERA AND EDITING

## D1. World creation

New-world presets: flat test world, ocean, island, archipelago, river basin, mountain range, coastal headland, desert plateau, volcanic island, glaciated range, continental terrain, random seed. Options: seed, map size, metres/cell, vertical relief, water level, geology, rainfall, temperature, roughness. Same seed + settings = same generated terrain within a consistent engine version.

Use coherent procedural noise (fBm, ridged noise, warping, domain masks, ridge/valley constraints) and optional pre-erosion. Avoid random disconnected mountains, perfect pyramids and straight staircase contours. Organise drainage-scale shapes first, fine surface detail second.

## D2. Sculpting

Tools: raise, lower, smooth, flatten-to-height, ridge, valley, plateau, depression, slope, channel, embankment, paint material, add/remove loose sediment, reset area. Brush radius in metres, falloff, strength, dragging, pressure approximation where supported, optional mask and altitude clamps. Project a non-obstructive brush circle onto the terrain. Continuous strokes must be frame-rate independent and undoable as a coherent command.

Brushes edit physical state, not just mesh vertices. If rock is cut, modify bedrock elevation or layer composition; if soil is added, modify sediment thickness. Refuse/clip invalid negative quantities.

## D3. Terrain appearance

Smooth 3D triangulation with recomputed normals; tile/chunk rendering; slope/height/geology material blending; optional triplanar texturing and normal maps; terrain roughness and believable soft gradients; sensible anti-aliasing, shadows, atmospheric haze, sun controls, fog and water depth colours. Prefer original or openly licensed textures. Keep geological landforms legible under realistic lighting. Do not render visible simulation squares or Minecraft blocks in normal view.

## D4. Camera and input

Orbit, pan, zoom, fit-world, top-down, fly/explore and optional first-person; later cinematic path. Reliable Mac trackpad handling, clear shortcuts, sensitivity preferences, focus selected point, prevent camera controls interfering with brush dragging. Maintain responsive orbit even if simulation updates slowly.

## D5. Visual fluidity

Use a render loop independent of solver updates. Apply visual interpolation or mesh morphing to smooth modest shape changes while preserving authoritative physical state. Avoid shimmering terrain, unstable waterlines, z-fighting, sudden geometry pops and duplicated particles. Particles/splashes/smoke are supplemental cues only.

---

# E. SIMULATION SYSTEMS — IMPLEMENT IN DEPENDENCY ORDER

Every subsystem below requires: (i) world fields, (ii) an update operator, (iii) functional controls, (iv) visual representation, (v) numerical tests, (vi) a reproducible demonstration preset, (vii) save/load support, and (viii) a brief statement of modelling limits. Do not create its menu until core behaviour works, except where controls are clearly disabled and labelled *planned*.

## E1. Hydrology — first essential physics milestone

**Functions:** rainfall, surface runoff, slope-driven flow, ponding, basin overflow, stream convergence, lakes, coast/open outlet, optional streams and springs later. Model water surface elevation `H = bed elevation + water depth`. Use a stable 2D depth-based flux model (e.g. conservative pipe-flow/local-inertial shallow-water approximation) appropriate to project scope. Fluxes respond to head difference, distance, gravity and depth; cap outgoing volume per cell so `waterDepth >= 0`.

**Requirements:**

- Rainfall adds physical water volume; map-wide or painted-region intensity in mm/hour, converted to SI.
- Water seeks lower hydraulic head, not merely lower ground height; surface can spill over a saddle after a depression fills.
- Tributaries emerge from flow accumulation; outlet and watershed patterns should be plausible at the selected resolution.
- Allow controlled infiltration, evaporation, open/closed boundaries and fixed-source inflows; record each in a water budget.
- Water surfaces for lakes must appear level; moving streams show velocity-aligned texture/foam.
- Rivers do not instantly appear as drawn blue lines. Shallow flow can begin as thin wet areas then coalesce.
- Do not promise natural detailed meandering on a coarse square grid; couple to a later high-resolution channel model if required.
- A simple rainfall-to-river demo preset must work as soon as hydrology is available.

**Tests:** inclined plane flows downhill; closed basin fills; spill point overflow; still lake does not oscillate catastrophically; water ledger within stated numerical tolerance; dry world remains dry; no negative/NaN water depths; frame-rate changes do not change physics.

**Visualization:** depth-coloured water, meaningful transparency in shallow reaches, mild surface ripples, directional cues based on computed velocities, shoreline transitions, foam where real gradient/velocity justify it. Avoid drifting blue particles disconnected from flow.

## E2. Sediment, hydraulic erosion and deposition — second essential physics milestone

Store erodible surface thickness, bedrock elevation/resistance and mobile sediment quantity. Use a controlled stream-power or transport-capacity model. One conceptual option for broad terrain incision is `E = K A^m S^n`, where `A` is contributing area or justified discharge proxy and `S` is slope. For hydraulic sediment transport, use water flux/velocity and a transport-capacity function; document limitations. Apply soil/loose-sediment removal before resistant rock where appropriate, and cap removal to available material.

**Must demonstrate:**

- Flow removes material from credible high-energy locations.
- Removed material is carried by flow rather than disappearing.
- When transport capacity declines, material is deposited, adding real terrain height.
- Different rock/material resistances produce different landform responses.
- Channels incise and modify subsequent water routes; sediment fills portions of valleys, floodplains, river mouths and lake bottoms where appropriate.
- No creation of rock/sand from nothing: maintain explicit exported, suspended, deposited and eroded mass ledgers, with any approximation errors reported.
- Low-gradient deposition and valley widening can develop at scale; do not hardcode specific shapes for all worlds.

**Tests:** material ledger, erosion resistant > weak (same flow), no erosion with no forcing beyond configured background weathering, no negative sediment, deposition increases height, export matches boundaries, no severe checkerboard/grid artifacts in standard demos.

**Rendering:** rebuild affected terrain chunks, update materials, adapt shoreline water surfaces, no particles as the sole sign of sediment motion. Offer erosion/deposition differential heatmap and cross-section comparison.

## E3. Geology and landscape materials

Materials: hard crystalline rock, resistant sedimentary rock, weaker sedimentary rock, clay, sand, gravel, soil, volcanic rock; each with hardness/erodibility, density, cohesion, permeability and angle-of-repose approximations. Support layered stratigraphy later; maintain nonnegative thickness, and reveal underlying material as top layers are removed. Terrain visual colour/texture should correspond to simulated material, including exposed cliff stratification where mesh supports it.

**Experiments:** identical river over soft vs hard rock; layered plateau differential erosion; plateau edge retreat; resistant cap rock and weaker layer. Avoid implying all rocks have one universal erodibility constant.

## E4. Weathering, hillslopes and landslides

Run slower weathering/creep than water flow. Weathering may convert a limited amount of bedrock into movable regolith depending on rock, moisture and temperature. Soil creep/diffusive transport should redistribute loose material downhill. Separate numerical mass-conservative failure where instability is triggered by gradient, cohesion, water saturation and load.

**Rotational slumping** needs a specialised local 3D mechanism: saturation reduces stability, curved slip plane develops, coherent detached block rotates backward while moving down/out, back scarp exposed, toe lobe develops. Use curved deformable mesh or rigid/sliding segment geometry, not falling pixel columns. The general landscape solver can model approximate hillslope retreat; clearly designate guided local slumping model as an educational high-detail approximation.

Tests include slope mass ledger, no spontaneous failure below thresholds, source loss and toe accumulation, no detached geometry left hovering.

## E5. Rivers and fluvial landform modules

**Natural simulation targets:** drainage basins, tributaries, V-shaped valleys from incision plus slope response, alluvial fans, floodplains, natural levees where resolution allows, channel bars, depositional river mouths/deltas. A meandering channel and oxbow formation should use a local higher-resolution bank/flow model as required, with curvature, outside-bank erosion, inside-bank point-bar accretion, progressive neck narrowing, cut-off and isolation. Do not merely animate an identical S-shaped spline.

**Dedicated waterfall/gorge local model:** resistant cap above weaker rock; waterfall lip and plunge pool; preferential erosion/undercut; eventual failure/removal of unsupported rock; retreat and gorge. A global heightfield cannot represent overhangs: locally use solid geometry (SDF/mesh/volumetric region). Expose erosion/deposition, river cliff/slip-off slope, cross sections and step playback in Education Mode. Distinguish guided scenarios from emergent solver capabilities.

## E6. Coasts, waves and coastal landforms

Coastline is derived from sea level versus terrain and changes as erosion, deposition or sea-level changes. Ocean visual rendering (animated waves, shallows, foam) is separate from **physical coastline evolution**. Start with an explicit simplified shoreline-energy/alongshore-transport model; later introduce wave refraction/ray effects by water depth.

Controls: incident wave direction, relative energy, height/period surrogate, sediment availability, material resistance, sea level and transport scaling. Oblique wave approach drives alongshore sediment flux; deposition builds a continuous ridge where sediment pathways end or coastal geometry creates sheltered water. Develop beaches, spits (including recurved ends under changing wave regime), bars/baymouth barriers, lagoons and tombolos where suitable. Each must be actual sediment geometry, not a sequence of bouncing yellow particles.

**Headlands/bays:** differential erosion of bands of more/less resistant rock; energy concentrated at exposed headlands, lower exposure in sheltered bays where modelled.

**Cliffs/platforms:** marine undercut, weathering, collapse, cliff retreat and wave-cut platform where possible; careful with physical limits of heightfield.

**Cave → arch → stack → stump:** implement high-resolution local 3D solid geometry because heights cannot store cave openings. Start from a joint/weakness, enlarge real cavity, connect tunnel, collapse roof, leave isolated stack then reduce to stump. Use a geometrically continuous process and real visible openings; never fake using dark decals or disconnected static stages. Cleanly connect local geomodel to wave exposure and material parameters.

**Coastal slumping:** same local slumping system as E4 applied to weak/saturated cliffs and with protective temporary toe debris.

**Tests:** sediment conserved within shoreline system, spit grows from supply, zero-energy wave case produces no marine erosion, coast retreats more on weaker rock (same forcing), cave contains traversable/visible hole in 3D local geometry, sea-level changes recalculate coastline.

## E7. Climate, rainfall and seasons

Controls for temperature, rainfall, evaporation, humidity/moisture surrogate, season, wind, elevation lapse rate and optional geographic climate zones. Optional simple rain-shadow model: prevailing moist wind, upslope precipitation, leeward reduction; document simplification. Temperature falls with elevation via adjustable lapse rate; use physically meaningful thresholds for snow, snowmelt and vegetation. Rainfall updates hydrology; evaporation removes water and contributes to the ledger. Distinguish seasonal time from accelerated geomorphological time. Render weather conditions consistently with simulated rain/snow; no ornamental thunderstorm in a dry world.

## E8. Snow, glaciers and glacial erosion

Store snow water equivalent, ice mass/thickness, accumulation and ablation. Ice flows downhill under a simplified thickness/surface-slope law; possible abrasion/quarrying rules erode underlying terrain. Snowmelt returns water to hydrology; receding ice reveals U-shaped troughs/overdeepening where the grid and model can produce them. Fine-scale corries, arêtes, pyramidal peaks, truncated spurs, hanging valleys and moraines may require dedicated scenario geometry or resolution, accurately labelled as guided approximations. Provide cold/warm comparison, mass balance and landscape profile tools.

## E9. Plate tectonics, uplift and earthquakes

Do not attempt a full geodynamic mantle solver. Define kinematic plate regions and boundary interactions capable of accumulating terrain deformation:

- Divergent: extensional rifting, normal faulting, oceanic spreading and magma introduction where specified.
- Oceanic–continental destructive: trench + descending oceanic slab + related volcanism and seismicity with correctly positioned features.
- Oceanic–oceanic: trench, arc islands and earthquakes.
- Continental collision: compression, crustal shortening/folding/thickening and mountain-building; **explicitly support fold mountain formation here**.
- Transform/conservative: lateral fault displacement with persistent offset.
- Earthquake tool: orientation, fault type, location, horizontal/vertical offsets and persistent surface deformation; camera shake optional and not the mechanism.
- Optional mantle convection schematic should be labelled as a simplification; continuous arrows in a cross-section, not a literal claim that discrete perfect circles uniquely drive plates.

Connect uplift to ongoing erosion over simulated time. Use separate cross-sectional/local 3D geometry for underthrust slabs where necessary.

## E10. Volcanoes and lava

Add a vent with controlled eruption rate, lava viscosity/mobility, eruption duration, heat/cooling and elevation. Lava follows gravity/topography, accumulates, cools and **solidifies into persistent volcanic rock**. Form broad shield-like slopes under fluid conditions and steeper composite-like cones via appropriately modelled lava and fragmental deposits; avoid identical or pyramid cones. Optional eruption plumes, ash, ejecta, steam and glow accentuate physics. Caldera collapse is a separate structural process and should affect terrain. New volcanic landscapes subsequently weather, erode and vegetate. Example: create an island from an underwater vent.

## E11. Biomes, ecology and vegetation

Based on temperature, rainfall, soil moisture, altitude and disturbance, classify simplified rainforest, temperate forest, grassland, savanna, desert, boreal forest, tundra, alpine vegetation, wetlands and mangrove/coastal environments (where model supports salinity/shore proximity). Vegetation slowly establishes/spreads/declines rather than popping into existence. Growth affects erosion resistance by a bounded stabilising factor, not full immunity. Render efficient varied instanced trees/plants with distance LOD and irregular placement. Groundwater/wetlands later; animals explicitly optional, not core.

## E12. Natural disasters

Floods and reservoir breaches (hydrology), earthquakes (fault deformation), volcanic eruptions (lava), landslides (material transfer), drought (forcing), tsunami (long-wave coastal disturbance under explicitly simplified water model), meteor impacts (crater excavation + approximate ejecta deposit), extreme rain (runoff and instability). Each event has controls, persistent effect where physically relevant, event timestamp and before/after comparison. No implied hazard prediction or accurate casualty modelling.

## E13. Cross-system couplings

Minimum end-state couplings:

- Terrain height + rain → runoff/stream route.
- Water + sediment + geology → incision/deposition.
- Incision/deposition → changed flow routes and shorelines.
- Temperature + precipitation → snow/ice; melting → surface water.
- Uplift + fault events → relief changes; erosion works afterward.
- Volcanism → new solid rock; water and ecology can subsequently act.
- Soil moisture + vegetation → modifiers of hillslope and surface erosion.
- Sea level + waves + coastal sediment → shoreline evolution.

Use reproducible integration scenarios to demonstrate these relationships, not vague visual impressions.

---

# F. USER CONTROLS, MODES AND PRESENTATION

## F1. Main layout

**Viewport first**: central full-screen 3D world; minimal top bar with world name, New/Save/Load/Export, Undo/Redo, quality, settings; slender left tool rail; context-dependent right parameter panel; bottom Play/Pause/Step/Speed/Checkpoint/time controls. Panels can collapse. Avoid dense science-dashboard clutter over the landscape.

Tool families: Create world, Terrain, Geology, Water, Sediment, Climate, Ice, Coasts, Tectonics, Volcanism, Vegetation, Disasters, Measure/Inspect, Education. Not-yet-implemented families must be absent or explicitly disabled—not false-working.

## F2. Contextual tools

Show only relevant inputs. For example, Water shows rainfall intensity mm/h, selected-area brush, evaporation, inlet/outlet and pause; Volcano shows vent position, volume/second, viscosity and Start/Stop. Brush overlay shows intended footprint. Make every displayed enabled control change authoritative state and display a visible result or diagnostic. Include reset-to-default and warning for unstable parameter ranges.

## F3. Time, checkpoints and replay

Play, Pause, Single Step, 1×/faster numerical simulation (bounded substeps), physical-world time, process-specific acceleration noted as nonphysical when used. Save snapshots; undo terrain brush actions as command history; physical history is restored via snapshots, **not by integrating time backwards**. Optional event log and saved user-action replay if determinism verified. Side-by-side comparison/height-difference overlays are valuable later.

## F4. Data overlays and inspection

Maps and legends with units: elevation, slope, aspect, watershed/flow accumulation, water depth and velocity, sediment concentration, erosion vs deposition, geology, rainfall, temperature, soil moisture, ice, vegetation and deformation. Only enable when backing data exists. Position inspector reads actual values. Line-transect elevation profile, slope, distance, area, river length, cross-section and layer inspection. Do not invent datapoint values in a UI.

## F5. Visual effects/audio

Optional ambient rain, wind, waves, rivers, waterfalls, eruption and landslide sounds; separate master/SFX/music controls and muted classroom mode. Realistic restrained environmental palette: rock greys, soil browns, natural green, sand, snow, shallow/deep blues. No excessive neon or bloom. Lighting sun angle/time-of-day and shadow quality adjustable. Quality presets Performance / Balanced / High / Experimental.

## F6. Challenge mode (defer until core physics works)

Scenario objectives: establish sustained drainage to sea, form a measured delta deposit, build a volcanic island above sea level, maintain a vegetation target, compare flood extents, erode a plateau over time. Score only from actual world fields, not static animation triggers. Reproducible seeded starts and a clear success calculation.

---

# G. GEOGRAPHY EDUCATION MODE — OPTIONAL, BUT DESIGNED INTO THE ARCHITECTURE

## G1. Rationale

It must be possible to use the evolving landscape as an accurate on-screen geography teaching tool, especially for KS3 and **Edexcel GCSE Geography A**. The sandbox is about emergent physical patterns; classroom demonstrations additionally need recognisable landform shapes, deliberate stages and correct explanatory labels. Maintain **two transparent modes**:

1. **Emergent simulation:** Result comes from global/local natural process model; outcome not predetermined.
2. **Guided process model:** High-resolution local geometry illustrates a curriculum sequence; clearly marked as a controlled demonstration, not claimed to have spontaneously formed in global physics.

Never compromise geography for theatrics. Labels may be toggled, removed for prediction, or revealed stepwise. Projector-friendly typography and high contrast; aim for readable paragraphs around 18–20 pt in presentation mode as appropriate to display size.

## G2. Curriculum modules

**Rivers:** drainage basin, erosion types and transport, V-shaped valley/interlocking spurs, waterfall/gorge, meanders/river cliff/slip-off slope, oxbow lake, floodplain/levee, deltas, flooding.

**Coasts:** hydraulic action, abrasion, attrition, solution where relevant; hard/soft rock differential erosion; headlands/bays; wave refraction; wave-cut notch/platform; cave/arch/stack/stump; longshore drift; spits, recurved ends, bars, lagoons, tombolos; rotational slumping and cliff retreat.

**Tectonics:** constructive/divergent, destructive/subductive, continental collision including fold mountains, conservative/transform, volcanoes (shield/composite in simplified context), earthquakes, mantle convection schematic.

**Glaciation:** freeze-thaw, corrie, arête, pyramidal peak, U-shaped valley, truncated spurs, hanging valleys, moraine and glacier retreat.

## G3. Teaching sequence contract

Each lesson includes:

- Learning objective and initial 3D landscape.
- Relevant controls or selected variables.
- Clear physical/process sequence.
- Play/Pause/Previous stage/Next stage/Reset, with actual state or guided geometry transition.
- Labels, arrows, annotations attached to actual locations.
- Top-down/oblique/cross-section camera.
- "Show answer" and hide-label options.
- KS3 explanation and stronger GCSE explanation using accurate terminology.
- Optional exam question, model explanation and one misconception check.

**Examples of guided correctness:**

- Waterfall: differentiated bedrock → undercut → unsupported cap collapse → retreat → gorge.
- Meander: faster outer flow/lateral erosion + reduced inner-bank energy/deposition; progressive neck and eventual cutoff.
- Cave/arch/stack/stump: joint enlarged to cave, arch break-through, roof collapse, isolated stack, reduced stump. Actual visible 3D hole.
- Spit: oblique waves, net alongshore transport, sediment accumulates in sheltered water, continuous attached sand ridge grows.
- Slumping: saturated cohesive cliff, curved slip plane, backwards rotating block, scarp and toe.
- Collision: compressive shortening and folding/uplift; distinguish subduction.

## G4. Classroom mode

Full-screen clean mode; hide tools/legends selectively; large buttons and prominent labels; easy scenario reset; bookmarks/teacher presets; cross-sectional overlay; before/after split view; optional narrated text/captions (not necessarily speech synthesis in initial release). No required internet connection for saved content.

## G5. Curriculum validation

Review against age level, accepted diagrams and exam-language; distinguish simplifications, avoid overclaiming universal mechanisms. Physical model and labels must agree. Scenario review checklist includes geometry, directions, timing, terminology, misconceptions, readability and accurate cause-effect sequence. Include at least one review/test fixture per module before marking it complete.

---

# H. SAVE, LOAD, EXPORT AND SHARING

- Persist world settings, seed, size, cell scale, bedrock/materials/sediment/water/climate, sim time, checkpoints and camera separately as appropriate.
- IndexedDB auto/manual slots, named worlds, storage quota awareness; save-version schema and migration handling; handle interrupted writes.
- Export an actual documented compressed project file or equivalent with metadata and numeric arrays, plus a matching importer; verify round-trip.
- Export heightmap PNG (prefer 16-bit if technically validated), numeric elevation data with units, water/erosion overlays, topographic image and screenshot.
- Later glTF/GLB mesh export, video capture (browser/codec compatibility disclosed), Minecraft-compatible terrain conversion **only after implemented and tested with a target version**.
- Netlify static build must work with direct navigation, assets and browser security constraints. Where possible, provide deployment-ready ZIP, with files actually created and build verified.
- Optional school lesson presets export/import as JSON or small archive, versioned and shareable without a backend.

---

# I. SCIENTIFIC, VISUAL AND SOFTWARE ACCEPTANCE TESTS

## I1. Physics correctness is non-negotiable

Hydrology: closed-box water mass approximately conserved; downhill flow on slope; depression filling and saddle overflow; nonnegative depths; source and sink accounts; frame rate independent.

Sediment: erosion subtracts from surface layer; mobile sediment increases appropriately; deposition adds thickness/elevation; ledger includes exported sediment; material sensitivity; no unphysical explosive peaks.

Terrain: reproducible generated seed; physical brush edits persist and render; normals/mesh bounds update; undo/redo correct; no cracks across chunks.

Geology: material layers not negative; exposure on erosion; hard/soft comparison shows expected tendencies.

Climate/ice/ecology: rainfall reaches hydrology, meltwater accounted for, ice mass bounded, vegetation suitability responds gradually.

Tectonics/lava: fault displacement persists; uplift changes drainage; solidified lava contributes to land height and subsequent geology.

Coasts: wave influence linked to angle/material, sea-level changes shoreline, sediment ridge built from sediment, not prepackaged sprite.

Persistence: world save/reload matches numeric fields within documented precision and simulation can continue.

## I2. Visual validation

Representative scenarios should be captured in screenshots where available: large river network, eroded mountain, delta, low coast, volcanic island, glaciated valley. Check geometry silhouettes, water elevation, flicker, normals, texture repetition, camera controls, label legibility and smooth animation. A code-level test cannot prove visual quality. **If no browser/screenshot access exists, explicitly report unverified visual quality rather than guessing.**

## I3. Performance tests

Profile 128 and 256 grids first; inspect dropped frames and solver time, 512 only when stable. Check memory before/after repeated world generation, world loading, long simulation and editor strokes. Include fallbacks for unsupported GPU APIs. Never equate having an M4 CPU with guaranteed support for a Windows OpenGL desktop game.

## I4. User-facing honesty

Every enabled control must be connected to working behaviour. Distinguish:

- **Implemented** — source exists.
- **Unit tested** — numerical tests passed.
- **Integrated** — works with world and UI.
- **Visually verified** — observed via actual browser capture/run.
- **Planned** — not functional and should not be shown as working.

Only call a milestone complete when defined tests are passed and defects recorded.

---

# J. EXECUTION ROADMAP: SMALL CHUNKS AND DEPENDENCIES

The following is the initial backlog. The coding AI may split a chunk further if needed, but should **not combine multiple chunks simply to claim faster progress**. Complete and commit in order unless a dependency requires adjustment.

**Legend:** `M` = milestone, `C` = incremental chunk. A milestone is complete only after its integration/demo chunk is verified.

| ID | Outcome / minimum check | Depends on |
|---|---|---|
| M00-C01 | Inspect existing repo, initialise tooling, TypeScript, Vite, tests, git and continuity files; `npm run build` passes | None |
| M00-C02 | App shell, empty Three scene/canvas, resize handling, basic status; visible browser render | C01 |
| M01-C01 | WorldState contract, SI-unit coordinate convention, deterministic seed/heightfield test | M00 |
| M01-C02 | Procedural hills, valleys, mountains; smooth mesh, height/slope colours | C01 |
| M01-C03 | Orbit/pan/zoom/top-down and Mac trackpad input; no control conflicts | C02 |
| M01-C04 | Raise/lower terrain with radius, falloff and efficient dirty-region mesh updates | C03 |
| M01-C05 | Smooth/flatten/material paint; undo/redo; editor tests | C04 |
| M01-C06 | New World presets + reproducibility + save/reload terrain + first polished UI | C05 |
| M01-C07 | Browser review, visual fixes, responsive performance, clean Netlify production build | C06 |
| M02-C01 | Water field, rainfall sources, fixed simulation clock, water mass ledger | M01 |
| M02-C02 | Conservative water-flux solver, downhill flow/depression tests | C01 |
| M02-C03 | Ponding, spillover, outlet boundaries and source/sink controls | C02 |
| M02-C04 | Water mesh/material tied to actual depth/flow; calm lakes, moving streams | C03 |
| M02-C05 | Rain brush + Play/Pause/Step/Speed; debug overlay for depths and velocity | C04 |
| M02-C06 | Working mountain-rainfall-river preset, mass tests, performance/visual fixes | C05 |
| M03-C01 | Bedrock + loose sediment layer and material property registry | M02 |
| M03-C02 | Sediment inventory, transport capacity/flux, ledger tests | C01 |
| M03-C03 | Erosion removes available material based on water and rock resistance | C02 |
| M03-C04 | Deposition updates surface elevation, routing and dirty terrain mesh | C03 |
| M03-C05 | Stable flow/erosion integration; no NaN, drift, spikes; diagnostic overlays | C04 |
| M03-C06 | End-to-end rainfall → incision → sediment → delta/lowland demo, profile and save/reload | C05 |
| M04-C01 | Layered geology/material paint, exposure after erosion, visual stratification | M03 |
| M04-C02 | Weathering + mass-conserving hillslope creep | C01 |
| M04-C03 | Saturation/stability and a basic real landslide event | C02 |
| M04-C04 | Local curved-slip rotational slump prototype + 3D view and tests | C03 |
| M05-C01 | Shoreline identification, controllable sea level, realistic visual ocean | M03 |
| M05-C02 | Wave energy/incidence and geology-dependent coastal retreat model | C01 |
| M05-C03 | Alongshore sediment movement and accumulating connected beach/spit ridge | C02 |
| M05-C04 | Bar/lagoon/tombolo parameterised scenarios and mass checks | C03 |
| M05-C05 | Local solid geometry engine proof: cave and true opening/arch with controls | C04 |
| M05-C06 | Stack/stump, cliff slump, wave-cut features and classroom scenarios | C05 |
| M06-C01 | Temperature, seasonal phase, lapse rate, spatial rainfall and evaporation | M02 |
| M06-C02 | Snow mass balance, meltwater coupling | C01 |
| M06-C03 | Basic glacier thickness/downslope flow and glacial erosion | C02 |
| M06-C04 | Vegetation suitability/growth, instanced rendering and erosion modifier | C03 |
| M06-C05 | Biome presets, wet/dry and warm/cold comparisons | C04 |
| M07-C01 | Kinematic plates, movement directions, uplift/subsidence, cross-section | M04 |
| M07-C02 | Divergent/transform and persistent surface fault offsets | C01 |
| M07-C03 | Oceanic subduction and volcanic arc conceptual scene | C02 |
| M07-C04 | Continental collision with folding/uplift guided solid geometry | C03 |
| M07-C05 | Fault earthquake event and deformation/landform coupling | C04 |
| M08-C01 | Vent creation, lava field and gravity-driven movement | M07 |
| M08-C02 | Cooling and new permanent volcanic rock terrain | C01 |
| M08-C03 | Shield/composite differentiated deposit models and optional plumes | C02 |
| M08-C04 | Underwater volcanic island preset, caldera event and erosion integration | C03 |
| M09-C01 | Data inspector, real measurements and elevation transect | M03 |
| M09-C02 | Scientific overlay maps and proper legends/units | C01 |
| M09-C03 | Checkpoints, before/after comparison and differential maps | C02 |
| M09-C04 | Scenario/challenge evaluation from actual world metrics | C03 |
| M10-C01 | Education Mode shell, labels, full-screen classroom UI, step controller | M09 |
| M10-C02 | River guided process lessons: waterfall and meander/oxbow | C01 |
| M10-C03 | Coastal guided lessons: erosion sequence and deposition | C02 |
| M10-C04 | Tectonic guided lessons, volcanic and glacial process explanations | C03 |
| M10-C05 | Student/teacher presets, KS3/GCSE language review and projection QA | C04 |
| M11-C01 | Flood/tsunami scenarios with honest water-model limits | M09 |
| M11-C02 | Meteor, drought, landslide/earthquake event comparisons | C01 |
| M11-C03 | Export image/maps/heightmap/project files and test each format | C02 |
| M11-C04 | Final accessibility, performance, saving, browser and deployment QA | C03 |

**Priority adjustment:** If a classroom-specific process is critical before full global tectonics or ecology, the local guided teaching system may be implemented earlier, **provided** it is clearly separated from emergent physics and the M02/M03 foundation is stable. Do not stall the entire project by demanding complete geology for a simple waterfall teaching model.

## J1. Small test fixtures to create alongside development

- `slope-water`: plane with single upstream source and open outlet.
- `bowl-overflow`: basin with a saddle to test filling/spillage.
- `river-catchment`: ridged seeded terrain and rainfall.
- `two-rocks`: identical water forcing, differing erodibility.
- `sediment-fan`: narrow upstream channel entering flat basin.
- `delta-mouth`: river to static ocean with controlled sediment input.
- `cliff-failure`: saturated slope with configured stability threshold.
- `coastal-sediment`: oblique forcing on a barrier and sheltered bay.
- `glacial-trough`: snow/ice accumulation over an upland valley.
- `volcanic-island`: underwater vent and cooling deposit.

Each fixture should have at least one numerical assertion and an in-app preset once its module ships.

---

# K. DEFINITION OF DONE: NO HOLLOW DEMOS

A chunk is **DONE** only when:

1. Behaviour works and is accessible in the application or as a tested engine primitive intended for the immediate following chunk.
2. Specific acceptance criteria are passed or explicitly documented as failing.
3. Existing tests are not silently broken; any expected change is reflected in fixtures.
4. Types/build checks pass when executable.
5. Visible controls operate; no fake “simulation running” if nothing updates.
6. Project runs on target platform/build chain (or untested platform is clearly noted).
7. Current files and docs are preserved; changed files are committed if git is available.
8. Continuity files are updated so a new agent can continue *without reconstructing the conversation*.

A milestone is **DONE** only when its representative end-to-end scenario works, is saveable/reloadable and has at least one meaningful visual validation (when graphical tools are available).

**Explicit anti-patterns:** giant monolithic `App.tsx`; randomly moving coloured pixels pretending to be sediment; lava that is only particles; all-water terrain turning blue with no simulated depth; grid staircases; instant premade landforms described as emergent; buttons wired only to a label; claims of browser verification without opening the browser; arch texture masquerading as an opening; no saved world state; unreadable educational labels.

---

# L. FIRST BUILD — EXACT INITIAL TASK

Once the repository is inspected and bootstrap/continuity files exist, begin `M00-C01` and `M00-C02`. Establish the tested app shell and working 3D viewport, then move to a **smooth, seeded, editable landscape**, without implementing hydrology prematurely.

### First functional demonstration must allow the user to:

1. Open the browser app on the Mac.
2. Create a mountain/river-basin world from a reproducible preset.
3. Orbit, pan, zoom and view top down.
4. Raise and smooth part of the terrain with cursor brushes.
5. Undo that edit.
6. Save and reload the world.
7. View an attractive, continuous, responsive 3D landscape.
8. Run a production build intended for Netlify.

The next release adds actual rainfall and downhill water flow. The release after that adds erosion, sediment transport and deposition. **Do not spend early chunks on animals, cinematic menus, elaborate particle shaders or advanced tectonic geometry while these foundational behaviours are missing.**

---

# M. READY-TO-USE FIRST MESSAGE, RESUME MESSAGE AND QUALITY REVIEW

## M1. Initial AI build message (copy into the coding AI alongside this file)

```text
You are building Terra Genesis from the attached MASTER_BUILD_SPEC.md.
This is a real code project, not a mockup. Read the file's Part A operating
protocol and follow the roadmap. Place the full spec in docs/MASTER_SPEC.md.
Create short continuity files (AGENTS.md, PROJECT_STATE.md, NEXT_TASK.md,
BACKLOG.md, DECISIONS.md, TEST_RESULTS.md, CHANGELOG.md) before doing much coding.

Build in one small, tested, committable chunk at a time and leave the app runnable.
Preserve earlier work. Do not generate the entire planned game at once.
Implement M00-C01 and then the smallest next chunk feasible in this session.
Run actual tests/build. Update continuity files and commit when possible.

Never reread the full master spec at a fresh session. Read only the short
handoff docs, git status, relevant code and necessary master-spec section.
Do not show fake, unconnected controls. Do not claim files/tests you did not make.
Use concise progress reporting and put your effort into implementation.
```

## M2. Resume prompt after any usage limit / new chat (copy this, not the entire master spec)

```text
Continue Terra Genesis from the existing code. DO NOT START AGAIN.

1. Read AGENTS.md, docs/PROJECT_STATE.md and docs/NEXT_TASK.md only.
2. Check git status, last commits and the relevant source files/tests.
3. If changes are unfinished, inspect and finish the current chunk.
4. Consult only the relevant heading in docs/MASTER_SPEC.md if needed.
5. Implement the next small slice, run tests/build, commit, update handoff docs.
6. End with the standard short handoff. Minimise explanation and context use.
```

## M3. When the coding AI drifts into mockups instead of physics

```text
Stop adding visual-only controls or disconnected animations. Audit the currently
selected feature against the Definition of Done in docs/MASTER_SPEC.md.
Demonstrate which authoritative WorldState fields change, which numerical
update produces the change, which tests validate it and what the player sees.
Implement the smallest missing physical link, test it and checkpoint the result.
Do not rewrite unrelated working systems.
```

## M4. When graphics look blocky or inaccurate

```text
Keep the current simulation model and improve the RENDERING and relevant
local-geometry representation without resetting physics. Identify exactly
whether the defect comes from low physical resolution, mesh interpolation,
material shading, camera, missing 3D overhang geometry, or a bad numerical
algorithm. Apply a focused repair, compare screenshots under an identical seed,
and retain numerical regression tests. Do not replace an incorrect landform with
an unrelated decorative animation.
```

## M5. When an AI claims a milestone is complete prematurely

```text
Show the actual acceptance check for this chunk: source paths, observable
world-state change, test command and result, build result and (if available)
browser screenshot/interaction evidence. If any requirement is missing, mark
the chunk IN_PROGRESS and finish that exact missing behaviour before proceeding.
Update docs/PROJECT_STATE.md and docs/NEXT_TASK.md accordingly.
```

---

# N. FINAL GUIDANCE TO THE BUILD AGENT

The most important priority order is:

1. Original, smooth, editable 3D terrain that actually works.
2. Stable, conservative water movement.
3. Erosion, material transport and deposition that permanently reshape the world.
4. Attractive rendering that reflects real simulation fields.
5. Geological materials and feedback with erosion.
6. Targeted local 3D geometry for complex landforms a heightfield cannot express.
7. Climate, glaciers, vegetation, coastal processes and tectonics.
8. Polish, experiments, education modules and optional advanced features.

Treat this document as a **complete product vision and technical reference**, not as a demand to implement everything simultaneously. A feature is not complete because an interface control exists. Build and test one slice at a time.

**Continuity is part of engineering quality.** At every checkpoint, leave such clear short state that a new coding model with no prior chat context can pick up the codebase, identify the active chunk, run the relevant tests and continue without a lengthy rediscovery exercise. The repository, compact handoff files and verifiable tests are the project's memory. The original long prompt should not be recopied every time.

**Final product ambition:** a visually sophisticated original landscape simulation in which the player's environmental interventions produce believable, persistent, interconnected changes, supplemented by optional geographically rigorous UK classroom models.
