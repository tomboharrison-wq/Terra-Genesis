# One next executable task
ID: M08-C03
Goal: Shield vs composite volcanoes (spec E10 "avoid identical or pyramid cones"). Demonstrate, with the existing
lava + tephra physics, that long-lived basalt lava-only eruptions build broad low shields (flank slopes a few °)
and alternating andesite lava + explosive phases build steeper concave composite cones (≈ 15–35° near the top,
gentler apron). Add: vent "episodes" (a vent erupts repeatedly: N episodes with rest gaps, alternating style for
'composite'), vent elevation follows the growing summit (vent cell stays the crater: small crater depression
from explosive phases), and a quick "build volcano" action that runs episodes in accelerated time with progress
(time compression labelled). Profile tool shows the cone; tests measure flank slope and concavity
(height–radius profile not a straight pyramid). Read only: lavaSim.ts, tephra.ts, engine lavaHook, VolcanoPanel.
Acceptance: shield mean flank slope < 8°; composite upper flank > 15° and profile concave up; ledgers close.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
