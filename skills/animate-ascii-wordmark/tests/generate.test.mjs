import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateText } from '../assets/wordmark.mjs';

const generator = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/generate.mjs');
test('validates supported text without silently replacing unfamiliar scripts', () => {
  assert.equal(validateText('  Cafe\u0301  '), 'Café');
  assert.equal(validateText('Sóng Biển'), 'Sóng Biển');
  for (const text of ['', ' '.repeat(4), 'X'.repeat(41), '你好', 'Brand🚀', '@@@']) assert.throws(() => validateText(text));
});
test('generates an offline bundle and refuses to overwrite existing work', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'wordmark-generate-'));
  try {
    const out = join(temp, 'site');
    const args = [generator, '--text', 'Acme & Co', '--out', out];
    assert.equal(spawnSync(process.execPath, args).status, 0);
    const config = JSON.parse(await readFile(join(out, 'wordmark.json'), 'utf8'));
    assert.equal(config.text, 'Acme & Co');
    const html = await readFile(join(out, 'index.html'), 'utf8');
    assert(html.includes('<h1 class="sr-only">Acme &amp; Co</h1>'));
    assert(!html.includes('https://'));
    assert((await readFile(join(out, 'assets/fonts/geist-latin.woff2'))).length > 1000);
    const before = await readFile(join(out, 'index.html'));
    assert.equal(spawnSync(process.execPath, args).status, 1);
    assert.deepEqual(await readFile(join(out, 'index.html')), before);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
test('rejects invalid CLI values before creating output', () => {
  for (const args of [['--text', 'Acme'], ['--text', 'Acme', '--out', '/unused', '--width', '12'], ['--text', 'Acme', '--out', '/unused', '--theme', 'purple'], ['--text', 'Acme', '--out', '/unused', '--seed', '-1']]) {
    const result = spawnSync(process.execPath, [generator, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert(result.stderr.length > 0);
  }
});
