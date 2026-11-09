// ELF -> ESP32 flash image (src/elf2image.js): `npm test`
//  1. SHA-256 against Node's crypto
//  2. a small synthetic ELF: layout, alignment, checksum, digest
//  3. the real thing: the blink ELF and the .bin the native Espressif toolchain made from it must match byte
//     for byte. The .bin is in reference/; the 6.8 MB ELF isn't in the repo (see build/README.md to make it):
//     put it at reference/gt_blink.ino.elf, or set ELF2IMAGE_REF_DIR to the folder holding both. Without it
//     this part is skipped.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { elf2image, sha256 } from '../src/elf2image.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`${name}: ${e.message}`); }
}
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || 'values'}: got ${a}, expected ${b}`); };

test('sha256 matches node crypto', () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 1000, 100000]) {
    const d = new Uint8Array(n).map((_, i) => (i * 7 + 3) & 255);
    eq(Buffer.from(sha256(d)).toString('hex'), crypto.createHash('sha256').update(d).digest('hex'), 'length ' + n);
  }
});

// minimal ELF32 with PROGBITS sections: [{ addr, data }]
function makeElf(entry, secs) {
  const shstr = Buffer.from('\0.s\0');
  let off = 52;
  const datas = secs.map(s => { const o = off; off += s.data.length; return o; });
  const strOff = off; off += shstr.length;
  off = (off + 3) & ~3;
  const shoff = off, shnum = secs.length + 2;
  const b = Buffer.alloc(shoff + shnum * 40);
  b.write('\x7fELF', 0, 'latin1'); b[4] = 1; b[5] = 1; b[6] = 1;
  b.writeUInt32LE(entry, 0x18); b.writeUInt32LE(shoff, 0x20);
  b.writeUInt16LE(52, 0x28); b.writeUInt16LE(40, 0x2e); b.writeUInt16LE(shnum, 0x30); b.writeUInt16LE(shnum - 1, 0x32);
  secs.forEach((s, i) => { Buffer.from(s.data).copy(b, datas[i]); });
  shstr.copy(b, strOff);
  secs.forEach((s, i) => {
    const o = shoff + (i + 1) * 40;
    b.writeUInt32LE(1, o + 4); b.writeUInt32LE(3, o + 8); b.writeUInt32LE(s.addr, o + 12);
    b.writeUInt32LE(datas[i], o + 16); b.writeUInt32LE(s.data.length, o + 20);
  });
  const so = shoff + (shnum - 1) * 40;
  b.writeUInt32LE(3, so + 4); b.writeUInt32LE(strOff, so + 16); b.writeUInt32LE(shstr.length, so + 20);
  return new Uint8Array(b);
}

test('synthetic image: header, alignment, checksum, digest', () => {
  const fill = (n, v) => new Uint8Array(n).fill(v);
  const elf = makeElf(0x40375bfc, [
    { addr: 0x3c030020, data: fill(1000, 1) },   // flash data
    { addr: 0x3fc95200, data: fill(9001, 2) },   // RAM, odd length: padded to 4 and split to fill the gap
    { addr: 0x42000020, data: fill(5000, 3) },   // flash code
    { addr: 0x40374000, data: fill(100, 4) },    // RAM
  ]);
  const img = elf2image(elf, { chip: 'esp32s3' });
  const dv = new DataView(img.buffer);
  eq(img[0], 0xe9, 'magic'); eq(img[2], 2, 'dio'); eq(img[3], 0x2f, '4MB 80MHz'); eq(dv.getUint32(4, true), 0x40375bfc, 'entry');
  eq(dv.getUint16(12, true), 9, 'chip id'); eq(img[23], 1, 'digest flag');
  let off = 24, sum = 0xef;
  const segs = [];
  for (let i = 0; i < img[1]; i++) {
    const addr = dv.getUint32(off, true), len = dv.getUint32(off + 4, true);
    segs.push({ addr, len, at: off + 8 });
    for (let k = 0; k < len; k++) sum ^= img[off + 8 + k];
    off += 8 + len;
  }
  for (const s of segs) {
    eq(s.len % 4, 0, 'segment length multiple of 4');
    if (s.addr >= 0x3c000000 && s.addr < 0x3e000000 || s.addr >= 0x42000000 && s.addr < 0x44000000) eq(s.at % 0x10000, s.addr % 0x10000, 'flash segment alignment');
  }
  eq((off + (15 - off % 16) + 1) % 16, 0, 'row end');
  const ck = off + (15 - off % 16);
  eq(img[ck], sum, 'checksum');
  eq(Buffer.from(img.subarray(ck + 1)).toString('hex'), crypto.createHash('sha256').update(img.subarray(0, ck + 1)).digest('hex'), 'digest');
  eq(img.length, ck + 33, 'length');
});

test('rejects things that are not a 32-bit ELF', () => {
  let threw = false;
  try { elf2image(new Uint8Array(100)); } catch { threw = true; }
  eq(threw, true, 'threw');
});

const dir = process.env.ELF2IMAGE_REF_DIR || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'reference');
const elfPath = path.join(dir, 'gt_blink.ino.elf'), binPath = path.join(dir, 'gt_blink.ino.bin');
let skipped = '';
if (fs.existsSync(elfPath) && fs.existsSync(binPath)) {
  test('blink ELF becomes the same bytes as the native toolchain image', () => {
    const out = elf2image(new Uint8Array(fs.readFileSync(elfPath)), { chip: 'esp32s3', flashMode: 'dio', flashFreq: '80m', flashSize: '4MB', elfSha256Offset: 0xb0 });
    const ref = fs.readFileSync(binPath);
    eq(out.length, ref.length, 'length');
    for (let i = 0; i < ref.length; i++) if (out[i] !== ref[i]) throw new Error(`first difference at byte ${i}`);
  });
} else skipped = ' (reference ELF/.bin not found, native comparison skipped)';

if (failures.length) { console.log(failures.join('\n')); console.log(`${passed} passed, ${failures.length} FAILED`); process.exit(1); }
console.log(`${passed} passed${skipped}`);
