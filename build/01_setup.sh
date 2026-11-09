#!/bin/bash
# Step 1: build tools + Emscripten (turns C into WebAssembly), inside the Ubuntu WSL distro.
set -e
export DEBIAN_FRONTEND=noninteractive
echo "== apt packages"
apt-get update -qq
apt-get install -y -qq build-essential git python3 python3-venv xz-utils cmake ninja-build texinfo bison flex \
  libgmp-dev libmpfr-dev libmpc-dev libisl-dev wget curl ca-certificates unzip file rsync pkg-config nodejs
mkdir -p /root/work
cd /root/work
echo "== emsdk"
[ -d emsdk ] || git clone --depth 1 https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh >/dev/null 2>&1
echo "== versions"
emcc --version | head -1
node --version
gcc --version | head -1
echo SETUP-DONE
