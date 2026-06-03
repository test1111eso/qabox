// Cloudflare Worker API URL
const API_BASE = 'https://qa-backend-api.test1111-tcm-tc.workers.dev';

let dailyChartInstance = null;
let statusChartInstance = null;
let testerChartInstance = null;
let currentReportsList = [];
let wsCurrentYear = new Date().getFullYear();
let wsCurrentMonth = new Date().getMonth() + 1;
let currentReportMode = 'normal';
let userEditedFields = new Set();
let wsCurrentPage = 1;
let reportsCurrentPage = 1;
let currentTesterStats = [];
const ITEMS_PER_PAGE = 10;


// 取得台灣時間的今天 YYYY-MM-DD
function getTaiwanToday() {
    const twDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    const yyyy = twDate.getFullYear();
    const mm = String(twDate.getMonth() + 1).padStart(2, '0');
    const dd = String(twDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// 取得台灣時間的當月第一天 YYYY-MM-DD
function getTaiwanFirstDay() {
    const twDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
    const yyyy = twDate.getFullYear();
    const mm = String(twDate.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
}

function getCategoryTagHtml(category) {
    const cat = category || '其他';
    let colorClass = 'bg-gray-50 text-gray-700 border-gray-200';
    
    if (cat === '求職') {
        colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (cat === '新求才' || cat === '現版求才') {
        colorClass = 'bg-orange-50 text-orange-700 border-orange-200';
    } else if (cat === '活動') {
        colorClass = 'bg-green-50 text-green-700 border-green-200';
    }
    
    return `<span class="inline-block px-2 py-0.5 mr-2 text-xs font-semibold rounded border ${colorClass}">${escapeHtml(cat)}</span>`;
}

function getTypeTagHtml(caseNo) {
    const no = caseNo || '';
    if (no.startsWith('P')) {
        return `<span class="inline-block px-2 py-1 text-xs font-bold rounded bg-green-100 text-green-800">上正式</span>`;
    } else if (no.startsWith('T')) {
        return `<span class="inline-block px-2 py-1 text-xs font-bold rounded bg-blue-100 text-blue-800">測試報告</span>`;
    }
    return `<span class="inline-block px-2 py-1 text-xs font-bold rounded bg-gray-100 text-gray-800">未知</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // 當測試日期變更時，若在新增模式，則自動重新計算案件編號
    document.getElementById('form-date')?.addEventListener('change', (e) => {
        const reportId = document.getElementById('form-report-id').value;
        if (!reportId) {
            updateNextCaseNo(e.target.value);
        }
    });
});

// Auth Logic
let isRegisterMode = false;

function checkAuth() {
    const token = localStorage.getItem('qa_session_token');
    const displayName = localStorage.getItem('qa_display_name');
    const role = localStorage.getItem('qa_role');
    
    if (token && displayName) {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('nav-user-name').innerText = `哈囉，${displayName}`;
        
        // 根據角色顯示/隱藏測試員管理導航按鈕
        const navUsers = document.getElementById('nav-users');
        if (navUsers) {
            if (role === 'admin') {
                navUsers.classList.remove('hidden');
            } else {
                navUsers.classList.add('hidden');
            }
        }
        
        // 預設日期區間為月初到今天
        const twToday = getTaiwanToday();
        const twFirstDay = getTaiwanFirstDay();
        
        document.getElementById('filter-start-date').value = twFirstDay;
        document.getElementById('filter-end-date').value = twToday;
        
        const testerStart = document.getElementById('tester-start-date');
        const testerEnd = document.getElementById('tester-end-date');
        if (testerStart && testerEnd) {
            testerStart.value = twFirstDay;
            testerEnd.value = twToday;
        }
        
        initFilterTesters();
        switchView('workspace');
        initGeneratorLogic();
    } else {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const nameGroup = document.getElementById('auth-name-group');
    const nameInput = document.getElementById('auth-display-name');
    
    if (isRegisterMode) {
        title.innerText = '註冊帳號';
        subtitle.innerText = '建立一個新的測試人員帳號';
        btn.innerText = '註冊並登入';
        toggleText.innerText = '已經有帳號了？';
        toggleBtn.innerText = '點此登入';
        nameGroup.classList.remove('hidden');
        nameInput.required = true;
    } else {
        title.innerText = '登入系統';
        subtitle.innerText = '歡迎回來，請登入您的帳號';
        btn.innerText = '登入';
        toggleText.innerText = '還沒有帳號嗎？';
        toggleBtn.innerText = '點此註冊';
        nameGroup.classList.add('hidden');
        nameInput.required = false;
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const displayName = document.getElementById('auth-display-name').value;
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.getElementById('auth-submit-btn');
    
    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerText = '處理中...';
    
    try {
        if (isRegisterMode) {
            const regRes = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, display_name: displayName })
            });
            const regData = await regRes.json();
            if (!regRes.ok) {
                if (regData.error === 'Username may already exist') {
                    throw new Error('此帳號已註冊，請勿重複申請！');
                }
                throw new Error(regData.error || '註冊失敗');
            }
        }
        
        const loginRes = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const loginData = await loginRes.json();
        
        if (!loginRes.ok) {
            // 如果是在註冊模式下，因為未啟用 (403) 導致自動登入失敗
            if (loginRes.status === 403 && isRegisterMode) {
                toggleAuthMode(); // 切換回登入模式
                document.getElementById('auth-username').value = username;
                document.getElementById('auth-password').value = '';
                showToast('註冊成功！請等待管理員審核啟用後方可登入。');
                return;
            }
            throw new Error(loginData.error || '登入失敗');
        }
        
        localStorage.setItem('qa_session_token', loginData.token);
        localStorage.setItem('qa_display_name', loginData.display_name);
        localStorage.setItem('qa_role', loginData.role || 'user');
        
        document.getElementById('auth-username').value = '';
        document.getElementById('auth-password').value = '';
        checkAuth();
        showToast('登入成功！');
    } catch (err) {
        errorEl.innerText = err.message;
        errorEl.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = isRegisterMode ? '註冊並登入' : '登入';
    }
}

async function handleLogout() {
    if(!confirm('確定要登出嗎？')) return;
    
    const token = localStorage.getItem('qa_session_token');
    if (token) {
        try {
            await fetch(`${API_BASE}/api/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
        } catch(e) {}
    }
    
    localStorage.removeItem('qa_session_token');
    localStorage.removeItem('qa_display_name');
    localStorage.removeItem('qa_role');
    
    const navUsers = document.getElementById('nav-users');
    if (navUsers) navUsers.classList.add('hidden');
    
    checkAuth();
}

// View Navigation
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active', 'text-primary'));
    document.getElementById(`nav-${viewId}`).classList.add('active', 'text-primary');

    if (viewId === 'workspace') loadWorkspace();
    if (viewId === 'dashboard') loadDashboard();
    if (viewId === 'reports') fetchReports();
    if (viewId === 'documents') loadCollaborationBoard();
    if (viewId === 'users') fetchUsers();
}

// Workspace Logic
async function loadWorkspace() {
    const displayName = localStorage.getItem('qa_display_name');
    if (!displayName) return;

    try {
        const res = await fetch(`${API_BASE}/api/reports?tester=${encodeURIComponent(displayName)}`);
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API 無法連線 (${res.status}): ${errText}`);
        }
        const data = await res.json();
        
        currentReportsList = data; // 存入全域供複製/編輯使用

        const twToday = getTaiwanToday();
        const twMonthPrefix = twToday.substring(0, 7); // e.g. "2026-06"
        
        let todayCount = 0;
        let monthT = 0;
        let monthP = 0;
        let failCount = 0;

        data.forEach(r => {
            if (r.test_date === twToday) todayCount++;
            if (r.test_date && r.test_date.startsWith(twMonthPrefix)) {
                if (r.case_no && r.case_no.startsWith('T')) monthT++;
                else if (r.case_no && r.case_no.startsWith('P')) monthP++;
            }
            if (r.status === 'Fail' || r.status === 'Blocked') failCount++;
        });

        const elToday = document.getElementById('ws-stat-today');
        if (elToday) elToday.textContent = todayCount;
        
        const elMonthT = document.getElementById('ws-stat-month-t');
        if (elMonthT) elMonthT.textContent = monthT;
        
        const elMonthP = document.getElementById('ws-stat-month-p');
        if (elMonthP) elMonthP.textContent = monthP;
        
        const elFail = document.getElementById('ws-stat-fail');
        if (elFail) elFail.textContent = failCount;

        
        const startInput = document.getElementById('ws-filter-date-start');
        const endInput = document.getElementById('ws-filter-date-end');
        if (startInput && !startInput.value) startInput.value = twToday;
        if (endInput && !endInput.value) endInput.value = twToday;
        
        renderWorkspaceCalendar(data, wsCurrentYear, wsCurrentMonth);
        filterWorkspaceReports();
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('ws-recent-reports-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">載入失敗: ${err.message}</td></tr>`;
    }
}

function generateReportSummary(type) {
    if (!currentReportsList || currentReportsList.length === 0) {
        showToast('目前沒有可用的測試紀錄', true);
        return;
    }

    const isWorkspaceView = document.getElementById('view-workspace') && !document.getElementById('view-workspace').classList.contains('hidden');
    let targetDate = getTaiwanToday();
    
    if (isWorkspaceView) {
        const wsStart = document.getElementById('ws-filter-date-start');
        if (wsStart && wsStart.value) targetDate = wsStart.value;
    } else {
        const globalStart = document.getElementById('filter-start-date');
        if (globalStart && globalStart.value) targetDate = globalStart.value;
    }

    const prefix = type === 'daily' ? targetDate : targetDate.substring(0, 7); 
    
    // 過濾符合日期的報告
    const filtered = currentReportsList.filter(r => {
        if (!r.test_date) return false;
        return r.test_date.startsWith(prefix);
    });

    if (filtered.length === 0) {
        showToast('找不到符合該日期的測試紀錄', true);
        return;
    }

    // 將資料依日期/案號反轉為正序 (因為 API 預設是倒序)
    const sorted = [...filtered].reverse();

    let text = '';
    sorted.forEach((r, idx) => {
        text += `${idx + 1}. ${r.project_name}\n`;
    });

    document.getElementById('summary-result').value = text;
    document.getElementById('summary-modal-title').innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        ${type === 'daily' ? '日報表' : '月報表'}摘要 (${prefix})
    `;
    
    const extLink = document.getElementById('summary-external-link');
    if (extLink) {
        if (type === 'daily') {
            extLink.href = 'https://docs.google.com/spreadsheets/d/1OXOGgXZrDmkPFTVwjhiQgP-o_JH2uSIc9Xxq7aPQxZw/edit?usp=sharing';
        } else {
            extLink.href = 'http://192.168.1.242/manage/engineer/monthReport/Default.aspx';
        }
    }
    
    document.getElementById('summary-modal').classList.remove('hidden');
}

function copySummary() {
    const textarea = document.getElementById('summary-result');
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('已複製到剪貼簿！');
        document.getElementById('summary-modal').classList.add('hidden');
    } catch (err) {
        showToast('複製失敗，請手動複製', true);
    }
}

// Modal Logic
function openModal(mode = 'normal') {
    currentReportMode = mode;
    userEditedFields.clear();
    const modal = document.getElementById('report-modal');
    modal.classList.remove('hidden');
    // 設定今日日期為預設值 (台灣時間)
    document.getElementById('form-date').value = getTaiwanToday();
    
    // 自動預填案件編號 (格式: YYYYMMDD-01)
    const todayStr = document.getElementById('form-date').value;
    updateNextCaseNo(todayStr);
    
    // 載入記住的測試員
    const savedTester = localStorage.getItem('qa_display_name');
    if (savedTester) {
        document.getElementById('form-tester').value = savedTester;
    }
    
    document.getElementById('form-env').value = '';
    if (typeof updateEnvButtons === 'function') updateEnvButtons();
    
    document.getElementById('form-status').value = 'BLOCKED';
    
    document.getElementById('ticket-input').value = '';
    updateGeneratedResult();
}

// 根據日期自動計算下一個案件編號 (備用方案，在 API 失敗時發揮防呆作用)
function fallbackNextCaseNo(dateStr) {
    if (!dateStr) return '';
    const datePrefix = dateStr.replace(/-/g, '');
    
    let maxSeq = 0;
    if (Array.isArray(currentReportsList)) {
        currentReportsList.forEach(report => {
            if (report.case_no) {
                // 相容包含 P、T 與無字母開頭的情況
                if (report.case_no.match(new RegExp(`^[PT]?${datePrefix}-`))) {
                    const seqMatch = report.case_no.match(/-(\d+)$/);
                    if (seqMatch) {
                        const seq = parseInt(seqMatch[1], 10);
                        if (seq > maxSeq) maxSeq = seq;
                    }
                }
            }
        });
    }
    
    const nextSeq = maxSeq + 1;
    const nextSeqStr = nextSeq.toString().padStart(2, '0');
    const letter = currentReportMode === 'prod' ? 'P' : 'T';
    return `${letter}${datePrefix}-${nextSeqStr}`;
}

// 非同步從後端取得最新延續案件編號，並填入唯讀的案件編號欄位中
async function updateNextCaseNo(dateStr) {
    const caseNoEl = document.getElementById('form-case-no');
    if (!caseNoEl) return;
    
    if (!dateStr) {
        caseNoEl.value = '';
        updateGeneratedResult();
        return;
    }
    
    caseNoEl.value = '計算中...';
    updateGeneratedResult();
    
    try {
        const res = await fetch(`${API_BASE}/api/reports/next-case-no?date=${encodeURIComponent(dateStr)}&type=${currentReportMode}`);
        if (!res.ok) throw new Error('API 回傳異常');
        const data = await res.json();
        
        caseNoEl.value = data.nextCaseNo || '';
        updateGeneratedResult();
    } catch (err) {
        console.error(err);
        // 若 API 發生故障，退回至備用方案，避免用戶無法送出報告
        caseNoEl.value = fallbackNextCaseNo(dateStr);
        updateGeneratedResult();
    }
}

function closeModal() {
    document.getElementById('report-modal').classList.add('hidden');
    document.getElementById('report-form').reset();
    document.getElementById('ticket-input').value = '';
    document.getElementById('form-report-id').value = '';
    document.getElementById('modal-title').textContent = '撰寫測試報告';
    document.getElementById('submit-text').textContent = '儲存報告';
}

function clearGeneratorForm() {
    if (confirm('確定要清空所有已輸入的內容嗎？')) {
        document.getElementById('report-form').reset();
        document.getElementById('ticket-input').value = '';
        const grafanaInput = document.getElementById('grafana-input');
        if (grafanaInput) grafanaInput.value = '';
        
        // Restore default values
        document.getElementById('form-date').value = getTaiwanToday();
        document.getElementById('form-test-case').value = '';
        const savedTester = localStorage.getItem('qa_display_name');
        if (savedTester) {
            document.getElementById('form-tester').value = savedTester;
        }
        
        // Reset device checkboxes
        if(document.getElementById('chk-ipad')) document.getElementById('chk-ipad').checked = false;
        if(document.getElementById('chk-iphone')) document.getElementById('chk-iphone').checked = false;

        // Clear presets radio buttons manually except category which defaults to '其他'
        document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        const defaultCategory = document.querySelector('input[name="report_category"][value="其他"]');
        if (defaultCategory) defaultCategory.checked = true;
        
        updateGeneratedResult();
        showToast('內容已清空');
    }
}

// Toast Logic
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-message');
    msgEl.textContent = message;
    
    if (isError) {
        toast.classList.replace('bg-gray-800', 'bg-red-600');
    } else {
        toast.classList.replace('bg-red-600', 'bg-gray-800');
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}



async function initFilterTesters() {
    try {
        const res = await fetch(`${API_BASE}/api/stats`);
        if (!res.ok) return;
        const data = await res.json();
        
        const selectTester = document.getElementById('filter-tester');
        if (!selectTester) return;
        
        const currentVal = selectTester.value;
        const displayName = localStorage.getItem('qa_display_name') || '';
        
        selectTester.innerHTML = '<option value="all">全部</option>';
        const testers = new Set();
        if (displayName) testers.add(displayName);
        if (data.testerStats) {
            data.testerStats.forEach(t => {
                let baseName = t.tester_name;
                if (baseName && baseName.includes(' - ')) {
                    baseName = baseName.split(' - ')[0];
                }
                if (baseName) testers.add(baseName);
            });
        }
        testers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            selectTester.appendChild(opt);
        });

        if (!currentVal || currentVal === 'all') {
            selectTester.value = 'all';
        } else {
            selectTester.value = currentVal;
        }
    } catch (e) {
        console.error('初始化測試員列表失敗', e);
    }
}

// ================= API Calls =================

async function loadDashboard() {
    try {
        const start_date = document.getElementById('dash-filter-start')?.value || '';
        const end_date = document.getElementById('dash-filter-end')?.value || '';
        
        let url = `${API_BASE}/api/stats?`;
        if (start_date) url += `start_date=${encodeURIComponent(start_date)}&`;
        if (end_date) url += `end_date=${encodeURIComponent(end_date)}&`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('API 無法連線');
        const data = await res.json();
        
        // Update Summary Cards
        let total = 0;
        let blocked = 0;
        data.statusStats.forEach(s => {
            total += s.count;
            if (s.status === 'Blocked') blocked = s.count;
        });

        const hasFilter = !!(start_date || end_date);
        
        const labelTotal = document.getElementById('label-total-count');
        const labelT = document.getElementById('label-t-count');
        const labelP = document.getElementById('label-p-count');
        
        if (hasFilter) {
            if (labelTotal) labelTotal.textContent = '區間案件總數';
            if (labelT) labelT.textContent = '區間 T 單 (測試)';
            if (labelP) labelP.textContent = '區間 P 單 (上正式)';
        } else {
            if (labelTotal) labelTotal.textContent = '本月案件';
            if (labelT) labelT.textContent = '今日案件';
            if (labelP) labelP.textContent = '今日上正式';
        }

        document.getElementById('stat-total').textContent = data.monthTotal || 0;
        document.getElementById('stat-blocked').textContent = blocked;
        
        if (data.typeStats) {
            document.getElementById('stat-t-count').textContent = data.typeStats.t_count || 0;
            document.getElementById('stat-p-count').textContent = data.typeStats.p_count || 0;
        }

        // 動態填充測試員下拉選單已移至 initFilterTesters()，但這裡仍可呼叫一次確保資料最新
        initFilterTesters();

        // Render Charts
        renderCharts(data.dailyStats, data.statusStats);

        // Aggregate Tester Stats
        let groupedStats = {};
        (data.testerStats || []).forEach(t => {
            let baseName = t.tester_name;
            if (baseName && baseName.includes(' - ')) {
                baseName = baseName.split(' - ')[0];
            }
            if (!groupedStats[baseName]) {
                groupedStats[baseName] = { ...t, tester_name: baseName };
            } else {
                groupedStats[baseName].total_count += t.total_count;
                groupedStats[baseName].total_t = (groupedStats[baseName].total_t || 0) + (t.total_t || 0);
                groupedStats[baseName].total_p = (groupedStats[baseName].total_p || 0) + (t.total_p || 0);
                
                groupedStats[baseName].today_count += t.today_count;
                groupedStats[baseName].today_t = (groupedStats[baseName].today_t || 0) + (t.today_t || 0);
                groupedStats[baseName].today_p = (groupedStats[baseName].today_p || 0) + (t.today_p || 0);
                
                groupedStats[baseName].week_count = (groupedStats[baseName].week_count || 0) + (t.week_count || 0);
                groupedStats[baseName].week_t = (groupedStats[baseName].week_t || 0) + (t.week_t || 0);
                groupedStats[baseName].week_p = (groupedStats[baseName].week_p || 0) + (t.week_p || 0);
                
                groupedStats[baseName].month_count += t.month_count;
                groupedStats[baseName].month_t = (groupedStats[baseName].month_t || 0) + (t.month_t || 0);
                groupedStats[baseName].month_p = (groupedStats[baseName].month_p || 0) + (t.month_p || 0);
                
                groupedStats[baseName].is_active = Math.max(groupedStats[baseName].is_active, t.is_active);
            }
        });
        currentTesterStats = Object.values(groupedStats);

        renderTesterCheckboxes(currentTesterStats);
        renderTesterStats();
    } catch (err) {
        console.error(err);
        // showToast('載入儀表板資料失敗', true); // 開發階段暫時關閉錯誤提示以免沒有開 server 時彈出
    }
}

async function showDashboardDetails(type) {
    const container = document.getElementById('dashboard-details-container');
    const tbody = document.getElementById('dashboard-details-body');
    const titleEl = document.getElementById('dashboard-details-title');
    if (!container || !tbody || !titleEl) return;
    
    container.classList.remove('hidden');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">載入中...</td></tr>';
    
    try {
        const start_date = document.getElementById('dash-filter-start')?.value || '';
        const end_date = document.getElementById('dash-filter-end')?.value || '';
        
        let url = `${API_BASE}/api/reports?`;
        if (start_date) url += `start_date=${encodeURIComponent(start_date)}&`;
        if (end_date) url += `end_date=${encodeURIComponent(end_date)}&`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('無法取得案件資料');
        const data = await res.json();
        
        currentReportsList = data; // 存入全域供 viewReportDetails 使用
        
        const twToday = getTaiwanToday();
        const twFirstDay = getTaiwanFirstDay();
        
        let filtered = [];
        let title = '案件清單';
        
        if (type === 'month') {
            title = start_date || end_date ? '區間案件清單' : '本月案件清單';
            filtered = data.filter(r => {
                if (start_date || end_date) return true;
                return r.test_date && r.test_date >= twFirstDay;
            });
        } else if (type === 'today') {
            title = start_date || end_date ? '區間 T 單 (測試) 清單' : '今日 T 單 (測試) 清單';
            filtered = data.filter(r => {
                const inDate = (start_date || end_date) ? true : (r.test_date === twToday);
                return inDate && r.case_no && r.case_no.startsWith('T');
            });
        } else if (type === 'today-prod') {
            title = start_date || end_date ? '區間 P 單 (上正式) 清單' : '今日 P 單 (上正式) 清單';
            filtered = data.filter(r => {
                const inDate = (start_date || end_date) ? true : (r.test_date === twToday);
                return inDate && r.case_no && r.case_no.startsWith('P');
            });
        } else if (type === 'blocked') {
            title = '阻礙中 (Blocked) 案件清單';
            filtered = data.filter(r => r.status === 'Blocked');
        }
        
        titleEl.textContent = title;
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">尚無符合條件的案件</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        filtered.forEach((report, index) => {
            const tr = document.createElement('tr');
            
            let displayTester = escapeHtml(report.tester_name);
            if (displayTester.includes('-更')) {
                displayTester = displayTester.replace(/ - (.*?)-更/g, ' <span class="text-red-500 font-bold">-$1-更</span>');
            }
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">${index + 1}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"><span class="cursor-pointer text-blue-600 hover:underline" onclick="viewReportDetails(${report.id})">${escapeHtml(report.case_no || '-')}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(report.project_name)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayTester}</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="status-badge status-${report.status}">${report.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch(err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">載入失敗：${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderTesterCheckboxes(testerStats) {
    const group = document.getElementById('tester-checkbox-group');
    if (!group) return;
    
    let html = '';
    testerStats.forEach(t => {
        if (t.tester_name === 'admin') return; // 過濾掉 admin 帳號
        
        // 如果 API 沒有回傳 is_active，我們預設為 1；若回傳 0 則代表停用
        const isActive = t.is_active !== 0;
        const checked = isActive ? 'checked' : '';
        
        // 已離職打個標記，文字顏色淡一點
        const labelClass = isActive ? 'text-gray-700' : 'text-gray-400 line-through';
        const tag = isActive ? '' : '<span class="text-[10px] bg-gray-200 text-gray-500 px-1 rounded ml-1 border border-gray-300">離職</span>';
        
        html += `
            <label class="flex items-center cursor-pointer px-4 py-2 hover:bg-gray-50 transition text-sm">
                <input type="checkbox" class="tester-filter-chk w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" 
                       value="${escapeHtml(t.tester_name)}" ${checked} onchange="renderTesterStats()">
                <span class="ml-3 font-medium ${labelClass}">${escapeHtml(t.tester_name)}${tag}</span>
            </label>
        `;
    });
    group.innerHTML = html;
}

function renderTesterStats() {
    const tbody = document.getElementById('tester-stats-body');
    if (!tbody) return;

    if (!currentTesterStats || currentTesterStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">目前無資料</td></tr>';
        return;
    }
    
    // 取得有勾選的測試員
    const checkedNodes = document.querySelectorAll('.tester-filter-chk:checked');
    const checkedTesters = Array.from(checkedNodes).map(cb => cb.value);

    const countSpan = document.getElementById('tester-selected-count');
    if (countSpan) countSpan.textContent = checkedTesters.length;

    // 過濾資料
    const filteredStats = currentTesterStats.filter(t => checkedTesters.includes(t.tester_name));

    if (filteredStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">請勾選要顯示的測試員</td></tr>';
        return;
    }

    const currentUser = localStorage.getItem('qa_display_name') || '';

    // 先排序：自己優先，其次依本月件數降冪，再依今日件數降冪
    const sorted = [...filteredStats].sort((a, b) => {
        if (a.tester_name === currentUser) return -1;
        if (b.tester_name === currentUser) return 1;
        if (b.month_count !== a.month_count) {
            return b.month_count - a.month_count;
        }
        return b.today_count - a.today_count;
    });

    tbody.innerHTML = sorted.map(t => {
        const isSelf = t.tester_name === currentUser;
        const rowClass = isSelf ? 'bg-blue-50/50' : 'hover:bg-gray-50 transition';
        const nameClass = isSelf ? 'font-bold text-primary' : 'font-medium text-gray-900';
        const selfBadge = isSelf
            ? `<span class="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded ml-2 align-middle">我</span>`
            : '';

        const todayT = t.today_t || 0;
        const todayP = t.today_p || 0;
        const weekT = t.week_t || 0;
        const weekP = t.week_p || 0;
        const monthT = t.month_t || 0;
        const monthP = t.month_p || 0;
        const totalT = t.total_t || 0;
        const totalP = t.total_p || 0;

        const cellClass = "px-6 py-4 whitespace-nowrap text-sm text-center";

        return `
            <tr class="${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm ${nameClass}">
                    ${escapeHtml(t.tester_name)}${selfBadge}
                </td>
                <td class="${cellClass}">
                    <div class="flex items-center justify-center gap-1">
                        <span class="${todayT > 0 ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'}">${todayT}</span> 
                        <span class="text-gray-300">/</span> 
                        <span class="${todayP > 0 ? 'text-green-600 font-bold' : 'text-gray-400 font-medium'}">${todayP}</span>
                    </div>
                </td>
                <td class="${cellClass}">
                    <div class="flex items-center justify-center gap-1">
                        <span class="${weekT > 0 ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'}">${weekT}</span> 
                        <span class="text-gray-300">/</span> 
                        <span class="${weekP > 0 ? 'text-green-600 font-bold' : 'text-gray-400 font-medium'}">${weekP}</span>
                    </div>
                </td>
                <td class="${cellClass}">
                    <div class="flex items-center justify-center gap-1">
                        <span class="${monthT > 0 ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'}">${monthT}</span> 
                        <span class="text-gray-300">/</span> 
                        <span class="${monthP > 0 ? 'text-green-600 font-bold' : 'text-gray-400 font-medium'}">${monthP}</span>
                    </div>
                </td>
                <td class="${cellClass}">
                    <div class="flex items-center justify-center gap-1">
                        <span class="${totalT > 0 ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'}">${totalT}</span> 
                        <span class="text-gray-300">/</span> 
                        <span class="${totalP > 0 ? 'text-green-600 font-bold' : 'text-gray-400 font-medium'}">${totalP}</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}



async function fetchReports() {
    const start_date = document.getElementById('filter-start-date').value;
    const end_date = document.getElementById('filter-end-date').value;
    
    let url = `${API_BASE}/api/reports?`;
    if (start_date) url += `start_date=${encodeURIComponent(start_date)}&`;
    if (end_date) url += `end_date=${encodeURIComponent(end_date)}&`;

    try {
        const tbody = document.getElementById('reports-table-body');
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">載入中...</td></tr>';
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('API 無法連線');
        const data = await res.json();
        
        currentReportsList = data; // 存入全域變數以供編輯時快速查找
        
        reportsCurrentPage = 1;
        renderReportsTable();
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('reports-table-body');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">載入失敗：${escapeHtml(err.message)}</td></tr>`;
        }
    }
}

function clearFilters() {
    const twToday = getTaiwanToday();
    const twFirstDay = getTaiwanFirstDay();
    
    document.getElementById('filter-start-date').value = twFirstDay;
    document.getElementById('filter-end-date').value = twToday;
    
    document.getElementById('filter-tester').value = 'all';
    
    fetchReports();
}

function setReportsToday() {
    const twToday = getTaiwanToday();
    document.getElementById('filter-start-date').value = twToday;
    document.getElementById('filter-end-date').value = twToday;
    fetchReports();
}

function parseReportNotesToForm(text, rawTicket) {
    if (!text) return;
    
    document.getElementById('ticket-input').value = rawTicket || text; // Just show it to the user so they can see the source

    const extractField = (regex) => {
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };

    const tester = extractField(/測試人員\s*[：:]\s*([^\n]+)/);
    if (tester) document.getElementById('form-tester').value = tester;

    const dev = extractField(/工程人員\s*[：:]\s*([^\n]+)/);
    if (dev) document.getElementById('form-developer').value = dev;

    const parent = extractField(/母單\s*[：:]\s*([^\n]+)/);
    if (parent) document.getElementById('form-parent-ticket').value = parent;

    const sub = extractField(/子單\s*[：:]\s*([^\n]+)/);
    if (sub) document.getElementById('form-sub-ticket').value = sub;

    const device = extractField(/測試裝置\s*[：:]\s*([^\n]+)/);
    if (device) document.getElementById('form-device').value = device;

    const testCase = extractField(/測試案例\s*[：:]\s*([^\n]+)/);
    if (testCase) document.getElementById('form-test-case').value = testCase;

    const risk = extractField(/風險評估\s*[：:]\s*([^\n]+)/);
    if (risk) document.getElementById('form-risk').value = risk;

    const passRate = extractField(/通過率(?:\(%\))?\s*[：:]\s*([^\n]+)/);
    if (passRate) document.getElementById('form-pass-rate').value = passRate;

    const notes = extractField(/備註\s*[：:]\s*([^\n]+)/);
    if (notes) document.getElementById('form-notes').value = notes;

    const versionMatch = text.match(/軟體版本\s*[：:]\n?([\s\S]*?)(?=\n測試環境|\n測試裝置|\n測試案例|\n測試步驟|\n工單說明|\n風險評估|$)/);
    if (versionMatch) document.getElementById('form-version').value = versionMatch[1].trim();

    const envMatch = text.match(/測試環境\s*[：:]\n?([\s\S]*?)(?=\n測試裝置|\n測試案例|\n測試步驟|\n工單說明|\n風險評估|$)/);
    if (envMatch) document.getElementById('form-env').value = envMatch[1].trim();

    const testStepsMatch = text.match(/測試步驟\s*[：:]\n?([\s\S]*?)(?=\n工單說明|\n風險評估|\n通過率|\n備註|\n處理狀態|$)/);
    if (testStepsMatch) document.getElementById('form-test-steps').value = testStepsMatch[1].trim();

    const stepsMatch = text.match(/工單說明\s*[：:]\n?([\s\S]*?)(?=\n風險評估|\n通過率|\n備註|\n處理狀態|$)/);
    if (stepsMatch) document.getElementById('form-steps').value = stepsMatch[1].trim();
}

// 複製該筆報告為新範本 (點擊後自動載入資料並進入「新增模式」以新增另一筆)
function copyReportNotes(id) {
    const report = currentReportsList.find(r => r.id === id);
    if (!report) {
        showToast('找不到此報告資料', true);
        return;
    }

    const caseNo = report.case_no || '';
    if (caseNo.startsWith('P')) {
        currentReportMode = 'prod';
    } else {
        currentReportMode = 'normal';
    }

    // 開啟 Modal
    document.getElementById('report-modal').classList.remove('hidden');
    
    // 設定為 新增 模式 (這樣送出時才會是 POST 新增一筆)
    document.getElementById('form-report-id').value = ''; 
    document.getElementById('modal-title').textContent = '撰寫測試報告';
    document.getElementById('submit-text').textContent = '儲存報告';

    // 填入基本與獨立欄位
    const twToday = getTaiwanToday();
    document.getElementById('form-case-no').value = '計算中...';
    updateNextCaseNo(twToday);
    document.getElementById('form-project').value = report.project_name || '';
    document.getElementById('form-tester').value = report.tester_name || '';
    document.getElementById('form-date').value = twToday;
    document.getElementById('form-status').value = report.status || 'Pass';
    document.getElementById('form-test-case').value = report.bug_link || '';

    const categoryRadio = document.querySelector(`input[name="report_category"][value="${report.category || '其他'}"]`);
    if (categoryRadio) categoryRadio.checked = true;

    // 解析歷史報告欄位
    parseReportNotesToForm(report.notes, report.raw_ticket);
    updateGeneratedResult();

    showToast('已複製報告內容為新範本，修改完案件編號即可儲存！');
}

// 編輯測試報告 (載入資料至 Form 中並開 Modal)
function editReport(id) {
    const report = currentReportsList.find(r => r.id === id);
    if (!report) {
        showToast('找不到此報告資料', true);
        return;
    }

    // 開啟 Modal
    document.getElementById('report-modal').classList.remove('hidden');
    
    // 設定為編輯模式
    document.getElementById('form-report-id').value = report.id;
    document.getElementById('modal-title').textContent = `修改測試報告：${report.case_no || ''}`;
    document.getElementById('submit-text').textContent = '更新報告';

    // 填入基本與獨立欄位
    document.getElementById('form-case-no').value = report.case_no || '';
    document.getElementById('form-project').value = report.project_name || '';
    document.getElementById('form-tester').value = report.tester_name || '';
    document.getElementById('form-date').value = report.test_date || '';
    document.getElementById('form-status').value = report.status || 'Pass';
    document.getElementById('form-test-case').value = report.bug_link || '';

    const categoryRadio = document.querySelector(`input[name="report_category"][value="${report.category || '其他'}"]`);
    if (categoryRadio) categoryRadio.checked = true;

    // 解析歷史報告欄位
    parseReportNotesToForm(report.notes, report.raw_ticket);
    updateGeneratedResult();
}

// 刪除測試報告
async function deleteReport(id) {
    if (!confirm('確定要刪除這筆測試報告嗎？此動作無法復原。')) return;

    try {
        const res = await fetch(`${API_BASE}/api/reports/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, token: localStorage.getItem('qa_session_token') })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '刪除失敗');
        
        showToast('測試報告已刪除！');
        fetchReports(); // 刷新報告表格
        loadDashboard(); // 刷新儀表板
        loadWorkspace(); // 刷新個人工作台
    } catch (err) {
        console.error(err);
        showToast(err.message, true);
    }
}

async function submitReport(e) {
    e.preventDefault();
    const form = document.getElementById('report-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const reportId = document.getElementById('form-report-id').value;
    const isEditMode = !!reportId;

    const payload = {
        token: localStorage.getItem('qa_session_token'),
        case_no: document.getElementById('form-case-no').value.trim(),
        project_name: document.getElementById('form-project').value.trim(),
        tester_name: document.getElementById('form-tester').value.trim(),
        test_date: document.getElementById('form-date').value,
        status: document.getElementById('form-status').value,
        bug_link: document.getElementById('form-test-case').value.trim(), // 存在資料庫的 bug_link 欄位
        category: document.querySelector('input[name="report_category"]:checked')?.value || '其他',
        raw_ticket: document.getElementById('ticket-input').value,
        notes: document.getElementById('generated-result').value,
    };
    
    if (isEditMode) {
        payload.id = parseInt(reportId, 10);
    }
    
    if (payload.tester_name) {
        localStorage.setItem('qa_tester_name', payload.tester_name);
    }

    const btnText = document.getElementById('submit-text');
    const spinner = document.getElementById('submit-spinner');
    
    btnText.textContent = '處理中...';
    if (spinner) spinner.classList.remove('hidden');

    try {
        const endpoint = isEditMode ? `${API_BASE}/api/reports/update` : `${API_BASE}/api/reports`;
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || (isEditMode ? '修改失敗' : '新增失敗'));
        
        showToast(isEditMode ? '測試報告已成功修改！' : '測試報告已成功新增！');
        closeModal();
        fetchReports(); // Refresh table
        loadDashboard(); // Refresh stats
    } catch (err) {
        console.error(err);
        showToast(err.message, true);
    } finally {
        btnText.textContent = isEditMode ? '更新報告' : '儲存報告';
        if (spinner) spinner.classList.add('hidden');
    }
}

// ================= Collaboration Board Logic =================
function loadCollaborationBoard() {
    fetchBulletins();
    renderCollabList('todo');
}

async function fetchBulletins() {
    try {
        const res = await fetch(`${API_BASE}/api/collab/bulletins`);
        if (!res.ok) throw new Error('無法載入佈告欄');
        const data = await res.json();
        renderBulletinList(data);
    } catch (err) {
        console.error(err);
        const listEl = document.getElementById('collab-bulletin-list');
        if (listEl) listEl.innerHTML = '<div class="text-center text-sm text-red-500 py-4">載入失敗</div>';
    }
}

function renderBulletinList(data) {
    const listEl = document.getElementById('collab-bulletin-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!data || data.length === 0) {
        listEl.innerHTML = '<div class="text-center text-sm text-gray-400 py-4">目前沒有項目</div>';
        return;
    }

    const currentUser = localStorage.getItem('qa_display_name');
    const currentUserRole = localStorage.getItem('qa_role') || 'user';

    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'bg-white p-3 rounded shadow-sm border border-gray-100 relative group flex gap-3 items-start transition';
        
        const timestampStr = new Date(item.created_at).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const contentHtml = `
            <div class="flex-1">
                <div class="flex justify-between items-baseline mb-1">
                    <span class="text-xs font-bold text-gray-700">${escapeHtml(item.author)}</span>
                    <span class="text-[10px] text-gray-400">${timestampStr}</span>
                </div>
                <p class="text-sm text-gray-800 break-all whitespace-pre-wrap">${escapeHtml(item.content)}</p>
            </div>
        `;

        const canDelete = currentUserRole === 'admin' || item.author === currentUser;
        const deleteBtnHtml = canDelete ? `
            <button onclick="deleteCollabItem('bulletin', '${item.id}')" class="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        ` : '';

        div.innerHTML = `${contentHtml}${deleteBtnHtml}`;
        listEl.appendChild(div);
    });
}

function getCollabData(type) {
    const data = localStorage.getItem(`qa_${type}s`);
    return data ? JSON.parse(data) : [];
}

function saveCollabData(type, data) {
    localStorage.setItem(`qa_${type}s`, JSON.stringify(data));
}

function renderCollabList(type) {
    if (type === 'bulletin') {
        fetchBulletins();
        return;
    }
    
    const listEl = document.getElementById(`collab-${type}-list`);
    if (!listEl) return;
    const data = getCollabData(type);
    listEl.innerHTML = '';

    if (data.length === 0) {
        listEl.innerHTML = '<div class="text-center text-sm text-gray-400 py-4">目前沒有項目</div>';
        return;
    }

    // 代辦事項專用邏輯
    let sortedData = [...data];
    sortedData.sort((a, b) => {
        if (a.completed === b.completed) return b.timestamp - a.timestamp;
        return a.completed ? 1 : -1;
    });
    
    sortedData.forEach(item => {
        const div = document.createElement('div');
        div.className = `bg-white p-3 rounded shadow-sm border border-gray-100 relative group flex gap-3 items-start transition ${item.completed ? 'opacity-60 bg-gray-50' : ''}`;
        
        const timestampStr = new Date(item.timestamp).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const checkedAttr = item.completed ? 'checked' : '';
        const textClass = item.completed ? 'line-through text-gray-400' : 'text-gray-800';
        const contentHtml = `
            <input type="checkbox" ${checkedAttr} onchange="toggleCollabTodo('${item.id}')" class="mt-1 h-4 w-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500 cursor-pointer">
            <div class="flex-1">
                <p class="text-sm font-medium ${textClass} break-all">${escapeHtml(item.text)}</p>
                <p class="text-[10px] text-gray-400 mt-1">${escapeHtml(item.author)} · ${timestampStr}</p>
            </div>
        `;

        div.innerHTML = `
            ${contentHtml}
            <button onclick="deleteCollabItem('${type}', '${item.id}')" class="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        listEl.appendChild(div);
    });
}

async function addCollabItem(type) {
    const inputEl = document.getElementById(`collab-${type}-input`);
    const text = inputEl.value.trim();
    if (!text) return;

    if (type === 'bulletin') {
        const token = localStorage.getItem('qa_session_token');
        if (!token) {
            showToast('請先登入', true);
            return;
        }
        
        inputEl.disabled = true;
        try {
            const res = await fetch(`${API_BASE}/api/collab/bulletins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, content: text })
            });
            if (!res.ok) throw new Error('新增失敗');
            inputEl.value = '';
            fetchBulletins();
        } catch (err) {
            showToast(err.message, true);
        } finally {
            inputEl.disabled = false;
        }
    } else {
        const displayName = localStorage.getItem('qa_display_name') || '未知名稱';
        const data = getCollabData(type);
        
        const newItem = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
            text: text,
            author: displayName,
            timestamp: Date.now(),
            completed: false
        };

        data.unshift(newItem);
        saveCollabData(type, data);
        
        inputEl.value = '';
        renderCollabList(type);
    }
}

async function deleteCollabItem(type, id) {
    if (!confirm('確定要刪除嗎？')) return;
    
    if (type === 'bulletin') {
        const token = localStorage.getItem('qa_session_token');
        if (!token) {
            showToast('請先登入', true);
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/api/collab/bulletins/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            if (!res.ok) throw new Error('刪除失敗');
            fetchBulletins();
        } catch (err) {
            showToast(err.message, true);
        }
    } else {
        const data = getCollabData(type);
        const newData = data.filter(item => item.id !== id);
        saveCollabData(type, newData);
        renderCollabList(type);
    }
}

function toggleCollabTodo(id) {
    const data = getCollabData('todo');
    const item = data.find(i => i.id === id);
    if (item) {
        item.completed = !item.completed;
        saveCollabData('todo', data);
        renderCollabList('todo');
    }
}


// ================= Generator Logic =================
function initGeneratorLogic() {
    const inputs = ['form-case-no', 'form-project', 'form-tester', 'form-developer', 'form-date', 'form-parent-ticket', 'form-sub-ticket', 'form-version', 'form-env', 'form-device', 'form-test-case', 'form-test-steps', 'form-steps', 'form-risk', 'form-pass-rate', 'form-status', 'form-notes', 'chk-ipad', 'chk-iphone', 'form-ipad-version', 'form-iphone-version'];
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                if (e.isTrusted) {
                    userEditedFields.add(id);
                }
                if (id === 'form-date') {
                    const isEditMode = document.getElementById('form-report-id').value !== '';
                    if (!isEditMode) {
                        updateNextCaseNo(el.value);
                    }
                }
                parseGrafanaVersion();
                updateGeneratedResult();
            });
        }
    });

    const grafanaInput = document.getElementById('grafana-input');
    if (grafanaInput) {
        grafanaInput.addEventListener('input', (e) => {
            if (e.isTrusted) userEditedFields.add('form-version');
            const grafanaText = grafanaInput.value.trim();
            if (!grafanaText) {
                document.getElementById('form-version').value = '';
            } else {
                let extractedVersions = [];
                const regex = /(Frontend|Backend)\s*-\s*([a-zA-Z]+)[^a-zA-Z0-9]+([a-zA-Z0-9.\-_]+)/gi;
                let match;
                while ((match = regex.exec(grafanaText)) !== null) {
                    const type = match[1].toLowerCase() === 'frontend' ? '前端' : '後端';
                    const env = match[2].toUpperCase();
                    const ver = match[3];
                    extractedVersions.push(`${type}(${env}): ${ver}`);
                }
                if (extractedVersions.length > 0) {
                    document.getElementById('form-version').value = extractedVersions.join('\n');
                }
            }
            updateGeneratedResult();
        });
    }

    const ticketInput = document.getElementById('ticket-input');
    if (ticketInput) {
        ticketInput.addEventListener('input', (e) => {
            const text = e.target.value;
            if (!text) return;
            let updated = false;

            const versionMatch = text.match(/(?:軟體版本|版號|測試版本|版本)\s*[：:]\s*([^\n]+)/);
            if (versionMatch && !userEditedFields.has('form-version')) {
                document.getElementById('form-version').value = versionMatch[1].trim();
                updated = true;
            }

            const deviceMatch = text.match(/(?:測試裝置|裝置|設備)\s*[：:]\s*([^\n]+)/);
            if (deviceMatch && !userEditedFields.has('form-device')) {
                document.getElementById('form-device').value = deviceMatch[1].trim();
                updated = true;
            }
            
            const testerMatch = text.match(/(?:測試人員|QA)\s*[：:]\s*([^\n]+)/);
            if (testerMatch && !userEditedFields.has('form-tester')) {
                document.getElementById('form-tester').value = testerMatch[1].trim();
                updated = true;
            }

            const devMatch = text.match(/(?:工程人員|RD|開發人員)\s*[：:]\s*([^\n]+)/);
            if (devMatch && !userEditedFields.has('form-developer')) {
                document.getElementById('form-developer').value = devMatch[1].trim();
                updated = true;
            }

            const envMatch = text.match(/(?:測試環境|測試網址)\s*[：:]\s*([^\n]+)/);
            if (envMatch && !userEditedFields.has('form-env')) {
                document.getElementById('form-env').value = envMatch[1].trim();
                updated = true;
            }

            const parentMatch = text.match(/母單\s*[：:]\s*([^\n]+)/);
            if (parentMatch && !userEditedFields.has('form-parent-ticket')) {
                document.getElementById('form-parent-ticket').value = parentMatch[1].trim();
                updated = true;
            }

            const subMatch = text.match(/子單\s*[：:]\s*([^\n]+)/);
            if (subMatch && !userEditedFields.has('form-sub-ticket')) {
                document.getElementById('form-sub-ticket').value = subMatch[1].trim();
                updated = true;
            }

            // 掃描每一行尋找標題與母子單號，並保留未匹配的段落
            const lines = text.split('\n').map(l => l.trim());
            let otherNotes = [];

            for (const line of lines) {
                if (!line) continue;

                // 若該行是已知欄位標籤，跳過它
                if (line.match(/^(?:軟體版本|版號|測試版本|版本|測試裝置|裝置|設備|測試人員|QA|工程人員|RD|開發人員|測試環境|測試網址|母單|子單|卡片|測試案例|網址|連結|Ticket|URL)\s*[：:]/i)) {
                    continue;
                }

                // 判斷是否為標題 (包含 【】 或 [] 的文字)
                if (( (line.includes('【') && line.includes('】')) || (line.includes('[') && line.includes(']')) ) && !userEditedFields.has('form-project')) {
                    document.getElementById('form-project').value = line;
                    updated = true;
                    continue; // 標題不需要被放進其他說明裡
                }

                // 嘗試抓取 T單號 (通常為母單/任務單)
                const tTaskMatch = line.match(/(T\d+)/);
                if (tTaskMatch && !userEditedFields.has('form-parent-ticket')) {
                    document.getElementById('form-parent-ticket').value = tTaskMatch[1];
                    updated = true;
                }

                // 嘗試抓取 #單號 (通常為子單/Bug單/PR)
                const hashTaskMatch = line.match(/(#\d+)/);
                if (hashTaskMatch && !userEditedFields.has('form-sub-ticket')) {
                    document.getElementById('form-sub-ticket').value = hashTaskMatch[1];
                    updated = true;
                }

                // 將未配對的剩餘文字全部保留為其他說明
                otherNotes.push(line);
            }

            // 寫入其他說明 (保留所有分段)
            if (otherNotes.length > 0 && !userEditedFields.has('form-steps')) {
                document.getElementById('form-steps').value = otherNotes.join('\n');
                updated = true;
            }

            // 抓取網址當作測試案例
            const urlMatch = text.match(/(?:卡片|測試案例|網址|連結|Ticket|URL)\s*[：:]\s*(https?:\/\/[^\s]+)/i) || text.match(/(https?:\/\/[^\s]+)/i);
            if (urlMatch && !userEditedFields.has('form-test-case')) {
                document.getElementById('form-test-case').value = urlMatch[1].trim();
                updated = true;
            }

            parseGrafanaVersion();

            if (updated) updateGeneratedResult();
        });
    }
}

function parseGrafanaVersion() {
    if (userEditedFields.has('form-version')) return;

    const ticketText = document.getElementById('ticket-input')?.value || '';
    if (!ticketText) return;

    const currentEnvText = (document.getElementById('form-env').value || '').toLowerCase();
    
    // 如果工單內容本身就含有 STG 或 QA，優先以此為準來抓取對應的版號
    let targetEnv = null;
    if (currentEnvText.includes('stg') || ticketText.match(/測試環境.*stg/i) || ticketText.match(/\bstg\b/i)) targetEnv = 'stg';
    if (currentEnvText.includes('qa') || ticketText.match(/測試環境.*qa/i) || ticketText.match(/\bqa\b/i)) targetEnv = 'qa';
    if (currentEnvText.includes('prod') || ticketText.match(/測試環境.*prod/i) || ticketText.match(/\bprod\b/i)) targetEnv = 'prod';

    let extractedVersions = [];

    if (targetEnv) {
        // 如果有明確環境，只抓該環境
        const feRegex = new RegExp(`Frontend\\s*-\\s*${targetEnv}[^a-zA-Z0-9]+([a-zA-Z0-9.\\-_]+)`, 'i');
        const beRegex = new RegExp(`Backend\\s*-\\s*${targetEnv}[^a-zA-Z0-9]+([a-zA-Z0-9.\\-_]+)`, 'i');
        const feMatch = ticketText.match(feRegex);
        const beMatch = ticketText.match(beRegex);

        if (feMatch) extractedVersions.push(`前端(${targetEnv.toUpperCase()}): ${feMatch[1]}`);
        if (beMatch) extractedVersions.push(`後端(${targetEnv.toUpperCase()}): ${beMatch[1]}`);
    } else {
        // 如果還沒有指定環境，就把全部 (prod, stg, qa) 都列出來
        const regex = /(Frontend|Backend)\s*-\s*([a-zA-Z]+)[^a-zA-Z0-9]+([a-zA-Z0-9.\-_]+)/gi;
        let match;
        while ((match = regex.exec(ticketText)) !== null) {
            const type = match[1].toLowerCase() === 'frontend' ? '前端' : '後端';
            const env = match[2].toUpperCase();
            const ver = match[3];
            extractedVersions.push(`${type}(${env}): ${ver}`);
        }
    }

    if (extractedVersions.length > 0) {
        document.getElementById('form-version').value = extractedVersions.join('\n');
    }
}

function updateGeneratedResult() {
    const caseNoVal = document.getElementById('form-case-no') ? document.getElementById('form-case-no').value.trim() : '';
    const projectNameVal = document.getElementById('form-project') ? document.getElementById('form-project').value.trim() : '';
    const dateVal = document.getElementById('form-date').value;
    const formattedDate = dateVal ? dateVal.replace(/-/g, '/') : '';
    const testerVal = document.getElementById('form-tester').value.trim();
    const devVal = document.getElementById('form-developer') ? document.getElementById('form-developer').value.trim() : '';
    const parentTicketVal = document.getElementById('form-parent-ticket').value.trim();
    const subTicketVal = document.getElementById('form-sub-ticket').value.trim();
    const versionVal = document.getElementById('form-version').value.trim();
    const envVal = document.getElementById('form-env').value.trim();
    const deviceVal = document.getElementById('form-device') ? document.getElementById('form-device').value.trim() : '';
    
    const isIpad = document.getElementById('chk-ipad') ? document.getElementById('chk-ipad').checked : false;
    const ipadVersion = document.getElementById('form-ipad-version') ? document.getElementById('form-ipad-version').value.trim() : '';
    const isIphone = document.getElementById('chk-iphone') ? document.getElementById('chk-iphone').checked : false;
    const iphoneVersion = document.getElementById('form-iphone-version') ? document.getElementById('form-iphone-version').value.trim() : '';
    const isOther = document.getElementById('chk-other-device') ? document.getElementById('chk-other-device').checked : false;
    const otherVersion = document.getElementById('form-other-device') ? document.getElementById('form-other-device').value.trim() : '';
    
    let devices = [];
    if (deviceVal) devices.push(deviceVal);
    if (isIpad) devices.push(`iPad ${ipadVersion}`.trim());
    if (isIphone) devices.push(`iPhone ${iphoneVersion}`.trim());
    if (isOther) devices.push(`${otherVersion}`.trim());
    const finalDeviceStr = devices.join(' / ');

    const testCaseVal = document.getElementById('form-test-case').value.trim();
    const testStepsVal = document.getElementById('form-test-steps') ? document.getElementById('form-test-steps').value.trim() : '';
    const stepsVal = document.getElementById('form-steps').value.trim();
    const riskVal = document.getElementById('form-risk').value;
    const passRateVal = document.getElementById('form-pass-rate').value;
    const statusVal = document.getElementById('form-status').value;
    const notesVal = document.getElementById('form-notes').value.trim();
    
    let statusText = statusVal;
    if (statusVal === 'Pass') statusText = '驗證通過';
    if (statusVal === 'Fail') statusText = '驗證失敗';
    if (statusVal === 'BLOCKED') statusText = '阻礙中';

    const categoryEl = document.querySelector('input[name="report_category"]:checked');
    const category = categoryEl ? categoryEl.value : '其他';
    let template = category === '其他' ? `【測試紀錄】` : `【測試紀錄-${category}】`;
    
    if (caseNoVal) template += `\n案件編號：${caseNoVal}`;
    if (projectNameVal) template += `\n專案名稱：${projectNameVal}`;
    if (formattedDate) template += `\n測試日期：${formattedDate}`;
    if (testerVal) template += `\n測試人員：${testerVal}`;
    if (devVal) template += `\n工程人員：${devVal}`;
    if (parentTicketVal) template += `\n母單：${parentTicketVal}`;
    if (subTicketVal) template += `\n子單：${subTicketVal}`;

    if (versionVal) {
        let displayVersion = versionVal.includes('\n') ? '\n' + versionVal : versionVal;
        template += `\n軟體版本：${displayVersion}`;
    }

    if (envVal) {
        let displayEnv = envVal.includes('\n') ? '\n' + envVal : envVal;
        template += `\n測試環境：${displayEnv}`;
    }

    if (finalDeviceStr) template += `\n測試裝置：${finalDeviceStr}`;

    if (testCaseVal) template += `\n測試案例：${testCaseVal}`;
    if (testStepsVal) template += `\n測試步驟：\n${testStepsVal}`;
    if (stepsVal) template += `\n工單說明：\n${stepsVal}`;
    if (riskVal) template += `\n風險評估：${riskVal}`;
    if (passRateVal) template += `\n通過率(%)：${passRateVal}`;
    if (notesVal) template += `\n備註：${notesVal}`;
    if (statusText) template += `\n處理狀態：${statusText}`;

    const cleanedTemplate = template.replace(/\n\n/g, '\n');
    document.getElementById('generated-result').value = cleanedTemplate;
}

function copyGeneratedResult() {
    const resultText = document.getElementById('generated-result');
    resultText.select();
    document.execCommand('copy');
    window.getSelection().removeAllRanges();
    showToast('已複製到剪貼簿！');
}

function updateEnvButtons() {
    const el = document.getElementById('form-env');
    if (!el) return;
    const currentVal = el.value.trim();
    const lines = currentVal ? currentVal.split('\n').map(l => l.trim()).filter(l => l) : [];
    const buttons = document.querySelectorAll('.env-btn');
    buttons.forEach(btn => {
        const envUrl = btn.getAttribute('data-env');
        if (lines.includes(envUrl)) {
            btn.classList.replace('bg-gray-100', 'bg-blue-100');
            btn.classList.replace('hover:bg-gray-200', 'hover:bg-blue-200');
            btn.classList.replace('text-gray-700', 'text-blue-800');
            btn.classList.replace('border-gray-200', 'border-blue-400');
            btn.classList.add('font-bold');
        } else {
            btn.classList.replace('bg-blue-100', 'bg-gray-100');
            btn.classList.replace('hover:bg-blue-200', 'hover:bg-gray-200');
            btn.classList.replace('text-blue-800', 'text-gray-700');
            btn.classList.replace('border-blue-400', 'border-gray-200');
            btn.classList.remove('font-bold');
        }
    });
}

function setEnv(url) {
    userEditedFields.add('form-env');
    const el = document.getElementById('form-env');
    let currentVal = el.value.trim();
    if (currentVal) {
        let lines = currentVal.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.includes(url)) {
            // 如果已存在，則移除它 (點第二次取消)
            lines = lines.filter(l => l !== url);
        } else {
            // 如果不存在，則加入它
            lines.push(url);
        }
        el.value = lines.join('\n');
    } else {
        el.value = url;
    }
    if (typeof parseGrafanaVersion === 'function') parseGrafanaVersion();
    updateEnvButtons();
    if (typeof updateGeneratedResult === 'function') updateGeneratedResult();
}

function setTestCase(val) {
    userEditedFields.add('form-test-case');
    document.getElementById('form-test-case').value = val;
    if (typeof updateGeneratedResult === 'function') updateGeneratedResult();
}

function clearTcPresets() {
    const radios = document.getElementsByName('tc-preset');
    radios.forEach(r => r.checked = false);
}

function setTicketNotes(val) {
    userEditedFields.add('form-steps');
    document.getElementById('form-steps').value = val;
    if (typeof updateGeneratedResult === 'function') updateGeneratedResult();
}

function clearTicketNotesPresets() {
    const radios = document.getElementsByName('ticket-notes-preset');
    radios.forEach(r => r.checked = false);
}

function setNotes(val) {
    document.getElementById('form-notes').value = val;
    if (typeof updateGeneratedResult === 'function') updateGeneratedResult();
}

function clearNotesPresets() {
    const radios = document.getElementsByName('notes-preset');
    radios.forEach(r => r.checked = false);
}

// ================= Browser Version Detection =================
async function getBrowserVersion() {
    let browserName = "Browser";
    let version = "";
    const ua = navigator.userAgent;
    let is64 = ua.includes("Win64") || ua.includes("x64") || ua.includes("Mac OS") ? " (64 位元)" : "";

    try {
        // 使用現代 Client Hints API 獲取完整精確版號 (破解 Chrome User-Agent 隱藏次要版號的問題)
        if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
            const hints = await navigator.userAgentData.getHighEntropyValues(['fullVersionList', 'bitness']);
            
            if (hints.bitness === "64") {
                is64 = " (64 位元)";
            }
            
            if (hints.fullVersionList && hints.fullVersionList.length > 0) {
                // 優先找 Edge 或 Chrome
                const targetBrand = hints.fullVersionList.find(b => b.brand.includes("Edge") || b.brand.includes("Google Chrome"));
                if (targetBrand) {
                    if (targetBrand.brand.includes("Edge")) browserName = "Edge";
                    else if (targetBrand.brand.includes("Chrome")) browserName = "Chrome";
                    version = targetBrand.version;
                }
            }
        }
    } catch (e) {
        console.error("Client Hints API 失敗，退回傳統 UA:", e);
    }
    
    // 如果 API 拿不到 (例如不支援的瀏覽器)，退回傳統解析方式
    if (!version) {
        if (ua.includes("Edg/")) {
            browserName = "Edge";
            version = ua.match(/Edg\/([\d.]+)/)[1];
        } else if (ua.includes("Chrome/")) {
            browserName = "Chrome";
            version = ua.match(/Chrome\/([\d.]+)/)[1];
        } else if (ua.includes("Firefox/")) {
            browserName = "Firefox";
            version = ua.match(/Firefox\/([\d.]+)/)[1];
        } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
            browserName = "Safari";
            version = ua.match(/Version\/([\d.]+)/)[1];
        }
    }
    
    document.getElementById('form-device').value = `${browserName} 版本：${version}${is64}`;
    updateGeneratedResult();
    showToast('已帶入本機瀏覽器完整版號！');
}

// ================= Charts =================

function renderCharts(dailyData, statusData) {
    // 準備 Daily Chart Data
    const dates = dailyData.map(d => d.test_date).reverse();
    const counts = dailyData.map(d => d.count).reverse();

    if (dailyChartInstance) dailyChartInstance.destroy();
    const ctxDaily = document.getElementById('dailyChart').getContext('2d');
    dailyChartInstance = new Chart(ctxDaily, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: '測試報告數量',
                data: counts,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });

    // 準備 Status Chart Data
    const labels = statusData.map(d => d.status);
    const dataVals = statusData.map(d => d.count);
    const colors = labels.map(l => {
        if (l === 'Pass') return '#10b981';
        if (l === 'Fail') return '#ef4444';
        if (l === 'Blocked') return '#f59e0b';
        return '#6b7280';
    });

    if (statusChartInstance) statusChartInstance.destroy();
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    statusChartInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataVals,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Utility to prevent XSS
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined || unsafe === '') return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// ================= Trash / Recycle Bin Logic =================

function openTrashModal() {
    document.getElementById('trash-modal').classList.remove('hidden');
    fetchTrashReports();
}

function closeTrashModal() {
    document.getElementById('trash-modal').classList.add('hidden');
}

async function fetchTrashReports() {
    const token = localStorage.getItem('qa_session_token');
    const tbody = document.getElementById('trash-table-body');
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">載入中...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE}/api/reports/trash?token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error('無法載入垃圾桶');
        const data = await res.json();
        
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">垃圾桶目前是空的</td></tr>';
            return;
        }
        
        const currentUser = localStorage.getItem('qa_display_name');
        const currentUserRole = localStorage.getItem('qa_role') || 'user';
        
        data.forEach(report => {
            const tr = document.createElement('tr');
            const canModify = (currentUserRole === 'admin') || (report.tester_name.split(' - ')[0] === currentUser);
            
            let actionsHtml = '';
            if (canModify) {
                actionsHtml = `
                    <button onclick="restoreReport(${report.id})" class="text-secondary hover:text-green-700 font-bold transition">復原 ↩️</button>
                    <button onclick="purgeReport(${report.id})" class="text-red-500 hover:text-red-700 font-bold transition">永久刪除 ❌</button>
                `;
            } else {
                actionsHtml = `
                    <span class="text-gray-400 text-xs italic">無更動權限</span>
                `;
            }
            
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(report.case_no || '-')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${getCategoryTagHtml(report.category)}
                    ${escapeHtml(report.project_name)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(report.tester_name)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">${getTypeTagHtml(report.case_no)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-3 align-middle">
                    ${actionsHtml}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">載入垃圾桶失敗</td></tr>';
    }
}

async function restoreReport(id) {
    try {
        const res = await fetch(`${API_BASE}/api/reports/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, token: localStorage.getItem('qa_session_token') })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '復原失敗');
        
        showToast('測試報告已成功復原！');
        fetchTrashReports(); // 刷新垃圾桶
        fetchReports(); // 刷新主畫面表格
        loadDashboard(); // 刷新儀表板
        loadWorkspace(); // 刷新個人工作台
    } catch (err) {
        console.error(err);
        showToast(err.message, true);
    }
}

async function purgeReport(id) {
    if (!confirm('警告：確定要永久刪除此報告嗎？此動作將從資料庫徹底移除，無法復原。')) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/reports/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, token: localStorage.getItem('qa_session_token') })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '永久刪除失敗');
        
        showToast('報告已永久刪除。');
        fetchTrashReports(); // 刷新垃圾桶
    } catch (err) {
        console.error(err);
        showToast(err.message, true);
    }
}

// ================= Users Management Logic (Admin Only) =================

async function fetchUsers() {
    const token = localStorage.getItem('qa_session_token');
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">載入中...</td></tr>';
    
    try {
        const res = await fetch(`${API_BASE}/api/users?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || '無法載入使用者列表');
        }
        const data = await res.json();
        
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">尚無任何使用者</td></tr>';
            return;
        }
        
        data.forEach(user => {
            const tr = document.createElement('tr');
            
            const isActiveText = user.is_active === 1 ? '🟢 已啟用' : '🔴 已關閉';
            const buttonText = user.is_active === 1 ? '關閉 🔒' : '啟用 🔓';
            const buttonClass = user.is_active === 1 
                ? 'text-red-600 hover:text-red-800 font-semibold' 
                : 'text-secondary hover:text-green-700 font-semibold';
            
            const currentUser = localStorage.getItem('qa_display_name');
            // 若為自己，則不顯示關閉按鈕（安全措施）
            const isSelf = user.username === '20200715' || user.display_name === currentUser;
            
            const statusAction = isSelf 
                ? '<span class="text-gray-400 text-xs italic mr-3">無法停用</span>' 
                : `<button onclick="toggleUserActive(${user.id}, ${user.is_active})" class="${buttonClass} transition mr-3">${buttonText}</button>`;
                
            const resetAction = `<button onclick="resetUserPassword(${user.id}, '${escapeHtml(user.display_name)}')" class="text-primary hover:text-blue-700 font-semibold transition">重設密碼 🔑</button>`;

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(user.username)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(user.display_name)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}">
                        ${user.role}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(user.created_at || '-')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold">${isActiveText}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${statusAction}
                    ${resetAction}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">${escapeHtml(err.message)}</td></tr>`;
    }
}

async function toggleUserActive(userId, currentStatus) {
    const token = localStorage.getItem('qa_session_token');
    const nextStatus = currentStatus === 1 ? 0 : 1;
    const confirmMsg = nextStatus === 1 
        ? '確定要「啟用」此測試員帳號嗎？啟用後該帳號即可登入系統。' 
        : '確定要「關閉」此測試員帳號嗎？關閉後該帳號將無法登入系統並被強制登出。';
        
    if (!confirm(confirmMsg)) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/users/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userId, is_active: nextStatus })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '操作失敗');
        
        showToast('測試員狀態已成功變更！');
        fetchUsers(); // 刷新使用者列表
    } catch (err) {
        console.error(err);
        showToast(err.message, true);
    }
}

async function resetUserPassword(userId, displayName) {
    const newPassword = prompt(`請輸入測試員「${displayName}」的新密碼：`);
    if (newPassword === null) return; // 點擊取消
    if (newPassword.trim() === '') {
        showToast('新密碼不能為空！', true);
        return;
    }
    
    const token = localStorage.getItem('qa_session_token');
    
    try {
        const res = await fetch(`${API_BASE}/api/users/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, userId, newPassword })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '重設密碼失敗');
        
        showToast(`測試員「${displayName}」的密碼已重設成功！`);
    } catch (err) {
        console.error(err);
        showToast(err.message, true);
    }
}

// ================= Pin Logic =================
async function togglePin(id, currentPinned) {
    const token = localStorage.getItem('qa_session_token');
    const newPinned = currentPinned === 1 ? 0 : 1;
    try {
        const res = await fetch(`${API_BASE}/api/reports/pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_pinned: newPinned, token })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || '釘選失敗', true);
            return;
        }
        
        // 重新載入列表 (根據目前在哪個畫面)
        const workspaceView = document.getElementById('view-workspace');
        if (workspaceView && !workspaceView.classList.contains('hidden')) {
            loadWorkspace();
        } else {
            fetchReports();
        }
    } catch (err) {
        console.error(err);
        showToast('釘選失敗', true);
    }
}

// ================= View Report Modal Logic =================
function viewReportDetails(id) {
    const report = currentReportsList.find(r => r.id === id);
    if (!report) {
        showToast('找不到此報告資料', true);
        return;
    }
    
    document.getElementById('view-modal-title').textContent = `查看測試報告：${report.case_no || ''}`;
    document.getElementById('view-raw-ticket').value = report.raw_ticket || '未提供原始工單';
    document.getElementById('view-generated-notes').value = report.notes || '無測試紀錄內容';
    
    document.getElementById('view-report-modal').classList.remove('hidden');
}

function closeViewReportModal() {
    document.getElementById('view-report-modal').classList.add('hidden');
}

function copyViewReportNotes() {
    const textarea = document.getElementById('view-generated-notes');
    textarea.select();
    try {
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
        showToast('已複製報告內容！');
    } catch (err) {
        showToast('複製失敗，請手動複製', true);
    }
}

function copyTicketTemplate() {
    const template = `【測試項目】\n測試日期：\n工程人員：\n軟體版本：\n測試環境：\n測試母單：\n測試子單：\n工單內容：`;
    
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = template;
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    
    try {
        document.execCommand('copy');
        showToast('已複製工單範本！');
    } catch (err) {
        showToast('複製失敗', true);
    } finally {
        document.body.removeChild(tempTextarea);
    }
}


function renderWorkspaceTable() {
    renderWorkspaceAdminModifiedTable();
    
    const tbody = document.getElementById('ws-recent-reports-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let filteredData = currentReportsList || [];
    
    const startInput = document.getElementById('ws-filter-date-start');
    const endInput = document.getElementById('ws-filter-date-end');
    const start = startInput ? startInput.value : '';
    const end = endInput ? endInput.value : '';
    
    if (start || end) {
        filteredData = filteredData.filter(r => {
            if (!r.test_date) return false;
            if (start && r.test_date < start) return false;
            if (end && r.test_date > end) return false;
            return true;
        });
    }
    
    const typeVal = document.getElementById('ws-filter-type') ? document.getElementById('ws-filter-type').value : 'all';
    if (typeVal === 'P') filteredData = filteredData.filter(r => r.case_no && r.case_no.startsWith('P'));
    if (typeVal === 'T') filteredData = filteredData.filter(r => r.case_no && r.case_no.startsWith('T'));
    
    const catVal = document.getElementById('ws-filter-category') ? document.getElementById('ws-filter-category').value : 'all';
    if (catVal !== 'all') filteredData = filteredData.filter(r => r.category === catVal);

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">尚無測試紀錄</td></tr>';
        document.getElementById('ws-pagination').innerHTML = '';
        return;
    }

    const startIndex = (wsCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    const currentUser = localStorage.getItem('qa_display_name');
    const currentUserRole = localStorage.getItem('qa_role') || 'user';

    paginatedData.forEach(report => {
        const tr = document.createElement('tr');
        
        const canModify = (currentUserRole === 'admin') || (report.tester_name.split(' - ')[0] === currentUser);
        
        let actionButtonsHtml = `<button onclick="copyReportNotes(${report.id})" class="text-secondary hover:text-green-700 font-bold transition">複製</button>`;
        if (canModify) {
            actionButtonsHtml += `
                <button onclick="editReport(${report.id})" class="text-primary hover:text-blue-700 font-bold transition">修改</button>
                <button onclick="deleteReport(${report.id})" class="text-red-500 hover:text-red-700 font-bold transition">刪除</button>
            `;
        }

        const isPinned = report.is_pinned === 1;
        const starColor = isPinned ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 hover:text-yellow-400';
        const starSvg = `<svg class="w-5 h-5 cursor-pointer inline-block mr-1 align-text-bottom ${starColor}" onclick="togglePin(${report.id}, ${report.is_pinned || 0})" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`;

            let displayTester = escapeHtml(report.tester_name);
            if (displayTester.includes('-更')) {
                displayTester = displayTester.replace(/ - (.*?)-更/g, ' <span class="text-red-500 font-bold">-$1-更</span>');
            }

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${starSvg}<span class="cursor-pointer text-blue-600 hover:underline font-medium" onclick="viewReportDetails(${report.id})">${escapeHtml(report.case_no || '-')}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${getCategoryTagHtml(report.category)}
                ${escapeHtml(report.project_name)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">${getTypeTagHtml(report.case_no)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge status-${report.status}">${report.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-3">
                ${actionButtonsHtml}
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    const emptyRowsCount = ITEMS_PER_PAGE - paginatedData.length;
    for (let i = 0; i < emptyRowsCount; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
        `;
        tbody.appendChild(tr);
    }
    
    renderPagination('ws-pagination', filteredData.length, ITEMS_PER_PAGE, wsCurrentPage, 'changeWsPage');
}

function renderWorkspaceAdminModifiedTable() {
    const container = document.getElementById('ws-admin-modified-container');
    const tbody = document.getElementById('ws-admin-modified-body');
    if (!container || !tbody) return;

    const currentUserRole = localStorage.getItem('qa_role') || 'user';
    if (currentUserRole !== 'admin') {
        container.classList.add('hidden');
        return;
    }

    const currentUser = localStorage.getItem('qa_display_name') || '';
    const adminModifiedData = (currentReportsList || []).filter(r => r.tester_name && r.tester_name.includes(`- ${currentUser}-更`));

    if (adminModifiedData.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    tbody.innerHTML = '';

    adminModifiedData.forEach(report => {
        const tr = document.createElement('tr');
        
        let displayTester = escapeHtml(report.tester_name);
        displayTester = displayTester.replace(/ - (.*?)-更/g, ' <span class="text-red-500 font-bold">-$1-更</span>');
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span class="cursor-pointer text-blue-600 hover:underline font-medium" onclick="viewReportDetails(${report.id})">${escapeHtml(report.case_no || '-')}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${getCategoryTagHtml(report.category)}
                ${escapeHtml(report.project_name)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${displayTester}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-3">
                <button onclick="editReport(${report.id})" class="text-primary hover:text-blue-700 font-bold transition">修改</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderReportsTable() {
    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let filteredData = currentReportsList || [];
    
    const typeVal = document.getElementById('filter-type') ? document.getElementById('filter-type').value : 'all';
    if (typeVal === 'P') filteredData = filteredData.filter(r => r.case_no && r.case_no.startsWith('P'));
    if (typeVal === 'T') filteredData = filteredData.filter(r => r.case_no && r.case_no.startsWith('T'));
    
    const catVal = document.getElementById('filter-category') ? document.getElementById('filter-category').value : 'all';
    if (catVal !== 'all') filteredData = filteredData.filter(r => r.category === catVal);
    
    const testerVal = document.getElementById('filter-tester') ? document.getElementById('filter-tester').value : 'all';
    if (testerVal !== 'all') {
        filteredData = filteredData.filter(r => {
            let baseName = r.tester_name;
            if (baseName && baseName.includes(' - ')) baseName = baseName.split(' - ')[0];
            return baseName === testerVal;
        });
    }
    
    // search input
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
        const query = searchInput.value.toLowerCase();
        filteredData = filteredData.filter(r => {
            return (r.case_no && r.case_no.toLowerCase().includes(query)) ||
                   (r.project_name && r.project_name.toLowerCase().includes(query)) ||
                   (r.tester_name && r.tester_name.toLowerCase().includes(query));
        });
    }

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">找不到測試報告</td></tr>';
        document.getElementById('reports-pagination').innerHTML = '';
        return;
    }

    const startIndex = (reportsCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    const currentUserRole = localStorage.getItem('qa_role') || 'user';
    const adminCols = document.querySelectorAll('.admin-only');
    adminCols.forEach(col => {
        if (currentUserRole === 'admin') col.classList.remove('hidden');
        else col.classList.add('hidden');
    });

    paginatedData.forEach(report => {
        const tr = document.createElement('tr');
        const isPinned = report.is_pinned === 1;
        const starColor = isPinned ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 hover:text-yellow-400';
        const starSvg = `<svg class="w-5 h-5 cursor-pointer inline-block mr-1 align-text-bottom ${starColor}" onclick="togglePin(${report.id}, ${report.is_pinned || 0})" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`;

        let displayTester = escapeHtml(report.tester_name);
        if (displayTester.includes('-更')) {
            displayTester = displayTester.replace(/ - (.*?)-更/g, ' <span class="text-red-500 font-bold">-$1-更</span>');
        }

        let actionHtml = '';
        if (currentUserRole === 'admin') {
            actionHtml = `
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium admin-only">
                    <button onclick="editReport(${report.id})" class="text-indigo-600 hover:text-indigo-900 mr-3 transition">修改</button>
                    <button onclick="deleteReport(${report.id})" class="text-red-600 hover:text-red-900 transition">刪除</button>
                </td>
            `;
        } else {
            actionHtml = `
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium admin-only hidden">
                </td>
            `;
        }

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${starSvg}<span class="cursor-pointer text-blue-600 hover:underline font-medium" onclick="viewReportDetails(${report.id})">${escapeHtml(report.case_no || '-')}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${getCategoryTagHtml(report.category)}
                ${escapeHtml(report.project_name)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayTester}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">${getTypeTagHtml(report.case_no)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge status-${report.status}">${report.status}</span>
            </td>
            ${actionHtml}
        `;
        tbody.appendChild(tr);
    });
    
    const emptyRowsCountReports = ITEMS_PER_PAGE - paginatedData.length;
    for (let i = 0; i < emptyRowsCountReports; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none">-</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-transparent pointer-events-none select-none admin-only ${currentUserRole !== 'admin' ? 'hidden' : ''}">-</td>
        `;
        tbody.appendChild(tr);
    }
    
    renderPagination('reports-pagination', filteredData.length, ITEMS_PER_PAGE, reportsCurrentPage, 'changeReportsPage');
}

function changeWsPage(page) {
    wsCurrentPage = page;
    renderWorkspaceTable();
}

function changeReportsPage(page) {
    reportsCurrentPage = page;
    renderReportsTable();
}

function renderPagination(containerId, totalItems, itemsPerPage, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (totalItems <= itemsPerPage) {
        container.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    let html = `<div class="flex items-center justify-between px-4 py-3 bg-white sm:px-6 mt-4">
        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
                <p class="text-sm text-gray-500">
                    顯示第 <span class="font-medium text-gray-900">${(currentPage - 1) * itemsPerPage + 1}</span> 
                    到 <span class="font-medium text-gray-900">${Math.min(currentPage * itemsPerPage, totalItems)}</span> 筆，
                    共 <span class="font-medium text-gray-900">${totalItems}</span> 筆
                </p>
            </div>
            <div>
                <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">`;

    if (currentPage > 1) {
        html += `<a href="#" onclick="event.preventDefault(); ${onPageChange}(${currentPage - 1})" class="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">上一頁</a>`;
    } else {
        html += `<span class="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-200 bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed">上一頁</span>`;
    }

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += `<a href="#" onclick="event.preventDefault(); ${onPageChange}(1)" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</a>`;
        if (startPage > 2) html += `<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<span class="relative inline-flex items-center px-4 py-2 border border-blue-500 bg-blue-50 text-sm font-bold text-blue-600">${i}</span>`;
        } else {
            html += `<a href="#" onclick="event.preventDefault(); ${onPageChange}(${i})" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">${i}</a>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>`;
        html += `<a href="#" onclick="event.preventDefault(); ${onPageChange}(${totalPages})" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">${totalPages}</a>`;
    }

    if (currentPage < totalPages) {
        html += `<a href="#" onclick="event.preventDefault(); ${onPageChange}(${currentPage + 1})" class="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">下一頁</a>`;
    } else {
        html += `<span class="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-200 bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed">下一頁</span>`;
    }

    html += `           </nav>
            </div>
        </div>
    </div>`;
    
    container.innerHTML = html;
}

function copyTicketTemplate() {
    const template = `【測試項目】\n測試日期：\n工程人員：\n軟體版本：\n測試環境：\n測試母單：\n測試子單：\n工單內容：`;
    
    navigator.clipboard.writeText(template).then(() => {
        showToast('已複製工單範本');
    }).catch(err => {
        console.error('複製失敗:', err);
        showToast('複製失敗', true);
    });
}


// Dropdown Logic for Tester Stats
function toggleTesterDropdown(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const menu = document.getElementById('tester-dropdown-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const btn = document.getElementById('tester-dropdown-btn');
    const menu = document.getElementById('tester-dropdown-menu');
    if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add('hidden');
    }
});


function filterWorkspaceReports() {
    wsCurrentPage = 1;
    renderWorkspaceTable();
}

function changeWorkspaceCalendarMonth(delta) {
    wsCurrentMonth += delta;
    if (wsCurrentMonth > 12) {
        wsCurrentMonth = 1;
        wsCurrentYear++;
    } else if (wsCurrentMonth < 1) {
        wsCurrentMonth = 12;
        wsCurrentYear--;
    }
    renderWorkspaceCalendar(currentReportsList, wsCurrentYear, wsCurrentMonth);
}

function renderWorkspaceCalendar(reports, year, month) {
    const title = document.getElementById('ws-calendar-title');
    const grid = document.getElementById('ws-calendar-grid');
    if (!title || !grid) return;
    
    title.textContent = `${year} 年 ${month} 月 測試狀況`;
    
    // Group reports by date string (YYYY-MM-DD)
    const counts = {};
    reports.forEach(r => {
        if (!r.test_date) return;
        counts[r.test_date] = (counts[r.test_date] || 0) + 1;
    });

    // Calendar logic
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const twToday = getTaiwanToday();
    const startInput = document.getElementById('ws-filter-date-start');
    const endInput = document.getElementById('ws-filter-date-end');
    const start = startInput ? startInput.value : twToday;
    const end = endInput ? endInput.value : twToday;

    let html = '';
    
    // Empty cells before 1st
    for (let i = 0; i < firstDay; i++) {
        html += `<div class="h-16 rounded bg-gray-50 border border-gray-100 opacity-50"></div>`;
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const count = counts[dateStr] || 0;
        
        const isToday = dateStr === twToday;
        // Only show blue ring if the exact single day is selected on both start and end
        const isSelected = (dateStr === start && dateStr === end);
        
        let cellClass = "h-16 rounded border flex flex-col items-center justify-center cursor-pointer transition ";
        if (isSelected) {
            cellClass += "bg-blue-50 border-blue-400 ring-1 ring-blue-400";
        } else if (isToday) {
            cellClass += "bg-yellow-50 border-yellow-300 hover:bg-yellow-100";
        } else {
            cellClass += "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-300";
        }
        
        let countHtml = count > 0 ? `<span class="text-xs font-bold bg-primary text-white px-2 py-0.5 rounded-full mt-1">${count} 件</span>` : '<span class="text-xs text-transparent mt-1">-</span>';
        
        html += `
            <div class="${cellClass}" onclick="document.getElementById('ws-filter-date-start').value='${dateStr}'; document.getElementById('ws-filter-date-end').value='${dateStr}'; filterWorkspaceReports(); renderWorkspaceCalendar(currentReportsList, ${year}, ${month});">
                <span class="text-sm font-semibold ${isToday ? 'text-primary' : 'text-gray-700'}">${d}</span>
                ${countHtml}
            </div>
        `;
    }
    
    grid.innerHTML = html;
}
