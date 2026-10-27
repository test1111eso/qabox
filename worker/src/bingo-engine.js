export class BingoError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % max;
}

export function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function completedLines(board, numbers) {
  if (board.length !== 25) return [];
  const marked = new Set(numbers);
  const candidates = [];
  for (let i = 0; i < 5; i++) {
    candidates.push(Array.from({ length: 5 }, (_, j) => i * 5 + j));
    candidates.push(Array.from({ length: 5 }, (_, j) => j * 5 + i));
  }
  candidates.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return candidates.filter(line => line.every(index => marked.has(board[index])));
}

function member(user, now) {
  return { id: user.id, name: user.display_name, joinedAt: now, active: true, ready: false, board: [] };
}

export function createRoom(code, user, now = Date.now()) {
  return {
    code, version: 0, status: 'waiting', hostId: user.id,
    players: [member(user, now)], order: [], turnId: null,
    draws: [], events: [{ type: 'create', userId: user.id, at: now }],
    winnerIds: [], createdAt: now, endedAt: null, reason: null,
  };
}

export function isExpired(room, now = Date.now()) {
  return room.endedAt !== null && room.endedAt + RETENTION_MS <= now;
}

function finish(room, reason, now) {
  room.status = 'finished';
  room.reason = reason;
  room.endedAt = now;
  room.turnId = null;
}

// Returns a new snapshot; the caller persists it with an optimistic version check.
export function applyAction(original, user, action, input, now = Date.now()) {
  const room = structuredClone(original);
  const self = room.players.find(player => player.id === user.id);
  if (action === 'join') {
    if (room.status !== 'waiting') throw new BingoError('這局已開始或結束，無法加入', 409);
    if (self?.active) return original;
    if (room.players.filter(player => player.active).length >= 6) throw new BingoError('房間已滿（最多 6 人）', 409);
    room.players.push(member(user, now));
  } else {
    if (!self?.active) throw new BingoError('你已不在本局參賽名單中', 403);
    if (action === 'draw' && room.draws.some(draw => draw.userId === user.id && draw.requestId === input.requestId)) {
      return original;
    }
    if (room.status === 'finished') throw new BingoError('本局已結束', 409);
    if (action === 'ready') {
      if (room.status !== 'waiting') throw new BingoError('本局已開始', 409);
      if (typeof input.ready !== 'boolean') throw new BingoError('準備狀態不正確');
      self.ready = input.ready;
    } else if (action === 'start') {
      if (room.hostId !== user.id) throw new BingoError('只有房主能開始遊戲', 403);
      if (room.status !== 'waiting') throw new BingoError('本局已開始', 409);
      const players = room.players.filter(player => player.active);
      if (players.length < 2 || !players.every(player => player.ready)) throw new BingoError('至少兩人且全員準備後才能開始', 409);
      const pool = Array.from({ length: 100 }, (_, index) => index + 1);
      for (const player of players) player.board = shuffle(pool).slice(0, 25);
      room.order = shuffle(players.map(player => player.id));
      room.turnId = room.order[0];
      room.status = 'playing';
    } else if (action === 'draw') {
      if (room.status !== 'playing') throw new BingoError('遊戲尚未開始', 409);
      if (room.turnId !== user.id) throw new BingoError('還沒輪到你抽號', 409);
      const drawn = new Set(room.draws.map(draw => draw.number));
      const remaining = Array.from({ length: 100 }, (_, index) => index + 1).filter(number => !drawn.has(number));
      if (!remaining.length) throw new BingoError('號碼已抽完', 409);
      const number = remaining[randomInt(remaining.length)];
      room.draws.push({ number, userId: user.id, at: now, requestId: input.requestId });
      const numbers = room.draws.map(draw => draw.number);
      room.winnerIds = room.players.filter(player => player.active && completedLines(player.board, numbers).length >= 5).map(player => player.id);
      if (room.winnerIds.length) finish(room, 'win', now);
      else room.turnId = room.order[(room.order.indexOf(user.id) + 1) % room.order.length];
    } else if (action === 'leave') {
      self.active = false;
      const remaining = room.players.filter(player => player.active);
      // Original array order records joining order, even with identical timestamps.
      if (room.hostId === user.id) room.hostId = remaining[0]?.id ?? null;
      if (room.status === 'waiting') {
        room.players = remaining;
        if (!remaining.length) finish(room, 'empty', now);
      } else {
        const previousOrder = [...room.order];
        room.order = previousOrder.filter(id => id !== user.id);
        if (remaining.length < 2) finish(room, 'insufficient', now);
        else if (room.turnId === user.id) {
          room.turnId = previousOrder[(previousOrder.indexOf(user.id) + 1) % previousOrder.length];
        }
      }
    } else if (action === 'end') {
      if (room.hostId !== user.id) throw new BingoError('只有房主能結束整局', 403);
      finish(room, 'host', now);
    } else throw new BingoError('未知操作', 404);
  }
  room.events.push({ type: action, userId: user.id, at: now });
  room.version++;
  return room;
}

export function publicRoom(room, userId) {
  if (!room.players.some(player => player.id === userId)) throw new BingoError('僅本局參加者可查看', 403);
  const numbers = room.draws.map(draw => draw.number);
  return {
    ...room,
    draws: room.draws.map(({ requestId: _requestId, ...draw }) => draw),
    players: room.players.map(({ board, ...player }) => ({
      ...player,
      ...(player.id === userId ? { board, lines: completedLines(board, numbers) } : {}),
      markedCount: board.filter(number => numbers.includes(number)).length,
      lineCount: completedLines(board, numbers).length,
    })),
  };
}
