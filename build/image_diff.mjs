import fs from 'node:fs';
import { elf2image } from '../src/elf2image.js';
const [a, b] = process.argv.slice(2);
const o = { chip: 'esp32s3', flashMode: 'dio', flashFreq: '80m', flashSize: '4MB' };
const x = elf2image(new Uint8Array(fs.readFileSync(a)), o), y = elf2image(new Uint8Array(fs.readFileSync(b)), o);
const offs = []; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) offs.push(i);
const tail = x.length - 33;                    // checksum byte + 32-byte digest at the end
const body = offs.filter(i => i < tail), end = offs.filter(i => i >= tail);
console.log('differing bytes before the checksum:', body.length, '=> offsets', body.join(','), '| in checksum+digest:', end.length);
const s = (arr, i) => Buffer.from(arr.slice(Math.max(0, i - 6), i + 10)).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
if (body.length) console.log('  ours  :', s(x, body[0]), '\n  native:', s(y, body[0]));
