// ELF -> flashable ESP32 app image, the job `esptool elf2image` does after the linker.
// Pure JavaScript with no dependencies, so it runs in the browser (a Worker) and in Node.
// Written from esptool's behaviour and checked byte-for-byte against the image the real toolchain
// makes for the same ELF (tests/elf2image.js).
//
//   elf2image(elfBytes, { chip: 'esp32s3', flashMode: 'dio', flashFreq: '80m', flashSize: '4MB',
//                         elfSha256Offset: 0xb0 })  ->  Uint8Array
//
// Image layout: 8-byte header, 16-byte extended header, then segments (address, length, data), padding,
// one XOR checksum byte at the end of a 16-byte row, and a SHA-256 of everything before it.
// Segments that live in flash (the MMU maps them in 64 KB pages) must sit at a file offset that has the
// same low 16 bits as their address, so RAM segments are used to fill the gap, split when too long.

const CHIPS = {
  esp32: { id: 0x0000, flash: [[0x3f400000, 0x3fc00000], [0x400d0000, 0x40400000]] },
  esp32s2: { id: 0x0002, flash: [[0x3f000000, 0x3ff80000], [0x40080000, 0x40b80000]] },
  esp32s3: { id: 0x0009, flash: [[0x3c000000, 0x3e000000], [0x42000000, 0x44000000]] },
  esp32c3: { id: 0x0005, flash: [[0x3c000000, 0x3c800000], [0x42000000, 0x42800000]] },
};
const FLASH_MODES = { qio: 0, qout: 1, dio: 2, dout: 3 };
const FLASH_FREQS = { '80m': 0xf, '40m': 0x0, '26m': 0x1, '20m': 0x2 };
const FLASH_SIZES = { '1MB': 0x00, '2MB': 0x10, '4MB': 0x20, '8MB': 0x30, '16MB': 0x40, '32MB': 0x50, '64MB': 0x60, '128MB': 0x70 };
const IMAGE_MAGIC = 0xe9, CHECKSUM_INIT = 0xef, ALIGN = 0x10000, SEG_HDR = 8;

// ---------- SHA-256 ----------
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

export function sha256(data) {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const n = data.length, padded = new Uint8Array(((n + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[n] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(n / 0x20000000));
  dv.setUint32(padded.length - 4, (n << 3) >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x, k) => (x >>> k) | (x << (32 - k));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}

// ---------- ELF32 little-endian: the sections that get loaded ----------
function readElf(elf) {
  const dv = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  if (elf.length < 52 || dv.getUint32(0, false) !== 0x7f454c46) throw new Error('not an ELF file');
  if (elf[4] !== 1 || elf[5] !== 1) throw new Error('expected a 32-bit little-endian ELF (Xtensa/RISC-V ESP32)');
  const entry = dv.getUint32(0x18, true), shoff = dv.getUint32(0x20, true);
  const shentsize = dv.getUint16(0x2e, true), shnum = dv.getUint16(0x30, true);
  const sections = [];
  for (let i = 0; i < shnum; i++) {
    const o = shoff + i * shentsize;
    const type = dv.getUint32(o + 4, true), flags = dv.getUint32(o + 8, true);
    const addr = dv.getUint32(o + 12, true), offset = dv.getUint32(o + 16, true), size = dv.getUint32(o + 20, true);
    // PROGBITS, INIT_ARRAY, FINI_ARRAY that occupy memory
    if ((type === 1 || type === 14 || type === 15) && (flags & 2) && addr !== 0 && size > 0) {
      sections.push({ addr, data: elf.slice(offset, offset + size) });
    }
  }
  return { entry, sections };
}

const concat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
const pad4 = (d) => (d.length % 4 ? concat(d, new Uint8Array(4 - (d.length % 4))) : d);

function mergeAdjacent(segs) {
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.addr + last.data.length === s.addr) last.data = concat(last.data, s.data);
    else out.push({ addr: s.addr, data: s.data });
  }
  return out;
}

export function elf2image(elfBytes, opts = {}) {
  const chip = CHIPS[opts.chip || 'esp32s3'];
  if (!chip) throw new Error('unknown chip: ' + opts.chip);
  const mode = FLASH_MODES[opts.flashMode || 'dio'], freq = FLASH_FREQS[opts.flashFreq || '80m'], size = FLASH_SIZES[opts.flashSize || '4MB'];
  if (mode === undefined || freq === undefined || size === undefined) throw new Error('bad flash mode, frequency or size');
  const isFlash = (a) => chip.flash.some(([lo, hi]) => a >= lo && a < hi);

  const { entry, sections } = readElf(elfBytes);
  sections.sort((a, b) => a.addr - b.addr);
  const flashSegs = mergeAdjacent(sections.filter(s => isFlash(s.addr)));
  const ramSegs = mergeAdjacent(sections.filter(s => !isFlash(s.addr)));
  for (const s of flashSegs.concat(ramSegs)) s.data = pad4(s.data);

  const parts = [];            // written segments, in file order
  let pos = 8 + 16;            // after the two headers
  const emit = (addr, data) => { parts.push({ addr, data, at: pos + SEG_HDR }); pos += SEG_HDR + data.length; };

  while (flashSegs.length) {
    const f = flashSegs[0];
    if ((pos + SEG_HDR) % ALIGN === f.addr % ALIGN) {
      // ESP-IDF's bootloader skips the last MMU page of a flash segment that ends < 0x24 bytes into it
      const rem = (pos + SEG_HDR + f.data.length) % ALIGN;
      if (rem < 0x24) f.data = concat(f.data, new Uint8Array(0x24 - rem));
      emit(f.addr, f.data);
      flashSegs.shift();
      continue;
    }
    // bytes of filler (one segment header plus data) that bring the next flash segment onto its alignment
    let n = ((f.addr % ALIGN) - pos - 2 * SEG_HDR) % ALIGN;
    if (n < 0) n += ALIGN;
    if (n === 0) n = ALIGN;
    if (ramSegs.length) {
      const r = ramSegs[0];
      if (r.data.length > n) {
        emit(r.addr, r.data.slice(0, n));
        ramSegs[0] = { addr: r.addr + n, data: r.data.slice(n) };
      } else { emit(r.addr, r.data); ramSegs.shift(); }
    } else emit(0, new Uint8Array(n));
  }
  for (const r of ramSegs) emit(r.addr, r.data);

  // zero padding up to the last byte of a 16-byte row, which holds the checksum; then 32 bytes of SHA-256
  const padLen = 15 - (pos % 16);
  const total = pos + padLen + 1 + 32;
  const img = new Uint8Array(total), dv = new DataView(img.buffer);
  img[0] = IMAGE_MAGIC; img[1] = parts.length; img[2] = mode; img[3] = size | freq;
  dv.setUint32(4, entry, true);
  img[8] = 0xee;                       // WP pin: disabled
  dv.setUint16(12, chip.id, true);     // chip id
  dv.setUint16(17, 0xffff, true);      // max chip revision
  img[23] = 1;                         // a SHA-256 digest follows the checksum
  for (const p of parts) {
    dv.setUint32(p.at - 8, p.addr, true);
    dv.setUint32(p.at - 4, p.data.length, true);
    img.set(p.data, p.at);
  }
  if (opts.elfSha256Offset !== undefined) img.set(sha256(elfBytes), opts.elfSha256Offset); // app descriptor
  let sum = CHECKSUM_INIT;
  for (const p of parts) for (let i = 0; i < p.data.length; i++) sum ^= img[p.at + i];
  img[pos + padLen] = sum;
  img.set(sha256(img.subarray(0, pos + padLen + 1)), pos + padLen + 1);
  return img;
}
