# One next executable task
ID: M11-C02
Goal: Meteor impact, drought and event comparison (spec E12). Meteor: click the map; impactor diameter (m) and
speed → transient crater by pi-scaling (Holsapple; D ≈ 1.161 (ρi/ρt)^⅓ L^0.78 v^0.44 g^-0.22, simple crater
depth ≈ D/5, rim uplift + ejecta blanket thinning as (r/R)^-3 so excavated volume = rim + ejecta volume exactly);
undoable as one edit (StrokeRecorder), strata disturbed (ejecta = loose 'breccia'), shaking overlay reuse; event
log entry. Drought: rain off and evaporation × k for N days via the same HazardEvent clock (hazards.ts);
records the lowest water per cell (lakes and rivers shrinking) → 'drought' overlay + summary. Comparison:
table of logged events (area flooded / dried, volumes) in the Floods panel, renamed "Events".
Read only: src/sim/events/hazards.ts, engine hazard section, HazardsPanel.tsx, sim/tectonics/earthquake.ts (undo).
Acceptance: crater volume balance closes; crater size scales as the pi-scaling law in tests; drought record ≤
every depth during it; ledgers close; e2e makes a crater and runs a short drought.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
