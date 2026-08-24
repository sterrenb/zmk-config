// Tooltip content for the keymap diagram.
//
// Entries declare WHAT THEY MATCH, never where a key sits, so a tooltip follows
// its binding when the layout changes. scripts/build-tooltips.mjs resolves the
// matches against config/shared/keymap.dtsi and fails the build if any entry
// matches nothing -- so a rebound or deleted key surfaces immediately.
//
//   match   '&kp LC(Z)'  exact binding
//           '&hml'       behaviour prefix: every key using it
//   layer   optional layer index to restrict to (0 = base)
//
// Content is structured data, not markup. The renderer decides how to present
// each field, so it can be swapped without touching this file:
//
//   title   short heading
//   keys    shortcut chips, e.g. ['Ctrl', 'Shift', 'S']
//   body    paragraph text
//   pre     preformatted block (config snippets, timings)
//   links   [{ text, href }]

export default {
  'home-row-mods': {
    match: '&hml',
    title: 'Home row mod',
    body:
      'Tap for the letter, hold for the modifier. The "balanced" flavour only ' +
      'resolves to a hold if another key is pressed AND released while held, ' +
      'which matches how modifiers are actually used.',
    pre:
      'flavor:                balanced\n' +
      'tapping-term-ms:       200\n' +
      'quick-tap-ms:          175\n' +
      'require-prior-idle-ms: 150',
    links: [
      {
        text: 'Home row mods, explained',
        href: 'https://precondition.github.io/home-row-mods',
      },
    ],
  },

  'home-row-mods-right': {
    match: '&hmr',
    title: 'Home row mod',
    body:
      'Mirror of the left hand. Positional hold-tap means a hold only resolves ' +
      'if the other key is on the opposite half, so same-hand letter rolls ' +
      'never trigger a stray modifier.',
    links: [
      {
        text: 'Home row mods, explained',
        href: 'https://precondition.github.io/home-row-mods',
      },
    ],
  },

  'thumb-layer-tap': {
    match: '&ltt',
    title: 'Layer-tap thumb',
    body:
      'Tap for backspace, hold for the `Num` layer. Hold together with the `Nav` thumb for `Media` (tri-layer). ' +
      'Quick tap-then-hold repeats backspace.',
    pre: 'flavor:        hold-preferred\nquick-tap-ms:  175',
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/layers#layer-tap',
  },

  'thumb-layer-tap-norepeat': {
    match: '&ltt_norepeat',
    title: 'Layer-tap thumb',
    body:
      'Tap for escape, hold for the `Nav` layer. Hold together with the `Num` thumb for `Media` (tri-layer). ' +
      'No repeat window so a quick tap-then-hold enters `Nav` immediately.',
    pre: 'flavor:        hold-preferred\nquick-tap-ms:  (disabled)',
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/layers#layer-tap',
  },

  // --- Combos --------------------------------------------------------------

  'caps-lock': {
    combo: true,
    match: '&kp CAPSLOCK',
    title: 'Caps Lock',
    keys: ['Z', '\''],
    body: 'Toggles standard Caps Lock.',
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/key-press',
  },

  'caps-word': {
    combo: true,
    match: '&caps_word',
    title: 'Caps Word',
    keys: ['V', 'K'],
    body: 'Capitalizes words until space, punctuation, or backspace is pressed.',
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/caps-word',
  },

  'clipboard-copy': {
    match: '&kp LC(C)',
    title: 'Copy',
    keys: ['Ctrl', 'C'],
    body:
      'Sent as a modifier chord rather than the dedicated HID "Copy" usage. ' +
      'ZMK has K_COPY and C_AC_COPY, but its own compatibility data marks both ' +
      'unsupported on Windows.',
  },

  'clipboard-paste': {
    match: '&kp LC(V)',
    title: 'Paste',
    keys: ['Ctrl', 'V'],
  },

  'clipboard-cut': {
    match: '&kp LC(X)',
    title: 'Cut',
    keys: ['Ctrl', 'X'],
  },

  'clipboard-undo': {
    match: '&kp LC(Z)',
    title: 'Undo',
    keys: ['Ctrl', 'Z'],
  },

  'clipboard-redo': {
    match: '&kp LC(Y)',
    title: 'Redo',
    keys: ['Ctrl', 'Y'],
    body:
      'The Windows binding. Most other platforms and many editors use ' +
      '`Ctrl+Shift+Z` instead, so this one is the least portable key on the layer.',
  },

  // --- Nav, left hand: OS navigation ---------------------------------------

  'snap-left': {
    match: '&kp LG(LEFT)',
    title: 'Snap window left',
    keys: ['Win', '←'],
  },

  'window-minimise': {
    match: '&kp LG(DOWN)',
    title: 'Minimise / restore down',
    keys: ['Win', '↓'],
  },

  'window-maximise': {
    match: '&kp LG(UP)',
    title: 'Maximise window',
    keys: ['Win', '↑'],
  },

  'alt-tab': {
    match: '&kp LA(TAB)',
    title: 'Switch window',
    keys: ['Alt', 'Tab'],
    body: 'Hold and tap repeatedly to walk back through recently used windows.',
  },

  'task-view': {
    match: '&kp LG(TAB)',
    title: 'Task view',
    keys: ['Win', 'Tab'],
    body:
      'The Windows overview of open windows and virtual desktops. On the Toucan2 ' +
      'a three-finger swipe up on the trackpad does the same thing.',
  },

  'nav-back': {
    match: '&kp LA(LEFT)',
    title: 'Back',
    keys: ['Alt', '←'],
    body: 'Browser and file-manager history. Not the same as moving the cursor left.',
  },

  'nav-forward': {
    match: '&kp LA(RIGHT)',
    title: 'Forward',
    keys: ['Alt', '→'],
  },

  'context-menu': {
    match: '&kp K_APP',
    title: 'Context menu',
    body:
      'The dedicated menu key, equivalent to a right-click on whatever currently ' +
      'has focus. Distinct from `Shift+F10` in a few applications.',
  },

  // --- Nav, right hand -----------------------------------------------------

  'insert': {
    match: '&kp INS',
    title: 'Insert',
    body:
      'Toggles overtype mode, where typing replaces the character under the ' +
      'cursor instead of pushing it along. Also the paste half of the older ' +
      '`Shift+Insert` / `Ctrl+Insert` clipboard bindings.',
  },

  'line-home': {
    match: '&kp HOME',
    title: 'Start of line',
    body: 'Add `Ctrl` (left home row) for the start of the document.',
  },

  'line-end': {
    match: '&kp END',
    title: 'End of line',
    body: 'Add `Ctrl` (left home row) for the end of the document.',
  },

  'page-up': {
    match: '&kp PG_UP',
    title: 'Page up',
  },

  'page-down': {
    match: '&kp PG_DN',
    title: 'Page down',
  },

  'snip': {
    match: '&kp LG(LS(S))',
    title: 'Screen snip',
    keys: ['Win', 'Shift', 'S'],
    body:
      'Opens the Windows region-capture overlay. Here because it is a ' +
      'three-modifier chord that is awkward to produce from the base layer.',
  },

  'snap-right': {
    match: '&kp LG(RIGHT)',
    title: 'Snap window right',
    keys: ['Win', '→'],
    body:
      'The four snaps read left-to-right in the same order the arrows read on ' +
      'the right hand of this layer.',
  },

  // --- Media ---------------------------------------------------------------

  // Prefix match: one entry covers all five profile keys.
  'bluetooth-profile': {
    match: '&bt BT_SEL',
    title: 'Bluetooth profile',
    body:
      'Switches the keyboard to one of its five paired hosts. Only the central ' +
      'half talks to the computer; the peripheral keeps its own separate link ' +
      'to the central.',
    links: [
      {
        text: 'ZMK bluetooth behaviour',
        href: 'https://zmk.dev/docs/keymaps/behaviors/bluetooth',
      },
    ],
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/bluetooth',
  },

  'bluetooth-clear': {
    match: '&bt BT_CLR',
    title: 'Clear this profile',
    body:
      'Forgets the pairing on the currently selected profile only. Use it when a ' +
      'host will not reconnect: clear here, remove the keyboard on that host, ' +
      'then pair again.',
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/bluetooth',
  },

  'output-toggle': {
    match: '&out OUT_TOG',
    title: 'Toggle output',
    body:
      'Switches between USB and Bluetooth. Worth knowing when the keyboard is ' +
      'plugged in but typing into the wrong machine -- USB does not automatically ' +
      'win over an active Bluetooth connection.',
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/outputs',
  },

  'lock-screen': {
    match: '&kp C_AL_LOCK',
    title: 'Lock screen',
    keys: ['Win', 'L'],
    body:
      'Sent as a dedicated HID consumer usage rather than the `Win+L` chord, so it ' +
      'does not depend on the modifier reaching the host first.',
  },

  'media-prev': {
    match: '&kp C_PREV',
    title: 'Previous track',
  },

  'media-next': {
    match: '&kp C_NEXT',
    title: 'Next track',
  },

  'media-vol-down': {
    match: '&kp C_VOL_DN',
    title: 'Volume down',
  },

  'media-vol-up': {
    match: '&kp C_VOL_UP',
    title: 'Volume up',
  },

  'media-mute': {
    match: '&kp C_MUTE',
    title: 'Mute audio',
  },

  'media-play-pause': {
    match: '&kp C_PLAY_PAUSE',
    title: 'Play / Pause',
  },

  'brightness-down': {
    match: '&kp C_BRI_DN',
    title: 'Brightness down',
  },

  'brightness-up': {
    match: '&kp C_BRI_UP',
    title: 'Brightness up',
  },

  'sys-reset': {
    match: '&reset_hold',
    title: 'Reset',
    keys: ['hold 1s'],
    body:
      'Reboots the half this key is on. Harmless -- it does not erase settings or ' +
      'firmware. `Nav` carries the left half, `Num` the right, because the behaviour ' +
      'always acts on the half whose key you pressed.',
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/reset',
  },

  'bootloader': {
    match: '&boot_hold',
    title: 'Bootloader',
    keys: ['hold 1s'],
    body:
      'Reboots the half this key is on into the UF2 bootloader for flashing firmware. ' +
      'Must be held for 1 second to prevent accidental triggers.',
    zmkDoc: 'https://zmk.dev/docs/keymaps/behaviors/reset#bootloader',
  },

  // --- Mouse ---------------------------------------------------------------

  // Prefix match: all six thumb buttons share the same explanation, and the
  // glyphs already say which button each one is.
  'trackpad-click': {
    match: '&mkp',
    title: 'Trackpad button',
    body:
      'Only reachable on the Toucan2. Its trackpad activates this layer while a ' +
      'finger rests on the pad, turning the thumbs into mouse buttons for as ' +
      'long as you are touching it. On the Corne the layer is unreachable.',
  },
};
