// Packs the 337-header minimal tree + the cc1plus arguments for the browser test.
const fs = require('fs'), path = require('path');
const MIN = '/root/work/min', OUT = process.argv[2];
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) files.push(p); } })(MIN);
const manifest = []; const chunks = []; let off = 0;
for (const f of files) { const b = fs.readFileSync(f); manifest.push({ p: f, o: off, n: b.length }); chunks.push(b); off += b.length; }
fs.writeFileSync(path.join(OUT, 'headers.bin'), Buffer.concat(chunks));
fs.writeFileSync(path.join(OUT, 'headers.json'), JSON.stringify(manifest));
const args = fs.readFileSync(process.argv[3], 'utf8').split('\n').filter(l => l.length)
  .map(a => a.split('/mnt/c/').join('/root/work/min/').split('/root/work/test-cc/out.s').join('/root/work/test-min/out.s'));
fs.writeFileSync(path.join(OUT, 'cc1_args.json'), JSON.stringify(args));
console.log(files.length, 'files', off, 'bytes;', args.length, 'args');
