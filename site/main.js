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

  // Unwrap layer navigation <a> tags so they don't hijack clicks or jump the page
  for (const a of svg.querySelectorAll('a[href^="#"]')) {
    a.replaceWith(...a.childNodes);
  }

  // Let CSS drive the size; the viewBox preserves the aspect ratio.
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('class', 'keymap');
  img.replaceWith(svg);

  const NS = 'http://www.w3.org/2000/svg';
  const layers = svg.querySelectorAll(':scope > g[class^="layer-"]');
  const targets = new Map();
  const groupPeers = new Map();

  for (const [slot, id] of Object.entries(data.keys)) {
    const [layerIndex, keyIndex] = slot.split('.');
    const key = layers[layerIndex]?.querySelector(`.keypos-${keyIndex}`);
    if (!key || !data.content[id]) continue;

    key.classList.add('kb-doc');
    key.setAttribute('tabindex', '0');
    key.setAttribute('role', 'button');
    key.setAttribute('aria-label', data.content[id]?.title ? `${data.content[id].title} key details` : 'Key details');
    // Bottom-right of the 53x53 key, which spans -26..27 on both axes.
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', '19');
    dot.setAttribute('cy', '19');
    dot.setAttribute('r', '3');
    dot.setAttribute('class', 'kb-dot');
    key.appendChild(dot);
    targets.set(key, { id, layerIndex: Number(layerIndex) });
  }

  // Index group peers per layer
  for (const [key, { id, layerIndex }] of targets.entries()) {
    if (!data.content[id]?.group) continue;
    const peers = [];
    for (const [otherKey, otherTarget] of targets.entries()) {
      if (otherTarget.layerIndex === layerIndex && otherTarget.id === id) {
        peers.push(otherKey);
      }
    }
    if (peers.length > 1) {
      groupPeers.set(key, peers);
    }
  }

  // Resolve combos
  const comboTargets = new Map();
  if (data.combos) {
    for (const [comboIndex, comboData] of Object.entries(data.combos)) {
      const comboEl = svg.querySelector(`.combopos-${comboIndex}`);
      const id = typeof comboData === 'string' ? comboData : comboData.id;
      const positions = comboData.positions || [];
      if (!comboEl || !data.content[id]) continue;

      comboEl.classList.add('kb-combo-doc');
      comboEl.setAttribute('tabindex', '0');
      comboEl.setAttribute('role', 'button');
      comboEl.setAttribute('aria-label', data.content[id]?.title ? `${data.content[id].title} combo details` : 'Combo details');
      const rect = comboEl.querySelector('rect.combo');
      if (rect) {
        const rx = parseFloat(rect.getAttribute('x'));
        const ry = parseFloat(rect.getAttribute('y'));
        const rw = parseFloat(rect.getAttribute('width'));
        const rh = parseFloat(rect.getAttribute('height')) || rw;
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', String(rx + rw - 4));
        dot.setAttribute('cy', String(ry + rh - 4));
        dot.setAttribute('r', '1.5');
        dot.setAttribute('class', 'kb-combo-dot');
        comboEl.appendChild(dot);
      }
      comboTargets.set(comboEl, { id, positions });
    }
  }

  /* ---- renderer boundary ------------------------------------------- */
  const tip = document.createElement('div');
  tip.className = 'kb-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  let openTarget = null;
  let activeSources = [];

  const el = (tag, text, parent) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    parent.appendChild(node);
    return node;
  };

  function renderParagraph(text, parent) {
    const p = document.createElement('p');
    const parts = text.split(/(`[^`]+`)/g);
    for (const part of parts) {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        const inner = part.slice(1, -1);
        if (inner.includes('+')) {
          const chord = inner.split('+');
          const span = document.createElement('span');
          span.className = 'kb-inline-chord';
          chord.forEach((k, idx) => {
            if (idx > 0) span.appendChild(document.createTextNode('+'));
            const kbd = document.createElement('kbd');
            kbd.textContent = k.trim();
            span.appendChild(kbd);
          });
          p.appendChild(span);
        } else {
          const kbd = document.createElement('kbd');
          kbd.textContent = inner;
          p.appendChild(kbd);
        }
      } else if (part) {
        p.appendChild(document.createTextNode(part));
      }
    }
    parent.appendChild(p);
    return p;
  }

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
    if (content.body) renderParagraph(content.body, tip);
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
    if (content.zmkDoc) {
      const a = document.createElement('a');
      a.className = 'kb-tip-doc';
      a.href = content.zmkDoc;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = 'ZMK documentation';
      a.setAttribute('aria-label', 'ZMK documentation');
      a.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>' +
        '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>' +
        '</svg>';
      tip.appendChild(a);
    }
  }

  function place(key) {
    const box = key.getBoundingClientRect();
    const self = tip.getBoundingClientRect();
    const pad = 8;
    let left = box.left + box.width / 2 - self.width / 2;
    left = Math.max(pad, Math.min(left, innerWidth - self.width - pad));
    let top = box.bottom + pad;
    if (top + self.height > innerHeight - pad) top = box.top - self.height - pad;
    top = Math.max(pad, top);
    // Page coordinates, so the tooltip stays anchored while scrolling.
    tip.style.left = `${left + scrollX}px`;
    tip.style.top = `${top + scrollY}px`;
  }

  function clearHighlights() {
    for (const element of activeSources) {
      element.classList.remove('kb-combo-source');
    }
    activeSources = [];
  }

  function close() {
    tip.hidden = true;
    openTarget?.classList.remove('kb-open');
    openTarget = null;
    clearHighlights();
  }

  function open(element, contentId, sourcePositions = [], peerKeys = []) {
    close();
    render(data.content[contentId]);
    tip.hidden = false;
    place(element);
    openTarget = element;
    element.classList.add('kb-open');

    if (sourcePositions.length > 0) {
      const baseLayer = layers[0];
      if (baseLayer) {
        for (const pos of sourcePositions) {
          const keyEl = baseLayer.querySelector(`.keypos-${pos}`);
          if (keyEl) {
            keyEl.classList.add('kb-combo-source');
            activeSources.push(keyEl);
          }
        }
      }
    }

    if (peerKeys.length > 0) {
      for (const peer of peerKeys) {
        peer.classList.add('kb-combo-source');
        activeSources.push(peer);
      }
    }
  }

  /* Tooltip trigger mode: 'hover' vs 'click' */
  const isDesktopHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let tipMode = 'hover';
  try {
    const saved = localStorage.getItem('tip-mode');
    if (saved === 'hover' || saved === 'click') tipMode = saved;
  } catch (e) { }

  const modeGroup = document.querySelector('.tip-mode');
  if (modeGroup && isDesktopHover) {
    const modeButtons = [...modeGroup.querySelectorAll('[data-tip-choice]')];
    const syncMode = () => {
      for (const btn of modeButtons) {
        btn.setAttribute('aria-pressed', String(btn.dataset.tipChoice === tipMode));
      }
    };

    for (const btn of modeButtons) {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.tipChoice;
        if (choice !== 'hover' && choice !== 'click') return;
        tipMode = choice;
        try {
          localStorage.setItem('tip-mode', choice);
        } catch (e) { }
        syncMode();
        close();
      });
    }

    syncMode();
    modeGroup.hidden = false;
  }

  let closeTimer = null;
  const scheduleClose = (delay = 120) => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, delay);
  };

  const cancelClose = () => {
    clearTimeout(closeTimer);
  };

  tip.addEventListener('pointerenter', () => {
    if (isDesktopHover && tipMode === 'hover') cancelClose();
  });
  tip.addEventListener('pointerleave', (event) => {
    if (isDesktopHover && tipMode === 'hover' && event.pointerType === 'mouse') {
      scheduleClose();
    }
  });

  for (const [key, { id }] of targets.entries()) {
    const peers = groupPeers.get(key) || [];
    key.addEventListener('click', (event) => {
      event.stopPropagation();
      cancelClose();
      const wasOpen = openTarget === key;
      close();
      if (!wasOpen) open(key, id, [], peers);
    });

    key.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        cancelClose();
        const wasOpen = openTarget === key;
        close();
        if (!wasOpen) open(key, id, [], peers);
      }
    });

    key.addEventListener('pointerenter', (event) => {
      if (isDesktopHover && tipMode === 'hover' && event.pointerType === 'mouse') {
        cancelClose();
        open(key, id, [], peers);
      }
    });

    key.addEventListener('pointerleave', (event) => {
      if (isDesktopHover && tipMode === 'hover' && event.pointerType === 'mouse') {
        scheduleClose();
      }
    });
  }

  for (const [comboEl, { id, positions }] of comboTargets.entries()) {
    comboEl.addEventListener('click', (event) => {
      event.stopPropagation();
      cancelClose();
      const wasOpen = openTarget === comboEl;
      close();
      if (!wasOpen) open(comboEl, id, positions);
    });

    comboEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        cancelClose();
        const wasOpen = openTarget === comboEl;
        close();
        if (!wasOpen) open(comboEl, id, positions);
      }
    });

    comboEl.addEventListener('pointerenter', (event) => {
      if (isDesktopHover && tipMode === 'hover' && event.pointerType === 'mouse') {
        cancelClose();
        open(comboEl, id, positions);
      }
    });

    comboEl.addEventListener('pointerleave', (event) => {
      if (isDesktopHover && tipMode === 'hover' && event.pointerType === 'mouse') {
        scheduleClose();
      }
    });
  }

  document.addEventListener('click', (event) => {
    if (!tip.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
})();

/* ==========================================================================
   Download Controller (SVG & On-the-Fly PNG Rasterizer)
   ========================================================================== */
(function initDownloads() {
  const box = document.querySelector('.kb-dl');
  const svgLink = box?.querySelector('a[download]');
  const frame = document.querySelector('main');
  if (!box || !svgLink || !frame) return;

  const SCALE = 2; // 1680x2866

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
        reject(new Error('could not load the diagram'));
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
})();

