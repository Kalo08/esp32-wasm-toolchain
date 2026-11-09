// What the Arduino tools do to a .ino before compiling it: add `#include <Arduino.h>` and a prototype for each
// function, so a function can be called above where it's defined. Prototypes are generated only for functions
// whose return and parameter types are simple built-in types (a function taking your own struct is left alone: put
// those types and prototypes in the sketch yourself). The result is plain C++ for cppbuild.js's buildCpp().

const SIMPLE_TYPES = new Set(['void', 'int', 'long', 'short', 'float', 'double', 'bool', 'boolean', 'char', 'byte', 'String', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'size_t']);
const MODIFIERS = new Set(['unsigned', 'signed', 'const', 'static', 'volatile']);
// the base type of "const unsigned long* x" is "long"; null if it isn't one of the simple types
const baseType = (decl) => { const w = decl.replace(/[*&]/g, ' ').replace(/=.*/, '').trim().split(/\s+/).filter(x => !MODIFIERS.has(x)); const ty = w.length > 1 ? w.slice(0, -1).pop() : w[0]; return SIMPLE_TYPES.has(ty) || w.length === 0 ? ty || 'int' : null; };
export function inoToCpp(name, text) {
  const protos = [];
  const re = /^((?:static\s+)?(?:(?:unsigned|signed|const)\s+)*[A-Za-z_]\w*\s*\**)\s*\b([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gm;
  for (let m; (m = re.exec(text));) {
    if (['if', 'for', 'while', 'switch', 'return', 'else'].includes(m[2])) continue;
    const ret = m[1].replace(/\s+/g, ' ').trim();
    const params = m[3].split(',').map(s => s.trim()).filter(Boolean);
    const retBase = ret.replace(/[*&]/g, ' ').trim().split(/\s+/).filter(x => !MODIFIERS.has(x)).pop();
    if (!SIMPLE_TYPES.has(retBase)) continue;
    if (params.length && !(params.length === 1 && params[0] === 'void') && params.some(p => baseType(p) === null)) continue;
    protos.push(`${ret} ${m[2]}(${params.map(p => p.replace(/\s*=.*/, '')).join(', ')});`);
  }
  return `#include <Arduino.h>\n${protos.join('\n')}\n#line 1 "${name}.ino"\n${text}`;
}
