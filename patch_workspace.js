const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// The new functions to add at the top (global variables)
if (!code.includes('let wsCurrentYear =')) {
    code = code.replace('let currentReportsList = [];', 'let currentReportsList = [];\nlet wsCurrentYear = new Date().getFullYear();\nlet wsCurrentMonth = new Date().getMonth() + 1;');
}

// Extract the table row generation into a new function and add the calendar logic
const newLogic = `
function renderWorkspaceTableRows(reports) {
    const tbody = document.getElementById('ws-recent-reports-body');
    tbody.innerHTML = '';
    
    if (!reports || reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">此日期無測試紀錄</td></tr>';
        return;
    }

    const currentUser = localStorage.getItem('qa_display_name');
    const currentUserRole = localStorage.getItem('qa_role') || 'user';

    reports.forEach(report => {
        const tr = document.createElement('tr');
        
        const canModify = (currentUserRole === 'admin') || (report.tester_name === currentUser);
        
        let actionButtonsHtml = \`<button onclick="copyReportNotes(\${report.id})" class="text-secondary hover:text-green-700 font-bold transition">複製</button>\`;
        if (canModify) {
            actionButtonsHtml += \`
                <button onclick="editReport(\${report.id})" class="text-primary hover:text-blue-700 font-bold transition">修改</button>
                <button onclick="deleteReport(\${report.id})" class="text-red-500 hover:text-red-700 font-bold transition">刪除</button>
            \`;
        }

        const isPinned = report.is_pinned === 1;
        const starColor = isPinned ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 hover:text-yellow-400';
        const starSvg = \`<svg class="w-5 h-5 cursor-pointer inline-block mr-1 align-text-bottom \${starColor}" onclick="togglePin(\${report.id}, \${report.is_pinned || 0})" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>\`;

        tr.innerHTML = \`
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${starSvg}<span class="cursor-pointer text-blue-600 hover:underline font-medium" onclick="viewReportDetails(\${report.id})">\${escapeHtml(report.case_no || '-')}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                \${getCategoryTagHtml(report.category)}
                \${escapeHtml(report.project_name)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">\${getTypeTagHtml(report.case_no)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge status-\${report.status}">\${report.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-3">
                \${actionButtonsHtml}
            </td>
        \`;
        tbody.appendChild(tr);
    });
}

function filterWorkspaceReports() {
    const filterInput = document.getElementById('ws-filter-date');
    if (!filterInput) return;
    const filterDate = filterInput.value;
    
    if (!filterDate) {
        // If empty date, show all but limited to 20 maybe? Or just don't allow empty
        renderWorkspaceTableRows(currentReportsList.slice(0, 20));
        return;
    }
    
    const filtered = currentReportsList.filter(r => r.test_date === filterDate);
    renderWorkspaceTableRows(filtered);
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
    
    title.textContent = \`\${year} 年 \${month} 月 測試狀況\`;
    
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
    const filterDate = document.getElementById('ws-filter-date') ? document.getElementById('ws-filter-date').value : twToday;

    let html = '';
    
    // Empty cells before 1st
    for (let i = 0; i < firstDay; i++) {
        html += \`<div class="h-16 rounded bg-gray-50 border border-gray-100 opacity-50"></div>\`;
    }
    
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = \`\${year}-\${month.toString().padStart(2, '0')}-\${d.toString().padStart(2, '0')}\`;
        const count = counts[dateStr] || 0;
        
        const isToday = dateStr === twToday;
        const isSelected = dateStr === filterDate;
        
        let cellClass = "h-16 rounded border flex flex-col items-center justify-center cursor-pointer transition ";
        if (isSelected) {
            cellClass += "bg-blue-50 border-blue-400 ring-1 ring-blue-400";
        } else if (isToday) {
            cellClass += "bg-yellow-50 border-yellow-300 hover:bg-yellow-100";
        } else {
            cellClass += "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-300";
        }
        
        let countHtml = count > 0 ? \`<span class="text-xs font-bold bg-primary text-white px-2 py-0.5 rounded-full mt-1">\${count} 件</span>\` : '<span class="text-xs text-transparent mt-1">-</span>';
        
        html += \`
            <div class="\${cellClass}" onclick="document.getElementById('ws-filter-date').value='\${dateStr}'; filterWorkspaceReports(); renderWorkspaceCalendar(currentReportsList, \${year}, \${month});">
                <span class="text-sm font-semibold \${isToday ? 'text-primary' : 'text-gray-700'}">\${d}</span>
                \${countHtml}
            </div>
        \`;
    }
    
    grid.innerHTML = html;
}
`;

if (!code.includes('renderWorkspaceCalendar')) {
    code += '\n' + newLogic;
}

// Replace the bottom half of loadWorkspace() starting from `const tbody = document.getElementById('ws-recent-reports-body');`
const replaceTarget = /const tbody = document.getElementById\('ws-recent-reports-body'\);[\s\S]*?tbody\.appendChild\(tr\);\n\s*\}\);\n/m;

const replacement = `
        const filterDateInput = document.getElementById('ws-filter-date');
        if (filterDateInput && !filterDateInput.value) {
            filterDateInput.value = twToday;
        }
        
        renderWorkspaceCalendar(data, wsCurrentYear, wsCurrentMonth);
        filterWorkspaceReports();
`;

code = code.replace(replaceTarget, replacement);
fs.writeFileSync('app.js', code);
console.log('Successfully patched app.js for Workspace Calendar.');
