import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(readFileSync(join(skill, 'examples/model.json')));
const script = join(skill, 'scripts/diagram.py');
function check(mutate, expected) {
  const model = structuredClone(base); mutate(model);
  const code = `import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('diagram',sys.argv[1]); m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nm.validate(json.loads(sys.stdin.read()))`;
  const result = spawnSync('python3', ['-B', '-c', code, script], { input: JSON.stringify(model), encoding: 'utf8' });
  if (expected) { assert.notEqual(result.status, 0); assert.match(result.stderr, expected); }
  else assert.equal(result.status, 0, result.stderr);
}
test('valid synthetic evidence model', () => check(() => {}));
test('observed edge needs evidence', () => check(m => m.pages[0].edges[1].evidence = [], /observed items require evidence/));
test('unknown source IDs rejected', () => check(m => m.pages[0].nodes[1].evidence = ['fiction'], /unknown evidence/));
test('dangling endpoint rejected', () => check(m => m.pages[0].edges[1].target = 'missing', /dangling endpoint/));
test('duplicate IDs rejected', () => check(m => m.pages[0].nodes[1].id = 'caller', /IDs must be unique/));
test('inferred flow requires reason', () => check(m => delete m.pages[0].edges[0].reason, /needs reason/));
test('repair cannot masquerade as current architecture', () => check(m => { m.pages[0].edges[0].status = 'proposed'; }, /proposal on as-is/));
test('containment cycle rejected', () => check(m => m.pages[0].groups[0].parent = 'system', /containment cycle/));
test('regional S3 is not physically placed in subnet', () => check(m => m.pages[0].groups[0].kind = 'subnet', /not hosted in a subnet/));
test('fabricated icon rejected', () => check(m => m.pages[0].nodes[1].icon = 'aws:made-up', /unknown icon/));
test('custom icons require verification provenance', () => check(m => m.icons = { custom: { style: 'shape=rectangle;', source: 'a palette' } }, /verifiedWith/));
test('custom icons cannot fetch remote assets', () => check(m => m.icons = { custom: { style: 'shape=image;image=https://example.com/a.svg;', source: 'a palette', verifiedWith: 'draw.io' } }, /local stencils/));
test('defect requires violated constraint', () => check(m => delete m.pages[0].findings[0].constraint, /violated constraint/));
test('finding target must exist', () => check(m => m.pages[0].findings[0].targets = ['missing'], /finding target/));
test('off-canvas content rejected', () => check(m => m.pages[0].nodes[0].x = 1400, /outside parent/));
test('negative geometry rejected', () => check(m => m.pages[0].nodes[0].w = -1, /minimum size/));
test('XML escapes labels and carries findings, evidence and separate pages', () => {
  const dir = mkdtempSync(join(tmpdir(), 'diagram-test-'));
  try {
    const model = structuredClone(base);
    model.pages[0].nodes[0].label = 'Actor <untrusted> & "name"';
    model.pages.push({ ...structuredClone(model.pages[0]), name: 'Proposed', view: 'proposed' });
    const code = `import importlib.util,json,sys\ns=importlib.util.spec_from_file_location('diagram',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nprint(m.build(json.loads(sys.stdin.read())))`;
    const xml = execFileSync('python3', ['-B', '-c', code, script], { input: JSON.stringify(model), encoding: 'utf8' });
    assert.match(xml, /&lt;untrusted&gt; &amp; &quot;name&quot;/);
    assert.match(xml, /resIcon=mxgraph.aws4.lambda/);
    assert.match(xml, /F1: broken/);
    assert.match(xml, /evidence="E2, E3, E4"/);
    assert.equal((xml.match(/<diagram /g) ?? []).length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('copied skill builds without repository packages, validates XML, refuses overwrites', () => {
  const dir = mkdtempSync(join(tmpdir(), 'standalone-diagram-'));
  try {
    cpSync(skill, join(dir, 'skill'), { recursive: true });
    const tool = join(dir, 'skill/scripts/diagram.py');
    const input = join(dir, 'skill/examples/model.json');
    const output = join(dir, 'result.drawio');
    execFileSync('python3', [tool, 'build', input, '--output', output]);
    assert.match(execFileSync('python3', [tool, 'validate-xml', output], { encoding: 'utf8' }), /Valid XML: 1 page/);
    assert.match(readFileSync(join(dir, 'result.md'), 'utf8'), /explicit IAM Deny/);
    const again = spawnSync('python3', [tool, 'build', input, '--output', output], { encoding: 'utf8' });
    assert.notEqual(again.status, 0); assert.match(again.stderr, /output exists/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('committed native example and evidence report match the model and generator', () => {
  const dir = mkdtempSync(join(tmpdir(), 'diagram-snapshot-'));
  try {
    execFileSync('python3', [script, 'build', join(skill, 'examples/model.json'), '--output', join(dir, 'architecture.drawio')]);
    for (const extension of ['drawio', 'md']) {
      assert.equal(readFileSync(join(dir, `architecture.${extension}`), 'utf8'), readFileSync(join(skill, `examples/rendered/architecture.${extension}`), 'utf8'));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
