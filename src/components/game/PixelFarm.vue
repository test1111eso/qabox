<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  useFarmStore,
  CROP_CONFIGS,
  DISASTER_CONFIGS,
  type CropType,
  type ActiveTool,
  type DisasterConfig,
} from '@/stores/farm';
import { useAuthStore } from '@/stores/auth';
import { useReportsStore } from '@/stores/reports';
import { playPixelSound } from '@/utils/pixelSound';
import { ElMessage } from 'element-plus';

const farmStore = useFarmStore();
const authStore = useAuthStore();
const reportsStore = useReportsStore();

// Modals
const showShopModal = ref(false);
const showBoardModal = ref(false);
const showRankModal = ref(false);
const showDisasterModal = ref(false);
const activeDisasterPlotId = ref<number | null>(null);

const shopTab = ref<'buy' | 'sell'>('buy');
const soundEnabled = ref(true);

// Floating Animation Texts (Strictly bound to specific plotId)
interface FloatMsg {
  id: number;
  plotId: number;
  text: string;
  color: string;
}
const floatMsgs = ref<FloatMsg[]>([]);
let floatId = 0;

function spawnFloat(plotId: number, text: string, color: string) {
  const id = ++floatId;
  floatMsgs.value.push({ id, plotId, text, color });
  setTimeout(() => {
    floatMsgs.value = floatMsgs.value.filter((m) => m.id !== id);
  }, 1200);
}

function handleSound(type: 'hoe' | 'water' | 'scythe' | 'plant' | 'sparkle' | 'harvest' | 'coin' | 'click') {
  if (soundEnabled.value) {
    playPixelSound(type);
  }
}

// Format duration
function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Single Plot Focus & Selection
const selectedPlotId = ref<number>(0);
const selectedPlot = computed(() => {
  return farmStore.plots.find((p) => p.id === selectedPlotId.value) || farmStore.plots[0];
});

// Tool Selection & Execution on current selected plot
function selectTool(tool: ActiveTool) {
  farmStore.activeTool = tool;
  handleSound('click');
}

function onToolClick(tool: ActiveTool) {
  farmStore.activeTool = tool;
  handleSound('click');
  // 點擊下方工具僅切換使用模式，絕不自動執行作業！
  // 只有當使用者點擊上方某個單一田地時，才對該田地執行該用途作業。
}

// Open disaster detail dialog
function openDisasterDialog(plotId: number) {
  activeDisasterPlotId.value = plotId;
  showDisasterModal.value = true;
  handleSound('click');
}

const currentDisasterConfig = computed<DisasterConfig | null>(() => {
  if (activeDisasterPlotId.value === null) return null;
  const plot = farmStore.plots.find((p) => p.id === activeDisasterPlotId.value);
  if (!plot || !plot.disaster) return null;
  return DISASTER_CONFIGS[plot.disaster];
});

// Resolve Disaster Action
function handleResolveDisaster() {
  if (activeDisasterPlotId.value === null) return;
  const res = farmStore.resolveDisaster(activeDisasterPlotId.value);
  if (res.ok) {
    handleSound('coin');
    ElMessage.success(res.msg);
    showDisasterModal.value = false;
  } else {
    ElMessage.warning(res.msg);
  }
}

// Unlock currently selected locked plot
function unlockCurrentSelectedPlot() {
  const plot = selectedPlot.value;
  if (!plot || plot.isUnlocked) return;
  const cost = 50 + Math.max(0, (plot.id - 2) * 15);
  const confirmed = window.confirm(`是否花費 ${cost} 🪙 開墾解鎖【第 ${plot.id + 1} 塊農田】？`);
  if (confirmed) {
    const res = farmStore.unlockPlot(plot.id);
    if (res.ok) {
      handleSound('coin');
      spawnFloat(plot.id, `- ${cost} 🪙 開拓完成!`, '#facc15');
      ElMessage.success(res.msg);
    } else {
      ElMessage.warning(res.msg);
    }
  }
}

// 針對單一格子執行指定用途
function executeToolOnPlot(plotId: number, tool: ActiveTool) {
  const plot = farmStore.plots.find((p) => p.id === plotId);
  if (!plot) return;

  // 未開墾格子防護：不可使用任何農具
  if (!plot.isUnlocked) {
    const toolNameMap: Record<ActiveTool, string> = {
      hoe: '鋤頭',
      water: '水壺',
      scythe: '鐮刀',
      seed: '種子',
      fertilizer: 'QA金肥料',
    };
    ElMessage.warning(`【第 ${plotId + 1} 塊田】尚未開墾（🔒），無法使用${toolNameMap[tool]}！請先點擊該田地開墾。`);
    return;
  }

  // 遭主管天災地塊防護：不可進行農耕，需先除災
  if (plot.disaster) {
    openDisasterDialog(plotId);
    return;
  }

  farmStore.activeTool = tool;
  const res = farmStore.interactPlot(plotId);
  if (!res) return;

  if (res.sound) {
    handleSound(res.sound as 'hoe' | 'water' | 'scythe' | 'plant' | 'sparkle' | 'harvest');
  }

  if ('harvested' in res && res.harvested) {
    spawnFloat(plotId, `+${res.harvested.sellPrice} 🪙`, '#fbbf24');
    spawnFloat(plotId, `+${res.harvested.score} 🏆`, '#f59e0b');
    spawnFloat(plotId, `+${res.harvested.exp} EXP`, '#60a5fa');
    ElMessage.success(res.msg);
  } else if (res.msg) {
    if (res.ok) {
      if (tool === 'fertilizer') {
        spawnFloat(plotId, '✨ 加速 1 小時!', '#f472b6');
      } else if (tool === 'water') {
        spawnFloat(plotId, '💧 已澆水', '#38bdf8');
      } else if (tool === 'hoe') {
        spawnFloat(plotId, '🌱 鬆土完成', '#a3e635');
      } else if (tool === 'seed') {
        spawnFloat(plotId, '🌰 播種完成', '#fbbf24');
      } else if (tool === 'scythe') {
        spawnFloat(plotId, '✂️ 割除完成', '#a3e635');
      }
      ElMessage.success(res.msg);
    } else if (!res.hasDisasterPrompt) {
      ElMessage.info({ message: res.msg, duration: 1800 });
    }
  }
}

// Plot Interaction（點擊單一格子時，先選中該格子）
function onPlotClick(plotId: number) {
  selectedPlotId.value = plotId;
  const plot = farmStore.plots.find((p) => p.id === plotId);
  if (!plot) return;

  // 1. 若該地塊正遭受主管天災，直接開啟除災對話框
  if (plot.disaster) {
    openDisasterDialog(plotId);
    return;
  }

  // 2. 若該地塊尚未開墾，提示是否花費金幣解鎖
  if (!plot.isUnlocked) {
    unlockCurrentSelectedPlot();
    return;
  }

  // 3. 快捷直覺操作：若有雜草，直接鐮刀除草
  if (plot.hasWeed) {
    executeToolOnPlot(plotId, 'scythe');
    return;
  }

  // 4. 快捷直覺操作：若作物已成熟，直接鐮刀收割
  if (plot.crop && plot.crop.isReady) {
    executeToolOnPlot(plotId, 'scythe');
    return;
  }

  // 5. 針對該單一格子執行當前手持工具
  executeToolOnPlot(plotId, farmStore.activeTool);
}

// Shop Actions
function onBuy(type: CropType) {
  const res = farmStore.buySeed(type, 1);
  if (res.ok) {
    handleSound('coin');
    ElMessage.success(res.msg);
  } else {
    ElMessage.warning(res.msg);
  }
}

function onSell(type: CropType) {
  const res = farmStore.sellCrop(type, 1);
  if (res.ok) {
    handleSound('coin');
    ElMessage.success(res.msg);
  } else {
    ElMessage.warning(res.msg);
  }
}

function onSellAll() {
  const res = farmStore.sellAllCrops();
  if (res.ok) {
    handleSound('coin');
    ElMessage.success(res.msg);
  } else {
    ElMessage.info(res.msg);
  }
}

// Task Claim
function onClaim(taskId: string) {
  const success = farmStore.claimTask(taskId);
  if (success) {
    handleSound('coin');
    ElMessage.success('🎉 領取獎勵成功！(+120 積分)');
  }
}

// Reset Farm Action
function handleResetFarm() {
  const confirmed = window.confirm(
    '確定要重置農場嗎？\n\n' +
    '・金額重置為 200 🪙\n' +
    '・遊玩積分重置為 0 🏆\n' +
    '・等級重置為 Lv.1\n' +
    '・農田重設為初始 2 塊已開墾空田（其餘 28 塊需花費金幣解鎖）\n' +
    '・天災冷卻重設（至少 1 小時後）\n' +
    '・雜草冷卻重設（至少 30 分鐘後）'
  );
  if (confirmed) {
    farmStore.resetFarm();
    handleSound('coin');
    ElMessage.success('農場已重置為初始 2 塊空田狀態！');
  }
}

// Timer Loop
let timer: number | null = null;

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    farmStore.tickUpdate();
  }
}

function handleBeforeUnload() {
  farmStore.saveState();
}

onMounted(() => {
  farmStore.loadState();
  timer = window.setInterval(() => {
    farmStore.tickUpdate();
  }, 1000);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  farmStore.saveState();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

// Tool list for rendering
const toolList = [
  { id: 'hoe' as ActiveTool, name: '鋤頭', icon: '⛏️', desc: '鬆土與整地' },
  { id: 'water' as ActiveTool, name: '水壺', icon: '💧', desc: '為乾涸土地澆水' },
  { id: 'scythe' as ActiveTool, name: '鐮刀', icon: '🌾', desc: '除草與收割成熟作物' },
  { id: 'seed' as ActiveTool, name: '種子袋', icon: '🌰', desc: '為選中農田播下種子' },
  { id: 'fertilizer' as ActiveTool, name: 'QA金肥料', icon: '✨', desc: '加速 1 小時！提單可獲得' },
];

const cropKeys: CropType[] = ['radish', 'wheat', 'strawberry', 'melon'];

const unclaimedCount = computed(() => {
  return farmStore.dailyTasks.filter((t) => t.current >= t.target && !t.claimed).length;
});

const leaderboardList = computed(() => {
  return farmStore.getLeaderboard(reportsStore.reports, authStore.currentDisplayName);
});
</script>

<template>
  <div class="farm-container select-none font-mono">
    <!-- Top HUD Bar: Level, Score, Gold, Fertilizer, Modals -->
    <div class="pixel-box bg-[#3a2012] border-[#221208] text-amber-100 p-2.5 mb-3 flex flex-wrap items-center justify-between gap-2 shadow-md">
      <!-- Player Info & Level & Score -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Level -->
        <div class="flex items-center gap-1.5 bg-[#25140b] px-2.5 py-1 rounded border border-[#522d19]">
          <span class="text-amber-400 font-bold text-xs">⭐ Lv.{{ farmStore.level }}</span>
          <div class="w-14 bg-[#160a04] h-2 rounded-full overflow-hidden border border-[#522d19]">
            <div
              class="bg-gradient-to-r from-amber-500 to-yellow-300 h-full transition-all duration-300"
              :style="{ width: `${farmStore.currentLevelProgress.percent}%` }"
            />
          </div>
          <span class="text-[10px] text-amber-300/80">{{ farmStore.currentLevelProgress.current }}/{{ farmStore.currentLevelProgress.max }}</span>
        </div>

        <!-- Farm Score / 積分 -->
        <div
          class="flex items-center gap-1 bg-gradient-to-r from-amber-950 to-[#25140b] px-2.5 py-1 rounded border border-amber-500/60 shadow-xs cursor-pointer hover:border-amber-400 transition"
          title="農場總積分：收成、除災、提單皆可累積積分！點擊查看排行榜"
          @click="showRankModal = true"
        >
          <span class="text-xs">🏆</span>
          <span class="text-[11px] font-bold text-amber-200">積分:</span>
          <span class="text-xs font-black text-yellow-300">{{ farmStore.score }}</span>
        </div>

        <!-- Gold -->
        <div class="flex items-center gap-1 bg-[#25140b] px-2.5 py-1 rounded border border-[#522d19]">
          <span class="text-xs">🪙</span>
          <span class="text-xs font-bold text-yellow-300">{{ farmStore.coins }}</span>
        </div>

        <!-- QA Fertilizer -->
        <div
          class="flex items-center gap-1 bg-gradient-to-r from-purple-950 to-[#25140b] px-2 py-1 rounded border border-purple-500/60 shadow-xs cursor-pointer hover:border-purple-400 transition"
          title="QA 金肥料：提單或上正式可自動獲得，點擊施肥直接加速作物 1 小時！"
          @click="selectTool('fertilizer')"
        >
          <span class="text-xs animate-pulse">✨</span>
          <span class="text-[11px] font-bold text-purple-200">QA肥:</span>
          <span class="text-xs font-black text-pink-300">{{ farmStore.fertilizer }}</span>
        </div>
      </div>

      <!-- Action Buttons: Leaderboard, Tasks, Shop, Sound -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <!-- Leaderboard Button -->
        <button
          type="button"
          class="pixel-btn bg-[#b45309] hover:bg-[#92400e] text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition"
          @click="showRankModal = true"
        >
          <span>🏆</span>
          <span>排行榜</span>
        </button>

        <!-- Daily QA Task Board Button -->
        <button
          type="button"
          class="relative pixel-btn bg-[#d97706] hover:bg-[#b45309] text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition"
          @click="showBoardModal = true"
        >
          <span>📜</span>
          <span>告示板</span>
          <span
            v-if="unclaimedCount > 0"
            class="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow"
          >
            {{ unclaimedCount }}
          </span>
        </button>

        <!-- Shop Button -->
        <button
          type="button"
          class="pixel-btn bg-[#059669] hover:bg-[#047857] text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition"
          @click="showShopModal = true"
        >
          <span>🏪</span>
          <span>商鋪</span>
        </button>

        <!-- Reset Button -->
        <button
          type="button"
          class="pixel-btn bg-[#7f1d1d] hover:bg-[#991b1b] text-white px-2 py-1 rounded text-xs flex items-center gap-1 transition"
          title="重置農場為標準 30 塊初始狀態"
          @click="handleResetFarm"
        >
          <span>🔄</span>
          <span>重置</span>
        </button>

        <!-- Sound Toggle -->
        <button
          type="button"
          class="pixel-btn bg-[#475569] hover:bg-[#334155] text-white p-1 rounded text-xs transition"
          :title="soundEnabled ? '關閉8-bit音效' : '開啟8-bit音效'"
          @click="soundEnabled = !soundEnabled"
        >
          <span>{{ soundEnabled ? '🔊' : '🔇' }}</span>
        </button>
      </div>
    </div>

    <!-- Main Farm Land Canvas (3x4 Grid = 12 Plots) -->
    <div class="farm-ground relative bg-[#5c8a32] p-4 rounded-xl border-4 border-[#324f1c] shadow-inner overflow-hidden min-h-[300px]">
      <div class="absolute inset-0 opacity-15 pointer-events-none pixel-grass-pattern"></div>

      <!-- Grid of 30 Plots (6 cols x 5 rows) -->
      <div class="relative z-10 grid grid-cols-5 sm:grid-cols-6 gap-1.5 sm:gap-2 max-h-[460px] overflow-y-auto pr-1">
        <div
          v-for="plot in farmStore.plots"
          :key="plot.id"
          class="plot-card relative rounded-lg border-2 transition duration-150 cursor-pointer overflow-hidden flex flex-col justify-between p-1 h-20 sm:h-22"
          :class="[
            selectedPlotId === plot.id
              ? 'border-amber-300 ring-2 ring-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.45)] z-20 scale-[1.02]'
              : 'hover:border-amber-200/50',
            plot.disaster
              ? 'bg-[#3b0b14] border-rose-500 ring-2 ring-rose-400 animate-pulse'
              : !plot.isUnlocked
              ? 'bg-[#405626]/80 border-dashed border-[#243314] hover:bg-[#405626]'
              : !plot.isTilled
              ? 'bg-[#7ba049] border-[#4e6b26] hover:brightness-105'
              : plot.wateredUntil > Date.now()
              ? 'bg-[#53321d] border-[#381e0e] ring-1 ring-blue-400/40'
              : 'bg-[#8d5b36] border-[#5e381f]'
          ]"
          @click="onPlotClick(plot.id)"
        >
          <!-- Plot ID Label -->
          <div
            class="absolute top-0.5 left-1 text-[8px] font-mono font-bold pointer-events-none z-10"
            :class="selectedPlotId === plot.id ? 'text-amber-200' : 'text-white/60'"
          >
            #{{ plot.id + 1 }}
          </div>

          <!-- Retro Pixel Focus Pointer & Corner Brackets (Only shown when selected) -->
          <template v-if="selectedPlotId === plot.id">
            <!-- Top bouncing cursor indicator -->
            <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 text-yellow-300 text-[9px] animate-bounce pointer-events-none z-30 drop-shadow">
              ▼
            </div>
            <!-- 4 Pixel Corner Brackets -->
            <div class="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t-2 border-l-2 border-yellow-200 pointer-events-none z-20" />
            <div class="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t-2 border-r-2 border-yellow-200 pointer-events-none z-20" />
            <div class="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b-2 border-l-2 border-yellow-200 pointer-events-none z-20" />
            <div class="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b-2 border-r-2 border-yellow-200 pointer-events-none z-20" />
          </template>
          <!-- 0. NATURAL DISASTER STATE (主管突襲) -->
          <template v-if="plot.disaster">
            <div class="h-full flex flex-col items-center justify-between text-center py-0.5">
              <div class="flex items-center justify-between w-full text-[9px] text-rose-300 font-bold">
                <span class="animate-bounce">🚨 突發災難</span>
                <span class="bg-rose-950 px-1 rounded text-yellow-300">
                  {{ DISASTER_CONFIGS[plot.disaster].cost }}🪙除災
                </span>
              </div>
              <div class="text-xl sm:text-2xl animate-bounce">
                {{ DISASTER_CONFIGS[plot.disaster].icon }}
              </div>
              <div class="text-[9px] font-bold bg-rose-900/90 text-rose-100 px-1 py-0.2 rounded w-full truncate">
                {{ DISASTER_CONFIGS[plot.disaster].bossName }}
              </div>
            </div>
          </template>

          <!-- 1. LOCKED PLOT -->
          <template v-else-if="!plot.isUnlocked">
            <div class="h-full flex flex-col items-center justify-center text-center">
              <span class="text-xs sm:text-sm">🔒</span>
              <span class="text-[9px] text-amber-200/90 font-bold mt-0.5">開墾地塊</span>
              <span class="text-[9px] text-yellow-300 font-bold">{{ 50 + Math.max(0, (plot.id - 2) * 15) }} 🪙</span>
            </div>
          </template>

          <!-- 2. UNTILLED PLOT -->
          <template v-else-if="!plot.isTilled">
            <div class="h-full flex flex-col items-center justify-center text-center">
              <span class="text-sm opacity-60">🌿</span>
              <span class="text-[10px] text-[#2c3d18] font-bold">待鬆土</span>
              <span class="text-[9px] text-[#3d5521]">(用鋤頭開墾)</span>
            </div>
          </template>

          <!-- 3. TILLED PLOT (NORMAL FARMING) -->
          <template v-else>
            <!-- Header Status -->
            <div class="flex items-center justify-between text-[10px] leading-none">
              <span
                v-if="plot.wateredUntil > Date.now()"
                class="text-sky-300 font-bold flex items-center gap-0.5"
                title="土壤濕潤生長中"
              >
                💧
              </span>
              <span
                v-else
                class="text-amber-300/80 font-bold flex items-center gap-0.5"
                title="土壤乾涸，請用水壺澆水"
              >
                🍂
              </span>

              <span v-if="plot.hasWeed" class="text-rose-400 font-bold animate-pulse text-[11px]" title="雜草叢生！請用鐮刀除草">
                ⚠️草
              </span>
            </div>

            <!-- Weed in plot -->
            <div v-if="plot.hasWeed" class="flex-1 flex flex-col items-center justify-center">
              <span class="text-2xl animate-bounce">🌾</span>
              <span class="text-[9px] text-rose-300 font-bold bg-black/40 px-1 rounded">長雜草了</span>
            </div>

            <!-- Crop in plot -->
            <div v-else-if="plot.crop" class="flex-1 flex flex-col items-center justify-center">
              <!-- Ready to Harvest! -->
              <template v-if="plot.crop.isReady">
                <div class="flex flex-col items-center animate-bounce">
                  <span class="text-2xl filter drop-shadow">{{ CROP_CONFIGS[plot.crop.type].icon }}</span>
                  <span class="text-[9px] font-bold text-yellow-300 bg-black/60 px-1.5 py-0.2 rounded-full mt-0.5 border border-yellow-400/60">
                    可收割 ✨
                  </span>
                </div>
              </template>

              <!-- Growing Crop -->
              <template v-else>
                <div class="flex flex-col items-center">
                  <span class="text-lg">
                    {{
                      (plot.crop.accumulatedMs / plot.crop.totalDurationMs) < 0.3
                        ? '🌱'
                        : (plot.crop.accumulatedMs / plot.crop.totalDurationMs) < 0.7
                        ? '🌿'
                        : CROP_CONFIGS[plot.crop.type].icon
                    }}
                  </span>

                  <!-- Mini Progress Bar -->
                  <div class="w-full bg-black/50 h-1.5 rounded-full overflow-hidden mt-1 border border-white/20">
                    <div
                      class="bg-emerald-400 h-full transition-all duration-300"
                      :style="{ width: `${Math.min(100, Math.round((plot.crop.accumulatedMs / plot.crop.totalDurationMs) * 100))}%` }"
                    />
                  </div>

                  <!-- Time remaining or Dry indicator -->
                  <span
                    v-if="plot.wateredUntil <= Date.now()"
                    class="text-[9px] text-amber-200 bg-rose-900/80 px-1 rounded mt-0.5"
                  >
                    需澆水生長
                  </span>
                  <span
                    v-else
                    class="text-[9px] text-emerald-200 mt-0.5"
                  >
                    {{ formatRemainingTime(plot.crop.totalDurationMs - plot.crop.accumulatedMs) }}
                  </span>
                </div>
              </template>
            </div>

            <!-- Empty Tilled Ground -->
            <div v-else class="flex-1 flex flex-col items-center justify-center text-center">
              <span class="text-xs opacity-40">🌰</span>
              <span class="text-[9px] text-amber-200/60">空田</span>
            </div>
          </template>

          <!-- Floating messages inside this specific plot only -->
          <div
            v-for="f in floatMsgs.filter((m) => m.plotId === plot.id)"
            :key="f.id"
            class="absolute pointer-events-none font-bold text-xs animate-float z-30 left-1/2 -translate-x-1/2 top-3 whitespace-nowrap drop-shadow"
            :style="{ color: f.color }"
          >
            {{ f.text }}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Retro Pixel Toolbar -->
    <div class="pixel-box bg-[#3a2012] border-[#221208] text-amber-100 p-2 mt-3 shadow-lg">
      <!-- Current Selected Plot Target Info Bar -->
      <div class="flex items-center justify-between bg-[#221006] px-2.5 py-1.5 rounded border border-[#522d19] mb-2 text-xs flex-wrap gap-2">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-yellow-400 font-bold flex items-center gap-1">
            <span>🎯</span>
            <span>已鎖定【第 {{ (selectedPlot?.id ?? 0) + 1 }} 塊地】</span>
          </span>
          <span class="text-stone-500">|</span>
          <span v-if="!selectedPlot?.isUnlocked" class="text-amber-300 font-bold flex items-center gap-1">
            <span>🔒 未開墾</span>
            <span class="text-yellow-300 font-mono">(需 {{ 50 + Math.max(0, ((selectedPlot?.id ?? 0) - 2) * 15) }} 🪙)</span>
          </span>
          <span v-else-if="selectedPlot?.disaster" class="text-rose-400 font-bold animate-pulse">
            🚨 遭遇【{{ DISASTER_CONFIGS[selectedPlot.disaster].bossName }}】突襲中！
          </span>
          <span v-else-if="selectedPlot?.hasWeed" class="text-rose-300 font-bold">
            ⚠️ 雜草叢生 (請點鐮刀割除)
          </span>
          <span v-else-if="!selectedPlot?.isTilled" class="text-lime-300">
            🌿 待鬆土 (請點鋤頭整地)
          </span>
          <span v-else-if="selectedPlot?.crop" class="text-amber-200">
            {{ CROP_CONFIGS[selectedPlot.crop.type].icon }} {{ CROP_CONFIGS[selectedPlot.crop.type].name }}
            <span v-if="selectedPlot.crop.isReady" class="text-green-400 font-bold font-mono">（已成熟！請點鐮刀收成）</span>
            <span v-else class="text-sky-300 font-mono">
              （{{ selectedPlot.crop.wateredUntil > Date.now() ? '生長中' : '土壤乾涸缺水中' }}，還需 {{ formatRemainingTime(selectedPlot.crop.totalDurationMs - selectedPlot.crop.accumulatedMs) }}）
            </span>
          </span>
          <span v-else class="text-amber-300/90">
            🌱 空田已鬆土
            <span :class="selectedPlot?.wateredUntil > Date.now() ? 'text-sky-300' : 'text-amber-400/80'">
              ({{ selectedPlot?.wateredUntil > Date.now() ? '💧 土壤濕潤' : '🍂 土壤乾涸，請點水壺澆水' }})
            </span>
          </span>
        </div>

        <!-- Quick Unlock Button for locked plot -->
        <button
          v-if="!selectedPlot?.isUnlocked"
          type="button"
          class="pixel-btn bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-2 py-0.5 rounded text-xs transition"
          @click="unlockCurrentSelectedPlot"
        >
          🪙 立即開墾 ({{ 50 + Math.max(0, ((selectedPlot?.id ?? 0) - 2) * 15) }}🪙)
        </button>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-between gap-2">
        <!-- Tools Palette -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            v-for="t in toolList"
            :key="t.id"
            type="button"
            class="tool-btn px-2.5 py-1.5 rounded border-2 text-xs flex items-center gap-1 font-bold transition"
            :class="[
              farmStore.activeTool === t.id
                ? 'bg-amber-500 border-yellow-200 text-stone-950 shadow-md scale-105'
                : 'bg-[#25140b] border-[#522d19] text-amber-200 hover:bg-[#341d10]'
            ]"
            :title="`切換為【${t.name}】：點擊上方任一田地即可使用`"
            @click="onToolClick(t.id)"
          >
            <span>{{ t.icon }}</span>
            <span>{{ t.name }}</span>
            <span
              v-if="t.id === 'fertilizer'"
              class="text-[10px] px-1 rounded bg-purple-900 text-pink-200 border border-purple-400"
            >
              {{ farmStore.fertilizer }}
            </span>
          </button>
        </div>

        <!-- Seed Selector -->
        <div v-if="farmStore.activeTool === 'seed'" class="flex items-center gap-1.5 bg-[#25140b] p-1 rounded border border-[#522d19]">
          <span class="text-[11px] text-amber-300 font-bold ml-1">選擇種子:</span>
          <div class="flex items-center gap-1">
            <button
              v-for="cropKey in cropKeys"
              :key="cropKey"
              type="button"
              class="px-2 py-0.5 rounded text-xs border transition flex items-center gap-1"
              :class="[
                farmStore.selectedSeed === cropKey
                  ? 'bg-amber-400 text-stone-950 font-bold border-yellow-200'
                  : 'bg-[#180d07] text-amber-100 border-[#422414] hover:bg-[#28160c]'
              ]"
              @click="farmStore.selectedSeed = cropKey"
            >
              <span>{{ CROP_CONFIGS[cropKey].icon }}</span>
              <span>{{ CROP_CONFIGS[cropKey].name }}</span>
              <span class="text-[10px] text-amber-400 font-mono">({{ farmStore.seeds[cropKey] || 0 }})</span>
            </button>
          </div>
        </div>

        <!-- Tool Helper Tip -->
        <div v-else class="text-[11px] text-amber-300/80 italic">
          {{ toolList.find((t) => t.id === farmStore.activeTool)?.desc }}
        </div>
      </div>
    </div>

    <!-- MODAL 0: 職場主管天然災害緊急通報 -->
    <el-dialog
      v-model="showDisasterModal"
      title="🚨 職場主管天然災害突襲！"
      width="440px"
      append-to-body
      destroy-on-close
    >
      <div v-if="currentDisasterConfig" class="space-y-4 font-mono text-xs">
        <div class="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-3">
          <span class="text-4xl animate-bounce">{{ currentDisasterConfig.icon }}</span>
          <div>
            <div class="text-sm font-bold text-rose-800 flex items-center gap-1">
              <span>【{{ currentDisasterConfig.disasterName }}】</span>
            </div>
            <div class="text-xs text-rose-600 font-bold mt-0.5">
              肇事者：{{ currentDisasterConfig.bossName }}
            </div>
            <p class="text-slate-700 mt-2 leading-relaxed text-[11px] bg-white/80 p-2 rounded border border-rose-200">
              {{ currentDisasterConfig.desc }}
            </p>
          </div>
        </div>

        <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 leading-relaxed text-[11px]">
          ⚠️ <strong>災害影響：</strong>該塊農田作物已暫停生長！必須花費資金處理主管以恢復耕作。
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-100">
          <div class="text-xs font-bold text-slate-700">
            除災資金需求: <span class="text-amber-600 font-black">🪙 {{ currentDisasterConfig.cost }}</span>
            <span class="text-slate-400 ml-1">（我的金幣: {{ farmStore.coins }}）</span>
          </div>

          <div class="flex items-center gap-2">
            <el-button size="small" @click="showDisasterModal = false">暫緩處理</el-button>
            <el-button
              type="danger"
              size="small"
              :disabled="farmStore.coins < currentDisasterConfig.cost"
              @click="handleResolveDisaster"
            >
              🛡️ 花費 {{ currentDisasterConfig.cost }} 🪙 迎合除災
            </el-button>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- MODAL 1: 🏆 QA 農莊榮譽排行榜 -->
    <el-dialog
      v-model="showRankModal"
      title="🏆 QA 晴空農莊 榮譽排行榜"
      width="480px"
      append-to-body
      destroy-on-close
    >
      <div class="space-y-4 font-mono text-xs">
        <p class="text-slate-600">
          排行榜以團隊成員的<strong>實際最高遊玩紀錄</strong>進行排名，未開始耕作之同仁為 0 分！
        </p>

        <!-- Ranking Table -->
        <div class="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          <div
            v-for="item in leaderboardList"
            :key="item.name"
            class="p-2.5 flex items-center justify-between transition"
            :class="[
              item.isSelf
                ? 'bg-amber-50/90 font-bold border-l-4 border-amber-500'
                : item.rank === 1
                ? 'bg-yellow-50/50'
                : 'bg-white hover:bg-slate-50'
            ]"
          >
            <div class="flex items-center gap-2.5">
              <!-- Rank Medal -->
              <span class="text-base w-6 text-center font-black">
                {{
                  item.rank === 1
                    ? '🥇'
                    : item.rank === 2
                    ? '🥈'
                    : item.rank === 3
                    ? '🥉'
                    : `#${item.rank}`
                }}
              </span>

              <span class="text-xl">{{ item.avatar }}</span>

              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-slate-800 text-xs">{{ item.name }}</span>
                  <span v-if="item.isSelf" class="text-[10px] bg-amber-500 text-white px-1 rounded font-bold">我</span>
                </div>
                <div class="text-[10px] text-slate-500">
                  {{ item.title }} · 擊退主管: <span class="font-bold text-rose-600">{{ item.disastersCleared }} 次</span>
                </div>
              </div>
            </div>

            <!-- Score -->
            <div class="text-right">
              <div class="text-xs font-black text-amber-600 flex items-center gap-0.5 justify-end">
                <span>🏆</span>
                <span>{{ item.score }}</span>
              </div>
              <div class="text-[10px] text-slate-400">Lv.{{ item.level }}</div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- MODAL 2: QA Task Board -->
    <el-dialog
      v-model="showBoardModal"
      title="📜 QA 農莊每日告示板"
      width="460px"
      append-to-body
      destroy-on-close
    >
      <div class="space-y-3 font-mono text-xs">
        <p class="text-slate-600 leading-relaxed">
          完成工作台測試單與日常巡田，可領取大量金幣、稀有種子與 <strong>QA 金肥料</strong>！
        </p>

        <div class="space-y-2">
          <div
            v-for="task in farmStore.dailyTasks"
            :key="task.id"
            class="p-3 rounded-lg border flex items-center justify-between gap-3"
            :class="[
              task.claimed
                ? 'bg-slate-50 border-slate-200 opacity-60'
                : task.current >= task.target
                ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
                : 'bg-white border-slate-200'
            ]"
          >
            <div>
              <div class="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <span>{{ task.title }}</span>
                <span
                  class="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold"
                  :class="task.claimed ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'"
                >
                  進度: {{ task.current }} / {{ task.target }}
                </span>
              </div>
              <p class="text-slate-500 text-xs mt-0.5">{{ task.desc }}</p>
              <div class="flex items-center gap-2 mt-1 text-[11px] font-bold text-amber-700">
                <span>獎勵:</span>
                <span>🪙 +{{ task.rewardCoins }}</span>
                <span v-if="task.rewardFertilizer > 0" class="text-purple-600">✨ +{{ task.rewardFertilizer }} 肥料</span>
                <span v-if="task.rewardSeeds" class="text-emerald-600">
                  {{ CROP_CONFIGS[task.rewardSeeds.type].icon }} +{{ task.rewardSeeds.count }} 種子
                </span>
              </div>
            </div>

            <div>
              <el-button
                v-if="task.claimed"
                size="small"
                disabled
              >
                已領取
              </el-button>
              <el-button
                v-else-if="task.current >= task.target"
                type="success"
                size="small"
                @click="onClaim(task.id)"
              >
                領取獎勵
              </el-button>
              <el-button
                v-else
                size="small"
                disabled
              >
                未達成
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- MODAL 3: Shop & Inventory Modal -->
    <el-dialog
      v-model="showShopModal"
      title="🏪 農莊雜貨商鋪"
      width="520px"
      append-to-body
      destroy-on-close
    >
      <div class="space-y-4 font-mono">
        <div class="flex items-center border-b border-slate-200 pb-2 gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-md font-bold text-xs transition"
            :class="shopTab === 'buy' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            @click="shopTab = 'buy'"
          >
            🌱 購買種子
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-md font-bold text-xs transition"
            :class="shopTab === 'sell' ? 'bg-amber-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            @click="shopTab = 'sell'"
          >
            💰 販售農穫
          </button>

          <div class="ml-auto text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            我的金幣: 🪙 {{ farmStore.coins }}
          </div>
        </div>

        <!-- TAB: BUY SEEDS -->
        <div v-if="shopTab === 'buy'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div
            v-for="crop in Object.values(CROP_CONFIGS)"
            :key="crop.type"
            class="p-3 rounded-lg border border-slate-200 bg-white flex flex-col justify-between hover:border-emerald-400 transition"
          >
            <div>
              <div class="flex items-center justify-between">
                <span class="text-base font-bold text-slate-800 flex items-center gap-1">
                  <span>{{ crop.icon }}</span>
                  <span>{{ crop.name }}</span>
                </span>
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded font-bold"
                  :class="farmStore.level >= crop.unlockLevel ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'"
                >
                  Lv.{{ crop.unlockLevel }} 解鎖
                </span>
              </div>
              <p class="text-slate-500 text-[11px] mt-1">{{ crop.description }}</p>
              <div class="mt-2 text-slate-600 space-y-0.5 text-[11px]">
                <div>生長時間：<span class="font-bold text-slate-800">{{ formatRemainingTime(crop.growthTimeMs) }}</span></div>
                <div>收成售價：<span class="font-bold text-emerald-600">🪙 {{ crop.sellPrice }}</span> (+{{ crop.score }} 🏆)</div>
              </div>
            </div>

            <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span class="font-bold text-amber-600">🪙 {{ crop.seedCost }}</span>
              <el-button
                size="small"
                type="success"
                :disabled="farmStore.level < crop.unlockLevel || farmStore.coins < crop.seedCost"
                @click="onBuy(crop.type)"
              >
                購買 1 包
              </el-button>
            </div>
          </div>
        </div>

        <!-- TAB: SELL CROPS -->
        <div v-else class="space-y-3 text-xs">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <span class="text-slate-500">背包中的收成作物可直接換成金幣！</span>
            <el-button type="warning" size="small" @click="onSellAll">
              💰 一鍵全部販售
            </el-button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="crop in Object.values(CROP_CONFIGS)"
              :key="crop.type"
              class="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between"
            >
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ crop.icon }}</span>
                <div>
                  <div class="font-bold text-slate-800">{{ crop.name }}</div>
                  <div class="text-[11px] text-slate-500">
                    庫存: <span class="font-bold text-slate-800">{{ farmStore.inventory[crop.type] || 0 }}</span> 個
                  </div>
                  <div class="text-[11px] text-emerald-600 font-bold">
                    單價: 🪙 {{ crop.sellPrice }} (+{{ crop.score }} 🏆)
                  </div>
                </div>
              </div>

              <el-button
                size="small"
                type="primary"
                plain
                :disabled="!farmStore.inventory[crop.type]"
                @click="onSell(crop.type)"
              >
                賣出 1 個
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.farm-container {
  image-rendering: pixelated;
}

.pixel-box {
  box-shadow: 0 4px 0 #180d07;
  border-width: 3px;
}

.pixel-btn {
  box-shadow: 0 2px 0 #00000040;
}
.pixel-btn:active {
  transform: translateY(2px);
  box-shadow: none;
}

.tool-btn:active {
  transform: translateY(2px);
}

.pixel-grass-pattern {
  background-image: radial-gradient(#ffffff20 1px, transparent 1px);
  background-size: 8px 8px;
}

@keyframes floatUp {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-24px);
  }
}

.animate-float {
  animation: floatUp 1.2s ease-out forwards;
}
</style>
