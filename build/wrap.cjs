// gcc -wrapper hook: records the full arguments (response files expanded) of every program the driver runs
// (cc1plus, as, collect2 ...) into CAPTURE_DIR/<program>.json, then runs the real program unchanged.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const [, , prog, ...args] = process.argv;
// libiberty's buildargv rules (what GCC uses for @files): a backslash escapes the next character anywhere;
// single and double quotes group (each literal inside the other kind)
function split(txt) {
  const toks = []; let cur = '', q = null, any = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (c === '\\' && i + 1 < txt.length) { cur += txt[++i]; any = true; continue; }
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; any = true; continue; }
    if (/\s/.test(c)) { if (cur !== '' || any) toks.push(cur); cur = ''; any = false; continue; }
    cur += c; any = true;
  }
  if (cur !== '' || any) toks.push(cur);
  return toks;
}
const expanded = [];
for (const a of args) {
  if (a.startsWith('@') && fs.existsSync(a.slice(1))) expanded.push(...split(fs.readFileSync(a.slice(1), 'utf8')));
  else expanded.push(a);
}
const base = path.basename(prog).replace(/\.exe$/i, '');
if (process.env.CAPTURE_DIR) fs.writeFileSync(path.join(process.env.CAPTURE_DIR, base + '.json'), JSON.stringify({ prog, args: expanded }, null, 1));
const r = spawnSync(prog, args, { stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
