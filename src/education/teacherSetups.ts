import type { PresetId } from '../terrain/generate';

/**
 * M17-C03: Teacher Lesson Mode — 7 deterministic, fixed-seed one-click classroom setups.
 * Every student/projector launching a setup gets the exact same initial terrain, seed, and forcing,
 * paired with learning objectives, timings, instructions, and expected measured outcomes.
 */

export interface TeacherLessonSetup {
  id:
    | 'teacher-meanders-oxbow'
    | 'teacher-floodplains-levees'
    | 'teacher-coastal-geology'
    | 'teacher-headlands-bays'
    | 'teacher-glacial-erosion'
    | 'teacher-weathering-mass-movement'
    | 'teacher-climate-drainage';
  title: string;
  specRef: string;
  seed: number;
  presetId: PresetId;
  investigationId: string;
  learningObjectives: string[];
  timings: { phase: string; minutes: number; activity: string }[];
  instructions: string[];
  expectedOutcomes: string[];
}

export const TEACHER_SETUPS: readonly TeacherLessonSetup[] = [
  {
    id: 'teacher-meanders-oxbow',
    title: '1. Meanders and oxbow lakes',
    specRef: 'Edexcel GCSE Geography A Topic 1.8 — Middle & Lower Course River Landforms',
    seed: 1701,
    presetId: 'river-delta',
    investigationId: 'rivers-meanders',
    learningObjectives: [
      'Explain how helicoidal flow causes asymmetric erosion (river cliff) and deposition (slip-off slope / point bar) on a meander bend.',
      'Measure changes in channel sinuosity and explain how neck cut-offs create oxbow lakes.',
    ],
    timings: [
      { phase: 'Starter & Prediction', minutes: 4, activity: 'Launch fixed seed 1701; students inspect initial channel sinuosity and record their hypothesis.' },
      { phase: 'Simulation & Observation', minutes: 6, activity: 'Run 15,000 years of Geological Time; observe outer-bend migration and neck narrowing.' },
      { phase: 'Measurement', minutes: 5, activity: 'Record sinuosity, point-bar deposition volume, and oxbow cut-off metrics in the Results Table.' },
      { phase: 'GCSE Exam Writing', minutes: 10, activity: 'Complete the 4-mark or 6-mark explanation using sentence starters and export the A4 Evidence Sheet.' },
    ],
    instructions: [
      'Click "Launch Setup (Seed 1701)" to generate the deterministic lowland river floodplain.',
      'Select a prediction in Step 1, then click "Run Investigation Step" in Step 2 (runs 15,000 years of lateral meander migration).',
      'Inspect the 3D map labels showing outer-bank river cliffs, inner-bank point bars, and cut-off oxbow loops.',
      'Use the Results Table in Step 3 to write your GCSE explanation in Step 4.',
    ],
    expectedOutcomes: [
      'Channel sinuosity increases above 1.35 as meander loops amplify laterally.',
      'Point-bar and floodplain deposition exceeds 0.5 million m³ along inner bends.',
      'At least 1 meander neck narrows or cuts off into an oxbow lake; mouth widens into a funnel-shaped tidal estuary.',
    ],
  },
  {
    id: 'teacher-floodplains-levees',
    title: '2. Floodplains and levees',
    specRef: 'Edexcel GCSE Geography A Topic 1.8 — Lower Course Floodplain & Levee Formation',
    seed: 1702,
    presetId: 'river-delta',
    investigationId: 'rivers-meanders',
    learningObjectives: [
      'Explain how repeated overbank flooding deposits coarse sediment near channel margins to build natural levees.',
      'Describe how lateral meander migration and vertical flood aggradation widen and raise an alluvial floodplain.',
    ],
    timings: [
      { phase: 'Starter & Prediction', minutes: 4, activity: 'Launch fixed seed 1702; open Cross-Section / River Courses (Bradshaw) to inspect the initial lower-course valley.' },
      { phase: 'Simulation & Observation', minutes: 6, activity: 'Run the lower-course evolution and switch to the Erosion/Deposition map overlay.' },
      { phase: 'Measurement', minutes: 5, activity: 'Compare Before and After cross-section profiles and measure levee crest height above the floodplain.' },
      { phase: 'GCSE Exam Writing', minutes: 10, activity: 'Write the 4-mark or 6-mark response linking hydraulic radius loss on the floodplain to deposition.' },
    ],
    instructions: [
      'Click "Launch Setup (Seed 1702)" to load the lower-course alluvial plain.',
      'Run the investigation step to simulate repeated overbank flood deposition and meander sweep.',
      'Open the Cross-Section Profile in the Evidence Sheet to observe raised levee ridges bordering the channel.',
    ],
    expectedOutcomes: [
      'Raised natural levees (1.2–2.8 m above adjacent backswamp floodplain) form along both banks.',
      'Wide, flat alluvial floodplain aggrades with fine silt while the estuarine mouth builds intertidal shoals.',
    ],
  },
  {
    id: 'teacher-coastal-geology',
    title: '3. Coastal erosion and geology',
    specRef: 'Edexcel GCSE Geography A Topic 1.4 — Geological Structure, Lithology & Cliff Retreat',
    seed: 1703,
    presetId: 'coastal-headland',
    investigationId: 'coasts-retreat',
    learningObjectives: [
      'Explain how rock lithology (hard chalk/limestone vs soft clay) controls differential rates of coastal recession.',
      'Explain how hydraulic action and abrasion cut a wave-cut notch, triggering overhang collapse and leaving a gently sloping wave-cut platform.',
    ],
    timings: [
      { phase: 'Starter & Prediction', minutes: 4, activity: 'Launch seed 1703; switch overlay to Geology (rock at the surface) to identify hard and soft bands.' },
      { phase: 'Simulation & Observation', minutes: 6, activity: 'Run 6,000 years of coastal wave attack and compare recession across rock bands.' },
      { phase: 'Measurement', minutes: 5, activity: 'Record soft-rock vs hard-rock retreat distance (m) and eroded cliff volume (m³).' },
      { phase: 'GCSE Exam Writing', minutes: 10, activity: 'Answer the 6-mark question assessing the role of geological structure vs wave energy.' },
    ],
    instructions: [
      'Click "Launch Setup (Seed 1703)" to load the discordant coastline with alternating hard and soft strata.',
      'Run the 6,000-year coastal step and compare the Before and After shoreline position.',
      'Check the measured headland projection and wave-cut platform width on the 3D map.',
    ],
    expectedOutcomes: [
      'Soft clay bays retreat ~1.5–2.5× further inland than resistant limestone/chalk headlands.',
      'A gently sloping wave-cut platform (< 4° gradient) is left seaward of the retreating cliff line.',
    ],
  },
  {
    id: 'teacher-headlands-bays',
    title: '4. Headlands and bays (wave refraction, beaches & stacks)',
    specRef: 'Edexcel GCSE Geography A Topic 1.4–1.5 — Wave Refraction, Caves/Arches/Stacks & Bay-Head Beaches',
    seed: 1704,
    presetId: 'coastal-headland',
    investigationId: 'coasts-retreat',
    learningObjectives: [
      'Explain how shallow nearshore bathymetry refracts waves, concentrating destructive energy onto headlands and dispersing constructive energy in bays.',
      'Sequence the formation of a cave, arch, stack, and stump on a headland and a constructive sandy beach berm in a sheltered bay.',
    ],
    timings: [
      { phase: 'Starter & Prediction', minutes: 4, activity: 'Launch seed 1704; turn on the Wave Attack overlay to see wave refraction focusing on headlands.' },
      { phase: 'Simulation & Observation', minutes: 6, activity: 'Run the coastal simulation; locate headland cave/arch/stack labels and bay beach berms.' },
      { phase: 'Measurement', minutes: 5, activity: 'Record headland refraction factor (> 1.35×), bay beach elevation above sea level, and headland landforms.' },
      { phase: 'GCSE Exam Writing', minutes: 10, activity: 'Complete the process sequence and 6-mark exam response.' },
    ],
    instructions: [
      'Click "Launch Setup (Seed 1704)" to initialise the headland-and-bay coast.',
      'Run the coastal investigation step to trigger seabed wave refraction, headland attack, and bay swash deposition.',
      'Inspect the on-map labels for Headland cave/arch/stack/stump and Sandy bay beach built above sea level.',
    ],
    expectedOutcomes: [
      'Wave refraction factor reaches > 1.35× on convex headlands and drops < 0.85× inside sheltered bays.',
      'Constructive swash builds sandy bay beaches up to +1.0–1.8 m above sea level while headland joints progress through cave → arch → stack → stump.',
    ],
  },
  {
    id: 'teacher-glacial-erosion',
    title: '5. Glacial erosion (corries, arêtes, troughs & moraines)',
    specRef: 'Edexcel GCSE Geography A Topic 1.12–1.13 — Upland Glacial Erosion & Deposition Landforms',
    seed: 1705,
    presetId: 'alpine-glaciers',
    investigationId: 'glaciers-valley',
    learningObjectives: [
      'Explain how freeze-thaw weathering, plucking, rotational slip, and basal abrasion carve corries, arêtes, pyramidal peaks, and U-shaped glacial troughs.',
      'Distinguish between erosional upland features and depositional moraines, drumlins, and erratics.',
    ],
    timings: [
      { phase: 'Starter & Prediction', minutes: 4, activity: 'Launch seed 1705; observe the pre-glacial river-carved mountain relief.' },
      { phase: 'Simulation & Observation', minutes: 6, activity: 'Run the glacial-interglacial cycle; switch to the Glacial Erosion overlay.' },
      { phase: 'Measurement', minutes: 5, activity: 'Compare Before and After valley cross-profiles and record maximum trough over-deepening (m).' },
      { phase: 'GCSE Exam Writing', minutes: 10, activity: 'Write the 4-mark or 6-mark answer explaining U-shaped trough and corrie formation.' },
    ],
    instructions: [
      'Click "Launch Setup (Seed 1705)" to generate the upland mountain range.',
      'Run the glacial cycle (ice sheet growth, rotational cirque slip, valley abrasion, and interglacial meltback).',
      'Inspect the Before/After Cross-Section Profile and on-map labels for Corrie, Arête, Glacial trough, Hanging valley, Moraines, and Drumlins.',
    ],
    expectedOutcomes: [
      'Glacial abrasion and plucking over-deepen main valley troughs by 60–180 m, widening the valley floor.',
      'North/east hollows form armchair corries separated by knife-edge arêtes; terminal, lateral, and recessional moraines + lowland drumlins remain after deglaciation.',
    ],
  },
  {
    id: 'teacher-weathering-mass-movement',
    title: '6. Weathering and mass movement (saturation & landslides)',
    specRef: 'Edexcel GCSE Geography A Topic 1.2 — Weathering, Mass Movement & Slope Stability',
    seed: 1706,
    presetId: 'plateau',
    investigationId: 'slopes-saturation',
    learningObjectives: [
      'Explain how mechanical/chemical weathering produces loose regolith and how heavy rainfall increases pore-water pressure.',
      'Evaluate how saturation lowers internal friction and triggers rapid mass movement (landslides, rockfalls, and slumps) on steep escarpments.',
    ],
    timings: [
      { phase: 'Starter & Prediction', minutes: 4, activity: 'Launch seed 1706; switch to the Slope overlay to identify steep plateau escarpments (> 30°).' },
      { phase: 'Simulation & Observation', minutes: 6, activity: 'Run the intense 120 mm/h storm and slope failure investigation step.' },
      { phase: 'Measurement', minutes: 5, activity: 'Measure volume of collapsed slope material (m³), talus apron deposition, and slope angle reduction.' },
      { phase: 'GCSE Exam Writing', minutes: 10, activity: 'Complete the 6-mark evaluation on why mass movement events are triggered by extreme weather.' },
    ],
    instructions: [
      'Click "Launch Setup (Seed 1706)" to generate the layered sedimentary plateau.',
      'Run the storm saturation & landslide step and switch to the Erosion/Deposition overlay.',
      'Observe the retreated cliff scar and the lobate talus debris fan deposited at the base of the slope.',
    ],
    expectedOutcomes: [
      'Pore-water saturation reduces the critical failure threshold on steep escarpments, displacing > 100,000 m³ of rock and regolith.',
      'Mean escarpment gradient decreases toward a stable angle of repose while building a basal talus fan.',
    ],
  },
  {
    id: 'teacher-climate-drainage',
    title: '7. Climate and drainage (orographic rain, rain shadow & river discharge)',
    specRef: 'Edexcel GCSE Geography A Topic 1.1 & 1.7 — Climate, Orographic Rainfall & Drainage Basins',
    seed: 1707,
    presetId: 'rain-shadow',
    investigationId: 'climate-landscape',
    learningObjectives: [
      'Explain how prevailing moist winds forced over a mountain barrier cause orographic (relief) rainfall on the windward slope and a dry rain shadow on the leeward slope.',
      'Explain how environmental lapse rate (temperature drop with altitude) and vegetation cover control snow accumulation, runoff, and river discharge.',
    ],
    timings: [
      { phase: 'Starter & Prediction', minutes: 4, activity: 'Launch seed 1707; inspect the mountain barrier separating windward and leeward catchments.' },
      { phase: 'Simulation & Observation', minutes: 6, activity: 'Run the climate spin-up and toggle between Rainfall Pattern, Temperature, and River Discharge overlays.' },
      { phase: 'Measurement', minutes: 5, activity: 'Compare windward vs leeward rainfall factor, altitudinal temperature range, and vegetation cover (%).' },
      { phase: 'GCSE Exam Writing', minutes: 10, activity: 'Write the 4-mark or 6-mark explanation linking relief rainfall to river discharge and erosion.' },
    ],
    instructions: [
      'Click "Launch Setup (Seed 1707)" to generate the cordillera rain-shadow world.',
      'Run the climate & vegetation spin-up step.',
      'Compare windward vs leeward rainfall and river discharge using the Map Overlay selector and Results Table.',
    ],
    expectedOutcomes: [
      'Windward slopes receive > 1.8× mean rainfall with dense vegetation and high river discharge; leeward slopes fall < 0.45× mean in the rain shadow.',
      'High peaks cool by ~6.5 °C per 1,000 m, accumulating snowpack (SWE) above the 0 °C isotherm.',
    ],
  },
];
