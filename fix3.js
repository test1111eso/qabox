const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Find all indices of 'async function openUaPublishModal()'
const regex = /async function openUaPublishModal\(\) \{[\s\S]*?catch \(e?r?r?\) \{[\s\S]*?\}\n\}/g;
let matches;
let indices = [];
while ((matches = regex.exec(code)) !== null) {
  indices.push({ start: matches.index, length: matches[0].length, text: matches[0] });
}

console.log('Found ' + indices.length + ' instances of openUaPublishModal');

if (indices.length > 0) {
  const correctImpl = `async function openUaPublishModal() {
    const pat = getUaPat();
    if (!pat) {
        showToast('請先設定 UA 個人資訊鑰匙（點選導覽列齒輪圖示）', true);
        openUaSettingsModal();
        return;
    }

    // 確保 modal 在 body 最外層
    const pubModal = document.getElementById('ua-publish-modal');
    if (pubModal && pubModal.parentElement !== document.body) {
        document.body.appendChild(pubModal);
    }

    uaSelectedTarget = null;
    const confirmBtn = document.getElementById('ua-publish-confirm-btn');
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.5';
    confirmBtn.style.cursor = 'not-allowed';

    document.getElementById('ua-publish-loading').classList.remove('hidden');
    document.getElementById('ua-work-items-list').classList.add('hidden');
    document.getElementById('ua-publish-empty').classList.add('hidden');
    document.getElementById('ua-publish-modal').classList.remove('hidden');

    // ====== 自動帶入母單或子單 ======
    let subTicketVal = '';
    let parentTicketVal = '';
    
    // 優先從目前預覽的報告內容中抓取
    const reportContent = document.getElementById('view-generated-notes')?.value || '';
    const subMatch = reportContent.match(/(?:測試子單|子單)[^\\S\\r\\n]*[：:][^\\S\\r\\n]*([^\\n]+)/i);
    const parentMatch = reportContent.match(/(?:測試母單|母單)[^\\S\\r\\n]*[：:][^\\S\\r\\n]*([^\\n]+)/i);
    if (subMatch) subTicketVal = subMatch[1].trim();
    if (parentMatch) parentTicketVal = parentMatch[1].trim();

    // 如果沒有，再從左側表單抓取 (Fallback)
    if (!subTicketVal) subTicketVal = document.getElementById('form-sub-ticket')?.value?.trim();
    if (!parentTicketVal) parentTicketVal = document.getElementById('form-parent-ticket')?.value?.trim();

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
    // ==================================

    try {
        const res = await fetch(\`http://localhost:7788/ua/work\`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-UA-Token': pat,
            }
        });
        const data = await res.json();

        document.getElementById('ua-publish-loading').classList.add('hidden');

        if (!res.ok) {
            showToast(data.error || 'UA API 錯誤', true);
            closeUaPublishModal();
            return;
        }

        const items = (data.payload || []);
        const manualBlock = document.getElementById('ua-publish-manual');
        if (items.length === 0) {
            document.getElementById('ua-publish-empty').classList.remove('hidden');
            if (manualBlock) manualBlock.classList.remove('hidden');
            return;
        }

        renderUaWorkItems(items);
        document.getElementById('ua-work-items-list').classList.remove('hidden');
        if (manualBlock) manualBlock.classList.remove('hidden');
    } catch (err) {
        document.getElementById('ua-publish-loading').classList.add('hidden');
        showToast('無法載入待辦工單：' + err.message, true);
        closeUaPublishModal();
    }
}`;

  // Remove all instances from last to first to keep indices valid
  for (let i = indices.length - 1; i >= 0; i--) {
    const start = indices[i].start;
    const end = start + indices[i].length;
    code = code.substring(0, start) + (i === indices.length - 1 ? correctImpl : '') + code.substring(end);
  }

  fs.writeFileSync('app.js', code);
  console.log('Successfully replaced with bulletproof logic.');
}
