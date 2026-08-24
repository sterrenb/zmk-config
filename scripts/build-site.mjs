// Build the static site into dist/ using Vite.
//
//     node scripts/build-site.mjs
//
// Cloudflare Pages build command: npm run build (or node scripts/build-site.mjs)

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

// 1. Build tooltips lookup table into site/tooltips.json
execFileSync(
  process.execPath,
  [resolve(root, 'scripts/build-tooltips.mjs'), 'site/tooltips.json'],
  {
    cwd: root,
    stdio: 'inherit'
  }
);

// 2. Run Vite build
const { build } = await import('vite');
await build({
  configFile: resolve(root, 'vite.config.mjs')
});
