# Building the toolchain

[← back to the README](../README.md)

These are the scripts I actually ran to build and verify everything, in order.

> [!WARNING]
> They are a **record of a working recipe**, not a polished installer. They were written for one machine (Windows 11 + WSL 2
> Ubuntu 24.04, 16 threads, about 10 GB of disk), with paths under `/root/work` inside Ubuntu. Expect to adapt paths.

**Before you start:** `source build/env.sh`. It sets `CAPTURE_ROOT` and `NATIVEFS_TOOLS`, explained in step 0 and step 2.
Run each script in Ubuntu with `bash build/NN_name.sh`. Anything with quotes in a command line is a script on purpose:
quoting through PowerShell into `wsl bash -c` mangled arguments, so every step is a file.

**On this page:**
[0 · Ground truth](#step-0--a-native-build-to-compare-against-ground-truth) ·
[1 · Build machine](#step-1--the-build-machine) ·
[2 · Assembler and linker](#step-2--assembler-linker-objcopy-as-webassembly) ·
[3 · C++ compiler](#step-3--the-c-compiler-as-webassembly) ·
[4 · For the browser](#step-4--for-the-browser) ·
[5 · WiFi, HTTP, BLE](#step-5--wifi-http-and-ble-packs) ·
[Sample programs](#the-sample-programs) ·
[Reference ELF](#the-reference-elf-for-npm-test) ·
[Traps](#things-that-will-bite-you-all-of-them-did)

## Step 0 — a native build to compare against ("ground truth")

Everything is tested against what Espressif's *native* toolchain does for the same program. I built a blink sketch with
`arduino-cli` for the SparkFun ESP32-S3 Thing Plus (`esp32:esp32:sparkfun_esp32s3_thing_plus:CDCOnBoot=cdc`, ESP32 core
3.3.12, Espressif GCC 14.2.0), then captured exactly what the compiler driver runs.

- [`docs/ground-truth/`](../docs/ground-truth) holds the captured command lines (`1_sketch_compile_*`, `2_core_cpp_compile_*`,
  `4_link_*`, ...) and [`docs/GROUND_TRUTH.md`](../docs/GROUND_TRUTH.md) explains what they showed.
- `wrap.cjs` is a `gcc -wrapper` hook that records each program's full argument list (expanding `@files` with libiberty's
  rules). `capture_cc.mjs`, `capture_ld.mjs`, `make_s.mjs` and `native_fwd.mjs` use it to write the argument lists and
  reference outputs the tests need into **`CAPTURE_ROOT`** (`wasm/cc1_args.txt`, `wasm/ld_args.txt`, `wasm/ref/*`, `gt_build/`).
- The reference blink image is in [`../reference/`](../reference) (`gt_blink.ino.bin`, `flash_args`, the sketch).

> [!NOTE]
> The capture scripts are tied to the Windows machine they were captured on. For another machine, redo this step.

## Step 1 — the build machine

| Script | What it does |
|---|---|
| `01_setup.sh` | apt packages and Emscripten (`emsdk install latest`; I used 7.0.0) |
| `02_explore.sh` | clones `espressif/xtensa-overlays` and looks at the `xtensa_esp32s3` overlay |
| `03_fetch_binutils.sh` | Espressif binutils-gdb at tag `esp-2.43.1_20260121`; checks how the chip definition is loaded (`bfd/xtensa-dynconfig.c`) |

## Step 2 — assembler, linker, objcopy as WebAssembly

| Script | What it does |
|---|---|
| `04_build_binutils.sh` | copies the S3 overlay's two files in, configures with Emscripten, builds `as-new`, `ld-new`, `objcopy`. `ac_cv_func_psignal=yes` is needed (libiberty's `psignal` clashes with Emscripten's). Uses `-sNODERAWFS=1`, so the tools use real files under Node: these are the **`NATIVEFS_TOOLS`** the checks use |
| `05_test_as.sh`, `06_compare_sections.sh`, `07_debug_line.sh`, `08_test_fwd.sh` | assemble the native compiler's `.s` with the native and the WebAssembly assembler and compare. The first run differed in `.debug_line` only, because of one Windows backslash path in a `.file` directive; with forward slashes the objects are byte-identical |
| `09_test_ld.sh` | links the whole firmware with the WebAssembly `ld` (883 arguments, full SDK): byte-identical ELF |

## Step 3 — the C++ compiler as WebAssembly

| Script | What it does |
|---|---|
| `10_prep_gcc.sh` | Espressif GCC at tag `esp-14.2.0_20260121`, the S3 overlay's `gcc/include/xtensa-config.h`, a native Linux xtensa binutils (GCC's configure probes one), and GMP/MPFR/MPC built for WebAssembly |
| `13_build_gcc.sh`, `14_continue_gcc.sh` | configure and build `cc1plus` (and `cc1`). `gcov-tool` fails on `ftw` under WebAssembly and stops `make`; `make -k` finishes the compiler |
| `15_test_cc.sh`, `16_localize_and_run.sh`, `17_compare_s.sh`, `22_code_part.sh` | compile the sketch and compare the assembly with the native compiler's. Header folders must be on Ubuntu's disk, not `/mnt/c` (a run through the Windows bridge was still not finished after 25 minutes; on the local disk it took 5.5 s). Built-in include folders are passed explicitly (`-idirafter`) because the native compiler finds them relative to its install path |
| `18_sizes.sh`, `19_sizes2.sh`, `20_headers_used.sh`, `21_minimal.sh` | measure what the compiler reads (`-H`): 337 files, 5.2 MB for blink, and compile with only those |

## Step 4 — for the browser

| Script | What it does |
|---|---|
| `26_relink_web.sh`, `27_relink_bin.sh` | relink `cc1plus`, `as`, `ld` with `-sENVIRONMENT=web,worker,node -sMODULARIZE=1 -sFORCE_FILESYSTEM=1 -sEXIT_RUNTIME=0 -sEXPORTED_RUNTIME_METHODS=FS,callMain` and **no** `NODERAWFS`, so a Worker can drive them through the in-memory file system |
| `28_smoke.sh`, `smoke.cjs` | assemble a tiny S3 file with the relinked assembler |
| `30_pack_web.sh`, `pack_web.cjs`, `31_cmp_obj.sh` | pack the headers and arguments for the browser test; compare the browser's object with Node's |
| `32_ld_map.sh`, `33_analyze.sh`, `analyze_trace.py`, `35_compress.*` | link with a map file and list which library members were used; compress them |
| `36_thin_link.*`, `38_cmp_elf.sh`, `pack_thin.py`, `39_pack_thin.sh` | build the thin libraries and check the thin link gives the identical ELF |
| **`build_profile.py`**, `40_build_profile.sh`, `41_post_profile.sh`, `42_rebuild_all.sh` | the profile builder (below) |

### The profile builder

`build_profile.py` compiles the sample programs with the full header tree and links them against the full SDK with a map; keeps
only the members used; re-links against that and **requires an identical ELF**; then packs `headers`, `sdk` and `args.json`.
`41_post_profile.sh` copies in the tools and boot images, compresses everything and writes `manifest.json`.

What comes out is the profile folder `esp32s3-thingplus/`:

```
cc1plus.js / .wasm     as.js / as-new.wasm     ld.js / ld-new.wasm
headers.json / .bin    sdk.json / .bin         args.json
bootloader.bin         partitions.bin          boot_app0.bin          manifest.json         *.gz
```

That's what `src/cppworker.js` loads from `base`.

> [!IMPORTANT]
> **The sample programs decide what the thin SDK covers.** Add a sample that uses a feature (an RGB LED, tone, PWM, WiFi...) and
> rebuild, otherwise a program using it fails to link. I found this out when `rgbLedWrite` was missing.

## Step 5 — WiFi, HTTP and BLE packs

For libraries beyond the Arduino core, the native Arduino build of an example is the reference: its objects, its linker map and its ELF.
Build the examples natively for the same board (WiFiScan, BasicHttpsClient and BLE Server here), then:

| Script | What it does |
|---|---|
| `gather.py` | from each native build: the library include folders (`includes.cache`) and the link's input objects in order (the map's `LOAD` lines) |
| `verify_link.py` | rebuilds each program's link command from blink's with those objects and links against the **full** SDK: the ELF must equal the native one (it did, for all three) |
| `build_packs.py` | the union of SDK archive members used, then two thin SDK variants (`sdk` = base + BLE, `sdk-wifi` = everything), each re-linked against every program. Base samples must be byte-identical; the native examples are compared as flash images, because their own copy of the core was compiled at another time (`image_diff.mjs` allows only the build-timestamp bytes plus the checksum and digest to differ) |
| `build_libpacks.py` | for each feature (`wifi`, `http`, `ble`): the headers the sample reads plus every header in the library's source folders, and the library objects linked in the native order, debug info stripped with `objcopy` |
| `finalize_profile.py`, `41_post_profile.sh`, `post_manifest.py` | add the `features` section to `args.json`, install the packs, compress, and write `manifest.json` |
| `phase0.sh`, `trace_reads.cjs` | an experiment, not part of the build: which byte ranges of each library the linker really reads (used to judge loading libraries on demand) |

The Worker (`src/cppworker.js`) reads `args.json`'s `features`: a sketch's `#include` lines pick the packs, the pack's include
folders are added after the board's variant folder, and its objects are linked right after the sketch's. Library objects are passed
to the linker as objects, not as an archive, exactly as the Arduino tools do, so every object is linked.

## The sample programs

[`samples/*.cpp`](samples) are the five programs `build_profile.py` compiles and links to decide what the thin SDK holds:

| Sample | Exercises |
|---|---|
| `blink.cpp` | GPIO, `pause`, `Serial` output |
| `sensors.cpp` | ADC, pull-ups, PWM, vectors |
| `text_and_functions.cpp` | `String`, `snprintf`, C++ standard library, exceptions |
| `rgb.cpp` (`rgb.m`) | the on-board RGB LED (`rgbLedWrite`) |
| `io.cpp` (`io.m`) | tone, PWM, ADC, `rand`, timing |

They are C++ produced by KaloLab's MATLAB-to-C++ translator (`rgb.m` and `io.m` are the MATLAB sources of the last two); any
Arduino C++ works. Copy them to `$CAPTURE_ROOT/prof/` before running `40_build_profile.sh`.

## The reference ELF for `npm test`

`tests/elf2image.js` compares against the ELF the native toolchain links for blink. It is 6.8 MB and contains the paths of the
machine that built it, so **it isn't in the repository**. To use the full comparison, build the blink sketch natively (step 0)
and put its `.elf` at `reference/gt_blink.ino.elf`. The repository's `reference/gt_blink.ino.bin` must be the `.bin` made from
that same ELF, so rebuild both together if you change either.

## Things that will bite you (all of them did)

| Trap | What to do |
|---|---|
| GCC `@response` files follow libiberty's rules: a backslash **always** escapes the next character | parse them with libiberty's `buildargv` rules (`wrap.cjs` does) |
| The native compiler finds its built-in include folders relative to where it is installed | pass them explicitly (`-idirafter`) |
| Reading thousands of headers across the WSL `/mnt/c` bridge | copy them onto Ubuntu's own disk first |
| Windows assembly files have CRLF line endings | compare after stripping `\r` |
| A backslash in a `.file` path is a path separator to the Windows assembler only | write the path with forward slashes |
| Duplicate member names exist inside one archive (`libhal.a` has several `efuse_hal.c.obj`); `ar x` by name takes only the first | build thin archives by copying members, not by name |
| Emscripten's file system can't resolve `a/../b` when `a` doesn't exist | normalise `-L` and `--sysroot` paths |
| The browser can mix files from two toolchain builds | revalidate (`no-cache`), never a long `max-age` |
