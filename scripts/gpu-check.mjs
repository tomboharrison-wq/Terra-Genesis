// Runs the CPU-vs-GPU water solver comparison in headless Chromium.
// Usage: node scripts/gpu-check.mjs [baseUrl]   (needs `npm run preview` on :4173)
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(base + '?fresh');
await page.waitForSelector('canvas');
const res = await page.evaluate(() => window.__terraGenesis.gpuSelfTest(1800));
let fail = false;
for (const r of res) {
  // Smooth fixtures must match tightly; the turbulent rain case diverges by float32-vs-float64
  // round-off, so it is judged on mean depth error and total stored volume.
  const volRel = Math.abs(r.gpuStoredM3 - r.cpuStoredM3) / Math.max(1, r.cpuStoredM3);
  let ok = r.gpuClosure < 1e-3 && (r.name === 'river-catchment' ? r.meanAbsDiffM < 1e-3 && volRel < 1e-3 : r.maxAbsDiffM < 0.01);
  let extra = '';
  if (r.maxBedDiffM !== undefined) {
    const erRel = Math.abs(r.gpuErodedM3 - r.cpuErodedM3) / Math.max(1, r.cpuErodedM3);
    ok = ok && r.gpuSedClosure < 1e-3 && erRel < 0.02 && r.maxBedDiffM < 0.05 && r.exposedMismatch <= 2;
    extra = ` | bed maxΔ ${(r.maxBedDiffM * 1000).toFixed(2)} mm, eroded cpu ${r.cpuErodedM3.toFixed(1)} gpu ${r.gpuErodedM3.toFixed(1)} m³, sed closure cpu ${r.cpuSedClosure.toExponential(2)} gpu ${r.gpuSedClosure.toExponential(2)}, exposed-rock mismatches ${r.exposedMismatch}`;
  }
  fail ||= !ok;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${r.name}: maxΔdepth ${(r.maxAbsDiffM * 1000).toFixed(3)} mm, meanΔ ${(r.meanAbsDiffM * 1000).toFixed(4)} mm, stored cpu ${r.cpuStoredM3.toFixed(1)} gpu ${r.gpuStoredM3.toFixed(1)} m³, closure cpu ${r.cpuClosure.toExponential(2)} gpu ${r.gpuClosure.toExponential(2)}, ${r.steps} steps, ${r.gpuMsPerStep.toFixed(3)} ms/step submit${extra}`);
}
await browser.close();
process.exit(fail ? 1 : 0);
