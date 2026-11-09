#!/usr/bin/env python3
# Builds the browser profile for the SparkFun ESP32-S3 Thing Plus from sample programs:
#   1. compile each sample with cc1plus (-H) against the FULL header tree -> the headers it reads
#   2. assemble, then link against the FULL SDK with a map file -> the library members it pulls in
#   3. build "thin" libraries holding only those members (plus empty archives for the rest), re-link, and
#      check the ELF is byte-identical to the full link
#   4. pack headers + thin SDK + argument templates for the browser
import json, os, re, shutil, subprocess, sys, hashlib, time, collections
SCR = os.environ['CAPTURE_ROOT']
H, P = SCR + '/wasm', SCR + '/prof'
GT = os.environ['NATIVEFS_TOOLS']
OUT = sys.argv[1]
SAMPLES = sys.argv[2].split(',')
WIN = '/root/work/win/'
W = '/root/work/prof'; os.makedirs(W, exist_ok=True)
norm = lambda s: s.replace('////', '/')
run = lambda cmd, **k: subprocess.run(cmd, capture_output=True, text=True, **k)
NODE = ['node', '--max-old-space-size=6000']

cc_raw = [l for l in open(H + '/cc1_args.txt').read().split('\n') if l != '']
cc_win = [a.replace('/mnt/c/', WIN) for a in cc_raw]
si = next(i for i, a in enumerate(cc_win) if a.endswith('gt_blink.ino.cpp'))
oi = cc_win.index('-o') + 1
ld_raw = [norm(l) for l in open(H + '/ld_args.txt').read().split('\n') if l != '']
li = next(i for i, a in enumerate(ld_raw) if a.endswith('gt_blink.ino.cpp.o'))
lo = ld_raw.index('-o') + 1
mi = next(i for i, a in enumerate(ld_raw) if 'gt_blink.ino.map' in a)

headers = set(); objs = {}
for s in SAMPLES:
    shutil.copy(f'{P}/{s}.cpp', f'{W}/{s}.cpp')
    a = list(cc_win); a[si] = f'{W}/{s}.cpp'; a[oi] = f'{W}/{s}.s'; a.insert(0, '-H')
    t = time.time(); r = run(NODE + [GT + '/cc1plus'] + a, cwd=W)
    hs = [m.group(1) for m in (re.match(r'^\.+ (/\S+)$', l) for l in r.stderr.splitlines()) if m]
    print(f'{s}: cc1plus exit {r.returncode}, {len(hs)} header lines, {time.time()-t:.1f}s', flush=True)
    if r.returncode != 0 or not os.path.exists(f'{W}/{s}.s'):
        print(r.stderr[-1500:]); sys.exit(1)
    headers.update(os.path.normpath(h) for h in hs)
    r = run(['node', GT + '/as-new', '--gdwarf-4', '--traditional-format', '--longcalls', '-o', f'{W}/{s}.o', f'{W}/{s}.s'])
    print(f'{s}: as exit {r.returncode}', flush=True); objs[s] = f'{W}/{s}.o'
headers = sorted(h for h in headers if h.startswith(WIN))
print(len(headers), 'unique headers,', sum(os.path.getsize(h) for h in headers) / 1e6, 'MB', flush=True)

# 2. full links with a map
used = collections.defaultdict(set); full_sha = {}
for s, o in objs.items():
    a = list(ld_raw); a[li] = o; a[lo] = f'{W}/{s}.full.elf'; a[mi] = a[mi].split('=')[0] + f'={W}/{s}.map'
    t = time.time(); r = run(NODE + [GT + '/ld-new'] + a, cwd=W)
    print(f'{s}: full link exit {r.returncode}, {time.time()-t:.0f}s', flush=True)
    if r.returncode != 0: print((r.stdout + r.stderr)[-1500:]); sys.exit(1)
    full_sha[s] = hashlib.sha256(open(f'{W}/{s}.full.elf', 'rb').read()).hexdigest()
    mp = open(f'{W}/{s}.map', errors='replace').read().splitlines()
    i = 0
    while i < len(mp) and not mp[i].startswith('Archive member included'): i += 1
    i += 1
    while i < len(mp) and not mp[i].startswith('Discarded input') and not mp[i].startswith('Memory Configuration'):
        for ar, mem in re.findall(r'(/\S*?\.a)\(([^)]+)\)', mp[i]): used[os.path.normpath(norm(ar))].add(mem)
        i += 1

# 3. thin libraries
T = '/root/work/thin'; shutil.rmtree(T, ignore_errors=True)
mirror = lambda p: T + p
made = {}
def members(path):
    b = open(path, 'rb').read(); pos = 8; out = []; table = None
    while pos + 60 <= len(b):
        hdr = b[pos:pos+60]; name = hdr[:16].decode().rstrip(); size = int(hdr[48:58])
        end = pos + 60 + size + (size & 1)
        if name == '/': pass
        elif name == '//': table = (b[pos:end], b[pos+60:pos+60+size])
        else: out.append((name, b[pos:end]))
        pos = end
    return out, table
def thin(a):
    a = os.path.normpath(a); out = mirror(a)
    if a in made: return out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    data = b'!<arch>\n'
    if a in used:
        ms, table = members(a); keep = []
        for name, raw in ms:
            n = name
            if n.startswith('/') and n[1:].isdigit() and table: o = int(n[1:]); n = table[1][o:table[1].index(b'/\n', o)].decode()
            else: n = n.rstrip('/')
            if n in used[a]: keep.append(raw)
        data += (table[0] if table else b'') + b''.join(keep)
    open(out, 'wb').write(data); subprocess.run(['ar', 's', out], check=True); made[a] = 1
    return out
Ldirs = [a[2:] for a in ld_raw if a.startswith('-L') and len(a) > 2]
for D in Ldirs:
    if not os.path.isdir(D): continue
    os.makedirs(mirror(os.path.normpath(D)), exist_ok=True)
    for f in os.listdir(D):
        p = D + '/' + f
        if not os.path.isfile(p): continue
        if f.endswith('.a'): thin(p)
        else: shutil.copy(p, mirror(os.path.normpath(p)))
ld_thin = []
for a in ld_raw:
    if a.startswith('-L') and len(a) > 2: a = '-L' + mirror(os.path.normpath(a[2:]))
    elif a.startswith('--sysroot='): a = '--sysroot=' + os.path.normpath(a[10:])
    elif a.endswith('.a') and a.startswith('/'): a = thin(a)
    ld_thin.append(a)
sz = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(T) for f in fs)
print('thin SDK: %.1f MB' % (sz / 1e6), flush=True)
ok = True
for s, o in objs.items():
    a = list(ld_thin); a[li] = o; a[lo] = f'{W}/{s}.thin.elf'; a[mi] = a[mi].split('=')[0] + f'={W}/{s}.thin.map'
    r = run(NODE + [GT + '/ld-new'] + a, cwd=W)
    same = r.returncode == 0 and hashlib.sha256(open(f'{W}/{s}.thin.elf', 'rb').read()).hexdigest() == full_sha[s]
    print(f'{s}: thin link {"IDENTICAL to the full link" if same else "FAILED/DIFFERENT"} (exit {r.returncode})', flush=True)
    if not same: print((r.stdout + r.stderr)[-800:]); ok = False
if not ok: sys.exit(1)

# 4. pack
os.makedirs(OUT, exist_ok=True)
def pack(files, name):
    man = []; off = 0
    with open(f'{OUT}/{name}.bin', 'wb') as bf:
        for f in sorted(files):
            b = open(f, 'rb').read(); man.append({'p': f, 'o': off, 'n': len(b)}); bf.write(b); off += len(b)
    json.dump(man, open(f'{OUT}/{name}.json', 'w')); return off
hb = pack(headers, 'headers')
sdk = [os.path.join(r, f) for r, _, fs in os.walk(T) for f in fs]
sb = pack(sdk, 'sdk')
cc = list(cc_win); cc[si] = '/work/main.cpp'; cc[oi] = '/work/out.s'
ld = list(ld_thin); ld[li] = '/work/sketch.o'; ld[lo] = '/work/out.elf'; ld[mi] = ld[mi].split('=')[0] + '=/work/out.map'
json.dump({'cc1': cc, 'ld': ld, 'as': ['--gdwarf-4', '--traditional-format', '--longcalls'], 'cwd': '/work',
           'flash': {'mode': 'dio', 'freq': '80m', 'size': '4MB', 'chip': 'esp32s3', 'elfSha256Offset': 0xb0}},
          open(f'{OUT}/args.json', 'w'))
print('packed headers %.1f MB (%d files), sdk %.1f MB (%d files)' % (hb / 1e6, len(headers), sb / 1e6, len(sdk)))
