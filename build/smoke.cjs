const create = require('/root/work/webtool/as.js');
(async () => {
  let out = '';
  const m = await create({ print: s => out += s + '\n', printErr: s => out += s + '\n' });
  m.FS.writeFile('/t.s', '.text\n.global f\nf:\n  entry a1, 16\n  retw.n\n');
  try { m.callMain(['--text-section-literals', '-o', '/t.o', '/t.s']); } catch (e) { out += 'EXC ' + (e.status ?? e) + '\n'; }
  const o = m.FS.readFile('/t.o');
  console.log('object bytes', o.length, out.trim());
})();
