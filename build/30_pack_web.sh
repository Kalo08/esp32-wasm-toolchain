#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}
node $H/wasm/pack_web.cjs $H/web $H/wasm/cc1_args.txt
cp /root/work/webtool/cc1plus.js /root/work/webtool/cc1plus.wasm $H/web/
ls -l /root/work/test-min/out.s | awk '{print "reference out.s:", $5}'
sha256sum /root/work/test-min/out.s | cut -c1-16
grep -n "out.s" $H/web/cc1_args.json | head -2 | cut -c1-100; grep -o '"-o","[^"]*"\|"-auxbase[^,]*,"[^"]*"' $H/web/cc1_args.json | head
