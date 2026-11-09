#!/bin/bash
# Relink cc1plus, as-new, ld-new with browser-friendly flags (MEMFS, MODULARIZE, worker)
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
W="-sENVIRONMENT=web,worker,node -sMODULARIZE=1 -sINVOKE_RUN=0 -sFORCE_FILESYSTEM=1 -sEXIT_RUNTIME=0 -sALLOW_MEMORY_GROWTH=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain"
cd /root/work/build-gcc-wasm/gcc && rm -f cc1plus cc1plus.wasm
emmake make cc1plus LDFLAGS="$W -sEXPORT_NAME=createCc1plus -sINITIAL_MEMORY=268435456 -sMAXIMUM_MEMORY=4294967296 -sSTACK_SIZE=16777216" > /root/work/relink_cc1plus.log 2>&1; echo "cc1plus exit $?"; ls -la cc1plus* 2>&1 | head
tail -5 /root/work/relink_cc1plus.log | cut -c1-300
