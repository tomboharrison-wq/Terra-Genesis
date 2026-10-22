# One next executable task
ID: M06-C04
Goal: Vegetation (spec E7/E8 neighbours; Part J M06-C04). Per-cell vegetation cover fraction (0–1, format v8)
growing towards a suitability set by temperature (growing season above ~5 °C), water availability (rain
factor × map rain, standing water, not under snow/ice/sea) and slope/soil (needs loose sediment); logistic
growth / dieback on a slow cadence in geomorphic time. Vegetation reduces erosion (erodeK × (1 − 0.8·cover))
and rain-splash weathering, and is rendered: greener terrain colour + instanced trees/shrubs where cover is
high (InstancedMesh, density from cover, deterministic placement). Inspector + panel readouts, overlay.
Read only: src/sim/climate/climate.ts, src/sim/sediment/sedimentSim.ts (erodeK use), gpuWater sediment pass
(uniform → texture factor), TerrainScene colours.
Acceptance: cover grows where warm + wet, absent above the treeline / on bare rock / under ice; erosion lower
under vegetation (CPU + GPU test); old files load bare; instanced trees match cover.
Done when: tests/typecheck/build/e2e/gpu-check pass, committed + pushed.
