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
          await env.DB.prepare('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)')
            .bind(username, password_hash, display_name)
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
        
        const token = crypto.randomUUID();
        const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        
        await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
          .bind(token, user.id, expires_at)
          .run();
          
        return new Response(JSON.stringify({ success: true, token, display_name: user.display_name }), {
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

      // 2. 取得報告列表 (支援測試員與日期篩選)
      if (url.pathname === '/api/reports' && request.method === 'GET') {
        const tester = url.searchParams.get('tester');
        const date = url.searchParams.get('date');
        
        let query = 'SELECT * FROM reports WHERE 1=1';
        let params = [];
        
        if (tester) {
          query += ' AND tester_name = ?';
          params.push(tester);
        }
        if (date) {
          query += ' AND test_date = ?';
          params.push(date);
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
        const { project_name, tester_name, test_date, status, bug_link, notes } = body;
        
        const result = await env.DB.prepare(
          'INSERT INTO reports (project_name, tester_name, test_date, status, bug_link, notes) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(project_name, tester_name, test_date, status, bug_link, notes).run();
        
        return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 4. 取得統計數據 (每日測試數量、各狀態總計)
      if (url.pathname === '/api/stats' && request.method === 'GET') {
        const statusStats = await env.DB.prepare(
          'SELECT status, COUNT(*) as count FROM reports GROUP BY status'
        ).all();

        const dailyStats = await env.DB.prepare(
          'SELECT test_date, COUNT(*) as count FROM reports GROUP BY test_date ORDER BY test_date DESC LIMIT 7'
        ).all();

        const testerStats = await env.DB.prepare(
          'SELECT tester_name, COUNT(*) as count FROM reports GROUP BY tester_name ORDER BY count DESC'
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
