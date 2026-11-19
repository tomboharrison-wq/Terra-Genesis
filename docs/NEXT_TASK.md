# One next executable task

M20 is complete and verified:
- Coupled 3D solid voxel patches (`embeddedWaterfall` and `embeddedHeadland`) run inside ordinary heightfield worlds as well as the dedicated 1-metre M19 worlds (`solidWaterfall`, `solidHeadland`) and 4-metre levee world (`live-levees`).
- Universal Live GCSE Landform & Process Detector (`src/education/liveDetector.ts`) and floating `LiveLandformHud` (`src/app/LiveLandformHud.tsx`) continuously detect, measure, pin 3D labels, and focus the 3D camera on emerging GCSE landforms in both Water Time and Geological Time.
- All 17 GCSE landform groups in `LandformShow` (`src/education/landforms/content.ts`), `LessonsDialog`, and `NewWorldDialog` support one-click continuous live 3D formation (`startLessonLive`).
