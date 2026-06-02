const fs = require('fs');
const lines = fs.readFileSync('app.js', 'utf8').split(/\r?\n/);
const newCollabLines = fs.readFileSync('new_collab.js', 'utf8').split(/\r?\n/);

const startIdx = 959; // line 960 is index 959
const endIdx = 1075; // line 1076 is index 1075

const newLines = [
    ...lines.slice(0, startIdx),
    ...newCollabLines,
    ...lines.slice(endIdx + 1)
];

fs.writeFileSync('app.js', newLines.join('\n'));
console.log('patched successfully!');
