export interface BingoPlayer {
  id: number;
  name: string;
  joinedAt: number;
  active: boolean;
  ready: boolean;
  board?: number[];
  lines?: number[][];
  markedCount: number;
  lineCount: number;
}

export interface BingoRoom {
  code: string;
  version: number;
  status: 'waiting' | 'playing' | 'finished';
  hostId: number | null;
  players: BingoPlayer[];
  order: number[];
  turnId: number | null;
  draws: { number: number; userId: number; at: number }[];
  events: { type: string; userId: number; at: number }[];
  winnerIds: number[];
  createdAt: number;
  endedAt: number | null;
  reason: 'win' | 'empty' | 'insufficient' | 'host' | null;
}

export interface BingoHistory {
  code: string;
  status: string;
  hostId: number | null;
  endedAt: number;
  reason: BingoRoom['reason'];
  winners: string[];
}

export type BingoAction = 'join' | 'ready' | 'start' | 'draw' | 'leave' | 'end';
