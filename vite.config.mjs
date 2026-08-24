import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: 'site',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022'
  },
  server: {
    port: 8080,
    fs: {
      allow: [resolve(__dirname, '.')]
    }
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
