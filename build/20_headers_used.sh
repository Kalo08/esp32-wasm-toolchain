#!/bin/bash
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
H=${CAPTURE_ROOT}/wasm
B=/root/work/build-gcc-wasm
mapfile -t ARGS < $H/cc1_args.txt
LARGS=("${ARGS[@]//\/mnt\/c\//\/root\/work\/win\/}")
W=/root/work/test-h; rm -rf $W; mkdir -p $W; cd $W
sed -i 's#/root/work/test-cc/#/root/work/test-h/#' /dev/null
# -H prints every header it opens ("." = included from the sketch, ".." = from one of those, ...)
node --max-old-space-size=6000 $B/gcc/cc1plus "${LARGS[@]}" -H > $W/h_out.txt 2>&1
echo "output lines: $(wc -l < h_out.txt)"
grep -E '^\.+ ' h_out.txt | sed 's/^\.* //' | sort -u > used.txt
echo "distinct header files read: $(wc -l < used.txt)"
tot=0; while read -r f; do s=$(stat -c %s "$f" 2>/dev/null || echo 0); tot=$((tot+s)); done < used.txt
echo "their total size: $((tot/1024)) KB"
echo "== by folder (count)"
sed 's#/[^/]*$##' used.txt | sed 's#/root/work/win/Users/USER/AppData/Local/##' | awk -F/ '{ if ($0 ~ /esp32s3-libs/) print "esp32s3-libs SDK (" $5 "/...)"; else if ($0 ~ /esp-x32/) print "compiler headers (esp-x32)"; else if ($0 ~ /hardware\/esp32/) print "Arduino core (hardware/esp32)"; else print "sketch" }' | sort | uniq -c | sort -rn
cat > /tmp/br.js <<'EOF'
const fs = require('fs'), zlib = require('zlib');
const b = fs.readFileSync(process.argv[2]);
const c = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } });
console.log((b.length / 1048576).toFixed(1) + ' MB -> ' + (c.length / 1048576).toFixed(1) + ' MB Brotli');
EOF
tar -cf /tmp/used_headers.tar -T used.txt 2>/dev/null
echo "== the headers this sketch needs, as one archive:"
node /tmp/br.js /tmp/used_headers.tar
echo "== still compiles with ONLY those headers?"
rm -rf /root/work/min && mkdir -p /root/work/min
while read -r f; do d=/root/work/min/${f#/root/work/win/}; mkdir -p "$(dirname "$d")"; cp "$f" "$d"; done < used.txt
echo "copied $(find /root/work/min -type f | wc -l) files"
