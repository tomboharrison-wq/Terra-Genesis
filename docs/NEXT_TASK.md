# One next executable task
ID: M09-C02
Goal: Scientific overlay maps with proper legends and units (spec F4: "Maps and legends with units: elevation,
slope, aspect, watershed/flow accumulation, water depth and velocity, sediment concentration, erosion vs
deposition, geology, rainfall, temperature, soil moisture, ice, vegetation and deformation. Only enable when
backing data exists."). Audit existing overlays (TerrainScene terrainOverlay: change, waves, temperature, rainfall,
compare, plates, shaking; water views depth/speed) and add the missing ones that have backing data: elevation
(hypsometric, sea-aware), slope (°), aspect (8 compass sectors, cyclic palette), flow accumulation (D8 upstream
area, log scale), geology (exposed rock), ice thickness, plant cover, ash depth. One overlay menu with grouped
entries; each with a legend (units, scale, colour ramp from validated palettes) and an inspector line for the
overlay value at the cursor. Overlays absent where there is no data (e.g. ice when none).
Read only: TerrainScene overlay code + TimeBar legends, renderer/palette.ts, dataviz palette rules.
Acceptance: unit tests for flow accumulation (D8 on a known surface), aspect sectors, legend ranges;
e2e switches each overlay and checks pixels change; no overlay shown without data.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
