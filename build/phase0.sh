#!/bin/bash
# Phase 0: link blink with the full SDK under a read tracer, then report how many bytes a browser would have to fetch
# if library files were loaded in chunks of various sizes (only what the linker actually reads).
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
M=${CAPTURE_ROOT}
W=/root/work/phase0; rm -rf $W; mkdir -p $W; cd $W
mapfile -t ARGS < $M/wasm/ld_args.txt
export TRACE_OUT=$W/reads.json
t=$(date +%s)
node --max-old-space-size=6000 --require $M/measure/trace_reads.cjs ${NATIVEFS_TOOLS}/ld-new "${ARGS[@]}" > ld.log 2>&1
echo "ld exit $? after $(( $(date +%s) - t )) s"; tail -2 ld.log | cut -c1-200
python3 - <<'PY'
import json, os
d = json.load(open('/root/work/phase0/reads.json'))
B = d['block']; files = d['files']
libs = {p: v for p, v in files.items() if p.endswith('.a')}
tot_size = sum(v['size'] for v in libs.values())
print(f"read calls: {d['reads']}; archives opened: {len(libs)}, their total size {tot_size/1e6:.1f} MB")
for chunk in (4096, 16384, 65536, 262144, 1048576):
    k = chunk // B
    bytes_ = 0; reqs = 0
    for p, v in libs.items():
        chunks = sorted({b // k for b in v['blocks']})
        reqs += len(chunks)
        for c in chunks:
            bytes_ += min(chunk, v['size'] - c * chunk)
    print(f"  chunk {chunk//1024:>5} KB: {bytes_/1e6:7.1f} MB fetched in {reqs:6d} requests")
other = {p: v for p, v in files.items() if not p.endswith('.a')}
print(f"other files read: {len(other)} ({sum(len(v['blocks'])*B for v in other.values())/1e6:.1f} MB touched)")
PY
