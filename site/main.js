import tooltipsData from './tooltips.json';
import keymapSvgRaw from '../keymap-drawer/corne.svg?raw';

/* ==========================================================================
   Theme Controller
   ========================================================================== */
(function initTheme() {
  const themeGroup = document.querySelector('.theme');
  if (!themeGroup) return;

  const buttons = [...themeGroup.querySelectorAll('[data-theme-choice]')];

  const currentTheme = () => document.documentElement.dataset.theme || 'system';

  const syncButtons = () => {
    const active = currentTheme();
    for (const btn of buttons) {
      btn.setAttribute('aria-pressed', String(btn.dataset.themeChoice === active));
    }
  };

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.themeChoice;
      if (choice === 'light' || choice === 'dark') {
        document.documentElement.dataset.theme = choice;
        try {
          localStorage.setItem('theme', choice);
        } catch (e) { }
      } else if (choice === 'system') {
        delete document.documentElement.dataset.theme;
        try {
          localStorage.removeItem('theme');
        } catch (e) { }
      }
      syncButtons();
    });
  }

  syncButtons();
  themeGroup.hidden = false;
})();

/* ==========================================================================
   Progressive Interactive Keymap & Tooltips
   ========================================================================== */
(async function initKeymap() {
  const img = document.querySelector('.keymap');
  if (!img) return;

  const data = tooltipsData;
  if (!data) return;

  const markup = keymapSvgRaw;
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (!svg || svg.nodeName !== 'svg') return;

  // Let CSS drive the size; the viewBox preserves the aspect ratio.
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('class', 'keymap');
  img.replaceWith(svg);

  const NS = 'http://www.w3.org/2000/svg';
  const layers = svg.querySelectorAll(':scope > g[class^="layer-"]');
  const targets = new Map();

  // Extract stamped version from base layer (e.g. "1.3.1")
  const baseLayer = layers[0];
  const match = baseLayer?.getAttribute('class')?.match(/layer-([0-9]+\.[0-9]+\.[0-9]+)/);
  const version = match ? match[1] : null;

  // Update header release badge
  const badge = document.getElementById('kb-version-badge');
  if (badge && version) {
    badge.textContent = `v${version}`;
    badge.href = `https://github.com/sterrenb/zmk-config/releases/tag/v${version}`;
    badge.title = `View Release v${version} on GitHub`;
  }

  // Key tooltips
  for (const [slot, id] of Object.entries(data.keys || {})) {
    const [layerIndex, keyIndex] = slot.split('.');
    const key = layers[layerIndex]?.querySelector(`.keypos-${keyIndex}`);
    if (!key || !data.content[id]) continue;

    key.classList.add('kb-doc');
    key.setAttribute('tabindex', '0');
    key.setAttribute('role', 'button');
    key.setAttribute('aria-haspopup', 'dialog');
    if (data.content[id].title) {
      key.setAttribute('aria-label', data.content[id].title);
    }

    // Bottom-right of the 53x53 key, which spans -26..27 on both axes.
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', '19');
    dot.setAttribute('cy', '19');
    dot.setAttribute('r', '3');
    dot.setAttribute('class', 'kb-dot');
    key.appendChild(dot);
    targets.set(key, { id, isCombo: false });
  }

  // Combo tooltips
  const basePositions = {};
  if (layers[0]) {
    for (const key of layers[0].querySelectorAll('[class*="keypos-"]')) {
      const m = key.className.baseVal.match(/keypos-(\d+)/);
      if (m) basePositions[m[1]] = key;
    }
  }

  for (const [comboIndex, { id, positions }] of Object.entries(data.combos || {})) {
    const combo = svg.querySelector(`.combopos-${comboIndex}`);
    if (!combo || !data.content[id]) continue;

    combo.classList.add('kb-combo-doc');
    combo.setAttribute('tabindex', '0');
    combo.setAttribute('role', 'button');
    combo.setAttribute('aria-haspopup', 'dialog');
    if (data.content[id].title) {
      combo.setAttribute('aria-label', data.content[id].title);
    }

    const sourceKeys = (positions || []).map((pos) => basePositions[pos]).filter(Boolean);
    targets.set(combo, { id, isCombo: true, sourceKeys });
  }

  /* ---- tooltip & highlights ---------------------------------------- */
  const tip = document.createElement('div');
  tip.className = 'kb-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  let openTarget = null;
  let activeSources = [];
  let activePeers = [];

  const el = (tag, text, parent) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    parent.appendChild(node);
    return node;
  };

  function render(content) {
    tip.textContent = '';
    if (content.title) el('h2', content.title, tip);
    if (content.keys) {
      const row = el('div', null, tip);
      row.className = 'kb-keys';
      content.keys.forEach((k, i) => {
        if (i) el('span', '+', row);
        el('kbd', k, row);
      });
    }
    if (content.body) el('p', content.body, tip);
    if (content.pre) el('pre', content.pre, tip);
    if (content.links) {
      const list = el('ul', null, tip);
      for (const link of content.links) {
        const a = el('a', link.text, el('li', null, list));
        a.href = link.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    }
  }

  function place(target) {
    const box = target.getBoundingClientRect();
    const self = tip.getBoundingClientRect();
    const pad = 8;
    let left = box.left + box.width / 2 - self.width / 2;
    left = Math.max(pad, Math.min(left, innerWidth - self.width - pad));
    let top = box.bottom + pad;
    if (top + self.height > innerHeight - pad) top = box.top - self.height - pad;
    top = Math.max(pad, top);
    tip.style.left = `${left + scrollX}px`;
    tip.style.top = `${top + scrollY}px`;
  }

  function close() {
    tip.hidden = true;
    openTarget?.classList.remove('kb-open');
    openTarget = null;
    clearHighlights();
  }

  function clearHighlights() {
    for (const key of activeSources) key.classList.remove('kb-source');
    activeSources = [];
    for (const key of activePeers) key.classList.remove('kb-group-peer');
    activePeers = [];
  }

  function open(target) {
    const meta = targets.get(target);
    if (!meta) return;

    render(data.content[meta.id]);
    tip.hidden = false;
    place(target);
    openTarget = target;
    target.classList.add('kb-open');

    clearHighlights();

    if (meta.isCombo && meta.sourceKeys) {
      for (const key of meta.sourceKeys) key.classList.add('kb-source');
      activeSources = meta.sourceKeys;
    } else if (data.content[meta.id]?.group) {
      const layerG = target.closest('g[class^="layer-"]');
      if (layerG) {
        for (const [k, m] of targets.entries()) {
          if (m.id === meta.id && k !== target && layerG.contains(k)) {
            k.classList.add('kb-group-peer');
            activePeers.push(k);
          }
        }
      }
    }
  }

  /* ---- interaction controller --------------------------------------- */
  let tipMode = 'hover';
  try {
    const saved = localStorage.getItem('tip-mode');
    if (saved === 'hover' || saved === 'click') tipMode = saved;
  } catch (e) { }

  const modeGroup = document.querySelector('.tip-mode');
  if (modeGroup) {
    const buttons = [...modeGroup.querySelectorAll('[data-tip-choice]')];
    const sync = () => {
      for (const btn of buttons) {
        btn.setAttribute('aria-pressed', String(btn.dataset.tipChoice === tipMode));
      }
    };
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        tipMode = btn.dataset.tipChoice;
        try {
          localStorage.setItem('tip-mode', tipMode);
        } catch (e) { }
        sync();
        close();
      });
    }
    sync();
    modeGroup.hidden = false;
  }

  for (const target of targets.keys()) {
    target.addEventListener('mouseenter', () => {
      if (tipMode === 'hover') open(target);
    });

    target.addEventListener('mouseleave', () => {
      if (tipMode === 'hover' && openTarget === target) close();
    });

    const toggle = (event) => {
      event.stopPropagation();
      const wasOpen = openTarget === target;
      close();
      if (!wasOpen) open(target);
    };

    target.addEventListener('click', toggle);

    target.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle(event);
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!tip.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  /* ---- download controls -------------------------------------------- */
  initDownloads(version);
})();

/* ==========================================================================
   Downloads Controller
   ========================================================================== */
function initDownloads(version) {
  const box = document.querySelector('.kb-dl');
  const svgLink = box?.querySelector('a[download]');
  const frame = document.querySelector('main');
  if (!box || !svgLink || !frame) return;

  const SCALE = 2;

  const markup = () => Promise.resolve(keymapSvgRaw);

  function stem(svg) {
    const match = svg.match(/<g[^>]*class="layer-([^"]*)"/);
    return match && /^\d+\.\d+\.\d+$/.test(match[1]) ? `keymap-${match[1]}` : 'keymap';
  }

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function rasterise(svg) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth * SCALE;
        canvas.height = image.naturalHeight * SCALE;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('could not load diagram'));
      };

      image.src = url;
    });
  }

  const png = document.createElement('button');
  png.type = 'button';
  png.textContent = 'PNG';
  png.setAttribute('aria-label', 'Download the diagram as PNG');
  box.appendChild(png);

  png.addEventListener('click', async () => {
    png.disabled = true;
    png.textContent = '...';
    try {
      const svg = await markup();
      save(await rasterise(svg), `${stem(svg)}.png`);
      png.textContent = 'PNG';
    } catch {
      png.textContent = 'failed';
      setTimeout(() => (png.textContent = 'PNG'), 2000);
    } finally {
      png.disabled = false;
    }
  });

  // Add direct Firmware download link
  if (version) {
    const fwLink = document.createElement('a');
    fwLink.href = `https://github.com/sterrenb/zmk-config/releases/download/v${version}/firmware-v${version}.zip`;
    fwLink.textContent = 'Firmware';
    fwLink.title = `Download firmware-v${version}.zip (.uf2 files)`;
    fwLink.setAttribute('aria-label', `Download firmware v${version}`);
    box.appendChild(fwLink);
  }

  if (!('IntersectionObserver' in window)) return;

  box.classList.add('kb-dl-auto', 'kb-dl-on');

  new IntersectionObserver(([entry]) => {
    box.classList.toggle('kb-dl-on', entry.isIntersecting);
    if (entry.isIntersecting) {
      markup()
        .then((svg) => (svgLink.download = `${stem(svg)}.svg`))
        .catch(() => { });
    }
  }).observe(frame);
}
