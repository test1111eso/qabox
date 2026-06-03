const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');
lines.forEach((line, index) => {
    if (line.includes('測試員')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
