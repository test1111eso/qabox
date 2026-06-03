const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');
lines.forEach((line, index) => {
    if (line.includes('Workspace Stats') || line.includes('Workspace Recent Reports') || line.includes('最近測試紀錄')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
