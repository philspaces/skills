import { spawnSync } from 'node:child_process';
import { files, skills, root } from './skills.mjs';
const mode = process.argv[2] ?? 'unit';
if (!['unit', 'browser'].includes(mode)) throw new Error('Expected unit or browser');
const paths = (await Promise.all((await skills()).map(skill => files(skill.path)))).flat();
paths.push(...await files(`${root}/scripts/tests`));
const tests = paths.filter(path => mode === 'unit' ? /\/tests\/.*\.test\.mjs$/.test(path) : /\/tests\/browser\.mjs$/.test(path));
if (!tests.length) throw new Error(`No ${mode} tests found`);
const batches = mode === 'unit' ? [['--test', ...tests]] : tests.map(path => [path]);
for (const args of batches) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
