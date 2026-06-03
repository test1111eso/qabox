const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

code = code.replace(/\r\n/g, '\n');

if (!code.includes('let currentTesterStats = [];')) {
    code = code.replace('let reportsCurrentPage = 1;\n', 'let reportsCurrentPage = 1;\nlet currentTesterStats = [];\n');
}

const oldLoad = `        // Render Charts
        renderCharts(data.dailyStats, data.statusStats);

        // Render Tester Stats
        renderTesterStats(data.testerStats || []);
    } catch (err) {`;

const newLoad = `        // Render Charts
        renderCharts(data.dailyStats, data.statusStats);

        // Render Tester Stats
        currentTesterStats = data.testerStats || [];
        renderTesterCheckboxes(currentTesterStats);
        renderTesterStats();
    } catch (err) {`;

code = code.replace(oldLoad, newLoad);

const oldStats = `function renderTesterStats(testerStats) {
    const tbody = document.getElementById('tester-stats-body');
    if (!tbody) return;

    if (!testerStats || testerStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">目前無資料</td></tr>';
        return;
    }

    const currentUser = localStorage.getItem('qa_display_name') || '';

    // 先排序：自己優先，其次依本月件數降冪，再依今日件數降冪
    const sorted = [...testerStats].sort((a, b) => {
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
            ? \`<span class="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded ml-2 align-middle">我</span>\`
            : '';

        return \`
            <tr class="\${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm \${nameClass}">
                    \${escapeHtml(t.tester_name)}\${selfBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold \${t.today_count > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">
                        \${t.today_count || 0}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold \${t.month_count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}">
                        \${t.month_count || 0}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-700">
                    \${t.total_count || 0}
                </td>
            </tr>
        \`;
    }).join('');
}`;

const newStats = `function renderTesterCheckboxes(testerStats) {
    const group = document.getElementById('tester-checkbox-group');
    if (!group) return;
    
    let html = '';
    testerStats.forEach(t => {
        // 如果 API 沒有回傳 is_active，我們預設為 1；若回傳 0 則代表停用
        const isActive = t.is_active !== 0;
        const checked = isActive ? 'checked' : '';
        
        // 已離職打個標記，文字顏色淡一點
        const labelClass = isActive ? 'text-gray-700' : 'text-gray-400 line-through';
        const tag = isActive ? '' : '<span class="text-[10px] bg-gray-200 text-gray-500 px-1 rounded ml-1">離職</span>';
        
        html += \`
            <label class="inline-flex items-center cursor-pointer bg-gray-50 border border-gray-200 rounded-md px-3 py-1.5 hover:bg-blue-50 transition">
                <input type="checkbox" class="tester-filter-chk w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary" 
                       value="\${escapeHtml(t.tester_name)}" \${checked} onchange="renderTesterStats()">
                <span class="ml-2 text-sm font-medium \${labelClass}">\${escapeHtml(t.tester_name)}\${tag}</span>
            </label>
        \`;
    });
    group.innerHTML = html;
}

function renderTesterStats() {
    const tbody = document.getElementById('tester-stats-body');
    if (!tbody) return;

    if (!currentTesterStats || currentTesterStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">目前無資料</td></tr>';
        return;
    }
    
    // 取得有勾選的測試員
    const checkedNodes = document.querySelectorAll('.tester-filter-chk:checked');
    const checkedTesters = Array.from(checkedNodes).map(cb => cb.value);

    // 過濾資料
    const filteredStats = currentTesterStats.filter(t => checkedTesters.includes(t.tester_name));

    if (filteredStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">請勾選要顯示的測試員</td></tr>';
        return;
    }

    const currentUser = localStorage.getItem('qa_display_name') || '';

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
            ? \`<span class="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded ml-2 align-middle">我</span>\`
            : '';

        return \`
            <tr class="\${rowClass}">
                <td class="px-6 py-4 whitespace-nowrap text-sm \${nameClass}">
                    \${escapeHtml(t.tester_name)}\${selfBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold \${t.today_count > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">
                        \${t.today_count || 0}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold \${t.month_count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}">
                        \${t.month_count || 0}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center font-semibold text-gray-700">
                    \${t.total_count || 0}
                </td>
            </tr>
        \`;
    }).join('');
}`;

if (code.includes(oldStats)) {
    code = code.replace(oldStats, newStats);
    fs.writeFileSync('app.js', code);
    console.log('Successfully patched app.js!');
} else {
    console.log('Failed to find oldStats block!');
    console.log("IndexOf load:", code.indexOf(oldLoad));
    console.log("IndexOf stats:", code.indexOf(oldStats));
}
