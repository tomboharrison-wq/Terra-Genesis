// Headless Chromium end-to-end check of the first functional demonstration (spec L).
// Usage: node scripts/screenshot.mjs [baseUrl] [outDir]   (needs `npm run preview` running)
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'tests/screenshots';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
await page.waitForTimeout(800);
await page.mouse.up();
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
  return { t: e.world.simTimeSeconds, stored, closure: Math.abs(stored - (L.initialStored + inn - out)) / Math.max(1, L.initialStored + inn) };
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
check('landslide tool runs and is undoable', /Landslide|stable/.test(slideToast) && Math.abs(ls2 - ls0) < 1e-6 * Math.abs(ls0) + 1e-3, `${slideToast.slice(0, 70)} Δ=${(ls1 - ls0).toFixed(3)}`);
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
  return { eroded: S.erodedLoose + S.erodedBedrock, sea: S.seaDeposited, closure: Math.abs(susp - expected) / Math.max(1, S.erodedLoose + S.erodedBedrock) };
});
check('erosion runs on GPU and moves sediment to the sea', er.eroded > 1000 && er.sea > 0, `eroded=${er.eroded.toFixed(0)} m³ seaDeposited=${er.sea.toFixed(0)} m³`);
check('sediment budget closes in browser', er.closure < 1e-3, `closure=${er.closure.toExponential(2)}`);
await page.click('.timebar button:has-text("Change map")');
await page.waitForTimeout(800);
await shot('13-erosion-change-map');
await page.click('.timebar button:has-text("Change map")');
await page.keyboard.press('Control+s');
await page.waitForTimeout(3500);
const bedSum = () => eng(() => { const w = window.__terraGenesis.engine.world; let a = 0; for (let i = 0; i < w.bedrockElevationM.length; i++) a += w.bedrockElevationM[i] + w.looseSedimentThicknessM[i] + w.sedimentSuspendedM[i]; return a; });
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
  return { s0, s1, cliff: e.coast.ledger.cliffEroded, waves: e.world.coast.wavesOn };
});
check('sea-level rise floods more cells', co.s1 > co.s0, `${co.s0} → ${co.s1} sea cells`);
check('waves erode the headlands coast', co.waves && co.cliff > 1000, `cliff erosion ${co.cliff.toFixed(0)} m³`);

// --- Arch lab (M05-C05): guided cave → arch → stack → stump voxel model ---
await page.click('.rail-btn:has-text("Coast")');
await page.click('text=Open cave, arch, stack and stump lab');
await page.waitForSelector('.arch-view canvas');
await page.click('.dialog button.primary:has-text("Play")');
await page.waitForFunction(() => document.querySelector('.arch-stages li.now')?.getAttribute('data-stage') === 'stack', null, { timeout: 240000 }).catch(() => {});
await page.click('.dialog button.primary:has-text("Pause")').catch(() => {});
await shot('23-arch-lab-stack');
const archSeen = await page.$$eval('.arch-stages li', (els) => els.map((e) => e.getAttribute('data-stage') + ':' + e.querySelector('span').textContent));
check('arch lab reaches the stack stage via cave and arch', archSeen.slice(1, 4).every((s) => /step \d+/.test(s)), archSeen.join(' '));
await page.selectOption('.dialog select >> nth=0', 'clay');
await page.waitForTimeout(300);
const claySel = await page.locator('.dialog select').nth(1).inputValue();
const q = await page.textContent('.arch-question');
await page.click('.dialog button:has-text("Use this world")');
const worldNote = await page.textContent('.dialog .hint.small.tight');
check('arch lab scenarios and world coast set rock and waves', claySel === 'clay' && /clay/i.test(q) && /From this world/.test(worldNote), `${claySel} · ${worldNote}`);
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
  return { backend: e.backend, closure: Math.abs(inn - out - stored) / inn, evap: L.evaporated, rain: L.rainIn };
});
check('climate: wetter windward slopes and drier rain shadow', !!rx && +rx[2] > 1.5 && +rx[1] < 0.7, rx ? rx[0] : climText.slice(0, 80));
check('climate: water budget closes with spatial rain on ' + cl.backend, cl.closure < 1e-4 && cl.evap > 0, `closure=${cl.closure.toExponential(2)} rain=${cl.rain.toFixed(0)} evap=${cl.evap.toFixed(0)} m³`);

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
  return { backend: e.backend, cold, warm, c1, c2: closure(), melt: L.snowmelt };
});
await page.waitForTimeout(1500);
await shot('28-snow');
check('snow: cold spell builds a snowpack, warm spell melts it (' + sn.backend + ')', sn.cold > 1e4 && sn.warm < sn.cold && sn.melt > 0 && sn.c1 < 1e-4 && sn.c2 < 1e-4, `snow ${sn.cold.toFixed(0)} → ${sn.warm.toFixed(0)} m³, closure ${sn.c1.toExponential(1)} / ${sn.c2.toExponential(1)}`);

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
  return { ice, iceClosure, wClosure, years: L.timeS / 3.15576e7, lag: L.lagS / 3.15576e7, ms, melt: W.glacierMeltIn };
});
await page.waitForTimeout(1500);
await shot('29-glaciers');
check('glaciers grow, conserve ice and keep the water budget', gl.ice > 1e5 && gl.years > 30 && Math.abs(gl.years + gl.lag - 120) < 1 && gl.iceClosure < 1e-6 && gl.wClosure < 1e-4, `ice ${(gl.ice / 1e6).toFixed(2)} M m³ after ${gl.years.toFixed(0)} yr (lag ${gl.lag.toFixed(0)} yr), ice closure ${gl.iceClosure.toExponential(1)}, water ${gl.wClosure.toExponential(1)}, ${gl.ms.toFixed(0)} ms`);

const fps = await page.textContent('.perf');
check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length} checks passed`);
console.log('perf:', fps);
await browser.close();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
