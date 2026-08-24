# 🌐 Keymap Viewer Web Application

An accessible, interactive web viewer for the ZMK keymap diagrams, published via Cloudflare Pages.

---

## Features

- **Interactive Tooltips:** Keys and combos marked with indicator dots can be clicked or hovered to inspect detailed behavior documentation, timings, and ZMK configuration parameters.
- **Group Highlighting:** Hovering or clicking Home Row Mods (<kbd>A</kbd>–<kbd>F</kbd> / <kbd>J</kbd>–<kbd>;</kbd>) or Bluetooth profile keys highlights all related peer keys simultaneously with dotted outlines.
- **Combo Inspector:** Combos (like Caps Word and Caps Lock) highlight their source trigger keys on the base layer.
- **Full Keyboard & a11y Navigation:** Full WCAG AA/AAA compliance with <kbd>Tab</kbd> focus rings, <kbd>Enter</kbd>/<kbd>Space</kbd> activation, and <kbd>Esc</kbd> dismissal.
- **Light / Dark Themes:** Automatic system preference detection with manual toggle and zero-flicker paint.
- **On-the-Fly Downloads:** Instant export to SVG or $2\times$ high-resolution PNG rasterized directly in the browser.

---

## Running Locally

1. **Development Server (HMR):**
   ```powershell
   npm run dev
   ```
   Opens <http://localhost:8080> with live hot module reloading.

2. **Production Build & Preview:**
   ```powershell
   npm run build
   npm run preview
   ```

---

## Tooltip Authoring (`site/tooltips.mjs`)

Tooltips are declarative ES module objects matched on **behavior binding** (e.g. `&hml`, `&bootloader`, `&sys_reset`), not hardcoded key positions. If you move a key in `config/shared/keymap.dtsi`, its tooltip follows automatically.

* `group: true`: Highlights all keys sharing this behavior across the active layer.
* `zmkDoc: '...'`: Adds a direct link icon to official ZMK behavior documentation.
* Backtick syntax (e.g. `` `Ctrl+Shift+Z` `` or `` `Insert` ``): Automatically formatted as `<kbd>` badges.

---

## Cloudflare Pages Deployment

The site deploys automatically on push/merge to `main`.

| Setting | Value |
| :--- | :--- |
| **Framework preset** | `None` |
| **Build command** | `node scripts/build-site.mjs` |
| **Build output directory** | `dist` |
| **Root directory** | ` ` *(repository root)* |

