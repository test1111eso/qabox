const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Unhide admin-only columns if admin
const adminHeaderLogic = `
        const currentUser = localStorage.getItem('qa_display_name');
        const currentUserRole = localStorage.getItem('qa_role') || 'user';
        
        // Show/hide admin columns
        const adminCols = document.querySelectorAll('.admin-only');
        adminCols.forEach(col => {
            if (currentUserRole === 'admin') col.classList.remove('hidden');
            else col.classList.add('hidden');
        });
`;
code = code.replace(
    "const currentUser = localStorage.getItem('qa_display_name');\r\n        const currentUserRole = localStorage.getItem('qa_role') || 'user';",
    adminHeaderLogic
);
code = code.replace(
    "const currentUser = localStorage.getItem('qa_display_name');\n        const currentUserRole = localStorage.getItem('qa_role') || 'user';",
    adminHeaderLogic
);

// Modify tr.innerHTML block
const originalTr = `
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
`;

const newTr = `
            let displayTester = escapeHtml(report.tester_name);
            if (displayTester.includes('-更')) {
                displayTester = displayTester.replace(/ - (.*?)-更/g, ' <span class="text-red-500 font-bold">-$1-更</span>');
            }

            let actionHtml = '';
            if (currentUserRole === 'admin') {
                actionHtml = \`
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="editReport(\${report.id})" class="text-indigo-600 hover:text-indigo-900 mr-3 transition">修改</button>
                        <button onclick="deleteReport(\${report.id})" class="text-red-600 hover:text-red-900 transition">刪除</button>
                    </td>
                \`;
            }

            tr.innerHTML = \`
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${starSvg}<span class="cursor-pointer text-blue-600 hover:underline font-medium" onclick="viewReportDetails(\${report.id})">\${escapeHtml(report.case_no || '-')}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    \${getCategoryTagHtml(report.category)}
                    \${escapeHtml(report.project_name)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\${displayTester}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">\${getTypeTagHtml(report.case_no)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="status-badge status-\${report.status}">\${report.status}</span>
                </td>
                \${actionHtml}
            \`;
            tbody.appendChild(tr);
`;
code = code.replace(originalTr, newTr);

fs.writeFileSync('app.js', code);
console.log('app.js patched for fetchReports.');
