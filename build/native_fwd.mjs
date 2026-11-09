// sketch.s with the one Windows-style .file path rewritten to forward slashes, assembled by the NATIVE assembler
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const REF = 'C:/work/wasm/ref';
const lines = fs.readFileSync(`${REF}/sketch.s`, 'utf8').split('\n');
let changed = 0;
const fixed = lines.map(l => (/^\s*\.file\s+\d+\s+"/.test(l) && l.includes('\\\\') ? (changed++, l.replace(/\\\\/g, '/')) : l));
fs.writeFileSync(`${REF}/sketch_fwd.s`, fixed.join('\n'));
console.log('rewrote', changed, '.file line(s)');
const T = 'C:/Users/USER/AppData/Local/Arduino15/packages/esp32/tools/esp-x32/2601';
const r = spawnSync(`${T}/xtensa-esp-elf/bin/as.exe`, ['--gdwarf-4', '--traditional-format', '--longcalls', '--dynconfig=xtensa_esp32s3.so', '-o', 'sketch_fwd_native.o', 'sketch_fwd.s'],
  { cwd: REF, encoding: 'utf8', env: { ...process.env, XTENSA_GNU_CONFIG: `${T}/lib/xtensa_esp32s3.so` } });
console.log('native assemble: exit', r.status, (r.stderr || '').slice(0, 200));
console.log('sketch_fwd_native.o:', fs.statSync(`${REF}/sketch_fwd_native.o`).size, 'bytes');
