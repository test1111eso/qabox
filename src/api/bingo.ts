import { request } from './client';
import type { BingoAction, BingoHistory, BingoRoom } from '@/types/bingo';

async function bingoRequest<T>(path: string, options: RequestInit = {}) {
  try {
    return await request<T>(path, { ...options, signal: AbortSignal.timeout(15000) });
  } catch (cause) {
    if (cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
      throw new Error('連線逾時，請更新進度確認結果後再操作');
    }
    throw cause;
  }
}

export const bingoApi = {
  current: () => bingoRequest<{ room: BingoRoom | null }>('/api/bingo/current'),
  history: () => bingoRequest<{ rooms: BingoHistory[] }>('/api/bingo/history'),
  room: (code: string) => bingoRequest<{ room: BingoRoom }>(`/api/bingo/rooms/${encodeURIComponent(code)}`),
  create: () => bingoRequest<{ room: BingoRoom }>('/api/bingo/rooms', { method: 'POST' }),
  remove: (code: string) => bingoRequest<{ deleted: boolean; code: string }>(`/api/bingo/rooms/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  action: (code: string, action: BingoAction, input: { version?: number; ready?: boolean; requestId?: string }) =>
    bingoRequest<{ room: BingoRoom | null }>(`/api/bingo/rooms/${encodeURIComponent(code)}/${action}`, {
      method: 'POST', body: JSON.stringify(input),
    }),
};
