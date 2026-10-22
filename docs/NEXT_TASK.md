# One next executable task
ID: M06-C01
Goal: Climate layer (spec E7): world climate params (mean sea-level temperature, lapse rate °C/km, seasonal
amplitude + season phase, prevailing wind direction, moisture). Derived per-cell fields: temperature
T = T0 − lapse·z + seasonal term; rainfall = base × (1 + orographic uplift on windward slopes) with leeward
rain-shadow decay along the wind; evaporation scales with temperature. Rain/evap feed the existing water
forcing + ledger (replace the uniform rate when "climate" is on). Climate panel + temperature/rainfall overlays.
Read only: spec E7 (`sed -n '/^## E7/,/^## E8/p' docs/MASTER_SPEC.md`), src/sim/water/waterSim.ts forcing,
src/engine/world.ts params, src/app/WaterPanel.tsx.
Acceptance: windward > leeward rainfall over a ridge; T falls with height at the lapse rate; water ledger closes
with spatial rain; uniform mode unchanged; season changes T; save format bump with migration.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
