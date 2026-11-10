#!/usr/bin/env python3
"""Install the packs build_packs.py / build_libpacks.py made into the toolchain profile folder.

  python3 finalize_profile.py <packs_out> <profile_folder>

Adds the `features` section to args.json (what the Worker reads), replaces sdk.* (base + BLE) and adds sdk-wifi.* and
pack-<feature>.*, and checks that every archive the link line names exists in both SDK variants.
"""
import json, os, shutil, sys

SRC, DST = sys.argv[1], sys.argv[2]
LABELS = {'wifi': 'WiFi', 'http': 'HTTP and HTTPS clients', 'ble': 'BLE'}

args = json.load(open(DST + '/args.json'))
feats = json.load(open(SRC + '/_features.json'))
variants = json.load(open(SRC + '/_ld_variants.json'))

# the link line must name the same archives in both variants, and it must be the one the profile already uses
# each variant was built in its own folder; in the browser one variant is loaded alone, under the shared root
fix = lambda s: s.replace('/root/work/thin_base', '/root/work/thin').replace('/root/work/thin_wifi', '/root/work/thin')
names = lambda l: [fix(a) for a in l if a.endswith('.a') or a.startswith('-L')]
if names(variants['sdk']) != names(variants['sdk-wifi']):
    sys.exit('the two SDK variants disagree about the link line')
if names(args['ld']) != names(variants['sdk']):
    sys.exit('the profile\'s link line differs from the new variants\' (rebuild the profile first)')

for v in ('sdk', 'sdk-wifi'):
    man = json.load(open(f'{SRC}/{v}.json'))
    have = {fix(m['p']) for m in man}
    missing = [a for a in names(args['ld']) if a.endswith('.a') and a not in have]
    if missing:
        sys.exit(f'{v}: archives missing from the bundle: {missing[:3]}')

out = {}
for f, spec in feats.items():
    out[f] = {'label': LABELS.get(f, f), 'requires': spec['requires'], 'headers': spec['headers'],
              'includes': spec['includes'], 'objects': spec['objects'], 'sdk': spec['sdk']}
args['features'] = out
json.dump(args, open(DST + '/args.json', 'w'))

for name in ['sdk.json', 'sdk.bin', 'sdk-wifi.json', 'sdk-wifi.bin'] + [f'pack-{f}.{e}' for f in feats for e in ('json', 'bin')]:
    if name in ('sdk.json', 'sdk-wifi.json'):
        man = json.load(open(f'{SRC}/{name}'))
        for m in man:
            m['p'] = fix(m['p'])
        json.dump(man, open(f'{DST}/{name}', 'w'))
    else:
        shutil.copy(f'{SRC}/{name}', f'{DST}/{name}')
    print('installed', name, os.path.getsize(f'{DST}/{name}'))

man_path = DST + '/manifest.json'
man = json.load(open(man_path)) if os.path.exists(man_path) else {}
man['libraries'] = [LABELS.get(f, f) for f in feats]
json.dump(man, open(man_path, 'w'), indent=1)
print('features:', {f: (len(s['objects']), len(s['headers'])) for f, s in out.items()}, 'manifest libraries:', man['libraries'])
