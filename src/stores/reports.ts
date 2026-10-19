import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Report } from '@/types';
import { reportsApi } from '@/api/client';
import { getTaiwanToday } from '@/utils/date';
import { ElMessage } from 'element-plus';

export const useReportsStore = defineStore('reports', () => {
  const reports = ref<Report[]>([]);
  const trash = ref<Report[]>([]);
  const loading = ref<boolean>(false);
  const trashLoading = ref<boolean>(false);

  // Filters
  const filterStartDate = ref<string>(getTaiwanToday());
  const filterEndDate = ref<string>(getTaiwanToday());
  const filterTester = ref<string>('');
  const filterStatus = ref<string>('');
  const filterSearch = ref<string>('');
  const filterCategory = ref<string>('');
  const filterType = ref<'all' | 'P' | 'T'>('all');

  const activeReports = computed(() => {
    return reports.value.filter((r) => {
      if (r.is_deleted) return false;
      if (filterType.value === 'P') return r.case_no.startsWith('P');
      if (filterType.value === 'T') return !r.case_no.startsWith('P');
      return true;
    });
  });

  const pinnedReports = computed(() => {
    return activeReports.value.filter((r) => Number(r.is_pinned) === 1);
  });

  const unpinnedReports = computed(() => {
    return activeReports.value.filter((r) => Number(r.is_pinned) !== 1);
  });

  const sortedReports = computed(() => {
    return [...pinnedReports.value, ...unpinnedReports.value];
  });

  async function fetchReports() {
    loading.value = true;
    try {
      const data = await reportsApi.getReports({
        startDate: filterStartDate.value,
        endDate: filterEndDate.value,
        tester: filterTester.value,
        status: filterStatus.value,
        search: filterSearch.value,
        category: filterCategory.value,
      });
      reports.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTrash() {
    trashLoading.value = true;
    try {
      const data = await reportsApi.getTrash();
      trash.value = data;
    } finally {
      trashLoading.value = false;
    }
  }

  async function togglePin(report: Report) {
    const currentPinned = Number(report.is_pinned) === 1 ? 1 : 0;
    const targetPinned = currentPinned === 1 ? 0 : 1;
    report.is_pinned = targetPinned;
    try {
      const res = await reportsApi.togglePin(report.id, currentPinned);
      report.is_pinned = typeof res.is_pinned === 'number' ? res.is_pinned : targetPinned;
      ElMessage.success(report.is_pinned === 1 ? '已加上星號' : '已取消星號');
    } catch (err: any) {
      report.is_pinned = currentPinned;
      ElMessage.error(err.message || '更新星號失敗');
    }
  }

  async function deleteReport(id: number) {
    await reportsApi.deleteReport(id);
    reports.value = reports.value.filter((r) => r.id !== id);
  }

  async function restoreReport(id: number) {
    await reportsApi.restoreReport(id);
    trash.value = trash.value.filter((r) => r.id !== id);
    await fetchReports();
  }

  async function purgeReport(id: number) {
    await reportsApi.purgeReport(id);
    trash.value = trash.value.filter((r) => r.id !== id);
  }

  return {
    reports,
    trash,
    loading,
    trashLoading,
    filterStartDate,
    filterEndDate,
    filterTester,
    filterStatus,
    filterSearch,
    filterCategory,
    filterType,
    activeReports,
    pinnedReports,
    sortedReports,
    fetchReports,
    fetchTrash,
    togglePin,
    deleteReport,
    restoreReport,
    purgeReport,
  };
});
