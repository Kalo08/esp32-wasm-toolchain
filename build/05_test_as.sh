#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
R=${CAPTURE_ROOT}/wasm/ref
B=/root/work/build-binutils-wasm
W=/root/work/test-as; rm -rf $W; mkdir -p $W; cd $W
cp $R/sketch.s $R/sketch_native.o .
FLAGS=$(cat $R/as_flags.txt)
echo "node: $(node --version)   flags: $FLAGS"
echo "== version of the WebAssembly assembler"
node $B/gas/as-new --version 2>&1 | head -2
echo "== assemble sketch.s with the WebAssembly assembler"
( time node $B/gas/as-new $FLAGS -o sketch_wasm.o sketch.s ) 2>&1 | grep -vE "^$|^user|^sys" | head -20
echo "== results"
ls -l sketch_native.o sketch_wasm.o 2>&1 | awk '{print $5, $9}'
sha256sum sketch_native.o sketch_wasm.o 2>&1 | cut -c1-20,65-
if cmp -s sketch_native.o sketch_wasm.o; then echo "OBJECT FILES: IDENTICAL"; else echo "OBJECT FILES: DIFFER"; cmp sketch_native.o sketch_wasm.o | head -2; cmp -l sketch_native.o sketch_wasm.o 2>/dev/null | wc -l | xargs echo "differing bytes:"; fi
echo "== code section (.text) only"
for o in native wasm; do node $B/binutils/objcopy -O binary --only-section=.text sketch_$o.o text_$o.bin 2>&1 | head -2; done
ls -l text_native.bin text_wasm.bin 2>&1 | awk '{print $5, $9}'
if cmp -s text_native.bin text_wasm.bin; then echo ".text: IDENTICAL"; else echo ".text: DIFFER"; fi
