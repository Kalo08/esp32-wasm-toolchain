#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}/wasm
python3 $H/36_thin_link.py
cd /root/work/test-thin; ls -l link_wasm.elf 2>&1 | awk '{print $5, $9}'
if cmp -s link_wasm.elf $H/link_native.elf; then echo "THIN LINK: ELF BYTE-FOR-BYTE IDENTICAL to the native link"; elif [ -f link_wasm.elf ]; then echo "differs: $(cmp -l link_wasm.elf $H/link_native.elf | wc -l) bytes"; fi
