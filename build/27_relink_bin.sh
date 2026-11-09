#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
W="-sENVIRONMENT=web,worker,node -sMODULARIZE=1 -sINVOKE_RUN=0 -sFORCE_FILESYSTEM=1 -sEXIT_RUNTIME=0 -sALLOW_MEMORY_GROWTH=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain -sINITIAL_MEMORY=134217728 -sSTACK_SIZE=8388608"
B=/root/work/build-binutils-wasm
cd $B/gas && rm -f as-new as-new.wasm && emmake make as-new LDFLAGS="$W -sEXPORT_NAME=createAs" >/root/work/relink_as.log 2>&1; echo "as $?"
cd $B/ld && rm -f ld-new ld-new.wasm && emmake make ld-new LDFLAGS="$W -sEXPORT_NAME=createLd" >/root/work/relink_ld.log 2>&1; echo "ld $?"
OUT=/root/work/webtool; rm -rf $OUT; mkdir -p $OUT
cp /root/work/build-gcc-wasm/gcc/cc1plus $OUT/cc1plus.js; cp /root/work/build-gcc-wasm/gcc/cc1plus.wasm $OUT/
cp $B/gas/as-new $OUT/as.js; cp $B/gas/as-new.wasm $OUT/; cp $B/ld/ld-new $OUT/ld.js; cp $B/ld/ld-new.wasm $OUT/
sed -i 's/as-new\.wasm/as-new.wasm/' $OUT/as.js
ls -la $OUT; grep -o 'as-new.wasm\|ld-new.wasm\|cc1plus.wasm' $OUT/*.js | sort | uniq -c
