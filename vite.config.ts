/// <reference types="vitest/config" />
/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { modelHash } from './scripts/modelHash';

/** Build identity shown in Help and on window.__terraGenesis.version (Netlify sets COMMIT_REF). */
function commit(): string {
  const env = process.env.COMMIT_REF;
  if (env) return env.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __MODEL_HASH__: JSON.stringify(modelHash(__dirname)),
    __APP_VERSION__: JSON.stringify(`${commit()} · built ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`),
  },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000 },
});
