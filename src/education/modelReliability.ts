/**
 * M17-C05: Scientific Trust ("How reliable is this model?")
 * Provides explicit transparency for teachers, examiners, and GCSE/A-Level students
 * on what is physically simulated vs simplified, SI units, why time acceleration is used,
 * real-world UK/global benchmark ranges, and peer-reviewed equation sources.
 */

export interface ProcessReliability {
  topic: string;
  simulated: string;
  simplified: string;
  unitsAndTimescale: string;
  realWorldRange: string;
  equationSource: string;
}

export const MODEL_RELIABILITY: readonly ProcessReliability[] = [
  {
    topic: 'Surface Water & River Hydraulics',
    simulated:
      '2D depth-averaged Shallow-Water Equations (virtual-pipe gravity flux + Manning bottom friction) running on WebGL2 GPU or CPU Float64 reference. Conserves volume to < 0.01% across rainfall, springs, infiltration, evaporation, and sea outfall.',
    simplified:
      'Depth-averaged plan-view grid (no 3D vertical secondary/helicoidal velocity vectors inside the water column; sub-grid turbulence is represented by Manning roughness n = 0.035 s·m⁻¹/³).',
    unitsAndTimescale: 'Depth h (m), flux Q (m³/s), speed v (m/s), rainfall (mm/h). Real-time seconds to days.',
    realWorldRange:
      'UK storm river speeds: 0.5–3.0 m/s; upland flash-flood discharge: 15–400 m³/s (e.g. River Tees at Barnard Castle / Boscastle 2004 ~180 m³/s).',
    equationSource: "O'Brien et al. (1995) / Mei et al. (2007) hydrostatic pipe-model shallow-water equations; Manning (1891) open-channel flow.",
  },
  {
    topic: 'Fluvial Erosion, Meanders & Estuaries',
    simulated:
      'Stream Power incision (E = K · A^m · S^n), ξ–q transport-limited sediment capacity, Howard–Knutson / Johannesson–Parker curvature-driven lateral meander migration, neck cut-offs (oxbow lakes), overbank levee aggradation, and funnel-shaped tidal estuary widening with mudflat shoals.',
    simplified:
      'Single bulk sediment grain class on the 2D grid; bank undercutting in Water Time uses a parameterized lateral toe-saturation flux, whereas Geological Time evolves an explicit centreline curvature model.',
    unitsAndTimescale: 'Incision & aggradation (m/yr), sinuosity S_I (dimensionless ≥ 1.0), volume (m³). Geological time: 1,000–250,000 years.',
    realWorldRange:
      'UK lowland meander migration: 0.2–5 m/yr (River Severn / River Swale); mature meander sinuosity: 1.5–2.8; upland bedrock incision: 0.1–2.0 mm/yr.',
    equationSource:
      'Howard & Kerby (1983) / Whipple & Tucker (1999) stream power law; Davy & Lague (2009) ξ–q transport capacity; Howard & Knutson (1984) & Johannesson & Parker (1989) meander migration.',
  },
  {
    topic: 'Coastal Waves, Refraction, Beaches & Headlands',
    simulated:
      'Directional wave exposure, seabed-controlled wave refraction factor (K_r focusing energy > 1.35× on convex headlands and dispersing < 0.85× in sheltered bays), lithology-dependent cliff retreat, sloping wave-cut platform downwearing, CERC longshore drift, constructive bay beach berms building up to +1.8 m above sea level, and map-scale cave → arch → stack → stump progression.',
    simplified:
      'Phase-averaged wave power (individual breaking wave crests and swash/backwash oscillations are time-averaged; map-scale caves/arches/stacks are tracked by cumulative wave-attack damage on headland cells, while 3D rock-joint geometry is shown in the dedicated Headland Voxel Lab).',
    unitsAndTimescale: 'Wave height H_s (m), cliff retreat (m), longshore transport (m³/yr). Geological time: 1,000–10,000 years.',
    realWorldRange:
      'Holderness boulder-clay retreat: 1.5–2.2 m/yr (~1.8 km per 1,000 yr); Purbeck / Swanage chalk & limestone retreat: 0.05–0.3 m/yr; UK longshore drift: 10⁴–10⁵ m³/yr.',
    equationSource: 'Komar & Inman (1970) CERC longshore sediment transport; Sunamura (1992) rocky coast cliff-platform evolution; linear wave shoaling & refraction.',
  },
  {
    topic: 'Glaciation & Periglacial Relief',
    simulated:
      'Shallow Ice Approximation (SIA) ice-sheet & valley-glacier flow driven by surface slope and ice thickness (Glen flow law n = 3), altitude mass-balance (accumulation above ELA, ablation below), Hallet sliding abrasion + rotational slip cirque over-deepening in north/east hollows, plus supraglacial/englacial debris transport and terminal, lateral, recessional moraine, drumlin, and erratic deposition.',
    simplified:
      'Plan-view ice dynamics on the 2D grid (sub-grid valley-side plucking is represented alongside the 2D cross-section Trough Lab; subglacial meltwater pressurization is parameterized via basal sliding factor).',
    unitsAndTimescale: 'Ice thickness H (m), ELA snowline (m a.s.l.), bedrock abrasion (m). Glacial cycles: 10,000–120,000 years.',
    realWorldRange:
      'Loch Lomond Stadial / Devensian UK valley glaciers: 150–400 m thick; glacial trough over-deepening (e.g. Nant Ffrancon / Glen Coe): 80–250 m; moraine ridges: 8–35 m high.',
    equationSource: 'Hutter (1983) Shallow Ice Approximation; Glen (1955) ice rheology; Hallet (1979) glacial abrasion law.',
  },
  {
    topic: 'Weathering, Slope Stability & Landslides',
    simulated:
      'Exponential bare-rock regolith production (weathering faster on wet, weak rock), linear hillslope soil creep, isotropic 8-neighbour talus avalanching above the angle of repose, pore-pressure-reduced critical cliff angles during heavy rain, and earthquake peak-ground-acceleration (PGA) triggered rockfalls.',
    simplified:
      'Single regolith layer over 4 stratigraphic bedrock layers on the 3D map (rotational slip along curved shear planes in clay cliffs is modelled in detail in the 2D Rotational Slump Lab).',
    unitsAndTimescale: 'Slope angle (°), soil thickness (m), landslide volume (m³). Seconds/hours for storm failures; millennia for creep.',
    realWorldRange:
      'Dry talus angle of repose: 32°–37°; saturated regolith failure threshold: 18°–26°; Holbeck Hall / Lyme Regis coastal slumps: 10⁴–10⁶ m³.',
    equationSource: 'Culling (1960) diffusive hillslope creep; Heimsath et al. (1997) exponential soil production; Mohr–Coulomb pore-pressure slope stability.',
  },
  {
    topic: 'Tectonics, Earthquakes, Volcanoes & Isostasy',
    simulated:
      'Convergent, divergent, and transform plate boundaries, crustal folding of stratigraphic layers, Wells & Coppersmith (1994) fault rupture & slip scaling by moment magnitude M_w, Bingham viscoplastic lava flows (basalt vs andesite yield strength), Mastin (2009) explosive eruption columns & wind-advected tephra fallout, caldera ring-fault collapse, and flexural lithospheric isostatic rebound.',
    simplified:
      'Kinematic plate velocities prescribed by the user (mantle convection is not solved in 3D); volcanic eruptions use time-compressed rest intervals between eruptive pulses when building whole shield/composite cones.',
    unitsAndTimescale: 'Convergence (mm/yr), magnitude M_w (4.0–8.5), lava viscosity (Pa·s), eruption rate (m³/s), isostatic rebound (m).',
    realWorldRange:
      'Hawaiian / Icelandic shield slopes: 2°–8°; Andean / Japanese composite stratovolcano slopes: 22°–33°; post-glacial isostatic uplift in Scotland: +1.0 to +2.0 mm/yr.',
    equationSource:
      'Wells & Coppersmith (1994) fault scaling; Mei et al. / Balmforth Bingham lava rheology; Mastin et al. (2009) volcanic plume-height scaling; Airy–Heiskanen / flexural isostasy.',
  },
];

export const WHY_TIME_ACCELERATION = [
  'In nature, a storm flood happens in hours, a coastal cliff retreats in decades to centuries, a river meander cuts off in 500–5,000 years, and a glacial trough or mountain range evolves over 50,000–1,000,000 years.',
  'Without time acceleration, watching a waterfall retreat 1 km at a realistic 5 mm/yr would take 200,000 real years in the classroom.',
  'Terra Genesis therefore provides two explicit, honest time modes: (1) Water Time (seconds to days) for storms, hydrographs, landslides, and lava flows; and (2) Geological Time (thousands of years per second in a background Web Worker) for river valleys, meanders, coasts, glaciers, and tectonics — while keeping every volume ledger (eroded = deposited + exported) strictly conserved.',
];

export const MEASURED_VS_TEXTBOOK = {
  measuredBadge: '📊 Measured from Simulation',
  measuredExplanation:
    'Every number in the Results Table, Cross-Section Profile, Map Overlay Legend, and On-Map Feature Labels is computed directly from the heightfields, water depths, and sediment ledgers of your current 3D world.',
  textbookBadge: '📘 Curriculum & Exam Guidance',
  textbookExplanation:
    'The Process Sequence steps, Key Vocabulary definitions, Sentence Starters, and Edexcel Command-Word tips are structured curriculum scaffolds designed to help students translate their measured simulation evidence into full-mark GCSE Geography answers.',
};
