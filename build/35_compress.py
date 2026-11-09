import json, subprocess, os, tempfile, gzip, shutil, glob
used = json.load(open('/root/work/test-ldmap/used_members.json'))
root = tempfile.mkdtemp(prefix='thin', dir='/root/work')
tot_raw = 0
for a, mem in used.items():
    if not os.path.exists(a): continue
    d = tempfile.mkdtemp(dir=root)
    subprocess.run(['ar', 'x', a] + sorted(mem), cwd=d, check=True)
    out = os.path.join(root, os.path.basename(a))
    subprocess.run(['ar', 'rcs', out] + sorted(os.listdir(d)), cwd=d, check=True)
    tot_raw += os.path.getsize(out)
    shutil.rmtree(d)
tar = root + '.tar'
subprocess.run(['tar', '-cf', tar, '-C', root, '.'], check=True)
def comp(path, cmd):
    r = subprocess.run(cmd + [path, '-c'], capture_output=True)
    return len(r.stdout)
print('thin archives (only members blink uses): raw %.1f MB' % (os.path.getsize(tar)/1e6))
for name, cmd in (('gzip -9', ['gzip', '-9']), ('xz -6', ['xz', '-6', '-T8'])):
    print('  %-8s %.1f MB' % (name, comp(tar, cmd)/1e6))
lib = '/mnt/c/Users/USER/AppData/Local/Arduino15/packages/esp32/tools/esp32s3-libs/3.3.12'
full = glob.glob(lib + '/lib/*.a') + glob.glob(lib + '/qio_qspi/*.a')
tmp = '/root/work/fulllibs.tar'
subprocess.run(['tar', '-cf', tmp] + full, check=True, stderr=subprocess.DEVNULL)
print('full SDK libs: raw %.0f MB, gzip -9 %.0f MB' % (os.path.getsize(tmp)/1e6, comp(tmp, ['gzip', '-9'])/1e6))
