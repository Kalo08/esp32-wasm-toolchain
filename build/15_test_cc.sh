#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}/wasm
B=/root/work/build-gcc-wasm
W=/root/work/test-cc; rm -rf $W; mkdir -p $W; cd $W
mapfile -t ARGS < $H/cc1_args.txt
echo "== compiling the sketch with the WebAssembly cc1plus: ${#ARGS[@]} arguments ($(date +%T))"
( time node --max-old-space-size=6000 $B/gcc/cc1plus "${ARGS[@]}" ) > cc_out.txt 2>&1
echo "exit status: $?  ($(date +%T))"
grep -vE "^$|^user|^sys" cc_out.txt | tail -12 | cut -c1-300
echo "== result"
ls -l out.s 2>&1 | awk '{print $5, $9}'
if [ -f out.s ]; then
  sed 's#/mnt/c/#C:/#g' out.s > out_norm.s
  cp $H/ref/sketch.s native.s
  echo "lines: native $(wc -l < native.s), wasm $(wc -l < out_norm.s)"
  if cmp -s native.s out_norm.s; then echo "ASSEMBLY OUTPUT: BYTE-FOR-BYTE IDENTICAL"; else echo "ASSEMBLY OUTPUT DIFFERS: $(diff native.s out_norm.s | grep -c '^[<>]') differing lines"; diff native.s out_norm.s | head -20 | cut -c1-220; fi
fi
