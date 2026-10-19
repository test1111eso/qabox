import type {
  Report,
  ReportType,
  User,
  Bulletin,
  DashboardStats,
  LoginResponse,
} from '@/types';

export const API_BASE = 'https://qagame.test1111-tcm-tc.workers.dev';

export function getToken(): string {
  return localStorage.getItem('qa_session_token') || '';
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || `請求失敗 (${response.status})`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// ----------------- Auth API -----------------
export const authApi = {
  async login(payload: { username: string; password: string }): Promise<LoginResponse> {
    return request<LoginResponse>('/api/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async register(payload: { username: string; password: string; display_name: string }): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async logout(): Promise<void> {
    const token = getToken();
    try {
      await request('/api/logout', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    } finally {
      localStorage.removeItem('qa_session_token');
      localStorage.removeItem('qa_user_id');
      localStorage.removeItem('qa_display_name');
      localStorage.removeItem('qa_username');
      localStorage.removeItem('qa_role');
    }
  },
};

// ----------------- Reports API -----------------
export const reportsApi = {
  async getReports(params?: {
    startDate?: string;
    endDate?: string;
    tester?: string;
    status?: string;
    search?: string;
    category?: string;
  }): Promise<Report[]> {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('start_date', params.startDate);
    if (params?.endDate) query.set('end_date', params.endDate);
    if (params?.tester) query.set('tester', params.tester);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('case_no', params.search);

    const qs = query.toString();
    const endpoint = `/api/reports${qs ? `?${qs}` : ''}`;
    return request<Report[]>(endpoint);
  },

  async getNextCaseNo(date: string, type: ReportType = 'normal'): Promise<string> {
    const res = await request<{ nextCaseNo: string }>(
      `/api/reports/next-case-no?date=${encodeURIComponent(date)}&type=${type}`
    );
    return res.nextCaseNo;
  },

  async createReport(payload: Partial<Report>): Promise<Report> {
    const token = getToken();
    return request<Report>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ ...payload, token }),
    });
  },

  async updateReport(payload: Partial<Report>): Promise<Report> {
    const token = getToken();
    return request<Report>('/api/reports/update', {
      method: 'POST',
      body: JSON.stringify({ ...payload, token }),
    });
  },

  async togglePin(id: number, currentPinned: number): Promise<{ success: boolean; is_pinned: number }> {
    const token = getToken();
    const targetPinned = currentPinned === 1 ? 0 : 1;
    const res = await request<{ success: boolean; is_pinned?: number }>('/api/reports/pin', {
      method: 'POST',
      body: JSON.stringify({ id, is_pinned: targetPinned, token }),
    });
    return {
      success: res.success,
      is_pinned: typeof res.is_pinned === 'number' ? res.is_pinned : targetPinned,
    };
  },

  async deleteReport(id: number): Promise<void> {
    const token = getToken();
    await request('/api/reports/delete', {
      method: 'POST',
      body: JSON.stringify({ id, token }),
    });
  },

  async getTrash(): Promise<Report[]> {
    const token = getToken();
    return request<Report[]>(`/api/reports/trash?token=${encodeURIComponent(token)}`);
  },

  async restoreReport(id: number): Promise<void> {
    const token = getToken();
    await request('/api/reports/restore', {
      method: 'POST',
      body: JSON.stringify({ id, token }),
    });
  },

  async purgeReport(id: number): Promise<void> {
    const token = getToken();
    await request('/api/reports/purge', {
      method: 'POST',
      body: JSON.stringify({ id, token }),
    });
  },
};

// ----------------- Stats & Dashboard API -----------------
export const statsApi = {
  async getStats(startDate: string, endDate: string): Promise<DashboardStats> {
    return request<DashboardStats>(`/api/stats?start_date=${startDate}&end_date=${endDate}`);
  },
};

// ----------------- Bulletins API -----------------
export const bulletinsApi = {
  async getBulletins(): Promise<Bulletin[]> {
    return request<Bulletin[]>('/api/collab/bulletins');
  },

  async createBulletin(payload: { title: string; content: string; category?: string; is_pinned?: number }): Promise<Bulletin> {
    const token = getToken();
    return request<Bulletin>('/api/collab/bulletins', {
      method: 'POST',
      body: JSON.stringify({ ...payload, token }),
    });
  },

  async deleteBulletin(id: number): Promise<void> {
    const token = getToken();
    await request(`/api/collab/bulletins/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  },
};

// ----------------- Duty API -----------------
export const dutyApi = {
  async getDuty(): Promise<{ duty_tester: string; roster: string[]; start_timestamp: number }> {
    return request<{ duty_tester: string; roster: string[]; start_timestamp: number }>('/api/duty');
  },

  async setRoster(roster: string[]): Promise<void> {
    const token = getToken();
    await request('/api/duty/roster', {
      method: 'POST',
      body: JSON.stringify({ roster, token }),
    });
  },
};

// ----------------- Users API (Admin) -----------------
export const usersApi = {
  async getUsers(): Promise<User[]> {
    const token = getToken();
    return request<User[]>(`/api/users?token=${encodeURIComponent(token)}`);
  },

  async toggleUserActive(userId: number, isActive: number): Promise<void> {
    const token = getToken();
    await request('/api/users/toggle', {
      method: 'POST',
      body: JSON.stringify({ userId, is_active: isActive === 1 ? 0 : 1, token }),
    });
  },

  async resetPassword(userId: number, newPassword: string): Promise<void> {
    const token = getToken();
    await request('/api/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword, token }),
    });
  },
};
