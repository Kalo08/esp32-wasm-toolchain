#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
B=/root/work/build-binutils-wasm
cd /root/work/test-as
for o in native wasm; do node $B/binutils/readelf --debug-dump=rawline sketch_$o.o > raw_$o.txt 2>&1; done
echo "== lines in each dump: native $(wc -l < raw_native.txt), wasm $(wc -l < raw_wasm.txt)"
echo "== header + directory/file tables of the NATIVE object (first 28 lines)"
sed -n 1,28p raw_native.txt | cut -c1-200
echo
echo "== diff native vs wasm (first 24 differing lines)"
diff raw_native.txt raw_wasm.txt | head -24 | cut -c1-200
echo
echo "== number of differing lines in total: $(diff raw_native.txt raw_wasm.txt | grep -c '^[<>]')"
