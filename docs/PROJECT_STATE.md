# Project state
Updated: 2026-10-22, session 1 (cont.)
Branch / HEAD: main / see `git log -1` · remote: github.com/tomboharrison-wq/Terra-Genesis (pushed)
Current milestone: M05 — Coasts (C01–C03 done, C04 partial)
Current chunk: M05-C05 — local 3D cave → arch → stack → stump guided model
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
- M05-C04 (partial): ray-fan wave field (diffraction/shelter proxy), onshore shelf transport (shore ahead),
  surf-zone smoothing. Tombolo/salient emerges in an island's lee (test). Beach-face drift (swash zone mobile, never into
  open water, straight-ahead tip rule) grows emergent attached spits from coast ends (test).
- M05-C05 cave→arch→stack→stump lab (src/local/arch/model.ts, src/app/ArchLab.tsx, Coast panel button): 48×40×30 m
  voxel chalk headland with a joint; wave BFS energy (caves attenuate, surge rises inside, bays ×0.15), weathering,
  unsupported rock falls; stages detected from topology (monotone). Default run: cave 6 → arch 45 → stack 87 → stump 388.
- M05-C06a coastal slump cycle (src/local/slump/coastal.ts; slump lab "Coastal cycle" mode): toe-debris apron in the
  FoS ground profile, waves strip debris then cut the toe, repeat slumps; FoS timeline chart.
- Generation settles slopes to dry stability (src/terrain/settle.ts) → worlds start in equilibrium.
- Headlands preset: straight coast across chalk/clay bands, waves from S, ×1000: clay bays retreat 2–3 cells
  vs chalk headlands in 4 accelerated days (96² CPU run).

Known failures / gaps:
- Real M4 GPU speed unmeasured. Coastal processes are CPU-only (fine at 600 s cadence).
- Bay-mouth bars enclosing lagoons and clean recurves NOT reliable with grid drift (spits angle offshore under
  high-angle waves); a one-line shoreline model is the planned fix (backlog M05-C04b).
- No depth refraction; bays develop slowly at default rates; drift total is a summed transfer figure.
- Arch lab is not yet driven by the world's wave climate/lithology (M05-C06). Inland cells below sea level count as sea.

Relevant paths: src/sim/coast/{coastSim,params}.ts, src/engine/engine.ts (setSeaLevel, coastHook),
src/app/CoastPanel.tsx, src/terrain/{settle,generate}.ts, src/renderer/TerrainScene.ts ('waves' overlay)
Last checks: typecheck PASS · npm test PASS (120) · build PASS · e2e PASS 24/24 · gpu-check 7/7 (M04)
Uncommitted changes: none
Next: read docs/NEXT_TASK.md; do not reread docs/MASTER_SPEC.md
