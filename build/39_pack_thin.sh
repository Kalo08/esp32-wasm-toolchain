#!/bin/bash
H=${CAPTURE_ROOT}
python3 $H/wasm/pack_thin.py $H/web
cp /root/work/webtool/ld.js /root/work/webtool/ld-new.wasm $H/web/
