// Cloudflare Worker API URL (請替換為實際部署後的 Worker URL)
// 測試環境可以先使用 http://127.0.0.1:8787
const API_BASE = 'https://qagame.test1111-tcm-tc.workers.dev';

let dailyChartInstance = null;
let statusChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

// Auth Logic
let isRegisterMode = false;

function checkAuth() {
    const token = localStorage.getItem('qa_session_token');
    const displayName = localStorage.getItem('qa_display_name');
    
    if (token && displayName) {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('nav-user-name').innerText = `哈囉，${displayName}`;
        
        loadDashboard();
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
            if (!regRes.ok) throw new Error(regData.error || '註冊失敗');
        }
        
        const loginRes = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.error || '登入失敗');
        
        localStorage.setItem('qa_session_token', loginData.token);
        localStorage.setItem('qa_display_name', loginData.display_name);
        
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
    checkAuth();
}

// View Navigation
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${viewId}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active', 'text-primary'));
    document.getElementById(`nav-${viewId}`).classList.add('active', 'text-primary');

    if (viewId === 'dashboard') loadDashboard();
    if (viewId === 'reports') fetchReports();
    if (viewId === 'documents') loadDocuments();
}

// Modal Logic
function openModal() {
    document.getElementById('report-modal').classList.remove('hidden');
    // 設定今日日期為預設值
    document.getElementById('form-date').valueAsDate = new Date();
    
    // 載入記住的測試員
    const savedTester = localStorage.getItem('qa_display_name');
    if (savedTester) {
        document.getElementById('form-tester').value = savedTester;
    }
    
    document.getElementById('ticket-input').value = '';
    updateGeneratedResult();
}

function closeModal() {
    document.getElementById('report-modal').classList.add('hidden');
    document.getElementById('report-form').reset();
    document.getElementById('ticket-input').value = '';
}

function clearGeneratorForm() {
    if (confirm('確定要清空所有已輸入的內容嗎？')) {
        document.getElementById('report-form').reset();
        document.getElementById('ticket-input').value = '';
        const grafanaInput = document.getElementById('grafana-input');
        if (grafanaInput) grafanaInput.value = '';
        
        // Restore default values
        document.getElementById('form-date').valueAsDate = new Date();
        document.getElementById('form-test-case').value = '';
        const savedTester = localStorage.getItem('qa_display_name');
        if (savedTester) {
            document.getElementById('form-tester').value = savedTester;
        }
        
        // Reset device checkboxes
        if(document.getElementById('chk-ipad')) document.getElementById('chk-ipad').checked = false;
        if(document.getElementById('chk-iphone')) document.getElementById('chk-iphone').checked = false;

        // Clear presets radio buttons manually
        document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        
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

// ================= API Calls =================

async function loadDashboard() {
    try {
        const res = await fetch(`${API_BASE}/api/stats`);
        if (!res.ok) throw new Error('API 無法連線');
        const data = await res.json();
        
        // Update Summary Cards
        let total = 0;
        let blocked = 0;
        data.statusStats.forEach(s => {
            total += s.count;
            if (s.status === 'Blocked') blocked = s.count;
        });

        const todayDate = new Date().toISOString().split('T')[0];
        const todayStat = data.dailyStats.find(d => d.test_date === todayDate);
        const todayCount = todayStat ? todayStat.count : 0;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-today').textContent = todayCount;
        document.getElementById('stat-blocked').textContent = blocked;

        // Render Charts
        renderCharts(data.dailyStats, data.statusStats);
    } catch (err) {
        console.error(err);
        // showToast('載入儀表板資料失敗', true); // 開發階段暫時關閉錯誤提示以免沒有開 server 時彈出
    }
}

async function fetchReports() {
    const tester = document.getElementById('filter-tester').value;
    const date = document.getElementById('filter-date').value;
    
    let url = `${API_BASE}/api/reports?`;
    if (tester) url += `tester=${encodeURIComponent(tester)}&`;
    if (date) url += `date=${encodeURIComponent(date)}&`;

    try {
        const tbody = document.getElementById('reports-table-body');
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">載入中...</td></tr>';
        
        const res = await fetch(url);
        if (!res.ok) throw new Error('API 無法連線');
        const data = await res.json();
        
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">找不到測試報告</td></tr>';
            return;
        }

        data.forEach(report => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(report.project_name)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(report.tester_name)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${report.test_date}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge status-${report.status}">${report.status}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline">
                    ${report.bug_link ? `<a href="${escapeHtml(report.bug_link)}" target="_blank">查看連結</a>` : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

function clearFilters() {
    document.getElementById('filter-tester').value = '';
    document.getElementById('filter-date').value = '';
    fetchReports();
}

async function submitReport(e) {
    e.preventDefault();
    const form = document.getElementById('report-form');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const payload = {
        project_name: document.getElementById('form-project').value,
        tester_name: document.getElementById('form-tester').value,
        test_date: document.getElementById('form-date').value,
        status: document.getElementById('form-status').value,
        bug_link: document.getElementById('form-test-case').value, // 存在資料庫的 bug_link 欄位
        notes: document.getElementById('generated-result').value,
    };
    
    if (payload.tester_name) {
        localStorage.setItem('qa_tester_name', payload.tester_name);
    }

    const btnText = document.getElementById('submit-text');
    const spinner = document.getElementById('submit-spinner');
    
    btnText.textContent = '處理中...';
    spinner.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/api/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error('新增失敗');
        
        showToast('測試報告已成功新增！');
        closeModal();
        fetchReports(); // Refresh table
        loadDashboard(); // Refresh stats
    } catch (err) {
        console.error(err);
        showToast('新增報告失敗，請檢查 API 連線', true);
    } finally {
        btnText.textContent = '儲存報告';
        spinner.classList.add('hidden');
    }
}

async function loadDocuments() {
    try {
        const grid = document.getElementById('documents-grid');
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">載入中...</div>';
        
        const res = await fetch(`${API_BASE}/api/documents`);
        if (!res.ok) throw new Error('API 無法連線');
        const data = await res.json();
        
        grid.innerHTML = '';
        if (data.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500">目前沒有文件</div>';
            return;
        }

        data.forEach(doc => {
            const div = document.createElement('div');
            div.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition group';
            div.innerHTML = `
                <div class="flex items-start justify-between mb-4">
                    <h3 class="text-lg font-bold text-gray-900 group-hover:text-primary transition">${escapeHtml(doc.title)}</h3>
                    <div class="bg-blue-50 p-2 rounded-lg text-primary">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </div>
                </div>
                <p class="text-sm text-gray-500 mb-4 line-clamp-2">${escapeHtml(doc.description || '無描述')}</p>
                <a href="${escapeHtml(doc.url)}" target="_blank" class="text-sm font-medium text-primary hover:text-blue-700">開啟文件 &rarr;</a>
            `;
            grid.appendChild(div);
        });
    } catch (err) {
        console.error(err);
    }
}

// ================= Generator Logic =================
function initGeneratorLogic() {
    const inputs = ['form-project', 'form-tester', 'form-developer', 'form-date', 'form-parent-ticket', 'form-sub-ticket', 'form-version', 'form-env', 'form-device', 'form-test-case', 'form-test-steps', 'form-steps', 'form-risk', 'form-pass-rate', 'form-status', 'form-notes', 'chk-ipad', 'chk-iphone', 'form-ipad-version', 'form-iphone-version'];
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                parseGrafanaVersion();
                updateGeneratedResult();
            });
        }
    });

    const grafanaInput = document.getElementById('grafana-input');
    if (grafanaInput) {
        grafanaInput.addEventListener('input', () => {
            parseGrafanaVersion();
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
            if (versionMatch) {
                document.getElementById('form-version').value = versionMatch[1].trim();
                updated = true;
            }

            const deviceMatch = text.match(/(?:測試裝置|裝置|設備)\s*[：:]\s*([^\n]+)/);
            if (deviceMatch) {
                document.getElementById('form-device').value = deviceMatch[1].trim();
                updated = true;
            }
            
            const testerMatch = text.match(/(?:測試人員|QA)\s*[：:]\s*([^\n]+)/);
            if (testerMatch) {
                document.getElementById('form-tester').value = testerMatch[1].trim();
                updated = true;
            }

            const devMatch = text.match(/(?:工程人員|RD|開發人員)\s*[：:]\s*([^\n]+)/);
            if (devMatch) {
                document.getElementById('form-developer').value = devMatch[1].trim();
                updated = true;
            }

            const envMatch = text.match(/(?:測試環境|測試網址)\s*[：:]\s*([^\n]+)/);
            if (envMatch) {
                document.getElementById('form-env').value = envMatch[1].trim();
                updated = true;
            }

            const parentMatch = text.match(/母單\s*[：:]\s*([^\n]+)/);
            if (parentMatch) {
                document.getElementById('form-parent-ticket').value = parentMatch[1].trim();
                updated = true;
            }

            const subMatch = text.match(/子單\s*[：:]\s*([^\n]+)/);
            if (subMatch) {
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

                // 判斷是否為標題 (包含 【】 的文字)
                if (line.includes('【') && line.includes('】') && !document.getElementById('form-project').value) {
                    document.getElementById('form-project').value = line;
                    updated = true;
                    continue; // 標題不需要被放進其他說明裡
                }

                // 嘗試抓取 T單號 (通常為母單/任務單)
                const tTaskMatch = line.match(/(T\d+)/);
                if (tTaskMatch && !document.getElementById('form-parent-ticket').value) {
                    document.getElementById('form-parent-ticket').value = tTaskMatch[1];
                    updated = true;
                }

                // 嘗試抓取 #單號 (通常為子單/Bug單/PR)
                const hashTaskMatch = line.match(/(#\d+)/);
                if (hashTaskMatch && !document.getElementById('form-sub-ticket').value) {
                    document.getElementById('form-sub-ticket').value = hashTaskMatch[1];
                    updated = true;
                }

                // 將未配對的剩餘文字全部保留為其他說明
                otherNotes.push(line);
            }

            // 寫入其他說明 (保留所有分段)
            if (otherNotes.length > 0 && !document.getElementById('form-steps').value) {
                document.getElementById('form-steps').value = otherNotes.join('\n');
                updated = true;
            }

            // 抓取網址當作測試案例
            const urlMatch = text.match(/(?:卡片|測試案例|網址|連結|Ticket|URL)\s*[：:]\s*(https?:\/\/[^\s]+)/i) || text.match(/(https?:\/\/[^\s]+)/i);
            if (urlMatch && !document.getElementById('form-test-case').value) {
                document.getElementById('form-test-case').value = urlMatch[1].trim();
                updated = true;
            }

            parseGrafanaVersion();

            if (updated) updateGeneratedResult();
        });
    }
}

function parseGrafanaVersion() {
    const ticketText = document.getElementById('ticket-input')?.value || '';
    const grafanaText = document.getElementById('grafana-input')?.value || '';
    const combinedText = ticketText + '\n' + grafanaText;

    if (!combinedText) return;

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
        const feMatch = combinedText.match(feRegex);
        const beMatch = combinedText.match(beRegex);

        if (feMatch) extractedVersions.push(`前端(${targetEnv.toUpperCase()}): ${feMatch[1]}`);
        if (beMatch) extractedVersions.push(`後端(${targetEnv.toUpperCase()}): ${beMatch[1]}`);
    } else {
        // 如果還沒有指定環境，就把全部 (prod, stg, qa) 都列出來
        const regex = /(Frontend|Backend)\s*-\s*([a-zA-Z]+)[^a-zA-Z0-9]+([a-zA-Z0-9.\-_]+)/gi;
        let match;
        while ((match = regex.exec(combinedText)) !== null) {
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
    
    let devices = [];
    if (deviceVal) devices.push(deviceVal);
    if (isIpad) devices.push(`iPad ${ipadVersion}`.trim());
    if (isIphone) devices.push(`iPhone ${iphoneVersion}`.trim());
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
    if (statusVal === 'Blocked') statusText = '阻礙中';

    let template = `【測試紀錄】`;
    
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

function setEnv(url) {
    const el = document.getElementById('form-env');
    if (el.value) {
        if (!el.value.includes(url)) {
            el.value += '\n' + url;
        }
    } else {
        el.value = url;
    }
    if (typeof parseGrafanaVersion === 'function') parseGrafanaVersion();
    if (typeof updateGeneratedResult === 'function') updateGeneratedResult();
}

function setTestCase(val) {
    document.getElementById('form-test-case').value = val;
    if (typeof updateGeneratedResult === 'function') updateGeneratedResult();
}

function clearTcPresets() {
    const radios = document.getElementsByName('tc-preset');
    radios.forEach(r => r.checked = false);
}

function setTicketNotes(val) {
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
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
