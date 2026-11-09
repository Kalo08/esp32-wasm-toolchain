#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}/wasm
W=/root/work/test-ldmap; rm -rf $W; mkdir -p $W; cd $W
mapfile -t ARGS < $H/ld_args.txt
node --max-old-space-size=6000 ${NATIVEFS_TOOLS}/ld-new "${ARGS[@]}" -Map=$W/map.txt --trace > trace.txt 2>&1
echo "exit $?"; ls -l link_wasm.elf map.txt trace.txt 2>&1 | awk '{print $5, $9}'
