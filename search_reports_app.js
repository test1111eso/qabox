const fs = require('fs');
const lines = fs.readFileSync('app.js', 'utf8').split('\n');
lines.forEach((line, index) => {
    if (line.includes('function loadReports') || line.includes('function editReport') || line.includes('function togglePin')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
