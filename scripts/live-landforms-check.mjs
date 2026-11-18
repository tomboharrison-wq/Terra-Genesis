import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const out = process.argv[3] ?? '/tmp/terra-live-landforms';
const lessonUrl = (id, stage = 1) => {
  const u = new URL(base);
  u.search = new URLSearchParams({ lesson: id, stage: String(stage), fresh: '', check: String(Date.now()) }).toString();
  return u.toString();
};
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (e) => { if (e.type() === 'error') errors.push(e.text()); });
const check = (name, ok) => { if (!ok) throw Error(name); console.log(`PASS ${name}`); };
try {
  await page.goto(lessonUrl('live-headland'));
  await page.waitForFunction(() => window.__terraGenesis?.ui().education?.busy === false);
  console.log(`VERSION ${await page.evaluate(() => window.__terraGenesis.version)}`);
  await page.waitForTimeout(1000);
  check('rock is in the main world, with one renderer', await page.locator('canvas').count() === 1);
  const stage = () => page.evaluate(() => window.__terraGenesis.engine.world.meta.solidHeadland.history.at(-1).stage);
  const snapshots = [];
  for (let k = 0; k < 5; k++) {
    if (k) {
      await page.getByRole('button', { name: 'Next ▶', exact: true }).click();
      await page.waitForFunction((target) => { const e = window.__terraGenesis.ui().education; return e?.stage === target && !e.busy; }, k, { timeout: 60000 });
    }
    check(`stage ${k + 1}: measured ${await stage()}`, await stage() === ['headland', 'cave', 'arch', 'stack', 'stump'][k]);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/coast-${k}.png` });
    snapshots.push(await page.evaluate(() => JSON.stringify(window.__terraGenesis.engine.world.meta.solidHeadland)));
  }
  await page.getByRole('button', { name: /Previous/ }).click();
  await page.waitForFunction(() => window.__terraGenesis.ui().education?.stage === 3 && !window.__terraGenesis.ui().education?.busy);
  check('previous restores actual solid rock', await page.evaluate(() => JSON.stringify(window.__terraGenesis.engine.world.meta.solidHeadland)) === snapshots[3]);
  await page.getByRole('button', { name: 'Next ▶', exact: true }).click();
  await page.waitForFunction(() => window.__terraGenesis.ui().education?.stage === 4 && !window.__terraGenesis.ui().education?.busy);
  check('next restores identical saved rock', await page.evaluate(() => JSON.stringify(window.__terraGenesis.engine.world.meta.solidHeadland)) === snapshots[4]);
  await page.getByRole('button', { name: 'Exit lesson', exact: true }).click();
  await page.getByLabel('Waves on', { exact: true }).uncheck();
  const before = await page.evaluate(() => window.__terraGenesis.engine.world.meta.solidHeadland.step);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.waitForFunction(() => !window.__terraGenesis.ui().geo.busy);
  check('waves off pauses solid erosion in the worker', before === await page.evaluate(() => window.__terraGenesis.engine.world.meta.solidHeadland.step));
  await page.goto(lessonUrl('live-waterfall'));
  await page.waitForFunction(() => window.__terraGenesis?.ui().education?.busy === false);
  check('waterfall uses the main world renderer', await page.locator('canvas').count() === 1);
  for (let k = 0; k < 4; k++) {
    if (k) {
      await page.getByRole('button', { name: 'Next ▶', exact: true }).click();
      await page.waitForFunction((target) => { const e = window.__terraGenesis.ui().education; return e?.stage === target && !e.busy; }, k, { timeout: 60000 });
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/waterfall-${k}.png` });
  }
  check('river erosion removes actual rock and collapses the cap', await page.evaluate(() => {
    const s = window.__terraGenesis.engine.world.meta.solidWaterfall;
    return s.erodedM3 > 0 && s.collapsedM3 > 0 && s.exportedM3 === s.erodedM3 + s.collapsedM3;
  }));
  await page.getByRole('button', { name: 'Exit lesson', exact: true }).click();
  const q = page.getByRole('slider', { name: 'River discharge', exact: true });
  await q.focus(); await page.keyboard.press('Home');
  const volume = await page.evaluate(() => window.__terraGenesis.engine.world.meta.solidWaterfall.exportedM3);
  const year = await page.evaluate(() => window.__terraGenesis.engine.geologicYears);
  await page.getByRole('button', { name: 'Step', exact: true }).click();
  await page.waitForFunction((y) => window.__terraGenesis.engine.geologicYears > y && !window.__terraGenesis.ui().geo.busy, year);
  check('zero discharge stops numerical erosion', volume === await page.evaluate(() => window.__terraGenesis.engine.world.meta.solidWaterfall.exportedM3));
  await page.goto(lessonUrl('live-levees', 3));
  await page.waitForFunction(() => { const e = window.__terraGenesis?.ui().education; return e?.stage === 2 && !e.busy; }, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/levees.png` });
  check('levees are actual bank sediment above the distant floodplain', await page.evaluate(() => {
    const w = window.__terraGenesis.engine.world;
    return w.looseSedimentThicknessM[53 * w.width + 64] > w.looseSedimentThicknessM[73 * w.width + 64] + 0.3;
  }));
  await page.getByRole('button', { name: 'Exit lesson', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('button', { name: /^Island Single rugged island/ }).click();
  await page.getByRole('button', { name: 'Generate world', exact: true }).click();
  await page.waitForFunction(() => window.__terraGenesis.ui().world?.presetId === 'island');
  check('ordinary worlds restore heightfield physics and terrain tools', await page.evaluate(() => {
    const t = window.__terraGenesis;
    return !t.engine.world.meta.solidHeadland && !t.engine.world.meta.solidWaterfall && !t.ui().geo.mode;
  }) && await page.getByRole('button', { name: 'Raise', exact: true }).isVisible());
  check('no browser errors', errors.length === 0);
} finally {
  await browser.close();
}
