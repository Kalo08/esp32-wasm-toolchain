#!/bin/bash
set -e
cd /root/work
TAG=esp-2.43.1_20260121
if [ ! -d binutils-gdb ]; then
  git clone -q --depth 1 --branch $TAG https://github.com/espressif/binutils-gdb
fi
cd binutils-gdb
echo "== source: $(git describe --tags 2>/dev/null) $(du -sh . | cut -f1)"
echo "== dynconfig loader guards"
grep -nE "HAVE_DLFCN_H|HAVE_WINDOWS_H|ENABLE_PLUGINS|xtensa_load_config|getenv|abort" bfd/xtensa-dynconfig.c | head -30
echo "== where the compiled-in default config comes from"
grep -rn "xtensa_config_v1\b" --include=*.c --include=*.h bfd opcodes include 2>/dev/null | head -10
echo "== overlay files for binutils"
find /root/work/xtensa-overlays/xtensa_esp32s3/binutils -type f | sed 's#/root/work/xtensa-overlays/xtensa_esp32s3/binutils/##'
echo "== differences between the tree's current files and the S3 overlay's"
for f in bfd/xtensa-modules.c include/xtensa-config.h; do
  if [ -f "$f" ]; then echo "$f: tree=$(wc -l < $f) lines, overlay=$(wc -l < /root/work/xtensa-overlays/xtensa_esp32s3/binutils/$f) lines"; else echo "$f: not in tree"; fi
done
echo "== xtensa config names inside the overlay header"
grep -nE "XSHAL_CHIP_ID|XCHAL_HAVE_LOOPS|XCHAL_CORE_ID|XCHAL_ISA_" /root/work/xtensa-overlays/xtensa_esp32s3/binutils/include/xtensa-config.h | head -5
echo "== configure options mentioning xtensa / plugins"
grep -nE "xtensa-dynconfig|disable-plugins|enable-plugins" configure.ac bfd/configure.ac ld/configure.ac 2>/dev/null | head -8
