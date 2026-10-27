import { BingoError, RETENTION_MS, applyAction, createRoom, isExpired, publicRoom, randomInt } from './bingo-engine.js';

export async function cleanupBingo(db, now = Date.now()) {
  await db.prepare("DELETE FROM bingo_rooms WHERE status = 'finished' AND ended_at <= ?")
    .bind(now - RETENTION_MS).run();
}

async function readRoom(db, code) {
  const row = await db.prepare('SELECT state FROM bingo_rooms WHERE code = ?').bind(code).first();
  if (!row) throw new BingoError('找不到房間，或紀錄已超過七天', 404);
  const room = JSON.parse(row.state);
  if (isExpired(room)) throw new BingoError('本局紀錄已到期', 404);
  return room;
}

function summary(room) {
  return { code: room.code, status: room.status, hostId: room.hostId, endedAt: room.endedAt, reason: room.reason,
    winners: room.players.filter(player => room.winnerIds.includes(player.id)).map(player => player.name) };
}

export async function handleBingo(request, env, headers) {
  const json = (data, status = 200) => Response.json(data, { status, headers });
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    const user = await env.DB.prepare(
      'SELECT u.id, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1'
    ).bind(token, new Date().toISOString()).first();
    if (!user) throw new BingoError('登入已失效，請重新登入', 401);
    const path = new URL(request.url).pathname;

    if (request.method === 'GET' && path === '/api/bingo/current') {
      const row = await env.DB.prepare(
        'SELECT r.state FROM bingo_rooms r JOIN bingo_active_members m ON m.room_code = r.code WHERE m.user_id = ?'
      ).bind(user.id).first();
      return json({ room: row ? publicRoom(JSON.parse(row.state), user.id) : null });
    }
    if (request.method === 'GET' && path === '/api/bingo/history') {
      const { results } = await env.DB.prepare(
        `SELECT state FROM bingo_rooms r WHERE status = 'finished' AND ended_at > ?
         AND EXISTS (SELECT 1 FROM json_each(r.state, '$.players') p WHERE json_extract(p.value, '$.id') = ?)
         ORDER BY ended_at DESC`
      ).bind(Date.now() - RETENTION_MS, user.id).all();
      return json({ rooms: results.map(row => summary(JSON.parse(row.state))) });
    }
    if (request.method === 'POST' && path === '/api/bingo/rooms') {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('');
        const room = createRoom(code, user);
        try {
          await env.DB.prepare('INSERT INTO bingo_rooms(code, state, version, status, ended_at) VALUES (?, ?, ?, ?, ?)')
            .bind(code, JSON.stringify(room), room.version, room.status, room.endedAt).run();
          return json({ room: publicRoom(room, user.id) }, 201);
        } catch (error) {
          if (String(error.message).includes('bingo_rooms.code')) continue;
          throw error;
        }
      }
      throw new BingoError('暫時無法建立房間，請重試', 503);
    }
    const match = path.match(/^\/api\/bingo\/rooms\/([A-Z2-9]{8})(?:\/(join|ready|start|draw|leave|end))?$/);
    if (!match) throw new BingoError('找不到此賓果操作', 404);
    const [, code, action] = match;
    const original = await readRoom(env.DB, code);
    if (request.method === 'GET' && !action) return json({ room: publicRoom(original, user.id) });
    if (request.method === 'DELETE' && !action) {
      if (original.hostId !== user.id) throw new BingoError('只有房主能刪除已結束的場次', 403);
      if (original.status !== 'finished') throw new BingoError('只能刪除已結束的場次', 409);
      const result = await env.DB.prepare(
        "DELETE FROM bingo_rooms WHERE code = ? AND status = 'finished' AND version = ? AND json_extract(state, '$.hostId') = ?"
      ).bind(code, original.version, user.id).run();
      if (!result.meta.changes) throw new BingoError('場次已刪除或紀錄已到期', 404);
      return json({ deleted: true, code });
    }
    if (request.method !== 'POST' || !action) throw new BingoError('不支援的操作', 405);
    const text = await request.text();
    if (text.length > 2048) throw new BingoError('請求內容過大', 413);
    let input;
    try { input = JSON.parse(text || '{}'); } catch { throw new BingoError('請求格式不正確'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BingoError('請求格式不正確');
    if (action === 'draw' && (typeof input.requestId !== 'string' || !/^[\w-]{16,80}$/.test(input.requestId))) {
      throw new BingoError('抽號請求識別碼不正確');
    }
    // Retries of an already accepted draw must not generate a second draw,
    // even if other players have acted or the game has finished meanwhile.
    const repeatedDraw = action === 'draw' && original.draws.some(draw => draw.userId === user.id && draw.requestId === input.requestId);
    if (action !== 'join' && !repeatedDraw && input.version !== original.version) throw new BingoError('進度已更新，請重新確認後操作', 409);
    const updated = applyAction(original, user, action, input);
    if (updated !== original) {
      const result = await env.DB.prepare(
        'UPDATE bingo_rooms SET state = ?, version = ?, status = ?, ended_at = ? WHERE code = ? AND version = ?'
      ).bind(JSON.stringify(updated), updated.version, updated.status, updated.endedAt, code, original.version).run();
      if (!result.meta.changes) throw new BingoError('進度已更新，請重新確認後操作', 409);
    }
    // A waiting-room departure removes the member entirely.
    return json({ room: updated.players.some(player => player.id === user.id) ? publicRoom(updated, user.id) : null });
  } catch (error) {
    if (String(error.message).includes('bingo_active_members.user_id')) return json({ error: '你已加入另一個尚未結束的房間，請先回到該房間或退出' }, 409);
    if (error instanceof BingoError) return json({ error: error.message }, error.status);
    console.error(JSON.stringify({ event: 'bingo_api_error', message: error.message }));
    return json({ error: '賓果服務暫時無法使用，請稍後重試' }, 500);
  }
}
