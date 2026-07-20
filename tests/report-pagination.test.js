const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeClassList() {
    const values = new Set();
    return {
        add: (...names) => names.forEach(name => values.add(name)),
        remove: (...names) => names.forEach(name => values.delete(name)),
        contains: name => values.has(name),
        replace: (oldName, newName) => {
            values.delete(oldName);
            values.add(newName);
        },
        toggle: (name, force) => {
            if (force === true) {
                values.add(name);
                return true;
            }
            if (force === false) {
                values.delete(name);
                return false;
            }
            if (values.has(name)) {
                values.delete(name);
                return false;
            }
            values.add(name);
            return true;
        }
    };
}

function makeElement(id = '') {
    return {
        id,
        value: '',
        innerHTML: '',
        textContent: '',
        children: [],
        style: {},
        dataset: {},
        parentElement: null,
        classList: makeClassList(),
        appendChild(child) {
            child.parentElement = this;
            this.children.push(child);
        },
        removeChild(child) {
            this.children = this.children.filter(item => item !== child);
        },
        addEventListener() {},
        focus() {},
        select() {},
        getBoundingClientRect() {
            return { left: 0, bottom: 0 };
        }
    };
}

function createSandbox() {
    const elements = new Map();
    const document = {
        body: makeElement('body'),
        addEventListener() {},
        createElement: tag => makeElement(tag),
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, makeElement(id));
            return elements.get(id);
        },
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
        },
        getElementsByName() {
            return [];
        }
    };

    return {
        console,
        document,
        window: {
            location: { href: 'http://localhost/index.html', pathname: '/index.html' },
            innerWidth: 1024,
            getSelection: () => ({ removeAllRanges() {} })
        },
        localStorage: {
            getItem(key) {
                if (key === 'qa_role') return 'admin';
                if (key === 'qa_display_name') return 'Admin';
                if (key === 'qa_user_id') return '1';
                return '';
            },
            setItem() {},
            removeItem() {}
        },
        navigator: { clipboard: { writeText: async () => {} } },
        URL,
        setTimeout,
        clearTimeout,
        fetch: async () => {
            throw new Error('fetch should not be called by this test');
        },
        alert() {},
        confirm: () => true,
        prompt: () => ''
    };
}

function makeReports() {
    const aliceReports = Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        case_no: `T20260701-${String(index + 1).padStart(2, '0')}`,
        project_name: `Alice Project ${index + 1}`,
        tester_name: 'Alice',
        test_date: '2026-07-01',
        status: 'Pass',
        category: 'Other'
    }));

    const bobReports = Array.from({ length: 20 }, (_, index) => ({
        id: index + 101,
        case_no: `T20260702-${String(index + 1).padStart(2, '0')}`,
        project_name: `Bob Project ${index + 1}`,
        tester_name: 'Bob',
        test_date: '2026-07-02',
        status: 'Pass',
        category: 'Other'
    }));

    return [...aliceReports, ...bobReports];
}

const appPath = path.join(__dirname, '..', 'app.js');
const appCode = fs.readFileSync(appPath, 'utf8');
const sandbox = createSandbox();

const testCode = `
document.getElementById('filter-type').value = 'all';
document.getElementById('filter-category').value = 'all';
document.getElementById('filter-status').value = 'all';
document.getElementById('filter-tester').value = 'Alice';
document.getElementById('filter-start-date').value = '2026-06-01';
document.getElementById('filter-end-date').value = '2026-07-03';
document.getElementById('filter-case-no').value = '';
document.getElementById('search-input').value = '';

currentReportsList = ${JSON.stringify(makeReports())};
reportsCurrentPage = 3;

renderReportsTable();

const tbody = document.getElementById('reports-table-body');
const rowHtml = tbody.children.map(row => row.innerHTML).join('\\n');

assert.equal(reportsCurrentPage, 1);
assert.match(rowHtml, /Alice Project 1/);
assert.match(rowHtml, /T20260701-01/);
assert.doesNotMatch(rowHtml, /Bob Project/);
`;

vm.runInNewContext(`${appCode}\n${testCode}`, { ...sandbox, assert }, {
    filename: appPath
});
