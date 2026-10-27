import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import { bingoApi } from '@/api/bingo';
import type { BingoAction, BingoHistory, BingoRoom } from '@/types/bingo';

export const useBingoStore = defineStore('bingo', () => {
  const auth = useAuthStore();
  const activeRoom = ref<BingoRoom | null>(null);
  const lastRoom = ref<BingoRoom | null>(null);
  const history = ref<BingoHistory[]>([]);
  const busy = ref(false);
  const loading = ref(false);
  const error = ref('');
  const lastSync = ref<number | null>(null);
  let epoch = 0;
  const isMyTurn = computed(() => activeRoom.value?.status === 'playing' && activeRoom.value.turnId === auth.currentUserId);
  const turnName = computed(() => activeRoom.value?.players.find(player => player.id === activeRoom.value?.turnId)?.name ?? '');

  function reset() {
    epoch++;
    activeRoom.value = null;
    lastRoom.value = null;
    history.value = [];
    error.value = '';
    lastSync.value = null;
    loading.value = false;
    busy.value = false;
  }

  async function refresh() {
    if (!auth.isAuthenticated || busy.value || loading.value) return;
    const ticket = epoch;
    const previous = activeRoom.value;
    loading.value = true;
    try {
      const { room } = await bingoApi.current();
      if (ticket !== epoch) return;
      activeRoom.value = room;
      if (room) lastRoom.value = room;
      else if (previous) {
        try {
          const result = await bingoApi.room(previous.code);
          if (ticket === epoch) lastRoom.value = result.room;
        } catch {
          if (ticket === epoch) lastRoom.value = null;
        }
      }
      if (ticket === epoch) {
        error.value = '';
        lastSync.value = Date.now();
      }
    } catch (cause) {
      if (ticket === epoch) error.value = cause instanceof Error ? cause.message : '無法同步賓果進度';
    } finally {
      if (ticket === epoch) loading.value = false;
    }
  }

  async function loadHistory() {
    const ticket = epoch;
    const result = await bingoApi.history();
    if (ticket === epoch) history.value = result.rooms;
  }

  async function mutate(operation: () => Promise<{ room: BingoRoom | null }>, onSuccess?: () => void) {
    if (busy.value) return;
    const ticket = ++epoch;
    loading.value = false;
    busy.value = true;
    try {
      const { room } = await operation();
      if (ticket !== epoch) return;
      lastRoom.value = room;
      activeRoom.value = room && room.status !== 'finished' && room.players.some(player => player.id === auth.currentUserId && player.active) ? room : null;
      lastSync.value = Date.now();
      error.value = '';
      onSuccess?.();
    } catch (cause) {
      if (ticket !== epoch) return;
      error.value = cause instanceof Error ? cause.message : '操作失敗';
      throw cause;
    } finally {
      if (ticket === epoch) {
        busy.value = false;
        // Recover accepted writes after a lost response, and conflicts from other tabs.
        await refresh();
      }
    }
  }

  const create = () => mutate(() => bingoApi.create());
  const remove = (code: string) => mutate(async () => {
    await bingoApi.remove(code);
    const current = activeRoom.value ?? lastRoom.value;
    return { room: current?.code === code ? null : current };
  }, () => {
    history.value = history.value.filter(entry => entry.code !== code);
  });
  const join = (code: string) => mutate(() => bingoApi.action(code.trim().toUpperCase(), 'join', {}));
  function act(action: Exclude<BingoAction, 'join'>, ready?: boolean) {
    const room = activeRoom.value;
    if (!room) return Promise.resolve();
    return mutate(() => bingoApi.action(room.code, action, {
      version: room.version, ready,
      ...(action === 'draw' ? { requestId: crypto.randomUUID() } : {}),
    }));
  }

  return { activeRoom, lastRoom, history, busy, loading, error, lastSync, isMyTurn, turnName, reset, refresh, loadHistory, create, remove, join, act };
});
