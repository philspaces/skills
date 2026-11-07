import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, TICK_MS } from '../assets/engine.mjs';

const key = cell => `${cell.col},${cell.row}`;
const distance = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
const visible = bug => ['loose', 'returning', 'parked'].includes(bug.state);
const shapes = [
  { name: 'single glyph', rows: ['A'], seed: 1 },
  { name: 'narrow vertical shape', rows: ['X', 'X', 'X', 'X', 'X'], seed: 71339 },
  { name: 'short sparse shape', rows: ['x  x', ' xx ', 'x  x'], seed: 42 },
  { name: 'wordmark', rows: ['XX   X X  XXX', 'X X  XXX  X  ', 'XX   X X  XXX'], seed: 71339 },
  { name: 'long sparse shape', rows: [`X${' '.repeat(105)}X`, ` ${'ab  '.repeat(26)} `], seed: 4294967295 },
  { name: 'dense shape', rows: Array(8).fill('ABCDEFGHIJKLMNOP'), seed: 1001 },
];

test('40 ms clock, validated rows, and glyph count clamping', () => {
  assert.equal(TICK_MS, 40);
  assert.throws(() => createSimulation([]), /rows/);
  assert.throws(() => createSimulation(['  ']), /glyph/);
  assert.throws(() => createSimulation(['a\nb']), /single-line/);
  assert.throws(() => createSimulation(['a\tb']), /tabs/);
  assert.throws(() => createSimulation(['a'], { bugCount: -1 }), /bugCount/);
  assert.throws(() => createSimulation(['a'], { seed: NaN }), /seed/);
  const simulation = createSimulation(['é中']);
  assert.equal(simulation.snapshot().columns, 2);
  assert.equal(simulation.snapshot().bugs.length, 2);
  assert.equal(simulation.step().tick, 1);
});

test('identical seeds produce identical independent simulations', () => {
  const rows = shapes[3].rows;
  const first = createSimulation(rows, { seed: 8080 });
  const second = createSimulation(rows, { seed: 8080 });
  for (let frame = 0; frame < 800; frame++) {
    assert.deepEqual(first.step(), second.step());
    assert.deepEqual(first.cells(), second.cells());
  }
  assert.notDeepEqual(createSimulation(rows, { seed: 2 }).snapshot(), createSimulation(rows, { seed: 3 }).snapshot());
});

test('static cells preserve every original glyph and exclude the player and bugs', () => {
  const rows = ['A . B', '  C  '];
  const simulation = createSimulation(rows);
  const staticCells = simulation.cells({ static: true });
  assert.deepEqual(staticCells.filter(cell => cell.kind === 'base').map(({ col, row, letter }) => ({ col, row, letter })), [
    { col: 0, row: 0, letter: 'A' }, { col: 2, row: 0, letter: '.' },
    { col: 4, row: 0, letter: 'B' }, { col: 2, row: 1, letter: 'C' },
  ]);
  assert.ok(staticCells.every(cell => ['base', 'ambient'].includes(cell.kind)));
  for (let frame = 0; frame < 100; frame++) simulation.step();
  assert.deepEqual(simulation.cells({ static: true }), staticCells);
});

test('returned snapshots and cells cannot mutate simulation state', () => {
  const simulation = createSimulation(['abc']);
  const before = simulation.snapshot();
  const copy = simulation.snapshot();
  copy.player.col = 200;
  copy.bugs[0].home.col = 200;
  copy.bugs[0].start.row = 200;
  copy.bounds.minCol = 200;
  copy.ambient[0].letter = '?';
  simulation.cells()[0].letter = '?';
  assert.deepEqual(simulation.snapshot(), before);
});

for (const { name, rows, seed } of shapes) test(`${name}: physical repairs and three identical visible seams`, () => {
  const simulation = createSimulation(rows, { seed });
  const opening = simulation.cells();
  let previous = simulation.snapshot();
  const original = previous;
  const catches = new Set();
  const transported = new Set();
  const restored = new Set();
  const returning = new Set();
  let maximumLoose = 0;
  let playerMoves = 0;
  let playerRests = 0;
  let bugMoves = 0;
  const budget = 3000 + previous.columns * 100 + previous.rows * 100;
  for (let frame = 0; frame < budget && previous.cycle < 3; frame++) {
    const current = simulation.step();
    assert.equal(current.tick, previous.tick + 1);
    const movement = distance(previous.player, current.player);
    assert.ok(movement <= 1, 'player moves at most one orthogonal cell');
    if (movement) playerMoves++; else playerRests++;
    const rendered = simulation.cells();
    assert.equal(new Set(rendered.map(key)).size, rendered.length, 'one rendered glyph per cell for alpha-safe exports');
    const activeBugs = current.bugs.filter(visible);
    assert.equal(new Set(activeBugs.map(key)).size, activeBugs.length, 'visible bugs never overlap each other');
    assert.ok(activeBugs.every(bug => distance(bug, current.player) > 0), 'only a carried bug shares the player position');
    maximumLoose = Math.max(maximumLoose, current.bugs.filter(bug => bug.state === 'loose').length);
    const allPositions = [current.player, ...current.bugs, ...rendered];
    for (const cell of allPositions) {
      assert.ok(cell.col >= current.bounds.minCol && cell.col <= current.bounds.maxCol);
      assert.ok(cell.row >= current.bounds.minRow && cell.row <= current.bounds.maxRow);
    }
    for (const bug of current.bugs) {
      const before = previous.bugs[bug.id];
      const moved = distance(before, bug);
      assert.ok(moved <= 1, `bug ${bug.id} moves at most one orthogonal cell`);
      if (moved && before.state !== 'carried') bugMoves++;
      if (visible(bug) || bug.state === 'carried') {
        assert.ok(!rendered.some(cell => cell.kind === 'base' && key(cell) === key(bug.home)), 'displaced glyph leaves a real hole');
      }
      if (bug.state === 'carried') {
        catches.add(bug.id);
        assert.equal(current.player.carrying, bug.id);
        assert.equal(distance(bug, current.player), 0);
        assert.equal(rendered.find(cell => cell.kind === 'player').tone, bug.tone);
        if (before.state === 'carried' && moved) transported.add(bug.id);
      }
      if (bug.repairs > before.repairs) {
        restored.add(bug.id);
        assert.equal(before.state, 'carried');
        assert.equal(bug.state, 'restored');
        assert.equal(distance(bug, bug.home), 0);
      }
      if (bug.state === 'returning' && moved) returning.add(bug.id);
      if (bug.state === 'parked') assert.equal(distance(bug, bug.start), 0);
    }
    if (current.cycle > previous.cycle) {
      assert.equal(current.cycle, previous.cycle + 1);
      assert.equal(current.phase, 'boundary');
      assert.deepEqual(simulation.cells(), opening, 'cycle changes only after an exact visible return to the opening frame');
      assert.equal(distance(current.player, original.player), 0);
      assert.equal(current.repairCount, current.bugs.length * current.cycle);
    }
    previous = current;
  }
  assert.equal(previous.cycle, 3, `completed three cycles within ${budget} ticks`);
  assert.equal(catches.size, original.bugs.length);
  assert.equal(transported.size, original.bugs.length);
  assert.equal(restored.size, original.bugs.length);
  assert.equal(returning.size, original.bugs.filter(bug => bug.group === 'initial').length);
  assert.ok(playerMoves > 0 && playerRests > 0 && bugMoves > 0, 'movement includes bursts, rests, and independently moving bugs');
  if (original.bugs.length > 1) assert.ok(maximumLoose > 1, 'several bugs move at once');
});

test('a zero-bug simulation remains well-defined', () => {
  const simulation = createSimulation(['ABC'], { bugCount: 0 });
  const opening = simulation.cells();
  for (let frame = 0; frame < 50; frame++) simulation.step();
  assert.ok(simulation.snapshot().cycle >= 1);
  assert.equal(simulation.snapshot().repairCount, 0);
  assert.deepEqual(simulation.cells(), opening);
});
