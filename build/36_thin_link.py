# Build a "thin" copy of every library directory on the link line (only the archive members blink pulled in;
# empty archives for libraries blink doesn't use; scripts copied as they are), then link against it.
import json, os, re, shutil, subprocess, sys, time
H = '/mnt/c/work/wasm'
norm = lambda s: s.replace('////', '/')
args = [norm(l) for l in open(H + '/ld_args.txt').read().split('\n') if l != '']
used = {os.path.normpath(norm(k)): set(v) for k, v in json.load(open('/root/work/test-ldmap/used_members.json')).items()}
T = '/root/work/thin'
shutil.rmtree(T, ignore_errors=True)
mirror = lambda p: T + p
Ldirs = [a[2:] for a in args if a.startswith('-L') and len(a) > 2] + [args[i+1] for i, a in enumerate(args) if a == '-L']
made = {}
def members(path):
    """[(name, header+data bytes incl. padding)] of an ar archive, plus the long-name table entry"""
    b = open(path, 'rb').read(); pos = 8; out = []; table = None
    while pos + 60 <= len(b):
        hdr = b[pos:pos+60]; name = hdr[:16].decode().rstrip(); size = int(hdr[48:58])
        body = b[pos+60:pos+60+size]; end = pos + 60 + size + (size & 1)
        raw = b[pos:end]
        if name == '/': pass                      # symbol index: rebuilt by `ar s`
        elif name == '//': table = (raw, body)
        else: out.append((name, raw, body))
        pos = end
    return out, table
def thin(a):
    a = os.path.normpath(a)
    out = mirror(a)
    if a in made: return out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    keep = []
    if a in used:
        ms, table = members(a)
        for name, raw, body in ms:
            n = name
            if n.startswith('/') and n[1:].isdigit() and table:
                tb = table[1]; o = int(n[1:]); n = tb[o:tb.index(b'/\n', o)].decode()
            else: n = n.rstrip('/')
            if n in used[a]: keep.append(raw)
        data = b'!<arch>\n' + (table[0] if table else b'') + b''.join(keep)
    else:
        data = b'!<arch>\n'
    open(out, 'wb').write(data)
    subprocess.run(['ar', 's', out], check=True)
    made[a] = 1
    return out
nfiles = 0
for D in Ldirs:
    if not os.path.isdir(D): continue
    os.makedirs(mirror(D), exist_ok=True)
    for f in os.listdir(D):
        p = D + '/' + f
        if not os.path.isfile(p): continue
        if f.endswith('.a'): thin(p)
        else: shutil.copy(p, mirror(p))
        nfiles += 1
new = []
for a in args:
    if a.startswith('-L') and len(a) > 2: a = '-L' + mirror(a[2:])
    elif a.endswith('.a') and a.startswith('/'): a = thin(a)
    new.append(a)
for i, a in enumerate(new):
    if a == '-L': new[i+1] = mirror(args[i+1])
sz = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(T) for f in fs)
print('thin tree: %d archives/files, %.1f MB' % (nfiles, sz/1e6))
W = '/root/work/test-thin'; shutil.rmtree(W, ignore_errors=True); os.makedirs(W)
open(W + '/args.json', 'w').write(json.dumps(new))
t = time.time()
r = subprocess.run(['node', '--max-old-space-size=6000', '/mnt/c/work/ground-truth/wasm-toolchain/ld-new'] + new, cwd=W, capture_output=True, text=True)
print('ld exit', r.returncode, '%.0f s' % (time.time() - t)); print((r.stdout + r.stderr)[-700:])
