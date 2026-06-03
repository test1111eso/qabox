const fs = require('fs');
const lines = fs.readFileSync('worker/src/index.js', 'utf8').split('\n');
lines.forEach((line, index) => {
    if (line.includes('/api/documents')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
