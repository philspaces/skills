// Generation needs only Node; full browser/export testing is tests/browser.mjs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'wordmark-installed-'));
try {
  const output = join(scratch, 'site');
  execFileSync(process.execPath, [join(skill, 'scripts/generate.mjs'), '--text', 'Skills', '--out', output]);
  assert.equal(JSON.parse(readFileSync(join(output, 'wordmark.json'))).text, 'Skills');
  assert(existsSync(join(output, 'assets/fonts/geist-latin.woff2')));
  assert(existsSync(join(output, 'assets/fonts/NOTICE.md')));
  console.log('Installed wordmark generator: offline HTML + font assets passed');
} finally { rmSync(scratch, { recursive: true, force: true }); }
