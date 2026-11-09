#!/bin/bash
cd /root/work
echo "--- Espressif binutils tags (2.43 / esp-14.2)"
git ls-remote --tags https://github.com/espressif/binutils-gdb 2>/dev/null | sed 's#.*refs/tags/##' | grep -E '2\.43|esp-14\.2' | sort | tail -12
echo "--- Espressif binutils branches"
git ls-remote --heads https://github.com/espressif/binutils-gdb 2>/dev/null | sed 's#.*refs/heads/##' | grep -E 'esp|2\.4' | tail -8
echo "--- overlays"
rm -rf xtensa-overlays
git clone -q --depth 1 https://github.com/espressif/xtensa-overlays 2>&1 | tail -2
ls xtensa-overlays
echo "--- xtensa_esp32s3 contents"
find xtensa-overlays/xtensa_esp32s3 -maxdepth 4 | head -60
echo "--- sizes"
du -sh xtensa-overlays/xtensa_esp32s3
