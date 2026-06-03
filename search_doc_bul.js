const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');
lines.forEach((line, index) => {
    if (line.includes('documents') || line.includes('bulletins') || line.includes('布告欄') || line.includes('協作中心')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
