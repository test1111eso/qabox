import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from '../worker/src/index.js';
import { RETENTION_MS, applyAction, completedLines, createRoom, isExpired } from '../worker/src/bingo-engine.js';

// Execute the production SQL and triggers against SQLite, rather than mocking
// membership locks or optimistic writes. Only the D1 transport is adapted.
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY, display_name TEXT, is_active INTEGER);
    CREATE TABLE sessions(token TEXT, user_id INTEGER, expires_at TEXT);`);
  sql.exec(readFileSync(new URL('../worker/migrations/0001_bingo.sql', import.meta.url), 'utf8'));
  for (let id = 1; id <= 10; id++) {
    sql.prepare('INSERT INTO users VALUES (?, ?, 1)').run(id, `同事${id}`);
    sql.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(`token${id}`, id, '2999-01-01T00:00:00.000Z');
  }
  const DB = {
    prepare(query) {
      const statement = sql.prepare(query);
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return statement.get(...args) ?? null; },
        async all() { return { results: statement.all(...args) }; },
        async run() { return { meta: { changes: statement.run(...args).changes } }; },
      };
    },
  };
  async function api(userId, path, input, method = input === undefined ? 'GET' : 'POST') {
    const response = await worker.fetch(new Request(`https://test.local/api/bingo/${path}`, {
      method,
      headers: { Authorization: `Bearer token${userId}`, 'Content-Type': 'application/json' },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    }), { DB }, {});
    return { status: response.status, data: await response.json() };
  }
  async function create(id = 1) {
    const response = await api(id, 'rooms', {});
    assert.equal(response.status, 201, JSON.stringify(response.data));
    return response.data.room;
  }
  async function action(id, room, verb, extra = {}) {
    const response = await api(id, `rooms/${room.code}/${verb}`, { version: room.version, ...extra });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.room;
  }
  async function start(ids = [1, 2]) {
    let room = await create(ids[0]);
    for (const id of ids.slice(1)) room = await action(id, room, 'join');
    for (const id of ids) room = await action(id, room, 'ready', { ready: true });
    return action(ids[0], room, 'start');
  }
  const raw = code => JSON.parse(sql.prepare('SELECT state FROM bingo_rooms WHERE code = ?').get(code).state);
  function save(room) {
    sql.prepare('UPDATE bingo_rooms SET state = ?, version = ?, status = ?, ended_at = ? WHERE code = ?')
      .run(JSON.stringify(room), room.version, room.status, room.endedAt, room.code);
  }
  return { sql, DB, api, create, action, start, raw, save };
}

test('auth rejects unknown, expired, and disabled users', async () => {
  const f = fixture();
  assert.equal((await f.api(99, 'current')).status, 401);
  f.sql.prepare('UPDATE users SET is_active = 0 WHERE id = 1').run();
  assert.equal((await f.api(1, 'rooms', {})).status, 401);
  f.sql.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = 2').run('2000-01-01');
  assert.equal((await f.api(2, 'current')).status, 401);
});

test('parallel creates cannot reserve the same user twice and roll back the losing room', async () => {
  const f = fixture();
  const results = await Promise.all([f.api(1, 'rooms', {}), f.api(1, 'rooms', {})]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM bingo_rooms').get().n, 1);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM bingo_active_members').get().n, 1);
});

test('waiting membership is exclusive across rooms; failed join rolls back snapshot and locks', async () => {
  const f = fixture();
  const first = await f.create(1);
  const second = await f.create(2);
  assert.equal((await f.api(1, `rooms/${second.code}/join`, {})).status, 409);
  assert.equal(f.raw(second.code).players.length, 1);
  assert.equal((await f.api(1, 'current')).data.room.code, first.code);
  assert.equal((await f.api(2, 'current')).data.room.code, second.code);
  await f.action(1, first, 'leave');
  assert.equal((await f.api(1, 'current')).data.room, null);
  const joined = await f.action(1, second, 'join');
  assert.equal(joined.players.length, 2);
});

test('two simultaneous joins for the last seat accept at most one', async () => {
  const f = fixture();
  let room = await f.create();
  for (let id = 2; id <= 5; id++) room = await f.action(id, room, 'join');
  const results = await Promise.all([6, 7].map(id => f.api(id, `rooms/${room.code}/join`, {})));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(f.raw(room.code).players.length, 6);
  const loser = results[0].status === 409 ? 6 : 7;
  assert.equal((await f.api(loser, `rooms/${room.code}/join`, {})).status, 409);
});

test('start requires host, two players, full readiness and a current room version', async () => {
  const f = fixture();
  let room = await f.create();
  assert.equal((await f.api(1, `rooms/${room.code}/start`, { version: room.version })).status, 409);
  room = await f.action(2, room, 'join');
  assert.equal((await f.api(2, `rooms/${room.code}/start`, { version: room.version })).status, 403);
  room = await f.action(1, room, 'ready', { ready: true });
  const stale = room.version;
  room = await f.action(2, room, 'ready', { ready: true });
  assert.equal((await f.api(1, `rooms/${room.code}/start`, { version: stale })).status, 409);
  room = await f.action(1, room, 'start');
  assert.equal(room.status, 'playing');
  assert.equal((await f.api(3, `rooms/${room.code}/join`, {})).status, 409);
});

test('boards persist across reads, contain 25 unique numbers in 1..100, and are private', async () => {
  const f = fixture();
  const room = await f.start([1, 2, 3]);
  for (const player of f.raw(room.code).players) {
    assert.equal(player.board.length, 25);
    assert.equal(new Set(player.board).size, 25);
    assert.ok(player.board.every(number => number >= 1 && number <= 100));
    const restored = (await f.api(player.id, 'current')).data.room;
    assert.deepEqual(restored.players.find(p => p.id === player.id).board, player.board);
    assert.ok(restored.players.filter(p => p.id !== player.id).every(p => !('board' in p) && !('lines' in p)));
  }
  assert.equal((await f.api(4, `rooms/${room.code}`)).status, 403);
});

test('wrong player and stale/parallel requests cannot draw extra numbers', async () => {
  const f = fixture();
  const room = await f.start();
  const other = room.order.find(id => id !== room.turnId);
  assert.equal((await f.api(other, `rooms/${room.code}/draw`, { version: room.version, requestId: crypto.randomUUID() })).status, 409);
  const requests = [1, 2].map(() => f.api(room.turnId, `rooms/${room.code}/draw`, { version: room.version, requestId: crypto.randomUUID() }));
  assert.deepEqual((await Promise.all(requests)).map(result => result.status).sort(), [200, 409]);
  assert.equal(f.raw(room.code).draws.length, 1);
});

test('replayed draw is idempotent even after the turn comes around again', async () => {
  const f = fixture();
  const original = await f.start();
  const requestId = crypto.randomUUID();
  let room = await f.action(original.turnId, original, 'draw', { requestId });
  assert.equal('requestId' in room.draws[0], false);
  room = await f.action(room.turnId, room, 'draw', { requestId: crypto.randomUUID() });
  assert.equal(room.turnId, original.turnId);
  const retry = await f.api(original.turnId, `rooms/${room.code}/draw`, { version: original.version, requestId });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.room.draws.length, 2);
  assert.equal(f.raw(room.code).draws.length, 2);
});

test('lines count rows, columns, and both diagonals without any free square', () => {
  const board = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.equal(completedLines(board, []).length, 0);
  assert.equal(completedLines(board, [1, 7, 13, 19, 25]).length, 1);
  assert.equal(completedLines(board, [5, 9, 13, 17, 21]).length, 1);
  assert.equal(completedLines(board, board).length, 12);
});

test('a draw marks everyone including the drawer; simultaneous >=5 lines are joint wins', async () => {
  const f = fixture();
  const started = await f.start();
  const raw = f.raw(started.code);
  raw.players.forEach(player => { player.board = Array.from({ length: 25 }, (_, i) => i + 1); });
  // Four complete rows. The next draw in the fifth row must add a fifth line.
  raw.draws = Array.from({ length: 100 }, (_, i) => i + 1).filter(number => number <= 20 || number > 25)
    .map(number => ({ number, userId: raw.turnId, at: Date.now(), requestId: crypto.randomUUID() }));
  f.save(raw);
  assert.equal(completedLines(raw.players[0].board, raw.draws.map(draw => draw.number)).length, 4);
  const result = await f.action(raw.turnId, raw, 'draw', { requestId: crypto.randomUUID() });
  assert.equal(result.status, 'finished');
  assert.deepEqual(result.winnerIds.sort(), [1, 2]);
  assert.ok(result.players.every(player => player.markedCount === 21 && player.lineCount >= 5));
  assert.equal((await f.api(1, 'current')).data.room, null);
  assert.equal((await f.api(2, 'current')).data.room, null);
  assert.equal((await f.api(3, `rooms/${result.code}`)).status, 403);
  assert.equal((await f.api(1, 'history')).data.rooms[0].winners.length, 2);
});

test('random full games draw without replacement, keep stable boards and finish by 100', async () => {
  const f = fixture();
  let room = await f.start([1, 2, 3]);
  const boards = f.raw(room.code).players.map(player => player.board);
  while (room.status === 'playing') {
    room = await f.action(room.turnId, room, 'draw', { requestId: crypto.randomUUID() });
    assert.equal(new Set(room.draws.map(draw => draw.number)).size, room.draws.length);
    assert.ok(room.draws.length <= 100);
  }
  assert.equal(room.reason, 'win');
  assert.ok(room.winnerIds.length >= 1);
  assert.deepEqual(f.raw(room.code).players.map(player => player.board), boards);
});

test('offline time never changes turn, readiness or room lifetime', async () => {
  const f = fixture();
  const room = await f.start();
  const raw = f.raw(room.code);
  raw.createdAt = 0;
  f.save(raw);
  await worker.scheduled({}, { DB: f.DB });
  const restored = (await f.api(1, 'current')).data.room;
  assert.equal(restored.turnId, room.turnId);
  assert.equal(restored.status, 'playing');
  assert.ok(restored.players.every(player => player.ready));
  assert.equal(isExpired(raw, Date.now() + 365 * 86400000), false);
});

test('host departure transfers ownership; current-player departure advances turn; rejoin forbidden', async () => {
  const f = fixture();
  let room = await f.start([1, 2, 3]);
  room = await f.action(1, room, 'leave');
  assert.equal(room.hostId, 2);
  assert.equal(room.order.includes(1), false);
  assert.notEqual(room.turnId, 1);
  assert.equal((await f.api(1, `rooms/${room.code}/join`, {})).status, 409);
  assert.equal((await f.api(1, `rooms/${room.code}/end`, { version: room.version })).status, 403);
  room = await f.action(room.turnId, room, 'leave');
  assert.equal(room.reason, 'insufficient');
  assert.deepEqual(room.winnerIds, []);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM bingo_active_members').get().n, 0);
});

test('waiting host departure retains others readiness and final departure closes room', async () => {
  const f = fixture();
  let room = await f.create();
  room = await f.action(2, room, 'join');
  room = await f.action(2, room, 'ready', { ready: true });
  await f.action(1, room, 'leave');
  room = (await f.api(2, 'current')).data.room;
  assert.equal(room.hostId, 2);
  assert.equal(room.players[0].ready, true);
  await f.action(2, room, 'leave');
  assert.equal(f.raw(room.code).status, 'finished');
  assert.equal(f.raw(room.code).reason, 'empty');
  assert.equal((await f.api(2, 'current')).data.room, null);
});

test('manual ending has no winner; history expires at 7x24h and cleanup removes only finished rooms', async () => {
  const f = fixture();
  let room = await f.start();
  room = await f.action(1, room, 'end');
  assert.equal(room.reason, 'host');
  assert.deepEqual(room.winnerIds, []);
  const ongoing = await f.create(3);
  const raw = f.raw(room.code);
  raw.endedAt = Date.now() - RETENTION_MS;
  f.save(raw);
  assert.equal((await f.api(1, `rooms/${room.code}`)).status, 404);
  assert.deepEqual((await f.api(1, 'history')).data.rooms, []);
  await worker.scheduled({}, { DB: f.DB });
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM bingo_rooms WHERE code = ?').get(room.code).n, 0);
  assert.equal(f.raw(ongoing.code).status, 'waiting');
});

test('an explicit leave of the current player goes to their immediate successor', () => {
  let room = createRoom('ABCDEFGH', { id: 1, display_name: '一' });
  for (const id of [2, 3, 4]) room = applyAction(room, { id, display_name: String(id) }, 'join', {});
  room.status = 'playing';
  room.order = [3, 1, 4, 2];
  room.turnId = 1;
  const updated = applyAction(room, { id: 1 }, 'leave', {});
  assert.equal(updated.turnId, 4);
  assert.deepEqual(updated.order, [3, 4, 2]);
});

test('only the host can delete a finished room; deletion removes all participant access', async () => {
  const f = fixture();
  let room = await f.start();
  room = await f.action(1, room, 'end');
  assert.equal((await f.api(1, 'history')).data.rooms[0].hostId, 1);
  assert.equal((await f.api(2, `rooms/${room.code}`, undefined, 'DELETE')).status, 403);
  assert.equal((await f.api(3, `rooms/${room.code}`, undefined, 'DELETE')).status, 403);
  assert.equal(f.raw(room.code).status, 'finished');
  const deleted = await f.api(1, `rooms/${room.code}`, undefined, 'DELETE');
  assert.equal(deleted.status, 200);
  assert.equal(deleted.data.deleted, true);
  assert.equal((await f.api(1, `rooms/${room.code}`)).status, 404);
  assert.equal((await f.api(2, `rooms/${room.code}`)).status, 404);
  assert.deepEqual((await f.api(1, 'history')).data.rooms, []);
  assert.deepEqual((await f.api(2, 'history')).data.rooms, []);
  assert.equal((await f.api(1, `rooms/${room.code}`, undefined, 'DELETE')).status, 404);
});

test('the host cannot delete waiting or playing rooms', async () => {
  const f = fixture();
  let room = await f.create();
  assert.equal((await f.api(1, `rooms/${room.code}`, undefined, 'DELETE')).status, 409);
  room = await f.action(2, room, 'join');
  for (const id of [1, 2]) room = await f.action(id, room, 'ready', { ready: true });
  room = await f.action(1, room, 'start');
  assert.equal((await f.api(1, `rooms/${room.code}`, undefined, 'DELETE')).status, 409);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM bingo_active_members').get().n, 2);
  assert.equal((await f.api(2, 'current')).data.room.code, room.code);
});

test('deleting an old room leaves newer active rooms and memberships intact', async () => {
  const f = fixture();
  let old = await f.start();
  old = await f.action(1, old, 'end');
  const active = await f.start();
  assert.equal((await f.api(1, `rooms/${old.code}`, undefined, 'DELETE')).status, 200);
  for (const id of [1, 2]) assert.equal((await f.api(id, 'current')).data.room.code, active.code);
  assert.equal(f.sql.prepare('SELECT count(*) AS n FROM bingo_active_members').get().n, 2);
});

test('deletion permission follows host transfer rather than the original creator', async () => {
  const f = fixture();
  let room = await f.start([1, 2, 3]);
  room = await f.action(1, room, 'leave');
  room = await f.action(2, room, 'end');
  assert.equal((await f.api(1, `rooms/${room.code}`, undefined, 'DELETE')).status, 403);
  assert.equal((await f.api(2, `rooms/${room.code}`, undefined, 'DELETE')).status, 200);
});
