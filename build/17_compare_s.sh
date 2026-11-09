#!/bin/bash
cd /root/work/test-cc
echo "native has CR line endings: $(grep -c $'\r' native.s) of $(wc -l < native.s) lines"
tr -d '\r' < native.s > native_lf.s
echo "sizes: native(LF) $(stat -c %s native_lf.s)   wasm(path-normalised) $(stat -c %s out_norm.s)"
if cmp -s native_lf.s out_norm.s; then
  echo "ASSEMBLY OUTPUT: BYTE-FOR-BYTE IDENTICAL (ignoring Windows line endings)"
else
  echo "differing lines: $(diff native_lf.s out_norm.s | grep -c '^[<>]')"
  diff native_lf.s out_norm.s | head -30 | cut -c1-250
fi
