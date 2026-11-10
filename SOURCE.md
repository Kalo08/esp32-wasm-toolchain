# Source code and licences

[← back to the README](README.md)

This repository's own code (`src/`, `tests/`, `demo/`, `build/`, `docs/`) is **MIT**: see [`LICENSE`](LICENSE).

> [!IMPORTANT]
> The **WebAssembly builds** you get from the build scripts (or from a release) are made from other people's code, under
> their licences. **If you publish or redistribute the `.wasm` files you must also offer the corresponding source**, as the
> GPL requires. This file is that offer, and the checklist for releases.

## The GPL components: compiler, assembler, linker

| Tool | Built from | Licence |
|---|---|---|
| `cc1plus.wasm` (C++ compiler) | Espressif GCC, tag **`esp-14.2.0_20260121`** (GCC 14.2.0): https://github.com/espressif/gcc | GPL-3.0-or-later |
| `as-new.wasm`, `ld-new.wasm`, `objcopy` | Espressif binutils-gdb, tag **`esp-2.43.1_20260121`** (binutils 2.43.1): https://github.com/espressif/binutils-gdb | GPL-3.0-or-later |
| the ESP32-S3 chip definition compiled into the tools | `xtensa_esp32s3` from https://github.com/espressif/xtensa-overlays: `binutils/bfd/xtensa-modules.c` and `binutils/include/xtensa-config.h` (for binutils), `gcc/include/xtensa-config.h` (for GCC), copied over the same files in the trees above | see that repository |
| GMP 6.2.1, MPFR 4.1.0, MPC 1.2.1 (linked into `cc1plus.wasm`) | https://ftp.gnu.org/gnu/ | GMP: LGPL-3.0-or-later or GPL-2.0-or-later. MPFR and MPC: LGPL-3.0-or-later (check each tarball's `COPYING` files) |
| Emscripten runtime glue in the `.js` files | https://github.com/emscripten-core/emscripten (built with 7.0.0) | MIT and NCSA (see the Emscripten repository's `LICENSE`) |

### What counts as "corresponding source" for a release

1. the tags above,
2. the overlay files named above, and
3. the build scripts in [`build/`](build) at the matching version of this repository.

They use **no patches** beyond copying the overlay files and the configure setting `ac_cv_func_psignal=yes` (see
[`build/04_build_binutils.sh`](build/04_build_binutils.sh)). To meet the GPL when you host the binaries, keep this file with
them and link to the tags and to the commit of this repository the binaries were built from. If you change the tools,
publish your changes too.

## Data the compiler uses at run time (not GPL)

| Component | Licence | Notes |
|---|---|---|
| **Arduino core for ESP32** (headers, `core.a`): https://github.com/espressif/arduino-esp32 | LGPL-2.1 | |
| **ESP-IDF libraries and headers** inside the Arduino board package: https://github.com/espressif/esp-idf | Apache-2.0 | some precompiled libraries (for example the WiFi, Bluetooth and radio-calibration ones) may carry Espressif's own terms: check each file you redistribute |
| **newlib / libstdc++** (the C and C++ libraries) | BSD-style; GPL-3.0 with the GCC Runtime Library Exception | programs you build with the toolchain are not GPL because of it |
| **esptool-js** (`src/flash.js` imports it): https://github.com/espressif/esptool-js | Apache-2.0 | an npm dependency, not copied into this repository |

> [!TIP]
> The simplest safe way to publish is to **leave the SDK out of a release** and have people build that part locally from
> Espressif's own packages. See [`RELEASING.md`](RELEASING.md).

## Trademarks

Espressif, ESP32, Arduino and SparkFun are trademarks of their owners. This project is not made by or endorsed by them. Do
not name a release in a way that suggests it is.
