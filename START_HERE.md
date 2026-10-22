# Terra Genesis — start here

## Run it on your Mac
1. Install Node.js 22 LTS from https://nodejs.org
2. Unzip this folder, open Terminal inside it, then run:

   ```
   npm install
   npm run dev
   ```
3. Open http://localhost:5173 in Chrome or Safari.

## Put it online (Netlify)
- Easiest: unzip `terra-genesis-netlify-dist.zip` and drag the folder onto https://app.netlify.com/drop
- Or push this folder to GitHub and connect it in Netlify. `netlify.toml` already sets the build (`npm run build`, publish `dist`).

## Continue building with an AI
Give it this folder (full git history is included in `.git`) plus the resume prompt from `docs/MASTER_SPEC.md` section A9.
It should read `AGENTS.md`, `docs/PROJECT_STATE.md` and `docs/NEXT_TASK.md` first. Next task: M02-C01 (water).
