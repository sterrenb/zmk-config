# 🌐 Keymap Viewer Web Application

An accessible, interactive web viewer for the ZMK keymap diagrams, published via Cloudflare Pages.

---

## Features

- **Interactive Tooltips:** Keys and combos marked with blue indicator dots can be clicked or hovered to inspect detailed behavior documentation, timings, and ZMK configuration parameters.
- **Group Highlighting:** Hovering or clicking Home Row Mods (<kbd>A</kbd>–<kbd>F</kbd> / <kbd>J</kbd>–<kbd>;</kbd>) or Bluetooth profile keys highlights all related peer keys simultaneously with dotted outlines.
- **Combo Inspector:** Combos (like Caps Word and Caps Lock) highlight their source trigger keys on the base layer.
- **Full Keyboard & a11y Navigation:** Full WCAG AA/AAA compliance with <kbd>Tab</kbd> keyboard focus rings, <kbd>Enter</kbd>/<kbd>Space</kbd> activation, and <kbd>Esc</kbd> dismissal.
- **Light / Dark Themes:** Follows system preference with instant theme toggle and zero-flicker initial paint.
- **On-the-Fly Downloads:** Instant export to SVG or $2\times$ high-resolution PNG rasterized on the fly in the browser.

---

## Local Development

The site uses **[Vite](https://vite.dev/)** for local development and optimized production builds.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Commands

```powershell
# 1. Install dependencies
npm install

# 2. Start local dev server with Hot Module Reloading (HMR)
npm run dev

# 3. Build optimized & minified production assets into dist/
npm run build

# 4. Preview the production build locally
npm run preview
```

Open <http://localhost:8080> to view the live app.

---

## Updating Tooltips & Diagrams

### 1. Tooltip Content (`site/tooltips.mjs`)
Tooltips are declarative ES module objects matched on **behavior binding** (e.g. `&hml`, `&bootloader`, `&sys_reset`), not hardcoded key positions. If you move a key in `config/shared/keymap.dtsi`, its tooltip follows automatically.

- `group: true`: Highlights all keys sharing this behavior across the active layer.
- `zmkDoc: '...'`: Adds a direct link icon to official ZMK behavior documentation.
- Backtick syntax (e.g. `` `Ctrl+Shift+Z` `` or `` `Insert` ``): Formats inline keys as `<kbd>` badges.

### 2. Local Keymap Preview Workflow
When editing `config/shared/keymap.dtsi`:

```powershell
# Redraw the local SVG diagram
powershell -File .\scripts\draw.ps1

# Regenerate tooltips & launch dev server
npm run dev
```

The build pipeline automatically prefers `keymap-drawer/corne.local.svg` during development so you can preview changes immediately before committing.

---

## Cloudflare Pages Deployment

The site deploys automatically from the `main` branch.

| Setting | Value |
| :--- | :--- |
| **Framework preset** | `None` / `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | ` ` *(repository root)* |

