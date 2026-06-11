const fs = require('fs');

let code = fs.readFileSync('app.js', 'utf8');

// 1. Remove the accidentally injected duplicate function
const badStr = `async function openUaPublishModal() {
    document.getElementById('ua-publish-loading').classList.remove('hidden');
    document.getElementById('ua-work-items-list').classList.add('hidden');
    document.getElementById('ua-publish-empty').classList.add('hidden');
    document.getElementById('ua-publish-modal').classList.remove('hidden');

    // 自動帶入表單上的母單或子單
    const subTicketVal = document.getElementById('form-sub-ticket')?.value?.trim();
    const parentTicketVal = document.getElementById('form-parent-ticket')?.value?.trim();
    const manualInput = document.getElementById('ua-manual-id-input');
    const manualKindSelect = document.getElementById('ua-manual-kind-select');
    
    if (manualInput && manualKindSelect) {
        if (subTicketVal) {
            manualInput.value = subTicketVal;
            manualKindSelect.value = '2'; // 子單
            if (typeof handleUaManualInput === 'function') handleUaManualInput();
        } else if (parentTicketVal) {
            manualInput.value = parentTicketVal;
            manualKindSelect.value = '1'; // 母單
            if (typeof handleUaManualInput === 'function') handleUaManualInput();
        } else {
            manualInput.value = '';
        }
    }

    try {
        const res = await fetch(\`http://localhost:7788/ua/work\`, {
            headers: { 'Authorization': \`Bearer \${getUaPat()}\` }
        });
        const data = await res.json();
        renderUaWorkItems(data);
    } catch (e) {
        console.error(e);
        document.getElementById('ua-publish-loading').classList.add('hidden');
        document.getElementById('ua-publish-empty').classList.remove('hidden');
    }
}`;

code = code.replace(badStr, '');

// 2. Inject it into the ACTUAL openUaPublishModal function
const searchStr = `    document.getElementById('ua-publish-loading').classList.remove('hidden');\r
    document.getElementById('ua-work-items-list').classList.add('hidden');\r
    document.getElementById('ua-publish-empty').classList.add('hidden');\r
    document.getElementById('ua-publish-modal').classList.remove('hidden');\r
\r
    try {\r
        const res = await fetch(\`http://localhost:7788/ua/work\`, {\r
            method: 'GET',\r
            headers: {\r
                'Content-Type': 'application/json',\r
                'X-UA-Token': pat,\r
            }\r
        });`;

const searchStr2 = searchStr.replace(/\\r/g, '');

const replaceStr = `    document.getElementById('ua-publish-loading').classList.remove('hidden');
    document.getElementById('ua-work-items-list').classList.add('hidden');
    document.getElementById('ua-publish-empty').classList.add('hidden');
    document.getElementById('ua-publish-modal').classList.remove('hidden');

    // 自動帶入表單上的母單或子單
    const subTicketVal = document.getElementById('form-sub-ticket')?.value?.trim();
    const parentTicketVal = document.getElementById('form-parent-ticket')?.value?.trim();
    const manualInput = document.getElementById('ua-manual-id-input');
    const manualKindSelect = document.getElementById('ua-manual-kind-select');
    
    if (manualInput && manualKindSelect) {
        let matchStr = '';
        if (subTicketVal) {
            matchStr = subTicketVal.replace(/[^0-9]/g, '');
            manualInput.value = matchStr;
            manualKindSelect.value = '2'; // 子單
            if (matchStr && typeof handleUaManualInput === 'function') handleUaManualInput();
        } else if (parentTicketVal) {
            matchStr = parentTicketVal.replace(/[^0-9]/g, '');
            manualInput.value = matchStr;
            manualKindSelect.value = '1'; // 母單
            if (matchStr && typeof handleUaManualInput === 'function') handleUaManualInput();
        } else {
            manualInput.value = '';
        }
    }

    try {
        const res = await fetch(\`http://localhost:7788/ua/work\`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-UA-Token': pat,
            }
        });`;

if (code.includes(searchStr)) {
  code = code.replace(searchStr, replaceStr);
} else if (code.includes(searchStr2)) {
  code = code.replace(searchStr2, replaceStr);
} else {
  console.log("Could not find the target string to replace in openUaPublishModal.");
}

fs.writeFileSync('app.js', code);
console.log('Fixed app.js logic!');
