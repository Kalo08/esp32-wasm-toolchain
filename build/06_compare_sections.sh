#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
B=/root/work/build-binutils-wasm
cd /root/work/test-as
rm -rf sec; mkdir sec
echo "== sections (from the native object), with file offsets"
node $B/binutils/readelf -SW sketch_native.o 2>&1 | grep -E '^\s*\[' | cut -c1-110 > sec/list.txt
cat sec/list.txt | head -40
echo
echo "== per-section comparison (native vs WebAssembly assembler)"
names=$(sed -n 's/^ *\[ *[0-9]*\] \([^ ]*\) .*/\1/p' sec/list.txt | grep -v '^$')
for n in $names; do
  safe=$(echo "$n" | tr '.' '_')
  node $B/binutils/objcopy --dump-section "$n=sec/n$safe" sketch_native.o /dev/null 2>/dev/null
  node $B/binutils/objcopy --dump-section "$n=sec/w$safe" sketch_wasm.o /dev/null 2>/dev/null
  if [ -f sec/n$safe ] && [ -f sec/w$safe ]; then
    sz=$(stat -c %s sec/n$safe)
    if cmp -s sec/n$safe sec/w$safe; then echo "same      $n ($sz bytes)"; else d=$(cmp -l sec/n$safe sec/w$safe | wc -l); echo "DIFFERENT $n ($sz bytes, $d differ)"; fi
  fi
done
