# Source this before running the scripts in this folder:  source build/env.sh
# CAPTURE_ROOT: a folder holding what a native build of the same sketch produced (see build/README.md, "Step 0"):
#               wasm/cc1_args.txt, wasm/ld_args.txt, wasm/ref/..., gt_build/..., prof/*.cpp
# NATIVEFS_TOOLS: the three tools (cc1plus, as-new, ld-new) built with -sNODERAWFS=1 (scripts 04 and 13 do that);
#               they read and write real files under Node, which the byte-for-byte checks need.
export CAPTURE_ROOT="${CAPTURE_ROOT:-$HOME/esp32-wasm-capture}"
export NATIVEFS_TOOLS="${NATIVEFS_TOOLS:-$HOME/esp32-wasm-native-tools}"
echo "CAPTURE_ROOT=$CAPTURE_ROOT"; echo "NATIVEFS_TOOLS=$NATIVEFS_TOOLS"
