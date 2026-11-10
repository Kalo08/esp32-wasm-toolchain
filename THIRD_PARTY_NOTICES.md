# Third-party notices

[← back to the README](README.md)

This repository's own code is MIT ([`LICENSE`](LICENSE)). The software below isn't part of the repository's source, but it is
what the build scripts download, build or load, and what a release of the built toolchain contains.

> [!NOTE]
> Licence names are what each project states. **Check the licence files in the exact version you redistribute:** this list is
> a guide, not a legal opinion. For the GPL source offer see [`SOURCE.md`](SOURCE.md).

Legend: ✅ the licence as I understand it, **not independently verified against each project's files** · ⚠️ **not looked at at
all**: read it before redistributing.

## The compiler, assembler and linker (built into the `.wasm` files)

| | Component | Used for | Licence | Source |
|---|---|---|---|---|
| ✅ | GCC, Espressif fork, tag `esp-14.2.0_20260121` | `cc1plus.wasm` | GPL-3.0-or-later, plus the GCC Runtime Library Exception for the runtime libraries | https://github.com/espressif/gcc |
| ✅ | GNU binutils, Espressif fork, tag `esp-2.43.1_20260121` | `as-new.wasm`, `ld-new.wasm`, `objcopy` | GPL-3.0-or-later | https://github.com/espressif/binutils-gdb |
| ✅ | xtensa-overlays, `xtensa_esp32s3` | the chip definition compiled into the tools | see the repository | https://github.com/espressif/xtensa-overlays |
| ✅ | GMP 6.2.1 | linked into `cc1plus.wasm` | LGPL-3.0-or-later or GPL-2.0-or-later | https://gmplib.org |
| ✅ | MPFR 4.1.0 | linked into `cc1plus.wasm` | LGPL-3.0-or-later | https://www.mpfr.org |
| ✅ | MPC 1.2.1 | linked into `cc1plus.wasm` | LGPL-3.0-or-later | https://www.multiprecision.org/mpc |
| ✅ | Emscripten 7.0.0 | build tool; its runtime glue is in the `.js` files | MIT and NCSA | https://github.com/emscripten-core/emscripten |

## Libraries and data linked into the programs you build

| | Component | Used for | Licence | Source |
|---|---|---|---|---|
| ✅ | libstdc++, newlib (from the Espressif toolchain) | C++ and C libraries | GPL-3.0 with the GCC Runtime Library Exception; BSD-style | https://github.com/espressif/newlib-esp32 |
| ✅ | Arduino core for ESP32 (3.3.12) | headers; `core.a` members | LGPL-2.1 | https://github.com/espressif/arduino-esp32 |
| ✅ | ESP-IDF libraries and headers (inside the Arduino board package) | headers; library members; bootloader and partition table | mostly Apache-2.0 | https://github.com/espressif/esp-idf |
| ⚠️ | **Espressif precompiled libraries** (for example `libbtdm_app`, the radio and WiFi libraries) | some members are linked into the thin SDK | **Espressif's own terms** | the same board package |

## Other

| | Component | Used for | Licence | Source |
|---|---|---|---|---|
| ✅ | esptool-js | flashing (`src/flash.js`; an npm dependency, not copied here) | Apache-2.0 | https://github.com/espressif/esptool-js |
| ✅ | Comfortaa, Lexend (fonts) | embedded in `docs/design-journal.docx` and the figures | SIL Open Font License 1.1 | https://fonts.google.com |

## Notes

- **Your programs aren't made GPL by the compiler.** The GCC Runtime Library Exception covers libgcc and libstdc++.
- **The Arduino core is LGPL-2.1.** If you *distribute firmware* built with it, its terms apply to you (users must be able to
  relink with a modified core). That is a duty of whoever ships the firmware, not of this repository.
- **The thin SDK may include members of Espressif's precompiled libraries.** Don't publish SDK files in a release until you've
  read their licences ([`RELEASING.md`](RELEASING.md)).
- Espressif, ESP32, Arduino and SparkFun are trademarks of their owners; this project is independent of them.
