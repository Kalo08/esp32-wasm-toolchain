// Re-run the captured link command through wrap.cjs to record the linker's real arguments, then write them
// as a WSL-path argument list (one per line) for the WebAssembly ld.
import fs from 'node:fs';
import path from 'node:path';
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
const args = tokenize(fs.readFileSync(`${GT}/4_link_driver_command.txt`, 'utf8').trim());
const run = [];
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '-o') { run.push('-o', `${HERE}/link_native.elf`); i++; continue; }
  if (/^-Wl,-Map=/.test(a)) { run.push(`-Wl,-Map=${HERE}/link_native.map`); continue; }
  run.push(a);
}
run.push('-wrapper', `node,${HERE}/wrap.cjs`);
const cap = `${HERE}/link_capture.json`;
try { fs.unlinkSync(cap); } catch { /* none yet */ }
const r = spawnSync(args[0], run, { encoding: 'utf8', maxBuffer: 1 << 28, cwd: 'C:/work/ground-truth', env: { ...process.env, CAPTURE_OUT: cap } });
console.log('native link via wrapper: exit', r.status, (r.stderr || '').slice(0, 300));
const j = JSON.parse(fs.readFileSync(cap, 'utf8'));
console.log('collect2 arguments recorded:', j.args.length);
// to WSL paths, minus what only the Windows tools understand
const map = (s) => s.replace(/([A-Za-z]):[\\/]/g, (_, d) => `/mnt/${d.toLowerCase()}/`).replace(/\\/g, '/');
const keep = j.args.filter(a => a !== '-fno-lto' && !a.startsWith('--dynconfig'));
const mapped = keep.map(map).map(a => (a.startsWith('-o') && a === '-o' ? a : a));
// the output goes to a folder inside Ubuntu
const oi = mapped.indexOf('-o');
mapped[oi + 1] = '/root/work/test-ld/link_wasm.elf';
fs.writeFileSync(`${HERE}/ld_args.txt`, mapped.join('\n') + '\n');
console.log('arguments for the WebAssembly ld:', mapped.length, '(objects and libraries included)');
console.log('first 6 :', mapped.slice(0, 6).join(' '));
console.log('libraries/objects mentioned:', mapped.filter(a => /\.(a|o)$/.test(a)).length);
const sha = (f) => { try { return require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch { return null; } };
