// Run from an independent skills CLI installation, without repo dependencies.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'drawio-installed-'));
try {
  const tool = join(skill, 'scripts/diagram.py');
  const output = join(scratch, 'architecture.drawio');
  execFileSync('python3', [tool, 'build', join(skill, 'examples/model.json'), '--output', output]);
  execFileSync('python3', [tool, 'validate-xml', output]);
  console.log('Installed draw.io generator: build + XML validation passed');
} finally { rmSync(scratch, { recursive: true, force: true }); }
