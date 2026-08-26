# ⌨⌨ ZMK Configuration

[ZMK](https://github.com/zmkfirmware/zmk) firmware configuration for two keyboards sharing a
single keymap:

- [Corne](https://github.com/foostan/crkbd) from Typeractive (`nice_nano_v2`)
- [Toucan2](https://docs.beekeeb.com/toucan2-keyboard) from beekeeb (`seeeduino_xiao_ble`, Azoteq trackpad)

At the desk the Corne runs against a [beekeeb Prospector](https://github.com/carrefinho/prospector)
dongle (`seeeduino_xiao_ble`) that takes over as the split central and drives a colour LCD.

This configuration uses the [Graphite](https://github.com/rdavison/graphite-layout) layout with [home row mods](https://precondition.github.io/home-row-mods).

Both boards are 42-key with identical key numbering, so the keymap, behaviors and combos live
once in [`config/shared/`](./config/shared) and each keyboard's `.keymap` is a one-line
include.

## Layout

![Keymap Diagram](keymap-drawer/corne.svg)

> Generated with [Keymap Drawer](https://github.com/caksoylar/keymap-drawer).

It is drawn on the Corne's physical layout, but the
bindings, layers and combos are the same on the Toucan2. The only layer that behaves
differently is `Mouse`, which the Toucan2's trackpad activates while a finger rests on it and
which is unreachable on the Corne.

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
| `corne_dongle.uf2` | Prospector dongle (Seeed XIAO BLE) |
| `corne_left_peripheral.uf2` | Left Corne half, for use with the dongle |
| `corne_left_standalone.uf2` | Left Corne half, as a standalone Bluetooth central |
| `corne_right.uf2` | Right Corne half — same firmware in both setups |
| `toucan2_left.uf2` / `toucan2_right.uf2` | Toucan2 halves |

The Corne runs either against the Prospector dongle or standalone over Bluetooth; the two
differ only in which firmware the left half carries. The right half is a peripheral either
way and never needs reflashing.

Alongside the zip it attaches the keymap diagram as it stood at that version, as
`keymap-<version>.svg` and `keymap-<version>.png` (2x light render).

The version shown on each keyboard's display while on the base layer is stamped into
[`config/shared/version.dtsi`](./config/shared/version.dtsi) by the release workflow.

### Settings Reset

To clear persistent Bluetooth bonds and settings:

* **Precompiled UF2s:** Download directly for [nice!nano v2](https://nicekeyboards.com/docs/nice-nano/troubleshooting#flashing-settings-reset) or [Seeed XIAO BLE](https://wiki.seeedstudio.com/XIAO_BLE/).
* **Manual Build:** Run the **Build Settings Reset Firmware** workflow dispatch action in GitHub Actions.

Moving the Corne between dongle and standalone mode changes which device is the split
central, which invalidates the existing bonds. Flash `settings_reset` to **every** device
involved before flashing the new firmware, or the halves will keep looking for their old
central and never pair.

**To dongle mode:** reset the dongle and both halves, then flash `corne_dongle.uf2`,
`corne_left_peripheral.uf2` and `corne_right.uf2`. Power the halves off, plug the dongle
in, then switch on the left half first and the right second — the Prospector lays its
battery widgets out in pairing order.

**Back to standalone:** reset both halves and flash `corne_left_standalone.uf2` to the
left. The right half needs the reset but no new firmware.

## Drawing the Keymap Locally

You can generate and preview the keymap SVG diagram locally using [Keymap Drawer](https://github.com/caksoylar/keymap-drawer):

- **Windows (PowerShell):**
  ```powershell
  powershell -File .\scripts\draw.ps1
  ```
- **macOS / Linux:**
  ```bash
  ./scripts/draw.zsh
  # Watch for changes and redraw automatically:
  ./scripts/watch-draw.zsh
  ```

This generates `keymap-drawer/corne.local.svg` (gitignored), allowing you to review visual changes locally before committing.

## Interactive Keymap Viewer

The keymap is published as an interactive web viewer on Cloudflare Pages. See [`site/README.md`](./site/README.md) for web development, tooltip authoring, and deployment instructions.
