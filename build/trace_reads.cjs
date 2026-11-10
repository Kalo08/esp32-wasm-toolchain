// Preload for `node --require trace_reads.cjs ld-new ...`: records which byte ranges of every file the WebAssembly
// linker reads (it runs with NODERAWFS, so its file reads are Node fs reads). At exit it writes, per file, the set of
// touched 4 KB blocks, so a chunk size of any multiple of 4 KB can be evaluated afterwards.
const fs = require('fs');
const BLOCK = 4096;
const names = new Map();           // fd -> path
const pos = new Map();             // fd -> current position (for reads without an explicit position)
const touched = new Map();         // path -> Set of block indexes
const sizes = new Map();           // path -> file size
let reads = 0;

const origOpen = fs.openSync;
fs.openSync = function (p, ...rest) {
  const fd = origOpen.call(this, p, ...rest);
  if (typeof p === 'string') { names.set(fd, p); pos.set(fd, 0); }
  return fd;
};
const origClose = fs.closeSync;
fs.closeSync = function (fd) { names.delete(fd); pos.delete(fd); return origClose.call(this, fd); };
const origRead = fs.readSync;
fs.readSync = function (fd, buffer, offset, length, position) {
  const n = origRead.apply(this, arguments);
  const path = names.get(fd);
  if (path && n > 0) {
    let start = typeof position === 'number' ? position : pos.get(fd) || 0;
    if (typeof position !== 'number') pos.set(fd, start + n);
    let set = touched.get(path);
    if (!set) { set = new Set(); touched.set(path, set); try { sizes.set(path, fs.statSync(path).size); } catch (e) { /* ignore */ } }
    for (let b = Math.floor(start / BLOCK); b <= Math.floor((start + n - 1) / BLOCK); b++) set.add(b);
    reads++;
  }
  return n;
};
process.on('exit', () => {
  const out = { block: BLOCK, reads, files: {} };
  for (const [p, s] of touched) out.files[p] = { size: sizes.get(p) || 0, blocks: [...s].sort((a, b) => a - b) };
  fs.writeFileSync(process.env.TRACE_OUT || 'reads.json', JSON.stringify(out));
});
