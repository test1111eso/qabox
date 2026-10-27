import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

globalThis.localStorage = {
  getItem(key) { return ({ qa_session_token: 'local-test-token', qa_user_id: '1', qa_display_name: '同事一' })[key] ?? null; },
};
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const { useBingoStore } = await server.ssrLoadModule('/src/stores/bingo.ts');
const originalFetch = globalThis.fetch;
after(async () => { globalThis.fetch = originalFetch; delete globalThis.localStorage; await server.close(); });

function room(version = 0, status = 'playing') {
  return { code: 'ABCDEFGH', version, status, hostId: 1, turnId: 1, order: [1, 2],
    players: [{ id: 1, active: true, name: '同事一' }, { id: 2, active: true, name: '同事二' }],
    draws: [], events: [], winnerIds: [], createdAt: 1, endedAt: status === 'finished' ? Date.now() : null };
}
function fixture() {
  setActivePinia(createPinia());
  return useBingoStore();
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('temporary network failure preserves the last known room and shows an error', async () => {
  const store = fixture();
  store.activeRoom = room(1);
  globalThis.fetch = async () => { throw new TypeError('網路中斷'); };
  await store.refresh();
  assert.equal(store.activeRoom.version, 1);
  assert.equal(store.error, '網路中斷');
  assert.equal(store.loading, false);
});

test('logout/account reset discards an in-flight room response', async () => {
  const store = fixture();
  const pending = deferred();
  globalThis.fetch = () => pending.promise;
  const refreshing = store.refresh();
  store.reset();
  pending.resolve(json({ room: room(1) }));
  await refreshing;
  assert.equal(store.activeRoom, null);
  assert.equal(store.lastRoom, null);
  assert.equal(store.loading, false);
});

test('an old poll cannot overwrite the result of a newer draw', async () => {
  const store = fixture();
  store.activeRoom = room(1);
  const oldPoll = deferred();
  let reads = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') return json({ room: room(2) });
    if (++reads === 1) return oldPoll.promise;
    return json({ room: room(2) });
  };
  const refreshing = store.refresh();
  await store.act('draw');
  oldPoll.resolve(json({ room: room(1) }));
  await refreshing;
  assert.equal(store.activeRoom.version, 2);
  assert.equal(store.lastRoom.version, 2);
});

test('a lost create response is recovered by reading the current room', async () => {
  const store = fixture();
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') throw new TypeError('回應遺失');
    return json({ room: room(1, 'waiting') });
  };
  await assert.rejects(store.create(), /回應遺失/);
  assert.equal(store.activeRoom.code, 'ABCDEFGH');
  assert.equal(store.busy, false);
});

test('a version conflict refreshes progress and still reports the rejected action', async () => {
  const store = fixture();
  store.activeRoom = room(1);
  globalThis.fetch = async (_url, options) => options.method === 'POST'
    ? json({ error: '進度已更新' }, 409) : json({ room: room(3) });
  await assert.rejects(store.act('draw'), /進度已更新/);
  assert.equal(store.activeRoom.version, 3);
});

test('a finished room is fetched for the result display after losing the active seat', async () => {
  const store = fixture();
  store.activeRoom = room(1);
  globalThis.fetch = async url => String(url).endsWith('/current')
    ? json({ room: null }) : json({ room: room(2, 'finished') });
  await store.refresh();
  assert.equal(store.activeRoom, null);
  assert.equal(store.lastRoom.status, 'finished');
});

test('rapid repeated clicks submit only one mutation', async () => {
  const store = fixture();
  store.activeRoom = room(1);
  const pending = deferred();
  let writes = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'POST') { writes++; return pending.promise; }
    return json({ room: room(2) });
  };
  const first = store.act('draw');
  await store.act('draw');
  pending.resolve(json({ room: room(2) }));
  await first;
  assert.equal(writes, 1);
  assert.equal(store.activeRoom.version, 2);
});

test('reset while a mutation is pending prevents old-user data from reappearing', async () => {
  const store = fixture();
  const pending = deferred();
  globalThis.fetch = () => pending.promise;
  const creating = store.create();
  store.reset();
  pending.resolve(json({ room: room(1) }));
  await creating;
  assert.equal(store.activeRoom, null);
  assert.equal(store.lastRoom, null);
  assert.equal(store.busy, false);
});

test('deleting the displayed finished room clears its cached detail and history', async () => {
  const store = fixture();
  store.lastRoom = room(2, 'finished');
  store.history = [{ code: 'ABCDEFGH' }];
  globalThis.fetch = async (_url, options) => options.method === 'DELETE'
    ? json({ deleted: true, code: 'ABCDEFGH' }) : json({ room: null });
  await store.remove('ABCDEFGH');
  assert.equal(store.lastRoom, null);
  assert.equal(store.activeRoom, null);
  assert.deepEqual(store.history, []);
});

test('deleting old history preserves the active game and other history entries', async () => {
  const store = fixture();
  store.activeRoom = room(3);
  store.history = [{ code: 'OLDROOM1' }, { code: 'OLDROOM2' }];
  globalThis.fetch = async (_url, options) => options.method === 'DELETE'
    ? json({ deleted: true, code: 'OLDROOM1' }) : json({ room: room(3) });
  await store.remove('OLDROOM1');
  assert.equal(store.activeRoom.code, 'ABCDEFGH');
  assert.deepEqual(store.history.map(entry => entry.code), ['OLDROOM2']);
});

test('rejected deletion keeps the cached result and history available', async () => {
  const store = fixture();
  store.lastRoom = room(2, 'finished');
  store.history = [{ code: 'ABCDEFGH' }];
  globalThis.fetch = async (_url, options) => options.method === 'DELETE'
    ? json({ error: '只有房主能刪除' }, 403) : json({ room: null });
  await assert.rejects(store.remove('ABCDEFGH'), /只有房主能刪除/);
  assert.equal(store.lastRoom.code, 'ABCDEFGH');
  assert.equal(store.history.length, 1);
});
