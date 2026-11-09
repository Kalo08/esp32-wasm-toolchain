import json, os, sys
OUT = sys.argv[1]
args = json.load(open('/root/work/test-thin/args.json'))
T = '/root/work/thin'
# the sketch object and the output are the only inputs/outputs that aren't libraries or scripts
res = []
for a in args:
    if a == '/root/work/test-ld/link_wasm.elf': a = '/work/out.elf'
    elif a.endswith('gt_blink.ino.cpp.o'): a = '/work/sketch.o'
    elif 'gt_blink.ino.map' in a: a = a.split('=')[0] + '=/work/out.map'
    if a.startswith('-L') and len(a) > 2: a = '-L' + os.path.normpath(a[2:])
    elif a.startswith('--sysroot='): a = '--sysroot=' + os.path.normpath(a[10:])
    res.append(a)
files = [os.path.join(r, f) for r, _, fs in os.walk(T) for f in fs]
files.sort()
man = []; off = 0
with open(OUT + '/sdk_thin.bin', 'wb') as bf:
    for f in files:
        b = open(f, 'rb').read(); man.append({'p': f, 'o': off, 'n': len(b)}); bf.write(b); off += len(b)
json.dump(man, open(OUT + '/sdk_thin.json', 'w')); json.dump(res, open(OUT + '/ld_args.json', 'w'))
odd = [a for a in res if a.startswith('/') and not a.startswith(T) and not a.startswith('/work')]
print(len(files), 'files', off, 'bytes;', len(res), 'args; absolute args outside the tree:', odd[:6])
