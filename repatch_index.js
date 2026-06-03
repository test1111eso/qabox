const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Add Dropdown for Tester Stats
const tableContainerStr = `<div class="overflow-hidden rounded-lg border border-gray-100">
                    <table class="min-w-full divide-y divide-gray-200">`;

const testerDropdownStr = `
                <div class="mb-5 relative inline-block text-left z-10 w-full sm:w-auto">
                    <button type="button" onclick="toggleTesterDropdown(event)" id="tester-dropdown-btn" class="inline-flex justify-between items-center w-full sm:w-auto rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                        選擇測試員 (已勾選 <span id="tester-selected-count" class="mx-1 text-primary font-bold">0</span> 人)
                        <svg class="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>

                    <div id="tester-dropdown-menu" class="hidden origin-top-left absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100">
                        <div class="py-1 px-2 max-h-60 overflow-y-auto flex flex-col gap-1" id="tester-checkbox-group">
                            <!-- Data populated by JS -->
                        </div>
                    </div>
                </div>

                <div class="overflow-hidden rounded-lg border border-gray-100">
                    <table class="min-w-full divide-y divide-gray-200">`;

html = html.replace(tableContainerStr, testerDropdownStr);

// 2. Replace the Workspace Stats and Top Dashboard layout
const wsRegex = /<!-- Workspace Stats -->[\s\S]*?<!-- Workspace Recent Reports -->\s*<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">\s*<div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">\s*<div class="flex items-center gap-3">\s*<h3 class="text-lg font-bold text-gray-900">最近測試紀錄<\/h3>\s*<button onclick="switchView\('reports'\)" class="text-sm text-primary hover:text-blue-700 font-medium whitespace-nowrap">查看全部 &rarr;<\/button>\s*<\/div>/;

const newWsLayout = `<!-- Workspace Top Dashboard -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <!-- Workspace Calendar (Left Side) -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            <span id="ws-calendar-title">本月測試狀況</span>
                        </h3>
                        <div class="flex gap-2">
                            <button onclick="changeWorkspaceCalendarMonth(-1)" class="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-primary transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                            <button onclick="changeWorkspaceCalendarMonth(1)" class="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-primary transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="grid grid-cols-7 gap-2 mb-2">
                            <div class="text-center text-xs font-bold text-gray-400">日</div>
                            <div class="text-center text-xs font-bold text-gray-400">一</div>
                            <div class="text-center text-xs font-bold text-gray-400">二</div>
                            <div class="text-center text-xs font-bold text-gray-400">三</div>
                            <div class="text-center text-xs font-bold text-gray-400">四</div>
                            <div class="text-center text-xs font-bold text-gray-400">五</div>
                            <div class="text-center text-xs font-bold text-gray-400">六</div>
                        </div>
                        <div id="ws-calendar-grid" class="grid grid-cols-7 gap-2">
                            <!-- Calendar days populated by JS -->
                        </div>
                    </div>
                </div>

                <!-- Workspace Stats (Right Side) -->
                <div class="flex flex-col gap-6 justify-between">
                    <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm p-6 border border-blue-200">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-sm font-bold text-blue-800 mb-1">今日新增報告</h3>
                                <p class="text-4xl font-black text-blue-600" id="ws-stat-today">0</p>
                            </div>
                            <div class="p-3 bg-white rounded-full text-blue-500 shadow-sm">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                        </div>
                    </div>
                    <div class="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl shadow-sm p-6 border border-indigo-200">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-sm font-bold text-indigo-800 mb-1">本月累計測試</h3>
                                <p class="text-4xl font-black text-indigo-600" id="ws-stat-month">0</p>
                            </div>
                            <div class="p-3 bg-white rounded-full text-indigo-500 shadow-sm">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            </div>
                        </div>
                    </div>
                    <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm p-6 border border-red-200">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-sm font-bold text-red-800 mb-1">累計阻礙 / 失敗</h3>
                                <p class="text-4xl font-black text-red-600" id="ws-stat-fail">0</p>
                            </div>
                            <div class="p-3 bg-white rounded-full text-red-500 shadow-sm">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Workspace Recent Reports -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <h3 class="text-lg font-bold text-gray-900">最近測試紀錄</h3>
                        <input type="date" id="ws-filter-date-start" onchange="filterWorkspaceReports()" class="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-primary focus:border-primary">
                        <span class="text-gray-400">-</span>
                        <input type="date" id="ws-filter-date-end" onchange="filterWorkspaceReports()" class="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-primary focus:border-primary">
                    </div>
                    <button onclick="switchView('reports')" class="text-sm text-primary hover:text-blue-700 font-medium whitespace-nowrap">查看全部 &rarr;</button>
                </div>`;

const originalHtml = html;
// Note: Since index.html on origin/main doesn't have the flex flex-col sm:flex-row things on Recent Reports,
// I must match the actual content from origin/main. Let me adjust the regex.

const simplerWsRegex = /<!-- Workspace Stats -->[\s\S]*?<!-- Workspace Recent Reports -->\s*<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">\s*<div class="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">\s*<h3 class="text-lg font-bold text-gray-900">最近測試紀錄<\/h3>\s*<button onclick="switchView\('reports'\)" class="text-sm text-primary hover:text-blue-700 font-medium">查看全部 &rarr;<\/button>\s*<\/div>/;

html = html.replace(simplerWsRegex, newWsLayout);

if (html === originalHtml) {
    console.log("Failed to match Workspace Stats layout!");
} else {
    fs.writeFileSync('index.html', html);
    console.log('Successfully repatched index.html without template string bugs.');
}
