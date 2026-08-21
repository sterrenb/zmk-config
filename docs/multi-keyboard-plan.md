# Plan: Supporting the beekeeb Toucan2 alongside the Typeractive Corne

Status: draft · Goal: a single source of truth for keymap, behaviors and combos across both
keyboards, with a clean path to Prospector dongle builds later.

**Scope decisions taken:**

- **One keymap.** All layers live in `config/shared/keymap.dtsi`. The two `.keymap` files are
  identical one-line stubs that never need editing again (§5.4).
- **Five layers, in a fixed order:** `BASE`, `LOWER`, `RAISE`, `ADJUST`, `MOUSE`. Tri-layer
  (`LOWER`+`RAISE` → `ADJUST`) on both boards; `MOUSE` driven by the Toucan2 trackpad and
  inert on the Corne.
- **One keymap diagram, five layers.** `keymap-drawer` stays pointed at the Corne and now
  renders `ADJUST` and `MOUSE` too, on the Corne layout. The boards share a keymap and key
  numbering, so one image documents both.
- The stock [`beekeeb/zmk-keyboard-toucan2`](https://github.com/beekeeb/zmk-keyboard-toucan2)
  repo is consumed as a **west module** for hardware definitions, not forked or vendored.

**Working constraint: no Corne hardware available.** Everything up to and including the
five-layer keymap ships as one change set, verified in CI and on the Toucan2 only. §12 sets
out what that can and cannot prove, and §13 phases the work accordingly.

---

## 1. Where the repository stands today

| Area | File(s) | Shareable? |
| --- | --- | --- |
| Layer/timing constants | `config/base.dtsi` | ✅ fully |
| Macros + home row mods | `config/behaviors.dtsi` | ✅ fully |
| Combos | `config/combos.dtsi` | ✅ fully |
| Keymap layers | `config/corne.keymap` | ✅ fully (see §2, §5) |
| Kconfig | `config/corne.conf` | ⚠️ partly — several settings are board-specific |
| West manifest | `config/west.yml` | one manifest, needs extra modules |
| Build matrix | `build.yaml` | needs new entries |
| Diagram config | `config/keymap-drawer.config.yml` | Corne only; needs `&mkp` legends (§10) |
| Pipelines | `.github/workflows/*` | need path-filter + versioning changes |

The repo already ships `zephyr/module.yml` (`board_root: .`) and an empty `boards/shields/`,
so it is *already* registered as a ZMK module by the reusable build workflow
(`-DZMK_EXTRA_MODULES=$GITHUB_WORKSPACE`). That is exactly the hook the dongle shields need
later — no restructuring required to get there.

## 2. The key finding: the two boards are position-identical

beekeeb's `toucan` shield (`boards/shields/toucan/toucan.dtsi`) declares:

```dts
default_transform: keymap_transform_0 {
    compatible = "zmk,matrix-transform";
    columns = <12>;
    rows = <4>;
    map = <
        RC(0,0) ... RC(0,11)
        RC(1,0) ... RC(1,11)
        RC(2,0) ... RC(2,11)
                RC(3,3) RC(3,4) RC(3,5)  RC(3,6) RC(3,7) RC(3,8)
    >;
};
```

That is the same ordering as the Corne: key positions `0–41`, three 12-key rows plus a
6-key thumb row, with the right half applying `col-offset = <6>`.

**Consequences — all of these transfer 1:1 with zero abstraction:**

- the whole `keymap` node (every layer, in binding order),
- every `key-positions` value in `combos.dtsi`,
- both `hold-trigger-key-positions` lists in `behaviors.dtsi`,
- the `keypos-N` / `combopos-N` CSS selectors in `keymap-drawer.config.yml`,
- **and the rendered diagram itself** — which is why one image is enough for both boards.

This is also what makes testing on the Toucan2 alone meaningful: see §12.

## 3. The Toucan2 hardware, as actually wired

| Concern | Corne | Toucan2 |
| --- | --- | --- |
| MCU | `nice_nano_v2` | `seeeduino_xiao_ble` (XIAO nRF52840 Plus) |
| Shields | `corne_left/right nice_view_adapter nice_view` | `toucan_left rgbled_adapter nice_view_gem` / `toucan_right rgbled_adapter` |
| Shield source | upstream ZMK | beekeeb module (out-of-tree) |
| Left half | nice!view | nice!view Gem — `sharp,ls0xx` 144×168 on `spi0` |
| Right half | nice!view | **no display** — Azoteq TPS43 trackpad on `i2c0`, plus RGB LED |
| Extra drivers | — | `zmk_driver_azoteq`, `zmk-input-zoom`, `zmk-rgbled-widget` |
| Extra Kconfig | — | `ZMK_POINTING`, `ZMK_MOUSE`, `I2C`, `INPUT_TPS43`, longer idle timings |

> **Note — there is no right-half display.** The build matrix upstream is
> `toucan_left rgbled_adapter nice_view_gem` and `toucan_right rgbled_adapter`; only the
> left half carries a display shield, and `toucan_right.overlay` configures no SPI at all.
> The right half's distinguishing hardware is the trackpad.
>
> This is not just a shield-list detail — **the two halves reuse the same physical pins for
> different purposes**: P1.13/P1.15 are SPI MOSI/SCK for the display on the left and I²C
> SDA/SCL for the trackpad on the right, with P1.14 as MISO on the left and trackpad reset
> on the right. That is precisely why the left/right overlays cannot be collapsed into one,
> and why they are worth taking verbatim rather than rewriting.

### The MCU needs nothing from the stock repo

`seeeduino_xiao_ble` is shipped by upstream ZMK (`app/boards/arm/seeeduino_xiao_ble` on
`v0.3`). The beekeeb repo contains **no board definitions at all** — its `boards/` directory
holds only `shields/`. The Toucan uses the *Plus* variant of the XIAO, whose extra pins
(P1.11–P1.15) are outside the stock `xiao_d` connector definition, but the shield overlays
address `&gpio0` / `&gpio1` directly rather than going through the connector, so the
upstream board definition is sufficient as-is. The only board-level touch is
`&xiao_i2c { status = "disabled"; };` on the left half, which references an upstream label.

**Verdict: no MCU work required, and nothing to copy for it.**

## 4. Using the stock repo as a starting point — file by file

Short answer: **yes for everything under `boards/`, no for everything under `config/`.**
The split is clean because the stock repo separates hardware definition (the shield) from
user preference (the config), and only the first half is what we want.

### Take, unchanged, via the west module

| File | Why |
| --- | --- |
| `boards/shields/toucan/toucan.dtsi` | kscan row GPIOs, matrix transform, physical layout, and the trackpad input-processor chain |
| `boards/shields/toucan/toucan_left.overlay` | SPI pinctrl, the `nice_view_spi` label the display shield binds to, CS on P0.03, left col-gpios, `xiao_i2c` disable, `trackpad_listener` enable |
| `boards/shields/toucan/toucan_right.overlay` | I²C pinctrl, the `tps43_trackpad@74` node with beekeeb's tuned values (scroll angle, LP2 report rate, filter settings), right col-gpios + `col-offset` |
| `boards/shields/toucan/Kconfig.defconfig` | central-on-left, `ZMK_SPLIT`, `ZMK_POINTING`, SPI, battery proxying |
| `boards/shields/toucan/toucan_{left,right}.conf` | hardware-motivated power tuning — see note below |
| `boards/shields/nice_view_gem/**` | the left display — see §4.1 |

The `.conf` files in the shield directory deserve a specific call-out. They look like
personal preference (`CONFIG_ZMK_IDLE_SLEEP_TIMEOUT=3600000`,
`CONFIG_ZMK_IDLE_TIMEOUT=30000`) but the inline comments make clear they are tuned against
measured trackpad current draw — 1.7 mA idle versus 2.9 mA active, with a deliberate 300 ms
wake latency traded for it. **Don't fight these with overrides in `config/toucan.conf`
without a reason.** Note in particular that our Corne's 15-minute
`CONFIG_ZMK_IDLE_SLEEP_TIMEOUT` and the Toucan's 60-minute value are genuinely different
answers for genuinely different hardware — another reason a shared `default.conf` is the
wrong tool (§7).

### 4.1 The left display: take it, don't rebuild it

`nice_view_gem` is a vendored fork of caksoylar's nice-view-gem, and it is substantial:
roughly forty C files across `widgets/` and `assets/`, including four sizes of a bitmap
font. Its `Kconfig.defconfig` sets the LVGL parameters (1-bit colour depth, dedicated
display work queue, 4 KB memory pool) and adds `CONFIG_TOUCAN_STATUS_SCREEN`, an int of
0–2 defaulting to `2` that selects between widget sets at *CMake* level — style 2 swaps in
the arc-based battery/output/layer widgets. Its overlay attaches the `sharp,ls0xx` panel to
whatever `nice_view_spi` resolves to, which is why it composes with `toucan_left.overlay`.

There is nothing to gain from reimplementing this, and the interface is a single Kconfig
int if the screen style needs changing. Take it.

⚠️ If we ever switch from module to vendoring, `QuinqueFive_License.txt` must come along —
the font ships under its own licence, separate from the repo's MIT.

### Discard

| File | Why |
| --- | --- |
| `config/toucan.keymap` | Their layout (QWERTY, NAV/SYM/ADJ). We use our own — but its *structure* is what we're adopting, see §5 |
| `config/toucan_{left,right}.conf` | **Symlinks** into `../boards/shields/toucan/`. Redundant once the shield arrives via a module — and note that CI's `cp -R config/*` copies them as symlinks into a temp dir where the relative target does not exist, so they are broken there anyway. A local-build convenience, not something to replicate |
| `config/toucan.json` | keymap-drawer physical layout — not needed, we are not drawing the Toucan |
| `config/west.yml` | Merge its three extra projects into ours (§8) |
| `build.yaml` | Merge two entries into ours (§9) |
| `.github/**`, `zephyr/module.yml`, `README.md` | We have our own |

## 5. The unified keymap: one file, five layers

### 5.1 The layer order is load-bearing — and it lines up for free

The stock Toucan keymap is `base(0) nav(1) sym(2) adj(3) mouse(4)`, and the shield's input
processors hard-code those indices:

```dts
is_touching_processor { bindings = <&mo 4>; };        // mouse layer while a finger is down
trackpad_listener { scroller { layers = <1 2>; }; };  // touch-scroll on nav + sym
```

Adopting tri-layer and appending the mouse layer gives us
`BASE(0) LOWER(1) RAISE(2) ADJUST(3) MOUSE(4)` — which maps onto those indices exactly:

| Shield expects | Stock meaning | Ours | Match |
| --- | --- | --- | --- |
| `&mo 4` | mouse | `MOUSE` | ✅ |
| `layers = <1 2>` | nav, sym | `LOWER`, `RAISE` | ✅ |

**So no devicetree override is needed at all.** Trackpad scrolling also lands on Lower/Raise,
which is a sensible place for it independently.

⚠️ **This ordering is a hard constraint, not a preference.** Inserting a layer before
`MOUSE`, or reordering `ADJUST`, silently repoints `&mo 4` at the wrong layer — the build
still succeeds and the trackpad just behaves oddly. Put a comment saying so directly above
the layer defines. If the order ever has to change, the escape hatch is a one-liner in
`config/toucan.keymap`:

```dts
&is_touching_processor { bindings = <&mo MOUSE>; };
```

### 5.2 Tri-layer

Goes in the shared source, so both boards get it:

```dts
/ {
    conditional_layers {
        compatible = "zmk,conditional-layers";
        tri_layer {
            if-layers = <LOWER RAISE>;
            then-layer = <ADJUST>;
        };
    };
};
```

**No thumb-key changes are required.** The current bindings already leave both momentary
keys reachable from each other's layer — `lower_layer` keeps `&mo 2` on the right thumb and
`raise_layer` keeps `&mo 1` on the left — so holding both already activates layers 1 and 2
simultaneously. Tri-layer just gives that combination a destination.

What goes *on* `ADJUST` is a keymap design decision, not a structural one. The conventional
role is bluetooth/output/reset — which in this config currently lives on the `COMBO_RAISE`
bluetooth combos. Moving those to real `ADJUST` keys would let a chunk of `combos.dtsi` and
the drawer's bluetooth styling be deleted, but that is optional and entirely your call;
starting with an all-`&trans` `ADJUST` and filling it in later is perfectly fine.

### 5.3 The mouse layer, and what it costs the Corne

Copy the stock layer's design verbatim — it is all `&trans` except the thumb row:

```dts
mouse_layer {
    display-name = "Mouse";
    bindings = <
        &trans &trans &trans &trans &trans &trans   &trans &trans &trans &trans &trans &trans
        &trans &trans &trans &trans &trans &trans   &trans &trans &trans &trans &trans &trans
        &trans &trans &trans &trans &trans &trans   &trans &trans &trans &trans &trans &trans
                    &mkp MCLK &mkp LCLK &mkp RCLK   &mkp LCLK &mkp RCLK &mkp MCLK
    >;
};
```

`is_touching_processor` activates this layer only while a finger rests on the pad, so the
thumb keys become mouse buttons exactly when that is what you want, and are untouched
otherwise. `MCLK` / `LCLK` / `RCLK` come from `<dt-bindings/zmk/pointing.h>`, which needs
adding to the shared `base.dtsi`.

> ⚠️ **The Corne needs `CONFIG_ZMK_POINTING=y` for this to build.** This is not optional and
> it is not obvious. In ZMK v0.3:
>
> ```
> config ZMK_BEHAVIOR_MOUSE_KEY_PRESS
>     depends on DT_HAS_ZMK_BEHAVIOR_MOUSE_KEY_PRESS_ENABLED && ZMK_POINTING
> ```
>
> The `mkp` node is declared `/omit-if-no-ref/`, so it normally vanishes on keyboards that
> never mention it. The moment the shared keymap references `&mkp`, the node is kept —
> `DT_HAS_..._ENABLED` becomes true — but without `ZMK_POINTING` the driver source is never
> compiled, and the keymap's `DEVICE_DT_GET` on a driverless node **fails the build**. The
> Toucan gets `ZMK_POINTING` from its shield's `Kconfig.defconfig`; the Corne must set it in
> `config/corne_left.conf`.

**Scope it to the central half, not `corne.conf`.** ZMK guards `keymap.c`, `hid.c` and every
behavior source behind `if ((NOT CONFIG_ZMK_SPLIT) OR CONFIG_ZMK_SPLIT_ROLE_CENTRAL)`, so the
right half never compiles the keymap and never references `&mkp`. Putting the symbol in
`corne.conf` would apply it to both halves and pull the Zephyr input subsystem into the
peripheral for nothing. The Toucan is different and correctly sets it for both halves in its
`Kconfig.defconfig` — its right half has the actual trackpad hardware to read.

#### What it does to the HID descriptor

`CONFIG_ZMK_POINTING=y` appends a Mouse application collection (report ID `0x03` — five
buttons, 16-bit relative X/Y, wheel, horizontal wheel) to `zmk_hid_report_desc[]`
unconditionally. It is not gated on a pointing device existing, so **the Corne will advertise
as a composite keyboard + mouse.**

No behavioural change follows from that: a mouse report is only transmitted when something
generates mouse events, and on the Corne the `MOUSE` layer is unreachable and there is no
pointer hardware. The host sees an endpoint that never speaks.

The one practical consequence is ZMK's documented caveat — enabling the feature "modifies the
HID report descriptor" and some BLE hosts cache the old one, so ZMK advises removing and
re-pairing. For the Corne that is **optional**: the keyboard collection is unchanged and comes
first in the descriptor, so a host holding the stale version keeps typing normally and only
misses a mouse endpoint that is never used anyway. It matters only where mouse output is
actually wanted — the Toucan2 — which is being paired fresh regardless. Expect some hosts to
start listing a mouse device once they do refresh.

Minor side effect: `ZMK_POINTING` sets `INPUT_GPIO_KEYS default n`. Harmless today, but worth
remembering if soft-off is ever added to the Corne.

**Fallback if the Corne runs out of flash.** `corne.conf` already enables `ZMK_STUDIO`, and
the build also carries a nice!view display; adding the input subsystem and mouse HID on top
is the most likely way this change set fails to build (§12). If it does, the mouse layer can
keep its structure with `&trans` on the thumbs and `CONFIG_ZMK_POINTING` dropped from the
Corne — the layer still exists, so the index alignment in §5.1 survives. Nothing is lost
functionally on the Toucan2 either, because the TPS43 node already enables `single-tap`,
`two-finger-tap` and `press-and-hold`: **the trackpad generates its own click events in
hardware.** `&mkp` on the thumbs is a convenience, not the only way to click.

On the Corne, `MOUSE` is simply unreachable — nothing activates it — which matches the
"empty or redundant" intent. If you'd rather it not be dead weight, a `&mo MOUSE` binding on
`ADJUST` or a combo would make the mouse buttons usable there too. Optional.

### 5.4 One maintained file, two stubs

ZMK resolves the keymap by shield name: the Corne looks for `config/corne.keymap`, the
Toucan for `config/toucan.keymap`, and there is no filename both resolve to. `-DKEYMAP_FILE=`
can force a single path, but it needs an absolute path, and in CI the config directory is
copied into a temp dir (because `zephyr/module.yml` exists), so it would be brittle and it
would break local builds. Not worth it.

So: **two stub files with identical, permanent contents**, and one file that actually gets
maintained.

```dts
// config/corne.keymap  AND  config/toucan.keymap — identical, never edited again
#include "./shared/keymap.dtsi"
```

Because §5.1 removes the need for a Toucan-side override, there is genuinely nothing
board-specific left in either stub. If that ever changes, the stubs are where it goes.

✅ **Nested relative includes are verified to work in both toolchains.** The Zephyr DTS
preprocessor is standard GCC. keymap-drawer uses `pcpp`, whose `include()` pushes
`os.path.dirname(fulliname)` onto the search path before recursing, so a quoted include is
resolved against the directory of the file containing the directive. `config/corne.keymap` →
`./shared/keymap.dtsi` → `./base.dtsi` (resolved inside `config/shared/`) is correct in both.

## 6. Target layout

```
config/
├── shared/
│   ├── base.dtsi            # layer + timing #defines, pointing.h, includes behaviors/combos
│   ├── behaviors.dtsi       # macros, hml/hmr             (content unchanged)
│   ├── combos.dtsi          # all combos                  (content unchanged)
│   ├── keymap.dtsi          # ← THE single source: 5 layers + conditional_layers
│   ├── version.dtsi         # KEYMAP_VERSION macro, stamped by the release pipeline
│   └── layout-42.dtsi       # dongle phase only
├── corne.keymap             # one-line stub
├── corne.conf               # unchanged
├── corne_left.conf          # CONFIG_ZMK_POINTING=y — central half only (§5.3)
├── toucan.keymap            # one-line stub, identical to corne.keymap
├── toucan.conf              # keyboard name + our overrides only
├── keymap-drawer.config.yml # Corne only; + &mkp legends
└── west.yml
boards/shields/              # dongle phase: corne_dongle/, toucan_dongle/
docs/multi-keyboard-plan.md  # this file
```

`config/shared/base.dtsi` gains the two new layer defines and the pointing binding:

```dts
#include <dt-bindings/zmk/pointing.h>

// Layers — ORDER IS LOAD-BEARING.
// The Toucan shield's is_touching_processor hard-codes `&mo 4` for the mouse layer
// and scrolls on layers <1 2>. Do not reorder or insert. See docs/multi-keyboard-plan.md §5.1
#define BASE   0
#define LOWER  1
#define RAISE  2
#define ADJUST 3
#define MOUSE  4
```

### 6.1 `ADJUST` layer contents

Decided: bluetooth, output and reset as real keys, **without** touching `combos.dtsi`. The
existing `COMBO_RAISE` bluetooth combos stay exactly as they are — this is purely additive,
so nothing regresses and there is no combo-index churn (deleting combos would shift indices
and break the `.combopos-2` rule that hides `capitalize_i`). Retiring the redundant combos is
a separate change, once you've lived with the layer.

```dts
adjust_layer {
    display-name = "Adjust";
    bindings = <
        &trans &trans &trans &trans &trans &trans   &bt BT_SEL 0 &bt BT_SEL 1 &bt BT_SEL 2 &bt BT_SEL 3 &bt BT_SEL 4 &bt BT_CLR
        &trans &trans &trans &trans &trans &trans   &out OUT_TOG &trans       &trans       &trans       &trans       &trans
        &trans &trans &trans &trans &trans &trans   &trans       &trans       &trans       &trans       &sys_reset   &bootloader
                             &trans &trans &trans   &trans       &trans       &trans
    >;
};
```

The bluetooth keys deliberately land on positions 6–11, which is exactly where the existing
`COMBO_RAISE` combos already put them (`bt_sel_0` on `6 18`, `bt_clear` on `11 23`, …), so
muscle memory carries over and the two mechanisms agree.

⚠️ `&out OUT_TOG` needs `#include <dt-bindings/zmk/outputs.h>`, which `base.dtsi` does **not**
currently pull in — it has `keys.h` and `bt.h` only. Add it alongside `pointing.h`.

`&sys_reset` and `&bootloader` are core ZMK behaviors and need nothing extra. No
`&studio_unlock` is included: `CONFIG_ZMK_STUDIO_LOCKING=n` on both boards, so there is
nothing to unlock.

### 6.2 `config/toucan.conf` contents

Decided: mirror the Corne's *preferences*, leave beekeeb's *power tuning* alone.

```ini
CONFIG_ZMK_KEYBOARD_NAME="Toucan View"

# Match the Corne's radio and debounce preferences.
CONFIG_BT_CTLR_TX_PWR_PLUS_8=y
CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS=1
CONFIG_ZMK_KSCAN_DEBOUNCE_RELEASE_MS=10

# Enable ZMK Studio for Realtime Keymap Updates
CONFIG_ZMK_STUDIO=y
CONFIG_ZMK_STUDIO_LOCKING=n

# Sleep and idle timings are deliberately NOT set here.
# boards/shields/toucan/toucan_{left,right}.conf tunes them against measured
# trackpad current draw (1.7 mA idle vs 2.9 mA active) — see §4.
```

`"Toucan View"` is 11 characters, comfortably inside the 16-character
`CONFIG_ZMK_KEYBOARD_NAME` limit.

Setting `CONFIG_ZMK_STUDIO=y` here rather than via `cmake-args` resolves the inconsistency
flagged in §14 — both boards now enable Studio the same way, in their `.conf`, with only the
`studio-rpc-usb-uart` snippet remaining in `build.yaml` on the left/central half. That is
exactly the pattern `corne.conf` already follows, and it is why the Toucan entry in §9 has no
`cmake-args`.

### Two small cleanups worth doing while in there

- Replace the literal `&mo 1` / `&mo 2` in the thumb row with `&mo LOWER` / `&mo RAISE`.
  The drawer config already maps both spellings, so the diagram is unaffected — and with
  five layers in play, symbolic names stop being cosmetic.
- Move the release version from a literal `display-name` into a `KEYMAP_VERSION` macro in
  `config/shared/version.dtsi` (§10). The on-display version indicator is kept exactly as it
  behaves today — this only makes the pipeline's `sed` anchored rather than positional, which
  matters now that five layers carry `display-name`s.

## 7. How ZMK resolves the per-keyboard files

From `zmk/app/keymap-module/modules/modules.cmake` on `v0.3`. These mechanics are what the
whole structure leans on, and several are non-obvious:

- **Keymap:** searched as `$ZMK_CONFIG/<prefix>.keymap` over the shield names, their
  underscore-stripped prefixes, and the *shield directory name*. `toucan_left` and
  `toucan_right` both live in a directory named `toucan`, so both resolve to
  `config/toucan.keymap` — the same mechanism that makes `corne.keymap` work today.
- **Kconfig:** **all** matching `.conf` candidates are applied, in this order:
  `<shield_dir>.conf`, `<shield>.conf`, then `<board>.conf`, then `default.conf`. Our
  `config/toucan.conf` therefore layers on top of the shield's own confs rather than
  replacing them — which is what we want given §4.
  ⚠️ **Gotcha:** later fragments win in Kconfig, and `default.conf` is applied *last*. A
  shared `config/default.conf` would therefore **override** per-keyboard settings rather
  than be overridden by them. Don't use it for shared defaults — keep the small duplication
  between `corne.conf` and `toucan.conf`.
- **Overlays:** only the **first** matching overlay is used, and the candidate list is built
  from the shield names — `config/toucan.overlay` is *not* picked up for `toucan_left`.
  Put shared devicetree in the keymap include chain, not in an overlay.
- The build log prints `Using keymap file:` and `ZMK Config Kconfig:` lines, and dumps the
  full resolved Kconfig and devicetree. Those dumps are the backbone of §12's verification.

## 8. West manifest

```yaml
manifest:
  remotes:
    - name: zmkfirmware
      url-base: https://github.com/zmkfirmware
    - name: beekeeb
      url-base: https://github.com/beekeeb
    - name: caksoylar
      url-base: https://github.com/caksoylar
  projects:
    - name: zmk
      remote: zmkfirmware
      revision: v0.3
      import: app/west.yml
    - name: zmk-keyboard-toucan2     # provides boards/shields/{toucan,nice_view_gem}
      remote: beekeeb
      revision: 6882c95bec5be89988e90feb621f78a7511e9ed7
    - name: zmk_driver_azoteq        # TPS43 trackpad driver
      remote: beekeeb
      revision: 52fcfe5026c9f74d611d05b2084548e046a7e274
    - name: zmk-input-zoom           # zmk,input-processor-zoom
      remote: beekeeb
      revision: 91bbe0c0e02145da50c9df798489479d28be1804
    - name: zmk-rgbled-widget        # rgbled_adapter shield
      remote: caksoylar
      revision: v0.3
  self:
    path: config
```

`beekeeb/zmk-keyboard-toucan2` ships `zephyr/module.yml` with `board_root: .`, so pulling it
in as a west project is enough to make `toucan_left`, `toucan_right` and `nice_view_gem`
resolvable — no fork, no vendoring. Its own `config/` directory comes along in the clone but
is inert; only `zephyr/module.yml` is honoured.

Upstream's manifest also carries `geeksville/cirque-input-module` at revision `toucan` —
that is a leftover from the *original* Toucan's circular Cirque trackpad. The Toucan2 uses
the Azoteq TPS43, so we omit it.

**Pin the beekeeb projects to SHAs, not `main`.** All three track `main` upstream; leaving
them floating means a tagged release can change behaviour with no commit in this repo — and
it would also undermine §12, where the whole point is that a Toucan2 flash test says
something durable about the firmware.

## 9. Build matrix

```yaml
---
include:
  # Corne (Typeractive) — standalone
  - board: nice_nano_v2
    shield: corne_left nice_view_adapter nice_view
    snippet: studio-rpc-usb-uart
    artifact-name: corne_left
  - board: nice_nano_v2
    shield: corne_right nice_view_adapter nice_view
    artifact-name: corne_right

  # Toucan2 (beekeeb) — standalone
  - board: seeeduino_xiao_ble
    shield: toucan_left rgbled_adapter nice_view_gem
    snippet: studio-rpc-usb-uart
    artifact-name: toucan2_left
  - board: seeeduino_xiao_ble
    shield: toucan_right rgbled_adapter
    artifact-name: toucan2_right

  # Resets
  - board: nice_nano_v2
    shield: settings_reset
    artifact-name: corne_settings_reset
  - board: seeeduino_xiao_ble
    shield: settings_reset
    artifact-name: toucan2_settings_reset
```

Adding `artifact-name` is not cosmetic. The default is `${shield}-${board}-zmk`, which for
multi-shield entries produces filenames containing spaces
(`corne_left nice_view_adapter nice_view-nice_nano_v2-zmk.uf2`). With two keyboards now, and
dongle variants later, unambiguous names matter — and you will be picking two specific files
out of the zip to flash. Note this renames the existing Corne artifacts.

The `toucan2_settings_reset` entry is not optional housekeeping: reset firmware is
board-specific, and you will likely want it during first-flash of the Toucan2 (§13, phase 2).
It is also known-good — beekeeb's own `build.yaml` carries exactly
`board: seeeduino_xiao_ble` / `shield: settings_reset`. The shield itself is board-agnostic:
its entire `Kconfig.defconfig` is one `ZMK_KEYBOARD_NAME` default, and it ships its own
`settings_reset.keymap` and `.overlay`.

### Resulting release zip

`release.yml` needs no changes — the reusable workflow merges every matrix job into a single
`firmware` artifact, which it renames to `firmware-vX.Y.Z.zip`. Today that zip holds three
files under the default naming; after this change it holds six, flat:

| Before (current) | After |
| --- | --- |
| `corne_left nice_view_adapter nice_view-nice_nano_v2-zmk.uf2` | `corne_left.uf2` |
| `corne_right nice_view_adapter nice_view-nice_nano_v2-zmk.uf2` | `corne_right.uf2` |
| — | `toucan2_left.uf2` |
| — | `toucan2_right.uf2` |
| `settings_reset-nice_nano_v2-zmk.uf2` | `corne_settings_reset.uf2` |
| — | `toucan2_settings_reset.uf2` |

The mechanism: `artifact-name` sets the env var used both for the `.uf2` filename and for the
per-job artifact name (`artifact-<name>`), and the merge step globs `artifact-*` into
`firmware` with no directory nesting.

**All six are `.uf2`, not `.bin`.** The reusable workflow falls back to `.bin` when no
`zmk.uf2` is produced; that will not trigger here, because the ZMK Zephyr fork's
`seeeduino_xiao_ble_defconfig` sets `CONFIG_BUILD_OUTPUT_UF2=y` (and
`CONFIG_USE_DT_CODE_PARTITION=y`) just as `nice_nano_v2` does.

> ⚠️ **A single failing matrix entry blocks the entire release — including the Corne.** The
> reusable workflow's `merge` job is `needs: build` with no `if:`, so its default `success()`
> condition means it is **skipped** whenever any build job fails. `fail-fast: false` lets the
> other jobs finish, but without the merge there is no `firmware` artifact, so
> `release.yml`'s download step fails and no release is cut at all.
>
> This compounds the `ZMK_POINTING` flash-size risk in §5.3: previously a Corne-only
> pipeline, it now has four more ways to fail, and any one of them stops Corne firmware from
> shipping. Treat a red build on any entry as release-blocking, and keep §5.3's fallback
> handy.

One more consequence of the reset entries, reinforcing §7: `settings_reset` builds evaluate
`config/default.conf` as a Kconfig candidate like any other build. A shared `default.conf`
would therefore leak into the reset firmware, which is meant to be minimal. (The keymap is
safe — the prefix candidates for a `settings_reset` build are only `settings_reset` and the
board names, so `config/corne.keymap` and `config/toucan.keymap` are never picked up and the
shield's own keymap is used, exactly as today.)

## 10. Pipeline changes

### `build.yml` — path filters

Currently filters on `config/*.keymap` and `config/*.dtsi`, which will **not** match
`config/shared/*.dtsi`. Widen to:

```yaml
paths:
  - "config/**"
  - "boards/**"
  - "build.yaml"
```

`build.yaml` is currently not a trigger at all — as things stand, adding a keyboard to the
matrix would not kick off a build. Since CI is now the primary verification mechanism (§12),
this one matters more than it looks.

### `draw-keymaps.yml` — Corne layout, all five layers

Still Corne-only, and now explicitly expected to render `ADJUST` and `MOUSE`. Three changes:

1. **Narrow `keymap_patterns` from `config/*.keymap` to `config/corne.keymap`.** Left as-is,
   the workflow globs `config/toucan.keymap`, fails to find a layout for a keyboard named
   `toucan`, and errors the draw step. This must land *before or with* the Toucan keymap.
2. **Narrow the path filter** to `config/corne.keymap`, `config/shared/**` and
   `config/keymap-drawer.config.yml`, so Toucan-only changes don't trigger a redraw that
   produces an empty commit.
3. **Pin `install_version: "0.23.0"`.** The workflow currently installs whatever is latest on
   PyPI at run time, so unrelated keymap-drawer releases perturb `corne.svg` — the committed
   SVG was drawn with an older version, and 0.23.0 adds `text.tl/tr/bl/br` selectors to its
   built-in stylesheet. Pinning makes CI agree with what `scripts/draw.ps1` produces locally,
   which is what makes the §12 zero-diff check trustworthy. Expect one unavoidable
   CSS-only diff on the first draw after pinning, as the committed SVG catches up.
4. Optional: set `west_config_path: ""`. The draw job runs `west init` + `west update` to
   fetch modules; once the manifest gains the beekeeb projects it clones all of them on
   every draw, none of which the Corne render needs (the Corne layout is built into
   keymap-drawer, and `zmk`/`zephyr` are already filtered out). Skipping it makes the job
   faster and removes a failure mode.

`scripts/draw.zsh` needs no change — its `corne` default remains correct.

#### Required: `&mkp` legends in `keymap-drawer.config.yml`

keymap-drawer has **no built-in handling for `&mkp`**. Its `_str_to_key` match falls through
every case and hits `return LayoutKey(tap=binding)`, so the mouse layer would render six keys
reading literally `&mkp MCLK`, `&mkp LCLK`, `&mkp RCLK`. Now that the mouse layer must appear
in the diagram, add to `parse_config.raw_binding_map`:

```yaml
    "&mkp LCLK": $$mdi:mouse-left-click-outline$$
    "&mkp RCLK": $$mdi:mouse-right-click-outline$$
    "&mkp MCLK": $$mdi:mouse$$
```

(Any legend works; the point is that the default is unusable.)

#### Two things keymap-drawer gets right for free

- **It understands `zmk,conditional-layers`** (`_update_conditional_layers`). Tri-layer is
  parsed, so `ADJUST` is drawn as reachable from the `LOWER`+`RAISE` combination rather than
  appearing as an orphan layer. Worth knowing because it means a malformed `if-layers` /
  `then-layer` is a hard `ParseError`, not a silent skip — the draw job is itself a check on
  the tri-layer syntax.
- **Layers with `status = "reserved"` are skipped** when collecting layer nodes. If ZMK
  Studio reserved layers are ever added (the stock Toucan keymap has two), they will not
  pollute the diagram.

### `prepare-release.yml` — the version indicator

**Verdict: the feature survives, gets simpler, and extends to the Toucan2 for free.** An
earlier draft of this plan recommended moving the version off layer 0. That advice was
wrong and is retracted — see "Prospector" below.

#### Where the indicator actually shows

Not in the diagram. `keymap-drawer.config.yml` deliberately hides it:

```css
g[class^="layer-"]:first-of-type .label { display: none; }
```

In `corne.svg` the first `<g>` in the root is `<g class="layer-v1.0.1">`, so its
`<text class="label">v1.0.1</text>` is suppressed while `Lower` and `Raise` render normally.
That stays correct with five layers — `:first-of-type` still matches only the base layer, so
`Adjust` and `Mouse` will show their names and the version stays hidden.

The indicator is a **hardware display** feature. ZMK's nice!view status widget draws the
active layer's name:

```c
// zmk/app/boards/shields/nice_view/widgets/status.c
.label = zmk_keymap_layer_name(zmk_keymap_layer_index_to_id(index))
```

So on the base layer, the Corne's nice!view reads `v1.0.1` — which is how you tell at a
glance which firmware is flashed.

#### It works on the Toucan2 unchanged

`nice_view_gem`'s layer widget does exactly the same thing:

```c
// boards/shields/nice_view_gem/widgets/layer_arc.c
const char *layer_name = zmk_keymap_layer_name(zmk_keymap_layer_index_to_id(state->layer_index));
```

Because both boards share one keymap, **one `sed` stamps both, and both displays show the
version.** That is strictly more useful than today: with two keyboards in rotation, knowing
which firmware is on which board is exactly the problem this solves.

Minor caveat: `layer_arc.c` renders with `quinquefive_18`, a chunky pixel font, right-aligned
across the screen width. `v1.0.1` is comfortable; a long version (`v10.10.10-rc1`) could
clip. Normal semver is fine.

#### Required: the path filter is now load-bearing

This is the one thing that genuinely breaks if handled carelessly. The release chain is:

1. `prepare-release.yml` stamps the version and pushes `release/vX.Y.Z`
2. that push must trigger **`build.yml`**
3. `release.yml` fires on `workflow_run` of "Build ZMK firmware" completing on `release/*`

`build.yml` currently filters on `config/*.dtsi`, and **`config/shared/keymap.dtsi` does not
match** — a `*` glob does not cross `/`. Left as-is, the release build never triggers, so no
release is ever created and the whole flow stalls silently. Widening to `config/**` (§10) is
therefore a correctness requirement of this feature, not tidiness. The same applies to
`draw-keymaps.yml`, where `config/shared/**` covers it.

#### Recommended: stamp a macro, not the first `display-name`

The current `sed` is positional:

```bash
sed -i "0,/display-name\s*=\s*\"[^\"]*\";/s//display-name = \"$VERSION\";/" config/corne.keymap
```

`0,/re/` takes the first match in the file. That still resolves to the base layer in
`config/shared/keymap.dtsi`, so a straight repoint would work — but it is now a positional
heuristic over a file containing five `display-name`s, and §5.1 already establishes that
layer order is load-bearing for an unrelated reason. A reorder would silently stamp the
wrong layer.

Anchor it instead. `config/shared/version.dtsi`:

```dts
// Stamped by .github/workflows/prepare-release.yml — do not edit by hand.
#define KEYMAP_VERSION "v1.0.1"
```

`config/shared/keymap.dtsi`:

```dts
default_layer {
    display-name = KEYMAP_VERSION;
    ...
};
```

and the workflow step becomes:

```bash
sed -i "s/^#define KEYMAP_VERSION .*/#define KEYMAP_VERSION \"$VERSION\"/" config/shared/version.dtsi
```

One line, anchored to a unique token, immune to layer reordering, and the release commit's
diff is a single line instead of a keymap hunk. Both toolchains handle it: the Zephyr DTS
preprocessor is GCC, and keymap-drawer's `pcpp` expands object-like macros before the
tree-sitter DTS parse, so both see `display-name = "v1.0.1";`.

#### Prospector, revisited

The earlier concern — that Prospector's layer roller would render `v1.2.3` instead of `Base`
— was a mischaracterisation. The roller reads `display-name`, exactly like the two displays
above. That is the *same feature on a third screen*, not a collision. Whether you want it
there is a taste call to make when the dongle exists, and if you'd rather see `Base` at that
point, the fix is local to the dongle config. Nothing about it needs deciding now, and
nothing about it constrains this change set.

One genuine note for later: ZMK Studio can rename layers, and those names persist in
settings — a Studio rename of layer 0 would override the flashed version string until
settings are reset.

## 11. Later: Prospector dongle readiness

Deliberately out of scope for the first change set, but the structure above should not paint
us into a corner. What it will need:

- **Module:** `carrefinho/prospector-zmk-module`, revision `main` — its `main` branch targets
  ZMK v0.3 / Zephyr 3.5, which matches our pin. (The `feat/new-status-screens` branch is for
  ZMK `main` and uses board `xiao_ble//zmk`; do not mix the two.)
- **Dongle shields, in this repo:** `boards/shields/corne_dongle/` and
  `boards/shields/toucan_dongle/`, each with a mock kscan (`compatible = "zmk,kscan-mock"`)
  plus the 42-key matrix transform and physical layout, extracted once into
  `config/shared/layout-42.dtsi`. Naming them `<keyboard>_dongle` means ZMK's prefix-stripping
  resolves `config/corne.keymap` / `config/toucan.keymap` automatically — the dongle inherits
  the shared keymap for free.
- **Dongle Kconfig:** `CONFIG_ZMK_SPLIT=y`, `CONFIG_ZMK_SPLIT_ROLE_CENTRAL=y`,
  `CONFIG_ZMK_SPLIT_BLE_CENTRAL_PERIPHERALS=2`, sleep disabled. (On v0.3 the symbol is
  `..._CENTRAL_PERIPHERALS`, not `..._PERIPHERAL_COUNT`.)
- **Peripheral variants of the halves:** the same shields rebuilt with
  `cmake-args: -DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=n` and their own `artifact-name`. This
  overrides the shield's `default y` without needing a second `.conf`, so standalone and
  dongle firmware coexist in one matrix.
- **No position-offset config needed.** Each half's overlay already applies `col-offset = <6>`
  on the right, so peripherals report absolute key positions `0–41`.
- **Pairing order matters:** Prospector's peripheral battery widget uses pairing order —
  flash the dongle, then pair left, then right.
- **The Toucan trackpad through a dongle is the hard part.** Today `trackpad_listener` and
  the input processors are enabled on the *left* half (the central), fed from the right half
  via `zmk,input-split`. With a dongle as central, that listener has to move to the dongle
  overlay, and the dongle needs `CONFIG_ZMK_POINTING=y` plus its own `trackpad_split` node.
  This is the change most likely to force a fork of the beekeeb module. Note that the `&mo 4`
  coupling from §5.1 has to survive that move, since the dongle would then own the input
  processors.

## 12. Verifying without Corne hardware

The constraint is that the Corne firmware ships unflashed and untested on real hardware. That
is more tractable than it sounds, because of §2: **there is only one keymap.** If the Toucan2
proves the keymap, the only Corne-specific residue is Kconfig and the upstream corne shield —
neither of which this change set alters in any interesting way beyond one symbol.

### What CI proves on its own

The build workflow already dumps, per matrix entry, the full resolved devicetree
(`zephyr.dts`) and the sorted Kconfig (`.config`). Together with the committed drawer output
these give four deterministic, diffable checks that need no keyboard:

| Check | Proves |
| --- | --- |
| **Both Corne entries compile** | shield resolution, `ZMK_POINTING`, flash/RAM fit |
| **`keymap-drawer/corne.yaml` diff** | the parsed keymap, layer by layer and key by key — this is the direct "layers remain accurate" assertion, in reviewable text, committed to the repo |
| **`corne.svg` renders five layers** | tri-layer parsed, mouse layer present, `&mkp` legends resolved |
| **`zephyr.dts` for `toucan_left` contains the same `keymap` node as the Corne's** | the single-source claim, mechanically |

That last one is the one worth actually doing rather than assuming: pull both `zephyr.dts`
dumps from the two build logs and diff the `keymap { ... }` block. If the two boards' keymap
nodes are identical, then anything the Toucan2 demonstrates on hardware is equally true of
the Corne firmware.

### What only the Toucan2 flash can prove

Tri-layer actually reaching `ADJUST`; the trackpad activating `MOUSE` via
`is_touching_processor`; touch-scroll on `LOWER`/`RAISE`; combos and home-row mods still
behaving with five layers in play; the display coming up.

Every one of those is keymap- or shield-level, and the keymap half transfers to the Corne by
the argument above.

### What genuinely remains untested until the Corne is back

- `CONFIG_ZMK_POINTING=y` on `nice_nano_v2` at *runtime* (it compiling is most of the risk,
  but not all — the Corne will now advertise mouse HID capability, which is a behaviour
  change on the host side, however benign).
- Nothing else specific to this change set. The corne shield, its nice!view, and the split
  pairing are all untouched.

**Accept that residue explicitly rather than trying to engineer around it.** The one thing
worth doing when the Corne is available again is a smoke test: pair both halves, confirm
tri-layer reaches `ADJUST`, and confirm the host still sees a normal keyboard.

### The single most likely failure

`CONFIG_ZMK_POINTING=y` pushing the Corne build over the `nice_nano_v2` flash budget, on a
build that already carries ZMK Studio and a nice!view. It fails loudly at link time in CI, so
it cannot reach hardware silently — and §5.3 has the fallback ready (`&trans` thumbs, drop
`ZMK_POINTING` from the Corne, keep the layer for index alignment).

## 13. Phased execution

Reordered for the no-Corne-hardware constraint: the five-layer keymap work is no longer
gated behind a Corne hardware test, and instead ships together with Toucan2 support as one
change set that CI can fully validate.

**Phase 1 — one change set: both boards build, five layers, CI-verified.**

1. Move `base/behaviors/combos.dtsi` into `config/shared/`; extract the layers into
   `config/shared/keymap.dtsi`; reduce `config/corne.keymap` to the one-line stub.
2. Add `config/shared/version.dtsi` with the `KEYMAP_VERSION` macro (§10) and change
   `default_layer` to `display-name = KEYMAP_VERSION;`. Done here rather than deferred,
   because the file is being rewritten anyway and the anchored `sed` is what makes step 3
   safe.
3. Add `ADJUST` (§6.1) and `MOUSE` (§5.3) with the fixed ordering and the load-bearing
   comment; add `conditional_layers`; add `<dt-bindings/zmk/pointing.h>` and
   `<dt-bindings/zmk/outputs.h>` to `base.dtsi`; add `CONFIG_ZMK_POINTING=y` to
   `config/corne_left.conf` (central only — see §5.3).
4. Add the west projects (SHAs in §8), the four Toucan/reset matrix entries and
   `artifact-name` throughout, `config/toucan.keymap` (stub) and `config/toucan.conf` (§6.2).
5. Pipelines: widen the `build.yml` filter; narrow `draw-keymaps.yml` to
   `config/corne.keymap` and pin `install_version: "0.23.0"`; add the `&mkp` legends; repoint
   the `prepare-release.yml` `sed` at `config/shared/version.dtsi`.
6. README: note that the single diagram covers both keyboards, and that the key-position map
   applies to both. Add the Toucan2 to the intro alongside the Corne.

*Exit criteria — all four checks in §12, no hardware:* every matrix entry compiles;
`corne.yaml` diffs cleanly against the intended layer changes and nothing else; `corne.svg`
shows five layers with real mouse legends; the `keymap` node in `toucan_left`'s `zephyr.dts`
matches the Corne's.

> Worth committing step 1 on its own even though everything ships together: with nothing
> else changed, `scripts/draw.ps1` must produce a **zero-diff** `corne.local.yml` against the
> committed `corne.yaml`. That isolates a refactor mistake from the intentional layer changes
> and makes the drawer output a genuine regression test rather than just a picture. Verify
> locally before pushing:
>
> ```bash
> git diff --no-index keymap-drawer/corne.yaml keymap-drawer/corne.local.yml
> ```
>
> (Steps 2–3 will legitimately change that file; step 1 must not.)

**Phase 2 — flash and test the Toucan2.** Take `toucan2_left.uf2` / `toucan2_right.uf2` (and
`toucan2_settings_reset.uf2` if the halves need clearing) from the `firmware` artifact.
Verify: both halves pair; left display comes up; trackpad moves, scrolls on `LOWER`/`RAISE`,
and taps; touch activates `MOUSE` so the thumbs click; tri-layer reaches `ADJUST`; combos and
home-row mods unaffected.

**Phase 3 — Corne smoke test**, whenever the hardware is back. Flash, pair, confirm
tri-layer and normal typing. Low expected yield, but it is the only thing that closes §12's
residue.

**Phase 4 — dongle.** Extract `layout-42.dtsi`, add the dongle shields and the Prospector
module, extend the matrix. The version indicator needs nothing here; it will simply appear on
the Prospector's layer roller as well (§10).

## 14. Open risks

| Risk | Mitigation |
| --- | --- |
| `ZMK_POINTING` overflows `nice_nano_v2` flash | Fails loudly in CI; fallback in §5.3 (`&trans` thumbs, drop the symbol, keep the layer) |
| Layer reorder silently breaks the trackpad (`&mo 4`) | Comment on the `#define` block (§6); fall back to the `&is_touching_processor` override |
| `&mkp` renders as raw text in the diagram | `raw_binding_map` legends — required, not optional (§10) |
| Corne now advertises a mouse endpoint it never uses | Expected, not a defect (§5.3). Re-pairing is optional on the Corne since the keyboard collection is unchanged; scoped to `corne_left.conf` so the peripheral is untouched |
| `&out OUT_TOG` on `ADJUST` fails to build | `base.dtsi` includes only `keys.h`/`bt.h` today; add `outputs.h` alongside `pointing.h` (§6.1) |
| Draw workflow globs the Toucan keymap and fails | Narrow `keymap_patterns` in the same commit that adds `config/toucan.keymap` |
| Corne firmware ships untested on hardware | §12 — four CI checks plus the shared-keymap argument; explicit residue accepted, smoke test in phase 3 |
| `default.conf` precedence inverts shared/specific config | Documented in §7 — don't use it |
| beekeeb modules drift if left on `main` | SHAs pinned in §8; bump deliberately |
| Overriding beekeeb's power tuning without measuring | Treat the shield `.conf` values as hardware facts (§4) |
| Renamed release artifacts | Announce in the release notes for the first version after phase 1 |
| One failing matrix entry skips the merge job and cuts no release at all | Treat any red entry as release-blocking; §9. Combined with §5.3's fallback, keep a path to a green Corne build |
| Release build never triggers because the stamped file falls outside the path filter | Widen `build.yml` to `config/**` — a correctness requirement of the version feature, not tidiness (§10) |
| `sed` stamps the wrong layer after a reorder | Stamp the `KEYMAP_VERSION` macro in `config/shared/version.dtsi`, not the first `display-name` (§10) |
