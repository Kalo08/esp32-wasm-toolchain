#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}/wasm
B=/root/work/build-gcc-wasm
mapfile -t ARGS < $H/cc1_args.txt
# every path now points at the minimal copy: only the 337 headers the compiler read, plus the sketch itself
LARGS=("${ARGS[@]//\/mnt\/c\//\/root\/work\/min\/}")
W=/root/work/test-min; rm -rf $W; mkdir -p $W; cd $W
# the sketch's own files
for f in "${ARGS[@]}"; do case "$f" in /mnt/c/*.cpp|/mnt/c/*.ino) d=/root/work/min/${f#/mnt/c/}; mkdir -p "$(dirname "$d")"; cp "$f" "$d" 2>/dev/null;; esac; done
LARGS=("${LARGS[@]/\/root\/work\/test-cc\/out.s//root/work/test-min/out.s}")
( time node --max-old-space-size=6000 $B/gcc/cc1plus "${LARGS[@]}" ) > cc_out.txt 2>&1
echo "exit status: $?"
grep -vE "^$|^user|^sys" cc_out.txt | tail -6 | cut -c1-250
ls -l /root/work/test-min/out.s /root/work/test-cc/out.s 2>&1 | awk '{print $5, $9}'
sed 's#/root/work/min/#C:/#g' /root/work/test-min/out.s > min_norm.s 2>/dev/null
sed 's#/root/work/win/#C:/#g' /root/work/test-cc/out.s > full_norm.s
if cmp -s min_norm.s full_norm.s; then echo "OUTPUT WITH ONLY THE 337 HEADERS: IDENTICAL to the full-SDK compile"; else echo "differs: $(diff min_norm.s full_norm.s | grep -c '^[<>]') lines"; diff min_norm.s full_norm.s | head -6 | cut -c1-200; fi
