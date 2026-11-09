#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
cd /root/work/build-gcc-wasm
export PATH=/root/work/native/bin:$PATH
echo "== make -k ($(date +%T))"
emmake make -k -j16 MAKEINFO=true all-gcc > make2.log 2>&1
echo "make exit $? ($(date +%T))"
echo "== real errors"
grep -nE '(^|[^a-z_ ])error:|fatal error|undefined symbol|wasm-ld: error|\*\*\* \[' make2.log \
  | grep -vE 'write error|emcc: error: liblto_plugin|llvm-ar: error: unknown option|WARNING|Wno-|-Werror|Makeinfo' | head -12 | cut -c1-300
echo "== the compiler programs"
ls -la gcc/cc1plus gcc/cc1plus.wasm gcc/cc1 gcc/cc1.wasm gcc/xgcc gcc/xgcc.wasm gcc/g++.wasm gcc/collect2.wasm gcc/gcov-tool* 2>&1 | grep -v "No such" | awk '{print $5, $9}'
echo CONTINUE-DONE
