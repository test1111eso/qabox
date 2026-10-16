<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useReportsStore } from '@/stores/reports';
import { useAuthStore } from '@/stores/auth';
import type { Report, ReportType } from '@/types';
import ReportFormDialog from '@/components/reports/ReportFormDialog.vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Star,
  StarFilled,
  Delete,
  DocumentCopy,
  Edit,
  Refresh,
  DeleteFilled,
  Search,
} from '@element-plus/icons-vue';
import { getTaiwanFirstDay, getTaiwanToday } from '@/utils/date';

const reportsStore = useReportsStore();
const authStore = useAuthStore();

// Dialogs
const showReportDialog = ref(false);
const dialogMode = ref<'create' | 'edit' | 'copy'>('create');
const dialogReportType = ref<ReportType>('normal');
const selectedReport = ref<Report | null>(null);

// Detail Drawer
const showDetailDrawer = ref(false);
const viewingReport = ref<Report | null>(null);

// Trash Dialog
const showTrashDialog = ref(false);

// Date quick presets
function setDatePreset(type: 'today' | 'month' | 'all') {
  if (type === 'today') {
    reportsStore.filterStartDate = getTaiwanToday();
    reportsStore.filterEndDate = getTaiwanToday();
  } else if (type === 'month') {
    reportsStore.filterStartDate = getTaiwanFirstDay();
    reportsStore.filterEndDate = getTaiwanToday();
  } else {
    reportsStore.filterStartDate = '';
    reportsStore.filterEndDate = '';
  }
  reportsStore.fetchReports();
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
  } catch {
    // cancelled
  }
}

async function handleRestore(report: Report) {
  await reportsStore.restoreReport(report.id);
  ElMessage.success(`案件【${report.case_no}】已還原`);
}

async function handlePurge(report: Report) {
  try {
    await ElMessageBox.confirm(`此操作將「永久刪除」案件【${report.case_no}】且無法復原，確定要執行嗎？`, '永久刪除警告', {
      type: 'error',
    });
    await reportsStore.purgeReport(report.id);
    ElMessage.success('已永久刪除');
  } catch {
    // cancelled
  }
}

async function openTrash() {
  await reportsStore.fetchTrash();
  showTrashDialog.value = true;
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
  reportsStore.fetchReports();
});
</script>

<template>
  <div class="space-y-5 pb-12">
    <!-- Top Filter & Search Bar -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <!-- Quick Presets -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-500">日期快速篩選：</span>
          <el-button size="small" @click="setDatePreset('today')">今天</el-button>
          <el-button size="small" @click="setDatePreset('month')">當月</el-button>
          <el-button size="small" @click="setDatePreset('all')">全部</el-button>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5">
          <el-button type="primary" :icon="Plus" @click="openCreateDialog('normal')">
            新增報告 (T)
          </el-button>
          <el-button type="danger" plain :icon="Plus" @click="openCreateDialog('prod')">
            新增上正式 (P)
          </el-button>
          <el-button type="info" plain :icon="DeleteFilled" @click="openTrash">
            垃圾桶
          </el-button>
        </div>
      </div>

      <!-- Detail Filters -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">開始日期</label>
          <el-date-picker
            v-model="reportsStore.filterStartDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="開始日期"
            class="!w-full"
            @change="reportsStore.fetchReports"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">結束日期</label>
          <el-date-picker
            v-model="reportsStore.filterEndDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="結束日期"
            class="!w-full"
            @change="reportsStore.fetchReports"
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">單別</label>
          <el-select
            v-model="reportsStore.filterType"
            placeholder="全部單別"
            class="w-full"
          >
            <el-option label="全部" value="all" />
            <el-option label="上正式 (P)" value="P" />
            <el-option label="測試報告 (T)" value="T" />
          </el-select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">分類</label>
          <el-select
            v-model="reportsStore.filterCategory"
            placeholder="全部分類"
            clearable
            class="w-full"
            @change="reportsStore.fetchReports"
          >
            <el-option label="求職" value="求職" />
            <el-option label="新求才" value="新求才" />
            <el-option label="現版求才" value="現版求才" />
            <el-option label="活動" value="活動" />
            <el-option label="其他" value="其他" />
          </el-select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">驗證狀態</label>
          <el-select
            v-model="reportsStore.filterStatus"
            placeholder="全部狀態"
            clearable
            class="w-full"
            @change="reportsStore.fetchReports"
          >
            <el-option label="驗證通過 (Pass)" value="Pass" />
            <el-option label="驗證失敗 (Fail)" value="Fail" />
            <el-option label="阻礙中 (Blocked)" value="Blocked" />
          </el-select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">關鍵字搜尋</label>
          <el-input
            v-model="reportsStore.filterSearch"
            placeholder="搜尋單號、專案、測試員..."
            :prefix-icon="Search"
            clearable
            @keyup.enter="reportsStore.fetchReports"
            @clear="reportsStore.fetchReports"
          />
        </div>
      </div>
    </div>

    <!-- Reports Table -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-slate-800 text-base">報告清單</h3>
          <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
            共 {{ reportsStore.sortedReports.length }} 筆
          </span>
        </div>
        <el-button size="small" :icon="Refresh" @click="reportsStore.fetchReports">
          重新整理
        </el-button>
      </div>

      <el-table
        :data="reportsStore.sortedReports"
        style="width: 100%"
        stripe
        v-loading="reportsStore.loading"
        empty-text="目前無符合條件之測試報告"
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
                row.category === '求職' ? 'bg-blue-100 text-blue-700' :
                row.category === '新求才' || row.category === '現版求才' ? 'bg-orange-100 text-orange-700' :
                row.category === '活動' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
              ]"
            >
              {{ row.category || '其他' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="project_name" label="專案名稱" min-width="220" show-overflow-tooltip />

        <el-table-column prop="tester_name" label="測試人員" width="130" />

        <el-table-column prop="test_date" label="測試日期" width="120" />

        <el-table-column prop="status" label="狀態" width="110">
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

        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <div class="flex items-center justify-end gap-1">
              <el-button
                v-if="authStore.canModifyReport(row)"
                size="small"
                type="primary"
                link
                :icon="Edit"
                @click="openEditDialog(row)"
              >
                編輯
              </el-button>
              <el-button size="small" type="info" link :icon="DocumentCopy" @click="openCopyDialog(row)">
                複製
              </el-button>
              <el-button
                v-if="authStore.canModifyReport(row)"
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
    </div>

    <!-- Report Form Modal -->
    <ReportFormDialog
      v-model="showReportDialog"
      :mode="dialogMode"
      :report-type="dialogReportType"
      :initial-report="selectedReport"
      @saved="reportsStore.fetchReports"
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

    <!-- Trash Dialog -->
    <el-dialog v-model="showTrashDialog" title="垃圾桶 (已軟刪除報告)" width="700px">
      <el-table
        :data="reportsStore.trash"
        v-loading="reportsStore.trashLoading"
        empty-text="垃圾桶目前沒有項目"
        max-height="400"
      >
        <el-table-column prop="case_no" label="單號" width="140" />
        <el-table-column prop="project_name" label="專案名稱" min-width="180" show-overflow-tooltip />
        <el-table-column prop="deleted_at" label="刪除時間" width="160" />
        <el-table-column label="操作" width="140" align="right">
          <template #default="{ row }">
            <el-button size="small" type="success" link @click="handleRestore(row)">還原</el-button>
            <el-button size="small" type="danger" link @click="handlePurge(row)">永久刪除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showTrashDialog = false">關閉</el-button>
      </template>
    </el-dialog>
  </div>
</template>
