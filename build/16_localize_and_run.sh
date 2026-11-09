#!/bin/bash
# Copy every folder the compiler searches onto Ubuntu's own disk (the Windows bridge is far too slow for
# thousands of small header files), then run the WebAssembly cc1plus from there.
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
pkill -f "gcc/cc1plus" 2>/dev/null
H=${CAPTURE_ROOT}/wasm
B=/root/work/build-gcc-wasm
M=/root/work/win
mapfile -t ARGS < $H/cc1_args.txt

if [ ! -d $M/Users ]; then
  echo "== copying the header folders ($(date +%T))"
  mkdir -p $M
  for a in "${ARGS[@]}"; do case "$a" in /mnt/c/*) realpath -m "$a";; esac; done | sort -u > /tmp/paths.txt
  awk 'BEGIN{prev=""} { if (prev != "" && index($0, prev "/") == 1) next; print; prev=$0 }' /tmp/paths.txt > /tmp/roots.txt
  echo "$(wc -l < /tmp/paths.txt) paths -> $(wc -l < /tmp/roots.txt) folders/files to copy"
  while read -r p; do
    dest="$M/${p#/mnt/c/}"
    if [ -d "$p" ]; then mkdir -p "$dest"; rsync -a "$p/" "$dest/"; elif [ -f "$p" ]; then mkdir -p "$(dirname "$dest")"; cp -a "$p" "$dest"; fi
  done < /tmp/roots.txt
  du -sh $M | cut -f1 | xargs echo "copied:"
  echo "copy done ($(date +%T))"
fi

W=/root/work/test-cc; rm -rf $W; mkdir -p $W; cd $W
# every Windows path now points at the local copy
LARGS=("${ARGS[@]//\/mnt\/c\//\/root\/work\/win\/}")
echo "== compiling with the WebAssembly cc1plus ($(date +%T))"
( time node --max-old-space-size=6000 $B/gcc/cc1plus "${LARGS[@]}" ) > cc_out.txt 2>&1
echo "exit status: $?  ($(date +%T))"
grep -vE "^$|^user|^sys" cc_out.txt | tail -12 | cut -c1-300
echo "== result"
ls -l out.s 2>&1 | awk '{print $5, $9}'
if [ -s out.s ]; then
  sed 's#/root/work/win/#C:/#g' out.s > out_norm.s
  cp $H/ref/sketch.s native.s
  echo "lines: native $(wc -l < native.s), wasm $(wc -l < out_norm.s)"
  if cmp -s native.s out_norm.s; then echo "ASSEMBLY OUTPUT: BYTE-FOR-BYTE IDENTICAL"; else echo "ASSEMBLY OUTPUT DIFFERS: $(diff native.s out_norm.s | grep -c '^[<>]') differing lines"; diff native.s out_norm.s | head -24 | cut -c1-230; fi
fi
