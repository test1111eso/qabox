const fs = require('fs');

let code = fs.readFileSync('app.js', 'utf8');

// 1. Pagination functions to append
const paginationFns = `
function renderWorkspaceTable() {
    const tbody = document.getElementById('ws-recent-reports-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!currentReportsList || currentReportsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500">尚無測試紀錄</td></tr>';
        document.getElementById('ws-pagination').innerHTML = '';
        return;
    }

    const startIndex = (wsCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = currentReportsList.slice(startIndex, endIndex);

    const currentUser = localStorage.getItem('qa_display_name');
    const currentUserRole = localStorage.getItem('qa_role') || 'user';

    paginatedData.forEach(report => {
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
    
    renderPagination('ws-pagination', currentReportsList.length, ITEMS_PER_PAGE, wsCurrentPage, 'changeWsPage');
}

function renderReportsTable() {
    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!currentReportsList || currentReportsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">找不到測試報告</td></tr>';
        document.getElementById('reports-pagination').innerHTML = '';
        return;
    }

    const startIndex = (reportsCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedData = currentReportsList.slice(startIndex, endIndex);

    paginatedData.forEach(report => {
        const tr = document.createElement('tr');
        const isPinned = report.is_pinned === 1;
        const starColor = isPinned ? 'text-yellow-400 hover:text-yellow-500' : 'text-gray-300 hover:text-yellow-400';
        const starSvg = \`<svg class="w-5 h-5 cursor-pointer inline-block mr-1 align-text-bottom \${starColor}" onclick="togglePin(\${report.id}, \${report.is_pinned || 0})" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>\`;

        tr.innerHTML = \`
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${starSvg}<span class="cursor-pointer text-blue-600 hover:underline font-medium" onclick="viewReportDetails(\${report.id})">\${escapeHtml(report.case_no || '-')}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                \${getCategoryTagHtml(report.category)}
                \${escapeHtml(report.project_name)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${escapeHtml(report.tester_name)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">\${getTypeTagHtml(report.case_no)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge status-\${report.status}">\${report.status}</span>
            </td>
        \`;
        tbody.appendChild(tr);
    });
    
    renderPagination('reports-pagination', currentReportsList.length, ITEMS_PER_PAGE, reportsCurrentPage, 'changeReportsPage');
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
    let html = \`<div class="flex items-center justify-between px-4 py-3 bg-white sm:px-6 mt-4">
        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
                <p class="text-sm text-gray-500">
                    顯示第 <span class="font-medium text-gray-900">\${(currentPage - 1) * itemsPerPage + 1}</span> 
                    到 <span class="font-medium text-gray-900">\${Math.min(currentPage * itemsPerPage, totalItems)}</span> 筆，
                    共 <span class="font-medium text-gray-900">\${totalItems}</span> 筆
                </p>
            </div>
            <div>
                <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">\`;

    if (currentPage > 1) {
        html += \`<a href="#" onclick="event.preventDefault(); \${onPageChange}(\${currentPage - 1})" class="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">上一頁</a>\`;
    } else {
        html += \`<span class="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-200 bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed">上一頁</span>\`;
    }

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        html += \`<a href="#" onclick="event.preventDefault(); \${onPageChange}(1)" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">1</a>\`;
        if (startPage > 2) html += \`<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>\`;
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += \`<span class="relative inline-flex items-center px-4 py-2 border border-blue-500 bg-blue-50 text-sm font-bold text-blue-600">\${i}</span>\`;
        } else {
            html += \`<a href="#" onclick="event.preventDefault(); \${onPageChange}(\${i})" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">\${i}</a>\`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += \`<span class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>\`;
        html += \`<a href="#" onclick="event.preventDefault(); \${onPageChange}(\${totalPages})" class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">\${totalPages}</a>\`;
    }

    if (currentPage < totalPages) {
        html += \`<a href="#" onclick="event.preventDefault(); \${onPageChange}(\${currentPage + 1})" class="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">下一頁</a>\`;
    } else {
        html += \`<span class="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-200 bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed">下一頁</span>\`;
    }

    html += \`           </nav>
            </div>
        </div>
    </div>\`;
    
    container.innerHTML = html;
}
`;

if (!code.includes('function renderWorkspaceTable()')) {
    code = code + '\\n' + paginationFns;
}

// 2. Fix loadWorkspace
const wsRegex = /const tbody = document\.getElementById\('ws-recent-reports-body'\);\s*tbody\.innerHTML = '';[\s\S]*?tbody\.appendChild\(tr\);\s*\n\s*\}\);/;
code = code.replace(wsRegex, 'wsCurrentPage = 1;\n        renderWorkspaceTable();');

// 3. Fix fetchReports
const rpRegex = /currentReportsList = data; \/\/ 存入全域變數以供編輯時快速查找\s*\n\s*tbody\.innerHTML = '';[\s\S]*?tbody\.appendChild\(tr\);\s*\n\s*\}\);/;
code = code.replace(rpRegex, 'currentReportsList = data; // 存入全域變數以供編輯時快速查找\n        reportsCurrentPage = 1;\n        renderReportsTable();');

// 4. Update Collaboration Board
const collabRegex = /\/\/ ================= Collaboration Board Logic =================[\s\S]*?function toggleCollabTodo\(id\) \{[\s\S]*?\n\}/;
const newCollab = \`// ================= Collaboration Board Logic =================
function loadCollaborationBoard() {
    fetchBulletins();
    renderCollabList('todo');
}

async function fetchBulletins() {
    try {
        const res = await fetch(\`\${API_BASE}/api/collab/bulletins\`);
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
        
        const contentHtml = \`
            <div class="flex-1">
                <div class="flex justify-between items-baseline mb-1">
                    <span class="text-xs font-bold text-gray-700">\${escapeHtml(item.author)}</span>
                    <span class="text-[10px] text-gray-400">\${timestampStr}</span>
                </div>
                <p class="text-sm text-gray-800 break-all whitespace-pre-wrap">\${escapeHtml(item.content)}</p>
            </div>
        \`;

        const canDelete = currentUserRole === 'admin' || item.author === currentUser;
        const deleteBtnHtml = canDelete ? \`
            <button onclick="deleteCollabItem('bulletin', '\${item.id}')" class="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        \` : '';

        div.innerHTML = \`
            \${contentHtml}
            \${deleteBtnHtml}
        \`;
        listEl.appendChild(div);
    });
}

function getCollabData(type) {
    const data = localStorage.getItem(\`qa_\${type}s\`);
    return data ? JSON.parse(data) : [];
}

function saveCollabData(type, data) {
    localStorage.setItem(\`qa_\${type}s\`, JSON.stringify(data));
}

function renderCollabList(type) {
    if (type === 'bulletin') {
        fetchBulletins();
        return;
    }
    
    const listEl = document.getElementById(\`collab-\${type}-list\`);
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
        div.className = \`bg-white p-3 rounded shadow-sm border border-gray-100 relative group flex gap-3 items-start transition \${item.completed ? 'opacity-60 bg-gray-50' : ''}\`;
        
        const timestampStr = new Date(item.timestamp).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const checkedAttr = item.completed ? 'checked' : '';
        const textClass = item.completed ? 'line-through text-gray-400' : 'text-gray-800';
        const contentHtml = \`
            <input type="checkbox" \${checkedAttr} onchange="toggleCollabTodo('\${item.id}')" class="mt-1 h-4 w-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500 cursor-pointer">
            <div class="flex-1">
                <p class="text-sm font-medium \${textClass} break-all">\${escapeHtml(item.text)}</p>
                <p class="text-[10px] text-gray-400 mt-1">\${escapeHtml(item.author)} · \${timestampStr}</p>
            </div>
        \`;

        div.innerHTML = \`
            \${contentHtml}
            <button onclick="deleteCollabItem('\${type}', '\${item.id}')" class="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        \`;
        listEl.appendChild(div);
    });
}

async function addCollabItem(type) {
    const inputEl = document.getElementById(\`collab-\${type}-input\`);
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
            const res = await fetch(\`\${API_BASE}/api/collab/bulletins\`, {
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
            const res = await fetch(\`\${API_BASE}/api/collab/bulletins/\${id}\`, {
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
}\`;

code = code.replace(collabRegex, newCollab);

fs.writeFileSync('app.js', code);
console.log('Successfully updated app.js!');
