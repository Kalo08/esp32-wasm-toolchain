#!/usr/bin/env python3
"""Library packs for the browser toolchain (WiFi, HTTP, BLE): the Arduino libraries' compiled objects (debug info
stripped), the headers a sketch using them reads, and the manifest that tells the Worker when to load them.

Needs: gather.json (build_packs' companion), the full header mirror /root/work/win, the profile folder (headers.json),
and the _ld_variants.json that build_packs.py wrote.
"""
import json, os, re, shutil, subprocess, sys, glob

SCR = os.environ['CAPTURE_ROOT']
HERE = SCR + '/measure'
GT = os.environ['NATIVEFS_TOOLS']
OUT = sys.argv[1]
WIN = '/root/work/win/'
run = lambda cmd, **k: subprocess.run(cmd, capture_output=True, text=True, **k)
NODE = ['node', '--max-old-space-size=6000']
gather = json.load(open(HERE + '/gather.json'))
ARD = '/mnt/c/Users/USER/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12'
LIBDIR_WIN = WIN + 'Users/USER/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/'

# what each feature is made of; `from` names the native build whose objects and headers represent it
FEATURES = {
    'wifi': {'libs': ['WiFi', 'Network'], 'build': 'WiFiScan', 'requires': []},
    'http': {'libs': ['HTTPClient', 'NetworkClientSecure'], 'build': 'BasicHttpsClient', 'requires': ['wifi']},
    'ble': {'libs': ['BLE'], 'build': 'BLE_Server', 'requires': []},
}

# 1. the library source folders into the header mirror (headers only are needed there)
for lib in {l for f in FEATURES.values() for l in f['libs']}:
    src = f'{ARD}/libraries/{lib}/src'
    dst = f'{LIBDIR_WIN}{lib}/src'
    if not os.path.isdir(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        subprocess.run(['rsync', '-a', src + '/', dst + '/'], check=True)
print('library sources mirrored', flush=True)

# 2. which headers does each sample read? (cc1plus -H, native-fs build)
cc_raw = [l for l in open(SCR + '/wasm/cc1_args.txt').read().split('\n') if l != '']
cc_win = [a.replace('/mnt/c/', WIN) for a in cc_raw]
si = next(i for i, a in enumerate(cc_win) if a.endswith('gt_blink.ino.cpp'))
oi = cc_win.index('-o') + 1
vi = next(i for i, a in enumerate(cc_win) if a.endswith('variants/sparkfun_esp32s3_thing_plus'))
base_headers = {os.path.normpath(f['p']) for f in json.load(open(OUT + '/headers.json'))}
W = '/root/work/pk2'; os.makedirs(W, exist_ok=True)
read_by = {}
for feat, spec in FEATURES.items():
    n = spec['build']
    g = gather[n]
    inc = [i for i in g['includes'] if '/libraries/' in i]                    # the library -I folders, in the native order
    inc_win = [WIN + i.split('/mnt/c/')[1] for i in inc]
    sketch = f"{g['dir']}/sketch/{n}.ino.cpp"
    shutil.copy(sketch, f'{W}/{n}.cpp')
    a = list(cc_win)
    a[si] = f'{W}/{n}.cpp'; a[oi] = f'{W}/{n}.s'
    extra = []
    for p in inc_win:
        extra += ['-I', p]
    a[vi + 1:vi + 1] = extra
    a.insert(0, '-H')
    r = run(NODE + [GT + '/cc1plus'] + a, cwd=W)
    hs = {os.path.normpath(m.group(1)) for m in (re.match(r'^\.+ (/\S+)$', l) for l in r.stderr.splitlines()) if m}
    ok = r.returncode == 0 and os.path.exists(f'{W}/{n}.s')
    print(f'{feat}: cc1plus exit {r.returncode}, {len(hs)} headers read, {len(hs - base_headers)} not in the base bundle', flush=True)
    if not ok:
        print(r.stderr[-1200:]); sys.exit(1)
    read_by[feat] = {'headers': hs - base_headers, 'includes': inc_win}

# 3. each feature's pack: headers (read + every header in its library source folders) and stripped objects
os.makedirs(OUT, exist_ok=True)
NODECP = ['node', GT + '/objcopy', '--strip-debug']


def strip(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    r = run(NODECP + [src, dst])
    if r.returncode != 0 or not os.path.exists(dst):
        shutil.copy(src, dst)
        return False
    return True


manifest = {}
loaded_headers = set()
for feat, spec in FEATURES.items():
    g = gather[spec['build']]
    files = []                                    # (memfs path, source file path)
    hdrs = set(read_by[feat]['headers'])
    for lib in spec['libs']:
        for root, _, fs in os.walk(f'{LIBDIR_WIN}{lib}/src'):
            hdrs |= {os.path.normpath(os.path.join(root, f)) for f in fs if f.endswith(('.h', '.hpp', '.inc'))}
    hdrs -= base_headers
    for requirement in spec['requires']:
        hdrs -= set(read_by[requirement]['headers'])
    for h in sorted(hdrs):
        files.append((h, h))
    # objects of this feature's libraries, in the native link order, debug info stripped
    objs = []; raw = stripped = 0
    for o in g['objects']:
        if '/libraries/' not in o:
            continue
        lib = o.split('/libraries/')[1].split('/')[0]
        if lib not in spec['libs']:
            continue
        rel = o.split('/libraries/')[1]
        dst = f'/root/work/pk2/objs/{rel}'
        strip(o, dst)
        raw += os.path.getsize(o); stripped += os.path.getsize(dst)
        mp = f'/lib/{rel}'
        files.append((mp, dst)); objs.append(mp)
    names = sorted({f for lib in spec['libs'] for f in os.listdir(f'{LIBDIR_WIN}{lib}/src') if f.endswith('.h')})
    man = []; off = 0
    with open(f'{OUT}/pack-{feat}.bin', 'wb') as bf:
        for p, src in files:
            b = open(src, 'rb').read(); man.append({'p': p, 'o': off, 'n': len(b)}); bf.write(b); off += len(b)
    json.dump(man, open(f'{OUT}/pack-{feat}.json', 'w'))
    manifest[feat] = {'requires': spec['requires'], 'includes': read_by[feat]['includes'], 'objects': objs, 'headers': names,
                      'sdk': 'sdk-wifi' if feat in ('wifi', 'http') else 'sdk'}
    print(f'{feat}: pack {off / 1e6:.2f} MB ({len(hdrs)} headers, {len(objs)} objects: {raw / 1e6:.2f} MB with debug info, {stripped / 1e6:.2f} MB stripped)', flush=True)

json.dump(manifest, open(OUT + '/_features.json', 'w'), indent=1)
print('features written')
