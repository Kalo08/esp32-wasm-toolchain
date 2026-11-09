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

function loadFiles(FS, manifest, bin) {
  const made = new Set();
  for (const f of manifest) {
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
    stage('Downloading the compiler (cached after the first time)…');
    const get = async (name, kind = 'arrayBuffer') => {
      const r = await fetch(base + name, { cache: 'no-cache' }); // revalidate (ETag): never mix files from two toolchain builds
      if (!r.ok) throw new Error(`${name} isn't on this server (${r.status}). The in-browser compiler isn't installed here.`);
      return r[kind]();
    };
    const [args, hdrMan, sdkMan, hdrBin, sdkBin, boot, parts, app0] = await Promise.all([
      get('args.json', 'json'), get('headers.json', 'json'), get('sdk.json', 'json'), get('headers.bin'), get('sdk.bin'),
      get('bootloader.bin'), get('partitions.bin'), get('boot_app0.bin')]);
    importScripts(base + 'cc1plus.js', base + 'as.js', base + 'ld.js');

    // 1. compile
    stage('Compiling the C++ (the slowest step)…');
    let cc = await createCc1plus({ print: keep, printErr: keep, locateFile: (f) => base + f });
    loadFiles(cc.FS, hdrMan, hdrBin);
    cc.FS.mkdirTree(args.cwd); cc.FS.chdir(args.cwd);
    cc.FS.writeFile('/work/main.cpp', e.data.code);
    const ccStatus = callMain(cc, args.cc1);
    let asm = null; try { asm = cc.FS.readFile('/work/out.s'); } catch { /* compile failed */ }
    cc = null;
    if (ccStatus !== 0 || !asm) return fail('The C++ didn\'t compile.');

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
    ld.FS.mkdirTree('/work'); ld.FS.writeFile('/work/sketch.o', obj);
    const ldStatus = callMain(ld, args.ld);
    let elf = null; try { elf = ld.FS.readFile('/work/out.elf'); } catch { /* failed */ }
    ld = null;
    if (ldStatus !== 0 || !elf) {
      const missing = /undefined reference to/.test(log);
      return fail(missing
        ? 'The linker needs ESP32 libraries that the in-browser compiler doesn\'t include yet (this build covers the Arduino core, Serial, the pins and PWM). A library or feature like WiFi needs the desktop app.'
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
