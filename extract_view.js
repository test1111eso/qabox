const fs = require('fs');
const lines = fs.readFileSync('app.js', 'utf8').split('\n');
let capturing = false;
lines.forEach((line, index) => {
    if (line.includes('function viewReportDetails(')) {
        capturing = true;
    }
    if (capturing) {
        console.log(`Line ${index + 1}: ${line}`);
        if (line.startsWith('}')) capturing = false;
    }
});
