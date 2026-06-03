const fs = require('fs');

let code = fs.readFileSync('app.js', 'utf8');

// 1. Update loadWorkspace setup
code = code.replace(
    /const filterDateInput = document\.getElementById\('ws-filter-date'\);\s*if \(filterDateInput && !filterDateInput\.value\) \{\s*filterDateInput\.value = twToday;\s*\}/,
    `const startInput = document.getElementById('ws-filter-date-start');
        const endInput = document.getElementById('ws-filter-date-end');
        if (startInput && !startInput.value) startInput.value = twToday;
        if (endInput && !endInput.value) endInput.value = twToday;`
);

// 2. Update filterWorkspaceReports
const oldFilter = /function filterWorkspaceReports\(\) \{[\s\S]*?\}\s*function changeWorkspaceCalendarMonth/;
const newFilter = `function filterWorkspaceReports() {
    const startInput = document.getElementById('ws-filter-date-start');
    const endInput = document.getElementById('ws-filter-date-end');
    if (!startInput || !endInput) return;
    
    const start = startInput.value;
    const end = endInput.value;
    
    if (!start && !end) {
        renderWorkspaceTableRows(currentReportsList.slice(0, 20));
        return;
    }
    
    const filtered = currentReportsList.filter(r => {
        if (!r.test_date) return false;
        if (start && r.test_date < start) return false;
        if (end && r.test_date > end) return false;
        return true;
    });
    
    renderWorkspaceTableRows(filtered);
}

function changeWorkspaceCalendarMonth`;
code = code.replace(oldFilter, newFilter);

// 3. Update renderWorkspaceCalendar
// Replace getting filter date
code = code.replace(
    /const filterDate = document\.getElementById\('ws-filter-date'\) \? document\.getElementById\('ws-filter-date'\)\.value : twToday;/,
    `const startInput = document.getElementById('ws-filter-date-start');
    const endInput = document.getElementById('ws-filter-date-end');
    const start = startInput ? startInput.value : twToday;
    const end = endInput ? endInput.value : twToday;`
);

// Replace isSelected logic
code = code.replace(
    /const isSelected = dateStr === filterDate;/,
    `// Only show blue ring if the exact single day is selected on both start and end
        const isSelected = (dateStr === start && dateStr === end);`
);

// Replace onclick in calendar cells
code = code.replace(
    /onclick="document\.getElementById\('ws-filter-date'\)\.value='\$\{dateStr\}';/g,
    `onclick="document.getElementById('ws-filter-date-start').value='\${dateStr}'; document.getElementById('ws-filter-date-end').value='\${dateStr}';`
);

fs.writeFileSync('app.js', code);
console.log('Successfully patched app.js for date range.');
