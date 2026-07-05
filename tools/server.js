// 本機測試用靜態伺服器：node tools/server.js [port]（預設 8766）
// 永遠回 no-cache，避免測試時吃到舊檔。
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 8766;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/shot')) { // 測試用截圖存檔
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { try {
      const name = (req.url.split('name=')[1] || 'shot').replace(/[^\w-]/g, '');
      const b64 = body.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(require('os').tmpdir(), name + '.jpg'), Buffer.from(b64, 'base64'));
      res.writeHead(200); res.end('ok');
    } catch (e) { res.writeHead(500); res.end('err'); } });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('http://localhost:' + PORT));
