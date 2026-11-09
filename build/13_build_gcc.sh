#!/bin/bash
# Build Espressif's GCC 14.2 compiler proper (cc1plus, cc1) for the ESP32-S3 as WebAssembly.
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
cd /root/work
P=/root/work/wasm-prefix
rm -rf build-gcc-wasm && mkdir build-gcc-wasm && cd build-gcc-wasm
export PATH=/root/work/native/bin:$PATH
export CC_FOR_BUILD=gcc CXX_FOR_BUILD=g++ CFLAGS_FOR_BUILD="-O1" CXXFLAGS_FOR_BUILD="-O1"
export CFLAGS="-O2 -g0" CXXFLAGS="-O2 -g0"
export ac_cv_func_psignal=yes
export LDFLAGS="-sENVIRONMENT=node -sNODERAWFS=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=268435456 -sMAXIMUM_MEMORY=4294967296 -sSTACK_SIZE=16777216 -sEXIT_RUNTIME=1"

echo "== configure ($(date +%T))"
emconfigure ../gcc/configure \
  --build=x86_64-pc-linux-gnu --host=wasm32-unknown-emscripten --target=xtensa-esp-elf \
  --prefix=/root/work/gcc-wasm-install \
  --with-gmp=$P --with-mpfr=$P --with-mpc=$P \
  --enable-languages=c,c++ --disable-bootstrap --disable-nls --disable-multilib --disable-shared \
  --disable-threads --disable-plugin --disable-lto --disable-libgomp --disable-libquadmath --disable-libatomic \
  --disable-libssp --disable-libsanitizer --disable-libvtv --disable-libstdcxx --disable-werror \
  --with-newlib --without-headers --with-gnu-as --with-gnu-ld \
  --with-as=/root/work/native/bin/xtensa-esp-elf-as --with-ld=/root/work/native/bin/xtensa-esp-elf-ld \
  --with-pkgversion="crosstool-NG esp-14.2.0_20260121" > configure.log 2>&1 \
  || { echo "CONFIGURE FAILED"; grep -nE "configure: error|error:" configure.log | head -8 | cut -c1-260; tail -12 configure.log | cut -c1-200; exit 1; }
echo "configure ok ($(date +%T))"

echo "== make all-gcc ($(date +%T))"
emmake make -j16 MAKEINFO=true all-gcc > make.log 2>&1
rc=$?
echo "make exit $rc ($(date +%T))"
if [ $rc -ne 0 ]; then
  echo "== first real errors"
  grep -nE '(^|[^a-z])error:|\*\*\*|Error [0-9]|fatal error|undefined symbol|wasm-ld: error' make.log | grep -vE 'emcc: error: liblto_plugin|llvm-ar: error: unknown option|WARNING|Wno-' | head -14 | cut -c1-300
  exit 1
fi
ls -la gcc/cc1plus* gcc/cc1.wasm gcc/cc1 gcc/xgcc* 2>&1 | awk '{print $5, $9}' | head
echo GCC-BUILD-DONE
