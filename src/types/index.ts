export type ReportStatus = 'Pass' | 'Fail' | 'Blocked';
export type ReportCategory = '求職' | '新求才' | '現版求才' | '活動' | '其他';
export type ReportType = 'normal' | 'prod';
export type UserRole = 'admin' | 'user';

export interface Report {
  id: number;
  case_no: string;
  project_name: string;
  tester_name: string;
  test_date: string;
  status: ReportStatus;
  bug_link?: string;
  notes: string;
  category: ReportCategory | string;
  raw_ticket?: string;
  is_pinned?: number;
  is_deleted?: number;
  owner_user_id?: number | null;
  created_at?: string;
  deleted_at?: string | null;
  admin_edited_by?: string | null;
  admin_edited_at?: string | null;
}

export interface ParsedTicketFields {
  case_no?: string;
  project_name?: string;
  test_date?: string;
  tester_name?: string;
  developer?: string;
  parent_ticket?: string;
  sub_ticket?: string;
  version?: string;
  category?: string;
  status?: ReportStatus;
  urls?: string;
  bug_link?: string;
  env?: string;
  devices?: string;
  test_steps?: string;
  risk?: string;
  pass_rate?: string;
  form_steps?: string; // 備註 (工單說明)
  form_notes?: string; // 測試員備註
}

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  is_active: number;
  created_at?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user_id: number;
  username: string;
  display_name: string;
  role: UserRole;
}

export interface Bulletin {
  id: number;
  title: string;
  content: string;
  category: string;
  is_pinned: number;
  author_name: string;
  created_at: string;
  updated_at?: string;
}

export interface DutyRosterItem {
  week_start: string;
  primary_tester: string;
  secondary_tester?: string;
  notes?: string;
}

export interface StatusStatItem {
  status: string;
  count: number;
}

export interface DailyStatItem {
  test_date: string;
  count: number;
}

export interface TesterStatItem {
  tester_name: string;
  total_count: number;
  total_t: number;
  total_p: number;
  today_count: number;
  today_t: number;
  today_p: number;
  week_count: number;
  week_t: number;
  week_p: number;
  month_count: number;
  month_t: number;
  month_p: number;
  is_active: number;
}

export interface TypeStats {
  t_count: number;
  p_count: number;
}

export interface DashboardStats {
  statusStats: StatusStatItem[];
  dailyStats: DailyStatItem[];
  testerStats: TesterStatItem[];
  typeStats: TypeStats;
  monthTotal: number;
  openBlockedCount: number;
  openFailCount: number;
}
