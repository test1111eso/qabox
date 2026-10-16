<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import { statsApi, reportsApi } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getTaiwanFirstDay, getTaiwanToday } from '@/utils/date';
import type { DashboardStats, Report } from '@/types';
import { Chart, registerables } from 'chart.js';
import {
  Refresh,
  DataLine,
  Warning,
  CircleClose,
  Document,
  DocumentCopy,
  ArrowDown,
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

Chart.register(...registerables);

const authStore = useAuthStore();

const startDate = ref(getTaiwanFirstDay());
const endDate = ref(getTaiwanToday());
const loading = ref(false);

const statsData = ref<DashboardStats>({
  statusStats: [],
  dailyStats: [],
  testerStats: [],
  typeStats: { t_count: 0, p_count: 0 },
  monthTotal: 0,
  openBlockedCount: 0,
  openFailCount: 0,
});

// Selected testers for filtering table
const selectedTesters = ref<string[]>([]);

let dailyChart: Chart | null = null;
let statusChart: Chart | null = null;

const dailyChartCanvas = ref<HTMLCanvasElement | null>(null);
const statusChartCanvas = ref<HTMLCanvasElement | null>(null);

// Issue detail drawer
const showIssueDrawer = ref(false);
const issueDrawerTitle = ref('');
const issueReports = ref<Report[]>([]);
const issueLoading = ref(false);

// Detail preview drawer for specific report
const showDetailDrawer = ref(false);
const viewingReport = ref<Report | null>(null);

const activeTestersList = computed(() => {
  return statsData.value.testerStats.filter((t) => t.tester_name !== 'admin');
});

const sortedFilteredTesters = computed(() => {
  const currentName = authStore.currentDisplayName;
  const filtered = activeTestersList.value.filter((t) =>
    selectedTesters.value.includes(t.tester_name)
  );

  return [...filtered].sort((a, b) => {
    if (a.tester_name === currentName) return -1;
    if (b.tester_name === currentName) return 1;
    if (b.month_count !== a.month_count) {
      return b.month_count - a.month_count;
    }
    return b.today_count - a.today_count;
  });
});

async function loadStats() {
  loading.value = true;
  try {
    const data = await statsApi.getStats(startDate.value, endDate.value);
    statsData.value = data;

    // By default, select all active (not resigned) testers
    if (selectedTesters.value.length === 0 && data.testerStats) {
      selectedTesters.value = data.testerStats
        .filter((t) => t.tester_name !== 'admin' && t.is_active !== 0)
        .map((t) => t.tester_name);
    }

    await nextTick();
    renderCharts();
  } catch (err: any) {
    ElMessage.error(err.message || '載入統計數據失敗');
  } finally {
    loading.value = false;
  }
}

function renderCharts() {
  // 1. Daily Trend Line Chart
  if (dailyChartCanvas.value) {
    if (dailyChart) dailyChart.destroy();
    const ctx = dailyChartCanvas.value.getContext('2d');
    if (ctx && statsData.value.dailyStats) {
      // Reverse to show oldest to newest (left to right)
      const reversedDaily = [...statsData.value.dailyStats].reverse();
      const labels = reversedDaily.map((d) => d.test_date?.slice(5) || '');
      const counts = reversedDaily.map((d) => d.count || 0);

      dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: '每日案件量',
              data: counts,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              pointBackgroundColor: '#2563eb',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => ` 件數: ${context.raw} 筆`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 },
              grid: { color: 'rgba(226, 232, 240, 0.6)' },
            },
            x: {
              grid: { display: false },
            },
          },
        },
      });
    }
  }

  // 2. Status Doughnut Chart
  if (statusChartCanvas.value) {
    if (statusChart) statusChart.destroy();
    const ctx = statusChartCanvas.value.getContext('2d');
    if (ctx && statsData.value.statusStats) {
      const labels = statsData.value.statusStats.map((s) => {
        if (s.status === 'Pass') return '驗證通過 (Pass)';
        if (s.status === 'Fail') return '驗證失敗 (Fail)';
        if (s.status === 'BLOCKED' || s.status === 'Blocked') return '阻礙中 (Blocked)';
        return s.status;
      });
      const counts = statsData.value.statusStats.map((s) => s.count);
      const colors = statsData.value.statusStats.map((s) => {
        if (s.status === 'Pass') return '#10b981';
        if (s.status === 'Fail') return '#f43f5e';
        if (s.status === 'BLOCKED' || s.status === 'Blocked') return '#f59e0b';
        return '#94a3b8';
      });

      statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: counts,
              backgroundColor: colors,
              hoverOffset: 6,
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { size: 11 },
              },
            },
          },
        },
      });
    }
  }
}

async function openIssueReports(type: 'fail' | 'blocked' | 'all') {
  issueLoading.value = true;
  issueDrawerTitle.value =
    type === 'blocked' ? '阻礙中 (Blocked) 案件清單' : type === 'fail' ? '測試失敗 (Fail) 案件清單' : '未解決異常案件';
  showIssueDrawer.value = true;
  try {
    const data = await reportsApi.getReports({
      status: type === 'blocked' ? 'Blocked' : type === 'fail' ? 'Fail' : undefined,
    });
    issueReports.value = data.filter((r) => !r.is_deleted);
  } catch (err: any) {
    ElMessage.error(err.message || '載入案件失敗');
  } finally {
    issueLoading.value = false;
  }
}

function selectAllTesters() {
  selectedTesters.value = activeTestersList.value.map((t) => t.tester_name);
}

function clearAllTesters() {
  selectedTesters.value = [];
}

function openViewReport(report: Report) {
  viewingReport.value = report;
  showDetailDrawer.value = true;
}

async function handleCopyNotes(notes: string) {
  try {
    await navigator.clipboard.writeText(notes);
    ElMessage.success('報告內容已複製至剪貼簿！');
  } catch {
    ElMessage.error('複製失敗');
  }
}

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Filter bar -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-base font-bold text-slate-800">QA 數據統計儀表板</h2>
        <p class="text-xs text-slate-500 mt-0.5">即時分析團隊測試產能、案件驗證狀態與個人負載明細</p>
      </div>

      <div class="flex items-center gap-3">
        <el-date-picker
          v-model="startDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="開始"
          class="!w-36"
        />
        <span class="text-xs text-slate-400">至</span>
        <el-date-picker
          v-model="endDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="結束"
          class="!w-36"
        />
        <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadStats">
          查詢
        </el-button>
      </div>
    </div>

    <!-- 4 Summary KPI Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total Count -->
      <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-500">區間測試總量</span>
          <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <el-icon><DataLine /></el-icon>
          </div>
        </div>
        <div class="text-2xl font-black text-slate-800 mt-2">{{ statsData.monthTotal || 0 }}</div>
        <div class="text-xs text-slate-400 mt-1">選定日期區間累計完成案件</div>
      </div>

      <!-- T / P counts -->
      <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-indigo-600">案件分類統計</span>
          <div class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <el-icon><Document /></el-icon>
          </div>
        </div>
        <div class="flex items-baseline gap-3 mt-2">
          <div>
            <span class="text-xs text-slate-500">T單 (測試): </span>
            <span class="text-xl font-black text-blue-600">{{ statsData.typeStats?.t_count || 0 }}</span>
          </div>
          <div>
            <span class="text-xs text-slate-500">P單 (上正式): </span>
            <span class="text-xl font-black text-rose-600">{{ statsData.typeStats?.p_count || 0 }}</span>
          </div>
        </div>
        <div class="text-xs text-slate-400 mt-1">一般測試與發布案件分佈</div>
      </div>

      <!-- Open Fail (clickable) -->
      <div
        class="bg-white rounded-xl p-5 shadow-sm border border-rose-200 cursor-pointer hover:shadow-md transition"
        @click="openIssueReports('fail')"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-rose-600">全站未解決失敗</span>
          <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <el-icon><CircleClose /></el-icon>
          </div>
        </div>
        <div class="text-2xl font-black text-rose-600 mt-2">{{ statsData.openFailCount || 0 }}</div>
        <div class="text-xs text-rose-400 mt-1 flex items-center justify-between">
          <span>待開發人員修復</span>
          <span class="text-xs underline font-semibold">查看清單 →</span>
        </div>
      </div>

      <!-- Open Blocked (clickable) -->
      <div
        class="bg-white rounded-xl p-5 shadow-sm border border-amber-200 cursor-pointer hover:shadow-md transition"
        @click="openIssueReports('blocked')"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-amber-600">全站未解決阻礙中</span>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <el-icon><Warning /></el-icon>
          </div>
        </div>
        <div class="text-2xl font-black text-amber-600 mt-2">{{ statsData.openBlockedCount || 0 }}</div>
        <div class="text-xs text-amber-500 mt-1 flex items-center justify-between">
          <span>環境或依賴阻斷</span>
          <span class="text-xs underline font-semibold">查看清單 →</span>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- Line Chart (8 cols) -->
      <div class="lg:col-span-8 bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h3 class="text-sm font-bold text-slate-800 mb-4">每日測試產能趨勢 (最近 30 天)</h3>
        <div class="h-72 w-full relative">
          <canvas ref="dailyChartCanvas"></canvas>
        </div>
      </div>

      <!-- Doughnut Chart (4 cols) -->
      <div class="lg:col-span-4 bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h3 class="text-sm font-bold text-slate-800 mb-4">案件狀態分佈</h3>
        <div class="h-72 w-full relative">
          <canvas ref="statusChartCanvas"></canvas>
        </div>
      </div>
    </div>

    <!-- 測試員案件統計 Card (Exact UI match) -->
    <div class="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-4">
      <!-- Header with Icon & Title -->
      <div class="flex items-center gap-2">
        <svg
          class="w-5 h-5 text-blue-500 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="5" r="2.5"></circle>
          <circle cx="5" cy="19" r="2.5"></circle>
          <circle cx="19" cy="19" r="2.5"></circle>
          <path d="M12 7.5 L6.5 16.5"></path>
          <path d="M12 7.5 L17.5 16.5"></path>
        </svg>
        <h3 class="text-base font-bold text-slate-800 tracking-tight">測試員案件統計</h3>
      </div>

      <!-- Dropdown Selector Button -->
      <div>
        <el-popover
          trigger="click"
          width="280"
          placement="bottom-start"
          popper-class="!p-3 !rounded-xl !shadow-lg !border-slate-200"
        >
          <template #reference>
            <button
              type="button"
              class="inline-flex items-center justify-between min-w-[210px] px-3.5 py-2 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-2xs hover:border-slate-400 hover:bg-slate-50/50 cursor-pointer transition focus:outline-none"
            >
              <span>選擇測試員 (已勾選 <span class="text-blue-600 font-bold">{{ selectedTesters.length }}</span> 人)</span>
              <el-icon class="text-slate-400 text-xs ml-3"><ArrowDown /></el-icon>
            </button>
          </template>

          <div class="space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
              <span class="text-slate-500 font-semibold">選擇欲顯示之測試員</span>
              <div class="space-x-2">
                <button
                  type="button"
                  class="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                  @click="selectAllTesters"
                >
                  全選
                </button>
                <span class="text-slate-200">|</span>
                <button
                  type="button"
                  class="text-slate-500 hover:text-slate-700 cursor-pointer"
                  @click="clearAllTesters"
                >
                  清空
                </button>
              </div>
            </div>

            <div class="max-h-60 overflow-y-auto space-y-1 pr-1">
              <el-checkbox-group v-model="selectedTesters" class="flex flex-col gap-1.5">
                <el-checkbox
                  v-for="t in activeTestersList"
                  :key="t.tester_name"
                  :label="t.tester_name"
                  class="!mr-0 !h-auto py-1"
                >
                  <span :class="t.is_active === 0 ? 'text-slate-400 line-through' : 'text-slate-700'">
                    {{ t.tester_name }}
                  </span>
                  <span
                    v-if="t.tester_name === authStore.currentDisplayName"
                    class="ml-1 text-[10px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded font-semibold"
                  >
                    我
                  </span>
                  <span
                    v-if="t.is_active === 0"
                    class="ml-1 text-[10px] bg-slate-100 text-slate-400 px-1 py-0.5 rounded"
                  >
                    離職
                  </span>
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
        </el-popover>
      </div>

      <!-- Statistics Table -->
      <div class="overflow-x-auto pt-1">
        <table class="w-full text-left border-collapse" v-loading="loading">
          <thead>
            <tr class="border-b border-slate-100 text-slate-500 text-xs">
              <th class="py-3 px-4 font-normal text-slate-500 w-1/5">測試員</th>
              <th class="py-3 px-4 text-center font-normal w-1/5">
                <div class="text-xs text-slate-600 font-medium mb-0.5">今日</div>
                <div class="text-[11px] text-slate-400 font-normal">測試 / 上正式</div>
              </th>
              <th class="py-3 px-4 text-center font-normal w-1/5">
                <div class="text-xs text-slate-600 font-medium mb-0.5">本週</div>
                <div class="text-[11px] text-slate-400 font-normal">測試 / 上正式</div>
              </th>
              <th class="py-3 px-4 text-center font-normal w-1/5">
                <div class="text-xs text-slate-600 font-medium mb-0.5">本月</div>
                <div class="text-[11px] text-slate-400 font-normal">測試 / 上正式</div>
              </th>
              <th class="py-3 px-4 text-center font-normal w-1/5">
                <div class="text-xs text-slate-600 font-medium mb-0.5">累計</div>
                <div class="text-[11px] text-slate-400 font-normal">測試 / 上正式</div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in sortedFilteredTesters"
              :key="row.tester_name"
              class="hover:bg-slate-50/60 transition-colors"
            >
              <!-- 測試員 -->
              <td class="py-4 px-4">
                <div class="flex items-center gap-1.5">
                  <span
                    :class="row.tester_name === authStore.currentDisplayName ? 'font-bold text-blue-600' : 'font-medium text-slate-800'"
                    class="text-sm"
                  >
                    {{ row.tester_name }}
                  </span>
                  <span
                    v-if="row.tester_name === authStore.currentDisplayName"
                    class="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded leading-none"
                  >
                    我
                  </span>
                  <span
                    v-if="row.is_active === 0"
                    class="text-[10px] bg-slate-100 text-slate-400 px-1 py-0.5 rounded leading-none"
                  >
                    離職
                  </span>
                </div>
              </td>

              <!-- 今日 -->
              <td class="py-4 px-4 text-center text-sm font-medium">
                <span :class="row.today_t > 0 ? 'text-blue-600 font-bold' : 'text-slate-400'">{{ row.today_t || 0 }}</span>
                <span class="text-slate-300 mx-1.5">/</span>
                <span :class="row.today_p > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'">{{ row.today_p || 0 }}</span>
              </td>

              <!-- 本週 -->
              <td class="py-4 px-4 text-center text-sm font-medium">
                <span :class="row.week_t > 0 ? 'text-blue-600 font-bold' : 'text-slate-400'">{{ row.week_t || 0 }}</span>
                <span class="text-slate-300 mx-1.5">/</span>
                <span :class="row.week_p > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'">{{ row.week_p || 0 }}</span>
              </td>

              <!-- 本月 -->
              <td class="py-4 px-4 text-center text-sm font-medium">
                <span :class="row.month_t > 0 ? 'text-blue-600 font-bold' : 'text-slate-400'">{{ row.month_t || 0 }}</span>
                <span class="text-slate-300 mx-1.5">/</span>
                <span :class="row.month_p > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'">{{ row.month_p || 0 }}</span>
              </td>

              <!-- 累計 -->
              <td class="py-4 px-4 text-center text-sm font-medium">
                <span :class="row.total_t > 0 ? 'text-blue-600 font-bold' : 'text-slate-400'">{{ row.total_t || 0 }}</span>
                <span class="text-slate-300 mx-1.5">/</span>
                <span :class="row.total_p > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'">{{ row.total_p || 0 }}</span>
              </td>
            </tr>

            <tr v-if="sortedFilteredTesters.length === 0">
              <td colspan="5" class="py-8 text-center text-sm text-slate-400">
                請點選上方「選擇測試員」勾選要顯示的成員
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Issue Reports Drawer (Fail / Blocked) -->
    <el-drawer v-model="showIssueDrawer" :title="issueDrawerTitle" size="550px">
      <div v-loading="issueLoading" class="space-y-3">
        <div v-if="issueReports.length === 0" class="text-center py-8 text-sm text-slate-400">
          無此類未解決案件 🎉
        </div>
        <div
          v-for="r in issueReports"
          :key="r.id"
          class="p-3.5 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white hover:shadow-sm transition cursor-pointer"
          @click="openViewReport(r)"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-mono font-bold text-blue-600 text-sm">{{ r.case_no }}</span>
            <el-tag :type="r.status === 'Fail' ? 'danger' : 'warning'" size="small">
              {{ r.status }}
            </el-tag>
          </div>
          <h4 class="text-xs font-bold text-slate-800 line-clamp-1">{{ r.project_name }}</h4>
          <div class="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-200/60">
            <span>測試員：{{ r.tester_name }}</span>
            <span>日期：{{ r.test_date }}</span>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- Specific Report Full Preview Drawer -->
    <el-drawer v-model="showDetailDrawer" title="案件完整紀錄" size="480px">
      <div v-if="viewingReport" class="space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h4 class="font-bold text-slate-800">{{ viewingReport.case_no }}</h4>
            <span class="text-xs text-slate-500">{{ viewingReport.project_name }}</span>
          </div>
          <el-button type="primary" size="small" :icon="DocumentCopy" @click="handleCopyNotes(viewingReport.notes)">
            複製全文
          </el-button>
        </div>
        <div class="bg-slate-900 text-emerald-400 p-3.5 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-inner max-h-[60vh] overflow-y-auto">
          {{ viewingReport.notes }}
        </div>
      </div>
    </el-drawer>
  </div>
</template>
