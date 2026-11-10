#!/usr/bin/env python3
"""Feature packs for the browser toolchain: WiFi, HTTP(S) and BLE.

Inputs: the native Arduino builds of WiFiScan, BasicHttpsClient and BLE_Server (objects, maps, ELFs), the five base
sample maps (/root/work/prof/*.map) and the existing profile folder.
Steps: 1 the union of SDK archive members used -> two thin SDK variants (sdk = base + BLE, sdk-wifi = everything)
       2 build each variant's thin archive tree and PROVE it: every program re-links to the identical ELF
       3 pack the Arduino library objects (debug info stripped) and the extra headers as feature packs
"""
import collections, glob, hashlib, json, os, re, shutil, subprocess, sys, time

SCR = os.environ['CAPTURE_ROOT']
HERE = SCR + '/measure'
GT = os.environ['NATIVEFS_TOOLS']
OUT = sys.argv[1]
WIN = '/root/work/win/'
BS = '\\'
NODE = ['node', '--max-old-space-size=6000']
run = lambda cmd, **k: subprocess.run(cmd, capture_output=True, text=True, **k)


def norm(p):
    p = p.replace(BS, '/').replace('////', '/')
    m = re.match(r'^([A-Za-z]):/(.*)$', p)
    return os.path.normpath('/mnt/' + m.group(1).lower() + '/' + m.group(2)) if m else os.path.normpath(p)


gather = json.load(open(HERE + '/gather.json'))
GT_CORE = os.path.normpath(norm(SCR) + '/gt_build/core/core.a')


def canon(a):
    """native builds each have their own core.a copy: one key for all of them"""
    return GT_CORE if a.endswith('/core/core.a') else a


def members_used(mapfile):
    used = collections.defaultdict(set)
    lines = open(mapfile, errors='replace').read().splitlines()
    i = 0
    while i < len(lines) and not lines[i].startswith('Archive member included'):
        i += 1
    i += 1
    while i < len(lines) and not lines[i].startswith('Discarded input') and not lines[i].startswith('Memory Configuration'):
        for ar, mem in re.findall(r'((?:[A-Za-z]:[\\/]|/)[^\s()]*?\.a)\(([^)]+)\)', lines[i]):
            used[canon(norm(ar))].add(mem)
        i += 1
    return used


def union(*ds):
    u = collections.defaultdict(set)
    for d in ds:
        for a, m in d.items():
            u[a] |= m
    return u


# ---------- 1. which members each variant needs
base_maps = sorted(glob.glob('/root/work/prof/*.map'))
base_maps = [m for m in base_maps if not m.endswith('.thin.map')]
print('base sample maps:', [os.path.basename(m) for m in base_maps], flush=True)
base = union(*[members_used(m) for m in base_maps])
native = {n: members_used(f"{gather[n]['dir']}/{n}.ino.map") for n in gather}
sdk_base = union(base, native['BLE_Server'])
sdk_wifi = union(base, *native.values())
size = lambda u: sum(len(v) for v in u.values())
print(f'members: base {size(base)}, base+BLE {size(sdk_base)}, everything {size(sdk_wifi)}', flush=True)


# ---------- 2. thin trees
def members(path):
    b = open(path, 'rb').read(); pos = 8; out = []; table = None
    while pos + 60 <= len(b):
        name = b[pos:pos + 16].decode().rstrip(); size_ = int(b[pos + 48:pos + 58])
        end = pos + 60 + size_ + (size_ & 1)
        if name == '/':
            pass
        elif name == '//':
            table = (b[pos:end], b[pos + 60:pos + 60 + size_])
        else:
            out.append((name, b[pos:end]))
        pos = end
    return out, table


def build_tree(used, T, ld_raw):
    shutil.rmtree(T, ignore_errors=True)
    mirror = lambda p: T + p
    made = {}

    def thin(a):
        a = os.path.normpath(a); out = mirror(a)
        if a in made:
            return out
        os.makedirs(os.path.dirname(out), exist_ok=True)
        data = b'!<arch>\n'
        key = canon(a)
        if key in used:
            ms, table = members(a); keep = []
            for name, raw in ms:
                n = name
                if n.startswith('/') and n[1:].isdigit() and table:
                    o = int(n[1:]); n = table[1][o:table[1].index(b'/\n', o)].decode()
                else:
                    n = n.rstrip('/')
                if n in used[key]:
                    keep.append(raw)
            data += (table[0] if table else b'') + b''.join(keep)
        open(out, 'wb').write(data); subprocess.run(['ar', 's', out], check=True); made[a] = 1
        return out

    for D in [a[2:] for a in ld_raw if a.startswith('-L') and len(a) > 2]:
        if not os.path.isdir(D):
            continue
        os.makedirs(mirror(os.path.normpath(D)), exist_ok=True)
        for f in os.listdir(D):
            p = D + '/' + f
            if not os.path.isfile(p):
                continue
            if f.endswith('.a'):
                thin(p)
            else:
                shutil.copy(p, mirror(os.path.normpath(p)))
    new = []
    for a in ld_raw:
        if a.startswith('-L') and len(a) > 2:
            a = '-L' + mirror(os.path.normpath(a[2:]))
        elif a.startswith('--sysroot='):
            a = '--sysroot=' + os.path.normpath(a[10:])
        elif a.endswith('.a') and a.startswith('/'):
            a = thin(a)
        new.append(a)
    sz = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(T) for f in fs)
    return new, sz


ld_raw = [norm(l) if l.startswith('/') else l.replace('////', '/') for l in open(SCR + '/wasm/ld_args.txt').read().split('\n') if l != '']
ld_raw = [l.replace('////', '/') for l in ld_raw]
i_sketch = next(i for i, a in enumerate(ld_raw) if a.endswith('gt_blink.ino.cpp.o'))
i_core = i_sketch + 1
i_out = ld_raw.index('-o') + 1
i_map = next(i for i, a in enumerate(ld_raw) if 'gt_blink.ino.map' in a)
assert ld_raw[i_core].endswith('core/core.a')

TB, TW = '/root/work/thin_base', '/root/work/thin_wifi'
ld_base, sz_b = build_tree(sdk_base, TB, ld_raw)
ld_wifi, sz_w = build_tree(sdk_wifi, TW, ld_raw)
print(f'thin SDK: base+BLE {sz_b / 1e6:.1f} MB, everything {sz_w / 1e6:.1f} MB', flush=True)


def relink(ld_thin, T, objs, core, name):
    W = f'/root/work/pk_{name}'; os.makedirs(W, exist_ok=True)
    a = list(ld_thin)
    a[i_out] = f'{W}/out.elf'
    a[i_map] = a[i_map].split('=')[0] + f'={W}/out.map'
    # the thin core.a lives at the mirror of the canonical core path
    a[i_core] = T + GT_CORE
    a[i_sketch:i_sketch + 1] = objs
    r = run(NODE + [GT + '/ld-new'] + a, cwd=W)
    return r, f'{W}/out.elf'


sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
ok = True
checks = []
for s in ['blink', 'sensors', 'text_and_functions', 'rgb', 'io']:      # base samples: our own objects, vs their full links
    checks.append((s, ld_base, TB, [f'/root/work/prof/{s}.o'], f'/root/work/prof/{s}.full.elf'))
    checks.append((s + '@wifi', ld_wifi, TW, [f'/root/work/prof/{s}.o'], f'/root/work/prof/{s}.full.elf'))
checks.append(('BLE_Server', ld_base, TB, gather['BLE_Server']['objects'], f"{gather['BLE_Server']['dir']}/BLE_Server.ino.elf"))
for n in ('WiFiScan', 'BasicHttpsClient', 'BLE_Server'):
    checks.append((n + '@wifi', ld_wifi, TW, gather[n]['objects'], f"{gather[n]['dir']}/{n}.ino.elf"))
def image_check(elf, ref):
    # the native Arduino builds compiled their own copy of the core at another time, so their ELFs carry other build
    # timestamps and debug paths: compare the FLASH IMAGES instead; only the timestamp bytes (and the checksum and digest
    # that follow from them) may differ
    r = run(['node', HERE + '/image_diff.mjs', elf, ref])
    m = re.search(r'before the checksum: (\d+) .*in checksum\+digest: (\d+)', r.stdout)
    return (m is not None and int(m.group(1)) <= 8, r.stdout.strip().splitlines()[0] if r.stdout.strip() else r.stderr[-200:])


for name, ld_thin, T, objs, ref in checks:
    r, elf = relink(ld_thin, T, objs, GT_CORE, name.replace('@', '_'))
    linked = r.returncode == 0 and os.path.exists(elf) and os.path.exists(ref)
    same = linked and sha(elf) == sha(ref)
    note = ''
    if linked and not same and '/measure/build_' in ref:
        same, note = image_check(elf, ref)
        verdict = 'IMAGE IDENTICAL except build-time bytes' if same else 'DIFFERENT'
        note = ' [' + note + ']'
    else:
        verdict = 'IDENTICAL' if same else 'DIFFERENT'
    print(f'  {name:<26} thin link {verdict} (exit {r.returncode}){note}', flush=True)
    if not same:
        ok = False
        print((r.stdout + r.stderr)[-500:])
if not ok:
    sys.exit(1)

# ---------- 3. pack
os.makedirs(OUT, exist_ok=True)


def pack(files, name, extra=None):
    """files: list of (path_in_memfs, source_path or bytes)"""
    man = []; off = 0
    with open(f'{OUT}/{name}.bin', 'wb') as bf:
        for p, src in files:
            b = open(src, 'rb').read() if isinstance(src, str) else src
            man.append({'p': p, 'o': off, 'n': len(b)}); bf.write(b); off += len(b)
    json.dump(man, open(f'{OUT}/{name}.json', 'w'))
    return off


def tree_files(T):
    return [(os.path.join(r, f), os.path.join(r, f)) for r, _, fs in os.walk(T) for f in sorted(fs)]


print('sdk.bin', pack(tree_files(TB), 'sdk') / 1e6, 'MB; sdk-wifi.bin', pack(tree_files(TW), 'sdk-wifi') / 1e6, 'MB', flush=True)
json.dump({'sdk': ld_base, 'sdk-wifi': ld_wifi}, open(OUT + '/_ld_variants.json', 'w'))
print('variants written; library packs are built by build_libpacks.py', flush=True)
