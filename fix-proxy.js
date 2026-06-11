const fs = require('fs');

let code = fs.readFileSync('ua-proxy.js', 'utf8');

const searchStr = `  req.on('end', () => {
    const body = chunks.length ? Buffer.concat(chunks) : null;

    const options = {`;

const searchStr2 = searchStr.replace(/\r/g, '');

const replaceStr = `  req.on('end', async () => {
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
                  cmd = \`ua-cli work task detail T\${item.id} --json\`;
                } else if (item.kind === 1) {
                  cmd = \`ua-cli work plan detail \${item.id} --json\`;
                }
                if (cmd) {
                  console.log(\`[Proxy] 嘗試獲取 \${item.id} 的 GUID: \${cmd}\`);
                  const output = execSync(cmd, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, encoding: 'utf8' });
                  // 尋找 GUID (可能是 taskGuid, planGuid 或 guid)
                  const guidMatch = output.match(/\"(?:taskGuid|planGuid|guid)\"\\s*:\\s*\"([a-f0-9\\-]{36})\"/i);
                  if (guidMatch) {
                    item.guid = guidMatch[1];
                    console.log(\`[Proxy] 成功解析 GUID: \${item.guid}\`);
                    modified = true;
                  } else {
                    console.log(\`[Proxy] 未在 JSON 找到 GUID\`);
                  }
                }
              } catch (err) {
                console.log(\`[Proxy] 呼叫 ua-cli 失敗: \${err.message}\`);
              }
            }
          }
          if (modified) {
            body = Buffer.from(JSON.stringify(payload));
          }
        }
      } catch (e) {
        console.log(\`[Proxy] Parse discuss payload failed:\`, e.message);
      }
    }
    // -------------------------------------

    const options = {`;

if (code.includes(searchStr)) {
  code = code.replace(searchStr, replaceStr);
} else if (code.includes(searchStr2)) {
  code = code.replace(searchStr2, replaceStr);
} else {
  console.log("Could not find the target string to replace.");
}

fs.writeFileSync('ua-proxy.js', code);
console.log('Fixed proxy logic!');
