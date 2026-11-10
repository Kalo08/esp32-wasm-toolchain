// What the Arduino tools do to a .ino before compiling it: add `#include <Arduino.h>` and a prototype for each
// function, so a function can be called above where it's defined. The prototypes go after the sketch's own #include and
// #define lines (so library types like SPIClass are known) and before its first declaration or function. A function gets a
// prototype unless it mentions a type the sketch itself defines (a prototype placed before that type would not compile:
// put such types and prototypes in the sketch yourself) or uses templates. The result is plain C++ for cppbuild.js's buildCpp().

const MODIFIERS = new Set(['unsigned', 'signed', 'const', 'static', 'volatile', 'struct', 'class', 'enum', 'inline', 'extern']);
const BUILTIN = new Set(['void', 'int', 'long', 'short', 'float', 'double', 'bool', 'boolean', 'char', 'byte', 'String', 'size_t']);

// the line to insert prototypes before: the first one that is not blank, a comment or a preprocessor line
// (a continued #define line counts as preprocessor)
function insertionLine(lines) {
  let inComment = false, continued = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (continued) { continued = l.endsWith('\\'); continue; }
    if (inComment) { if (l.includes('*/')) inComment = false; continue; }
    if (l === '' || l.startsWith('//')) continue;
    if (l.startsWith('/*')) { if (!l.includes('*/')) inComment = true; continue; }
    if (l.startsWith('#')) { continued = l.endsWith('\\'); continue; }
    return i;
  }
  return lines.length;
}

// names of the types the sketch defines itself: struct, class, enum, union, typedef and using
function userTypes(text) {
  const names = new Set();
  for (const m of text.matchAll(/\b(?:struct|class|union|enum(?:\s+class)?)\s+(\w+)/g)) names.add(m[1]);
  for (const m of text.matchAll(/\btypedef\b[^;{]*?(\w+)\s*;/g)) names.add(m[1]);
  for (const m of text.matchAll(/\btypedef\s+(?:struct|enum|union|class)[^{;]*\{[\s\S]*?\}\s*(\w+)\s*;/g)) names.add(m[1]);
  for (const m of text.matchAll(/\busing\s+(\w+)\s*=/g)) names.add(m[1]);
  return names;
}

// the type word of "const unsigned long* x" is "long"; of "SPIClass *spi" is "SPIClass"
function typeWord(decl) {
  const w = decl.replace(/=.*/, '').replace(/[*&]/g, ' ').trim().split(/\s+/).filter(x => !MODIFIERS.has(x));
  return w.length > 1 ? w[w.length - 2] : (w[0] || 'int');
}

export function inoToCpp(name, text) {
  const lines = text.split('\n');
  const at = insertionLine(lines);
  const mine = userTypes(text);
  const protos = [];
  const re = /^((?:static\s+|inline\s+)?(?:(?:unsigned|signed|const)\s+)*[A-Za-z_]\w*\s*\**)\s*\b([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gm;
  for (let m; (m = re.exec(text));) {
    if (['if', 'for', 'while', 'switch', 'return', 'else'].includes(m[2])) continue;
    const ret = m[1].replace(/\s+/g, ' ').trim();
    const params = m[3].split(',').map(s => s.trim()).filter(Boolean);
    if (params.some(p => /[<>(]/.test(p)) || /[<>]/.test(ret)) continue;
    const retType = typeWord(ret + ' x');
    const okType = (ty) => BUILTIN.has(ty) || (/^[A-Za-z_]\w*$/.test(ty) && !mine.has(ty));
    if (!okType(retType)) continue;
    if (!(params.length === 1 && params[0] === 'void') && params.some(p => !okType(typeWord(p)))) continue;
    protos.push(`${ret} ${m[2]}(${params.map(p => p.replace(/\s*=.*/, '')).join(', ')});`);
  }
  const head = lines.slice(0, at).join('\n');
  const rest = lines.slice(at).join('\n');
  return `#include <Arduino.h>\n#line 1 "${name}.ino"\n${head}${at ? '\n' : ''}${protos.join('\n')}${protos.length ? '\n' : ''}#line ${at + 1} "${name}.ino"\n${rest}`;
}
