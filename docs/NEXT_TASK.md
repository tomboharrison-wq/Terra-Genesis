# One next executable task
ID: M09-C01
Goal: Data inspector, real measurements and elevation transect (spec M09-C01; read SPEC_INDEX for the M09 /
data-tools sections only). Audit what the hover inspector + Profile tool already give (StatusBar inspect,
ProfilePanel). Add what is missing for fieldwork-style measurement: click-to-pin points (A/B…) with a table of
real values (elevation, slope, aspect, rock, soil, water depth/speed, flux, temperature, rain, plants, ash, lava);
distance/bearing/height difference between pins; transect chart with labelled axes + units, vertical
exaggeration shown, layers (bedrock/soil/water/ice/lava) and CSV export of the transect samples.
Every number must come from authoritative state (no estimates). Keyboard accessible.
Read only: src/app/StatusBar.tsx, ProfilePanel.tsx, Viewport.tsx hoverFrom, uiStore HoverInfo.
Acceptance: pinned values equal world arrays at those cells; transect samples equal bilinear surface; CSV
round-trips; e2e pins two points and checks the distance.
Done when: tests/typecheck/build/e2e pass, committed + pushed.
