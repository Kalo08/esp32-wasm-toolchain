// Which optional libraries (WiFi, HTTP, BLE...) does a sketch use, and how do they change the compile and the link?
// Pure functions, so they can be tested in Node; the Worker (cppworker.js) imports them. The data comes from the
// toolchain's args.json `features` section: { <name>: { label, requires: [], headers: [file names], includes: [paths],
// objects: [paths], sdk } }.

// the file names a sketch #includes ("WiFi.h", from <WiFi.h>, "WiFi.h" or <sub/WiFi.h>), comments excluded
export function includedHeaders(code) {
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const names = new Set();
  for (const m of stripped.matchAll(/^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm)) names.add(m[1].split('/').pop());
  return names;
}

// the features to load, in the manifest's order (that is the link order), with what they require
export function detectFeatures(code, features) {
  const names = includedHeaders(code);
  const on = new Set();
  const add = (f) => { if (on.has(f) || !features[f]) return; on.add(f); for (const r of features[f].requires || []) add(r); };
  for (const [f, spec] of Object.entries(features)) if ((spec.headers || []).some(h => names.has(h))) add(f);
  return Object.keys(features).filter(f => on.has(f));
}

// the SDK variant to load: the larger one when any active feature needs it
export const sdkFor = (active, features) => (active.some(f => features[f].sdk === 'sdk-wifi') ? 'sdk-wifi' : 'sdk');

// the compiler arguments with the libraries' include folders right after the board's variant folder, as the Arduino tools put them
export function withLibraryIncludes(ccArgs, active, features) {
  const out = ccArgs.slice();
  const extra = [...new Set(active.flatMap(f => features[f].includes || []))].flatMap(p => ['-I', p]);
  const at = out.findIndex(a => a.endsWith('/variants/sparkfun_esp32s3_thing_plus'));
  if (at >= 0 && extra.length) out.splice(at + 1, 0, ...extra);
  return out;
}

// the linker arguments with the libraries' objects right after the sketch's, in the manifest's order
export function withLibraryObjects(ldArgs, active, features, sketch = '/work/sketch.o') {
  const out = ldArgs.slice();
  const objs = active.flatMap(f => features[f].objects || []);
  const at = out.indexOf(sketch);
  if (at >= 0 && objs.length) out.splice(at + 1, 0, ...objs);
  return out;
}

// "fatal error: Foo.h: No such file or directory" in the compiler's messages: the header's name, or null
export function missingHeader(log) {
  const m = /fatal error: ([\w./+-]+): No such file or directory/.exec(log || '');
  return m ? m[1] : null;
}

// what the compiler covers, for messages
export function coverageText(features) {
  const labels = Object.values(features || {}).map(f => f.label).filter(Boolean);
  return 'the Arduino core, Serial, pins and PWM' + (labels.length ? ', ' + labels.join(', ') : '');
}
