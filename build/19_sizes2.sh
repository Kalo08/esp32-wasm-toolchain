#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
W=/root/work/test-h
echo "== start of the -H output"
head -4 $W/h_out.txt | cut -c1-200
echo "== lines in it: $(wc -l < $W/h_out.txt)"
echo "== biggest folders in the copy"
du -h --max-depth=9 /root/work/win/Users/USER/AppData/Local/Arduino15/packages/esp32 2>/dev/null | sort -rh | head -9 | sed 's#/root/work/win/Users/USER/AppData/Local/Arduino15/packages/esp32#.#' | cut -c1-120
