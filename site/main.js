import keymapSvgRaw from '../keymap-drawer/corne.svg?raw';
import tooltipsData from './tooltips.json';

const NS = 'http://www.w3.org/2000/svg';
const SCALE = 2;

(function init() {
  const container = document.getElementById('keymap-container');
  if (!container) return;

  const parsed = new DOMParser().parseFromString(keymapSvgRaw, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (!svg || svg.nodeName !== 'svg') return;

  // Let CSS drive the responsive sizing; viewBox preserves aspect ratio
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('class', 'keymap');
  container.replaceChildren(svg);

  const layers = svg.querySelectorAll(':scope > g[class^="layer-"]');
  const targets = new Map();

  // Extract stamped version from base layer (e.g. "1.3.0")
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

  // Bind tooltips and add accessible attributes
  for (const [slot, id] of Object.entries(tooltipsData.keys)) {
    const [layerIndex, keyIndex] = slot.split('.');
    const key = layers[layerIndex]?.querySelector(`.keypos-${keyIndex}`);
    if (!key || !tooltipsData.content[id]) continue;

    key.classList.add('kb-doc');
    key.setAttribute('tabindex', '0');
    key.setAttribute('role', 'button');
    key.setAttribute('aria-haspopup', 'dialog');
    if (tooltipsData.content[id].title) {
      key.setAttribute('aria-label', tooltipsData.content[id].title);
    }

    // Indicator dot (bottom-right of 53x53 key)
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', '19');
    dot.setAttribute('cy', '19');
    dot.setAttribute('r', '3');
    dot.setAttribute('class', 'kb-dot');
    key.appendChild(dot);
    targets.set(key, id);
  }

  /* ---- tooltip component ------------------------------------------- */
  const tip = document.createElement('div');
  tip.className = 'kb-tip';
  tip.hidden = true;
  document.body.appendChild(tip);
  let openKey = null;

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

  function place(key) {
    const box = key.getBoundingClientRect();
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
    openKey?.classList.remove('kb-open');
    openKey = null;
  }

  function open(key) {
    render(tooltipsData.content[targets.get(key)]);
    tip.hidden = false;
    place(key);
    openKey = key;
    key.classList.add('kb-open');
  }

  for (const key of targets.keys()) {
    const toggle = (event) => {
      event.stopPropagation();
      const wasOpen = openKey === key;
      close();
      if (!wasOpen) open(key);
    };

    key.addEventListener('click', toggle);
    key.addEventListener('keydown', (event) => {
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
  const dlBox = document.querySelector('.kb-dl');
  const svgLink = document.getElementById('kb-dl-svg');
  const mainFrame = document.querySelector('main');

  if (dlBox && svgLink && mainFrame) {
    if (version) {
      svgLink.download = `keymap-v${version}.svg`;
    }

    const svgBlob = new Blob([keymapSvgRaw], { type: 'image/svg+xml' });
    const svgBlobUrl = URL.createObjectURL(svgBlob);
    svgLink.href = svgBlobUrl;

    // Add PNG button (2x client-side canvas rasterizer)
    const pngBtn = document.createElement('button');
    pngBtn.type = 'button';
    pngBtn.textContent = 'PNG';
    pngBtn.setAttribute('aria-label', 'Download keymap as PNG');
    dlBox.appendChild(pngBtn);

    pngBtn.addEventListener('click', async () => {
      pngBtn.disabled = true;
      pngBtn.textContent = '...';
      try {
        const imgEl = new Image();
        await new Promise((resolve, reject) => {
          imgEl.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = imgEl.naturalWidth * SCALE;
            canvas.height = imgEl.naturalHeight * SCALE;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
              if (!blob) return reject(new Error('toBlob failed'));
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = version ? `keymap-v${version}.png` : 'keymap.png';
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 0);
              resolve();
            }, 'image/png');
          };
          imgEl.onerror = () => reject(new Error('PNG render failed'));
          imgEl.src = svgBlobUrl;
        });
        pngBtn.textContent = 'PNG';
      } catch {
        pngBtn.textContent = 'failed';
        setTimeout(() => (pngBtn.textContent = 'PNG'), 2000);
      } finally {
        pngBtn.disabled = false;
      }
    });

    // Add direct Firmware download link
    if (version) {
      const fwLink = document.createElement('a');
      fwLink.href = `https://github.com/sterrenb/zmk-config/releases/download/v${version}/firmware-v${version}.zip`;
      fwLink.textContent = 'Firmware';
      fwLink.title = `Download firmware-v${version}.zip (.uf2 files)`;
      fwLink.setAttribute('aria-label', `Download firmware v${version}`);
      dlBox.appendChild(fwLink);
    }

    if ('IntersectionObserver' in window) {
      dlBox.classList.add('kb-dl-auto', 'kb-dl-on');
      new IntersectionObserver(([entry]) => {
        dlBox.classList.toggle('kb-dl-on', entry.isIntersecting);
      }).observe(mainFrame);
    }
  }
})();

