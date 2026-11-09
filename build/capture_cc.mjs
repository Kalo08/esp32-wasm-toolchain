// Re-run the captured sketch compile through wrap.cjs to record the real cc1plus arguments, then write them as a
// WSL-path argument list for the WebAssembly cc1plus.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const HERE = 'C:/work/wasm';
const GT = 'C:/work/ground-truth';
function tokenize(line) {
  const out = []; let cur = '', q = false, any = false;
  for (const c of line) {
    if (c === '"') { q = !q; any = true; continue; }
    if (!q && /\s/.test(c)) { if (cur !== '' || any) out.push(cur); cur = ''; any = false; continue; }
    cur += c; any = true;
  }
  if (cur !== '' || any) out.push(cur);
  return out;
}
const args = tokenize(fs.readFileSync(`${GT}/1_sketch_compile_driver_command.txt`, 'utf8').trim());
const run = [];
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '-MMD') continue;
  if (a === '-MF') { i++; continue; }
  if (a === '-o') { run.push('-o', `${HERE}/cc_native.o`); i++; continue; }
  run.push(a);
}
run.push('-wrapper', `node,${HERE}/wrap.cjs`);
fs.mkdirSync(`${HERE}/cap`, { recursive: true });
const r = spawnSync(args[0], run, { encoding: 'utf8', maxBuffer: 1 << 28, cwd: 'C:/Users/USER/Downloads', env: { ...process.env, CAPTURE_DIR: `${HERE}/cap` } });
console.log('native compile via wrapper: exit', r.status, (r.stderr || '').slice(0, 200));
console.log('recorded programs:', fs.readdirSync(`${HERE}/cap`).join(', '));
const j = JSON.parse(fs.readFileSync(`${HERE}/cap/cc1plus.json`, 'utf8'));
console.log('cc1plus arguments:', j.args.length);
// only real drive-letter paths are converted (C:\a\\b, C:/a/b -> /mnt/c/a/b); every other argument is left exactly as is
const map = (s) => s.replace(/([A-Za-z]):[\\/][^\s"']*/g, (m) => `/mnt/${m[0].toLowerCase()}${m.slice(2).replace(/[\\/]+/g, '/')}`);
// which argument is the source file, and what remains a Windows-style string on purpose (the -DARDUINO_BOARD="..." etc)
const keep = j.args.filter(a => !a.startsWith('-mdynconfig'));
const out = [];
for (let i = 0; i < keep.length; i++) {
  const a = keep[i];
  if (a === '-o') { out.push('-o', '/root/work/test-cc/out.s'); i++; continue; }
  if (/^-dumpdir$/.test(a)) { out.push(a, '/root/work/test-cc/'); i++; continue; }
  out.push(map(a));
}
// The native compiler finds its own built-in header folders relative to where it is installed; this build is
// configured for another prefix, so give those folders explicitly, in the native search order (they come last).
const v = fs.readFileSync(`${GT}/1_sketch_compile_gcc_v.txt`, 'utf8').split(/\r?\n/);
const s = v.findIndex(l => l.startsWith('#include <...> search starts here:'));
const e = v.findIndex(l => l.startsWith('End of search list'));
const builtin = v.slice(s + 1, e).map(l => l.trim()).filter(l => /esp-x32[\\/]+2601/.test(l));
for (const d of builtin) out.push('-idirafter', map(d));
console.log('built-in header folders added:', builtin.length);
fs.writeFileSync(`${HERE}/cc1_args.txt`, out.join('\n') + '\n');
console.log('wrote cc1_args.txt:', out.length, 'args');
console.log('source file arg:', out.find(a => /\.cpp$/.test(a)));
console.log('sample:', out.slice(0, 8).join(' ').slice(0, 300));
