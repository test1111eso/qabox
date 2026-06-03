const fs = require('fs');
let code = fs.readFileSync('worker/src/index.js', 'utf8');

code = code.replace(/datetime\(''now'', ''\+8 hours''\)/g, "datetime('now', '+8 hours')");

fs.writeFileSync('worker/src/index.js', code);
console.log('Worker syntax fixed successfully.');
