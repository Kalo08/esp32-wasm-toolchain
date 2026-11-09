#!/bin/bash
cd /root/work
# everything before the first debug-string label (.LASF...) is the code, data and debug tables
cut_at() { awk '/^\.LASF[0-9]+:/{exit} {print}' "$1"; }
cut_at test-cc/native_lf.s > /tmp/n.s
cut_at test-cc/out_norm.s > /tmp/f.s
cut_at test-min/min_norm.s > /tmp/m.s
echo "lines before the debug strings: native $(wc -l < /tmp/n.s), wasm(full SDK) $(wc -l < /tmp/f.s), wasm(337 headers) $(wc -l < /tmp/m.s)"
cmp -s /tmp/n.s /tmp/f.s && echo "native vs wasm (full SDK):    IDENTICAL" || echo "native vs wasm (full SDK):    DIFFER ($(diff /tmp/n.s /tmp/f.s | grep -c '^[<>]') lines)"
cmp -s /tmp/n.s /tmp/m.s && echo "native vs wasm (337 headers): IDENTICAL" || echo "native vs wasm (337 headers): DIFFER ($(diff /tmp/n.s /tmp/m.s | grep -c '^[<>]') lines)"
