const fs = require('fs');
let code = fs.readFileSync('worker/src/index.js', 'utf8');

// 1. Remove /api/documents block safely
const lines = code.split(/\r?\n/);
code = lines.filter((line, i) => i < 94 || i > 100).join('\n');

// 2. Patch INSERT INTO users
code = code.replace(
    "'INSERT INTO users (username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, ?)'",
    "'INSERT INTO users (username, password_hash, display_name, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, datetime(''now'', ''+8 hours''))'"
);

// 3. Patch INSERT INTO sessions
code = code.replace(
    "'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'",
    "'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, datetime(''now'', ''+8 hours''))'"
);

// 4. Patch INSERT INTO reports
code = code.replace(
    "'INSERT INTO reports (case_no, project_name, tester_name, test_date, status, bug_link, notes, category, raw_ticket) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'",
    "'INSERT INTO reports (case_no, project_name, tester_name, test_date, status, bug_link, notes, category, raw_ticket, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(''now'', ''+8 hours''))'"
);

// 5. Patch INSERT INTO bulletins
code = code.replace(
    "'INSERT INTO bulletins (content, author) VALUES (?, ?)'",
    "'INSERT INTO bulletins (content, author, created_at) VALUES (?, ?, datetime(''now'', ''+8 hours''))'"
);

fs.writeFileSync('worker/src/index.js', code);
console.log('Worker repatched successfully.');
