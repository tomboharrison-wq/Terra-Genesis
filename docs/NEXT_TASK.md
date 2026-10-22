# One next executable task
ID: M06-C03
Goal: Glaciers (spec E8). Ice thickness field (m, format v7). Snowpack older than a season / deeper than a
threshold converts to ice (firn); ice flows by a shallow-ice approximation: flux q = −(2A/(n+2))(ρg)^n H^{n+2}
|∇s|^{n−1}∇s (n = 3, A ≈ 2.4e-24 Pa⁻³ s⁻¹) on the surface s = bed + ice, explicit with a diffusive CFL; melt
(degree-day) at the margins returns water to hydrology. Glacial erosion: bed lowering = K_g · sliding speed
(abrasion), with geomorphic speedup, debris to loose sediment at the snout. Ice rendering; ice volume ledger.
Read only: spec E8, src/sim/climate/climate.ts, waterSim snow code, sedimentSim erosion bookkeeping.
Acceptance: ice slab on a slope flows downhill conserving volume; equilibrium-line behaviour (accumulates above,
melts below); U-shaped cross-valley profile emerges from a V under long glacial erosion (guided test); water+ice
ledger closes; CPU first (GPU later chunk if needed for speed).
Done when: tests/typecheck/build/e2e pass, committed + pushed.
