const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// Fix the accidental insertion around line 3216
code = code.replace(/const manualBlock = document.getElementById\('ua-publish-manual'\);\s*if \(manualBlock\) manualBlock.classList.remove\('hidden'\);\s*const isSelf = user.username === '20200715'/g, "const isSelf = user.username === '20200715'");

// Fix openUaPublishModal manualBlock missing
const searchStr = `        const items = (data.payload || []);\r
        if (items.length === 0) {\r
            document.getElementById('ua-publish-empty').classList.remove('hidden');\r
            return;\r
        }\r
\r
        renderUaWorkItems(items);\r
        document.getElementById('ua-work-items-list').classList.remove('hidden');`;

const searchStr2 = searchStr.replace(/\r/g, ''); // Try LF as well

const replaceStr = `        const items = (data.payload || []);
        const manualBlock = document.getElementById('ua-publish-manual');
        if (items.length === 0) {
            document.getElementById('ua-publish-empty').classList.remove('hidden');
            if (manualBlock) manualBlock.classList.remove('hidden');
            return;
        }

        renderUaWorkItems(items);
        document.getElementById('ua-work-items-list').classList.remove('hidden');
        if (manualBlock) manualBlock.classList.remove('hidden');`;

if (code.includes(searchStr)) {
  code = code.replace(searchStr, replaceStr);
} else if (code.includes(searchStr2)) {
  code = code.replace(searchStr2, replaceStr);
} else {
  console.log("Could not find the target string to replace in openUaPublishModal.");
}

fs.writeFileSync('app.js', code);
console.log('Fixed app.js logic!');
