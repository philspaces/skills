/** One simulation step is one 40 ms animation frame. No browser APIs required. */
export const TICK_MS = 40;

const TONES = ['red', 'blue', 'cyan', 'amber', 'lilac'];
const DIRECTIONS = [{ col: 1, row: 0 }, { col: 0, row: 1 }, { col: -1, row: 0 }, { col: 0, row: -1 }];
const position = ({ col, row }) => ({ col, row });
const key = ({ col, row }) => `${col},${row}`;
const distance = (a, b) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
const visibleBug = bug => ['loose', 'returning', 'parked'].includes(bug.state);
const emptyHome = bug => visibleBug(bug) || bug.state === 'carried';

function randomSequence(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/**
 * Build a seeded repair animation from an array of plain-text silhouette rows.
 * Whitespace is empty; every other Unicode code point occupies one grid cell.
 * bugCount is clamped to the available glyphs. The returned data is detached.
 * Browsers may keep stepping; exporters should stop at the first cycle change.
 */
export function createSimulation(rows, { seed = 71339, bugCount = 8 } = {}) {
  if (!Array.isArray(rows) || !rows.length || rows.some(row => typeof row !== 'string' || /[\r\n\t]/u.test(row))) {
    throw new TypeError('rows must be a nonempty array of single-line strings without tabs');
  }
  if (!Number.isFinite(seed) || !Number.isInteger(bugCount) || bugCount < 0) {
    throw new TypeError('seed must be finite and bugCount must be a nonnegative integer');
  }
  const silhouette = rows.map(row => Array.from(row));
  const columns = Math.max(...silhouette.map(row => row.length));
  const height = silhouette.length;
  const bounds = { minCol: -3, maxCol: columns + 2, minRow: -3, maxRow: height + 2 };
  const inside = cell => cell.col >= bounds.minCol && cell.col <= bounds.maxCol && cell.row >= bounds.minRow && cell.row <= bounds.maxRow;
  const at = cell => silhouette[cell.row]?.[cell.col] ?? ' ';
  const hasGlyph = cell => /\S/u.test(at(cell));
  const glyphs = silhouette.flatMap((row, rowIndex) => row.flatMap((letter, col) => /\S/u.test(letter) ? [{ col, row: rowIndex, letter }] : []));
  if (!glyphs.length) throw new TypeError('rows must contain at least one non-whitespace glyph');
  const random = randomSequence(seed);
  const between = (min, max) => min + Math.floor(random() * (max - min + 1));
  const neighbors = cell => DIRECTIONS.map(delta => ({ col: cell.col + delta.col, row: cell.row + delta.row })).filter(inside);

  // Take one seeded sample from each horizontal slice, including sparse shapes.
  const count = Math.min(bugCount, glyphs.length);
  const orderedGlyphs = [...glyphs].sort((a, b) => a.col - b.col || a.row - b.row);
  const homes = Array.from({ length: count }, (_, id) => {
    const slice = orderedGlyphs.slice(Math.floor(id * glyphs.length / count), Math.floor((id + 1) * glyphs.length / count));
    const edge = slice.filter(cell => neighbors(cell).some(next => !hasGlyph(next)));
    const pool = edge.length ? edge : slice;
    const home = pool[between(0, pool.length - 1)];
    return { id, home: position(home), letter: home.letter, tone: TONES[id % TONES.length] };
  });

  // Ambient glyphs live on the outside edge, leaving the inner halo navigable.
  const perimeter = [];
  for (let col = bounds.minCol; col <= bounds.maxCol; col++) perimeter.push({ col, row: bounds.minRow });
  for (let row = bounds.minRow + 1; row <= bounds.maxRow; row++) perimeter.push({ col: bounds.maxCol, row });
  for (let col = bounds.maxCol - 1; col >= bounds.minCol; col--) perimeter.push({ col, row: bounds.maxRow });
  for (let row = bounds.maxRow - 1; row > bounds.minRow; row--) perimeter.push({ col: bounds.minCol, row });
  const ambientCount = Math.min(14, Math.max(6, Math.ceil(columns / 5)));
  const ambient = Array.from({ length: ambientCount }, (_, id) => ({
    ...perimeter[Math.floor(id * perimeter.length / ambientCount)],
    letter: ['+', ':', 'x', '~', '*', ';', '{', '}'][id % 8], tone: TONES[id % TONES.length],
  }));
  const ambientKeys = new Set(ambient.map(key));

  const center = { col: Math.floor((columns - 1) / 2), row: Math.floor((height - 1) / 2) };
  const clearCells = [];
  for (let row = -1; row <= height; row++) for (let col = -1; col <= columns; col++) {
    const cell = { col, row };
    if (!hasGlyph(cell)) clearCells.push(cell);
  }
  clearCells.sort((a, b) => distance(a, center) - distance(b, center) || a.row - b.row || a.col - b.col);
  const playerStart = position(clearCells[0]);
  const player = position(playerStart);

  // At most three parked starting cells cannot enclose a cell on their own.
  const initialCount = Math.min(3, Math.ceil(count * 3 / 8));
  const initialIds = new Set(Array.from({ length: initialCount }, (_, index) => Math.floor(index * count / initialCount)));
  const starts = [];
  for (let col = -2; col <= columns + 1; col++) {
    starts.push({ col, row: -2 }, { col, row: height + 1 });
  }
  for (let row = -1; row <= height; row++) starts.push({ col: -2, row }, { col: columns + 1, row });
  const reservedStarts = new Set();
  const bugs = homes.map(home => {
    const initial = initialIds.has(home.id);
    let start = position(home.home);
    if (initial) {
      const candidates = starts.filter(cell => !reservedStarts.has(key(cell)) && distance(cell, playerStart) > 1);
      candidates.sort((a, b) => distance(a, home.home) - distance(b, home.home));
      start = position(candidates[between(0, Math.min(5, candidates.length - 1))]);
      reservedStarts.add(key(start));
    }
    return {
      ...home, ...start, start, group: initial ? 'initial' : 'additional',
      state: initial ? 'loose' : 'waiting', repairs: 0,
      nextMove: 0, burst: 0, wake: 0, departed: initial,
    };
  });

  let tick = 0;
  let cycle = 0;
  let phase = 'boundary';
  let boundaryUntil = 12;
  let nextPlayerMove = 0;
  let playerBurst = 8;
  let nextWake = 0;
  let target;
  let carried;
  let steppingAway = false;

  const occupied = (cell, except) => ambientKeys.has(key(cell)) || bugs.some(bug => bug !== except && visibleBug(bug) && distance(bug, cell) === 0);
  const reservedForAnother = (cell, bug) => reservedStarts.has(key(cell)) && distance(cell, bug.start) !== 0;

  // Breadth-first search is bounded by the finite grid. It handles parked bugs
  // and detours without greedy oscillation or an arbitrary iteration cutoff.
  function nextStep(from, destination, except, avoidPlayer = false) {
    if (distance(from, destination) === 0) return undefined;
    const blocked = cell => occupied(cell, except) || (avoidPlayer && (
      distance(cell, player) === 0 || distance(cell, playerStart) === 0 || reservedForAnother(cell, except)
    ));
    const queue = [{ ...from, first: undefined }];
    const seen = new Set([key(from)]);
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      const options = neighbors(current).sort((a, b) => distance(a, destination) - distance(b, destination));
      for (const cell of options) {
        if (seen.has(key(cell)) || blocked(cell)) continue;
        const first = current.first ?? cell;
        if (distance(cell, destination) === 0) return first;
        seen.add(key(cell));
        queue.push({ ...cell, first });
      }
    }
    return undefined;
  }

  function movePlayer(destination, except) {
    const next = nextStep(player, destination, except);
    if (next) Object.assign(player, next);
  }

  function wander(bug) {
    const choices = neighbors(bug).filter(cell =>
      distance(cell, player) !== 0 && distance(cell, playerStart) !== 0 &&
      distance(cell, bug.home) !== 0 && distance(cell, bug.home) <= 8 &&
      !reservedForAnother(cell, bug) && !occupied(cell, bug),
    );
    const open = choices.filter(cell => !hasGlyph(cell));
    const pool = open.length && random() < 0.7 ? open : choices;
    if (pool.length) {
      Object.assign(bug, pool[between(0, pool.length - 1)]);
      bug.departed = true;
    }
    if (--bug.burst > 0) bug.nextMove = tick + between(2, 4);
    else { bug.burst = between(1, 3); bug.nextMove = tick + between(8, 24); }
  }

  function stepPlayer() {
    if (steppingAway) {
      const choices = neighbors(player).filter(cell => !occupied(cell) && !reservedStarts.has(key(cell)));
      const exit = choices.find(cell => !hasGlyph(cell)) ?? choices[0];
      if (exit) { Object.assign(player, exit); steppingAway = false; }
    } else if (carried) {
      movePlayer(carried.home, carried);
      Object.assign(carried, position(player));
      if (distance(player, carried.home) === 0) {
        carried.state = 'restored';
        carried.repairs++;
        carried = undefined;
        steppingAway = true;
        playerBurst = 2;
      }
    } else if (phase === 'return-home') {
      movePlayer(playerStart);
    } else {
      const group = phase === 'repair-initial' ? 'initial' : 'additional';
      if (!target || target.state !== 'loose' || target.group !== group) {
        target = bugs.filter(bug => bug.state === 'loose' && bug.group === group && bug.departed)
          .sort((a, b) => distance(player, a) - distance(player, b))[0];
      }
      if (target) {
        movePlayer(target, target);
        if (distance(player, target) === 0) {
          target.state = 'carried'; carried = target; target = undefined;
        }
      } else {
        // Clear returning bugs' destinations even while waiting for the next
        // departure, or for the last initial glyph to finish its journey.
        movePlayer(playerStart);
      }
    }
    if (--playerBurst > 0) nextPlayerMove = tick + 1;
    else { playerBurst = between(7, 13); nextPlayerMove = tick + between(2, 5); }
  }

  function snapshot() {
    return {
      tick, cycle, phase, columns, rows: height, bounds: { ...bounds },
      player: { ...player, ...(carried ? { carrying: carried.id } : {}) },
      bugs: bugs.map(({ id, col, row, home, start, group, letter, tone, state, repairs }) => ({
        id, col, row, home: position(home), start: position(start), group, letter, tone, state, repairs,
      })),
      ambient: ambient.map(cell => ({ ...cell })),
      repairCount: bugs.reduce((total, bug) => total + bug.repairs, 0),
    };
  }

  function cells({ static: staticFrame = false } = {}) {
    const empty = new Set(staticFrame ? [] : bugs.filter(emptyHome).map(bug => key(bug.home)));
    const composed = new Map();
    for (const cell of glyphs) if (!empty.has(key(cell))) composed.set(key(cell), { ...cell, tone: 'base', kind: 'base' });
    for (const cell of ambient) composed.set(key(cell), { ...cell, kind: 'ambient' });
    if (!staticFrame) {
      for (const bug of bugs) if (visibleBug(bug)) composed.set(key(bug), { ...position(bug), letter: bug.letter, tone: bug.tone, kind: 'bug' });
      composed.set(key(player), { ...player, letter: '@', tone: carried?.tone ?? 'player', kind: 'player' });
    }
    return [...composed.values()].sort((a, b) => a.row - b.row || a.col - b.col);
  }

  function step() {
    tick++;
    if (phase === 'boundary') {
      if (tick >= boundaryUntil) {
        phase = 'repair-initial';
        nextPlayerMove = tick + 1;
        playerBurst = between(7, 13);
        nextWake = tick + between(4, 8);
        for (const bug of bugs) { bug.burst = between(1, 3); bug.nextMove = tick + between(3, 12); }
      }
      return snapshot();
    }
    if (phase !== 'return-home' && tick >= nextWake) {
      const bug = bugs.find(candidate => candidate.group === 'additional' && candidate.state === 'waiting' &&
        distance(player, candidate.home) !== 0 && !occupied(candidate.home));
      if (bug) {
        bug.state = 'loose'; bug.nextMove = tick + between(2, 4);
        nextWake = tick + between(5, 10);
      }
    }
    for (const bug of bugs) {
      if (bug.state === 'loose' && tick >= bug.nextMove) wander(bug);
      if (phase === 'repair-additional' && bug.group === 'initial' && bug.state === 'restored' &&
          tick >= bug.wake && distance(player, bug.home) !== 0 && !occupied(bug.home, bug)) {
        bug.state = 'returning'; bug.nextMove = tick + between(2, 4);
      }
      if (bug.state === 'returning' && tick >= bug.nextMove) {
        const next = nextStep(bug, bug.start, bug, true);
        if (next) Object.assign(bug, next);
        bug.nextMove = tick + between(2, 4);
        if (distance(bug, bug.start) === 0) bug.state = 'parked';
      }
    }
    if (tick >= nextPlayerMove) stepPlayer();
    if (phase === 'repair-initial' && bugs.filter(bug => bug.group === 'initial').every(bug => bug.state === 'restored')) {
      phase = 'repair-additional';
      bugs.filter(bug => bug.group === 'initial').forEach((bug, index) => { bug.wake = tick + between(8, 18) + index * 4; });
    }
    if (phase === 'repair-additional' && bugs.every(bug => bug.group === 'initial' ? bug.state === 'parked' : bug.state === 'restored')) {
      phase = 'return-home'; target = undefined;
    }
    if (phase === 'return-home' && distance(player, playerStart) === 0 && !steppingAway) {
      // Positions and colors already match the opening frame. Only invisible
      // bookkeeping changes here: there is no reset, teleport, or crossfade.
      cycle++; phase = 'boundary'; boundaryUntil = tick + 12;
      for (const bug of bugs) {
        bug.state = bug.group === 'initial' ? 'loose' : 'waiting';
        bug.departed = bug.group === 'initial';
      }
    }
    return snapshot();
  }

  return { step, snapshot, cells };
}
