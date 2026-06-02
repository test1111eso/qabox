
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
        const starSvg = `<svg class="w-5 h-5 cursor-pointer inline-block mr-1 align-text-bottom ${starColor}" onclick="togglePin(${report.id}, ${report.is_pinned || 0})" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`;

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${starSvg}<span class="cursor-pointer text-blue-600 hover:underline font-medium" onclick="viewReportDetails(${report.id})">${escapeHtml(report.case_no || '-')}</span></td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                ${getCategoryTagHtml(report.category)}
                ${escapeHtml(report.project_name)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${escapeHtml(report.tester_name)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-center">${getTypeTagHtml(report.case_no)}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="status-badge status-${report.status}">${report.status}</span>
            </td>
        `;
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
