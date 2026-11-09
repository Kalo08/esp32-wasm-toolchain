#!/bin/bash
# Prepare to build GCC's compiler (cc1plus) as WebAssembly:
#   1. Espressif's GCC source at the tag matching the toolchain, with the S3 overlay
#   2. a NATIVE Linux xtensa assembler/linker (GCC's configure probes them; also a handy reference)
#   3. GMP, MPFR, MPC (libraries GCC needs) built for WebAssembly
set -e
cd /root/work
TAG=esp-14.2.0_20260121

echo "== 1. GCC source ($(date +%T))"
git ls-remote --tags https://github.com/espressif/gcc 2>/dev/null | grep -c "refs/tags/$TAG\$" | xargs echo "tag found (1 = yes):"
[ -d gcc ] || git clone -q --depth 1 --branch $TAG https://github.com/espressif/gcc 2>&1 | grep -v "^Note\|detached\|^$\|^You are\|^changes\|^state\|^do so\|^  git\|^Or undo\|^Turn off" | head -3
cp xtensa-overlays/xtensa_esp32s3/gcc/include/xtensa-config.h gcc/include/xtensa-config.h
echo "gcc source: $(du -sh gcc | cut -f1)"; (cd gcc && git status --short | head -3)

echo "== 2. native Linux binutils for xtensa-esp-elf ($(date +%T))"
if [ ! -x /root/work/native/bin/xtensa-esp-elf-as ]; then
  rm -rf build-binutils-native && mkdir build-binutils-native && cd build-binutils-native
  ../binutils-gdb/configure --target=xtensa-esp-elf --prefix=/root/work/native \
    --disable-gdb --disable-gdbserver --disable-sim --disable-gprof --disable-gprofng --disable-gold \
    --disable-libctf --disable-nls --disable-werror --disable-plugins > configure.log 2>&1
  make -j16 MAKEINFO=true all-gas all-ld all-binutils > make.log 2>&1
  make MAKEINFO=true install-gas install-ld install-binutils > install.log 2>&1
  cd ..
fi
/root/work/native/bin/xtensa-esp-elf-as --version | head -1

echo "== 3. GMP / MPFR / MPC for WebAssembly ($(date +%T))"
source /root/work/emsdk/emsdk_env.sh >/dev/null 2>&1
P=/root/work/wasm-prefix; mkdir -p $P src-libs
cd src-libs
get() { [ -f "$2" ] || curl -sSL -o "$2" "$1"; }
get https://ftp.gnu.org/gnu/gmp/gmp-6.2.1.tar.xz gmp-6.2.1.tar.xz
get https://ftp.gnu.org/gnu/mpfr/mpfr-4.1.0.tar.xz mpfr-4.1.0.tar.xz
get https://ftp.gnu.org/gnu/mpc/mpc-1.2.1.tar.gz mpc-1.2.1.tar.gz
ls -la *.tar.* | awk '{print $5, $9}'
for t in gmp-6.2.1.tar.xz mpfr-4.1.0.tar.xz mpc-1.2.1.tar.gz; do d=${t%.tar.*}; [ -d $d ] || tar xf $t; done
export CFLAGS="-O2 -g0"
if [ ! -f $P/lib/libgmp.a ]; then
  rm -rf b-gmp && mkdir b-gmp && cd b-gmp
  CC_FOR_BUILD=gcc emconfigure ../gmp-6.2.1/configure --build=x86_64-pc-linux-gnu --host=none --disable-assembly --disable-shared --enable-static --prefix=$P > c.log 2>&1 || { echo "GMP CONFIGURE FAILED"; tail -15 c.log; exit 1; }
  emmake make -j16 > m.log 2>&1 || { echo "GMP MAKE FAILED"; tail -15 m.log; exit 1; }
  emmake make install > i.log 2>&1; cd ..
fi
ls $P/lib | tr '\n' ' '; echo
if [ ! -f $P/lib/libmpfr.a ]; then
  rm -rf b-mpfr && mkdir b-mpfr && cd b-mpfr
  emconfigure ../mpfr-4.1.0/configure --build=x86_64-pc-linux-gnu --host=none --with-gmp=$P --disable-shared --enable-static --prefix=$P > c.log 2>&1 || { echo "MPFR CONFIGURE FAILED"; tail -15 c.log; exit 1; }
  emmake make -j16 > m.log 2>&1 || { echo "MPFR MAKE FAILED"; tail -15 m.log; exit 1; }
  emmake make install > i.log 2>&1; cd ..
fi
if [ ! -f $P/lib/libmpc.a ]; then
  rm -rf b-mpc && mkdir b-mpc && cd b-mpc
  emconfigure ../mpc-1.2.1/configure --build=x86_64-pc-linux-gnu --host=none --with-gmp=$P --with-mpfr=$P --disable-shared --enable-static --prefix=$P > c.log 2>&1 || { echo "MPC CONFIGURE FAILED"; tail -15 c.log; exit 1; }
  emmake make -j16 > m.log 2>&1 || { echo "MPC MAKE FAILED"; tail -15 m.log; exit 1; }
  emmake make install > i.log 2>&1; cd ..
fi
ls $P/lib | tr '\n' ' '; echo
echo PREP-DONE
