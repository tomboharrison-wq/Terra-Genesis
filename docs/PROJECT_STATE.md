# Project state
Updated: 2026-11-18, M19 live landscape landforms
Branch: codex/m19-live-landforms. Remote: github.com/tomboharrison-wq/Terra-Genesis.
GitHub main verified at c7dce87 before starting M19.
Current milestone: M19 real main-world landforms (IN PROGRESS).
Current chunk: C02 waterfall and levees implemented; release validation and publication next.

M19-C01:
- New live-headland lesson runs numerical solid rock in the main TerrainScene, without a second canvas or staged meshes.
- Wave damage, weaker joint, unsupported-span/connectivity collapse; stages detected from surviving topology.
- Saves, checkpoints, lesson Previous/Next and worker replay preserve solid, damage and fractional time. Format v13.
- Removed cumulative-wave-damage cave/arch claims from ordinary heightfields.
- Implemented coastal controls only in the dedicated 48 × 40 m solid world. Bedrock is a derived top envelope, not its rock volume. Sea renders through openings.
- Limits: illustrative process years; debris ledgered as export; static sea surface; no arbitrary-world solid patches.
- Focused tests and Chrome worker/lesson checks pass. Coastal stages and saved Previous/Next states verified.

M19-C02:
- Dedicated live-waterfall world removes real weak-rock voxels, scours a pool, collapses unsupported cap rock and retreats through fixed banks, leaving a gorge.
- Main-scene river surface uses discharge, a normal-depth estimate and a gravity-driven falling jet. This is quasi-steady flow, not turbulent CFD.
- Live discharge, cap support, erosion and resistance controls; zero discharge pauses erosion. Fixed process-time lesson stages never select rock shapes.
- Solid snapshots travel through workers, saves and replay. Exports that cannot represent voids are unavailable in solid worlds.
- New 4 m floodplain lesson builds levees from conserved overbank sediment. Its cross-section samples actual ground; river is fixed and sediment has one class.
- Main solid rendering emits exposed faces only; compact labels and closer cameras make landforms visible.

Existing M18:
- CPU reference and GPU water, sediment conservation, strata, weathering and slope failure.
- Geological landscape evolution: real incision, waterfall knickpoint retreat/gorge, meanders/oxbows, overbank levees, transport deposition, glacial and coastal coupling.
- Heightfield coastal erosion, shelter, lithology, beaches/platforms and longshore drift; shoreline lab moves conserved world sediment.
- Climate, snow/glaciers/moraines, plants/biomes, plates, quakes, volcanoes, hazards.
- Sculpt brushes, undo/redo, measurements/profiles, snapshots, comparison, saves/exports, classroom lessons/evidence.
- Guided waterfall/slump/arch/shoreline models and labelled animated textbook diagrams remain separate teaching tools.
- Natural terrain shaders, water, clouds, quality controls, camera modes, vertical exaggeration and optional audio.
- M18 baseline: 318 tests, strict build, Chrome GPU parity 12/12 and focused browser checks passed.
- M18 deployed to GitHub Pages, Cloudflare Pages and existing terra-genesis Worker. Worker direct deployment is not Git Builds connected.

Known gaps:
- Groundwater uses CPU fallback. No lithospheric isostasy.
- Ordinary coarse waterfall worlds remain heightfields. Literal overhangs and resolved pools use the dedicated one-metre waterfall world.
- Solid headland is a dedicated domain; ordinary heightfields cannot contain caves.
- User duplicate files ending " 2.*" and an unrelated PDF are untracked. Preserve them.
- Build in a clean snapshot excluding duplicates because src/main 2.tsx is included by tsc.

Next: finish validation, commit and deploy M19. Worker publishing remains a direct deployment.
