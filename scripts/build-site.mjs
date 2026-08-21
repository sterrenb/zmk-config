// Build the static site into dist/.
//
//     node scripts/build-site.mjs
//
// Used as the Cloudflare Pages build command, and runs identically in Windows
// PowerShell, Git Bash and CI -- Node is already required for the tooltip step,
// so depending on a POSIX shell as well bought nothing.
//
// site/index.html points its <img> at the diagram on GitHub so that opening it
// directly in a browser previews correctly. The build swaps that URL for a local
// copy under a content-hashed filename. Combined with the immutable
// Cache-Control in site/_headers, that means:
//   - unchanged diagram -> same filename -> browsers never re-fetch it
//   - changed diagram   -> new filename  -> picked up on the next page load

import { existsSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const SRC_DIR = 'site';
const OUT_DIR = 'dist';

// Must match the <img src> committed in site/index.html.
const REMOTE_SVG =
  'https://raw.githubusercontent.com/sterrenb/zmk-config/main/keymap-drawer/corne.svg';

const die = (msg) => {
  console.error(`error: ${msg}`);
  process.exit(1);
};

// Prefer a local render when one exists. corne.local.svg is gitignored and
// produced by scripts/draw.ps1, so iterating on the keymap locally previews the
// real thing. CI never has one, so deploys always use the committed diagram that
// the keymap-drawer workflow generated.
let srcSvg = 'keymap-drawer/corne.svg';
if (existsSync('keymap-drawer/corne.local.svg')) {
  srcSvg = 'keymap-drawer/corne.local.svg';
  console.log(`note: using local render ${srcSvg} (delete it to build against the committed diagram)`);
}

if (!existsSync(srcSvg)) die(`${srcSvg} not found (run from the repo root)`);

const indexPath = join(SRC_DIR, 'index.html');
if (!existsSync(indexPath)) die(`${indexPath} not found`);

const template = readFileSync(indexPath, 'utf8');
if (!template.includes(REMOTE_SVG)) {
  die(
    `${indexPath} does not reference ${REMOTE_SVG}\n` +
      '       REMOTE_SVG in this script and the <img src> must be kept in sync.'
  );
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(join(OUT_DIR, 'assets'), { recursive: true });

// Hash the file contents, not the commit: a push that does not touch the diagram
// must not invalidate it.
const svg = readFileSync(srcSvg);
const hash = createHash('sha256').update(svg).digest('hex').slice(0, 12);
const asset = `assets/keymap.${hash}.svg`;

writeFileSync(join(OUT_DIR, asset), svg);

const html = template.split(REMOTE_SVG).join(asset);

// The remote URL is a working image, so an unsubstituted page would look fine
// while silently hotlinking GitHub and losing the immutable caching. Check both
// directions rather than trusting the replace.
if (html.includes(REMOTE_SVG)) die(`the remote diagram URL was not replaced in ${OUT_DIR}/index.html`);
if (!html.includes(asset)) die(`${asset} is not referenced by ${OUT_DIR}/index.html`);

writeFileSync(join(OUT_DIR, 'index.html'), html);

if (existsSync(join(SRC_DIR, '_headers'))) {
  copyFileSync(join(SRC_DIR, '_headers'), join(OUT_DIR, '_headers'));
}

// Resolve tooltip definitions (matched on binding) to key positions. Fails if a
// definition no longer matches anything, or if the diagram is out of step with
// the keymap, so a rebound key cannot silently orphan its tooltip.
execFileSync(
  process.execPath,
  ['scripts/build-tooltips.mjs', join(OUT_DIR, 'tooltips.json'), srcSvg],
  { stdio: 'inherit' }
);

console.log(`built ${OUT_DIR}/ -> ${asset}`);
