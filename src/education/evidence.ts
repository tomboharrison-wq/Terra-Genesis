import type { Engine } from '../engine/engine';
import type { WorldState } from '../engine/world';
import { MATERIALS } from '../terrain/materials';
import { sinuosity } from '../sim/geology/meander';
import { analyzeRiverCourses, bankHeight, estuaryMetrics, leveeHeight, meanderBends } from './geoFeatures';
import { findGlacialFeatures } from './glacialFeatures';

export type InvestigationTopic = 'rivers' | 'coasts' | 'glaciers' | 'slopes' | 'tectonics' | 'climate' | 'custom';

export interface InvestigationDef {
  id: string;
  topic: InvestigationTopic;
  title: string;
  question: string;
  setupHint: string;
  /** M17-C01: Explicit student guidance on which parameter to change and what to observe on the map. */
  whatToChange: string;
  whatToObserve: string;
  estimatedMinutes: string;
  /** M17-C02: GCSE answer support — prediction prompt, sentence starters, 4-mark & 6-mark questions, and Edexcel command word guidance. */
  predictionPrompt: string;
  hypotheses: string[];
  sentenceStarters: string[];
  question4Mark: string;
  commandWord4Mark: string;
  question6Mark: string;
  commandWord6Mark: string;
  processSequence: string[];
  vocabulary: { term: string; definition: string }[];
}

export interface MeasuredMetric {
  label: string;
  before: string;
  after: string;
  change: string;
}

export interface ProfilePoint {
  distM: number;
  beforeM: number;
  afterM: number;
}

export interface EvidenceStudentMeta {
  studentName?: string;
  studentClass?: string;
  predictionWhy?: string;
  studentExplanation?: string;
  selectedMark?: 4 | 6;
  teacherFeedback?: string;
  teacherMark?: string;
}

export interface EvidenceReport {
  investigation: InvestigationDef;
  hypothesis: string;
  worldName: string;
  elapsedText: string;
  metrics: MeasuredMetric[];
  annotatedLandforms: string[];
  processSequence: string[];
  vocabularyUsed: string[];
  modelAnswer4Mark: string;
  examParagraph: string;
  profileTitle: string;
  profile: ProfilePoint[];
}

export const INVESTIGATIONS: InvestigationDef[] = [
  {
    id: 'rivers-meanders',
    topic: 'rivers',
    title: 'Rivers: Why do meanders move and form estuaries?',
    question: 'How do lateral erosion and deposition cause meanders to migrate across a floodplain, form oxbow lakes, and widen into a tidal estuary at the mouth?',
    setupHint: 'Use the "River to sea" preset or switch to Geological time with "Meandering lowland river & estuary" enabled, then run for 3,000–10,000 years.',
    whatToChange: 'Adjust the Geological Years to Run (e.g. 5,000 vs 15,000 yr) or Rainfall Rate (mm/h) using the inline control before running.',
    whatToObserve: 'Watch the river bends swing wider across the floodplain, outer banks cut steep river cliffs, inner bends build point bars, narrow necks cut off into oxbow lakes, and the mouth widen into a funnel-shaped tidal estuary.',
    estimatedMinutes: '20–25 min (3 min Predict · 5 min Run & Observe · 5 min Measure · 10 min Explain)',
    predictionPrompt: 'Which bank of a meander bend will erode, which bank will build up sediment, and what will happen when a meander neck narrows?',
    hypotheses: [
      'Faster flow on the outside of bends will erode steep river cliffs while slower inner-bend flow deposits slip-off point bars, increasing sinuosity until a neck cut-off forms an oxbow lake.',
      'Overbank flooding will deposit coarse sediment next to the channel to build raised natural levees while the river mouth widens into a funnel-shaped tidal estuary.',
      'Vertical erosion will dominate in the steep upper course (V-shaped valley), whereas lateral erosion and deposition will dominate on the gentle lower floodplain.',
    ],
    sentenceStarters: [
      'As the river enters a bend, the thalweg swings toward the outer bank because...',
      'On the outside of the meander, hydraulic action and abrasion undercut the bank to form a steep river cliff, whereas on the inside bend...',
      'In my simulation, channel sinuosity changed from ... to ... and deposited ... of point-bar and floodplain sediment.',
      'During high discharge, the narrow meander neck was breached, cutting off the loop to leave an oxbow lake while at the river mouth...',
    ],
    question4Mark: 'Explain how erosion and deposition cause a river meander to migrate laterally across a floodplain. (4 marks)',
    commandWord4Mark: 'Edexcel "Explain" (4 marks = 2 AO1 knowledge points + 2 AO2 cause-and-effect links): State where fastest flow (thalweg) occurs and link it using "because / therefore / consequently" to outer-bank river cliff erosion and inner-bank point-bar deposition.',
    question6Mark: 'Assess the relative importance of erosional and depositional processes in shaping landforms in the middle and lower courses of a river. Use measured data from your simulation. (6 marks)',
    commandWord6Mark: 'Edexcel "Assess" (6 marks = AO1 processes + AO2 application + AO3 judgement backed by evidence): Weigh how lateral erosion (river cliffs, neck cut-offs, estuarine widening) and deposition (point bars, levees, oxbow sealing, mudflats) interact, citing at least two numbers from your Results Table.',
    processSequence: [
      '1. Asymmetric flow in a bend: the thalweg (fastest current) swings toward the outer bank, generating helicoidal (corkscrew) secondary flow.',
      '2. Outer-bank undercutting: hydraulic action and abrasion concentrate on the outer bend, undercutting the bank into a steep river cliff.',
      '3. Inner-bank point bar: helicoidal flow sweeps eroded sediment across the channel floor to the slower inner bend, depositing a gently sloping slip-off slope (point bar).',
      '4. Neck narrowing & cut-off: adjacent outer bends migrate toward each other until flood water breaches the narrow neck, leaving an abandoned loop sealed by deposition as an oxbow lake.',
      '5. Overbank flooding & estuary: floods spill onto the floodplain, losing velocity to deposit levees beside the channel, while tidal scour and rising sea level widen the mouth into a funnel-shaped estuary.',
    ],
    vocabulary: [
      { term: 'Thalweg', definition: 'Line of fastest water velocity in a river channel, swinging to the outer bank on bends.' },
      { term: 'Helicoidal flow', definition: 'Corkscrew-like water movement in a meander that erodes the outer bank and deposits on the inner bank.' },
      { term: 'River cliff', definition: 'Steep undercut bank on the outside of a meander bend formed by lateral hydraulic action and abrasion.' },
      { term: 'Slip-off slope (point bar)', definition: 'Gently sloping accumulation of sand and gravel deposited on the slow-flowing inside of a bend.' },
      { term: 'Oxbow lake', definition: 'Curved lake formed when a meander neck is breached during a flood and sealed off by deposition.' },
      { term: 'Levee', definition: 'Raised natural river bank built by repeated overbank flood deposition of coarse sediment.' },
      { term: 'Estuary', definition: 'Wide, funnel-shaped tidal river mouth where freshwater mixes with seawater and mudflats form.' },
    ],
  },
  {
    id: 'coasts-retreat',
    topic: 'coasts',
    title: 'Coasts: Why do headlands and bays retreat differently?',
    question: 'How do rock lithology (geological structure) and wave refraction control differential erosion of headlands, bays, beaches, and wave-cut platforms?',
    setupHint: 'Use the "Coastal headlands" preset or enable Waves in the Coast panel, then run in Water time (Time-lapse) or Geological time.',
    whatToChange: 'Adjust Significant Wave Height (m) or Geological Time duration (years) using the inline control before running.',
    whatToObserve: 'Observe soft clay bands retreating rapidly into indented bays with sandy beaches above sea level, while hard chalk/limestone bands remain jutting out as headlands with wave-cut platforms and caves/arches/stacks.',
    estimatedMinutes: '20–25 min (3 min Predict · 5 min Run & Observe · 5 min Measure · 10 min Explain)',
    predictionPrompt: 'How will retreat rates differ between hard chalk/limestone and soft clay, and where will wave refraction focus or disperse energy?',
    hypotheses: [
      'Bands of soft clay will erode and slump much faster than resistant chalk/limestone, indenting sheltered bays while hard rock remains jutting out as headlands.',
      'Shallow-water wave refraction will concentrate wave energy onto jutting headlands (carving wave-cut platforms, caves, arches, and stacks) while dispersing energy in bays so sandy beaches build up.',
      'As the wave-cut platform widens in front of a headland, shallow-water wave attenuation will gradually slow down the rate of cliff retreat.',
    ],
    sentenceStarters: [
      'On a discordant coastline, alternating bands of hard chalk/limestone and soft clay erode at different rates because...',
      'In my simulation, the soft-rock bay retreated by ... whereas the resistant headland retreated by ..., leaving headlands jutting out.',
      'As waves enter shallow water off the headland, wave refraction bends the wave crests and concentrates energy (> 1.35×), forming...',
      'Conversely, inside the sheltered bay, wave energy is dispersed so constructive swash deposits a sandy beach berm up to ... above sea level.',
    ],
    question4Mark: 'Explain how geological structure and rock type lead to the formation of headlands and bays on a discordant coastline. (4 marks)',
    commandWord4Mark: 'Edexcel "Explain" (4 marks): Identify the discordant arrangement of alternating hard and soft rock strata perpendicular to the coast, then explain how differential erosion by hydraulic action and abrasion indents soft clay into bays while resistant rock remains as headlands.',
    question6Mark: 'Evaluate how wave refraction and marine processes interact with lithology to create both erosional headland landforms and depositional bay beaches. Use data from your simulation. (6 marks)',
    commandWord6Mark: 'Edexcel "Evaluate" (6 marks): Show how initial lithological differences create headlands and bays, which then trigger seabed wave refraction—focusing destructive energy on headlands (wave-cut platforms, caves, arches, stacks) and low-energy constructive swash in bays (beaches)—quoting your measured retreat and beach height.',
    processSequence: [
      '1. Discordant geology: alternating bands of resistant rock (chalk/limestone) and less resistant rock (clay/mudstone) meet the coast at right angles.',
      '2. Differential marine erosion: destructive waves erode the soft clay rapidly by hydraulic action, abrasion, and rotational slumping, forming indented bays.',
      '3. Headland formation & wave refraction: resistant rock erodes slowly and juts out as headlands; waves slow in shallow water off headlands, refracting and concentrating wave energy onto headland flanks.',
      '4. Wave-cut notch & platform: concentrated attack undercuts the headland base between low and high tide, causing overhang collapse and leaving a gently sloping wave-cut platform.',
      '5. Bay sheltering & beach deposition: wave orthogonals diverge inside sheltered bays, reducing wave power so constructive swash and longshore drift deposit sandy pocket beaches.',
    ],
    vocabulary: [
      { term: 'Discordant coast', definition: 'Coastline where alternating bands of hard and soft rock run perpendicular to the shore.' },
      { term: 'Wave refraction', definition: 'Bending of wave crests in shallow water so wave energy concentrates on headlands and disperses in bays.' },
      { term: 'Hydraulic action', definition: 'Compression of air and water trapped in rock joints by breaking waves, prising rock apart.' },
      { term: 'Abrasion (corrasion)', definition: 'Grinding of cliff bases and platforms by rock fragments and pebbles hurled by waves.' },
      { term: 'Wave-cut platform', definition: 'Gently sloping rocky ledge (< 4°) left at the base of a retreating cliff.' },
      { term: 'Longshore drift', definition: 'Transport of beach sediment along the coast by oblique swash and perpendicular backwash.' },
    ],
  },
  {
    id: 'glaciers-valley',
    topic: 'glaciers',
    title: 'Glaciers: How does ice reshape a valley?',
    question: 'How do glacial accumulation, rotational sliding, plucking, and abrasion transform a V-shaped river valley into a U-shaped glacial trough with corries, hanging valleys, and moraines?',
    setupHint: 'Use the "Alpine glaciers" preset or run Geological time with Climate and Glaciers enabled.',
    whatToChange: 'Adjust the Ice-Age Temperature Offset (°C) or Glacial Duration (years) before running the cycle.',
    whatToObserve: 'Compare the steep, flat-floored U-shaped glacial trough against the original V-shaped valley profile, and locate north-east corries, knife-edge arêtes, hanging valleys, moraine ridges, and drumlins.',
    estimatedMinutes: '20–25 min (3 min Predict · 5 min Run & Observe · 5 min Measure · 10 min Explain)',
    predictionPrompt: 'How will valley cross-profile shape change after glaciation, and where will erosional vs depositional glacial landforms develop?',
    hypotheses: [
      'Thick valley ice coupled across the channel will scour and widen the valley sides and floor simultaneously, transforming a narrow V-shaped river valley into a steep-sided, flat-floored U-shaped glacial trough.',
      'Rotational ice slip in sheltered north-east-facing mountain hollows will over-deepen armchair-shaped corries (leaving tarns behind rock lips) that intersect at knife-edge arêtes and pyramidal peaks.',
      'When the glacier retreats, unsorted glacial till will be deposited at the snout and margins as terminal, lateral, and recessional moraines and subglacial drumlins.',
    ],
    sentenceStarters: [
      'In shaded north-east upland hollows above the snowline, snow compacts into glacial ice and moves by rotational slip, which...',
      'Freeze-thaw weathering and plucking steepen the backwall while basal abrasion over-deepens the hollow into a corrie because...',
      'In my simulation, the trunk glacier scoured up to ... of bedrock, transforming the narrow river valley into a U-shaped glacial trough.',
      'When the climate warmed and the ice melted back, unsorted till was deposited at the snout and lowland plain to form...',
    ],
    question4Mark: 'Explain the formation of a corrie (cirque) and a tarn in a glaciated upland area. (4 marks)',
    commandWord4Mark: 'Edexcel "Explain" (4 marks): Sequence snow accumulation in a sheltered NE hollow, firnification into ice, freeze-thaw & plucking on the backwall, rotational slip + basal abrasion over-deepening the rock basin behind a rock lip, and post-glacial meltwater filling a tarn.',
    question6Mark: 'Assess the roles of glacial erosion and glacial deposition in modifying pre-existing river landscapes. Refer to your measured simulation evidence. (6 marks)',
    commandWord6Mark: 'Edexcel "Assess" (6 marks): Contrast upland erosional modification (corries, arêtes, pyramidal peaks, truncated spurs, hanging valleys, U-shaped troughs) with valley/lowland depositional landforms (terminal/lateral/recessional moraines, drumlins, erratics), citing your measured trough deepening and moraine volumes.',
    processSequence: [
      '1. Accumulation & firnification: above the equilibrium line altitude (ELA), snowfall exceeds summer ablation, compressing into glacial ice, thickest on shaded NE-facing slopes.',
      '2. Rotational slip in corries: ice rotates downslope in steep upland hollows, plucking the backwall and abrading an over-deepened rock basin behind a raised rock lip.',
      '3. Plucking & abrasion in the main trough: thick valley glaciers slide under high basal pressure; meltwater freezes onto fractured bedrock (plucking) and embedded debris grinds the bed like sandpaper (abrasion).',
      '4. Truncated spurs & hanging valleys: the main glacier bulldozes interlocking river spurs into truncated spurs and erodes far deeper than small tributary glaciers, leaving hanging valleys.',
      '5. Melt & moraine deposition: as climate warms, melting ice drops unsorted till at its maximum extent (terminal moraine), valley sides (lateral moraine), pause positions (recessional moraine), and streamlined lowland drumlins.',
    ],
    vocabulary: [
      { term: 'Plucking (quarrying)', definition: 'Glacial meltwater freezes into bedrock joints and pulls blocks away as the glacier advances.' },
      { term: 'Abrasion', definition: 'Angular rock debris frozen into the base of a glacier grinds and striates the underlying bedrock.' },
      { term: 'Rotational slip', definition: 'Curved sliding movement of ice within a corrie hollow that over-deepens the basin floor.' },
      { term: 'Glacial trough (U-shaped valley)', definition: 'Steep-sided, wide, flat-bottomed valley carved by a trunk glacier.' },
      { term: 'Corrie (cirque) & tarn', definition: 'Armchair-shaped mountain hollow with a steep backwall and over-deepened lake (tarn) behind a rock lip.' },
      { term: 'Terminal / recessional moraine', definition: 'Ridge of unsorted glacial till deposited across a valley at the snout of a stationary or retreating glacier.' },
    ],
  },
  {
    id: 'slopes-saturation',
    topic: 'slopes',
    title: 'Slopes: How does saturation affect landslides?',
    question: 'Why do heavy rainfall, coastal toe undercutting, and earthquakes trigger rapid mass movement (rockfall, debris avalanches, and rotational slumping)?',
    setupHint: 'Use the "Layered plateau" or "River basin" preset, trigger heavy rain / storms or use the Landslide tool on steep slopes.',
    whatToChange: 'Adjust the Storm Rainfall Intensity (mm/h) before running the slope-stability test.',
    whatToObserve: 'Watch steep escarpment slopes fail during heavy rain, lowering the upper cliff angle and building a concave talus apron at the base of the slope.',
    estimatedMinutes: '20–25 min (3 min Predict · 5 min Run & Observe · 5 min Measure · 10 min Explain)',
    predictionPrompt: 'How does heavy rainfall change pore-water pressure and the critical angle of repose on a steep regolith-covered slope?',
    hypotheses: [
      'Infiltrating rainwater increases pore-water pressure and adds weight to loose regolith, reducing internal friction and lowering the stable angle of repose so saturated slopes fail downhill.',
      'Weak sedimentary rocks (clay and mudstone) fail to much gentler equilibrium angles than resistant crystalline granite.',
      'Material eroded from the upper scarp is conserved and accumulates at the base of the slope as a lower-angle talus apron or slump toe.',
    ],
    sentenceStarters: [
      'Sub-aerial weathering breaks down exposed bedrock into loose regolith, which remains stable while dry up to its angle of repose because...',
      'When heavy storm rainfall infiltrates the slope, water fills the pore spaces and increases pore-water pressure, which...',
      'In my simulation, slope failure displaced ... of material, lowering maximum escarpment lowers by ... m and depositing up to +... m at the toe.',
      'Consequently, the collapsed debris came to rest at the base of the cliff as a gentler talus apron, restoring slope equilibrium.',
    ],
    question4Mark: 'Explain how heavy rainfall and sub-aerial weathering contribute to mass movement on steep slopes. (4 marks)',
    commandWord4Mark: 'Edexcel "Explain" (4 marks): Link weathering (weakening rock into regolith) and rainwater infiltration (adding weight + raising pore-water pressure) to reduced internal shear strength, causing gravity to exceed friction.',
    question6Mark: 'Evaluate the importance of water saturation versus rock lithology in triggering rapid mass movement events. Use measured evidence from your simulation. (6 marks)',
    commandWord6Mark: 'Edexcel "Evaluate" (6 marks): Weigh intrinsic geological factors (weak clay/mudstone vs strong granite, bedding planes) against extrinsic hydrological triggers (intense storm rainfall, pore-water pressure, basal undercutting), citing your measured displaced volume and slope angle changes.',
    processSequence: [
      '1. Sub-aerial weathering: freeze-thaw and chemical weathering break down exposed bedrock into loose regolith on hillslopes.',
      '2. Saturation & pore-water pressure: heavy rain or surface runoff infiltrates the soil/regolith, filling pore spaces, adding mass, and lubricating grain contacts.',
      '3. Reduction of shear strength: increased pore-water pressure reduces the effective normal stress and lowers the critical angle of repose below the slope’s current gradient.',
      '4. Mass movement failure: gravity overcomes shear resistance, triggering rapid downslope movement (debris slide, rockfall on cliffs, or rotational slumping on clay).',
      '5. Toe deposition: displaced debris comes to rest where the gradient slackens at the slope foot, forming a concave talus cone or slump toe lobe.',
    ],
    vocabulary: [
      { term: 'Mass movement', definition: 'Downslope movement of rock, regolith, or soil under the direct influence of gravity.' },
      { term: 'Angle of repose', definition: 'Steepest angle at which loose sediment remains stable without sliding; reduced by water saturation.' },
      { term: 'Pore-water pressure', definition: 'Pressure of water filling spaces between soil/rock grains, pushing grains apart and reducing friction.' },
      { term: 'Rotational slumping', definition: 'Mass movement of saturated clay/soft rock along a concave-upward curved slip plane.' },
      { term: 'Talus (scree) apron', definition: 'Fan or slope of angular rock fragments accumulating at the base of a cliff after rockfall.' },
    ],
  },
  {
    id: 'tectonics-relief',
    topic: 'tectonics',
    title: 'Tectonics: How do plate movements produce relief?',
    question: 'How do convergent, divergent, and transform plate boundaries, earthquakes, and volcanism build mountain belts, rift valleys, trenches, and volcanic cones?',
    setupHint: 'Open the Earth → Plates, Quake, or Volcano tools and run with Tectonics enabled.',
    whatToChange: 'Adjust the Plate Convergence Speed (mm/yr) or Fault Earthquake Magnitude before running.',
    whatToObserve: 'Watch compressional plate boundaries uplift fold mountain ridges and deep subduction trenches while coseismic fault slip offsets strata and triggers landslides.',
    estimatedMinutes: '20–25 min (3 min Predict · 5 min Run & Observe · 5 min Measure · 10 min Explain)',
    predictionPrompt: 'How will relief and crustal elevation change along a convergent boundary compared to a divergent rift or subduction trench?',
    hypotheses: [
      'Convergent plate boundaries compress and thicken the crust to uplift fold mountain belts and oceanic trenches, while erosion simultaneously wears down the rising peaks.',
      'Divergent boundaries stretch and fault the crust along normal faults to form sunken rift grabens bounded by steep fault scarps.',
      'Repeated basaltic lava eruptions build wide, gently sloping shield volcanoes, whereas alternating viscous andesite lava and explosive tephra build steep composite cones.',
    ],
    sentenceStarters: [
      'At a convergent plate boundary, colliding plates generate intense compressional forces that...',
      'Sedimentary rock strata buckle into anticlines and synclines and ride up along thrust faults, uplifting fold mountains by...',
      'In my simulation, peak mountain elevation increased from ... to ..., while total relief changed by...',
      'At the same time, steeper mountain gradients accelerated river incision and slope failures, showing that relief reflects a balance between tectonic uplift and erosion.',
    ],
    question4Mark: 'Explain how tectonic plate movement at a convergent boundary forms fold mountains and ocean trenches. (4 marks)',
    commandWord4Mark: 'Edexcel "Explain" (4 marks): Describe plate collision driven by slab pull/convection, crustal compression buckling strata into anticlines/synclines (fold mountains), or dense oceanic lithosphere subducting beneath continental crust to depress a deep ocean trench.',
    question6Mark: 'Assess how internal tectonic processes and external erosional processes interact to shape major mountain landscapes. Use measured data from your simulation. (6 marks)',
    commandWord6Mark: 'Edexcel "Assess" (6 marks): Discuss how tectonic uplift, fault rupture, and volcanism build primary relief while fluvial/glacial erosion and mass movement simultaneously dissect the rising range, citing your measured peak elevation and volume changes.',
    processSequence: [
      '1. Lithospheric plate motion: convection and slab pull drive rigid crustal plates to converge, diverge, or slide past one another along plate boundaries.',
      '2. Convergent uplift & subduction: colliding plates compress sedimentary strata into anticlines/synclines and thrust faults (fold mountains), or subduct dense oceanic crust to form a deep ocean trench and volcanic arc.',
      '3. Divergent rifting: tensional forces pull plates apart, causing blocks of crust to drop down between normal faults as a rift valley (graben).',
      '4. Coseismic fault rupture: accumulated elastic strain releases suddenly in earthquakes (Wells & Coppersmith scaling), raising footwall/hanging-wall scarps and triggering shaking landslides.',
      '5. Tectonic–erosional balance: uplifted relief increases river gradients ($S$), accelerating stream-power incision that carves valleys into the rising mountain belt.',
    ],
    vocabulary: [
      { term: 'Convergent boundary', definition: 'Plate margin where two plates collide, forming fold mountains or a subduction trench and volcanic arc.' },
      { term: 'Divergent boundary (rift)', definition: 'Plate margin where plates pull apart, creating normal fault scarps and a sunken rift graben.' },
      { term: 'Fold mountains', definition: 'Mountain ranges formed when compressional tectonic forces buckle sedimentary strata into anticlines and synclines.' },
      { term: 'Shield vs. composite volcano', definition: 'Fluid basaltic lava builds broad, gentle shield volcanoes; viscous andesitic lava and ash build steep stratovolcanoes.' },
    ],
  },
  {
    id: 'climate-landscape',
    topic: 'climate',
    title: 'Climate: How do rainfall and temperature change landscapes?',
    question: 'How do altitude temperature lapse rates, orographic rainfall, rain shadows, droughts, and storms control river discharge, snowpacks, and vegetation cover?',
    setupHint: 'Enable Climate and Plants in the Climate panel, or compare Biome presets.',
    whatToChange: 'Adjust the Prevailing Moisture / Temperature Offset (°C) before running the climate spin-up.',
    whatToObserve: 'Switch between the Rainfall Pattern, Temperature, and Plant Cover overlays to see wet vegetated windward slopes, cold snow-capped peaks, and dry leeward rain-shadow valleys.',
    estimatedMinutes: '20–25 min (3 min Predict · 5 min Run & Observe · 5 min Measure · 10 min Explain)',
    predictionPrompt: 'Why does the windward side of a mountain range receive much more rainfall and vegetation than the leeward side?',
    hypotheses: [
      'Moist prevailing winds forced up a mountain barrier cool at the environmental lapse rate, condensing heavy orographic rainfall on the windward slope while creating an arid rain shadow on the leeward side.',
      'Temperature decreases with altitude (lapse rate ~6.5 °C/km), creating distinct altitudinal zonation: lowland broadleaf forest, upland conifers, a treeline, and permanent snow/ice above the 0 °C isotherm.',
      'Dense vegetation cover shields topsoil from hydraulic erosion, whereas drought or deforestation exposes bare soil to rapid gullying and sheet erosion during storms.',
    ],
    sentenceStarters: [
      'When moist prevailing winds blow from the sea toward a mountain range, the air is forced to rise over the high ground and...',
      'As the air rises, it cools at the environmental lapse rate (~6.5 °C per 1,000 m), causing water vapour to condense into heavy orographic rainfall on the windward slope.',
      'In my simulation, windward vs leeward rainfall reached ... and vegetation cover changed to ..., demonstrating a pronounced rain shadow.',
      'Furthermore, denser vegetation on the wet windward slopes increased interception and root binding, which...',
    ],
    question4Mark: 'Explain how relief (topography) causes orographic rainfall on windward slopes and a rain shadow on leeward slopes. (4 marks)',
    commandWord4Mark: 'Edexcel "Explain" (4 marks): Sequence moist air forced up a mountain barrier, adiabatic cooling with altitude, condensation and precipitation on the windward slope, followed by dry air descending and warming on the leeward slope.',
    question6Mark: 'Evaluate how climate (temperature and precipitation patterns) controls both physical weathering/erosion rates and vegetation distribution across a landscape. Use your simulation data. (6 marks)',
    commandWord6Mark: 'Edexcel "Evaluate" (6 marks): Link altitudinal temperature lapse rates (snowline, freeze-thaw/glacial processes) and orographic rainfall contrasts (river discharge, vegetation cover, root binding) using your measured temperature, rainfall, and plant cover values.',
    processSequence: [
      '1. Orographic uplift: moist air blowing from the sea encounters a mountain barrier and is forced to rise.',
      '2. Adiabatic cooling & condensation: rising air cools with altitude (~6.5 °C/km), reaching saturation and dropping heavy orographic precipitation on the windward slope.',
      '3. Leeward rain shadow: having lost its moisture, air descends the leeward slope, warming and drying to create a low-rainfall rain shadow.',
      '4. Altitudinal zonation & cryosphere: above the freezing level (0 °C), precipitation falls as snow (SWE), feeding glaciers; below the treeline, moisture and warmth control plant growth.',
      '5. Biogeomorphic feedback: plant roots bind regolith and intercept rainfall (`erosionShield`), reducing sediment detachment and moderating storm flood peaks.',
    ],
    vocabulary: [
      { term: 'Orographic rainfall', definition: 'Relief rainfall caused when moist air is forced to rise over high ground, cooling and condensing.' },
      { term: 'Rain shadow', definition: 'Dry region on the leeward side of a mountain range where descending air warms and absorbs moisture.' },
      { term: 'Environmental lapse rate', definition: 'Rate at which atmospheric temperature decreases with altitude (typically ~6.5 °C per 1,000 m).' },
      { term: 'Interception & root binding', definition: 'Ways vegetation slows surface runoff and shields soil from hydraulic erosion.' },
    ],
  },
];

const surf = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
const fmtVol = (v: number) =>
  Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)} km³` : Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(2)}M m³` : `${Math.round(v).toLocaleString()} m³`;

/**
 * Step 3: Build a quantitative GCSE Evidence Report comparing `beforeWorld` against the current `engine` state.
 */
export function buildEvidenceReport(
  beforeWorld: WorldState,
  engine: Engine,
  investigationId: string,
  customHypothesis?: string,
): EvidenceReport {
  const inv = INVESTIGATIONS.find((x) => x.id === investigationId) ?? INVESTIGATIONS[0];
  const hypothesis = customHypothesis?.trim() || inv.hypotheses[0];
  const w = engine.world;
  const W = w.width;
  const H = w.height;
  const n = W * H;
  const cs = w.cellSizeM;
  const cellArea = cs * cs;

  let erodedM3 = 0;
  let depositedM3 = 0;
  let maxCutM = 0;
  let maxFillM = 0;
  const preZ = new Float32Array(n);
  const nowZ = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    preZ[i] = surf(beforeWorld, i);
    nowZ[i] = surf(w, i);
    const dz = nowZ[i] - preZ[i];
    if (dz < -1e-3) {
      erodedM3 += -dz * cellArea;
      if (-dz > maxCutM) maxCutM = -dz;
    } else if (dz > 1e-3) {
      depositedM3 += dz * cellArea;
      if (dz > maxFillM) maxFillM = dz;
    }
  }

  const geoY = (w.meta.geologicYears ?? 0) - (beforeWorld.meta.geologicYears ?? 0);
  const simS = w.simTimeSeconds - beforeWorld.simTimeSeconds;
  const elapsedText =
    geoY > 0 && simS > 60
      ? `${Math.round(geoY).toLocaleString()} geological yrs + ${(simS / 3600).toFixed(1)} water hrs`
      : geoY > 0
        ? `${Math.round(geoY).toLocaleString()} geological years`
        : `${(simS / 3600).toFixed(1)} simulated hours`;

  const metrics: MeasuredMetric[] = [
    {
      label: 'Total volume eroded / lowered',
      before: '0 m³',
      after: fmtVol(erodedM3),
      change: `Max cut −${maxCutM.toFixed(1)} m`,
    },
    {
      label: 'Total volume deposited / raised',
      before: '0 m³',
      after: fmtVol(depositedM3),
      change: `Max build +${maxFillM.toFixed(1)} m`,
    },
  ];

  let profileTitle = 'Representative cross-section profile (Before vs. After)';
  const profile: ProfilePoint[] = [];
  const sampleLine = (ax: number, ay: number, bx: number, by: number, steps = 80) => {
    const L = Math.hypot(bx - ax, by - ay) || 1;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const x = Math.min(W - 1, Math.max(0, Math.round((ax + (bx - ax) * t) / cs)));
      const y = Math.min(H - 1, Math.max(0, Math.round((ay + (by - ay) * t) / cs)));
      const i = y * W + x;
      profile.push({ distM: t * L, beforeM: preZ[i], afterM: nowZ[i] });
    }
  };

  let evidenceSentence = '';

  if (inv.topic === 'rivers') {
    const m = engine.geoMeander;
    const coursesAfter = analyzeRiverCourses(w, engine.water.vx, engine.water.vy);
    const coursesBefore = analyzeRiverCourses(beforeWorld);
    if (m) {
      const sinNow = sinuosity(m);
      const bends = meanderBends(m);
      const sharpest = bends.sort((a, b) => Math.abs(b.curvature) - Math.abs(a.curvature))[0];
      const cliffH = sharpest ? bankHeight(w, m, sharpest.k, sharpest.outer) : 0;
      const lv = leveeHeight(w, m, Math.min(500, m.params.widthM * 8));
      const est = estuaryMetrics(w, m);
      metrics.push(
        {
          label: 'Channel sinuosity (channel ÷ valley length)',
          before: '1.05×',
          after: `${sinNow.toFixed(2)}×`,
          change: `+${(sinNow - 1.05).toFixed(2)} (${sinNow > 1.5 ? 'meandering' : 'winding'})`,
        },
        {
          label: 'Outer-bank river cliff height & oxbow cut-offs',
          before: '0 cut-offs',
          after: `${cliffH.toFixed(1)} m cliff · ${m.cutoffs} oxbow cut-off${m.cutoffs === 1 ? '' : 's'}`,
          change: `${fmtVol(m.cutM3)} bank eroded`,
        },
        {
          label: 'Natural levee height & floodplain aggradation',
          before: '0.00 m',
          after: `+${lv.heightM.toFixed(2)} m levees`,
          change: `${fmtVol(m.overbankM3)} flood mud`,
        },
      );
      if (est) {
        metrics.push({
          label: 'Tidal estuary width at river mouth',
          before: `${Math.round(est.upstreamWidthM)} m`,
          after: `${Math.round(est.mouthWidthM)} m`,
          change: `${est.widenFactor.toFixed(1)}× wider mouth`,
        });
      }
      evidenceSentence = `Over ${elapsedText}, the lowland river's sinuosity increased to ${sinNow.toFixed(2)}× as lateral hydraulic action and abrasion eroded ${fmtVol(m.cutM3)} from outer-bank river cliffs (up to ${cliffH.toFixed(1)} m high) while helicoidal flow deposited ${fmtVol(m.barM3)} on inner-bend slip-off slopes, producing ${m.cutoffs} neck cut-off oxbow lake(s), +${lv.heightM.toFixed(2)} m natural levees (${fmtVol(m.overbankM3)} overbank mud),${est ? ` and a tidal estuary widened to ${Math.round(est.mouthWidthM)} m (${est.widenFactor.toFixed(1)}× channel width)` : ''}.`;
    } else if (coursesAfter && coursesBefore) {
      const upA = coursesAfter.reaches[0];
      const loA = coursesAfter.reaches[2];
      const upB = coursesBefore.reaches[0];
      metrics.push(
        {
          label: 'Upper course valley depth & gradient',
          before: `${Math.round(upB.valley.depthM)} m · ${upB.gradientDeg.toFixed(1)}°`,
          after: `${Math.round(upA.valley.depthM)} m · ${upA.gradientDeg.toFixed(1)}°`,
          change: `Δdepth ${(upA.valley.depthM - upB.valley.depthM >= 0 ? '+' : '') + (upA.valley.depthM - upB.valley.depthM).toFixed(1)} m`,
        },
        {
          label: 'Lower course floodplain width & alluvium',
          before: `${Math.round(coursesBefore.reaches[2].valley.floorM)} m floor`,
          after: `${Math.round(loA.valley.floorM)} m floor · ${loA.sedimentM.toFixed(1)} m soil`,
          change: `Catchment ${loA.drainageAreaKm2.toFixed(1)} km²`,
        },
      );
      evidenceSentence = `Over ${elapsedText}, vertical erosion in the steep upper course (${upA.gradientDeg.toFixed(1)}° gradient) carved a V-shaped valley ${Math.round(upA.valley.depthM)} m deep, while downstream in the gentle lower course (${loA.gradientDeg.toFixed(2)}° gradient, ${loA.drainageAreaKm2.toFixed(1)} km² drainage basin) the river built a ${Math.round(loA.valley.floorM)} m wide floodplain with ${loA.sedimentM.toFixed(1)} m of alluvial sediment.`;
    }
    profileTitle = 'Valley cross-section across the middle/lower river course';
    sampleLine(0, (H * 0.5) * cs, (W - 1) * cs, (H * 0.5) * cs);
  } else if (inv.topic === 'coasts') {
    // Measure shoreline retreat on hard rock (erodibility <= 0.65) vs soft rock (erodibility > 0.65)
    const sl = w.seaLevelM;
    let softRetreatSum = 0;
    let softCount = 0;
    let hardRetreatSum = 0;
    let hardCount = 0;
    for (let y = 2; y < H - 2; y++) {
      let preShoreX = -1;
      let nowShoreX = -1;
      for (let x = 0; x < W; x++) {
        if (preZ[y * W + x] >= sl) preShoreX = x;
        if (nowZ[y * W + x] >= sl) nowShoreX = x;
      }
      if (preShoreX > 0 && nowShoreX > 0 && preShoreX !== nowShoreX) {
        const retreatM = Math.abs(preShoreX - nowShoreX) * cs;
        const mat = w.materialId[y * W + Math.min(preShoreX, nowShoreX)];
        const erod = MATERIALS[mat]?.erodibility ?? 1;
        if (erod > 0.65) {
          softRetreatSum += retreatM;
          softCount++;
        } else {
          hardRetreatSum += retreatM;
          hardCount++;
        }
      }
    }
    const softMean = softCount > 0 ? softRetreatSum / softCount : 0;
    const hardMean = hardCount > 0 ? hardRetreatSum / hardCount : 0;
    const jutM = Math.max(0, softMean - hardMean);
    const hf = engine.coast.findHeadlandFeatures();
    metrics.push(
      {
        label: 'Soft rock (clay/mudstone) bay retreat',
        before: '0 m',
        after: `${softMean.toFixed(0)} m`,
        change: softMean > hardMean ? `${(softMean / Math.max(1, hardMean)).toFixed(1)}× faster than headland` : ` Cliff eroded ${fmtVol(engine.coast.ledger.cliffEroded)}`,
      },
      {
        label: 'Resistant rock (chalk/granite) headland retreat',
        before: '0 m',
        after: `${hardMean.toFixed(0)} m`,
        change: `Headlands jut ${jutM.toFixed(0)} m seaward`,
      },
      {
        label: 'Longshore drift & headland features',
        before: 'Straight cliff',
        after: `${fmtVol(engine.coast.ledger.drifted)} drifted${hf.length ? ` · ${hf.length} cave/arch/stack` : ''}`,
        change: `${fmtVol(engine.coast.ledger.nearshoreDeposited)} nearshore/beach`,
      },
    );
    evidenceSentence = `Over ${elapsedText}, differential marine erosion wore back soft rock bays by an average of ${softMean.toFixed(0)} m compared with ${hardMean.toFixed(0)} m on resistant headlands (leaving headlands jutting ${jutM.toFixed(0)} m seaward), while waves eroded ${fmtVol(engine.coast.ledger.cliffEroded)} of cliff material and longshore drift transported ${fmtVol(engine.coast.ledger.drifted)} of beach sediment alongshore.`;
    profileTitle = 'Cross-shore profile across cliff, wave-cut platform and nearshore';
    sampleLine(0, (H * 0.35) * cs, (W - 1) * cs, (H * 0.35) * cs);
  } else if (inv.topic === 'glaciers') {
    const snowlineM = w.seaLevelM + Math.max(0, (w.climate.seaLevelTempC - w.glacier.elaTempC) / Math.max(1e-3, w.climate.lapseRateCPerKm / 1000));
    const gf = findGlacialFeatures(w, preZ, w.iceThicknessM, engine.moraineField(), snowlineM, engine.glacialErosionField());
    const deepM = gf.trough?.deepenedM ?? maxCutM;
    const wBefore = gf.trough?.before.floorM ?? cs * 2;
    const wAfter = gf.trough?.after.floorM ?? cs * 4;
    const morM = gf.terminal?.thickM ?? gf.moraine?.thickM ?? maxFillM;
    metrics.push(
      {
        label: 'Glacial trough deepening & floor widening',
        before: `${Math.round(wBefore)} m floor (V-valley)`,
        after: `${Math.round(wAfter)} m floor (U-trough)`,
        change: `Deepened ${deepM.toFixed(0)} m`,
      },
      {
        label: 'Upland corries, arêtes & hanging valleys',
        before: 'River headwaters',
        after: `${gf.corries.length} corrie(s)${gf.hanging ? ` · ${Math.round(gf.hanging.dropM)} m hanging valley` : ''}`,
        change: gf.arete ? `Arête ${gf.arete.sideDeg.toFixed(0)}° sides` : 'Glacial abrasion & plucking',
      },
      {
        label: 'Moraine & subglacial till deposits',
        before: '0 m till',
        after: `Up to ${morM.toFixed(1)} m moraine`,
        change: gf.drumlin ? `Drumlin ${gf.drumlin.heightM.toFixed(1)} m high` : fmtVol(depositedM3),
      },
    );
    evidenceSentence = `Over ${elapsedText}, glacial plucking and abrasion deepened the main valley by ${deepM.toFixed(0)} m and widened its floor from ${Math.round(wBefore)} m to ${Math.round(wAfter)} m (transforming a V-shaped valley into a U-shaped glacial trough), carved ${gf.corries.length} upland corrie hollow(s)${gf.hanging ? ` and a ${Math.round(gf.hanging.dropM)} m hanging valley` : ''}, and deposited moraines up to ${morM.toFixed(1)} m thick.`;
    profileTitle = 'Cross-valley profile: V-shaped pre-glacial valley vs. U-shaped glacial trough';
    sampleLine((W * 0.2) * cs, (H * 0.5) * cs, (W * 0.8) * cs, (H * 0.5) * cs);
  } else {
    // Slopes, Tectonics, Climate or Custom investigation
    const maxSlope = (arr: Float32Array) => {
      let m = 0;
      for (let y = 1; y < H - 1; y++)
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const s = Math.hypot(arr[i + 1] - arr[i - 1], arr[i + W] - arr[i - W]) / (2 * cs);
          if (s > m) m = s;
        }
      return (Math.atan(m) * 180) / Math.PI;
    };
    const sBefore = maxSlope(preZ);
    const sAfter = maxSlope(nowZ);
    metrics.push(
      {
        label: 'Steepest slope angle on the landscape',
        before: `${sBefore.toFixed(1)}°`,
        after: `${sAfter.toFixed(1)}°`,
        change: `${(sAfter - sBefore >= 0 ? '+' : '') + (sAfter - sBefore).toFixed(1)}°`,
      },
      {
        label: 'Surface water & vegetation cover',
        before: `${(100 * beforeWorld.vegCover.reduce((a, v) => a + v, 0) / n).toFixed(1)}% plants`,
        after: `${(100 * w.vegCover.reduce((a, v) => a + v, 0) / n).toFixed(1)}% plants`,
        change: `Water stored ${fmtVol(engine.water.storedVolume())}`,
      },
    );
    evidenceSentence = `Over ${elapsedText}, physical processes eroded ${fmtVol(erodedM3)} (maximum lowering ${maxCutM.toFixed(1)} m) and deposited ${fmtVol(depositedM3)} (maximum build-up +${maxFillM.toFixed(1)} m), changing peak slope angles from ${sBefore.toFixed(1)}° to ${sAfter.toFixed(1)}° while conserving total mass across the landscape.`;
    sampleLine((W * 0.15) * cs, (H * 0.5) * cs, (W * 0.85) * cs, (H * 0.5) * cs);
  }

  const vocabTerms = inv.vocabulary.map((v) => v.term);
  const annotatedLandforms: string[] = [];
  if (inv.topic === 'rivers') {
    annotatedLandforms.push(
      'Outer-bend river cliff (hydraulic action & abrasion)',
      'Inner-bend slip-off slope / point bar (helicoidal deposition)',
      'Cut-off oxbow lake & raised natural levees',
      'Funnel-shaped tidal estuary & intertidal mudflats',
    );
  } else if (inv.topic === 'coasts') {
    annotatedLandforms.push(
      'Hard-rock headland (wave refraction focus > 1.35×)',
      'Sloping wave-cut platform (< 4° rocky ledge)',
      'Headland cave / arch / stack / stump sequence',
      'Sheltered soft-clay bay & constructive sandy beach berm above sea level',
    );
  } else if (inv.topic === 'glaciers') {
    annotatedLandforms.push(
      'North-east armchair corrie (cirque) & over-deepened tarn',
      'Knife-edge arête & pyramidal peak',
      'Steep-sided, flat-floored U-shaped glacial trough & hanging valley',
      'Terminal, lateral & recessional moraines + lowland drumlins & erratics',
    );
  } else if (inv.topic === 'slopes') {
    annotatedLandforms.push(
      'Weathered upper escarpment failure scar',
      'Saturated regolith slip plane (reduced angle of repose)',
      'Basal concave talus (scree) apron / rotational slump toe lobe',
    );
  } else if (inv.topic === 'tectonics') {
    annotatedLandforms.push(
      'Compressional fold mountain belt (anticlines & synclines) / fault scarp',
      'Subduction ocean trench / divergent rift graben',
      'Volcanic shield / composite stratovolcano cone & river-incised gorges',
    );
  } else {
    annotatedLandforms.push(
      'Wet windward slope (orographic uplift, condensation & dense vegetation)',
      'High-altitude snowpack above 0 °C isotherm (environmental lapse rate)',
      'Dry leeward rain shadow & reduced river discharge',
    );
  }

  const cleanStep = (s: string) => s.replace(/^\d+\.\s*/, '');
  const modelAnswer4Mark = `${cleanStep(inv.processSequence[0])} Consequently, ${cleanStep(inv.processSequence[1]).charAt(0).toLowerCase() + cleanStep(inv.processSequence[1]).slice(1)} ${cleanStep(inv.processSequence[2])}`;
  const examParagraph = `${cleanStep(inv.processSequence[0])} ${cleanStep(inv.processSequence[1])} ${evidenceSentence} Therefore, the measured simulator evidence directly supports the hypothesis: "${hypothesis}"`;

  return {
    investigation: inv,
    hypothesis,
    worldName: w.meta.name,
    elapsedText,
    metrics,
    annotatedLandforms,
    processSequence: inv.processSequence,
    vocabularyUsed: vocabTerms,
    modelAnswer4Mark,
    examParagraph,
    profileTitle,
    profile,
  };
}

/**
 * M17-C04: Render a downloadable, classroom-ready GCSE Evidence Sheet PNG
 * including Student Name & Class, Enquiry Question, Prediction, Annotated Before & After Maps,
 * Cross-Section Profile, Measured Evidence Table, Annotated Landforms, Student Explanation,
 * Model Answer, and Teacher Feedback / Mark Box.
 */
export async function exportEvidenceSheetPng(
  report: EvidenceReport,
  beforeImgUrl: string | null,
  afterImgUrl: string | null,
  meta: EvidenceStudentMeta = {},
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 1240;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#10231b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header bar with Student Name, Class & Enquiry Question
  ctx.fillStyle = '#183529';
  ctx.fillRect(0, 0, canvas.width, 96);
  ctx.fillStyle = '#ffe627';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`GCSE Geography Evidence Sheet — ${report.investigation.title}`, 32, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  const studentLine = `Student: ${meta.studentName?.trim() || '____________________'}   ·   Class: ${meta.studentClass?.trim() || '__________'}   ·   World: ${report.worldName} (${report.elapsedText})`;
  ctx.fillText(studentLine, 32, 56);
  ctx.fillStyle = '#9fd0ea';
  ctx.font = 'italic 14px system-ui, sans-serif';
  ctx.fillText(`Enquiry Question: ${report.investigation.question.slice(0, 125)}`, 32, 80);

  const loadImg = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

  // 1. Before & After visual frames (top left) with landform annotation callouts on After map
  const drawFrame = async (url: string | null, x: number, y: number, w: number, h: number, label: string, annotations?: string[]) => {
    ctx.fillStyle = '#0b1812';
    ctx.fillRect(x, y, w, h);
    if (url) {
      try {
        const img = await loadImg(url);
        ctx.drawImage(img, x, y, w, h);
      } catch {
        // fallback if image unavailable
      }
    }
    ctx.strokeStyle = '#2d5342';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(16, 35, 27, 0.88)';
    ctx.fillRect(x + 8, y + 8, 195, 26);
    ctx.fillStyle = '#ffe627';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(label, x + 14, y + 26);
    if (annotations && annotations.length > 0) {
      const pts = [
        [x + 16, y + h - 58],
        [x + 16, y + h - 30],
      ];
      annotations.slice(0, 2).forEach((ann, idx) => {
        const [bx, by] = pts[idx];
        ctx.fillStyle = 'rgba(12, 28, 21, 0.88)';
        ctx.fillRect(bx, by, w - 32, 22);
        ctx.strokeStyle = '#ffe627';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, w - 32, 22);
        ctx.fillStyle = '#ffe627';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.fillText(`📍 ${ann.slice(0, 52)}`, bx + 8, by + 15);
      });
    }
  };

  await drawFrame(beforeImgUrl, 32, 112, 410, 245, '1. BEFORE (Baseline)');
  await drawFrame(afterImgUrl, 458, 112, 410, 245, '2. AFTER (Annotated)', report.annotatedLandforms);

  // 2. Before vs After Cross-Section Chart (top right)
  const cx = 888;
  const cy = 112;
  const cw = 480;
  const ch = 245;
  ctx.fillStyle = '#152d23';
  ctx.fillRect(cx, cy, cw, ch);
  ctx.strokeStyle = '#2d5342';
  ctx.strokeRect(cx, cy, cw, ch);
  ctx.fillStyle = '#ffe627';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`3. ${report.profileTitle}`, cx + 16, cy + 26);

  if (report.profile.length > 1) {
    const pts = report.profile;
    let zLo = Infinity;
    let zHi = -Infinity;
    for (const p of pts) {
      zLo = Math.min(zLo, p.beforeM, p.afterM);
      zHi = Math.max(zHi, p.beforeM, p.afterM);
    }
    const span = Math.max(5, zHi - zLo);
    zLo -= span * 0.1;
    zHi += span * 0.1;
    const dMax = Math.max(1, pts[pts.length - 1].distM);
    const px = (d: number) => cx + 44 + (d / dMax) * (cw - 64);
    const py = (z: number) => cy + 44 + (1 - (z - zLo) / (zHi - zLo)) * (ch - 74);

    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#bf62a8';
    ctx.lineWidth = 2;
    pts.forEach((p, k) => (k === 0 ? ctx.moveTo(px(p.distM), py(p.beforeM)) : ctx.lineTo(px(p.distM), py(p.beforeM))));
    ctx.stroke();

    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#d9781c';
    ctx.lineWidth = 2.5;
    pts.forEach((p, k) => (k === 0 ? ctx.moveTo(px(p.distM), py(p.afterM)) : ctx.lineTo(px(p.distM), py(p.afterM))));
    ctx.stroke();

    ctx.fillStyle = '#bf62a8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('--- Before profile', cx + 44, cy + ch - 10);
    ctx.fillStyle = '#d9781c';
    ctx.fillText('─── After profile', cx + 170, cy + ch - 10);
  }

  // 3. Hypothesis & Measured Evidence Table (middle left)
  ctx.fillStyle = '#152d23';
  ctx.fillRect(32, 372, 660, 285);
  ctx.strokeStyle = '#2d5342';
  ctx.strokeRect(32, 372, 660, 285);
  ctx.fillStyle = '#ffe627';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('4. PREDICT & MEASURE — Quantitative Simulator Evidence', 48, 398);

  ctx.fillStyle = '#b9cec3';
  ctx.font = 'italic 12px system-ui, sans-serif';
  ctx.fillText(`Prediction: "${report.hypothesis.slice(0, 96)}${report.hypothesis.length > 96 ? '…' : ''}"`, 48, 420);

  let ty = 448;
  ctx.fillStyle = '#ffe627';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('Measured Indicator', 48, ty);
  ctx.fillText('Before', 330, ty);
  ctx.fillText('After', 445, ty);
  ctx.fillText('Change / Significance', 560, ty);
  ty += 10;
  ctx.strokeStyle = '#2d5342';
  ctx.beginPath();
  ctx.moveTo(48, ty);
  ctx.lineTo(676, ty);
  ctx.stroke();

  ctx.font = '13px system-ui, sans-serif';
  for (const m of report.metrics.slice(0, 5)) {
    ty += 34;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(m.label.slice(0, 38), 48, ty);
    ctx.fillStyle = '#b9cec3';
    ctx.fillText(m.before.slice(0, 16), 330, ty);
    ctx.fillStyle = '#5ce080';
    ctx.fillText(m.after.slice(0, 18), 445, ty);
    ctx.fillStyle = '#ffe627';
    ctx.fillText(m.change.slice(0, 20), 560, ty);
  }

  // 4. Annotated Landforms & Physical Process Sequence (middle right)
  ctx.fillStyle = '#152d23';
  ctx.fillRect(712, 372, 656, 285);
  ctx.strokeStyle = '#2d5342';
  ctx.strokeRect(712, 372, 656, 285);
  ctx.fillStyle = '#ffe627';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('5. ANNOTATED LANDFORMS & PROCESS SEQUENCE', 728, 398);

  const wrapText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, curY);
        line = w;
        curY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, curY);
      curY += lineHeight;
    }
    return curY;
  };

  let pySeq = 422;
  ctx.fillStyle = '#5ce080';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`Landforms identified: ${report.annotatedLandforms.slice(0, 2).join(' · ')}`, 728, pySeq);
  pySeq += 22;
  ctx.fillStyle = '#e8f0ec';
  ctx.font = '12.5px system-ui, sans-serif';
  for (const step of report.processSequence) {
    pySeq = wrapText(step, 728, pySeq, 624, 17) + 5;
  }

  // 5. Student Explanation & Model GCSE Answer (lower band)
  ctx.fillStyle = '#152d23';
  ctx.fillRect(32, 674, 1336, 360);
  ctx.strokeStyle = '#2d5342';
  ctx.strokeRect(32, 674, 1336, 360);
  ctx.fillStyle = '#ffe627';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const qText = meta.selectedMark === 4 ? report.investigation.question4Mark : report.investigation.question6Mark;
  ctx.fillText(`6. EXPLAIN — ${qText.slice(0, 115)}`, 48, 702);

  ctx.fillStyle = '#9fd0ea';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('Student Written Explanation:', 48, 728);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  const studentAns =
    meta.studentExplanation?.trim() ||
    '(No student explanation entered before export — see Data-Backed Model GCSE Answer below.)';
  let yAfterStudent = wrapText(studentAns, 48, 750, 1300, 21);

  yAfterStudent = Math.max(yAfterStudent + 14, 860);
  ctx.fillStyle = '#5ce080';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`Model GCSE Reference Answer (Vocabulary: ${report.vocabularyUsed.join(' · ')}):`, 48, yAfterStudent);
  ctx.fillStyle = '#e0ece5';
  ctx.font = '13.5px system-ui, sans-serif';
  wrapText(meta.selectedMark === 4 ? report.modelAnswer4Mark : report.examParagraph, 48, yAfterStudent + 22, 1300, 20);

  // 6. Teacher Feedback & Mark Box (bottom)
  ctx.fillStyle = '#183529';
  ctx.fillRect(32, 1050, 1336, 160);
  ctx.strokeStyle = '#ffe627';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32, 1050, 1336, 160);
  ctx.fillStyle = '#ffe627';
  ctx.font = 'bold 15px system-ui, sans-serif';
  const maxM = meta.selectedMark === 4 ? 4 : 6;
  ctx.fillText(`7. TEACHER ASSESSMENT & FEEDBACK   [ Mark: ${meta.teacherMark?.trim() || `___ / ${maxM}`} ]`, 48, 1078);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, sans-serif';
  if (meta.teacherFeedback?.trim()) {
    wrapText(meta.teacherFeedback.trim(), 48, 1106, 1300, 22);
  } else {
    ctx.fillText('WWW (What Went Well): ___________________________________________________________________________________________', 48, 1112);
    ctx.fillText('EBI (Even Better If): _____________________________________________________________________________________________', 48, 1150);
    ctx.fillText('Student Response / Action: _______________________________________________________________________________________', 48, 1188);
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode Evidence Sheet PNG'))), 'image/png'));
}

/**
 * M17-C04: Open a clean A4 portrait printable worksheet in a print window (or trigger browser print)
 * formatted specifically for monochrome/colour school printers and PDF saving.
 */
export function printEvidenceSheetA4(
  report: EvidenceReport,
  beforeImgUrl: string | null,
  afterImgUrl: string | null,
  meta: EvidenceStudentMeta = {},
): void {
  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) {
    window.print();
    return;
  }
  const maxM = meta.selectedMark === 4 ? 4 : 6;
  const qText = meta.selectedMark === 4 ? report.investigation.question4Mark : report.investigation.question6Mark;
  const modelText = meta.selectedMark === 4 ? report.modelAnswer4Mark : report.examParagraph;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>GCSE Geography Evidence Sheet — ${esc(report.investigation.title)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; padding: 0; font-size: 11pt; line-height: 1.38; }
    .header { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 10px; }
    .header h1 { font-size: 15pt; margin: 0 0 4px 0; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 10pt; margin-bottom: 6px; }
    .eq { background: #f3f5f4; border-left: 4px solid #205b41; padding: 6px 10px; font-weight: 600; margin-bottom: 10px; }
    .maps { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .map-box { border: 1px solid #888; padding: 4px; text-align: center; }
    .map-box img { width: 100%; height: 155px; object-fit: cover; display: block; }
    .map-box b { display: block; font-size: 9.5pt; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 9.5pt; }
    th, td { border: 1px solid #666; padding: 4px 6px; text-align: left; }
    th { background: #eaeaea; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; font-size: 9.5pt; }
    .box { border: 1px solid #666; padding: 6px 8px; border-radius: 4px; }
    .box h3 { margin: 0 0 4px 0; font-size: 10.5pt; }
    .student-ans { min-height: 85px; white-space: pre-wrap; border: 1px solid #444; padding: 8px; margin-bottom: 10px; background: #fafafa; }
    .teacher-box { border: 2px solid #111; padding: 8px 10px; margin-top: 8px; }
    .teacher-box h3 { margin: 0 0 6px 0; display: flex; justify-content: space-between; font-size: 11pt; }
    .line { border-bottom: 1px dotted #777; height: 22px; margin-bottom: 4px; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="background:#183529;color:#fff;padding:8px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
    <span>Clean A4 Classroom Print View — Ready for Printer or "Save as PDF"</span>
    <button onclick="window.print()" style="padding:6px 14px;font-weight:bold;cursor:pointer;">🖨 Print / Save PDF</button>
  </div>
  <div class="header">
    <h1>GCSE Geography Investigation Evidence Sheet — ${esc(report.investigation.title)}</h1>
    <div class="meta-grid">
      <div><b>Student Name:</b> ${esc(meta.studentName?.trim() || '______________________')}</div>
      <div><b>Class / Set:</b> ${esc(meta.studentClass?.trim() || '____________')}</div>
      <div><b>World & Duration:</b> ${esc(report.worldName)} (${esc(report.elapsedText)})</div>
    </div>
  </div>
  <div class="eq">
    <div>Enquiry Question: ${esc(report.investigation.question)}</div>
    <div style="font-weight:normal;font-size:9.5pt;margin-top:3px;"><b>Prediction:</b> ${esc(report.hypothesis)} ${meta.predictionWhy?.trim() ? `— <i>Because: ${esc(meta.predictionWhy.trim())}</i>` : ''}</div>
  </div>
  <div class="maps">
    <div class="map-box">
      <b>1. BEFORE (Baseline Landscape)</b>
      ${beforeImgUrl ? `<img src="${beforeImgUrl}" alt="Before map" />` : '<div style="height:155px;display:flex;align-items:center;justify-content:center;">Baseline snapshot</div>'}
    </div>
    <div class="map-box">
      <b>2. AFTER (Observed Landscape & Landforms)</b>
      ${afterImgUrl ? `<img src="${afterImgUrl}" alt="After map" />` : '<div style="height:155px;display:flex;align-items:center;justify-content:center;">Observed snapshot</div>'}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Measured Indicator (SI Units)</th><th>Before</th><th>After</th><th>Measured Change (Δ)</th></tr>
    </thead>
    <tbody>
      ${report.metrics.map((m) => `<tr><td><b>${esc(m.label)}</b></td><td>${esc(m.before)}</td><td>${esc(m.after)}</td><td><b>${esc(m.change)}</b></td></tr>`).join('')}
    </tbody>
  </table>
  <div class="two-col">
    <div class="box">
      <h3>Annotated Landforms Observed</h3>
      <ul style="margin:0;padding-left:18px;">
        ${report.annotatedLandforms.map((l) => `<li>${esc(l)}</li>`).join('')}
      </ul>
    </div>
    <div class="box">
      <h3>Physical Process Sequence</h3>
      <ol style="margin:0;padding-left:18px;">
        ${report.processSequence.map((s) => `<li>${esc(s.replace(/^\d+\.\s*/, ''))}</li>`).join('')}
      </ol>
    </div>
  </div>
  <div>
    <b>Exam Question (${maxM} marks):</b> ${esc(qText)}
  </div>
  <div class="student-ans">${esc(meta.studentExplanation?.trim() || '')}</div>
  <div class="box" style="margin-bottom:8px;font-size:9pt;background:#f7faf8;">
    <b>Model GCSE Reference Answer (Key terms: ${esc(report.vocabularyUsed.join(', '))}):</b><br/>
    ${esc(modelText)}
  </div>
  <div class="teacher-box">
    <h3><span>Teacher Feedback (WWW / EBI)</span><span>Mark: ${esc(meta.teacherMark?.trim() || `____ / ${maxM}`)}</span></h3>
    ${
      meta.teacherFeedback?.trim()
        ? `<div>${esc(meta.teacherFeedback.trim())}</div>`
        : `<div class="line"><b>WWW:</b> </div><div class="line"><b>EBI:</b> </div>`
    }
  </div>
</body>
</html>`);
  win.document.close();
}
