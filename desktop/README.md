# Terra Genesis — Mac desktop app

An Electron window around the normal web build (`dist/`), served from `app://terra/` so it works offline.

Build (from the repository root):
1. `npm run build`
2. `cd desktop && npm install && cd ..`
3. `node desktop/build/package-mac.mjs` (on Linux add `--rcodesign /path/to/rcodesign`;
   if the Electron download is blocked add `--electron-zips /folder/with/electron-v44.7.0-darwin-*.zip`)

Output: `desktop/out/Terra-Genesis-mac-apple-silicon.zip` and `Terra-Genesis-mac-intel.zip`, each with
`HOW TO INSTALL.txt`. Icon: `python3 desktop/build/make-icon.py desktop/build/icon` (writes icon.png + icon.icns).

Smoke test (any OS, after copying dist to desktop/web): `TG_SMOKE_SHOT=/tmp/shot.png npx electron desktop`
writes a screenshot and `/tmp/shot.png.json` (version, water backend, cells), then quits.
