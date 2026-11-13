import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { files, skills } from '../skills.mjs';
test('repository discovery ignores editor caches, generated output and symlinks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-discovery-'));
  try {
    for (const name of ['.idea', '__pycache__', 'node_modules', 'output', 'scripts']) {
      await mkdir(join(dir, name)); await writeFile(join(dir, name, 'example.mjs'), '');
    }
    await symlink(join(dir, 'scripts'), join(dir, 'linked'), 'dir');
    assert.deepEqual((await files(dir)).map(path => relative(dir, path)), ['scripts/example.mjs']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('skill discovery returns sorted installable sibling folders', async () => {
  const found = await skills();
  assert(found.length >= 2);
  assert.deepEqual(found.map(s => s.name), found.map(s => s.name).sort());
  assert(found.every(s => s.path.endsWith(`/skills/${s.name}`)));
});
