// Test Worker: blink -> flashable image entirely in the browser.
//   cc1plus.wasm (compile) -> as.wasm (assemble) -> ld.wasm (link against a "thin" SDK) -> elf2image.js (make the .bin)
importScripts('cc1plus.js', 'as.js', 'ld.js');
const log = (m) => postMessage({ type: 'log', m });
const T = {};
const lap = (k, t0) => { T[k] = +(((performance.now() - t0) / 1000).toFixed(2)); log(`${k}: ${T[k]} s`); };
const hex = (buf) => crypto.subtle.digest('SHA-256', buf).then(d => Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join(''));
const save = (name, bytes) => fetch('/save/' + name, { method: 'PUT', body: bytes });
function load(FS, manifest, bin) {
  const made = new Set();
  for (const f of manifest) {
    const dir = f.p.slice(0, f.p.lastIndexOf('/'));
    if (!made.has(dir)) { FS.mkdirTree(dir); made.add(dir); }
    FS.writeFile(f.p, new Uint8Array(bin, f.o, f.n));
  }
}
function run(m, args) {
  try { return m.callMain(args); } catch (e) { return e && e.status !== undefined ? e.status : 'exception: ' + e; }
}
onmessage = async () => {
  try {
    const tAll = performance.now();
    let t = performance.now();
    const [hdrMan, ccArgs, hdrBin, sdkMan, ldArgs, sdkBin] = await Promise.all([
      fetch('headers.json').then(r => r.json()), fetch('cc1_args.json').then(r => r.json()), fetch('headers.bin').then(r => r.arrayBuffer()),
      fetch('sdk_thin.json').then(r => r.json()), fetch('ld_args.json').then(r => r.json()), fetch('sdk_thin.bin').then(r => r.arrayBuffer())]);
    lap('fetch headers + SDK (' + ((hdrBin.byteLength + sdkBin.byteLength) / 1e6).toFixed(1) + ' MB)', t);

    // 1. compile
    t = performance.now();
    let ccOut = '';
    let cc = await createCc1plus({ print: s => { ccOut += s + '\n'; }, printErr: s => { ccOut += s + '\n'; } });
    load(cc.FS, hdrMan, hdrBin); cc.FS.mkdirTree('/root/work/test-min'); cc.FS.chdir('/root/work/test-min');
    const ccStatus = run(cc, ccArgs);
    const asm = cc.FS.readFile('/root/work/test-min/out.s');
    cc = null;
    lap('compile (cc1plus)', t);

    // 2. assemble
    t = performance.now();
    let a = await createAs({ print: () => {}, printErr: () => {} });
    a.FS.writeFile('/t.s', asm);
    const asStatus = run(a, ['--gdwarf-4', '--traditional-format', '--longcalls', '-o', '/t.o', '/t.s']);
    const obj = a.FS.readFile('/t.o');
    a = null;
    lap('assemble (as)', t);
    save('browser_out.o', obj);

    // 3. link
    t = performance.now();
    let ldOut = '';
    let ld = await createLd({ print: s => { ldOut += s + '\n'; }, printErr: s => { ldOut += s + '\n'; } });
    load(ld.FS, sdkMan, sdkBin); ld.FS.mkdirTree('/work'); ld.FS.writeFile('/work/sketch.o', obj);
    const ldStatus = run(ld, ldArgs);
    let elf = null; try { elf = ld.FS.readFile('/work/out.elf'); } catch (e) {}
    ld = null;
    lap('link (ld)', t);
    if (!elf) { postMessage({ type: 'done', ccStatus, asStatus, ldStatus, ldOut: ldOut.slice(-800), T }); return; }
    save('browser_out.elf', elf);

    // 4. flashable image
    t = performance.now();
    const { elf2image } = await import('./elf2image.js');
    const img = elf2image(elf, { chip: 'esp32s3', flashMode: 'dio', flashFreq: '80m', flashSize: '4MB', elfSha256Offset: 0xb0 });
    lap('make image (elf2image)', t);
    save('browser_out.bin', img);
    T.total = +(((performance.now() - tAll) / 1000).toFixed(1));
    postMessage({ type: 'done', ccStatus, asStatus, ldStatus, objBytes: obj.length, elfBytes: elf.length, imgBytes: img.length, elfSha: (await hex(elf)).slice(0, 16), imgSha: (await hex(img)).slice(0, 16), ldOut: ldOut.slice(-300), T });
  } catch (e) { postMessage({ type: 'error', m: String(e && e.stack || e) }); }
};
