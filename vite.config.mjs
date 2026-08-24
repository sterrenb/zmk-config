import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyFileSync, existsSync } from 'node:fs';

export default defineConfig({
  root: 'site',
  publicDir: false,
  server: {
    port: 8080,
    fs: {
      allow: [resolve(__dirname, '.')]
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  },
  plugins: [
    {
      name: 'copy-headers',
      closeBundle() {
        const headers = resolve(__dirname, 'site/_headers');
        const dest = resolve(__dirname, 'dist/_headers');
        if (existsSync(headers)) {
          copyFileSync(headers, dest);
        }
      }
    }
  ]
});

