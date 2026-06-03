const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. We want to extract the three stats cards and the calendar, and combine them into a 2-col grid.

const statsRegex = /<!-- Workspace Stats -->\s*<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">([\s\S]*?)<\/div>\s*<!-- Workspace Calendar -->/;
const calendarRegex = /<!-- Workspace Calendar -->\s*<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">([\s\S]*?)<\/div>\s*<!-- Workspace Recent Reports -->/;

let matchStats = html.match(statsRegex);
let matchCal = html.match(calendarRegex);

if (matchStats && matchCal) {
    const statsCards = matchStats[1];
    const calendarContent = matchCal[1];

    const newLayout = `<!-- Workspace Top Dashboard -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <!-- Workspace Calendar (Left Side) -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    \${calendarContent}
                </div>

                <!-- Workspace Stats (Right Side) -->
                <div class="flex flex-col gap-6 justify-between">
                    \${statsCards}
                </div>
            </div>

            <!-- Workspace Recent Reports -->`;
            
    // Replace both sections with the new combined layout
    html = html.replace(/<!-- Workspace Stats -->[\s\S]*<!-- Workspace Calendar -->[\s\S]*?<\/div>\s*<!-- Workspace Recent Reports -->/, newLayout);
} else {
    console.log("Could not match the exact structure for layout.");
}

// 2. Change the recent reports date filter to a range
const filterRegex = /<input type="date" id="ws-filter-date" onchange="filterWorkspaceReports\(\)" class="([^"]*)">/;
if (filterRegex.test(html)) {
    const classNames = html.match(filterRegex)[1];
    const rangeHtml = `<input type="date" id="ws-filter-date-start" onchange="filterWorkspaceReports()" class="\${classNames}">
                        <span class="text-gray-400">-</span>
                        <input type="date" id="ws-filter-date-end" onchange="filterWorkspaceReports()" class="\${classNames}">`;
    html = html.replace(filterRegex, rangeHtml);
} else {
    console.log("Could not find ws-filter-date input.");
}

fs.writeFileSync('index.html', html);
console.log('Successfully patched index.html layout.');
