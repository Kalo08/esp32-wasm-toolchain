#!/bin/bash
# Build Espressif's binutils 2.43.1 (as, ld, objcopy) for the ESP32-S3 as WebAssembly, with the
# S3's chip configuration compiled in (no xtensa_esp32s3.so, no dlopen).
set -e
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
cd /root/work

echo "== applying the xtensa_esp32s3 overlay"
O=xtensa-overlays/xtensa_esp32s3/binutils
cp $O/bfd/xtensa-modules.c binutils-gdb/bfd/xtensa-modules.c
cp $O/include/xtensa-config.h binutils-gdb/include/xtensa-config.h
(cd binutils-gdb && git status --short | head)

rm -rf build-binutils-wasm && mkdir build-binutils-wasm && cd build-binutils-wasm
export CC_FOR_BUILD=gcc CXX_FOR_BUILD=g++ CFLAGS_FOR_BUILD="-O1"
export CFLAGS="-O2 -g0" CXXFLAGS="-O2 -g0"
# Emscripten's libc already has psignal(); libiberty's own copy would conflict with its declaration
export ac_cv_func_psignal=yes
export LDFLAGS="-sENVIRONMENT=node -sNODERAWFS=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=134217728 -sSTACK_SIZE=8388608 -sEXIT_RUNTIME=1"

echo "== configure ($(date +%T))"
emconfigure ../binutils-gdb/configure \
  --build=x86_64-pc-linux-gnu --host=wasm32-unknown-emscripten --target=xtensa-esp-elf \
  --disable-gdb --disable-gdbserver --disable-sim --disable-gprof --disable-gprofng --disable-gold \
  --disable-libctf --disable-nls --disable-werror --disable-plugins --disable-shared --enable-static \
  --without-debuginfod --without-msgpack --without-zstd --disable-readline --disable-libbacktrace \
  --enable-ld --enable-gas --enable-binutils > configure.log 2>&1 || { echo "CONFIGURE FAILED"; tail -30 configure.log; exit 1; }
echo "configure ok ($(date +%T))"

echo "== make ($(date +%T))"
emmake make -j16 MAKEINFO=true all-gas all-ld all-binutils > make.log 2>&1 || { echo "MAKE FAILED"; grep -nE '(^|[^a-z])error:|\*\*\*|Error [0-9]' make.log | grep -vE 'emcc: error: liblto_plugin|llvm-ar: error: unknown option|WARNING' | head -15 | cut -c1-300; exit 1; }
echo "make ok ($(date +%T))"
ls -la gas/as-new* ld/ld-new* binutils/objcopy* 2>&1 | head
echo BUILD-DONE
