#!/usr/bin/env python3
# Write manifest.json for the profile folder (run inside it, after the .gz files exist). The download figures count what
# a sketch actually fetches: the basic download is the tools + headers + the base SDK; a WiFi sketch fetches the bigger
# SDK instead plus the wifi and http packs.
import glob, json, os

gz = {f: os.path.getsize(f) for f in glob.glob('*.gz')}
extra = lambda f: f.startswith('sdk-wifi') or f.startswith('pack-') or f.startswith('manifest')
base = sum(s for f, s in gz.items() if not extra(f))
sdk_base = sum(s for f, s in gz.items() if f.startswith('sdk.'))
sdk_wifi = sum(s for f, s in gz.items() if f.startswith('sdk-wifi'))
packs = {}
for f, s in gz.items():
    if f.startswith('pack-'):
        k = f[5:].split('.')[0]
        packs[k] = packs.get(k, 0) + s
old = json.load(open('manifest.json')) if os.path.exists('manifest.json') else {}
old.update({
    'name': 'esp32s3-thingplus',
    'board': 'SparkFun ESP32-S3 Thing Plus (esp32:esp32:sparkfun_esp32s3_thing_plus)',
    'chip': 'esp32s3', 'gcc': '14.2.0 (esp-14.2.0_20260121)', 'binutils': '2.43.1', 'core': 'arduino-esp32 3.3.12',
    'downloadMB': round(base / 1e6),
    'wifiDownloadMB': round((base - sdk_base + sdk_wifi + packs.get('wifi', 0) + packs.get('http', 0)) / 1e6),
    'packMB': {k: round(v / 1e6, 1) for k, v in sorted(packs.items())},
    'buildSeconds': 15,
})
json.dump(old, open('manifest.json', 'w'), indent=1)
print('manifest:', {k: old[k] for k in ('downloadMB', 'wifiDownloadMB', 'packMB')})
