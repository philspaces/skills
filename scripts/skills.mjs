// Repository-only discovery. Installed skills never import this module.
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const excluded = new Set(['.git', '.idea', 'node_modules', '__pycache__', '.tmp', 'tmp', 'output', 'exports', 'coverage', 'test-results', 'playwright-report']);
export async function files(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.isSymbolicLink()) continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) result.push(...await files(path));
    else if (item.isFile()) result.push(path);
  }
  return result.sort();
}
export async function skills() {
  return (await readdir(join(root, 'skills'), { withFileTypes: true }))
    .filter(item => item.isDirectory() && !excluded.has(item.name) && !item.name.startsWith('.'))
    .map(item => ({ name: item.name, path: join(root, 'skills', item.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
