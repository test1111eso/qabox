const fs = require('fs');

try {
    let code = fs.readFileSync('app.js', 'utf8');

    // Add vars
    code = code.replace('let userEditedFields = new Set();', 'let userEditedFields = new Set();\nlet wsCurrentPage = 1;\nlet reportsCurrentPage = 1;\nconst ITEMS_PER_PAGE = 20;');

    // Replace loadWorkspace table with render
    const wsStart = `        const tbody = document.getElementById('ws-recent-reports-body');
        tbody.innerHTML = '';
        
        if (data.length === 0) {`;
    const wsEnd = `            tbody.appendChild(tr);
        });
    } catch (err) {`;
    
    const wsBlockStartIdx = code.indexOf(wsStart);
    const wsBlockEndIdx = code.indexOf(wsEnd);
    
    if (wsBlockStartIdx !== -1 && wsBlockEndIdx !== -1) {
        const wsBlock = code.substring(wsBlockStartIdx, wsBlockEndIdx + wsEnd.length);
        code = code.replace(wsBlock, `        wsCurrentPage = 1;\n        renderWorkspaceTable();\n    } catch (err) {`);
    }

    // Replace fetchReports table with render
    const rpStart = `        currentReportsList = data; // 存入全域變數以供編輯時快速查找
        
        tbody.innerHTML = '';
        if (data.length === 0) {`;
    const rpEnd = `            tbody.appendChild(tr);
        });
    } catch (err) {`;
    
    const rpBlockStartIdx = code.indexOf(rpStart);
    const rpBlockEndIdx = code.indexOf(rpEnd);
    
    if (rpBlockStartIdx !== -1 && rpBlockEndIdx !== -1) {
        const rpBlock = code.substring(rpBlockStartIdx, rpBlockEndIdx + rpEnd.length);
        code = code.replace(rpBlock, `        currentReportsList = data; // 存入全域變數以供編輯時快速查找\n        reportsCurrentPage = 1;\n        renderReportsTable();\n    } catch (err) {`);
    }

    // Replace Collab logic
    const collabStart = `// ================= Collaboration Board Logic =================`;
    const collabEnd = `function toggleCollabTodo(id) {
    const data = getCollabData('todo');
    const item = data.find(i => i.id === id);
    if (item) {
        item.completed = !item.completed;
        saveCollabData('todo', data);
        renderCollabList('todo');
    }
}`;
    
    const collabBlockStartIdx = code.indexOf(collabStart);
    const collabBlockEndIdx = code.indexOf(collabEnd);
    
    if (collabBlockStartIdx !== -1 && collabBlockEndIdx !== -1) {
        const collabBlock = code.substring(collabBlockStartIdx, collabBlockEndIdx + collabEnd.length);
        const newCollab = fs.readFileSync('new_collab.js', 'utf8');
        code = code.replace(collabBlock, newCollab);
    }

    // Read append script
    const appendFns = fs.readFileSync('append_fns.js', 'utf8');
    code += "\n" + appendFns;

    fs.writeFileSync('app.js', code);
    console.log('Successfully patched app.js!');
} catch (e) {
    console.error(e);
}
