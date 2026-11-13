import { readFile, access, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { root, files, skills } from './skills.mjs';
let count = 0;
const catalog = await readFile(join(root, 'README.md'), 'utf8');
for (const directory of await skills()) {
  const path = join(root, 'skills', directory.name, 'SKILL.md');
  const text = await readFile(path, 'utf8');
  const frontmatter = text.match(/^---\n([\s\S]+?)\n---\n/);
  if (!frontmatter) throw new Error(`Missing frontmatter: ${path}`);
  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.replace(/^['"]|['"]$/g, '');
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1];
  if (name !== directory.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) throw new Error(`Invalid skill name: ${path}`);
  if (!description || description.length > 1024 || /\bTODO\b/.test(text)) throw new Error(`Incomplete description or instructions: ${path}`);
  await access(join(directory.path, 'LICENSE'));
  const metadata = await readFile(join(directory.path, 'agents/openai.yaml'), 'utf8');
  for (const key of ['display_name', 'short_description', 'default_prompt']) {
    if (!new RegExp(`^  ${key}:\\s*\\S`, 'm').test(metadata)) throw new Error(`Missing ${key}: ${directory.name}`);
  }
  await access(join(directory.path, 'tests/installed.mjs'));
  if (!catalog.includes(directory.name)) throw new Error(`Missing catalog entry: ${directory.name}`);
  count++;
}
const maintained = (await Promise.all(['skills', 'scripts', 'examples', '.github'].map(dir => files(join(root, dir))))).flat();
for (const item of await readdir(root, { withFileTypes: true })) {
  if (item.isFile()) maintained.push(join(root, item.name));
}
for (const path of maintained) {
  if (path.endsWith('.json')) JSON.parse(await readFile(path, 'utf8'));
  if (path.endsWith('.mjs')) execFileSync(process.execPath, ['--check', path]);
  if (path.endsWith('.py')) execFileSync('python3', ['-c', 'import ast,sys; ast.parse(open(sys.argv[1]).read(), filename=sys.argv[1])', path]);
  if (!path.endsWith('.md')) continue;
  const text = await readFile(path, 'utf8');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    const link = match[1];
    if (/^(?:[a-z]+:|#)/i.test(link)) continue;
    await access(resolve(dirname(path), link.split('#')[0]));
  }
}
for (const theme of ['dark', 'light']) for (const suffix of ['.gif', '-static.png']) await access(join(root, `examples/skills/media/wordmark-${theme}${suffix}`));
console.log(`Checked ${count} skill(s), JavaScript/Python syntax, Markdown links, and catalog example assets.`);
