const fs = require('fs');

try {
    let code = fs.readFileSync('app.js', 'utf8');

    // Add vars
    code = code.replace('let userEditedFields = new Set();', 'let userEditedFields = new Set();\nlet wsCurrentPage = 1;\nlet reportsCurrentPage = 1;\nconst ITEMS_PER_PAGE = 20;');

    // Replace loadWorkspace table with render
    const wsStart = `        const tbody = document.getElementById('ws-recent-reports-body');
        tbody.innerHTML = '';
        
        if (data.length === 0) {`;
    const wsEnd = `            tbody.appendChild(tr);
        });
    } catch (err) {`;
    
    const wsBlockStartIdx = code.indexOf(wsStart);
    const wsBlockEndIdx = code.indexOf(wsEnd);
    
    if (wsBlockStartIdx !== -1 && wsBlockEndIdx !== -1) {
        const wsBlock = code.substring(wsBlockStartIdx, wsBlockEndIdx + wsEnd.length);
        code = code.replace(wsBlock, `        wsCurrentPage = 1;
        renderWorkspaceTable();
    } catch (err) {`);
    }

    // Replace fetchReports table with render
    const rpStart = `        currentReportsList = data; // 存入全域變數以供編輯時快速查找
        
        tbody.innerHTML = '';
        if (data.length === 0) {`;
    const rpEnd = `            tbody.appendChild(tr);
        });
    } catch (err) {`;
    
    const rpBlockStartIdx = code.indexOf(rpStart);
    const rpBlockEndIdx = code.indexOf(rpEnd);
    
    if (rpBlockStartIdx !== -1 && rpBlockEndIdx !== -1) {
        const rpBlock = code.substring(rpBlockStartIdx, rpBlockEndIdx + rpEnd.length);
        code = code.replace(rpBlock, `        currentReportsList = data; // 存入全域變數以供編輯時快速查找
        reportsCurrentPage = 1;
        renderReportsTable();
    } catch (err) {`);
    }

    // Replace Collab logic
    const collabStart = `// ================= Collaboration Board Logic =================`;
    const collabEnd = `function toggleCollabTodo(id) {
    const data = getCollabData('todo');
    const item = data.find(i => i.id === id);
    if (item) {
        item.completed = !item.completed;
        saveCollabData('todo', data);
        renderCollabList('todo');
    }
}`;
    
    const collabBlockStartIdx = code.indexOf(collabStart);
    const collabBlockEndIdx = code.indexOf(collabEnd);
    
    if (collabBlockStartIdx !== -1 && collabBlockEndIdx !== -1) {
        const collabBlock = code.substring(collabBlockStartIdx, collabBlockEndIdx + collabEnd.length);

        const newCollab = `// ================= Collaboration Board Logic =================
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

        div.innerHTML = \`\${contentHtml}\${deleteBtnHtml}\`;
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
}`;

        code = code.replace(collabBlock, newCollab);
    }

    // Read append script correctly
    const appendFns = fs.readFileSync('append_fns.js', 'utf8');
    const regex = /const fnsToAppend = `([\s\S]*)`;/;
    const match = appendFns.match(regex);
    if (match) {
        code += "\n" + match[1];
    }

    fs.writeFileSync('app.js', code);
    console.log('Successfully patched app.js!');
} catch (e) {
    console.error(e);
}
