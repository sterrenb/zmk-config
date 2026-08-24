// Build the static site into dist/ using Vite.
//
//     node scripts/build-site.mjs
//
// Generates site/tooltips.json and executes Vite's optimized production build.

import { execFileSync } from 'node:child_process';
import { build } from 'vite';

// 1. Build tooltips dictionary
execFileSync(process.execPath, ['scripts/build-tooltips.mjs', 'site/tooltips.json'], {
  stdio: 'inherit',
});

// 2. Run Vite build
await build();
