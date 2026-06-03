const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getUserByToken(token, env) {
  if (!token) return null;
  const session = await env.DB.prepare(
    'SELECT u.id, u.username, u.display_name, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?'
  ).bind(token, new Date().toISOString()).first();
  return session;
}

export default {
  async fetch(request, env, ctx) {
    // 處理 CORS 預檢請求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // Auth - Register
      if (url.pathname === '/api/register' && request.method === 'POST') {
        const { username, password, display_name } = await request.json();
        if (!username || !password || !display_name) {
          return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
        }
        
        try {
          const password_hash = await hashPassword(password);
          let role = 'user';
          let is_active = 0;
          if (username === '20200715' || username.toLowerCase().includes('admin')) {
            role = 'admin';
            is_active = 1;
          }
          await env.DB.prepare("INSERT INTO users (username, password_hash, display_name, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+8 hours'))")
            .bind(username, password_hash, display_name, role, is_active)
            .run();
          return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Username may already exist' }), { status: 400, headers: corsHeaders });
        }
      }

      // Auth - Login
      if (url.pathname === '/api/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        const password_hash = await hashPassword(password);
        
        const user = await env.DB.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?')
          .bind(username, password_hash)
          .first();
          
        if (!user) {
          return new Response(JSON.stringify({ error: '帳號或密碼錯誤' }), { status: 401, headers: corsHeaders });
        }

        if (user.is_active !== 1) {
          return new Response(JSON.stringify({ error: '您的帳號尚未啟用，請聯絡管理員啟用。' }), { status: 403, headers: corsHeaders });
        }
        
        const token = crypto.randomUUID();
        const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        
        await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, datetime('now', '+8 hours'))")
          .bind(token, user.id, expires_at)
          .run();
          
        return new Response(JSON.stringify({ success: true, token, display_name: user.display_name, role: user.role }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Auth - Logout
      if (url.pathname === '/api/logout' && request.method === 'POST') {
        const { token } = await request.json();
        if (token) {
          await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }


      // 2. 取得報告列表 (支援測試員與日期區間篩選)
      if (url.pathname === '/api/reports' && request.method === 'GET') {
        const tester = url.searchParams.get('tester');
        const date = url.searchParams.get('date');
        const start_date = url.searchParams.get('start_date');
        const end_date = url.searchParams.get('end_date');
        const statusParam = url.searchParams.get('status');
        
        let query = 'SELECT * FROM reports WHERE is_deleted = 0';
        let params = [];
        
        if (tester && tester !== 'all') {
          query += ' AND (tester_name = ? OR tester_name LIKE ? OR tester_name LIKE ?)';
          params.push(tester, `${tester} - %-更`, `% - ${tester}-更`);
        }
        if (statusParam) {
          query += ' AND status = ?';
          params.push(statusParam);
        }
        if (date) {
          query += ' AND test_date = ?';
          params.push(date);
        } else {
          if (start_date) {
            query += ' AND test_date >= ?';
            params.push(start_date);
          }
          if (end_date) {
            query += ' AND test_date <= ?';
            params.push(end_date);
          }
        }
        
        query += ' ORDER BY is_pinned DESC, test_date DESC, created_at DESC LIMIT 100';
        
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2.5 取得下一個案件編號
      if (url.pathname === '/api/reports/next-case-no' && request.method === 'GET') {
        const dateStr = url.searchParams.get('date');
        const type = url.searchParams.get('type') || 'normal';
        
        if (!dateStr) {
          return new Response(JSON.stringify({ error: 'Missing date parameter' }), { status: 400, headers: corsHeaders });
        }
        
        const datePrefix = dateStr.replace(/-/g, '');
        // 找尋當日所有案件編號 (包含 P開頭、T開頭、以及舊版無英文字母開頭)，找出最大的流水號
        const { results } = await env.DB.prepare(
          `SELECT case_no FROM reports WHERE case_no LIKE ? OR case_no LIKE ? OR case_no LIKE ?`
        ).bind(`${datePrefix}-%`, `T${datePrefix}-%`, `P${datePrefix}-%`).all();
        
        let maxSeq = 0;
        if (results && results.length > 0) {
          results.forEach(row => {
            const seqMatch = row.case_no.match(/-(\d+)$/);
            if (seqMatch) {
              const seq = parseInt(seqMatch[1], 10);
              if (seq > maxSeq) maxSeq = seq;
            }
          });
        }
        
        const nextSeq = maxSeq + 1;
        const letter = type === 'prod' ? 'P' : 'T';
        const nextCaseNo = `${letter}${datePrefix}-${nextSeq.toString().padStart(2, '0')}`;
        
        return new Response(JSON.stringify({ nextCaseNo }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. 新增報告
      if (url.pathname === '/api/reports' && request.method === 'POST') {
        const body = await request.json();
        const { case_no, project_name, tester_name, test_date, status, bug_link, notes, category, raw_ticket } = body;
        
        const result = await env.DB.prepare(
          "INSERT INTO reports (case_no, project_name, tester_name, test_date, status, bug_link, notes, category, raw_ticket, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'))"
        ).bind(case_no, project_name, tester_name, test_date, status, bug_link, notes, category || '其他', raw_ticket || null).run();
        
        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.1 修改報告
      if (url.pathname === '/api/reports/update' && request.method === 'POST') {
        const body = await request.json();
        const { id, token, case_no, project_name, tester_name, test_date, status, bug_link, notes, category, raw_ticket } = body;
        
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }

        const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
        if (!report) {
          return new Response(JSON.stringify({ error: '報告不存在' }), { status: 404, headers: corsHeaders });
        }

        if (user.role !== 'admin' && user.display_name !== report.tester_name.split(' - ')[0]) {
          return new Response(JSON.stringify({ error: '您無權修改其他測試員的報告' }), { status: 403, headers: corsHeaders });
        }

        let finalTesterName = tester_name.split(' - ')[0]; // Always start with base name
        
        let debugStr = `DEBUG: user.role=${user.role}, user.display_name=${user.display_name}, originalBaseName=${report.tester_name.split(' - ')[0]}, tester_name=${tester_name}`;
        
        if (user.role === 'admin') {
          const originalBaseName = report.tester_name.split(' - ')[0];
          if (originalBaseName !== user.display_name) {
            finalTesterName = `${finalTesterName} - ${user.display_name}-更`;
            debugStr += ` | Added suffix: ${finalTesterName}`;
          } else {
            debugStr += ` | Same user, no suffix`;
          }
        } else {
          // If non-admin user edits, preserve existing admin tag if any
          if (report.tester_name.includes('-更')) {
            const adminMark = report.tester_name.substring(report.tester_name.indexOf(' - '));
            finalTesterName = finalTesterName + adminMark;
            debugStr += ` | Preserved suffix: ${finalTesterName}`;
          } else {
            debugStr += ` | Not admin, no existing suffix`;
          }
        }

        let updatedNotes = notes;
        if (finalTesterName !== tester_name) {
          // It was modified to add or keep the -更 suffix. Update the notes text to match.
          updatedNotes = notes.replace(new RegExp(`(測試人員\\s*[：:]\\s*)${tester_name}`), `$1${finalTesterName}`);
        }
        
        updatedNotes = updatedNotes + '\n' + debugStr;

        await env.DB.prepare(
          'UPDATE reports SET case_no = ?, project_name = ?, tester_name = ?, test_date = ?, status = ?, bug_link = ?, notes = ?, category = ?, raw_ticket = ? WHERE id = ?'
        ).bind(case_no, project_name, finalTesterName, test_date, status, bug_link, updatedNotes, category || '其他', raw_ticket || null, id).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.1.5 釘選/取消釘選報告
      if (url.pathname === '/api/reports/pin' && request.method === 'POST') {
        const { id, is_pinned, token } = await request.json();
        
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }

        const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
        if (!report) {
          return new Response(JSON.stringify({ error: '報告不存在' }), { status: 404, headers: corsHeaders });
        }

        if (user.role !== 'admin' && user.display_name !== report.tester_name.split(' - ')[0]) {
          return new Response(JSON.stringify({ error: '您無權釘選其他測試員的報告' }), { status: 403, headers: corsHeaders });
        }
        
        await env.DB.prepare('UPDATE reports SET is_pinned = ? WHERE id = ?').bind(is_pinned ? 1 : 0, id).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.2 刪除報告 (軟刪除)
      if (url.pathname === '/api/reports/delete' && request.method === 'POST') {
        const { id, token } = await request.json();
        
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }

        const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
        if (!report) {
          return new Response(JSON.stringify({ error: '報告不存在' }), { status: 404, headers: corsHeaders });
        }

        if (user.role !== 'admin' && user.display_name !== report.tester_name.split(' - ')[0]) {
          return new Response(JSON.stringify({ error: '您無權刪除其他測試員的報告' }), { status: 403, headers: corsHeaders });
        }
        
        await env.DB.prepare('UPDATE reports SET is_deleted = 1 WHERE id = ?').bind(id).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.3 取得垃圾桶列表 (is_deleted = 1)
      if (url.pathname === '/api/reports/trash' && request.method === 'GET') {
        const token = url.searchParams.get('token');
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }

        const query = 'SELECT * FROM reports WHERE is_deleted = 1 ORDER BY created_at DESC LIMIT 100';
        const { results } = await env.DB.prepare(query).all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.4 復原報告
      if (url.pathname === '/api/reports/restore' && request.method === 'POST') {
        const { id, token } = await request.json();
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }

        const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
        if (!report) {
          return new Response(JSON.stringify({ error: '報告不存在' }), { status: 404, headers: corsHeaders });
        }

        if (user.role !== 'admin' && user.display_name !== report.tester_name.split(' - ')[0]) {
          return new Response(JSON.stringify({ error: '您無權復原其他測試員的報告' }), { status: 403, headers: corsHeaders });
        }

        await env.DB.prepare('UPDATE reports SET is_deleted = 0 WHERE id = ?').bind(id).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.5 永久刪除報告
      if (url.pathname === '/api/reports/purge' && request.method === 'POST') {
        const { id, token } = await request.json();
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }

        const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
        if (!report) {
          return new Response(JSON.stringify({ error: '報告不存在' }), { status: 404, headers: corsHeaders });
        }

        if (user.role !== 'admin' && user.display_name !== report.tester_name.split(' - ')[0]) {
          return new Response(JSON.stringify({ error: '您無權永久刪除其他測試員的報告' }), { status: 403, headers: corsHeaders });
        }

        await env.DB.prepare('DELETE FROM reports WHERE id = ?').bind(id).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.6 取得使用者列表 (限管理員)
      if (url.pathname === '/api/users' && request.method === 'GET') {
        const token = url.searchParams.get('token');
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }
        if (user.role !== 'admin') {
          return new Response(JSON.stringify({ error: '無權限存取此資源' }), { status: 403, headers: corsHeaders });
        }

        const { results } = await env.DB.prepare(
          'SELECT id, username, display_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
        ).all();
        
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.7 切換使用者啟用狀態 (限管理員)
      if (url.pathname === '/api/users/toggle' && request.method === 'POST') {
        const { token, userId, is_active } = await request.json();
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }
        if (user.role !== 'admin') {
          return new Response(JSON.stringify({ error: '無權限存取此資源' }), { status: 403, headers: corsHeaders });
        }

        // 安全防護：管理員不能關閉自己的帳號
        if (user.id === userId && is_active === 0) {
          return new Response(JSON.stringify({ error: '管理員無法停用自己的帳號' }), { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare('UPDATE users SET is_active = ? WHERE id = ?')
          .bind(is_active, userId)
          .run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.8 重設使用者密碼 (限管理員)
      if (url.pathname === '/api/users/reset-password' && request.method === 'POST') {
        const { token, userId, newPassword } = await request.json();
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }
        if (user.role !== 'admin') {
          return new Response(JSON.stringify({ error: '無權限存取此資源' }), { status: 403, headers: corsHeaders });
        }

        if (!newPassword || newPassword.trim() === '') {
          return new Response(JSON.stringify({ error: '新密碼不能為空' }), { status: 400, headers: corsHeaders });
        }

        const newHash = await hashPassword(newPassword);
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
          .bind(newHash, userId)
          .run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 4. 取得統計數據 (每日測試數量、各狀態總計、T/P單數)
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        const start_date = url.searchParams.get('start_date');
        const end_date = url.searchParams.get('end_date');

        // 取得台灣時間的今日與本月一日
        const twDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
        const yyyy = twDate.getFullYear();
        const mm = String(twDate.getMonth() + 1).padStart(2, '0');
        const dd = String(twDate.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const monthStartStr = `${yyyy}-${mm}-01`;

        let queryBase = 'FROM reports WHERE is_deleted = 0';
        let params = [];

        if (start_date) {
          queryBase += ' AND test_date >= ?';
          params.push(start_date);
        }
        if (end_date) {
          queryBase += ' AND test_date <= ?';
          params.push(end_date);
        }

        const statusStats = await env.DB.prepare(
          `SELECT status, COUNT(*) as count ${queryBase} GROUP BY status`
        ).bind(...params).all();

        const dailyStats = await env.DB.prepare(
          `SELECT test_date, COUNT(*) as count ${queryBase} GROUP BY test_date ORDER BY test_date DESC LIMIT 30`
        ).bind(...params).all();

        let tpQueryBase = 'FROM reports WHERE is_deleted = 0';
        let tpParams = [];
        if (start_date) {
          tpQueryBase += ' AND test_date >= ?';
          tpParams.push(start_date);
        }
        if (end_date) {
          tpQueryBase += ' AND test_date <= ?';
          tpParams.push(end_date);
        }
        if (!start_date && !end_date) {
            tpQueryBase += ' AND test_date = ?';
            tpParams.push(todayStr);
        }

        const typeStats = await env.DB.prepare(
          `SELECT 
            SUM(CASE WHEN case_no LIKE 'T%' THEN 1 ELSE 0 END) as t_count,
            SUM(CASE WHEN case_no LIKE 'P%' THEN 1 ELSE 0 END) as p_count
           ${tpQueryBase}`
        ).bind(...tpParams).first();

        let totalQueryBase = 'FROM reports WHERE is_deleted = 0';
        let totalParams = [];
        if (start_date) {
          totalQueryBase += ' AND test_date >= ?';
          totalParams.push(start_date);
        }
        if (end_date) {
          totalQueryBase += ' AND test_date <= ?';
          totalParams.push(end_date);
        }
        if (!start_date && !end_date) {
            totalQueryBase += ' AND test_date >= ?';
            totalParams.push(monthStartStr);
        }

        const monthTotal = await env.DB.prepare(
          `SELECT COUNT(*) as count ${totalQueryBase}`
        ).bind(...totalParams).first();



        const day = twDate.getDay();
        const diff = twDate.getDate() - day + (day === 0 ? -6 : 1);
        const weekStartDate = new Date(twDate.setDate(diff));
        const w_yyyy = weekStartDate.getFullYear();
        const w_mm = String(weekStartDate.getMonth() + 1).padStart(2, '0');
        const w_dd = String(weekStartDate.getDate()).padStart(2, '0');
        const weekStartStr = `${w_yyyy}-${w_mm}-${w_dd}`;

        let testerQueryBase = '';
        let testerParams = [];
        if (start_date) {
            testerQueryBase += ' AND r.test_date >= ?';
            testerParams.push(start_date);
        }
        if (end_date) {
            testerQueryBase += ' AND r.test_date <= ?';
            testerParams.push(end_date);
        }

        const testerQuery = `
          SELECT 
            CASE WHEN INSTR(r.tester_name, ' - ') > 0 THEN SUBSTR(r.tester_name, 1, INSTR(r.tester_name, ' - ') - 1) ELSE r.tester_name END as tester_name, 
            COUNT(r.id) as total_count,
            SUM(CASE WHEN r.case_no LIKE 'T%' THEN 1 ELSE 0 END) as total_t,
            SUM(CASE WHEN r.case_no LIKE 'P%' THEN 1 ELSE 0 END) as total_p,

            SUM(CASE WHEN r.test_date = ? THEN 1 ELSE 0 END) as today_count,
            SUM(CASE WHEN r.test_date = ? AND r.case_no LIKE 'T%' THEN 1 ELSE 0 END) as today_t,
            SUM(CASE WHEN r.test_date = ? AND r.case_no LIKE 'P%' THEN 1 ELSE 0 END) as today_p,

            SUM(CASE WHEN r.test_date >= ? AND r.test_date <= ? THEN 1 ELSE 0 END) as week_count,
            SUM(CASE WHEN r.test_date >= ? AND r.test_date <= ? AND r.case_no LIKE 'T%' THEN 1 ELSE 0 END) as week_t,
            SUM(CASE WHEN r.test_date >= ? AND r.test_date <= ? AND r.case_no LIKE 'P%' THEN 1 ELSE 0 END) as week_p,

            SUM(CASE WHEN r.test_date >= ? AND r.test_date <= ? THEN 1 ELSE 0 END) as month_count,
            SUM(CASE WHEN r.test_date >= ? AND r.test_date <= ? AND r.case_no LIKE 'T%' THEN 1 ELSE 0 END) as month_t,
            SUM(CASE WHEN r.test_date >= ? AND r.test_date <= ? AND r.case_no LIKE 'P%' THEN 1 ELSE 0 END) as month_p,

            COALESCE(MAX(u.is_active), 0) as is_active
          FROM reports r
          LEFT JOIN users u ON (CASE WHEN INSTR(r.tester_name, ' - ') > 0 THEN SUBSTR(r.tester_name, 1, INSTR(r.tester_name, ' - ') - 1) ELSE r.tester_name END) = u.display_name
          WHERE r.is_deleted = 0 ${testerQueryBase}
          GROUP BY CASE WHEN INSTR(r.tester_name, ' - ') > 0 THEN SUBSTR(r.tester_name, 1, INSTR(r.tester_name, ' - ') - 1) ELSE r.tester_name END 
          ORDER BY month_count DESC, today_count DESC
        `;
        const testerStats = await env.DB.prepare(testerQuery).bind(
            todayStr, todayStr, todayStr, 
            weekStartStr, todayStr, weekStartStr, todayStr, weekStartStr, todayStr, 
            monthStartStr, todayStr, monthStartStr, todayStr, monthStartStr, todayStr,
            ...testerParams
        ).all();

        return new Response(JSON.stringify({
          statusStats: statusStats.results,
          dailyStats: dailyStats.results,
          testerStats: testerStats.results,
          typeStats: typeStats,
          monthTotal: monthTotal.count
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Bulletins - Get All
      if (url.pathname === '/api/collab/bulletins' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM bulletins ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Bulletins - Create
      if (url.pathname === '/api/collab/bulletins' && request.method === 'POST') {
        const body = await request.json();
        const { token, content } = body;
        
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }
        
        const result = await env.DB.prepare("INSERT INTO bulletins (content, author, created_at) VALUES (?, ?, datetime('now', '+8 hours'))")
          .bind(content, user.display_name)
          .run();
          
        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Bulletins - Delete
      if (url.pathname.startsWith('/api/collab/bulletins/') && request.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        const body = await request.json();
        const { token } = body;
        
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }
        
        await env.DB.prepare('DELETE FROM bulletins WHERE id = ?').bind(id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(err.message, { status: 500, headers: corsHeaders });
    }
  },
};
