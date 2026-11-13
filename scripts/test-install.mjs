// Official skills CLI smoke test; never installs into the real user home/project.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, skills, files } from './skills.mjs';
const scratch = await mkdtemp(join(tmpdir(), 'skills-install-'));
const project = join(scratch, 'project');
const home = join(scratch, 'home');
await mkdir(project); await mkdir(home);
const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex'),
  CLAUDE_CONFIG_DIR: join(home, '.claude'), XDG_CONFIG_HOME: join(home, '.config'),
  DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1', NODE_DISABLE_COMPILE_CACHE: '1' };
const cli = process.env.SKILLS_CLI;
if (cli && !isAbsolute(cli)) throw new Error('SKILLS_CLI must be an absolute path to official bin/cli.mjs');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: project, env, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function skillsCLI(args) {
  return cli ? run(process.execPath, [cli, ...args]) : run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', 'skills@1.7.0', ...args]);
}
try {
  console.log(`Official skills CLI: ${skillsCLI(['--version']).trim()}`);
  const available = skillsCLI(['add', root, '--list']);
  for (const skill of await skills()) {
    assert(available.includes(skill.name), `CLI did not discover ${skill.name}`);
    skillsCLI(['add', root, '--skill', skill.name, '--agent', 'codex', '--copy', '--yes']);
    const installed = join(project, '.agents', 'skills', skill.name);
    const sourceFiles = await files(skill.path);
    for (const source of sourceFiles) {
      const copy = join(installed, relative(skill.path, source));
      assert(!(await lstat(copy)).isSymbolicLink(), `Expected independent copy: ${copy}`);
      assert.deepEqual(await readFile(copy), await readFile(source), `Missing/changed resource: ${copy}`);
    }
    console.log(`${skill.name}: discovered and independently copied (${sourceFiles.length} files)`);
    // Small, skill-owned generation smoke tests; no network, browser or cloud calls.
    const smoke = join(installed, 'tests', 'installed.mjs');
    assert(sourceFiles.includes(join(skill.path, 'tests', 'installed.mjs')), `Missing install smoke test: ${skill.name}`);
    console.log(run(process.execPath, [smoke]).trim());
  }
  console.log('All project-scoped CLI installation tests passed; telemetry disabled.');
} finally {
  await rm(scratch, { recursive: true, force: true });
}
