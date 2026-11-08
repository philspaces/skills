import { readdir, readFile, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
async function files(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(item.name)) continue;
    const path = join(directory, item.name);
    result.push(...(item.isDirectory() ? await files(path) : [path]));
  }
  return result;
}
for (const directory of await readdir(join(root, 'skills'), { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  const path = join(root, 'skills', directory.name, 'SKILL.md');
  const text = await readFile(path, 'utf8');
  const frontmatter = text.match(/^---\n([\s\S]+?)\n---\n/);
  if (!frontmatter) throw new Error(`Missing frontmatter: ${path}`);
  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.replace(/^['"]|['"]$/g, '');
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1];
  if (name !== directory.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) throw new Error(`Invalid skill name: ${path}`);
  if (!description || description.length > 1024 || /\bTODO\b/.test(text)) throw new Error(`Incomplete description or instructions: ${path}`);
  count++;
}
for (const path of await files(root)) {
  if (path.endsWith('.mjs')) execFileSync(process.execPath, ['--check', path]);
  if (!path.endsWith('.md')) continue;
  const text = await readFile(path, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    const link = match[1];
    if (/^(?:[a-z]+:|#)/i.test(link)) continue;
    await access(resolve(dirname(path), link.split('#')[0]));
  }
}
for (const theme of ['dark', 'light']) for (const suffix of ['.gif', '-static.png']) await access(join(root, `examples/skills/media/wordmark-${theme}${suffix}`));
console.log(`Checked ${count} skill(s), JavaScript syntax, Markdown links, and catalog example assets.`);
