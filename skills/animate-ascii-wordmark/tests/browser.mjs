import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serve } from '../scripts/server.mjs';

const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(join(tmpdir(), 'wordmark-browser-'));
const output = join(scratch, 'site');
let browser, server;
try {
  execFileSync(process.execPath, [join(skill, 'scripts/generate.mjs'), '--text', 'Acme', '--out', output]);
  server = await serve(output);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    await page.goto(server.url);
    await page.waitForFunction(() => window.wordmarkReady);
    await page.waitForFunction(() => window.wordmark.snapshot().tick > 2);
    assert.equal(await page.locator('h1').textContent(), 'Acme');
    assert.equal(await page.locator('button').count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const alpha = await page.evaluate(() => {
      const canvas = window.wordmark.canvas;
      const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = 0, opaque = 0;
      for (let i = 3; i < rgba.length; i += 4) { if (!rgba[i]) clear++; if (rgba[i]) opaque++; }
      return { clear, opaque, total: rgba.length / 4 };
    });
    assert(alpha.clear > alpha.total * .7 && alpha.opaque > 0);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.wordmark.snapshot().state === 'static');
  const staticTick = await page.evaluate(() => window.wordmark.snapshot().tick);
  await page.waitForTimeout(160);
  assert.equal(await page.evaluate(() => window.wordmark.snapshot().tick), staticTick);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => window.wordmark.snapshot().tick > 0 && window.wordmark.snapshot().state === 'running');
  await page.evaluate(() => { document.querySelector('main').style.marginTop = '200vh'; });
  await page.waitForFunction(() => window.wordmark.snapshot().pauseReason === 'offscreen');
  const pausedTick = await page.evaluate(() => window.wordmark.snapshot().tick);
  await page.waitForTimeout(160);
  assert.equal(await page.evaluate(() => window.wordmark.snapshot().tick), pausedTick);
  await page.evaluate(() => { document.querySelector('main').style.marginTop = ''; });
  await page.waitForFunction(() => window.wordmark.snapshot().state === 'running');
  const cases = await page.evaluate(async () => {
    const { createLayout } = await import('./assets/wordmark.mjs');
    const results = [];
    for (const text of ['I', 'Acme', 'Phi Long', 'Café', 'Sóng Biển', 'North Star Studio']) {
      const layout = await createLayout(text);
      const { createSimulation } = await import('./assets/engine.mjs');
      const sim = createSimulation(layout.rows);
      const opening = JSON.stringify(sim.cells());
      let frame = 0;
      while (sim.snapshot().cycle < 1 && frame++ < 2250) sim.step();
      results.push({ text, columns: layout.columns, complete: sim.snapshot().cycle === 1, same: JSON.stringify(sim.cells()) === opening });
    }
    return results;
  });
  for (const item of cases) assert(item.complete && item.same, `Render-derived seam failed: ${item.text}`);
  assert.deepEqual(errors, []);
  await browser.close(); browser = undefined;
  await server.close(); server = undefined;
  // Exercise the real CLI, encoder, and decoded transparency validation in both palettes.
  execFileSync(process.execPath, [join(skill, 'scripts/export.mjs'), '--input', output, '--out', join(scratch, 'media'), '--width', '480'], { stdio: 'inherit' });
  const report = JSON.parse(await readFile(join(scratch, 'media/export.json'), 'utf8'));
  assert.equal(report.themes.dark.frames, report.themes.light.frames);
  assert(report.themes.dark.seamEqual && report.themes.light.transparent);
  console.log(`Browser checks passed: 3 viewports, automatic playback, offscreen pause, reduced motion, ${cases.length} text layouts, two transparent GIF exports.`);
} finally { await browser?.close(); await server?.close(); await rm(scratch, { recursive: true, force: true }); }
