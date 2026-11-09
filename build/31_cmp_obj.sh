#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}/web/saved
mkdir -p /root/work/cmp && cd /root/work/cmp && cp $H/browser_out.s t.s $H/browser_out.o . 2>/dev/null; cp $H/browser_out.s t.s
node ${NATIVEFS_TOOLS}/as-new --gdwarf-4 --traditional-format --longcalls -o node.o t.s
ls -l node.o browser_out.o | awk '{print $5, $9}'
if cmp -s node.o browser_out.o; then echo "OBJECT FILES: BYTE-FOR-BYTE IDENTICAL (browser vs Node)"; else echo "differ: $(cmp -l node.o browser_out.o | wc -l) bytes"; fi
