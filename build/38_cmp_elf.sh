#!/bin/bash
H=${CAPTURE_ROOT}/wasm
ls -l --time-style=+%T /root/work/test-ld/link_wasm.elf $H/link_native.elf | awk '{print $5, $6, $7}'; date +%T
if cmp -s /root/work/test-ld/link_wasm.elf $H/link_native.elf; then echo "THIN LINK: ELF BYTE-FOR-BYTE IDENTICAL to the native link"; else echo "differs: $(cmp -l /root/work/test-ld/link_wasm.elf $H/link_native.elf | wc -l) bytes"; fi
