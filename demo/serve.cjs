const http = require('http'), fs = require('fs'), path = require('path');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
http.createServer((q, r) => {
  if (q.method === 'PUT') { const ch = []; q.on('data', d => ch.push(d)); q.on('end', () => { fs.mkdirSync(path.join(__dirname, 'saved'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'saved', path.basename(q.url)), Buffer.concat(ch)); r.end('ok'); }); return; }
  const f = path.join(__dirname, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+$/, '/index.html'));
  if (!f.startsWith(__dirname) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(r);
}).listen(+process.argv[2] || 8650);
