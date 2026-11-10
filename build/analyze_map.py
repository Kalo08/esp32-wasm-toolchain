#!/usr/bin/env python3
# For native builds (WSL view of the Windows build folders): which SDK archive members did each program pull in,
# how big are they, and how big are they compressed? Also the union across programs.
import collections, os, re, shutil, subprocess, sys, tempfile

maps = dict(a.split('=', 1) for a in sys.argv[1:])           # name=path-to-map


def norm(p):
    p = p.replace('\\', '/').replace('////', '/')
    p = re.sub(r'^([A-Za-z]):/', lambda m: '/mnt/' + m.group(1).lower() + '/', p)
    return os.path.normpath(p)


def used_members(mapfile):
    used = collections.defaultdict(set)
    lines = open(mapfile, errors='replace').read().splitlines()
    i = 0
    while i < len(lines) and not lines[i].startswith('Archive member included'):
        i += 1
    i += 1
    while i < len(lines) and not lines[i].startswith('Discarded input') and not lines[i].startswith('Memory Configuration'):
        # Windows paths contain no spaces here; member names may contain ( ) rarely, so take up to the last ')'
        for ar, mem in re.findall(r'([A-Za-z]:[\\/][^\s()]*?\.a|/[^\s()]*?\.a)\(([^)]+)\)', lines[i]):
            used[norm(ar)].add(mem)
        i += 1
    return used


def members(path):
    b = open(path, 'rb').read(); pos = 8; out = []; table = None
    while pos + 60 <= len(b):
        name = b[pos:pos+16].decode().rstrip(); size = int(b[pos+48:pos+58])
        end = pos + 60 + size + (size & 1)
        if name == '/':
            pass
        elif name == '//':
            table = (b[pos:end], b[pos+60:pos+60+size])
        else:
            out.append((name, b[pos:end], size))
        pos = end
    return out, table


def thin_bytes(archive, keep):
    ms, table = members(archive); parts = []; used = 0
    for name, raw, size in ms:
        n = name
        if n.startswith('/') and n[1:].isdigit() and table:
            o = int(n[1:]); n = table[1][o:table[1].index(b'/\n', o)].decode()
        else:
            n = n.rstrip('/')
        if n in keep:
            parts.append(raw); used += size
    return b'!<arch>\n' + (table[0] if table else b'') + b''.join(parts), used


def compressed(data, cmd):
    return len(subprocess.run(cmd, input=data, capture_output=True).stdout)


results = {}
for name, mp in maps.items():
    u = used_members(mp)
    results[name] = u
    present = {a: m for a, m in u.items() if os.path.exists(a)}
    missing = [a for a in u if not os.path.exists(a)]
    tot = full = 0; rows = []
    blob = b''
    for a, m in present.items():
        data, used = thin_bytes(a, m)
        tot += used; full += os.path.getsize(a); blob += data
        rows.append((os.path.basename(a), os.path.getsize(a), used, len(m)))
    rows.sort(key=lambda r: -r[2])
    print(f'== {name}: {len(present)} archives, members used {tot/1e6:.1f} MB (those archives are {full/1e6:.1f} MB); '
          f'thin gzip -9 {compressed(blob, ["gzip", "-9"])/1e6:.1f} MB, xz -6 {compressed(blob, ["xz", "-6", "-T8"])/1e6:.1f} MB'
          + (f'; {len(missing)} archive paths not found (e.g. {os.path.basename(missing[0])})' if missing else ''))
    for r in rows[:8]:
        print(f'   {r[0]:<34} used {r[2]/1e3:7.0f} KB of {r[1]/1e3:7.0f} KB ({r[3]} members)')

# union
union = collections.defaultdict(set)
for u in results.values():
    for a, m in u.items():
        union[a] |= m
blob = b''; tot = 0; n = 0
for a, m in union.items():
    if not os.path.exists(a):
        continue
    data, used = thin_bytes(a, m); blob += data; tot += used; n += 1
print(f'== UNION of all programs: {n} archives, members used {tot/1e6:.1f} MB; thin gzip -9 {compressed(blob, ["gzip", "-9"])/1e6:.1f} MB, '
      f'xz -6 {compressed(blob, ["xz", "-6", "-T8"])/1e6:.1f} MB')
