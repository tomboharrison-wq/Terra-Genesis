# One next executable task
M13-C01..C05 done (geological time; V-valley, waterfall, meanders/oxbow/floodplain lessons; classroom mode).
Suggested next: M13-C06 — glaciers in geological time (corries, arêtes, U-shaped troughs over 10⁴–10⁵ years with
measured labels), then coasts in geological time (headlands & bays from alternating rock bands, wave-cut
platforms). Read only: src/sim/glacier/glacierSim.ts, src/sim/geology/run.ts, src/education/lessons/riverGeologic.ts
(lesson pattern), tests/geo-lessons.test.ts. Keep the existing glacier tests passing; drive the glacier model on the
geological clock instead of water time; add a lesson + tests like the river ones.
Real-Mac performance check still outstanding (needs the user's Mac).
Done when: tests/typecheck/build/e2e pass, committed + pushed.
