// Build the macOS desktop app (Apple Silicon and Intel) from the web build.
// Usage (from the repository root, after `npm run build`):
//   node desktop/build/package-mac.mjs [--rcodesign /path/to/rcodesign] [--electron-zips /folder]
// Output: desktop/out/Terra-Genesis-mac-apple-silicon.zip and Terra-Genesis-mac-intel.zip.
// Apple Silicon only runs signed code, so each app is ad-hoc signed (no Apple developer ID:
// macOS asks once before opening it — see HOW-TO-INSTALL.txt). On a Mac, `codesign` is used;
// on Linux, pass --rcodesign (apple-codesign, https://github.com/indygreg/apple-platform-rs).
import { packager } from '@electron/packager';
import { cpSync, rmSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(desktop, '..');
const out = path.join(desktop, 'out');
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const rcodesign = arg('--rcodesign');
/** Folder of pre-downloaded electron-v<version>-darwin-<arch>.zip files (checksums verified), if the download is blocked. */
const electronZipDir = arg('--electron-zips');

if (!existsSync(path.join(repo, 'dist', 'index.html'))) throw new Error('Run `npm run build` first (dist/ is missing).');
rmSync(path.join(desktop, 'web'), { recursive: true, force: true });
cpSync(path.join(repo, 'dist'), path.join(desktop, 'web'), { recursive: true });
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const targets = [
  { arch: 'arm64', zip: 'Terra-Genesis-mac-apple-silicon.zip' },
  { arch: 'x64', zip: 'Terra-Genesis-mac-intel.zip' },
];
for (const t of targets) {
  const [dir] = await packager({
    dir: desktop,
    out,
    name: 'Terra Genesis',
    platform: 'darwin',
    arch: t.arch,
    electronVersion: '44.7.0',
    icon: path.join(desktop, 'build', 'icon.icns'),
    appBundleId: 'org.terragenesis.app',
    appCategoryType: 'public.app-category.education',
    appCopyright: 'Terra Genesis',
    appVersion: '1.0.0',
    asar: true,
    overwrite: true,
    osxSign: false,
    ...(electronZipDir ? { electronZipDir } : {}),
    ignore: [/^\/out($|\/)/, /^\/build($|\/)/, /^\/node_modules($|\/)/, /^\/package-lock\.json$/],
  });
  const appPath = path.join(dir, 'Terra Genesis.app');
  if (process.platform === 'darwin') execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  else if (rcodesign) execFileSync(rcodesign, ['sign', appPath], { stdio: 'inherit' });
  else console.warn('WARNING: not signed — Apple Silicon will refuse to open it. Pass --rcodesign.');
  copyFileSync(path.join(desktop, 'build', 'HOW-TO-INSTALL.txt'), path.join(dir, 'HOW TO INSTALL.txt'));
  // -y keeps the framework symlinks that macOS app bundles rely on.
  execFileSync('zip', ['-qry', path.join(out, t.zip), 'Terra Genesis.app', 'HOW TO INSTALL.txt'], { cwd: dir });
  console.log('built', path.join(out, t.zip));
}
