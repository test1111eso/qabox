<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useReportsStore } from '@/stores/reports';
import type { Report, ReportType } from '@/types';
import ReportFormDialog from '@/components/reports/ReportFormDialog.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  DocumentCopy,
  Document,
  Edit,
  Delete,
  Calendar,
  CircleCheck,
  Warning,
  CircleClose,
  ArrowLeft,
  ArrowRight,
  Search,
  Star,
  StarFilled,
} from '@element-plus/icons-vue';
import { getTaiwanToday, getTaiwanFirstDay, getTaiwanMonday, getTaiwanDate } from '@/utils/date';

const authStore = useAuthStore();
const reportsStore = useReportsStore();

// Calendar State（日曆：僅負責檢視月份熱度、選取日報日期）
const now = new Date();
const calYear = ref(now.getFullYear());
const calMonth = ref(now.getMonth() + 1); // 1-12
const selectedDate = ref<string>(''); // e.g. '2026-10-16'

// Table Filters（下方表格獨立篩選，與報告中心一致）
type TablePreset = 'today' | 'week' | 'month' | 'lastMonth' | 'all' | '';
const tableStart = ref<string>('');
const tableEnd = ref<string>('');
const tableType = ref<'all' | 'P' | 'T'>('all');
const tableCategory = ref<string>('');
const tableStatus = ref<string>('');
const searchKeyword = ref('');
const activePreset = ref<TablePreset>('today');

// Report Dialog
const showReportDialog = ref(false);
const dialogMode = ref<'create' | 'edit' | 'copy'>('create');
const dialogReportType = ref<ReportType>('normal');
const selectedReport = ref<Report | null>(null);

// Detail Drawer
const showDetailDrawer = ref(false);
const viewingReport = ref<Report | null>(null);

// Daily & Monthly Summary Card
const summaryType = ref<'daily' | 'monthly'>('daily');

function isMine(r: Report): boolean {
  const myName = authStore.currentDisplayName;
  const myUserId = authStore.currentUserId;
  return (
    (r.owner_user_id != null && Number(r.owner_user_id) === Number(myUserId)) ||
    r.tester_name.includes(myName)
  );
}

const DAILY_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1OXOGgXZrDmkPFTVwjhiQgP-o_JH2uSIc9Xxq7aPQxZw/edit?usp=sharing';
const MONTHLY_SYSTEM_URL =
  'http://192.168.1.242/manage/engineer/monthReport/Default.aspx';

// Monthly stats for current user
const myMonthlyReports = computed(() => {
  const myName = authStore.currentDisplayName;
  const myUserId = authStore.currentUserId;
  const currentMonthPrefix = `${calYear.value}-${calMonth.value.toString().padStart(2, '0')}`;

  return reportsStore.reports.filter((r) => {
    if (r.is_deleted) return false;
    const isMine =
      (r.owner_user_id != null && Number(r.owner_user_id) === Number(myUserId)) ||
      r.tester_name.includes(myName);
    return isMine && r.test_date && r.test_date.startsWith(currentMonthPrefix);
  });
});

const statsTotal = computed(() => myMonthlyReports.value.length);
const statsPass = computed(() => myMonthlyReports.value.filter((r) => r.status === 'Pass').length);
const statsFail = computed(() => myMonthlyReports.value.filter((r) => r.status === 'Fail').length);
const statsBlocked = computed(() => myMonthlyReports.value.filter((r) => r.status === 'Blocked').length);

// Calendar Days Computation
const calendarDays = computed(() => {
  const y = calYear.value;
  const m = calMonth.value;
  const firstDay = new Date(y, m - 1, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayStr = getTaiwanToday();

  const myName = authStore.currentDisplayName;
  const myUserId = authStore.currentUserId;
  const counts: Record<string, number> = {};

  reportsStore.reports.forEach((r) => {
    if (r.is_deleted) return;
    const isMine =
      (r.owner_user_id != null && Number(r.owner_user_id) === Number(myUserId)) ||
      r.tester_name.includes(myName);
    if (!isMine || !r.test_date) return;
    counts[r.test_date] = (counts[r.test_date] || 0) + 1;
  });

  const days = [];
  // Empty slots before 1st
  for (let i = 0; i < firstDay; i++) {
    days.push({ empty: true, key: `empty-${i}` });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    const count = counts[dateStr] || 0;
    days.push({
      empty: false,
      day: d,
      dateStr,
      count,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedDate.value,
      key: dateStr,
    });
  }

  return days;
});

// Filtered report list for the table（獨立於日曆的篩選條件）
const myFilteredReports = computed(() => {
  const kw = searchKeyword.value.toLowerCase().trim();

  const filtered = reportsStore.reports.filter((r) => {
    if (r.is_deleted) return false;
    if (!isMine(r)) return false;

    if (tableStart.value && (!r.test_date || r.test_date < tableStart.value)) return false;
    if (tableEnd.value && (!r.test_date || r.test_date > tableEnd.value)) return false;

    if (tableType.value === 'P' && !r.case_no.startsWith('P')) return false;
    if (tableType.value === 'T' && r.case_no.startsWith('P')) return false;
    if (tableCategory.value && (r.category || '其他') !== tableCategory.value) return false;
    if (tableStatus.value && r.status !== tableStatus.value) return false;

    if (kw) {
      const haystack = [r.case_no, r.project_name, r.tester_name, r.notes]
        .map((s) => (s || '').toLowerCase())
        .join('\n');
      if (!haystack.includes(kw)) return false;
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    const aPin = Number(a.is_pinned) === 1 ? 1 : 0;
    const bPin = Number(b.is_pinned) === 1 ? 1 : 0;
    return bPin - aPin;
  });
});

// Pagination State (最多顯示三十筆案件)
const currentPage = ref(1);
const pageSize = ref(30);

const paginatedMyReports = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return myFilteredReports.value.slice(start, start + pageSize.value);
});

// Reset page when filter conditions change
watch(
  () => [
    tableStart.value,
    tableEnd.value,
    tableType.value,
    tableCategory.value,
    tableStatus.value,
    searchKeyword.value,
  ],
  () => {
    currentPage.value = 1;
  }
);

const tableRangeLabel = computed(() => {
  if (!tableStart.value && !tableEnd.value) return '全部日期';
  if (tableStart.value && tableStart.value === tableEnd.value) return tableStart.value;
  return `${tableStart.value || '最早'} ～ ${tableEnd.value || '最新'}`;
});

function setTablePreset(type: Exclude<TablePreset, ''>) {
  activePreset.value = type;
  const today = getTaiwanToday();
  if (type === 'today') {
    tableStart.value = today;
    tableEnd.value = today;
  } else if (type === 'week') {
    tableStart.value = getTaiwanMonday();
    tableEnd.value = today;
  } else if (type === 'month') {
    tableStart.value = getTaiwanFirstDay();
    tableEnd.value = today;
  } else if (type === 'lastMonth') {
    const tw = getTaiwanDate();
    const firstOfLast = new Date(tw.getFullYear(), tw.getMonth() - 1, 1);
    const lastOfLast = new Date(tw.getFullYear(), tw.getMonth(), 0);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    tableStart.value = fmt(firstOfLast);
    tableEnd.value = fmt(lastOfLast);
  } else {
    tableStart.value = '';
    tableEnd.value = '';
  }
}

function handleManualDateChange() {
  activePreset.value = '';
}

function resetTableFilters() {
  tableType.value = 'all';
  tableCategory.value = '';
  tableStatus.value = '';
  searchKeyword.value = '';
  currentPage.value = 1;
  setTablePreset('today');
}

function changeMonth(delta: number) {
  calMonth.value += delta;
  if (calMonth.value > 12) {
    calMonth.value = 1;
    calYear.value++;
  } else if (calMonth.value < 1) {
    calMonth.value = 12;
    calYear.value--;
  }
}

function resetToToday() {
  const t = new Date();
  calYear.value = t.getFullYear();
  calMonth.value = t.getMonth() + 1;
  selectedDate.value = getTaiwanToday();
  setTablePreset('today');
}

// 點擊日曆：選定日報日期，並作為捷徑把該日帶入下方表格日期篩選
function handleSelectDate(dateStr: string) {
  selectedDate.value = dateStr;
  tableStart.value = dateStr;
  tableEnd.value = dateStr;
  activePreset.value = dateStr === getTaiwanToday() ? 'today' : '';
}

async function loadWorkspaceData() {
  // Fetch reports for current month / year
  reportsStore.filterStartDate = '';
  reportsStore.filterEndDate = '';
  await reportsStore.fetchReports();
}

// 日報 = 日曆選取的日期；月報 = 日曆目前顯示的月份
const summaryPrefix = computed(() => {
  if (summaryType.value === 'daily') return selectedDate.value || getTaiwanToday();
  return `${calYear.value}-${calMonth.value.toString().padStart(2, '0')}`;
});

const summaryContent = computed(() => {
  const type = summaryType.value;
  const prefix = summaryPrefix.value;

  const matched = reportsStore.reports.filter((r) => {
    if (r.is_deleted) return false;
    return isMine(r) && !!r.test_date && r.test_date.startsWith(prefix);
  });

  const sorted = [...matched].reverse();
  const rows: string[] = [];

  if (type === 'daily') {
    // 日報表：每一份驗證/上正式產出報告皆為當日工作項目，不遺漏任何案件
    const seenIds = new Set<number>();
    for (const r of sorted) {
      if (seenIds.has(r.id)) continue;
      seenIds.add(r.id);

      let name = (r.project_name || '').trim() || r.case_no;
      if (r.case_no && r.case_no.startsWith('P') && !name.includes('上正式')) {
        name += ' (上正式)';
      }
      rows.push(name);
    }
  } else {
    // 月報表：彙整當月不重複之專案項目
    const seenMonthlyKeys = new Set<string>();
    for (const r of sorted) {
      let name = (r.project_name || '').trim() || r.case_no;
      if (r.case_no && r.case_no.startsWith('P') && !name.includes('上正式')) {
        name += ' (上正式)';
      }
      const key = name.toLowerCase();
      if (seenMonthlyKeys.has(key)) continue;
      seenMonthlyKeys.add(key);
      rows.push(name);
    }
  }

  if (rows.length === 0) return '';
  return rows.map((p, idx) => `${idx + 1}. ${p}`).join('\n');
});

async function copySummary() {
  if (!summaryContent.value) return;
  try {
    await navigator.clipboard.writeText(summaryContent.value);
    ElMessage.success('已複製摘要到剪貼簿！');
  } catch {
    ElMessage.error('複製失敗，請手動複製');
  }
}

function openCreateDialog(type: ReportType = 'normal') {
  dialogMode.value = 'create';
  dialogReportType.value = type;
  selectedReport.value = null;
  showReportDialog.value = true;
}

function openEditDialog(report: Report) {
  dialogMode.value = 'edit';
  dialogReportType.value = report.case_no.startsWith('P') ? 'prod' : 'normal';
  selectedReport.value = report;
  showReportDialog.value = true;
}

function openCopyDialog(report: Report) {
  dialogMode.value = 'copy';
  dialogReportType.value = report.case_no.startsWith('P') ? 'prod' : 'normal';
  selectedReport.value = report;
  showReportDialog.value = true;
}

function openViewDrawer(report: Report) {
  viewingReport.value = report;
  showDetailDrawer.value = true;
}

async function handleDelete(report: Report) {
  try {
    await ElMessageBox.confirm(`確定要將案件【${report.case_no}】移入垃圾桶嗎？`, '刪除確認', {
      type: 'warning',
    });
    await reportsStore.deleteReport(report.id);
    ElMessage.success('已移入垃圾桶');
    await loadWorkspaceData();
  } catch {
    // cancelled
  }
}

async function handleCopyNotes(notes: string) {
  try {
    await navigator.clipboard.writeText(notes);
    ElMessage.success('已複製報告內容至剪貼簿！');
  } catch {
    ElMessage.error('複製失敗');
  }
}

onMounted(() => {
  selectedDate.value = getTaiwanToday();
  setTablePreset('today');
  loadWorkspaceData();
});
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Top Action Bar -->
    <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold text-slate-800">早安，{{ authStore.currentDisplayName }}！</h2>
        <p class="text-xs text-slate-500 mt-0.5">日曆檢視每日產出與日報，下方表格可自由查詢任意區間的個人工單</p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog('normal')">
          新增測試報告 (T)
        </el-button>
        <el-button type="danger" plain :icon="Plus" @click="openCreateDialog('prod')">
          新增上正式 (P)
        </el-button>
      </div>
    </div>

    <!-- Main Workspace Grid: Calendar (Left 7 cols) & Monthly Metrics (Right 5 cols) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left: Monthly Testing Calendar (7 cols) -->
      <div class="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
            <el-icon class="text-blue-600"><Calendar /></el-icon>
            <span>{{ calYear }} 年 {{ calMonth }} 月 測試狀況</span>
          </h3>

          <div class="flex items-center gap-1.5">
            <el-button size="small" @click="resetToToday">今天</el-button>
            <el-button size="small" :icon="ArrowLeft" @click="changeMonth(-1)" />
            <el-button size="small" :icon="ArrowRight" @click="changeMonth(1)" />
          </div>
        </div>

        <!-- Weekday Headers -->
        <div class="grid grid-cols-7 gap-1.5 mb-1.5 text-center text-xs font-bold text-slate-400">
          <div>日</div>
          <div>一</div>
          <div>二</div>
          <div>三</div>
          <div>四</div>
          <div>五</div>
          <div>六</div>
        </div>

        <!-- Calendar Cells Grid -->
        <div class="grid grid-cols-7 gap-1.5">
          <template v-for="cell in calendarDays" :key="cell.key">
            <!-- Empty Placeholder Cell -->
            <div
              v-if="cell.empty"
              class="h-16 rounded-lg bg-slate-50/50 border border-slate-100/60"
            />

            <!-- Active Day Cell -->
            <div
              v-else
              class="h-16 rounded-lg border flex flex-col items-center justify-center cursor-pointer transition select-none p-1"
              :class="[
                cell.isSelected
                  ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-400'
                  : cell.isToday
                  ? 'border-blue-500 ring-1 ring-blue-300 bg-white hover:bg-slate-50'
                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              ]"
              @click="handleSelectDate(cell.dateStr!)"
            >
              <span
                class="text-xs font-semibold"
                :class="cell.isToday ? 'text-blue-600 font-bold' : 'text-slate-700'"
              >
                {{ cell.day }}
              </span>

              <span
                v-if="cell.count && cell.count > 0"
                class="text-[11px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full mt-1 shadow-xs"
              >
                {{ cell.count }} 件
              </span>
              <span v-else class="text-[10px] text-transparent mt-1">-</span>
            </div>
          </template>
        </div>

        <!-- Calendar Footer Hint -->
        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div class="flex items-center gap-2">
            <span class="inline-block w-3 h-3 rounded border border-blue-500 ring-1 ring-blue-300"></span>
            <span>今日</span>
            <span class="inline-block w-3 h-3 rounded bg-blue-600 ml-2"></span>
            <span>有測試件數</span>
          </div>
          <span v-if="selectedDate" class="text-blue-600 font-bold">
            日報日期：{{ selectedDate }}（點日期同步帶入下方表格）
          </span>
        </div>
      </div>

      <!-- Right: Personal Monthly Stats & Summary (5 cols) -->
      <div class="lg:col-span-5 flex flex-col justify-between gap-4">
        <!-- 4 Metric Cards -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
            <span class="text-xs text-slate-500 font-medium">本月累計產出</span>
            <div class="text-2xl font-black text-slate-800 mt-1.5">{{ statsTotal }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
            <span class="text-xs text-emerald-600 font-medium flex items-center justify-center gap-1">
              <el-icon><CircleCheck /></el-icon> 驗證通過 (Pass)
            </span>
            <div class="text-2xl font-black text-emerald-600 mt-1.5">{{ statsPass }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
            <span class="text-xs text-rose-600 font-medium flex items-center justify-center gap-1">
              <el-icon><CircleClose /></el-icon> 驗證失敗 (Fail)
            </span>
            <div class="text-2xl font-black text-rose-600 mt-1.5">{{ statsFail }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
            <span class="text-xs text-amber-600 font-medium flex items-center justify-center gap-1">
              <el-icon><Warning /></el-icon> 阻礙中 (Blocked)
            </span>
            <div class="text-2xl font-black text-amber-600 mt-1.5">{{ statsBlocked }}</div>
          </div>
        </div>

        <!-- Daily / Monthly Summary Card -->
        <div class="bg-white border border-slate-200 text-slate-700 rounded-xl p-5 shadow-sm flex flex-col flex-1 min-h-[260px]">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                class="px-3 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1"
                :class="summaryType === 'daily' ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:text-indigo-600'"
                @click="summaryType = 'daily'"
              >
                <el-icon><Document /></el-icon> 日報
              </button>
              <button
                type="button"
                class="px-3 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1"
                :class="summaryType === 'monthly' ? 'bg-purple-500 text-white shadow' : 'text-slate-500 hover:text-purple-600'"
                @click="summaryType = 'monthly'"
              >
                <el-icon><Calendar /></el-icon> 月報
              </button>
            </div>
            <span class="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{{ summaryPrefix }}</span>
          </div>

          <div class="flex-1 mt-3 overflow-y-auto max-h-[220px] pr-1">
            <pre
              v-if="summaryContent"
              class="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed"
            >{{ summaryContent }}</pre>
            <div v-else class="h-full flex items-center justify-center text-xs text-slate-400">
              沒產值還敢偷懶阿 (⑉･̆-･̆⑉)
            </div>
          </div>

          <div class="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <a
              :href="summaryType === 'daily' ? DAILY_SHEET_URL : MONTHLY_SYSTEM_URL"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline"
            >
              {{ summaryType === 'daily' ? '前往日報表試算表 ↗' : '前往月報系統 ↗' }}
            </a>
            <button
              type="button"
              class="text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition font-bold cursor-pointer flex items-center gap-1"
              :disabled="!summaryContent"
              @click="copySummary"
            >
              <el-icon><DocumentCopy /></el-icon> 一鍵複製
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom: My Reports Table -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <!-- Filter Bar -->
      <div class="space-y-3 mb-4 pb-4 border-b border-slate-100">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <h3 class="font-bold text-slate-800 text-base">我的測試紀錄</h3>
            <span class="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold font-mono">
              {{ tableRangeLabel }}
            </span>
            <span class="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
              共 {{ myFilteredReports.length }} 筆
            </span>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-bold text-slate-500 mr-1">日期快速篩選：</span>
            <el-button
              v-for="p in ([
                { key: 'today', label: '今天' },
                { key: 'week', label: '本週' },
                { key: 'month', label: '當月' },
                { key: 'lastMonth', label: '上個月' },
                { key: 'all', label: '全部' },
              ] as const)"
              :key="p.key"
              size="small"
              :type="activePreset === p.key ? 'primary' : 'default'"
              @click="setTablePreset(p.key)"
            >
              {{ p.label }}
            </el-button>
            <el-button size="small" link type="info" @click="resetTableFilters">重設</el-button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">開始日期</label>
            <el-date-picker
              v-model="tableStart"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="開始日期"
              class="!w-full"
              @change="handleManualDateChange"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">結束日期</label>
            <el-date-picker
              v-model="tableEnd"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="結束日期"
              class="!w-full"
              @change="handleManualDateChange"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">單別</label>
            <el-select v-model="tableType" class="w-full">
              <el-option label="全部" value="all" />
              <el-option label="上正式 (P)" value="P" />
              <el-option label="測試報告 (T)" value="T" />
            </el-select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">分類</label>
            <el-select v-model="tableCategory" placeholder="全部分類" clearable class="w-full">
              <el-option label="求職" value="求職" />
              <el-option label="新求才" value="新求才" />
              <el-option label="現版求才" value="現版求才" />
              <el-option label="活動" value="活動" />
              <el-option label="其他" value="其他" />
            </el-select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">驗證狀態</label>
            <el-select v-model="tableStatus" placeholder="全部狀態" clearable class="w-full">
              <el-option label="驗證通過 (Pass)" value="Pass" />
              <el-option label="驗證失敗 (Fail)" value="Fail" />
              <el-option label="阻礙中 (Blocked)" value="Blocked" />
            </el-select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">關鍵字搜尋</label>
            <el-input
              v-model="searchKeyword"
              placeholder="單號、專案、內文..."
              :prefix-icon="Search"
              clearable
            />
          </div>
        </div>
      </div>

      <el-table
        :data="paginatedMyReports"
        style="width: 100%"
        stripe
        v-loading="reportsStore.loading"
        empty-text="目前無符合條件之個人測試報告"
      >
        <el-table-column width="45" align="center">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              :icon="row.is_pinned === 1 ? StarFilled : Star"
              :class="row.is_pinned === 1 ? 'text-amber-500' : 'text-slate-300'"
              @click="reportsStore.togglePin(row)"
            />
          </template>
        </el-table-column>

        <el-table-column prop="case_no" label="案件編號" width="160">
          <template #default="{ row }">
            <button
              class="font-mono font-bold text-blue-600 hover:underline cursor-pointer"
              @click="openViewDrawer(row)"
            >
              {{ row.case_no }}
            </button>
          </template>
        </el-table-column>

        <el-table-column prop="category" label="分類" width="105">
          <template #default="{ row }">
            <span
              class="text-xs px-2 py-0.5 rounded font-semibold"
              :class="[
                row.category === '求職'
                  ? 'bg-blue-100 text-blue-700'
                  : row.category === '新求才' || row.category === '現版求才'
                  ? 'bg-orange-100 text-orange-700'
                  : row.category === '活動'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-700'
              ]"
            >
              {{ row.category || '其他' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="project_name" label="專案名稱" min-width="240" show-overflow-tooltip />

        <el-table-column prop="test_date" label="測試日期" width="120" />

        <el-table-column prop="status" label="狀態" width="115">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'Pass' ? 'success' : row.status === 'Fail' ? 'danger' : 'warning'"
              size="small"
              effect="light"
            >
              {{ row.status === 'Pass' ? '驗證通過' : row.status === 'Fail' ? '驗證失敗' : '阻礙中' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="190" align="right">
          <template #default="{ row }">
            <div class="flex items-center justify-end gap-1">
              <el-button
                size="small"
                type="primary"
                link
                :icon="Edit"
                @click="openEditDialog(row)"
              >
                修改
              </el-button>
              <el-button
                size="small"
                type="success"
                link
                :icon="DocumentCopy"
                @click="openCopyDialog(row)"
              >
                複製
              </el-button>
              <el-button
                size="small"
                type="danger"
                link
                :icon="Delete"
                @click="handleDelete(row)"
              >
                刪除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Pagination (最多顯示 30 筆) -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
        <div>
          顯示第 {{ myFilteredReports.length === 0 ? 0 : (currentPage - 1) * pageSize + 1 }} 至 {{ Math.min(currentPage * pageSize, myFilteredReports.length) }} 筆（共 {{ myFilteredReports.length }} 筆，每頁最多 30 筆）
        </div>
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="myFilteredReports.length"
          layout="prev, pager, next"
          :hide-on-single-page="true"
          background
          size="small"
        />
      </div>
    </div>

    <!-- Report Form Modal -->
    <ReportFormDialog
      v-model="showReportDialog"
      :mode="dialogMode"
      :report-type="dialogReportType"
      :initial-report="selectedReport"
      @saved="loadWorkspaceData"
    />

    <!-- Detail Drawer -->
    <el-drawer
      v-model="showDetailDrawer"
      title="測試報告詳情"
      size="480px"
      destroy-on-close
    >
      <div v-if="viewingReport" class="space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 class="text-base font-bold text-slate-800">{{ viewingReport.case_no }}</h3>
            <span class="text-xs text-slate-500">{{ viewingReport.project_name }}</span>
          </div>
          <el-button
            type="primary"
            size="small"
            :icon="DocumentCopy"
            @click="handleCopyNotes(viewingReport.notes)"
          >
            複製全文
          </el-button>
        </div>

        <div class="bg-slate-900 text-emerald-400 p-4 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-inner overflow-y-auto max-h-[60vh]">
          {{ viewingReport.notes }}
        </div>
      </div>
    </el-drawer>
  </div>
</template>
