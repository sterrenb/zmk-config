# Prospector Dongle

The Corne's desk setup runs against a [beekeeb Prospector](https://github.com/carrefinho/prospector)
dongle (Seeed XIAO BLE, colour LCD). The dongle is the split **central**: it stays plugged into
the PC over USB, runs the keymap, and both Corne halves connect to it as peripherals.

```
Left Corne (peripheral)  ─┐ BLE
                          ├─► [ Prospector dongle ] ══USB══► PC
Right Corne (peripheral) ─┘      central + colour LCD
```

The Toucan2 is unaffected — it stays a standalone two-half keyboard that talks to laptops over
Bluetooth directly.

## What stays shared

The keymap is genuinely not duplicated, and not because of a one-line include file: ZMK's config
lookup trims a shield name down to its underscore-separated prefixes
([`app/keymap-module/modules/modules.cmake`](https://github.com/zmkfirmware/zmk/blob/v0.3/app/keymap-module/modules/modules.cmake)),
so a `corne_dongle` build searches for `corne_dongle.keymap` **and** `corne.keymap` — and finds
the latter first. The dongle therefore runs [`config/corne.keymap`](../config/corne.keymap), which
is the same one-line include of [`config/shared/keymap.dtsi`](../config/shared/keymap.dtsi) that
the halves use. There is deliberately no `config/corne_dongle.keymap`; it would be dead.

The same fallback applies [`config/corne.conf`](../config/corne.conf) to the dongle, so it
inherits the keyboard's radio power, sleep and ZMK Studio settings.
[`config/corne_dongle.conf`](../config/corne_dongle.conf) is merged after it and overrides only
what must differ.

Untouched by this setup: [`config/shared/*`](../config/shared/), the Toucan2 config,
[`site/`](../site/), [`keymap-drawer/`](../keymap-drawer/) and the release workflow.

## Roles

| | Standalone Corne | Corne + Prospector |
| :--- | :--- | :--- |
| Central | Left half | Prospector dongle |
| Left half | Central | Peripheral |
| Right half | Peripheral | Peripheral |
| Keymap runs on | Left half | Dongle |
| Host connection | USB or BLE from the left half | USB (or BLE) from the dongle |
| Left display | nice!view: layer + version | nice!view: peripheral status only |
| Status display | nice!view | Prospector LCD: layer, both batteries, caps word |
| Battery | Left drains faster (central radio) | Both halves drain equally and slower |

`&bt BT_SEL 0..4` and `&out OUT_TOG` on the media layer act on whichever device is central. On the
dongle that means the *dongle's* host profiles, not the halves' — the halves have no host bond in
this topology. `&bootloader` and `&sys_reset` are event-source-local behaviours, so the reset and
bootloader keys on the Nav and Num outer columns still act on the half whose key was pressed, as
their keymap comments describe.

The dongle has no key of its own that can put *it* into the bootloader — use the reset button on
the board.

## What was added

### `boards/shields/corne_dongle/`

A keyless central shield, following ZMK's
[dongle guide](https://zmk.dev/docs/development/hardware-integration/dongle).

- `Kconfig.shield` — declares `SHIELD_CORNE_DONGLE`.
- `Kconfig.defconfig` — central role, plus `ZMK_SPLIT_BLE_CENTRAL_PERIPHERALS=2` and
  `BT_MAX_CONN`/`BT_MAX_PAIRED=7`. ZMK defaults a BLE central to 1 peripheral and 6 connections,
  which would bind only one half. `ZMK_BLE_PROFILE_COUNT` is `BT_MAX_PAIRED` minus the peripheral
  count, so 7 − 2 keeps the five host profiles the media layer addresses.
- `corne_dongle.overlay` — a `zmk,kscan-mock` (ZMK requires a chosen `zmk,kscan` even with no
  matrix) and **both** Corne physical layouts with **both** matrix transforms. It does **not**
  include ZMK's `corne.dtsi`: that file reaches for `&pro_micro`, `&pro_micro_i2c` and an
  SSD1306, none of which exist on a XIAO BLE.

  Declaring both layouts is not optional even though this keymap only uses the 6-column one. A
  split central pushes its *selected physical layout index* to every peripheral
  ([`central.c`](https://github.com/zmkfirmware/zmk/blob/v0.3/app/src/split/bluetooth/central.c)),
  and that index addresses each device's own layout list. The halves get two layouts from
  `corne.dtsi` and sort `foostan_corne_5col_layout` to index 0, so a dongle declaring only the
  6-column layout is pinned to index 0 and orders both halves onto their **5-column** transform —
  every key shifts, the outer columns go dead, and the entire thumb row (positions 36–41, i.e.
  every layer key) becomes unreachable. With both declared the lists line up and the chosen
  6-column layout is index 1 everywhere.

The halves report already-global key positions — `corne_right.overlay` applies `col-offset = <6>`
on its own side — so the dongle needs no offset logic.

### `config/corne_dongle.conf`

Overrides the keyboard name, enables `CONFIG_ZMK_POINTING` (the Mouse layer's `&mkp` runs on the
central, so it moves off the left half), sets the Prospector brightness, and turns on the battery
level proxy. `CONFIG_ZMK_DISPLAY` and the peripheral battery *fetching* come from the
`prospector_adapter` shield itself and are not repeated.

### `config/corne_right.conf` (new) and `config/corne_left.conf`

`CONFIG_ZMK_KSCAN_DEBOUNCE_PRESS_MS`/`_RELEASE_MS` moved here out of `corne.conf`. They sit under
`if ZMK_KSCAN_GPIO_DRIVER`, which is off on the dongle's mock kscan, and Zephyr's `kconfig.py`
turns "assigned but not applied" into `Aborting due to Kconfig warnings` — leaving them in the
inherited `corne.conf` fails the dongle build.

### `config/west.yml`

Adds `carrefinho/prospector-zmk-module`, pinned to a SHA like the other third-party modules so a
tagged release rebuilds identically. Its `main` branch is the one targeting ZMK v0.3 / Zephyr 3.5,
which is what this repo tracks; `feat/new-status-screens` is for ZMK main and would not build here.

### `build.yaml` / `build-reset.yaml`

Both topologies build on every push. The left half is demoted with
`-DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=n` — note that `CONFIG_ZMK_SPLIT_BLE_ROLE_PERIPHERAL` does not
exist in ZMK v0.3; assigning it would abort the build. `build-reset.yaml` gains a
`corne_dongle_settings_reset` artifact (byte-identical to `toucan2_settings_reset`, built twice so
the playbook below can name the right file).

## Artifacts

| File | Hardware | Purpose |
| :--- | :--- | :--- |
| `corne_dongle.uf2` | Seeed XIAO BLE | Central + LCD |
| `corne_left_peripheral.uf2` | nice!nano v2 | Left half, dongle mode |
| `corne_left_standalone.uf2` | nice!nano v2 | Left half, standalone central |
| `corne_right.uf2` | nice!nano v2 | Right half, **both** modes |
| `corne_settings_reset.uf2` | nice!nano v2 | Clears bonds |
| `corne_dongle_settings_reset.uf2` | Seeed XIAO BLE | Clears bonds |
| `toucan2_left.uf2` / `toucan2_right.uf2` | Seeed XIAO BLE | Toucan2 |
| `toucan2_settings_reset.uf2` | Seeed XIAO BLE | Clears bonds |

## Playbook

Changing which device is the split central invalidates the existing bonds. ZMK's guide is explicit
about this: **flash `settings_reset` to every device involved before flashing the new firmware**,
or the halves will keep trying to reach their old central and never pair.

### Switching to dongle mode

1. Flash `corne_dongle_settings_reset.uf2` to the dongle, `corne_settings_reset.uf2` to **both**
   halves.
2. Flash `corne_dongle.uf2` to the dongle, `corne_left_peripheral.uf2` to the left half,
   `corne_right.uf2` to the right half.
3. Power off both halves and plug the dongle into USB.
4. Turn on the **left** half first, then the **right**. The Prospector's battery widget lays out
   its sub-widgets in pairing order, so left-then-right is what puts them on the correct side.

### Switching back to standalone

1. Flash `corne_settings_reset.uf2` to both halves. Unplug the dongle, or reset it too if you want
   it to forget the halves.
2. Flash `corne_left_standalone.uf2` to the left half. The right half needs no new firmware — it is
   a peripheral either way — but it does need the reset from step 1.
3. Pair the left half to the host over Bluetooth as usual.

## Notes

- The dongle's `prospector_adapter` overlay always declares an APDS9960 ambient light sensor node,
  but the sensor is optional on the hardware. `config/corne_dongle.conf` assumes it is **not**
  fitted (`USE_AMBIENT_LIGHT_SENSOR=n`, fixed brightness 80). If yours has one, flip that to `y`
  and drop `PROSPECTOR_FIXED_BRIGHTNESS` — the two are mutually exclusive.
- `CONFIG_ZMK_SLEEP` is inherited from `corne.conf` but is inert on the dongle: ZMK skips deep
  sleep while USB power is present.
- ZMK Studio talks to the central, so in dongle mode connect Studio to the dongle.
