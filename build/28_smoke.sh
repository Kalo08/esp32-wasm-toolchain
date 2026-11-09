#!/bin/bash
cd ${CAPTURE_ROOT}/wasm
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
node smoke.cjs
