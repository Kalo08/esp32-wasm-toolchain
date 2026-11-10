// Compare the flashable images two ELFs produce, without the embedded ELF hash (so debug-info differences don't count).
import fs from 'node:fs';
import { elf2image } from '../src/elf2image.js';
const [a, b] = process.argv.slice(2);
const o = { chip: 'esp32s3', flashMode: 'dio', flashFreq: '80m', flashSize: '4MB' };
const x = elf2image(new Uint8Array(fs.readFileSync(a)), o), y = elf2image(new Uint8Array(fs.readFileSync(b)), o);
let d = 0; for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) d++;
console.log(`images ${x.length} vs ${y.length} bytes; differing bytes: ${d}` + (d === 0 && x.length === y.length ? '  => IDENTICAL IMAGE' : ''));
