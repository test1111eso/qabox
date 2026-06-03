const fs = require('fs');
const lines = fs.readFileSync('app.js', 'utf8').split('\n');
let found = false;
lines.forEach((line, index) => {
    if (line.includes('api/documents')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        found = true;
    }
});
if (!found) console.log("Not found.");
