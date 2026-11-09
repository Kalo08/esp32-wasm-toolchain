#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}
python3 -u $H/wasm/build_profile.py /mnt/c/Users/USER/Downloads/git/KaloLab/toolchain/esp32s3-thingplus blink,sensors,text_and_functions,rgb,io
