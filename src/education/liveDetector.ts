import type { Engine } from '../engine/engine';
import type { WorldState } from '../engine/world';
import { MATERIALS } from '../terrain/materials';
import { sinuosity } from '../sim/geology/meander';
import { activeHeadlandInfo, activeWaterfallInfo } from '../sim/geology/coupledPatches';
import {
  bankHeight,
  cellXY,
  crossSection,
  estuaryMetrics,
  findSpurs,
  findWaterfall,
  leveeHeight,
  mainRiver,
  meanderBends,
} from './geoFeatures';
import { at as glAt, findGlacialFeatures } from './glacialFeatures';

/**
 * M20-C02: Universal Live GCSE Landform & Process Detector.
 * Continuously inspects the current 3D landscape (in both Water Time and Geological Time)
 * and returns measured on-map 3D labels + clickable HUD chips that fly the camera directly
 * to each forming landform and explain the physical processes acting there.
 */

export interface LiveLandformItem {
  id: string;
  category: 'river' | 'coast' | 'glacial' | 'tectonic';
  badge: string;
  text: string;
  process: string;
  xM: number;
  yM: number;
  distanceM?: number;
}

const surf = (w: WorldState, i: number) => w.bedrockElevationM[i] + w.looseSedimentThicknessM[i];
const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export function detectLiveLandforms(engine: Engine): LiveLandformItem[] {
  const w = engine.world;
  const W = w.width;
  const H = w.height;
  const cs = w.cellSizeM;
  const items: LiveLandformItem[] = [];

  // 1. Dedicated 1 m Solid Waterfall OR Embedded 3D Voxel Waterfall Patch
  const wf3d = activeWaterfallInfo(w);
  if (wf3d) {
    const stageWord =
      wf3d.retreatM > 0 && wf3d.collapsedM3 > 0
        ? `Gorge retreating upstream (${wf3d.retreatM} m)`
        : wf3d.undercutM > 0
          ? `Undercutting overhang (${wf3d.undercutM} m) & plunge pool`
          : `Knickpoint step (${Math.round(wf3d.dropM)} m drop)`;
    items.push({
      id: 'waterfall-3d',
      category: 'river',
      badge: `🌊 3D Waterfall & Gorge (${wf3d.retreatM} m retreat)`,
      text: `3D Waterfall: ${stageWord} · pool ${wf3d.poolDepthM.toFixed(1)} m deep · Q = ${wf3d.dischargeM3PerS.toFixed(0)} m³/s`,
      process:
        'Hydraulic action & abrasion erode soft shale beneath hard caprock, scouring a plunge pool and undercutting an overhang until unsupported caprock collapses, retreating upstream to leave a gorge.',
      xM: wf3d.xM,
      yM: wf3d.yM,
      distanceM: wf3d.distanceM,
    });
  }

  // 2. Dedicated 1 m Solid Headland OR Embedded 3D Voxel Headland (Cave → Arch → Stack → Stump)
  const hd3d = activeHeadlandInfo(w);
  if (hd3d) {
    const stageCap = hd3d.stage.charAt(0).toUpperCase() + hd3d.stage.slice(1);
    items.push({
      id: 'headland-3d',
      category: 'coast',
      badge: `🪨 3D Headland: ${stageCap}`,
      text: `3D Coastal Headland (${stageCap}): ${hd3d.exportedM3.toLocaleString()} m³ eroded/collapsed along rock joint`,
      process:
        'Waves attack rock joints between low and high tide by hydraulic action and abrasion: enlarging a joint into a sea cave, breaking through the headland as an arch, collapsing the unsupported roof to leave a stack, and undercutting it into a stump.',
      xM: hd3d.xM,
      yM: hd3d.yM,
      distanceM: hd3d.distanceM,
    });
  }

  // If this is a dedicated 1 m mini-world, return its focused label immediately
  if (w.meta.solidWaterfall || w.meta.solidHeadland) {
    return items;
  }

  // 3. River Course Landforms (V-shaped valley, interlocking spurs, heightfield waterfall/gorge)
  const p = mainRiver(w, 12);
  if (p.cells.length >= 12) {
    const N = p.cells.length;
    // Upper course V-shaped valley
    const kUpper = Math.min(N - 3, Math.floor(N * 0.72));
    const xsUpper = crossSection(w, p, kUpper, Math.min(800, cs * 16));
    if (xsUpper.depthM >= 12 && xsUpper.sideDeg >= 6) {
      const pos = cellXY(w, p.cells[kUpper]);
      items.push({
        id: 'v-valley',
        category: 'river',
        badge: `⛰ V-Shaped Valley (${Math.round(xsUpper.depthM)} m deep)`,
        text: `V-shaped valley (Upper course): ${Math.round(xsUpper.depthM)} m deep, sides ${Math.round(xsUpper.sideDeg)}° — vertical erosion & mass movement`,
        process:
          'Steep upper-course gradient concentrates stream power into vertical erosion (abrasion & hydraulic action), while freeze-thaw weathering and mass movement down the valley sides create a V-shaped cross-profile.',
        xM: pos.xM,
        yM: pos.yM,
        distanceM: Math.max(450, cs * 18),
      });
    }

    // Interlocking spurs
    const spurs = findSpurs(w, p, Math.floor(N * 0.42), N - 3, 5, 14).sort((a, b) => b.heightM - a.heightM);
    if (spurs.length > 0) {
      const s0 = spurs[0];
      const pos = cellXY(w, s0.cell);
      items.push({
        id: 'interlocking-spur',
        category: 'river',
        badge: `🔀 Interlocking Spurs (${Math.round(s0.heightM)} m)`,
        text: `Interlocking spur: ridge ${Math.round(s0.heightM)} m above winding upper-course river`,
        process:
          'In the upper course, vertical erosion dominates and the river lacks lateral energy to cut through projecting ridges of resistant rock, winding around alternating interlocking spurs.',
        xM: pos.xM,
        yM: pos.yM,
        distanceM: Math.max(450, cs * 18),
      });
    }

    // Heightfield waterfall / knickpoint (if not close to the embedded 3D waterfall)
    const wf = findWaterfall(w, p, Math.max(120, cs * 5), 10);
    if (wf) {
      const pos = cellXY(w, wf.lip);
      const near3d = wf3d && Math.hypot(pos.xM - wf3d.xM, pos.yM - wf3d.yM) < cs * 8;
      if (!near3d) {
        items.push({
          id: 'waterfall-knickpoint',
          category: 'river',
          badge: `💧 Waterfall & Gorge (${Math.round(wf.dropM)} m drop)`,
          text: `Waterfall & gorge: drops ${Math.round(wf.dropM)} m over ${wf.lipRock} onto softer rock`,
          process:
            'Differential erosion wears softer underlying strata faster than resistant caprock, forming a steep knickpoint waterfall that retreats upstream by headward erosion, leaving a steep-sided gorge.',
          xM: pos.xM,
          yM: pos.yM,
          distanceM: Math.max(380, cs * 15),
        });
      }
    }
  }

  // 4. Lowland Meanders, River Cliffs, Slip-Off Slopes (Point Bars), Oxbow Lakes, Levees & Estuaries
  const m = engine.geoMeander ?? w.meta.meander ?? null;
  if (m && m.xs.length > 8) {
    const mid = Math.floor(m.xs.length * 0.5);
    const sin = sinuosity(m);
    items.push({
      id: 'meander-belt',
      category: 'river',
      badge: `🔄 Meanders (Sinuosity ${sin.toFixed(2)})`,
      text: `Meandering river: sinuosity ${sin.toFixed(2)}× across alluvial floodplain`,
      process:
        'In the middle and lower courses, lateral erosion and deposition dominate, causing bends to migrate outward and downstream across the floodplain.',
      xM: m.xs[mid],
      yM: m.ys[mid],
      distanceM: Math.max(500, cs * 22),
    });

    const bends = meanderBends(m).filter((b) => b.k > m.xs.length * 0.15 && b.k < m.xs.length * 0.85);
    const b = bends.sort((p1, q1) => Math.abs(q1.curvature) - Math.abs(p1.curvature))[0];
    if (b) {
      const bh = bankHeight(w, m, b.k, b.outer);
      items.push({
        id: 'river-cliff-point-bar',
        category: 'river',
        badge: `🏦 River Cliff & Point Bar (${bh.toFixed(1)} m)`,
        text: `Outer bend river cliff (${bh.toFixed(1)} m, erosion) & inner bend slip-off slope / point bar (deposition)`,
        process:
          'The thalweg (fastest current) swings to the outer bend, where hydraulic action and abrasion undercut a steep river cliff, while helicoidal corkscrew flow deposits sand and gravel on the slow inner bend as a slip-off slope (point bar).',
        xM: b.outer.xM,
        yM: b.outer.yM,
        distanceM: Math.max(320, cs * 14),
      });
    }

    if (m.oxbows.length > 0) {
      const o = m.oxbows[m.oxbows.length - 1];
      const k = Math.floor(o.xs.length / 2);
      const ago = Math.max(10, Math.round((m.years - o.year) / 10) * 10);
      items.push({
        id: 'oxbow-lake',
        category: 'river',
        badge: `🌙 Oxbow Lake (${ago.toLocaleString()} yr old)`,
        text: `Oxbow lake: meander neck cut off ${ago.toLocaleString()} years ago and sealed by deposition`,
        process:
          'Lateral erosion narrows the neck between two outer meander bends until high-energy floodwater cuts straight through the neck; deposition along the new straighter channel seals off the abandoned loop as an oxbow lake.',
        xM: o.xs[k],
        yM: o.ys[k],
        distanceM: Math.max(360, cs * 15),
      });
    }

    const lv = leveeHeight(w, m, Math.min(700, cs * 20));
    if (lv.heightM > 0.15) {
      items.push({
        id: 'natural-levees',
        category: 'river',
        badge: `🛡 Levees & Floodplain (+${lv.heightM.toFixed(1)} m)`,
        text: `Natural levees: raised banks +${lv.heightM.toFixed(2)} m above distant floodplain`,
        process:
          'When floodwater overtops the channel banks onto the floodplain, hydraulic radius drops and friction increases; coarse sediment deposits immediately beside the channel to build raised natural levees while finer silt aggrades the floodplain.',
        xM: lv.at.xM,
        yM: lv.at.yM,
        distanceM: Math.max(300, cs * 14),
      });
    }

    const est = estuaryMetrics(w, m);
    if (est) {
      items.push({
        id: 'tidal-estuary',
        category: 'river',
        badge: `🌊 Tidal Estuary (${Math.round(est.mouthWidthM)} m wide)`,
        text: `Tidal estuary & mudflats: funnel mouth ${Math.round(est.mouthWidthM)} m wide (${est.widenFactor.toFixed(1)}× upstream channel)`,
        process:
          'At the river mouth where freshwater meets the tidal sea, tidal scour and rising base level widen the channel into a funnel-shaped estuary bordered by sheltered mudflats and sandbanks.',
        xM: est.mouthX,
        yM: est.mouthY,
        distanceM: Math.max(500, cs * 20),
      });
    }
  }

  // 5. Coastal Headlands, Bays, Wave-Cut Platforms, Beaches & Spits
  let hasSea = false;
  let hasLand = false;
  for (let i = 0; i < W * H; i += 4) {
    const z = surf(w, i);
    if (z < w.seaLevelM - 0.5) hasSea = true;
    else if (z > w.seaLevelM + 2) hasLand = true;
  }
  if (hasSea && hasLand) {
    // Scan coastline for most prominent headland and most indented bay + beach/spit accumulation
    let headCell = -1;
    let headScore = -Infinity;
    let bayCell = -1;
    let baySandM = 0;
    let spitCell = -1;
    let spitScore = -Infinity;

    for (let y = 3; y < H - 3; y += 2) {
      for (let x = 3; x < W - 3; x += 2) {
        const i = y * W + x;
        const z = surf(w, i);
        if (z < w.seaLevelM - 0.5 || z > w.seaLevelM + 120) continue;
        let seaNb = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (surf(w, (y + dy) * W + (x + dx)) < w.seaLevelM) seaNb++;
          }
        }
        if (seaNb === 0) continue; // not coastal
        const mat = w.materialId[i];
        const hard = mat !== 3; // not soft clay
        if (hard && seaNb >= 9 && z > w.seaLevelM + 6) {
          const sc = seaNb * 2 + (z - w.seaLevelM) * 0.3;
          if (sc > headScore) {
            headScore = sc;
            headCell = i;
          }
        }
        if (!hard && seaNb >= 3 && seaNb <= 10) {
          const sed = w.looseSedimentThicknessM[i];
          if (sed >= baySandM) {
            baySandM = sed;
            bayCell = i;
          }
        }
        // Spit / bar detection: low sandy ridge (looseSediment > 1.0 m, elevation within 0..3.5 m of sea level, surrounded by sea on >= 11 of 24 neighbours)
        if (w.looseSedimentThicknessM[i] > 1.0 && z >= w.seaLevelM - 0.2 && z <= w.seaLevelM + 4.5 && seaNb >= 11) {
          const sc = w.looseSedimentThicknessM[i] * 3 + seaNb;
          if (sc > spitScore) {
            spitScore = sc;
            spitCell = i;
          }
        }
      }
    }

    if (headCell >= 0) {
      const hPos = cellXY(w, headCell);
      const cliffH = Math.max(4, Math.round(surf(w, headCell) - w.seaLevelM));
      const rockName = MATERIALS[w.materialId[headCell]]?.name.split(' (')[0] ?? 'Resistant rock';
      items.push({
        id: 'coast-headland-cliff',
        category: 'coast',
        badge: `🪨 Headland & Cliff (${cliffH} m)`,
        text: `Headland & wave-cut platform (${rockName}, cliff ${cliffH} m high) — wave refraction focuses energy here`,
        process:
          'Resistant rock bands erode slowly and jut out as headlands; shallow water refracts and concentrates wave energy onto the headland foot, cutting a wave-cut notch between tides and leaving a gently sloping wave-cut platform as the cliff retreats.',
        xM: hPos.xM,
        yM: hPos.yM,
        distanceM: Math.max(420, cs * 16),
      });
    }

    if (bayCell >= 0) {
      const bPos = cellXY(w, bayCell);
      items.push({
        id: 'coast-bay-beach',
        category: 'coast',
        badge: `🏖 Sheltered Bay & Beach (${baySandM.toFixed(1)} m sand)`,
        text: `Bay & sandy beach: soft clay indented by differential erosion; beach sand ${baySandM.toFixed(1)} m thick`,
        process:
          'Less resistant clay erodes rapidly into an indented bay; wave refraction disperses wave crests inside the bay, reducing wave energy so constructive swash deposits a sandy bay-head beach.',
        xM: bPos.xM,
        yM: bPos.yM,
        distanceM: Math.max(420, cs * 16),
      });
    }

    if (spitCell >= 0) {
      const sPos = cellXY(w, spitCell);
      items.push({
        id: 'coast-spit-bar',
        category: 'coast',
        badge: `🏝 Longshore Drift Spit / Bar (${w.looseSedimentThicknessM[spitCell].toFixed(1)} m)`,
        text: `Sand spit / bay bar: ${w.looseSedimentThicknessM[spitCell].toFixed(1)} m thick ridge built across bay/estuary by longshore drift`,
        process:
          'Prevailing oblique waves drive zig-zag swash and backwash (longshore drift) along the shore; where the coastline changes direction at a bay or river mouth, slack water causes sand to deposit into an attached spit or bay bar enclosing a lagoon.',
        xM: sPos.xM,
        yM: sPos.yM,
        distanceM: Math.max(400, cs * 15),
      });
    }
  }

  // 6. Glacial Landforms (Corries, Arêtes, Pyramidal Peaks, U-Shaped Troughs, Hanging Valleys, Moraines, Drumlins)
  const glEroded = engine.glacialErosionField();
  const glMoraine = engine.moraineField();
  let maxIce = 0;
  let maxIceCell = 0;
  let hasGlacialHistory = false;
  for (let i = 0; i < W * H; i += 2) {
    if (w.iceThicknessM[i] > maxIce) {
      maxIce = w.iceThicknessM[i];
      maxIceCell = i;
    }
    if (glEroded[i] > 5 || glMoraine[i] > 1.5) hasGlacialHistory = true;
  }

  if (maxIce > 5) {
    const pos = cellXY(w, maxIceCell);
    items.push({
      id: 'active-glacier',
      category: 'glacial',
      badge: `🧊 Active Valley Glacier (${Math.round(maxIce)} m thick)`,
      text: `Valley glacier: ${Math.round(maxIce)} m thick ice eroding bedrock by plucking & basal abrasion`,
      process:
        'Above the snowline (equilibrium line), snow compacts into firn and glacier ice that flows down pre-existing river valleys under gravity, plucking jointed rock and abrading the valley floor and walls.',
      xM: pos.xM,
      yM: pos.yM,
      distanceM: Math.max(550, cs * 20),
    });
  }

  if (hasGlacialHistory || w.meta.presetId === 'alpine-glaciers') {
    const pre = new Float32Array(W * H);
    const iceMax = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      pre[i] = engine.surface[i] + glEroded[i] - glMoraine[i];
      iceMax[i] = Math.max(w.iceThicknessM[i], glEroded[i] * 3);
    }
    const snowlineM = w.seaLevelM + (w.climate.seaLevelTempC - w.glacier.elaTempC) / Math.max(1e-4, w.climate.lapseRateCPerKm / 1000);
    const gf = findGlacialFeatures(w, pre, iceMax, glMoraine, snowlineM, glEroded);
    if (gf.corries.length > 0) {
      const c = gf.corries[0];
      const pos = glAt(w, c.cell);
      items.push({
        id: 'glacial-corrie',
        category: 'glacial',
        badge: `🏔 Corrie & Tarn (faces ${c.facing})`,
        text: `Corrie (cirque): faces ${c.facing}${c.tarnM > 0.5 ? `, tarn ${c.tarnM.toFixed(1)} m deep` : ''}`,
        process:
          'Snow collects in sheltered north-east hollows; rotational ice slip, freeze-thaw weathering, and plucking steepen the backwall while abrasion over-deepens a rock basin behind a raised rock lip (holding a post-glacial tarn).',
        xM: pos.xM,
        yM: pos.yM,
        distanceM: Math.max(420, cs * 15),
      });
    }
    if (gf.arete) {
      const pos = glAt(w, gf.arete.cell);
      items.push({
        id: 'glacial-arete',
        category: 'glacial',
        badge: `⛰ Arête${gf.peak ? ' & Pyramidal Peak' : ''}`,
        text: `Knife-edge arête (${Math.round(gf.arete.sideDeg)}° sides)${gf.peak ? ` & pyramidal peak (${gf.peak.corries} corries)` : ''}`,
        process:
          'When two adjacent corries erode back-to-back by freeze-thaw and plucking, the ridge between them narrows into a knife-edge arête; where three or more corries meet around a summit, they carve a sharp pyramidal peak.',
        xM: pos.xM,
        yM: pos.yM,
        distanceM: Math.max(420, cs * 15),
      });
    }
    if (gf.trough) {
      const pos = glAt(w, gf.trough.cell);
      items.push({
        id: 'glacial-trough',
        category: 'glacial',
        badge: `🏞 U-Shaped Glacial Trough (${Math.round(gf.trough.deepenedM)} m scoured)`,
        text: `U-shaped glacial trough: deepened ${Math.round(gf.trough.deepenedM)} m, floor ${fmtKm(gf.trough.after.floorM)} wide, steep walls ${Math.round(gf.trough.after.sideDeg)}°`,
        process:
          'A thick trunk glacier fills the valley and erodes both the floor and valley sides by basal abrasion and plucking, bulldozing interlocking spurs into truncated spurs to leave a steep-sided, flat-floored U-shaped glacial trough.',
        xM: pos.xM,
        yM: pos.yM,
        distanceM: Math.max(520, cs * 18),
      });
    }
    if (gf.hanging) {
      const pos = glAt(w, gf.hanging.cell);
      items.push({
        id: 'glacial-hanging-valley',
        category: 'glacial',
        badge: `💦 Hanging Valley (${Math.round(gf.hanging.dropM)} m step)`,
        text: `Hanging valley: tributary floor perched ${Math.round(gf.hanging.dropM)} m above the main glacial trough`,
        process:
          'The thick trunk glacier erodes its main trough far more deeply than smaller, thinner tributary glaciers; after the ice melts, the tributary valley is left hanging high above the main trough floor, often marked by a waterfall.',
        xM: pos.xM,
        yM: pos.yM,
        distanceM: Math.max(420, cs * 16),
      });
    }
    const mor = gf.terminal ?? gf.recessional ?? gf.lateral ?? gf.moraine;
    if (mor) {
      const pos = glAt(w, mor.cell);
      const morKind = mor === gf.terminal ? 'terminal' : mor === gf.recessional ? 'recessional' : mor === gf.lateral ? 'lateral' : 'ground/snout';
      items.push({
        id: 'glacial-moraine',
        category: 'glacial',
        badge: `🪨 Glacial Moraines (${mor.thickM.toFixed(1)} m till)`,
        text: `Glacial moraine (${morKind}): ${mor.thickM.toFixed(1)} m ridge of unsorted boulder clay / till${gf.drumlin ? ` + drumlin (${Math.round(gf.drumlin.heightM)} m)` : ''}`,
        process:
          'As the glacier melts at its snout and margins, it dumps unsorted angular rock debris (glacial till) as terminal moraines (maximum extent), lateral moraines (valley sides), recessional moraines (retreat pauses), and subglacial streamlined drumlins.',
        xM: pos.xM,
        yM: pos.yM,
        distanceM: Math.max(450, cs * 16),
      });
    }
  }

  return items;
}
