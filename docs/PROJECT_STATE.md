# Project state
Updated: 2026-10-22, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M05 — Coasts (C01–C03 done)
Current chunk: M05-C04 — bar / lagoon / tombolo scenarios + mass checks
Status: READY

Verified working:
- M01 terrain · M02 water (CPU ref + GPU) · M03 erosion/deposition · M04 strata, weathering, slope failure,
  landslide tool, rotational slump lab (guided 2D).
- M05-C01 sea level: Engine.setSeaLevel floods/exposes land (sea mask, GPU uniform, renderer, skirts).
- M05-C02 waves (src/sim/coast/coastSim.ts, CPU, 600 s cadence via Engine.coastHook): P₀ = ρg²H²T/64π,
  incidence (refraction-softened), shelter ray (×0.1), foreshore attenuation (≥0.2), lithology erodibility;
  cliff cells lowered to a platform at sea−0.3H, debris laid offshore below breaking depth; rockfall does
  the collapse. Wave-attack map overlay.
- M05-C03 longshore drift: CERC-like Q ∝ H^2.5·sin2α in surf cells, Jacobi transfers, spits seed at coast ends.
- Generation settles slopes to dry stability (src/terrain/settle.ts) → worlds start in equilibrium.
- Headlands preset: straight coast across chalk/clay bands, waves from S, ×1000: clay bays retreat 2–3 cells
  vs chalk headlands in 4 accelerated days (96² CPU run).

Known failures / gaps:
- Real M4 GPU speed unmeasured. Coastal processes are CPU-only (fine at 600 s cadence).
- No refraction field; bays develop slowly at default rates; drift total is a summed transfer figure.
- Caves/arches/stacks need the local 3D model (M05-C05). Inland cells below sea level count as sea.

Relevant paths: src/sim/coast/{coastSim,params}.ts, src/engine/engine.ts (setSeaLevel, coastHook),
src/app/CoastPanel.tsx, src/terrain/{settle,generate}.ts, src/renderer/TerrainScene.ts ('waves' overlay)
Last checks: typecheck PASS · npm test PASS (109) · build PASS · e2e (see TEST_RESULTS) · gpu-check 7/7 (M04)
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
