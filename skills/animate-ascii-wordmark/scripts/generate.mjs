#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdir, writeFile, cp, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateText } from '../assets/wordmark.mjs';

const help = `Generate a transparent, automatically looping ASCII wordmark.
Usage: node scripts/generate.mjs --text "Acme" --out /path/to/new-output
Options: --theme dark|light (dark), --seed 71339, --width 820, --help
The output must be a new directory; existing work is never overwritten.`;
try {
  const { values } = parseArgs({ options: { text: { type: 'string' }, out: { type: 'string' }, theme: { type: 'string', default: 'dark' }, seed: { type: 'string', default: '71339' }, width: { type: 'string', default: '820' }, help: { type: 'boolean' } } });
  if (values.help) { console.log(help); process.exit(0); }
  const text = validateText(values.text);
  if (!values.out) throw new Error('--out is required.');
  if (!['dark', 'light'].includes(values.theme)) throw new Error('--theme must be dark or light.');
  const seed = Number(values.seed), width = Number(values.width);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('--seed must be an unsigned 32-bit integer.');
  if (!Number.isInteger(width) || width < 240 || width > 2400) throw new Error('--width must be an integer between 240 and 2400.');
  const out = resolve(values.out);
  try { await access(out); throw new Error(`Output already exists: ${out}. Choose a new directory.`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const config = { text, theme: values.theme, seed, width };
  const escapeHTML = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  await mkdir(out, { recursive: true });
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await cp(join(root, 'assets'), join(out, 'assets'), { recursive: true });
  await writeFile(join(out, 'wordmark.json'), JSON.stringify(config, null, 2) + '\n');
  await writeFile(join(out, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(text)} — ASCII wordmark</title>
<style>
html,body{margin:0;min-height:100%;background:transparent}body{display:grid;place-items:center;min-height:100svh;padding:16px;box-sizing:border-box}main{width:min(100%,${width}px);min-width:0}canvas{display:block;width:100%;height:auto}.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}.error{font:16px system-ui;color:#b52340}noscript{font:clamp(2rem,8vw,6rem) system-ui}
</style></head><body><main><h1 class="sr-only">${escapeHTML(text)}</h1><canvas aria-hidden="true"></canvas><noscript>${escapeHTML(text)}</noscript></main>
<script type="module">
import { mountWordmark } from './assets/wordmark.mjs';
try {
  const config = await (await fetch('./wordmark.json')).json();
  const params = new URLSearchParams(location.search);
  if (params.has('theme')) config.theme = params.get('theme');
  if (params.has('width')) config.width = Number(params.get('width'));
  window.wordmark = await mountWordmark(document.querySelector('canvas'), config, { manual: params.has('manual') });
  window.wordmarkReady = true;
} catch (error) {
  const message = document.createElement('p'); message.className = 'error'; message.textContent = error.message;
  document.querySelector('main').append(message); window.wordmarkError = error.message;
}
</script></body></html>\n`);
  console.log(`Created ${out}\nServe it with: python3 -m http.server 8000 --directory ${JSON.stringify(out)}\nOpen http://localhost:8000. Its background is transparent; preview on both dark and light surfaces.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
