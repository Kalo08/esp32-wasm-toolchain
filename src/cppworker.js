// C++ for the ESP32-S3, compiled inside the browser (a Web Worker, so the page stays responsive).
// The same four steps the Arduino IDE runs, with Espressif's GCC 14.2 and binutils 2.43 built as WebAssembly:
//   cc1plus (C++ -> assembly)  ->  as (-> object)  ->  ld (+ the SDK libraries -> ELF)  ->  elf2image (-> flashable image)
// The tools and libraries are static files served from `base` (see ../README.md for how they are made).
//
//   in:  { type: 'build', code, base }   base: URL of the folder holding the toolchain files, ending in /          out: { type: 'stage', text } ... then { type: 'done', images, seconds }
//                                                       or { type: 'error', error, log }

const post = (m) => postMessage(m);
let log = '';
const keep = (s) => { log += s + '\n'; };

// Which optional libraries does the sketch use? Match its #include lines against each feature's header names.
// Returns the features to load, in the manifest's order (that is the link order), with what they require.
function detectFeatures(code, features) {
  const names = new Set();
  for (const m of code.matchAll(/^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm)) names.add(m[1].split('/').pop());
  const on = new Set();
  const add = (f) => { if (on.has(f) || !features[f]) return; on.add(f); for (const r of features[f].requires || []) add(r); };
  for (const [f, spec] of Object.entries(features)) if ((spec.headers || []).some(h => names.has(h))) add(f);
  return Object.keys(features).filter(f => on.has(f));
}

function loadFiles(FS, manifest, bin, want = () => true) {
  const made = new Set();
  for (const f of manifest) {
    if (!want(f.p)) continue;
    const dir = f.p.slice(0, f.p.lastIndexOf('/'));
    if (!made.has(dir)) { FS.mkdirTree(dir); made.add(dir); }
    FS.writeFile(f.p, new Uint8Array(bin, f.o, f.n));
  }
}
function callMain(m, args) {
  try { return m.callMain(args) || 0; } catch (e) { return e && e.status !== undefined ? e.status : 1; }
}
// show paths as the board package has them: /root/work/win/Users/... -> Users/..., /work/main.cpp -> main.cpp
const tidy = (s) => s.split('/root/work/win/').join('').split('/work/').join('').replace(/^warning: unsupported syscall: __syscall_prlimit64\n/gm, '').trim();

onmessage = async (e) => {
  if (!e.data || e.data.type !== 'build') return;
  log = '';
  const t0 = performance.now();
  const base = e.data.base;
  const stage = (text) => post({ type: 'stage', text });
  const fail = (error) => post({ type: 'error', error, log: tidy(log) });
  try {
    const get = async (name, kind = 'arrayBuffer') => {
      const r = await fetch(base + name, { cache: 'no-cache' }); // revalidate (ETag): never mix files from two toolchain builds
      if (!r.ok) throw new Error(`${name} isn't on this server (${r.status}). The in-browser compiler isn't installed here.`);
      return r[kind]();
    };
    const args = await get('args.json', 'json');
    // optional libraries (WiFi, HTTP, BLE...): load a feature's pack only when the sketch #includes one of its headers
    const features = args.features || {};
    const active = detectFeatures(e.data.code, features);
    const sdk = active.some(f => features[f].sdk === 'sdk-wifi') ? 'sdk-wifi' : 'sdk';
    const labels = Object.values(features).map(f => f.label).filter(Boolean);
    const supported = 'the Arduino core, Serial, pins and PWM' + (labels.length ? ', ' + labels.join(', ') : '');
    stage(active.length ? `Downloading the compiler and ${active.map(f => features[f].label || f).join(', ')} (cached after the first time)…`
      : 'Downloading the compiler (cached after the first time)…');
    const [hdrMan, sdkMan, hdrBin, sdkBin, boot, parts, app0, ...packFiles] = await Promise.all([
      get('headers.json', 'json'), get(sdk + '.json', 'json'), get('headers.bin'), get(sdk + '.bin'),
      get('bootloader.bin'), get('partitions.bin'), get('boot_app0.bin'),
      ...active.flatMap(f => [get(`pack-${f}.json`, 'json'), get(`pack-${f}.bin`)])]);
    importScripts(base + 'cc1plus.js', base + 'as.js', base + 'ld.js');

    // 1. compile
    stage('Compiling the C++ (the slowest step)…');
    let cc = await createCc1plus({ print: keep, printErr: keep, locateFile: (f) => base + f });
    loadFiles(cc.FS, hdrMan, hdrBin);
    for (let i = 0; i < active.length; i++) loadFiles(cc.FS, packFiles[2 * i], packFiles[2 * i + 1], (p) => !p.startsWith('/lib/')); // headers
    cc.FS.mkdirTree(args.cwd); cc.FS.chdir(args.cwd);
    cc.FS.writeFile('/work/main.cpp', e.data.code);
    // the libraries' include folders go right after the board's variant folder, as the Arduino tools put them
    const ccArgs = args.cc1.slice();
    const at = ccArgs.findIndex(a => a.endsWith('/variants/sparkfun_esp32s3_thing_plus'));
    const extraInc = [...new Set(active.flatMap(f => features[f].includes || []))].flatMap(p => ['-I', p]);
    if (at >= 0 && extraInc.length) ccArgs.splice(at + 1, 0, ...extraInc);
    const ccStatus = callMain(cc, ccArgs);
    let asm = null; try { asm = cc.FS.readFile('/work/out.s'); } catch { /* compile failed */ }
    cc = null;
    if (ccStatus !== 0 || !asm) {
      const noHeader = /fatal error: ([\w./+-]+): No such file or directory/.exec(log);
      return fail(noHeader
        ? `This sketch uses ${noHeader[1]}, a library the in-browser compiler doesn't include yet. It covers ${supported}. Other libraries need the desktop app.`
        : 'The C++ didn\'t compile.');
    }

    // 2. assemble
    stage('Assembling…');
    let as = await createAs({ print: keep, printErr: keep, locateFile: (f) => base + f });
    as.FS.writeFile('/t.s', asm);
    const asStatus = callMain(as, [...args.as, '-o', '/t.o', '/t.s']);
    let obj = null; try { obj = as.FS.readFile('/t.o'); } catch { /* failed */ }
    as = null;
    if (asStatus !== 0 || !obj) return fail('The assembler stopped.');

    // 3. link with the ESP32 libraries
    stage('Linking with the ESP32 libraries…');
    let ld = await createLd({ print: keep, printErr: keep, locateFile: (f) => base + f });
    loadFiles(ld.FS, sdkMan, sdkBin);
    for (let i = 0; i < active.length; i++) loadFiles(ld.FS, packFiles[2 * i], packFiles[2 * i + 1], (p) => p.startsWith('/lib/')); // library objects
    ld.FS.mkdirTree('/work'); ld.FS.writeFile('/work/sketch.o', obj);
    // the libraries' objects are linked right after the sketch's, in the Arduino tools' order
    const ldArgs = args.ld.slice();
    const objs = active.flatMap(f => features[f].objects || []);
    const sk = ldArgs.indexOf('/work/sketch.o');
    if (sk >= 0 && objs.length) ldArgs.splice(sk + 1, 0, ...objs);
    const ldStatus = callMain(ld, ldArgs);
    let elf = null; try { elf = ld.FS.readFile('/work/out.elf'); } catch { /* failed */ }
    ld = null;
    if (ldStatus !== 0 || !elf) {
      const missing = /undefined reference to/.test(log);
      return fail(missing
        ? `The linker needs ESP32 libraries that the in-browser compiler doesn't include yet (this build covers ${supported}). Other libraries and features need the desktop app.`
        : 'The linker stopped.');
    }

    // 4. make the flashable image
    stage('Making the flash image…');
    const { elf2image } = await import('./elf2image.js');
    const f = args.flash;
    const app = elf2image(elf, { chip: f.chip, flashMode: f.mode, flashFreq: f.freq, flashSize: f.size, elfSha256Offset: f.elfSha256Offset });
    post({
      type: 'done',
      seconds: Math.round((performance.now() - t0) / 100) / 10,
      images: [
        { address: 0x0, data: new Uint8Array(boot) },
        { address: 0x8000, data: new Uint8Array(parts) },
        { address: 0xe000, data: new Uint8Array(app0) },
        { address: 0x10000, data: app },
      ],
    });
  } catch (err) {
    fail(String(err && err.message || err));
  }
};
