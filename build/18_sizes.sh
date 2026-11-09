#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}/wasm
B=/root/work/build-gcc-wasm
M=/root/work/win
mapfile -t ARGS < $H/cc1_args.txt
LARGS=("${ARGS[@]//\/mnt\/c\//\/root\/work\/win\/}")
W=/root/work/test-h; rm -rf $W; mkdir -p $W; cd $W

echo "== which headers does the compiler really read for this sketch? (-H)"
node --max-old-space-size=6000 $B/gcc/cc1plus "${LARGS[@]}" -H -o $W/out.s > $W/h_out.txt 2>&1
grep -E '^\.+ ' $W/h_out.txt | sed 's/^\.* //' | sort -u > used.txt
echo "distinct header files read: $(wc -l < used.txt)"
tot=0; while read -r f; do s=$(stat -c %s "$f" 2>/dev/null || echo 0); tot=$((tot+s)); done < used.txt
echo "their total size: $((tot/1024)) KB"
# the folders those headers live in (to see what a minimal bundle needs)
sed 's#/[^/]*$##' used.txt | sort | uniq -c | sort -rn | head -6 | sed 's#/root/work/win/Users/USER/AppData/Local/##' | cut -c1-170

echo "== the mirror I copied (everything the -I list points at)"
du -sh $M | cut -f1 | xargs echo "total:"
du -h --max-depth=7 $M 2>/dev/null | sort -rh | head -6 | sed 's#/root/work/win/Users/USER/AppData/Local/##' | cut -c1-150

echo "== compressed sizes (Brotli, the best a web server offers)"
cat > /tmp/br.js <<'EOF'
const fs = require('fs'), zlib = require('zlib');
for (const f of process.argv.slice(2)) {
  const b = fs.readFileSync(f);
  const t = Date.now();
  const c = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: b.length } });
  console.log(String((b.length / 1048576).toFixed(1)).padStart(6) + ' MB -> ' + String((c.length / 1048576).toFixed(1)).padStart(5) + ' MB   ' + f.replace('/root/work/', ''));
}
EOF
node /tmp/br.js $B/gcc/cc1plus.wasm /root/work/build-binutils-wasm/gas/as-new.wasm /root/work/build-binutils-wasm/ld/ld-new.wasm /root/work/build-binutils-wasm/binutils/objcopy.wasm
echo "== the headers actually used, as one archive"
tar -cf /tmp/used_headers.tar -T used.txt 2>/dev/null
node /tmp/br.js /tmp/used_headers.tar
