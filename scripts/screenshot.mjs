// Headless Chromium end-to-end check of the first functional demonstration (spec L).
// Usage: node scripts/screenshot.mjs [baseUrl] [outDir]   (needs `npm run preview` running)
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'tests/screenshots';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const results = [];
const check = (name, ok, detail = '') => {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`;
  results.push(line);
  console.log(line);
};
const sum = () => page.evaluate(() => window.__terraGenesis.checksum());
const shot = (n) => page.screenshot({ path: `${out}/${n}.png`, timeout: 90000 });

await page.goto(base + '?fresh');
await page.waitForSelector('canvas');
await page.waitForTimeout(2000);
await shot('01-initial');

// Hover inspector reads real values
await page.mouse.move(700, 480);
await page.waitForTimeout(300);
await page.mouse.move(720, 500);
await page.waitForFunction(() => /Surface/.test(document.querySelector('.inspect')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
const inspect = await page.textContent('.inspect');
check('inspector shows surface values', /Surface\s*-?\d/.test(inspect ?? ''), inspect?.slice(0, 80));

// Raise stroke
const s0 = await sum();
await page.keyboard.press('2');
await page.mouse.move(720, 520);
await page.mouse.down();
for (let k = 0; k < 20; k++) {
  await page.mouse.move(700 + k * 3, 520 - k, { steps: 1 });
  await page.waitForTimeout(50);
}
await page.mouse.up();
await page.waitForTimeout(300);
const s1 = await sum();
check('raise brush increases terrain', s1 > s0 + 1, `Δ=${(s1 - s0).toFixed(1)}`);
await shot('02-raised');
check('undo enabled after stroke', await page.isEnabled('button[aria-label="Undo"]'));

// Camera did not move during brush stroke (no control conflict)
// Undo
await page.keyboard.press('Control+z');
await page.waitForTimeout(300);
const s2 = await sum();
check('undo restores exact surface', Math.abs(s2 - s0) < 1e-3 * Math.abs(s0) + 1e-3, `s0=${s0.toFixed(2)} s2=${s2.toFixed(2)}`);
await page.keyboard.press('Control+Shift+z');
await page.waitForTimeout(200);
check('redo reapplies', Math.abs((await sum()) - s1) < 1e-3 * Math.abs(s1) + 1e-3);

// Smooth stroke (select by clicking the rail: a key press alone occasionally raced the stroke)
await page.click('.rail-btn:has-text("Smooth")');
await page.waitForFunction(() => document.querySelector('.rail-btn.active')?.textContent?.includes('Smooth'));
await page.waitForTimeout(300);
await page.mouse.move(720, 520);
await page.waitForTimeout(300);
await page.mouse.down();
for (let k = 0; k < 16; k++) {
  // keep moving over the raised bump: strokes advance on pointer events, not on a held still press
  await page.mouse.move(716 + (k % 4) * 3, 518 - (k % 3) * 2, { steps: 1 });
  await page.waitForTimeout(60);
}
await page.mouse.up();
await page.waitForTimeout(300);
const s3 = await sum();
const smoothLabel = await page.evaluate(() => window.__terraGenesis.engine.history.undoLabel);
check('smooth stroke changes terrain', s3 !== s1 && smoothLabel === 'smooth', `Δ=${(s3 - s1).toFixed(4)} undo=${smoothLabel}`);

// Navigate tool: drag orbits camera, terrain unchanged
await page.keyboard.press('1');
const camBefore = await page.evaluate(() => 0);
void camBefore;
await page.mouse.move(600, 600);
await page.mouse.down();
await page.mouse.move(800, 560, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(300);
check('orbit drag does not edit terrain', (await sum()) === s3);
await shot('03-orbited');

// Autosave + reload restores edited world
await page.waitForTimeout(3200);
await page.goto(base);
await page.waitForSelector('canvas');
await page.waitForTimeout(2500);
const s4 = await sum();
check('reload restores autosaved edited world', Math.abs(s4 - s3) < 1e-3 * Math.abs(s3) + 1e-3, `saved=${s3.toFixed(2)} loaded=${s4.toFixed(2)}`);

// --- Water (M02) ---
const eng = (fn) => page.evaluate(fn);
check('GPU water backend active', (await page.textContent('.timebar .badge')) === 'GPU');
await page.selectOption('.timebar select', '3600');
await page.click('.timebar .play');
await page.waitForTimeout(4000);
await eng(() => window.__terraGenesis.engine.setPlaying(false));
await page.waitForTimeout(1000);
const w1 = await eng(() => {
  const e = window.__terraGenesis.engine;
  const L = e.water.ledger;
  const stored = e.water.storedVolume();
  const inn = L.rainIn + L.sourceIn + L.toolIn;
  const out = L.infiltrated + L.evaporated + L.edgeOut + L.seaOut + L.toolOut;
  return {
    t: e.world.simTimeSeconds,
    stored,
    closure: Math.abs(stored - (L.initialStored + inn - out)) / Math.max(1, L.initialStored + inn),
  };
});
check('Play advances simulated time and rain adds water', w1.t > 60 && w1.stored > 0, `t=${w1.t.toFixed(0)} s stored=${w1.stored.toFixed(0)} m³`);
check('water budget closes in browser (GPU)', w1.closure < 1e-3, `closure=${w1.closure.toExponential(2)}`);
await shot('08-water');
await page.click('.timebar .seg button:has-text("Depth map")');
await page.waitForTimeout(500);
await shot('09-depth-map');
await page.click('.timebar .seg button:has-text("Water")');
// spring tool places a source
await page.keyboard.press('-');
await page.mouse.click(720, 520);
await page.waitForTimeout(300);
check('spring tool adds a source', (await eng(() => window.__terraGenesis.engine.world.water.sources.length)) === 1);
await page.keyboard.press('1');
// water survives save + reload
await page.keyboard.press('Control+s');
await page.waitForTimeout(3500);
const before = await eng(() => window.__terraGenesis.engine.water.storedVolume());
await page.goto(base);
await page.waitForSelector('canvas');
await page.waitForTimeout(2500);
const after = await eng(() => window.__terraGenesis.engine.water.storedVolume());
check('water depth restored after reload', Math.abs(after - before) <= 1e-4 * before, `before=${before.toFixed(1)} after=${after.toFixed(1)}`);

// Named save + load dialog
await page.keyboard.press('Control+s');
await page.waitForTimeout(800);
await page.click('text=Load');
await page.waitForSelector('.slots li');
const slots = await page.locator('.slots li').count();
check('load dialog lists saved slots', slots >= 2, `${slots} slots`);
await shot('04-load-dialog');
await page.keyboard.press('Escape');

// New world: island
await page.click('text=New');
await page.click('.preset:has-text("Island")');
await page.fill('.form-grid input[type=number] >> nth=0', '4242');
await page.click('text=Generate world');
await page.waitForTimeout(1500);
const name = await page.textContent('.world-name');
check('new island world generated', /Island/.test(name ?? ''), name ?? '');
await shot('05-island');
await page.keyboard.press('t');
await page.waitForTimeout(600);
await shot('06-island-top');

for (const preset of ['Mountain range', 'Coastal headlands', 'Layered plateau']) {
  await page.click('text=New');
  await page.click(`.preset:has-text("${preset}")`);
  const auto = page.locator('label.check:has-text("Start simulation") input');
  if (await auto.isChecked()) await auto.uncheck(); // keep software-GL e2e deterministic
  await page.click('text=Generate world');
  await page.waitForTimeout(1500);
  await eng(() => window.__terraGenesis.engine.setPlaying(false));
  await shot('07-' + preset.toLowerCase().replace(/\s+/g, '-'));
}

// --- Landslide event (M04) on the last generated world (layered plateau) ---
const ls0 = await sum();
await page.keyboard.press('l');
await page.mouse.click(720, 470);
await page.waitForTimeout(800);
const slideToast = (await page.textContent('.toasts')) ?? '';
const ls1 = await sum();
await page.keyboard.press('Control+z');
await page.waitForTimeout(400);
const ls2 = await sum();
check(
  'landslide tool runs and is undoable',
  /Landslide|stable/.test(slideToast) && Math.abs(ls2 - ls0) < 1e-6 * Math.abs(ls0) + 1e-3,
  `${slideToast.slice(0, 70)} Δ=${(ls1 - ls0).toFixed(3)}`,
);
await page.keyboard.press('1');

// --- Erosion (M03): river-to-sea world, accelerated erosion, budget, save/reload ---
await page.click('text=New');
await page.click('.preset:has-text("River to sea")');
await page.selectOption('.dialog select >> nth=0', '128');
await page.fill('.form-grid input[type=number] >> nth=0', '777');
await page.click('label.check:has-text("Start simulation") input');
await page.click('text=Generate world');
await page.waitForTimeout(1200);
const er = await eng(() => {
  const e = window.__terraGenesis.engine;
  e.setErosionParams({ speedup: 300 });
  e.advance(2 * 3600);
  const S = e.sediment.ledger;
  const susp = e.sediment.suspendedVolume();
  const expected = S.initialSuspended + S.erodedLoose + S.erodedBedrock - S.deposited - S.seaDeposited - S.edgeExport;
  return {
    eroded: S.erodedLoose + S.erodedBedrock,
    sea: S.seaDeposited,
    closure: Math.abs(susp - expected) / Math.max(1, S.erodedLoose + S.erodedBedrock),
  };
});
check(
  'erosion runs on GPU and moves sediment to the sea',
  er.eroded > 1000 && er.sea > 0,
  `eroded=${er.eroded.toFixed(0)} m³ seaDeposited=${er.sea.toFixed(0)} m³`,
);
check('sediment budget closes in browser', er.closure < 1e-3, `closure=${er.closure.toExponential(2)}`);
await page.selectOption('.timebar select.overlay-select', 'change');
await page.waitForTimeout(800);
await shot('13-erosion-change-map');
await page.selectOption('.timebar select.overlay-select', 'none');
await page.keyboard.press('Control+s');
await page.waitForTimeout(3500);
const bedSum = () =>
  eng(() => {
    const w = window.__terraGenesis.engine.world;
    let a = 0;
    for (let i = 0; i < w.bedrockElevationM.length; i++) a += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i] + w.sedimentSuspendedM[i];
    return a;
  });
const b1 = await bedSum();
await page.goto(base);
await page.waitForSelector('canvas');
await page.waitForTimeout(2500);
const b2 = await bedSum();
check('eroded terrain + suspended load restored after reload', Math.abs(b1 - b2) < 1e-6 * Math.abs(b1), `before=${b1.toFixed(3)} after=${b2.toFixed(3)}`);

// --- Coast (M05): sea level + waves on the headlands preset ---
await page.click('text=New');
await page.click('.preset:has-text("Coastal headlands")');
await page.selectOption('.dialog select >> nth=0', '128');
await page.click('label.check:has-text("Start simulation") input');
await page.click('text=Generate world');
await page.waitForTimeout(1200);
const co = await eng(() => {
  const e = window.__terraGenesis.engine;
  const sea = () => e.water.sea.reduce((a, v) => a + v, 0);
  const s0 = sea();
  e.setSeaLevel(5);
  const s1 = sea();
  e.setSeaLevel(0);
  e.advance(6 * 3600);
  return {
    s0,
    s1,
    cliff: e.coast.ledger.cliffEroded,
    waves: e.world.coast.wavesOn,
  };
});
check('sea-level rise floods more cells', co.s1 > co.s0, `${co.s0} → ${co.s1} sea cells`);
check('waves erode the headlands coast', co.waves && co.cliff > 1000, `cliff erosion ${co.cliff.toFixed(0)} m³`);

// --- Arch lab (M05-C05): guided cave → arch → stack → stump voxel model ---
await page.click('.rail-btn:has-text("Coast")');
await page.click('text=Open cave, arch, stack and stump lab');
await page.waitForSelector('.arch-view canvas');
await page.click('.dialog button.primary:has-text("Play")');
await page
  .waitForFunction(() => document.querySelector('.arch-stages li.now')?.getAttribute('data-stage') === 'stack', null, { timeout: 240000 })
  .catch(() => {});
await page.click('.dialog button.primary:has-text("Pause")').catch(() => {});
await shot('23-arch-lab-stack');
const archSeen = await page.$$eval('.arch-stages li', (els) => els.map((e) => e.getAttribute('data-stage') + ':' + e.querySelector('span').textContent));
check(
  'arch lab reaches the stack stage via cave and arch',
  archSeen.slice(1, 4).every((s) => /step \d+/.test(s)),
  archSeen.join(' '),
);
await page.selectOption('.dialog select >> nth=0', 'clay');
await page.waitForTimeout(300);
const claySel = await page.locator('.dialog select').nth(1).inputValue();
const q = await page.textContent('.arch-question');
await page.click('.dialog button:has-text("Use this world")');
const worldNote = await page.textContent('.dialog .hint.small.tight');
check(
  'arch lab scenarios and world coast set rock and waves',
  claySel === 'clay' && /clay/i.test(q) && /From this world/.test(worldNote),
  `${claySel} · ${worldNote}`,
);
await page.click('.dialog [aria-label="Close"]');

// --- Beaches, spits and bars lab (M05-C04b): bay-mouth bar closes a lagoon ---
await page.click('.rail-btn:has-text("Coast")');
await page.click('text=Open beaches, spits and bars lab');
await page.waitForSelector('.shore-view canvas');
for (let k = 0; k < 24; k++) await page.click('.dialog button:has-text("+1 year")');
const shore = await page.textContent('.slump-readout');
await shot('25-shoreline-lab');
const lag = +(shore.match(/Lagoon ([\d.]+) km/)?.[1] ?? 0);
check('shoreline lab: bay-mouth bar encloses a lagoon', lag > 1, shore);
await page.click('.dialog [aria-label="Close"]');

// --- Coastal slump cycle (M05-C06) in the slump lab ---
await page.click('.rail-btn:has-text("Landslide")');
await page.click('text=Open rotational slump lab');
await page.click('text=Coastal cycle');
for (let k = 0; k < 15; k++) await page.click('.dialog button:has-text("+10 years")');
const cs = await page.textContent('.slump-readout');
await shot('24-coastal-slump');
check('coastal slump cycle: repeated slumps and cliff retreat', /Year 150/.test(cs) && +(cs.match(/Slumps (\d+)/)?.[1] ?? 0) >= 2, cs);
await page.click('.dialog [aria-label="Close"]');

// --- Climate (M06-C01): orographic rain + rain shadow on a mountain world, GPU ledger ---
await page.click('text=New');
await page.click('.preset:has-text("Mountain range")');
await page.selectOption('.dialog select >> nth=0', '128');
await page.click('label.check:has-text("Start simulation") input');
await page.click('text=Generate world');
await page.waitForTimeout(1200);
await page.click('.rail-btn:has-text("Climate")');
await page.click('.climate-panel label.check:has-text("Climate on") input');
await page.click('.climate-panel button:has-text("Rainfall")');
await page.waitForTimeout(800);
await shot('26-climate-rainfall');
const climText = await page.textContent('.climate-panel');
const rx = climText.match(/from ([\d.]+)× to ([\d.]+)×/);
await page.click('.climate-panel button:has-text("Temperature")');
await page.waitForTimeout(800);
await shot('27-climate-temperature');
const cl = await eng(() => {
  const e = window.__terraGenesis.engine;
  e.setWaterParams({ rainMPerS: 20 / 3.6e6, evaporationMPerS: 2 / 3.6e6 });
  e.advance(1800);
  const L = e.water.ledger;
  const stored = e.water.storedVolume();
  const inn = L.initialStored + L.rainIn + L.sourceIn + L.toolIn;
  const out = L.infiltrated + L.evaporated + L.seaOut + L.edgeOut + L.toolOut;
  return {
    backend: e.backend,
    closure: Math.abs(inn - out - stored) / inn,
    evap: L.evaporated,
    rain: L.rainIn,
  };
});
check('climate: wetter windward slopes and drier rain shadow', !!rx && +rx[2] > 1.5 && +rx[1] < 0.7, rx ? rx[0] : climText.slice(0, 80));
check(
  'climate: water budget closes with spatial rain on ' + cl.backend,
  cl.closure < 1e-4 && cl.evap > 0,
  `closure=${cl.closure.toExponential(2)} rain=${cl.rain.toFixed(0)} evap=${cl.evap.toFixed(0)} m³`,
);

// --- Snow (M06-C02): cold spell builds a snowpack on the GPU, warm spell melts it ---
await page.click('.climate-panel button:has-text("Temperature")'); // back to natural colours
const sn = await eng(() => {
  const e = window.__terraGenesis.engine;
  const L = e.water.ledger;
  const closure = () => {
    const stored = e.water.storedVolume();
    const inn = L.initialStored + L.rainIn + L.sourceIn + L.toolIn;
    return Math.abs(inn - (L.infiltrated + L.evaporated + L.seaOut + L.edgeOut + L.toolOut) - stored) / inn;
  };
  e.setClimateParams({ seaLevelTempC: -3, seasonalAmpC: 0 });
  e.setWaterParams({ rainMPerS: 20 / 3.6e6 });
  e.advance(3 * 3600);
  const cold = e.water.snowVolume();
  const c1 = closure();
  e.setWaterParams({ rainMPerS: 0 });
  e.setClimateParams({ seaLevelTempC: 18, meltMmPerDegDay: 10 });
  e.advance(6 * 3600);
  const warm = e.water.snowVolume();
  e.setClimateParams({ seaLevelTempC: -3 });
  return {
    backend: e.backend,
    cold,
    warm,
    c1,
    c2: closure(),
    melt: L.snowmelt,
  };
});
await page.waitForTimeout(1500);
await shot('28-snow');
check(
  'snow: cold spell builds a snowpack, warm spell melts it (' + sn.backend + ')',
  sn.cold > 1e4 && sn.warm < sn.cold && sn.melt > 0 && sn.c1 < 1e-4 && sn.c2 < 1e-4,
  `snow ${sn.cold.toFixed(0)} → ${sn.warm.toFixed(0)} m³, closure ${sn.c1.toExponential(1)} / ${sn.c2.toExponential(1)}`,
);

// --- Glaciers (M06-C03): ice grows above the snowline on the mountain world and flows ---
await page.click('.climate-panel label.check:has-text("Glaciers grow") input');
const gl = await eng(() => {
  const e = window.__terraGenesis.engine;
  e.setClimateParams({ seaLevelTempC: 6, seasonalAmpC: 0 });
  e.setGlacierParams({ yearsPerSimHour: 20, elaTempC: -2 });
  e.glacier.resetLedger();
  e.water.resetLedger();
  const t0 = performance.now();
  e.advance(6 * 3600);
  const ms = performance.now() - t0;
  const L = e.glacier.ledger;
  const ice = e.glacier.iceVolume();
  const iceClosure = Math.abs(ice - (L.initialIce + L.accumulated - L.ablated - L.calved - L.exported)) / Math.max(1, L.initialIce + L.accumulated);
  const W = e.water.ledger;
  const stored = e.water.storedVolume();
  const inn = W.initialStored + W.rainIn + W.sourceIn + W.toolIn + W.glacierMeltIn;
  const wClosure = Math.abs(inn - (W.infiltrated + W.evaporated + W.seaOut + W.edgeOut + W.toolOut) - stored) / inn;
  return {
    ice,
    iceClosure,
    wClosure,
    years: L.timeS / 3.15576e7,
    lag: L.lagS / 3.15576e7,
    ms,
    melt: W.glacierMeltIn,
  };
});
await page.waitForTimeout(1500);
await shot('29-glaciers');
check(
  'glaciers grow, conserve ice and keep the water budget',
  gl.ice > 1e5 && gl.years > 30 && Math.abs(gl.years + gl.lag - 120) < 1 && gl.iceClosure < 1e-6 && gl.wClosure < 1e-4,
  `ice ${(gl.ice / 1e6).toFixed(2)} M m³ after ${gl.years.toFixed(0)} yr (lag ${gl.lag.toFixed(0)} yr), ice closure ${gl.iceClosure.toExponential(1)}, water ${gl.wClosure.toExponential(1)}, ${gl.ms.toFixed(0)} ms`,
);

// --- Vegetation (M06-C04): plants spread over the warm, wet lowlands and shield them from erosion ---
const vg = await eng(() => {
  const e = window.__terraGenesis.engine;
  e.setGlacierParams({ enabled: false });
  e.setClimateParams({ seaLevelTempC: 14, seasonalAmpC: 6 });
  e.setVegetationParams({
    enabled: true,
    yearsPerSimHour: 100,
    annualPrecipMm: 1200,
  });
  e.advance(2 * 3600);
  const st = e.vegetation.stats();
  let hiCov = 0;
  let hiN = 0;
  let loCov = 0;
  let loN = 0;
  const z = e.surface;
  let zmax = -Infinity;
  for (const v of z) zmax = Math.max(zmax, v);
  for (let i = 0; i < z.length; i++) {
    if (z[i] < e.world.seaLevelM) continue;
    if (z[i] > zmax - 300) ((hiCov += e.world.vegCover[i]), hiN++);
    else if (z[i] < e.world.seaLevelM + 400) ((loCov += e.world.vegCover[i]), loN++);
  }
  return { ...st, hi: hiN ? hiCov / hiN : 0, lo: loN ? loCov / loN : 0 };
});
await page.waitForTimeout(2000);
await shot('30-vegetation');
check(
  'vegetation grows on warm lowlands, thins towards the peaks',
  vg.coverPct > 5 && vg.lo > vg.hi,
  `cover ${vg.coverPct.toFixed(0)}% (forest ${vg.forestPct.toFixed(0)}%), lowland ${vg.lo.toFixed(2)} vs summits ${vg.hi.toFixed(2)}`,
);

// --- Biome preset + what-if comparison (M06-C05) ---
await page.click('text=New');
await page.click('.preset:has-text("Alpine glaciers")');
await page.selectOption('.dialog select >> nth=0', '128');
await page.click('label.check:has-text("Start simulation") input').catch(() => {});
await page.click('text=Generate world');
await page.waitForTimeout(2000);
await shot('31-alpine-preset');
await page.click('.rail-btn:has-text("Climate")');
await page.selectOption('.climate-panel select[aria-label="Climate change to compare"]', 'warmer');
await page.click('.climate-panel button:has-text("Compare")');
await page.waitForSelector('.compare-table');
const cmpRows = await page.$$eval('.compare-table tbody tr', (rs) => rs.map((r) => Array.from(r.querySelectorAll('td')).map((td) => td.textContent)));
await page.click('.climate-panel button:has-text("Show difference map")');
await page.waitForTimeout(1200);
await shot('32-what-if-warmer');
const pre = await eng(() => {
  const e = window.__terraGenesis.engine;
  let ice = 0;
  for (const h of e.world.iceThicknessM) ice += h;
  return {
    climate: e.world.climate.enabled,
    glaciers: e.world.glacier.enabled,
    ice,
    plants: e.vegetation.stats().coverPct,
  };
});
const iceRow = cmpRows.find((r) => r[0] === 'Ice volume');
check('alpine preset starts with climate, ice and plants', pre.climate && pre.glaciers && pre.ice > 0 && pre.plants > 1, `plants ${pre.plants.toFixed(0)}%`);
check('what-if 2 °C warmer: less ice', !!iceRow && parseFloat(iceRow[2]) < parseFloat(iceRow[1]), cmpRows.map((r) => r.join(' ')).join(' | '));

// --- Plates (M07-C01): converging plates raise mountains along their boundary ---
await page.click('text=New');
await page.click('.preset:has-text("Continental")');
await page.selectOption('.dialog select >> nth=0', '128');
await page.click('label.check:has-text("Start simulation") input').catch(() => {});
await page.click('text=Generate world');
await page.waitForTimeout(1500);
await page.click('.rail-btn:has-text("Plates")');
await page.click('.plates-panel button:has-text("New plates")');
await page.click('.plates-panel label.check:has-text("Plates move") input');
const pl = await eng(() => {
  const e = window.__terraGenesis.engine;
  let z0 = -Infinity;
  for (const z of e.surface) z0 = Math.max(z0, z);
  e.setTectonicsParams({ yearsPerSimHour: 200000 });
  e.advance(2 * 3600);
  let z1 = -Infinity;
  for (const z of e.surface) z1 = Math.max(z1, z);
  let c = 0;
  for (const b of e.tectonics.boundary) if (b === 1) c++;
  return {
    z0,
    z1,
    up: e.tectonics.ledger.uplifted,
    down: e.tectonics.ledger.subsided,
    years: e.tectonics.ledger.years,
    conv: c,
    plates: e.world.tectonics.plates.length,
  };
});
await page.waitForTimeout(1500);
await shot('33-plates');
check(
  'plates: boundaries deform the land in tectonic time',
  pl.plates === 3 && pl.years > 3e5 && (pl.conv === 0 || pl.up > 0) && pl.up + pl.down > 0,
  `${pl.plates} plates, ${Math.round(pl.years).toLocaleString()} yr: raised ${(pl.up / 1e9).toFixed(2)} km³, lowered ${(pl.down / 1e9).toFixed(2)} km³, top ${pl.z0.toFixed(0)} → ${pl.z1.toFixed(0)} m`,
);

// --- Subduction cross-section lab (M07-C03) ---
await page.click('.plates-panel button:has-text("Open subduction zone cross-section")');
await page.waitForSelector('svg[aria-label="Subduction zone cross-section"]');
const arc1 = await page.textContent('.slump-readout');
await page.locator('.dialog input[type=range]').nth(1).focus();
for (let k = 0; k < 20; k++) await page.keyboard.press('ArrowRight'); // steeper slab
const arc2 = await page.textContent('.slump-readout');
await shot('34-subduction-lab');
const km = (t) => +(t.match(/arc ([\d.]+) km/)?.[1] ?? NaN);
check('subduction lab: steeper slab moves the arc towards the trench', km(arc2) < km(arc1), `${km(arc1)} km → ${km(arc2)} km`);
await page.click('.dialog [aria-label="Close"]');

// --- Fold mountains lab (M07-C04) ---
await page.click('.plates-panel button:has-text("Open fold mountains cross-section")');
await page.waitForSelector('svg[aria-label="Fold mountains cross-section"]');
const sl = page.locator('.dialog input[type=range]').first();
await sl.focus();
for (let k = 0; k < 15; k++) await page.keyboard.press('ArrowRight'); // 30 % → 45 %
await page.click('.dialog label.check:has-text("thrust") input');
await page.locator('.dialog input[type=range]').nth(2).focus();
for (let k = 0; k < 25; k++) await page.keyboard.press('ArrowRight'); // erode 25 %
await page.waitForTimeout(300);
const fl = await page.textContent('.slump-readout');
await shot('35-fold-lab');
const thick = +(fl.match(/Layers ([\d.]+)×/)?.[1] ?? 0);
check('fold lab: squeezing thickens layers and a thrust slips', thick > 1.5 && /Thrust slip/.test(fl), fl);
await page.click('.dialog [aria-label="Close"]');

// --- Earthquake tool (M07-C05): persistent fault deformation, shaking map, undo ---
await page.click('.rail-btn:has-text("Quake")');
await page.waitForTimeout(300);
const q0 = await sum();
await page.mouse.move(720, 500);
await page.mouse.down();
await page.mouse.up();
await page.waitForSelector('.toast:has-text("earthquake")', { timeout: 15000 }).catch(() => {});
const q1 = await sum();
const qLabel = await page.evaluate(() => window.__terraGenesis.engine.history.undoLabel);
await page.click('.quake-panel button:has-text("Show shaking strength")').catch(() => {});
await page.waitForTimeout(1200);
await shot('36-earthquake-shaking');
await page.keyboard.press('Control+z');
await page.waitForTimeout(400);
const q2 = await sum();
check(
  'earthquake deforms the ground for good and undo restores it',
  q1 !== q0 && /earthquake/.test(qLabel ?? '') && Math.abs(q2 - q0) < 1e-6 * Math.abs(q0) + 1e-3,
  `Δ=${(q1 - q0).toFixed(1)} undo='${qLabel}' restored Δ=${(q2 - q0).toFixed(4)}`,
);

// --- Volcano (M08-C01): a vent erupts; lava flows downhill and the volume ledger closes ---
await page.click('.rail-btn:has-text("Quake")');
await page.click('.quake-panel button:has-text("Showing shaking")').catch(() => {});
await page.click('.rail-btn:has-text("Volcano")');
await page.waitForTimeout(300);
await page.locator('.volcano-panel input[type=range]').nth(0).fill('7'); // 200 m³/s
await page.mouse.move(900, 430); // on land, right of the bay
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(300);
const vent = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  const v = e.world.lava.vents[0];
  return v ? (e.surface[v.y * e.world.width + v.x] > e.world.seaLevelM ? 1 : -1) : 0;
});
const lava = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  e.advance(1800);
  const L = e.lava.ledger;
  const flow = e.lava.flowingVolume();
  let cells = 0;
  for (const h of e.world.lavaDepthM) if (h > 0.1) cells++;
  return {
    erupted: L.erupted,
    closure: Math.abs(L.erupted - flow - L.solidified) / L.erupted,
    cells,
  };
});
await page.click('button[aria-label="Step"]'); // one more step through the UI refreshes the panel
await page.waitForTimeout(1500);
await shot('37-lava-flow');
const vp = await page.textContent('.volcano-panel');
check(
  'volcano vent erupts lava that spreads with a closed volume ledger',
  vent === 1 && lava.cells > 3 && Math.abs(lava.erupted - 200 * 1800) < 1 && lava.closure < 1e-4 && /Erupted/.test(vp ?? ''),
  `vent on land ${vent} ` + JSON.stringify(lava),
);

// --- Explosive eruption (M08-C02): ash + cinder, thinning downwind, tephra ledger closes ---
await page.selectOption('.volcano-panel select >> nth=2', 'explosive'); // selects: what to make, magma, style
await page.locator('.volcano-panel input[type=range]').nth(0).fill('8'); // 500 m³/s
await page.mouse.move(980, 520);
await page.mouse.down();
await page.mouse.up();
await page.waitForTimeout(300);
const ash = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  const v = e.world.lava.vents.find((q) => q.style === 'explosive');
  const onLand = v ? e.surface[v.y * e.world.width + v.x] > e.world.seaLevelM : false;
  e.advance(1800);
  const L = e.lava.ledger;
  let cells = 0;
  for (const t of e.world.tephraM) if (t > 0.01) cells++;
  const pending = e.lava.pendingTephra();
  return {
    onLand,
    erupted: L.tephraErupted,
    deposited: L.tephraDeposited,
    off: L.tephraOffMap,
    closure: Math.abs(L.tephraErupted - L.tephraDeposited - L.tephraOffMap - pending) / L.tephraErupted,
    cells,
  };
});
await page.click('button[aria-label="Step"]');
await page.waitForTimeout(1500);
await shot('38-ash-fall');
const ap = await page.textContent('.volcano-panel');
check(
  'explosive eruption lays ash and cinder with a closed tephra ledger',
  ash.deposited > 0 && ash.cells > 50 && ash.closure < 1e-4 && /Ash and cinder/.test(ap ?? ''),
  JSON.stringify(ash),
);

// --- Build a composite volcano (M08-C03): repeated eruptions, one undoable edit ---
await page.selectOption('.volcano-panel select >> nth=0', 'composite');
await page.locator('.volcano-panel input[type=range]').nth(0).fill('4');
const v0 = await sum();
await page.mouse.move(820, 300);
await page.mouse.down();
await page.mouse.up();
await page.waitForFunction(() => window.__terraGenesis.engine.history.undoLabel === 'Build composite volcano', null, { timeout: 300000 }).catch(() => {});
const vb = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  return {
    label: e.history.undoLabel,
    lava: e.lava.ledger.erupted,
    ash: e.lava.ledger.tephraErupted,
  };
});
const v1 = await sum();
await page.waitForTimeout(1500);
await shot('39-composite-volcano');
await page.keyboard.press('Control+z');
await page.waitForTimeout(500);
const v2 = await sum();
check(
  'building a composite volcano raises the ground and undo removes it',
  vb.label === 'Build composite volcano' && v1 > v0 && Math.abs(v2 - v0) < 1e-6 * Math.abs(v0) + 1e-3,
  `Δ=${(v1 - v0).toFixed(0)} undoΔ=${(v2 - v0).toFixed(4)} ${JSON.stringify(vb)}`,
);

// --- Volcanic island preset + caldera collapse (M08-C04) ---
await page.click('text=New');
await page.click('.preset:has-text("Volcanic island")');
{
  const auto = page.locator('label.check:has-text("Start simulation") input');
  if (await auto.isChecked()) await auto.uncheck();
}
await page.click('text=Generate world');
await page.waitForFunction(() => window.__terraGenesis.engine.world.meta.presetId === 'volcanic-island', null, { timeout: 120000 });
await page.waitForTimeout(1500);
await shot('40-volcanic-island');
const isl = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  const w = e.world;
  let land = 0;
  let best = 0;
  for (let i = 0; i < e.surface.length; i++) {
    if (e.surface[i] > w.seaLevelM) land++;
    if (e.surface[i] > e.surface[best]) best = i;
  }
  const s0 = e.surface.reduce((a, v) => a + v, 0);
  const r = e.caldera({
    xM: (best % w.width) * w.cellSizeM,
    yM: Math.floor(best / w.width) * w.cellSizeM,
    radiusM: 250,
    depthM: 100,
  });
  const s1 = e.surface.reduce((a, v) => a + v, 0);
  return {
    land,
    top: e.surface[best],
    cells: r.cells,
    vol: r.volumeM3,
    drop: (s0 - s1) * w.cellSizeM * w.cellSizeM,
    label: e.history.undoLabel,
    s0,
  };
});
await page.waitForTimeout(1200);
await shot('41-caldera');
await page.keyboard.press('Control+z');
await page.waitForTimeout(500);
const islUndo = await sum();
check(
  'volcanic island preset grows an island; caldera drops exactly its volume and undo restores',
  isl.land > 50 &&
    isl.top > 50 &&
    isl.cells > 50 &&
    Math.abs(isl.drop - isl.vol) < 1e-3 * isl.vol &&
    isl.label === 'Caldera collapse' &&
    Math.abs(islUndo - isl.s0) < 1e-6 * Math.abs(isl.s0) + 1e-3,
  JSON.stringify({ ...isl, s0: undefined }),
);

// --- Measure tool (M09-C01): pins read real cell values; pair distance; transect CSV ---
await page.keyboard.press('m');
await page.waitForTimeout(300);
for (const [x, y] of [
  [620, 470],
  [860, 430],
]) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);
}
await page.waitForTimeout(1200);
const ms = await page.evaluate(() => {
  const t = window.__terraGenesis;
  const pins = t.ui().pins;
  const e = t.engine;
  const w = e.world;
  const cell = (p) => Math.round(p.yM / w.cellSizeM) * w.width + Math.round(p.xM / w.cellSizeM);
  return {
    n: pins.length,
    d: pins.length === 2 ? Math.hypot(pins[1].xM - pins[0].xM, pins[1].yM - pins[0].yM) : 0,
    zA: pins[0] ? e.surface[cell(pins[0])] : null,
  };
});
const mp = await page.textContent('.measure-panel');
const fmtD = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(0)} m`);
await shot('42-measure-pins');
await page.click('.measure-panel button:has-text("Cross-section")');
await page.waitForTimeout(800);
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('button:has-text("Download CSV")')]);
const csvRows = (await (await import('node:fs')).promises.readFile(await dl.path(), 'utf8')).trim().split('\n');
check(
  'measure pins show real cell values and the pair distance; transect CSV downloads',
  ms.n === 2 && mp.includes(fmtD(ms.d)) && mp.includes(`${ms.zA.toFixed(1)} m`) && csvRows.length === 161 && csvRows[0].startsWith('distance_m,'),
  `pins ${ms.n} d=${fmtD(ms.d)} zA=${ms.zA?.toFixed(1)} csv ${csvRows.length} rows`,
);

// --- Map overlays (M09-C02): every offered overlay recolours the map and shows a legend; none without data ---
await page.keyboard.press('1');
await page.selectOption('.timebar select.overlay-select', 'none');
await page.waitForTimeout(800);
const ovClip = { x: 300, y: 200, width: 600, height: 400 };
const ovBase = await page.screenshot({ clip: ovClip });
const offered = await page.$$eval('.timebar select.overlay-select option', (o) => o.map((x) => x.value).filter((v) => v !== 'none'));
const changed = [];
for (const id of ['elevation', 'slope', 'aspect', 'flow', 'geology'].filter((v) => offered.includes(v))) {
  await page.selectOption('.timebar select.overlay-select', id);
  await page.waitForTimeout(900);
  const img = await page.screenshot({ clip: ovClip });
  const legend = await page.$('.timebar .legend');
  if (!img.equals(ovBase) && legend) changed.push(id);
  if (id === 'flow') await shot('43-overlay-flow');
}
await page.mouse.move(700, 480);
await page.waitForTimeout(600);
const ovText = await page.textContent('.inspect').catch(() => '');
await page.selectOption('.timebar select.overlay-select', 'none');
const noIce = await page.evaluate(() => Math.max(...window.__terraGenesis.engine.world.iceThicknessM) === 0);
check(
  'map overlays recolour the terrain with legends; overlays without data are not offered',
  changed.length === 5 && noIce && !offered.includes('ice') && /Geology/.test(ovText ?? ''),
  `changed ${changed.join(',')} · offered ${offered.join(',')} · noIce ${noIce} · inspector ${JSON.stringify((ovText ?? '').slice(0, 80))}`,
);

// --- Checkpoints (M09-C03): take, change the world, compare (summary + map), restore exactly ---
await page.click('.topbar button:has-text("Checkpoints")');
await page.fill('.dialog input[aria-label="Checkpoint name"]', 'before the hill');
await page.click('.dialog button:has-text("Take checkpoint")');
await page.waitForTimeout(300);
const cp0 = await sum();
await page.click('.dialog [aria-label="Close"]');
await page.keyboard.press('2'); // raise brush
await page.mouse.move(700, 470);
await page.mouse.down();
for (let k = 0; k < 15; k++) {
  await page.mouse.move(700 + k * 3, 470 - k, { steps: 1 });
  await page.waitForTimeout(50);
}
await page.mouse.up();
await page.waitForTimeout(300);
const cp1 = await sum();
await page.click('.topbar button:has-text("Checkpoints")');
await page.click('.dialog button:has-text("Compare")');
await page.waitForTimeout(300);
const summary = await page.textContent('.dialog table.summary');
await page.click('.dialog button:has-text("Map ground change")');
await page.waitForTimeout(1200);
await shot('44-checkpoint-change');
const legendOk = (await page.textContent('.timebar .legend').catch(() => '')).includes('higher');
await page.click('.topbar button:has-text("Checkpoints")');
await page.click('.dialog button:has-text("Restore")');
await page.waitForTimeout(800);
const cp2 = await sum();
await page.click('.dialog [aria-label="Close"]');
await page.selectOption('.timebar select.overlay-select', 'none').catch(() => {});
check(
  'checkpoint: compare summarises and maps the change; restore returns the exact world',
  cp1 > cp0 + 1 && /Ground raised/.test(summary ?? '') && legendOk && cp2 === cp0,
  `Δ=${(cp1 - cp0).toFixed(1)} restoredΔ=${(cp2 - cp0).toFixed(4)} legend=${legendOk}`,
);

// --- Challenges (M09-C04): seeded start, live score, pass from measured new land ---
await page.click('.topbar button:has-text("Challenges")');
await page.click('.challenge-list li:has-text("volcanic island") button:has-text("Start")');
await page.waitForTimeout(1500);
const ch0 = await page.evaluate(() => window.__terraGenesis.ui().challenge);
await page.click('.rail-btn:has-text("Volcano")');
await page.selectOption('.volcano-panel select >> nth=0', 'island');
await page.locator('.volcano-panel input[type=range]').nth(0).fill('6');
await page.mouse.move(720, 450);
await page.mouse.down();
await page.mouse.up();
await page.waitForFunction(() => window.__terraGenesis.ui().challenge?.status === 'passed', null, { timeout: 300000 }).catch(() => {});
await page.waitForTimeout(800);
const ch1 = await page.evaluate(() => window.__terraGenesis.ui().challenge);
const hud = await page.textContent('.challenge-hud').catch(() => '');
await shot('45-challenge-island');
await page.click('.challenge-hud button:has-text("Close")').catch(() => {});
check(
  'challenge: island goal starts unmet and passes from measured new land',
  ch0?.status === 'running' && ch0.fraction === 0 && ch1?.status === 'passed' && /Complete/.test(hud ?? ''),
  `${ch0?.text} → ${ch1?.status}: ${ch1?.text}`,
);

// --- Education Mode (M10-C01): classroom layout, real-feature labels, stage states restored exactly ---
const clickLesson = (label) =>
  page.evaluate((t) => [...document.querySelectorAll('.lesson-panel button')].find((b) => b.textContent.includes(t))?.click(), label);
await page.click('.topbar button:has-text("Lessons")');
await page.click('.challenge-list li:has-text("drainage basin") button:has-text("Start")');
await page.waitForFunction(() => window.__terraGenesis.ui().education && !window.__terraGenesis.ui().education.busy, null, { timeout: 60000 });
await page.waitForTimeout(1200);
const st1 = await page.evaluate(() => ({
  labels: window.__terraGenesis.ui().lessonLabels.map((l) => l.text),
  t: window.__terraGenesis.engine.world.simTimeSeconds,
}));
const railHidden = await page.$eval('.toolrail', (el) => getComputedStyle(el).display === 'none').catch(() => true);
await shot('46-lesson-stage1');
await clickLesson('Next');
await page.waitForFunction(() => window.__terraGenesis.ui().education.stage === 1 && !window.__terraGenesis.ui().education.busy, null, { timeout: 600000 });
const st2 = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  let water = 0;
  for (const d of e.world.waterDepthM) water += d;
  return { t: e.world.simTimeSeconds, water };
});
await clickLesson('Previous');
await page.waitForFunction(() => window.__terraGenesis.ui().education.stage === 0, null, { timeout: 60000 });
await page.waitForTimeout(500);
const back = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  let water = 0;
  for (const d of e.world.waterDepthM) water += d;
  return { t: e.world.simTimeSeconds, water };
});
await clickLesson('Exit lesson');
await page.waitForTimeout(500);
check(
  'lesson: classroom layout, labels from the simulated basin, Next runs 2 h of rain, Previous restores stage 1 exactly',
  railHidden &&
    st1.labels.includes('Watershed') &&
    st1.labels.includes('Mouth') &&
    st2.t - st1.t === 7200 &&
    st2.water > 0 &&
    back.t === st1.t &&
    back.water === 0,
  `labels ${st1.labels.join('/')} · t ${st1.t}→${st2.t}→${back.t} · water ${st2.water.toFixed(1)}→${back.water}`,
);

// --- Guided river lessons (M10-C02): waterfall retreat and meander cut-off, marked as guided models ---
const guidedRun = async (name, steps) => {
  await page.evaluate(() => window.__terraGenesis.ui().set({ dialog: 'lessons' }));
  await page.waitForTimeout(300);
  await page.click(`.challenge-list li:has-text("${name}") button:has-text("Start")`);
  await page.waitForTimeout(600);
  for (let k = 0; k < steps; k++) {
    await clickLesson('Next');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(4500); // stage animation
  return page.textContent('.guided-stage');
};
const wf = await guidedRun('waterfall', 3);
await shot('47-guided-waterfall');
const mn = await guidedRun('Meanders', 3);
await shot('48-guided-meander');
await clickLesson('Exit lesson');
check(
  'guided lessons: waterfall retreats to leave a gorge; meander cut off into an oxbow; both marked as guided models',
  /Gorge \d+ m long/.test(wf ?? '') &&
    /collapse/.test(wf ?? '') &&
    /Oxbow lake/.test(mn ?? '') &&
    /Guided model/.test(wf ?? '') &&
    /Guided model/.test(mn ?? ''),
  `${(wf ?? '').match(/Gorge \d+ m long/)?.[0]} · ${(mn ?? '').match(/Oxbow lake/)?.[0]}`,
);

// --- Coastal lessons (M10-C03): arch model run to the stack stage; spit grows ---
await guidedRun('Caves, arches', 3);
await page.waitForFunction(() => /Now: Stack/.test(document.querySelector('.guided-stage')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
const archTxt = await page.textContent('.guided-stage');
await shot('49-lesson-stack');
await guidedRun('Longshore drift', 3);
await page.waitForFunction(() => /30 years/.test(document.querySelector('.guided-stage')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
const spitTxt = await page.textContent('.guided-stage');
await shot('50-lesson-spit');
await clickLesson('Exit lesson');
check(
  'coastal lessons: the chalk headland model reaches a stack; the spit lesson runs the shoreline model for 30 years',
  /Now: Stack/.test(archTxt ?? '') && /30 years/.test(spitTxt ?? '') && /Guided model/.test(spitTxt ?? ''),
  `${(archTxt ?? '').match(/Now: \w+/)?.[0]} · ${(spitTxt ?? '').match(/\d+ years/)?.[0]}`,
);

// --- Flood hazards (M11-C01): storm from the Floods panel; peak depth record, extent overlay, event log ---
await page.keyboard.press('h');
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('.hazards-panel button')?.click()); // Start storm
await page.waitForTimeout(500);
const flood = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  e.setPlaying(false);
  e.advance(2400);
  const p = e.flood.peak;
  const d = e.world.waterDepthM;
  let below = 0;
  for (let i = 0; i < d.length; i++) if (p[i] < d[i]) below++;
  e.stopHazard();
  const f = e.floodSummary();
  let n = 0;
  for (let i = 0; i < p.length; i++) if (p[i] - e.flood.start[i] >= 0.3) n++;
  return { below, cells: f.cells, n, area: f.areaM2, deep: f.peakDepthM, log: e.hazardLog.map((l) => l.text), rain: e.world.water.rainMPerS };
});
await page.waitForTimeout(1500);
const floodPanel = await page.textContent('.hazards-panel');
const floodLegend = (await page.textContent('.timebar .legend').catch(() => '')) ?? '';
await shot('51-flood-extent');
check(
  'flood hazards: storm records the deepest water (≥ every depth), extent = cells over the threshold, overlay legend, event logged',
  flood.below === 0 && flood.cells === flood.n && /Land flooded/.test(floodPanel ?? '') && /0.3 m/.test(floodLegend) && /ended/.test(flood.log.join(' ')),
  `${(flood.area / 1e6).toFixed(3)} km² · deepest ${flood.deep.toFixed(2)} m · cells below peak ${flood.below} · legend ${/0.3 m/.test(floodLegend)}`,
);
await page.keyboard.press('1');

// --- Drought + meteor (M11-C02): low-water record, drought map, crater from a map click, undo, comparison table ---
await page.keyboard.press('h');
await page.waitForTimeout(400);
await page.evaluate(() => [...document.querySelectorAll('.hazards-panel button')].find((b) => /Start drought/.test(b.textContent))?.click());
await page.waitForTimeout(500);
const drought = await page.evaluate(() => {
  const e = window.__terraGenesis.engine;
  e.setPlaying(false);
  e.advance(86400);
  const low = e.flood.peak;
  const d = e.world.waterDepthM;
  let above = 0;
  for (let i = 0; i < d.length; i++) if (low[i] > d[i]) above++;
  e.stopHazard();
  return { above, kind: e.flood.kind, dried: e.droughtSummary().driedM2, wet: e.droughtSummary().wetStartM2 };
});
await page.waitForTimeout(1500);
const droughtLegend = (await page.textContent('.timebar .legend').catch(() => '')) ?? '';
const comparePanel = (await page.textContent('.hazards-panel')) ?? '';
await shot('52-drought');
await page.keyboard.press('j');
await page.waitForTimeout(400);
const preImpact = await sum();
await page.mouse.click(700, 480);
await page.waitForTimeout(1500);
const impactToast = (await page.textContent('.toasts').catch(() => '')) ?? '';
const crater = await page.evaluate(
  () =>
    window.__terraGenesis.engine.lastImpact && {
      d: window.__terraGenesis.engine.lastImpact.diameterM,
      ex: window.__terraGenesis.engine.lastImpact.excavatedM3,
    },
);
await shot('53-meteor-crater');
const postImpact = await sum();
await page.keyboard.press('Control+z');
await page.waitForTimeout(800);
const undone = await sum();
check(
  'drought records the lowest water (≤ every depth) with its map; meteor click digs a crater, Ctrl+Z removes it; events compared',
  drought.above === 0 &&
    drought.kind === 'drought' &&
    /dried up/.test(droughtLegend) &&
    /Compare events/.test(comparePanel) &&
    /Impact: crater/.test(impactToast) &&
    postImpact !== preImpact &&
    undone === preImpact,
  `dried ${(drought.dried / 1e6).toFixed(3)} of ${(drought.wet / 1e6).toFixed(3)} km² · crater ${crater ? Math.round(crater.d) : '—'} m, ${crater ? Math.round(crater.ex) : 0} m³ · undo ${undone === preImpact}`,
);
await page.keyboard.press('1');

// --- Exports (M11-C03): every item in the Export dialog downloads a real file of the right kind ---
const fsp = (await import('node:fs')).promises;
await page.click('.topbar button:has-text("Export")');
await page.waitForTimeout(400);
const grab = async (id, n = 1) => {
  const dls = [];
  const got = new Promise((resolve) => {
    const on = (d) => {
      dls.push(d);
      if (dls.length === n) {
        page.off('download', on);
        resolve();
      }
    };
    page.on('download', on);
  });
  await page.click(`[data-export="${id}"]`);
  await Promise.race([got, page.waitForTimeout(20000)]);
  return Promise.all(dls.map(async (d) => ({ name: d.suggestedFilename(), bytes: await fsp.readFile(await d.path()) })));
};
const isPng = (b) => b && b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71;
const ex = {};
for (const [id, n] of [
  ['project', 1],
  ['view', 1],
  ['map', 1],
  ['heightmap', 1],
  ['raw', 2],
])
  ex[id] = await grab(id, n);
const dims = await page.evaluate(() => ({
  W: window.__terraGenesis.engine.world.width,
  H: window.__terraGenesis.engine.world.height,
  z0: window.__terraGenesis.engine.surface[0],
}));
const hm = ex.heightmap[0]?.bytes;
const raw = ex.raw.find((f) => f.name.endsWith('.raw'))?.bytes;
const meta = ex.raw.find((f) => f.name.endsWith('.json'));
const metaJson = meta ? JSON.parse(meta.bytes.toString('utf8')) : {};
const exportOk = {
  project: ex.project[0]?.bytes[0] === 0x1f && ex.project[0]?.bytes[1] === 0x8b && ex.project[0].bytes.length > 1000,
  view: isPng(ex.view[0]?.bytes) && ex.view[0].bytes.length > 5000,
  map: isPng(ex.map[0]?.bytes) && ex.map[0].bytes.readUInt32BE(16) >= dims.W,
  heightmap: isPng(hm) && hm.readUInt32BE(16) === dims.W && hm.readUInt32BE(20) === dims.H && hm[24] === 16 && hm[25] === 0 && hm.includes('MinElevationM'),
  raw: raw?.length === dims.W * dims.H * 4 && Math.abs(raw.readFloatLE(0) - dims.z0) < 1e-3 && metaJson.width === dims.W,
};
await page.click('.dialog [aria-label="Close"]');
check(
  'exports: project file, view image, map image, 16-bit heightmap and float32 raw + json all download with the right content',
  Object.values(exportOk).every(Boolean),
  JSON.stringify(exportOk),
);

// --- Accessibility (M11-C04): every button has an accessible name; Tab reaches controls with a visible focus ring; Escape closes dialogs ---
const unnamed = await page.$$eval('button', (bs) => bs.filter((b) => !(b.textContent?.trim() || b.getAttribute('aria-label') || b.title)).map((b) => b.outerHTML.slice(0, 80)));
await page.keyboard.press('1');
await page.locator('.topbar button').first().focus();
const tabbed = [];
for (let k = 0; k < 6; k++) {
  await page.keyboard.press('Tab');
  tabbed.push(
    await page.evaluate(() => {
      const el = document.activeElement;
      const cs = el ? getComputedStyle(el) : null;
      return { tag: el?.tagName, ring: !!cs && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1 };
    }),
  );
}
await page.click('.topbar button:has-text("Export")');
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const dialogGone = (await page.$('.dialog')) === null;
check(
  'accessibility: every button is named, Tab moves through controls with a visible focus ring, Escape closes dialogs',
  unnamed.length === 0 && tabbed.every((t) => ['BUTTON', 'INPUT', 'SELECT', 'A'].includes(t.tag) && t.ring) && dialogGone,
  `unnamed ${unnamed.length}${unnamed.length ? ' e.g. ' + unnamed[0] : ''} · tab ${tabbed.map((t) => t.tag + (t.ring ? '✓' : '✗')).join(' ')} · escape ${dialogGone}`,
);

const fps = await page.textContent('.perf');
check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} checks passed`);
console.log('perf:', fps);
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
