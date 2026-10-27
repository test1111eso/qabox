<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useBingoStore } from '@/stores/bingo';
import Navbar from '@/components/layout/Navbar.vue';
import zhTw from 'element-plus/es/locale/lang/zh-tw';

const authStore = useAuthStore();
const bingo = useBingoStore();
const refreshBingo = () => {
  if (document.visibilityState === 'visible') void bingo.refresh();
};
watch(() => authStore.token, () => {
  bingo.reset();
  refreshBingo();
}, { immediate: true });
let bingoTimer: ReturnType<typeof setInterval>;
onMounted(() => {
  bingoTimer = setInterval(refreshBingo, 10000);
  window.addEventListener('focus', refreshBingo);
  window.addEventListener('online', refreshBingo);
  document.addEventListener('visibilitychange', refreshBingo);
});
onUnmounted(() => {
  clearInterval(bingoTimer);
  window.removeEventListener('focus', refreshBingo);
  window.removeEventListener('online', refreshBingo);
  document.removeEventListener('visibilitychange', refreshBingo);
});
</script>

<template>
  <el-config-provider :locale="zhTw">
    <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar v-if="authStore.isAuthenticated" />
      <main :class="authStore.isAuthenticated ? 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1' : 'flex-1'">
        <router-link v-if="authStore.isAuthenticated && bingo.activeRoom" to="/workspace?tab=bingo" class="block rounded-xl px-4 py-3 mb-5 border text-sm" :class="bingo.isMyTurn ? 'bg-indigo-50 border-indigo-300 text-indigo-800' : 'bg-white border-slate-200 text-slate-600'">
          <strong>賓果 {{ bingo.activeRoom.code }}</strong> · {{ bingo.activeRoom.status === 'waiting' ? '房間等待準備中' : bingo.isMyTurn ? '輪到你抽號了！' : `目前等待 ${bingo.turnName} 抽號` }}
          <span class="ml-2 underline">回到房間 →</span>
          <span v-if="bingo.error" class="block text-xs mt-1 text-amber-700">同步暫停，點擊房間查看狀態。</span>
        </router-link>
        <router-view />
      </main>
    </div>
  </el-config-provider>
</template>
