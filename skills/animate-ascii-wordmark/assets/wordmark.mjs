import { createSimulation, TICK_MS } from './engine.mjs';

export const palettes = {
  dark: { base: '#8099dc', red: '#ff7087', blue: '#629bff', cyan: '#4fe4ec', amber: '#e8bd76', lilac: '#bd9de2', player: '#f0ecdf' },
  light: { base: '#3f589b', red: '#bf3155', blue: '#305ec8', cyan: '#087d86', amber: '#926014', lilac: '#7950a8', player: '#242f49' },
};

let fontsReady;
async function loadFonts() {
  fontsReady ??= Promise.all([
    ['Repair Sans', 'geist-latin.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
    ['Repair Sans', 'geist-latin-ext.woff2', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'],
    ['Repair Sans', 'geist-vietnamese.woff2', 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB'],
    ['Repair Mono', 'geist-mono-latin.woff2', 'U+0000-00FF'],
  ].map(async ([family, file, unicodeRange]) => {
    const font = new FontFace(family, `url(${new URL(`./fonts/${file}`, import.meta.url)})`, { weight: '100 900', unicodeRange });
    await font.load(); document.fonts.add(font);
  }));
  await fontsReady;
}

export function validateText(input) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('Supply a non-empty wordmark with --text.');
  const text = input.normalize('NFC').trim();
  if ([...text].length > 40) throw new Error('Keep the wordmark to 40 characters or fewer for a readable silhouette.');
  if (!/^[\p{Script=Latin}\p{Mark}0-9 .,!?&+\-_:;()'"/@#\n]+$/u.test(text)) throw new Error('The bundled font supports Latin wordmarks. Supply a licensed font and adapt coverage for other scripts; do not substitute missing glyphs.');
  if (!/[\p{Script=Latin}0-9]/u.test(text)) throw new Error('Include at least one letter or number.');
  return text;
}

/** Rasterize text into a compact glyph silhouette; the final canvas stays transparent. */
export async function createLayout(input) {
  const text = validateText(input);
  await loadFonts();
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (line && [...`${line} ${word}`].length > 14) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
  }
  const source = document.createElement('canvas');
  const ctx = source.getContext('2d', { willReadFrequently: true });
  ctx.font = '750 160px "Repair Sans"';
  const measurements = lines.map(line => ctx.measureText(line));
  const ascent = Math.ceil(Math.max(...measurements.map(m => m.actualBoundingBoxAscent)));
  const descent = Math.ceil(Math.max(...measurements.map(m => m.actualBoundingBoxDescent)));
  const lineHeight = ascent + descent;
  const cellHeight = lineHeight / 14;
  // Sample fewer horizontal cells than display pixels: keep glyphs legible at mobile sizes.
  const cellWidth = cellHeight * 1.1;
  const columns = Math.ceil(Math.max(...measurements.map(m => m.width)) / cellWidth) + 2;
  if (columns > 240) throw new Error('This wordmark is too wide. Use a shorter name or insert a line break.');
  const height = lines.length * 17 - 3;
  source.width = Math.ceil(columns * cellWidth);
  source.height = Math.ceil(height * cellHeight);
  ctx.font = '750 160px "Repair Sans"';
  ctx.fillStyle = '#fff';
  lines.forEach((line, index) => {
    const width = measurements[index].width;
    ctx.fillText(line, (source.width - width) / 2, ascent + index * 17 * cellHeight);
  });
  const pixels = ctx.getImageData(0, 0, source.width, source.height).data;
  const rows = Array.from({ length: height }, (_, row) => Array.from({ length: columns }, (_, col) => {
    let alpha = 0, count = 0;
    for (let y = Math.floor(row * cellHeight); y < Math.min(source.height, Math.floor((row + 1) * cellHeight)); y++) {
      for (let x = Math.floor(col * cellWidth); x < Math.min(source.width, Math.floor((col + 1) * cellWidth)); x++) { alpha += pixels[(y * source.width + x) * 4 + 3]; count++; }
    }
    const coverage = alpha / Math.max(1, count * 255);
    return coverage < .12 ? ' ' : coverage < .3 ? '.' : coverage < .55 ? ':' : coverage < .8 ? 'x' : ['M', 'x', 'W'][(row * 7 + col * 11) % 3];
  }).join(''));
  return { text, lines, columns, rows, aspect: .62 };
}

/** Mount once. React/Vue integrations must call destroy when unmounted. */
export async function mountWordmark(canvas, config, { manual = false } = {}) {
  const layout = await createLayout(config.text);
  const theme = config.theme ?? 'dark';
  if (!palettes[theme]) throw new Error('Theme must be dark or light.');
  const width = config.width ?? 820;
  if (!Number.isInteger(width) || width < 240 || width > 2400) throw new Error('Width must be an integer between 240 and 2400.');
  const simulation = createSimulation(layout.rows, { seed: config.seed ?? 71339 });
  const { bounds } = simulation.snapshot();
  const cellWidth = width / (bounds.maxCol - bounds.minCol + 2);
  const cellHeight = cellWidth / layout.aspect;
  canvas.width = width;
  canvas.height = Math.ceil((bounds.maxRow - bounds.minRow + 2) * cellHeight);
  const ctx = canvas.getContext('2d', { alpha: true });
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = manual, timer, destroyed = false, state = manual ? 'manual' : 'paused', pauseReason = '';
  function render({ static: isStatic = !manual && media.matches } = {}) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `500 ${cellHeight * .9}px "Repair Mono"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const cell of simulation.cells({ static: isStatic })) {
      ctx.fillStyle = palettes[theme][cell.tone] ?? palettes[theme].base;
      ctx.globalAlpha = cell.kind === 'ambient' ? .62 : 1;
      ctx.fillText(cell.letter, (cell.col - bounds.minCol + 1) * cellWidth, (cell.row - bounds.minRow + 1) * cellHeight);
    }
    ctx.globalAlpha = 1;
    return canvas;
  }
  function snapshot() { return { ...simulation.snapshot(), state, pauseReason }; }
  function step() { if (destroyed) throw new Error('This wordmark has been destroyed.'); simulation.step(); render(); return snapshot(); }
  function schedule() {
    clearTimeout(timer);
    if (destroyed || manual) return;
    pauseReason = media.matches ? 'reduced-motion' : document.hidden ? 'hidden' : !visible ? 'offscreen' : '';
    state = media.matches ? 'static' : pauseReason ? 'paused' : 'running';
    render();
    if (!pauseReason) timer = setTimeout(() => { step(); schedule(); }, TICK_MS);
  }
  const observer = manual ? null : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: 0 });
  observer?.observe(canvas);
  if (!manual) { media.addEventListener('change', schedule); document.addEventListener('visibilitychange', schedule); }
  render(); schedule();
  return {
    canvas, layout, render, step, snapshot,
    destroy() { destroyed = true; clearTimeout(timer); observer?.disconnect(); media.removeEventListener('change', schedule); document.removeEventListener('visibilitychange', schedule); },
  };
}
