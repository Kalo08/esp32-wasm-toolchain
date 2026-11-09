#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
R=${CAPTURE_ROOT}/wasm/ref
B=/root/work/build-binutils-wasm
cd /root/work/test-as
cp $R/sketch_fwd.s $R/sketch_fwd_native.o .
node $B/gas/as-new $(cat $R/as_flags.txt) -o sketch_fwd_wasm.o sketch_fwd.s
ls -l sketch_fwd_native.o sketch_fwd_wasm.o | awk '{print $5, $9}'
sha256sum sketch_fwd_native.o sketch_fwd_wasm.o | cut -c1-24,65-
if cmp -s sketch_fwd_native.o sketch_fwd_wasm.o; then echo "BYTE-FOR-BYTE IDENTICAL OBJECT FILES"; else echo "STILL DIFFERENT: $(cmp -l sketch_fwd_native.o sketch_fwd_wasm.o | wc -l) bytes"; cmp sketch_fwd_native.o sketch_fwd_wasm.o | head -1; fi
