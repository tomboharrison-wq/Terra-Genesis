# One next executable task
ID: M06-C02
Goal: Snow (spec E8 first part). Per-cell snow water equivalent field (m, SI) in WorldState (format v6):
precipitation falls as snow where climate temperature < 0 °C (rain factor still applies), melts by a degree-day
law M = DDF·max(0, T)·dt (DDF ≈ 4 mm/°C/day) into surface water; snow ledger (fallen, melted, stored) tied to the
water ledger (snow is water in storage). CPU reference + GPU pass (snow in a texture channel). Snow cover rendered
white on terrain from real SWE; inspector shows SWE; Climate panel shows snow volume + snowline.
Read only: src/sim/climate/climate.ts, src/sim/water/{waterSim,gpuWater}.ts forcing, src/renderer/TerrainScene.ts colours.
Acceptance: cold cells accumulate, warm cells rain; melt returns exactly the stored SWE; combined water+snow ledger
closes CPU and GPU (gpu-check case); seasonal cycle builds then melts a snowpack; old files load with no snow.
Done when: tests/typecheck/build/e2e/gpu-check pass, committed + pushed.
