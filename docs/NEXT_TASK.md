# One next executable task
M13-C01..C06 done (geological time; river lessons ×3; glaciated upland; classroom mode).
Suggested next: M13-C08 — coasts in geological time: headlands & bays from alternating hard/soft rock bands,
cliff retreat and wave-cut platforms over 10³–10⁴ years, with a lesson and measured labels like the river ones.
Read only: src/sim/coast/coastSim.ts, src/sim/geology/run.ts, src/education/lessons/riverGeologic.ts (lesson
pattern), tests/geo-lessons.test.ts. Drive the coast model on the geological clock (quasi-steady waves, scaled
retreat, as runGlacial does for ice); keep existing coast tests passing.
Real-Mac performance check still outstanding (needs the user's Mac).
Done when: tests/typecheck/build/e2e pass, committed + pushed.
