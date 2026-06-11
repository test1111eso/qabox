/**
 * ua-proxy.js — UA API 本機代理伺服器
 *
 * 用途：因 ua.1111.com.tw 封鎖 Cloudflare Worker IP，
 *       且不支援瀏覽器 CORS，需用本機 Node.js 做橋接。
 *
 * 使用方式：node ua-proxy.js
 * 或直接雙擊 start-ua-proxy.bat
 *
 * 流程：瀏覽器 → localhost:7788/ua/* → ua.1111.com.tw/api/hooks/pat/*
 */

const http = require('http');
const https = require('https');

const PORT = 7788;
const UA_BASE = 'ua.1111.com.tw';
const UA_PATH_PREFIX = '/api/hooks/pat';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-UA-Token',
};

const server = http.createServer((req, res) => {
  // CORS 預檢
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // 健康檢查
  if (req.url === '/health') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, msg: 'UA 代理運行中' }));
    return;
  }

  // 從 Header 讀 PAT（由瀏覽器帶入）
  const pat = req.headers['x-ua-token'];
  if (!pat) {
    res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '缺少 X-UA-Token header' }));
    return;
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // 路徑對應：/ua/work → /api/hooks/pat/work
  const uaSubPath = req.url.replace(/^\/ua/, '');
  const uaFullPath = UA_PATH_PREFIX + uaSubPath;

  // 收集 request body
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    let body = chunks.length ? Buffer.concat(chunks) : null;

    // ----- 攔截 /discuss 幫忙抓 GUID -----
    if (req.url === '/ua/discuss' && req.method === 'POST' && body) {
      try {
        const payloadStr = body.toString();
        const payload = JSON.parse(payloadStr);
        if (Array.isArray(payload)) {
          let modified = false;
          for (let i = 0; i < payload.length; i++) {
            const item = payload[i];
            if (item.id && !item.guid) {
              const { execSync } = require('child_process');
              try {
                let cmd = '';
                if (item.kind === 2) {
                  cmd = `ua-cli work task detail T${item.id} --json`;
                } else if (item.kind === 1) {
                  cmd = `ua-cli work plan detail ${item.id} --json`;
                }
                if (cmd) {
                  console.log(`[Proxy] 嘗試獲取 ${item.id} 的 GUID: ${cmd}`);
                  const output = execSync(cmd, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, encoding: 'utf8' });
                  // 尋找 GUID (可能是 taskGuid, planGuid 或 guid)
                  const guidMatch = output.match(/"(?:taskGuid|planGuid|guid)"\s*:\s*"([a-f0-9\-]{36})"/i);
                  if (guidMatch) {
                    item.guid = guidMatch[1];
                    console.log(`[Proxy] 成功解析 GUID: ${item.guid}`);
                    modified = true;
                  } else {
                    console.log(`[Proxy] 未在 JSON 找到 GUID`);
                  }
                }
              } catch (err) {
                console.log(`[Proxy] 呼叫 ua-cli 失敗: ${err.message}`);
              }
            }
          }
          if (modified) {
            body = Buffer.from(JSON.stringify(payload));
          }
        }
      } catch (e) {
        console.log(`[Proxy] Parse discuss payload failed:`, e.message);
      }
    }
    // -------------------------------------

    const options = {
      hostname: UA_BASE,
      path: uaFullPath,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Personal-Token': pat,
      },
    };

    const uaReq = https.request(options, (uaRes) => {
      const parts = [];
      uaRes.on('data', chunk => parts.push(chunk));
      uaRes.on('end', () => {
        const responseBody = Buffer.concat(parts).toString();
        res.writeHead(uaRes.statusCode, {
          ...corsHeaders,
          'Content-Type': 'application/json',
        });
        res.end(responseBody);
      });
    });

    uaReq.on('error', (err) => {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '無法連線至 UA API：' + err.message }));
    });

    if (body && body.length > 0) uaReq.write(body);
    uaReq.end();
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('====================================');
  console.log('  UA 本機代理已啟動');
  console.log('  位址：http://localhost:' + PORT);
  console.log('====================================');
  console.log('');
  console.log('請保持此視窗開啟，');
  console.log('切換至 QA 系統後即可使用「發布至工單」功能。');
  console.log('');
  console.log('按 Ctrl+C 可停止代理。');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`錯誤：連接埠 ${PORT} 已被占用，代理可能已在運行。`);
    process.exit(1);
  }
  throw err;
});
