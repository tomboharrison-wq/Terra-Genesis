/// <reference types="vitest/config" />
/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

/** Build identity shown in Help and on window.__terraGenesis.version (Cloudflare, GitHub Actions, Netlify). */
function commit(): string {
  const env = process.env.CF_PAGES_COMMIT_SHA || process.env.COMMIT_REF || process.env.GITHUB_SHA;
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
    __APP_VERSION__: JSON.stringify(`${commit()} · built ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`),
  },
  build: {
    target: 'es2022',
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000 },
});
