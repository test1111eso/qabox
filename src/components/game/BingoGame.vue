<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { useBingoStore } from '@/stores/bingo';
import { bingoApi } from '@/api/bingo';
import type { BingoRoom } from '@/types/bingo';

const auth = useAuthStore();
const bingo = useBingoStore();
const joinCode = ref('');
const historyRoom = ref<BingoRoom | null>(null);
const viewingHistory = ref(false);
const room = computed(() => viewingHistory.value ? historyRoom.value : bingo.activeRoom ?? bingo.lastRoom);
const self = computed(() => room.value?.players.find(player => player.id === auth.currentUserId));
const playingHere = computed(() => !viewingHistory.value && !!bingo.activeRoom && bingo.activeRoom.code === room.value?.code);
const isHost = computed(() => playingHere.value && room.value?.hostId === auth.currentUserId);
const members = computed(() => room.value?.players.filter(player => player.active) ?? []);
const canStart = computed(() => members.value.length >= 2 && members.value.every(player => player.ready));
const numbers = computed(() => new Set(room.value?.draws.map(draw => draw.number) ?? []));
const lineCells = computed(() => new Set(self.value?.lines?.flat() ?? []));
const nameOf = (id: number | null) => room.value?.players.find(player => player.id === id)?.name ?? '已離房同事';
const orderedPlayers = computed(() => {
  if (!room.value) return [];
  return room.value.order.map(id => room.value!.players.find(player => player.id === id)!).filter(Boolean);
});
const latest = computed(() => room.value?.draws.slice(-1)[0]);
const nextName = computed(() => {
  const current = room.value;
  if (!current || current.status !== 'playing') return '';
  return nameOf(current.order[(current.order.indexOf(current.turnId!) + 1) % current.order.length]);
});
const ending = computed(() => {
  if (room.value?.reason === 'win') return `${room.value.winnerIds.map(nameOf).join('、')} ${room.value.winnerIds.length > 1 ? '並列獲勝' : '獲勝'}！`;
  if (room.value?.reason === 'insufficient') return '參賽人數不足，本局結束，無冠軍';
  return '房主已結束本局，無冠軍';
});
const eventLabels: Record<string, string> = { create: '建立房間', join: '加入房間', ready: '更新準備狀態', start: '開始遊戲', draw: '完成抽號', leave: '退出房間', end: '結束整局' };
const formatTime = (time: number) => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(time);

async function run(operation: () => Promise<unknown>) {
  try {
    await operation();
    viewingHistory.value = false;
    await bingo.loadHistory().catch(() => {});
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失敗');
  }
}
async function confirmAction(action: 'leave' | 'end') {
  try {
    await ElMessageBox.confirm(
      action === 'end' ? '確定結束整局？所有同事都無法繼續抽號，且本局不判冠軍。' : room.value?.status === 'playing' ? '確定退出本局？退出後無法重新加入，剩不到兩人時本局將結束。' : '確定離開房間？開始前可以重新加入。',
      action === 'end' ? '結束整局' : '退出房間',
      { type: 'warning', confirmButtonText: '確定', cancelButtonText: '取消' },
    );
  } catch { return; }
  await run(() => bingo.act(action));
}
async function viewHistory(code: string) {
  try {
    historyRoom.value = (await bingoApi.room(code)).room;
    viewingHistory.value = true;
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '紀錄已到期'); }
}
async function confirmDelete(code: string) {
  try {
    await ElMessageBox.confirm(
      `確定永久刪除已結束的場次【${code}】？所有參加者都將無法再查看棋盤、抽號與操作紀錄，此操作無法復原。`,
      '刪除已結束場次',
      { type: 'warning', confirmButtonText: '永久刪除', cancelButtonText: '取消' },
    );
  } catch { return; }
  await run(async () => {
    await bingo.remove(code);
    if (historyRoom.value?.code === code) historyRoom.value = null;
    ElMessage.success('已刪除場次');
  });
}
async function copyCode() {
  try { await navigator.clipboard.writeText(room.value!.code); ElMessage.success('已複製房號'); }
  catch { ElMessage.info(`房號：${room.value?.code}`); }
}
watch(() => bingo.lastRoom?.endedAt, () => { bingo.loadHistory().catch(() => {}); });
onMounted(() => { bingo.refresh(); bingo.loadHistory().catch(() => {}); });
</script>

<template>
  <section class="space-y-5" aria-label="同事賓果連線">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-bold tracking-widest text-indigo-500">BINGO CLUB</p>
        <h3 class="text-xl font-bold text-slate-800 mt-1">同事賓果連線</h3>
        <p class="text-xs text-slate-500 mt-1">慢慢玩，隨時回來接著抽。先完成 5 條線就贏！</p>
      </div>
      <el-button size="small" :loading="bingo.loading" :disabled="bingo.busy" @click="bingo.refresh()">更新進度</el-button>
    </div>

    <el-alert v-if="bingo.error" :title="bingo.error" description="目前顯示上次取得的進度；請更新進度後再操作。" type="warning" :closable="false" show-icon />

    <div v-if="!bingo.activeRoom" class="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
      <p class="text-sm font-semibold text-slate-700">開一局，或輸入同事分享的房號</p>
      <div class="flex flex-wrap gap-2">
        <el-button type="primary" :loading="bingo.busy" @click="run(bingo.create)">建立新一局</el-button>
        <form class="flex gap-2 flex-1 min-w-0" @submit.prevent="run(() => bingo.join(joinCode))">
          <el-input v-model="joinCode" aria-label="房號" placeholder="8 碼房號" maxlength="8" class="!w-36" />
          <el-button native-type="submit" :disabled="joinCode.trim().length !== 8 || bingo.busy">加入</el-button>
        </form>
      </div>
      <p class="text-xs text-slate-500">2～6 人・一人同時一局・全員準備後由房主開始</p>
    </div>

    <el-button v-if="viewingHistory" size="small" @click="viewingHistory = false">返回目前房間</el-button>

    <component
      :is="room.status === 'finished' ? 'details' : 'div'"
      v-if="room"
      :key="`${room.code}:${room.status}`"
      class="space-y-5"
      :class="room.status === 'finished' ? 'rounded-xl border border-slate-200 p-4' : ''"
    >
      <summary v-if="room.status === 'finished'" class="cursor-pointer text-sm font-semibold text-slate-700">
        已結束場次 · {{ room.code }}
        <span class="block mt-1 text-xs font-normal text-slate-500">{{ ending }} · 棋盤與詳細紀錄</span>
      </summary>
      <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <button type="button" class="text-sm text-slate-600 hover:text-indigo-600" @click="copyCode">房號 <strong class="font-mono tracking-wider">{{ room.code }}</strong> <span class="text-xs">複製</span></button>
        <el-tag :type="room.status === 'finished' ? 'info' : 'success'">{{ room.status === 'waiting' ? '等待準備' : room.status === 'playing' ? '進行中' : '已結束' }}</el-tag>
      </div>

      <div v-if="room.status === 'playing'" class="rounded-xl p-4 border" :class="playingHere && bingo.isMyTurn ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-700 border-slate-200'" aria-live="polite">
        <p class="text-xs opacity-75">第 {{ room.draws.length + 1 }} 回合 · 已抽 {{ room.draws.length }} / 100 號</p>
        <p class="text-lg font-bold mt-1">{{ playingHere && bingo.isMyTurn ? '輪到你了！' : `目前等待 ${nameOf(room.turnId)} 抽號` }}</p>
        <p class="text-xs mt-1 opacity-80">下一位：{{ nextName }} · 不限時間，離線仍保留輪次</p>
        <el-button v-if="playingHere" class="mt-3" :disabled="!bingo.isMyTurn || !!bingo.error" :loading="bingo.busy" @click="run(() => bingo.act('draw'))">{{ bingo.isMyTurn ? '抽一個號碼' : '等待同事抽號' }}</el-button>
        <p v-if="!self?.active" class="text-xs mt-2">你已退出本局，可建立或加入其他房間。</p>
      </div>
      <div v-else-if="room.status === 'finished'" class="rounded-xl bg-amber-50 border border-amber-200 p-4" aria-live="polite">
        <p class="text-lg font-bold text-amber-800">{{ ending }}</p>
        <p class="text-xs text-amber-700 mt-1">{{ room.endedAt ? formatTime(room.endedAt) : '' }} 結束 · 紀錄保留至 {{ room.endedAt ? formatTime(room.endedAt + 7 * 86400000) : '' }}</p>
      </div>
      <el-button v-if="room.status === 'finished' && room.hostId === auth.currentUserId" size="small" type="danger" plain :disabled="bingo.busy" @click="confirmDelete(room.code)">刪除此場次</el-button>

      <div class="space-y-2">
        <p class="text-xs font-semibold text-slate-500">{{ room.status === 'waiting' ? `房間成員 ${members.length} / 6` : '抽號順序' }} · 房主 {{ nameOf(room.hostId) }}</p>
        <div class="flex flex-wrap gap-2">
          <div v-for="(player, index) in (room.status === 'waiting' ? members : orderedPlayers)" :key="player.id" class="px-3 py-2 rounded-lg text-xs border" :class="room.turnId === player.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-400' : 'border-slate-200 bg-white text-slate-600'">
            <strong>{{ index + 1 }}. {{ player.name }}{{ player.id === auth.currentUserId ? '（你）' : '' }}</strong>
            <p class="mt-1">{{ room.status === 'waiting' ? player.ready ? '已準備' : '尚未準備' : `${player.lineCount} 條線 · ${player.markedCount} 格` }}{{ room.turnId === player.id ? ' · 輪到抽號' : '' }}</p>
          </div>
        </div>
      </div>

      <div v-if="room.status === 'waiting' && playingHere" class="space-y-2">
        <div class="flex flex-wrap gap-2">
          <el-button :type="self?.ready ? 'success' : 'primary'" :loading="bingo.busy" @click="run(() => bingo.act('ready', !self?.ready))">{{ self?.ready ? '已準備・取消準備' : '準備好了' }}</el-button>
          <el-button v-if="isHost" type="primary" :disabled="!canStart || bingo.busy" @click="run(() => bingo.act('start'))">開始遊戲</el-button>
        </div>
        <p class="text-xs text-slate-500">棋盤在開始時產生，無法重抽。準備後可以關閉系統，稍後回來繼續。</p>
      </div>

      <div v-if="self?.board?.length" class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-bold text-slate-700">你的棋盤 <span class="text-indigo-600">{{ self.lineCount }} / 5 條線</span></p>
          <p class="text-xs text-slate-500">最新抽號 <strong class="text-xl text-indigo-600">{{ latest?.number ?? '—' }}</strong></p>
        </div>
        <div class="grid grid-cols-5 gap-2 max-w-sm mx-auto" role="group" aria-label="你的 5 乘 5 棋盤">
          <div v-for="(number, index) in self.board" :key="number" class="aspect-square rounded-xl flex flex-col items-center justify-center font-bold text-lg border transition-colors" :class="lineCells.has(index) ? 'bg-amber-100 border-amber-400 text-amber-900' : numbers.has(number) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'" :aria-label="`${number}，${numbers.has(number) ? '已抵銷' : '未抽中'}${lineCells.has(index) ? '，已連線' : ''}`">
            {{ number }}<span v-if="numbers.has(number)" class="text-[10px] leading-none">✓</span>
          </div>
        </div>
        <p class="text-xs text-center text-slate-500">紫色：已抵銷 · 金色：已連線 · 橫、直、斜皆算一條</p>
      </div>

      <details v-if="room.draws.length" class="rounded-lg border border-slate-200 p-3">
        <summary class="text-sm cursor-pointer text-slate-600">抽號紀錄（{{ room.draws.length }}）</summary>
        <ol class="mt-3 space-y-2 max-h-52 overflow-auto text-xs text-slate-600">
          <li v-for="(draw, index) in room.draws" :key="draw.number">{{ index + 1 }}. {{ nameOf(draw.userId) }} 抽中 <strong>{{ draw.number }}</strong> · {{ formatTime(draw.at) }}</li>
        </ol>
      </details>
      <details v-if="room.events.length" class="text-xs text-slate-500">
        <summary class="cursor-pointer">房間操作紀錄</summary>
        <ul class="mt-2 max-h-36 overflow-auto space-y-1">
          <li v-for="(event, index) in room.events" :key="index">{{ formatTime(event.at) }} · {{ nameOf(event.userId) }} {{ eventLabels[event.type] ?? event.type }}</li>
        </ul>
      </details>
      <div v-if="playingHere" class="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
        <el-button size="small" :disabled="bingo.busy" @click="confirmAction('leave')">{{ room.status === 'waiting' ? '離開房間' : '退出本局' }}</el-button>
        <el-button v-if="isHost" size="small" type="danger" plain :disabled="bingo.busy" @click="confirmAction('end')">結束整局</el-button>
      </div>
      </div>
    </component>

    <details class="border-t border-slate-100 pt-3" @toggle="bingo.loadHistory().catch(() => {})">
      <summary class="text-sm text-slate-600 cursor-pointer">近 7 天的已結束紀錄</summary>
      <p v-if="!bingo.history.length" class="text-xs text-slate-400 mt-3">尚無紀錄</p>
      <div v-for="entry in bingo.history" :key="entry.code" class="flex items-center justify-between gap-2 border-b border-slate-100 py-3 text-xs">
        <div><strong class="font-mono">{{ entry.code }}</strong><p class="text-slate-500 mt-1">{{ formatTime(entry.endedAt) }} · {{ entry.winners.length ? entry.winners.join('、') + ' 獲勝' : '無冠軍' }}</p></div>
        <div class="flex gap-2">
          <el-button size="small" @click="viewHistory(entry.code)">查看</el-button>
          <el-button v-if="entry.hostId === auth.currentUserId" size="small" type="danger" plain :disabled="bingo.busy" @click="confirmDelete(entry.code)">刪除</el-button>
        </div>
      </div>
    </details>
    <p class="text-[11px] text-slate-400">{{ bingo.lastSync ? `上次同步 ${formatTime(bingo.lastSync)} · ` : '' }}開啟系統時自動同步，切回視窗會立即更新。</p>
  </section>
</template>
