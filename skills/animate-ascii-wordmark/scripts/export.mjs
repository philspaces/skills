#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const help = `Export one closed animation cycle as transparent GIFs and static PNGs.
Usage: node scripts/export.mjs --input /path/to/generated --out /path/to/new-media
Options: --theme dark|light|both (both), --width 820, --max-seconds 90, --help
Requires Playwright Chromium and FFmpeg on PATH. Output must not already exist.`;
let browser, server, scratch;
try {
  const { values } = parseArgs({ options: { input: { type: 'string' }, out: { type: 'string' }, theme: { type: 'string', default: 'both' }, width: { type: 'string', default: '820' }, 'max-seconds': { type: 'string', default: '90' }, help: { type: 'boolean' } } });
  if (values.help) { console.log(help); process.exit(0); }
  if (!values.input || !values.out) throw new Error('--input and --out are required.');
  if (!['dark', 'light', 'both'].includes(values.theme)) throw new Error('--theme must be dark, light or both.');
  const width = Number(values.width), limit = Number(values['max-seconds']);
  if (!Number.isInteger(width) || width < 240 || width > 2400) throw new Error('--width must be an integer between 240 and 2400.');
  if (!Number.isFinite(limit) || limit < 1 || limit > 300) throw new Error('--max-seconds must be between 1 and 300.');
  const input = resolve(values.input), out = resolve(values.out);
  const config = JSON.parse(await readFile(join(input, 'wordmark.json'), 'utf8'));
  try { await access(out); throw new Error(`Output already exists: ${out}. Choose a new directory.`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { throw new Error('FFmpeg is required for GIF export. Install it, then retry.'); }
  scratch = await mkdtemp(join(tmpdir(), 'ascii-wordmark-'));
  server = await serve(input);
  browser = await chromium.launch();
  await mkdir(out, { recursive: true });
  const result = { text: config.text, seed: config.seed, fps: 25, themes: {} };
  for (const theme of values.theme === 'both' ? ['dark', 'light'] : [values.theme]) {
    const page = await browser.newPage({ viewport: { width: width + 32, height: 1000 }, deviceScaleFactor: 1 });
    await page.goto(`${server.url}/?manual&theme=${theme}&width=${width}`);
    await page.waitForFunction(() => window.wordmarkReady || window.wordmarkError);
    const error = await page.evaluate(() => window.wordmarkError);
    if (error) throw new Error(error);
    const capture = () => page.evaluate(() => window.wordmark.canvas.toDataURL('image/png').split(',')[1]);
    const frames = join(scratch, theme); await mkdir(frames);
    const first = await capture();
    let count = 0, closed = false;
    while (count < Math.ceil(limit * 25)) {
      await writeFile(join(frames, `${String(count).padStart(5, '0')}.png`), Buffer.from(count === 0 ? first : await capture(), 'base64'));
      count++;
      const state = await page.evaluate(() => window.wordmark.step());
      if (state.cycle > 0) { closed = true; break; }
    }
    if (!closed) throw new Error(`No closed loop within ${limit}s. Inspect the simulation; do not trim or teleport to fake a seam.`);
    if (await capture() !== first) throw new Error('The loop boundary differs from its opening frame. Export stopped.');
    const dimensions = await page.evaluate(() => ({ width: window.wordmark.canvas.width, height: window.wordmark.canvas.height }));
    await page.evaluate(() => window.wordmark.render({ static: true }));
    const staticName = `wordmark-${theme}-static.png`, gifName = `wordmark-${theme}.gif`;
    await writeFile(join(out, staticName), Buffer.from(await capture(), 'base64'));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-framerate', '25', '-i', join(frames, '%05d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=128:stats_mode=diff:reserve_transparent=1[p];[b][p]paletteuse=dither=none:diff_mode=rectangle:alpha_threshold=128', '-loop', '0', '-y', join(out, gifName)], { stdio: 'pipe' });
    // Validate decoded output, not merely the GIF transparency flag. This catches trails/disposal errors.
    const samples = [...new Set([0, 1, Math.floor(count / 2), count - 1])];
    for (const index of samples) {
      const common = ['-hide_banner', '-loglevel', 'error'];
      const source = execFileSync('ffmpeg', [...common, '-i', join(frames, `${String(index).padStart(5, '0')}.png`), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 32 * 1024 * 1024 });
      const decoded = execFileSync('ffmpeg', [...common, '-i', join(out, gifName), '-vf', `select=eq(n\\,${index})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 32 * 1024 * 1024 });
      if (source.length !== decoded.length) throw new Error(`Decoded GIF dimensions mismatch at frame ${index}.`);
      let clearPixels = 0;
      for (let offset = 3; offset < source.length; offset += 4) {
        if ((source[offset] >= 128) !== (decoded[offset] >= 128)) throw new Error(`GIF alpha mismatch at frame ${index}; possible trails or opaque background.`);
        if (!decoded[offset]) clearPixels++;
      }
      if (clearPixels < dimensions.width * dimensions.height / 2) throw new Error('Expected a sparse transparent canvas; most pixels are opaque.');
    }
    result.themes[theme] = { gif: gifName, staticPng: staticName, ...dimensions, frames: count, durationMs: count * 40, seamEqual: true, transparent: true, verifiedAlphaFrames: samples, bytes: (await readFile(join(out, gifName))).length };
    console.log(`${theme}: ${count} frames, ${(count / 25).toFixed(2)}s; seamless boundary and decoded alpha verified.`);
    await page.close();
  }
  await writeFile(join(out, 'export.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`Exported ${out}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await browser?.close(); await server?.close(); if (scratch) await rm(scratch, { recursive: true, force: true }); }
