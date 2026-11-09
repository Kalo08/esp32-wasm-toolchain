#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}/wasm
B=/root/work/build-binutils-wasm
W=/root/work/test-ld; rm -rf $W; mkdir -p $W; cd $W
mapfile -t ARGS < $H/ld_args.txt
echo "== linking with the WebAssembly ld: ${#ARGS[@]} arguments ($(date +%T))"
( time node --max-old-space-size=6000 $B/ld/ld-new "${ARGS[@]}" ) > ld_out.txt 2>&1
echo "exit status: $?  ($(date +%T))"
grep -vE "^$|^user|^sys" ld_out.txt | tail -15 | cut -c1-260
echo "== result"
ls -l link_wasm.elf 2>&1 | awk '{print $5, $9}'
sha256sum link_wasm.elf 2>&1 | cut -c1-16
echo "native ELF sha (first 16): 224f616f446e1ee3, size 6883032"
if [ -f link_wasm.elf ] && cmp -s link_wasm.elf $H/link_native.elf; then echo "ELF FILES: BYTE-FOR-BYTE IDENTICAL"; elif [ -f link_wasm.elf ]; then echo "ELF FILES DIFFER: $(cmp -l link_wasm.elf $H/link_native.elf | wc -l) bytes"; fi
