// From the captured sketch-compile command: produce sketch.s (compiler output, -S) with the native
// compiler, then assemble it with the NATIVE assembler (using the captured `as` flags) to get the
// reference object file the WebAssembly assembler must match.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const GT = 'C:/work/ground-truth';
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

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
const re = [];
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '-MMD') continue;
  if (a === '-MF') { i++; continue; }
  if (a === '-c') { re.push('-S'); continue; }
  if (a === '-o') { re.push('-o', path.join(OUT, 'sketch.s')); i++; continue; }
  re.push(a);
}
let r = spawnSync(args[0], re, { encoding: 'utf8', maxBuffer: 1 << 28, cwd: path.dirname(GT) });
console.log('compile to assembly: exit', r.status, r.stderr ? r.stderr.slice(0, 300) : '');
const s = fs.readFileSync(path.join(OUT, 'sketch.s'), 'utf8');
console.log('sketch.s:', s.length, 'bytes,', s.split('\n').length, 'lines');

// the captured assembler invocation (flags only)
const asLine = fs.readFileSync(`${GT}/1_sketch_compile_as_command.txt`, 'utf8').trim();
const asArgs = tokenize(asLine);
const asExe = asArgs[0];
const flags = asArgs.slice(1, asArgs.indexOf('-o'));
console.log('assembler flags:', flags.join(' '));
fs.writeFileSync(path.join(OUT, 'as_flags.txt'), flags.filter(f => !f.startsWith('--dynconfig')).join(' '));
// native: same flags INCLUDING --dynconfig, from inside OUT with relative names
// (the compiler driver normally sets XTENSA_GNU_CONFIG to the folder holding xtensa_esp32s3.so)
const cfgDir = path.join(path.dirname(path.dirname(asExe.split('/xtensa-esp-elf/')[0])), 'lib').replace(/\\/g, '/');
r = spawnSync(asExe, [...flags, '-o', 'sketch_native.o', 'sketch.s'], { encoding: 'utf8', cwd: OUT, env: { ...process.env, XTENSA_GNU_CONFIG: cfgDir + '/xtensa_esp32s3.so' } });
console.log('XTENSA_GNU_CONFIG =', cfgDir);
console.log('native assemble: exit', r.status, (r.stderr || '').slice(0, 300));
console.log('sketch_native.o:', fs.statSync(path.join(OUT, 'sketch_native.o')).size, 'bytes');
