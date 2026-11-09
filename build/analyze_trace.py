import re, subprocess, collections, os, sys, json
mp = open('/root/work/test-ldmap/map.txt', errors='replace').read().splitlines()
used = collections.defaultdict(set); plain = []
i = 0
while i < len(mp) and not mp[i].startswith('Archive member included'): i += 1
i += 1
while i < len(mp) and not mp[i].startswith('Discarded input') and not mp[i].startswith('Memory Configuration'):
    for ar, mem in re.findall(r'(/\S*?\.a)\(([^)]+)\)', mp[i]):
        used[ar.replace('////','/')].add(mem)
    i += 1
for l in mp:
    if l.strip().endswith('.ld') or 'LOAD ' in l[:6]: plain.append(l.strip().replace('LOAD ','').replace('////','/'))
tot_arch = tot_used = 0; rows = []
for a, mem in used.items():
    if not os.path.exists(a): continue
    sizes = {}
    for line in subprocess.run(['ar', 'tv', a], capture_output=True, text=True).stdout.splitlines():
        p = line.split()
        if len(p) >= 3: sizes[p[-1]] = int(p[2])
    u = sum(sizes.get(x, 0) for x in mem); full = os.path.getsize(a)
    rows.append((os.path.basename(a), full, u, len(mem), len(sizes))); tot_arch += full; tot_used += u
rows.sort(key=lambda r: -r[2])
print('archives touched:', len(rows), ' full size %.1f MB, members used %.2f MB' % (tot_arch/1e6, tot_used/1e6))
for r in rows[:12]: print('%-28s full %7.0f KB  used %7.0f KB  (%d of %d members)' % (r[0], r[1]/1e3, r[2]/1e3, r[3], r[4]))
print('plain files opened:', len(plain))
ld = [p for p in plain if p.endswith('.ld')]; print('linker scripts:', len(ld), 'total %.2f MB' % (sum(os.path.getsize(p) for p in ld if os.path.exists(p))/1e6))
json.dump({a: sorted(m) for a, m in used.items()}, open('/root/work/test-ldmap/used_members.json', 'w'))
