// The in-browser C++ compile's pure logic: `npm test`
//  1. which optional libraries (feature packs) a sketch needs, from its #include lines
//  2. how they change the compiler and linker arguments, and which SDK variant is loaded
//  3. the messages for a missing header; .ino preprocessing (prototypes and #include <Arduino.h>)
import assert from 'node:assert/strict';
import { includedHeaders, detectFeatures, sdkFor, withLibraryIncludes, withLibraryObjects, missingHeader, coverageText } from '../src/cppfeatures.js';
import { inoToCpp } from '../src/ino.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push(`${name}: ${e.message}`); }
}

// the same shape as the toolchain's args.json `features`
const F = {
  wifi: { label: 'WiFi', requires: [], headers: ['WiFi.h', 'WiFiClient.h', 'WiFiUdp.h'], includes: ['/lib/WiFi/src', '/lib/Network/src'], objects: ['/lib/WiFi/a.o', '/lib/Network/b.o'], sdk: 'sdk-wifi' },
  http: { label: 'HTTP and HTTPS clients', requires: ['wifi'], headers: ['HTTPClient.h', 'NetworkClientSecure.h'], includes: ['/lib/HTTPClient/src'], objects: ['/lib/HTTPClient/c.o'], sdk: 'sdk-wifi' },
  ble: { label: 'BLE', requires: [], headers: ['BLEDevice.h', 'BLEServer.h'], includes: ['/lib/BLE/src'], objects: ['/lib/BLE/d.o'], sdk: 'sdk' },
};

test('#include forms: <>, "" and a folder path', () => {
  const names = includedHeaders('#include <WiFi.h>\n  #  include "BLEDevice.h"\n#include <esp32/rom/ets_sys.h>\n');
  assert.deepEqual([...names].sort(), ['BLEDevice.h', 'WiFi.h', 'ets_sys.h']);
});
test('includes inside comments are ignored', () => {
  assert.deepEqual(detectFeatures('// #include <WiFi.h>\n/* #include <BLEDevice.h> */\nvoid setup(){}\n', F), []);
});
test('a plain sketch loads no feature and the small SDK', () => {
  const a = detectFeatures('#include <Arduino.h>\nvoid setup(){}\n', F);
  assert.deepEqual(a, []);
  assert.equal(sdkFor(a, F), 'sdk');
});
test('WiFi.h loads wifi and the large SDK', () => {
  const a = detectFeatures('#include <WiFi.h>\n', F);
  assert.deepEqual(a, ['wifi']);
  assert.equal(sdkFor(a, F), 'sdk-wifi');
});
test('HTTPClient.h pulls in wifi too, in manifest order', () => {
  assert.deepEqual(detectFeatures('#include <HTTPClient.h>\n', F), ['wifi', 'http']);
  assert.deepEqual(detectFeatures('#include <HTTPClient.h>\n#include <WiFi.h>\n', F), ['wifi', 'http']);
});
test('BLE alone keeps the small SDK; BLE with WiFi needs the large one', () => {
  const a = detectFeatures('#include <BLEDevice.h>\n', F);
  assert.deepEqual(a, ['ble']); assert.equal(sdkFor(a, F), 'sdk');
  const b = detectFeatures('#include <BLEDevice.h>\n#include <WiFi.h>\n', F);
  assert.deepEqual(b, ['wifi', 'ble']); assert.equal(sdkFor(b, F), 'sdk-wifi');
});
test('an unknown library activates nothing; no features in the manifest is fine', () => {
  assert.deepEqual(detectFeatures('#include <Wire.h>\n', F), []);
  assert.deepEqual(detectFeatures('#include <WiFi.h>\n', {}), []);
});

const cc = ['-quiet', '-I', '/a/cores/esp32', '-I', '/x/variants/sparkfun_esp32s3_thing_plus', '-D', 'X=1', '/work/main.cpp'];
test('library include folders go right after the variant folder, once each', () => {
  const out = withLibraryIncludes(cc, ['wifi', 'http'], F);
  const at = out.indexOf('/x/variants/sparkfun_esp32s3_thing_plus');
  assert.deepEqual(out.slice(at + 1, at + 7), ['-I', '/lib/WiFi/src', '-I', '/lib/Network/src', '-I', '/lib/HTTPClient/src']);
  assert.equal(out.length, cc.length + 6);
  assert.equal(cc.length, 8, 'the input is not changed');
});
test('no features leaves the compiler arguments as they were', () => {
  assert.deepEqual(withLibraryIncludes(cc, [], F), cc);
});
const ld = ['-o', '/work/out.elf', '/work/sketch.o', '/x/core.a'];
test('library objects go right after the sketch object, in order', () => {
  assert.deepEqual(withLibraryObjects(ld, ['wifi', 'ble'], F), ['-o', '/work/out.elf', '/work/sketch.o', '/lib/WiFi/a.o', '/lib/Network/b.o', '/lib/BLE/d.o', '/x/core.a']);
  assert.deepEqual(withLibraryObjects(ld, [], F), ld);
});

test('a missing header is named in the message', () => {
  assert.equal(missingHeader('x.cpp:1:10: fatal error: Adafruit_GFX.h: No such file or directory\n'), 'Adafruit_GFX.h');
  assert.equal(missingHeader('fatal error: sub/dir/Foo.hpp: No such file or directory'), 'sub/dir/Foo.hpp');
  assert.equal(missingHeader('error: something else'), null);
  assert.equal(missingHeader(undefined), null);
});
test('the coverage text lists what the toolchain ships', () => {
  assert.equal(coverageText({}), 'the Arduino core, Serial, pins and PWM');
  assert.match(coverageText(F), /WiFi, HTTP and HTTPS clients, BLE$/);
});

// ---------- .ino -> C++ ----------
test('.ino: Arduino.h first, prototypes for functions defined after use, #line keeps error lines', () => {
  const out = inoToCpp('blink', 'int n = 0;\nvoid setup() {\n}\nvoid loop() {\n  flash(3, 100);\n}\nvoid flash(int times, unsigned long ms) {\n}\n');
  assert.ok(out.startsWith('#include <Arduino.h>\n'));
  assert.ok(out.includes('void setup();') && out.includes('void loop();'));
  assert.ok(out.includes('void flash(int times, unsigned long ms);'));
  assert.ok(out.includes('#line 1 "blink.ino"\nint n = 0;'));
});
test('.ino: pointer parameters get prototypes; your own types are left alone', () => {
  const out = inoToCpp('x', 'float avg(float* a, int n) { return 0; }\nMyType odd(MyType t) { return t; }\n');
  assert.ok(out.includes('float avg(float* a, int n);'));
  assert.ok(!/MyType odd\(MyType t\);/.test(out));
});
test('.ino: if/for/while are not functions', () => {
  const pre = inoToCpp('x', 'void loop() {\n  if (a) {\n  }\n  while (b) {\n  }\n}\n').split('#line')[0];
  assert.ok(!/\b(if|while|for)\s*\(/.test(pre));
});

if (failures.length) { console.log(failures.join('\n')); console.log(`${passed} passed, ${failures.length} FAILED`); process.exit(1); }
console.log(`${passed} in-browser compile tests passed`);
