// .ino -> C++ (src/ino.js): `npm test`
import { inoToCpp } from '../src/ino.js';
let failed = 0;
const check = (name, cond) => { if (!cond) { failed++; console.log('FAIL: ' + name); } };

const out = inoToCpp('blink', 'int n = 0;\nvoid setup() {\n  pinMode(2, OUTPUT);\n}\nvoid loop() {\n  flash(3, 100);\n}\nvoid flash(int times, unsigned long ms) {\n  digitalWrite(2, 1);\n}\nfloat avg(float* a, int n) { return 0; }\nMyType odd(MyType t) { return t; }\n');
check('starts with Arduino.h', out.startsWith('#include <Arduino.h>\n'));
check('prototype for setup', out.includes('void setup();'));
check('prototype for a function defined after use', out.includes('void flash(int times, unsigned long ms);'));
check('pointer parameter', out.includes('float avg(float* a, int n);'));
check('no prototype for a function using your own type', !/MyType odd\(MyType t\);/.test(out));
check('#line keeps error messages on your lines', out.includes('#line 1 "blink.ino"\nint n = 0;'));
check('control statements are not functions', !/\bif\s*\(/.test(inoToCpp('x', 'void loop() {\n  if (a) {\n  }\n}\n').split('#line')[0]));

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log('7 passed');
