const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
          await env.DB.prepare('INSERT INTO users (username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, ?)')
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
        
        await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
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

      // 1. 取得文件列表
      if (url.pathname === '/api/documents' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM documents ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. 取得報告列表 (支援測試員與日期區間篩選)
      if (url.pathname === '/api/reports' && request.method === 'GET') {
        const tester = url.searchParams.get('tester');
        const date = url.searchParams.get('date');
        const start_date = url.searchParams.get('start_date');
        const end_date = url.searchParams.get('end_date');
        
        let query = 'SELECT * FROM reports WHERE is_deleted = 0';
        let params = [];
        
        if (tester && tester !== 'all') {
          query += ' AND tester_name = ?';
          params.push(tester);
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
        
        query += ' ORDER BY created_at DESC LIMIT 100';
        
        const { results } = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. 新增報告
      if (url.pathname === '/api/reports' && request.method === 'POST') {
        const body = await request.json();
        const { case_no, project_name, tester_name, test_date, status, bug_link, notes } = body;
        
        const result = await env.DB.prepare(
          'INSERT INTO reports (case_no, project_name, tester_name, test_date, status, bug_link, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(case_no, project_name, tester_name, test_date, status, bug_link, notes).run();
        
        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3.1 修改報告
      if (url.pathname === '/api/reports/update' && request.method === 'POST') {
        const body = await request.json();
        const { id, token, case_no, project_name, tester_name, test_date, status, bug_link, notes } = body;
        
        const user = await getUserByToken(token, env);
        if (!user) {
          return new Response(JSON.stringify({ error: '未授權，請重新登入' }), { status: 401, headers: corsHeaders });
        }

        const report = await env.DB.prepare('SELECT * FROM reports WHERE id = ?').bind(id).first();
        if (!report) {
          return new Response(JSON.stringify({ error: '報告不存在' }), { status: 404, headers: corsHeaders });
        }

        if (user.role !== 'admin' && user.display_name !== report.tester_name) {
          return new Response(JSON.stringify({ error: '您無權修改其他測試員的報告' }), { status: 403, headers: corsHeaders });
        }

        await env.DB.prepare(
          'UPDATE reports SET case_no = ?, project_name = ?, tester_name = ?, test_date = ?, status = ?, bug_link = ?, notes = ? WHERE id = ?'
        ).bind(case_no, project_name, tester_name, test_date, status, bug_link, notes, id).run();
        
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

        if (user.role !== 'admin' && user.display_name !== report.tester_name) {
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

        if (user.role !== 'admin' && user.display_name !== report.tester_name) {
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

        if (user.role !== 'admin' && user.display_name !== report.tester_name) {
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

      // 4. 取得統計數據 (每日測試數量、各狀態總計)
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        const statusStats = await env.DB.prepare(
          'SELECT status, COUNT(*) as count FROM reports WHERE is_deleted = 0 GROUP BY status'
        ).all();

        const dailyStats = await env.DB.prepare(
          'SELECT test_date, COUNT(*) as count FROM reports WHERE is_deleted = 0 GROUP BY test_date ORDER BY test_date DESC LIMIT 7'
        ).all();

        const testerStats = await env.DB.prepare(
          'SELECT tester_name, COUNT(*) as count FROM reports WHERE is_deleted = 0 GROUP BY tester_name ORDER BY count DESC'
        ).all();

        return new Response(JSON.stringify({
          statusStats: statusStats.results,
          dailyStats: dailyStats.results,
          testerStats: testerStats.results
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(err.message, { status: 500, headers: corsHeaders });
    }
  },
};
