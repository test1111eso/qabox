const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

if (!code.includes('toggleTesterDropdown')) {
    const appendCode = `

// Dropdown Logic for Tester Stats
function toggleTesterDropdown(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const menu = document.getElementById('tester-dropdown-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const btn = document.getElementById('tester-dropdown-btn');
    const menu = document.getElementById('tester-dropdown-menu');
    if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add('hidden');
    }
});
`;
    fs.appendFileSync('app.js', appendCode);
    console.log('Successfully appended dropdown logic.');
} else {
    console.log('Logic already exists.');
}
