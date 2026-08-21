# ⌨⌨ ZMK Configuration

[ZMK](https://github.com/zmkfirmware/zmk) firmware configuration for two keyboards sharing a
single keymap:

- a [Corne keyboard](https://github.com/foostan/crkbd) from Typeractive (`nice_nano_v2`)
- a [Toucan2](https://docs.beekeeb.com/toucan2-keyboard) from beekeeb (`seeeduino_xiao_ble`,
  with a display and an Azoteq trackpad)

This configuration uses the [Graphite](https://github.com/rdavison/graphite-layout) layout with [home row mods](https://precondition.github.io/home-row-mods).

Both boards are 42-key with identical key numbering, so the keymap, behaviors and combos live
once in [`config/shared/`](./config/shared) and each keyboard's `.keymap` is a one-line
include. See [the multi-keyboard plan](./docs/multi-keyboard-plan.md) for the details and the
constraints that come with it.

## Layout

![Keymap Diagram](keymap-drawer/corne.svg)

> Generated with [Keymap Drawer](https://github.com/caksoylar/keymap-drawer).

**One diagram covers both keyboards.** It is drawn on the Corne's physical layout, but the
bindings, layers and combos are the same on the Toucan2. The only layer that behaves
differently is `Mouse`, which the Toucan2's trackpad activates while a finger rests on it and
which is unreachable on the Corne.

`Adjust` is reached by holding both thumb layer keys together (tri-layer).

## Key Positions

Used as `key-positions` for [combos](https://zmk.dev/docs/keymaps/combos). Identical on both
keyboards.

```
Left half (21 keys)       Right half (21 keys)
-------------------       -------------------
  0   1   2   3   4   5       6   7   8  9  10  11
 12  13  14  15  16  17      18  19  20 21  22  23
 24  25  26  27  28  29      30  31  32 33  34  35
              36  37  38    39  40  41
```

## Building firmware

The firmware and diagrams are built via GitHub Actions workflow. Each release attaches a
`firmware-<version>.zip` containing:

| File | Flash to |
| --- | --- |
| `corne_left.uf2` / `corne_right.uf2` | Corne halves |
| `toucan2_left.uf2` / `toucan2_right.uf2` | Toucan2 halves |
| `corne_settings_reset.uf2` | Corne, to clear stored settings |
| `toucan2_settings_reset.uf2` | Toucan2, to clear stored settings |

The version shown on each keyboard's display while on the base layer is stamped into
[`config/shared/version.dtsi`](./config/shared/version.dtsi) by the release workflow — that is
how you tell which firmware a board is running.

To use Keymap Drawer locally, see the [scripts](./scripts): `draw.zsh` on macOS/Linux,
`draw.ps1` on Windows.

## Site

The keymap diagram is published via Cloudflare
Pages, which deploys `main` automatically.

| Setting | Value |
| --- | --- |
| Build command | `node scripts/build-site.mjs` |
| Output directory | `dist` |
| Production branch | `main` |

Keys marked with a dot have an explanation; click one to open it. The content lives in
[`site/tooltips.mjs`](./site/tooltips.mjs) and is matched on **binding**, not key position,
so a tooltip follows its key when the layout changes.

### Running it locally

Requires [Node](https://nodejs.org/) and, for the preview server, [uv](https://docs.astral.sh/uv/)
(any static file server works).

```powershell
powershell -File .\scripts\draw.ps1     # only after editing the keymap, see below
node scripts/build-site.mjs
uv run --no-project python -m http.server -d dist 8080
```

Then open <http://localhost:8080>. The same commands work in Git Bash and on CI — the build
is plain Node, with no shell dependency.

> **Redraw first when you have changed the keymap.** `keymap-drawer/corne.svg` is generated
> by the drawer workflow and committed, so it lags any uncommitted edit. The build prefers
> `keymap-drawer/corne.local.svg` (gitignored, written by `draw.ps1`) when present, so
> redrawing lets you preview your working keymap. Skip it and the build stops with a layer
> mismatch rather than annotating a diagram that no longer matches.

The build fails deliberately if a tooltip matches no key, if the diagram is out of step with
the keymap, or if `site/index.html` and the build script disagree about the diagram URL.

## 🖇 Useful links

- [ZMK docs](https://zmk.dev/docs)
- [Typing lessons - keybr.com](https://www.keybr.com/)
- [Keyboard layouts doc (3rd edition)](https://docs.google.com/document/d/1W0jhfqJI2ueJ2FNseR4YAFpNfsUM-_FlREHbpNGmC2o/edit?usp=sharing)
