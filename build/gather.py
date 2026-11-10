#!/usr/bin/env python3
# From each native Arduino build: the library include folders the sketch compile used (includes.cache), and the
# link's input objects in order (map LOAD lines, up to the first archive). Writes gather.json and prints a summary.
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
BS = '\\'


def norm(p):
    p = p.replace(BS, '/')
    m = re.match(r'^([A-Za-z]):/(.*)$', p)
    return '/mnt/' + m.group(1).lower() + '/' + m.group(2) if m else p


out = {}
BUILDS = ('WiFiScan', 'BasicHttpsClient', 'BLE_Server', 'WireScan', 'SPI_Multiple_Buses', 'StartCounter', 'HelloServer')
for name in BUILDS:
    d = os.path.join(HERE, 'build_' + name)
    if not os.path.exists(os.path.join(d, 'done.txt')):
        print(name, 'not built: skipped'); continue
    cache = json.load(open(os.path.join(d, 'includes.cache')))
    incs = []
    for e in cache:
        p = e.get('added_include_path')
        if p and norm(p) not in incs:
            incs.append(norm(p))
    objs = []
    for line in open(os.path.join(d, name + '.ino.map'), errors='replace'):
        if not line.startswith('LOAD '):
            continue
        p = norm(line[5:].strip())
        if p.endswith('.o'):
            objs.append(p)
        else:
            break
    libs = sorted({o.split('/libraries/')[1].split('/')[0] for o in objs if '/libraries/' in o})
    out[name] = {'includes': incs, 'objects': objs, 'libraries': libs, 'dir': norm(d)}
    print(f'{name}: {len(incs)} include folders, {len(objs)} objects before the archives; libraries compiled: {libs}')
    for i in incs:
        print('     -I', i.split('esp32/3.3.12/')[-1] if 'esp32/3.3.12/' in i else i[-70:])
json.dump(out, open(os.path.join(HERE, 'gather.json'), 'w'))
