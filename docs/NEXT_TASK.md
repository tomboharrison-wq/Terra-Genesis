# One next executable task
M14 hydrology trust is implemented: bounded float32 drift reconciliation, explicit GPU→CPU flushes before
save/export, persistent groundwater storage with recharge, conservative lateral Darcy exchange and baseflow,
CPU fallback while the aquifer is enabled, groundwater overlay, and TGW format v12 migration.

Release gate: full tests, typecheck, production build, GPU self-test and e2e; then commit and push to `main`.
