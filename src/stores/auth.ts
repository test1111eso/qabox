import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User, Report } from '@/types';
import { authApi } from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('qa_session_token') || '');
  const savedUserId = localStorage.getItem('qa_user_id');
  const parsedUserId = savedUserId ? parseInt(savedUserId, 10) : NaN;
  const user = ref<User | null>(
    !isNaN(parsedUserId) && parsedUserId > 0
      ? {
          id: parsedUserId,
          username: localStorage.getItem('qa_username') || '',
          display_name: localStorage.getItem('qa_display_name') || '',
          role: (localStorage.getItem('qa_role') as 'admin' | 'user') || 'user',
          is_active: 1,
        }
      : null
  );

  const isAuthenticated = computed(() => Boolean(token.value && user.value));
  const isAdmin = computed(() => user.value?.role === 'admin');
  const currentUserId = computed(() => user.value?.id ?? null);
  const currentDisplayName = computed(() => user.value?.display_name ?? '');

  async function login(credentials: { username: string; password: string }) {
    const res = await authApi.login(credentials);
    token.value = res.token;
    user.value = {
      id: res.user_id,
      username: res.username,
      display_name: res.display_name,
      role: res.role,
      is_active: 1,
    };

    localStorage.setItem('qa_session_token', res.token);
    localStorage.setItem('qa_user_id', String(res.user_id));
    localStorage.setItem('qa_display_name', res.display_name);
    localStorage.setItem('qa_username', res.username);
    localStorage.setItem('qa_role', res.role);
    return res;
  }

  async function register(payload: { username: string; password: string; display_name: string }) {
    return authApi.register(payload);
  }

  async function logout() {
    await authApi.logout();
    token.value = '';
    user.value = null;
  }

  function getReportOwnerName(testerName?: string): string {
    if (!testerName) return '';
    const idx = String(testerName).indexOf(' - ');
    return (idx >= 0 ? testerName.substring(0, idx) : testerName).trim();
  }

  function getOwnerNameFromNotes(notes?: string): string {
    if (!notes) return '';
    const match = notes.match(/測試人員\s*[：:]\s*([^\n]+)/);
    return match ? getReportOwnerName(match[1]) : '';
  }

  function isReportOwnedByCurrent(report: Report): boolean {
    if (!user.value || !report) return false;
    if (report.owner_user_id != null && Number(report.owner_user_id) === Number(user.value.id)) {
      return true;
    }
    const currentName = user.value.display_name.trim();
    if (!currentName) return false;
    if (getReportOwnerName(report.tester_name) === currentName) return true;
    return getOwnerNameFromNotes(report.notes) === currentName;
  }

  function canModifyReport(report?: Report | null): boolean {
    if (!report || !user.value) return false;
    if (isAdmin.value) return true;
    return isReportOwnedByCurrent(report);
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    currentUserId,
    currentDisplayName,
    login,
    register,
    logout,
    canModifyReport,
    isReportOwnedByCurrent,
  };
});
