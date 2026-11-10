# Third-party notices

[← back to the README](README.md)

This repository's own code is MIT ([`LICENSE`](LICENSE)). The software below isn't part of the repository's source, but it is
what the build scripts download, build or load, and what a release of the built toolchain contains.

> [!NOTE]
> Licence names are what each project states. **Check the licence files in the exact version you redistribute:** this list is
> a guide, not a legal opinion. For the GPL source offer see [`SOURCE.md`](SOURCE.md).

Status column: **Partly reviewed** means I read the project's own public statement (see [`docs/LICENCE_REVIEW.md`](docs/LICENCE_REVIEW.md)). **As understood** means the licence as I understand it, *not independently verified against each project's files*. **Not reviewed** means I haven't looked at it at all: read it before redistributing.

## The compiler, assembler and linker (built into the `.wasm` files)

| Status | Component | Used for | Licence | Source |
|---|---|---|---|---|
| As understood | GCC, Espressif fork, tag `esp-14.2.0_20260121` | `cc1plus.wasm` | GPL-3.0-or-later, plus the GCC Runtime Library Exception for the runtime libraries | https://github.com/espressif/gcc |
| As understood | GNU binutils, Espressif fork, tag `esp-2.43.1_20260121` | `as-new.wasm`, `ld-new.wasm`, `objcopy` | GPL-3.0-or-later | https://github.com/espressif/binutils-gdb |
| As understood | xtensa-overlays, `xtensa_esp32s3` | the chip definition compiled into the tools | see the repository | https://github.com/espressif/xtensa-overlays |
| As understood | GMP 6.2.1 | linked into `cc1plus.wasm` | LGPL-3.0-or-later or GPL-2.0-or-later | https://gmplib.org |
| As understood | MPFR 4.1.0 | linked into `cc1plus.wasm` | LGPL-3.0-or-later | https://www.mpfr.org |
| As understood | MPC 1.2.1 | linked into `cc1plus.wasm` | LGPL-3.0-or-later | https://www.multiprecision.org/mpc |
| As understood | Emscripten 7.0.0 | build tool; its runtime glue is in the `.js` files | MIT and NCSA | https://github.com/emscripten-core/emscripten |

## Libraries and data linked into the programs you build

| Status | Component | Used for | Licence | Source |
|---|---|---|---|---|
| As understood | libstdc++, newlib (from the Espressif toolchain) | C++ and C libraries | GPL-3.0 with the GCC Runtime Library Exception; BSD-style | https://github.com/espressif/newlib-esp32 |
| As understood | Arduino core for ESP32 (3.3.12) | headers; `core.a` members | LGPL-2.1 | https://github.com/espressif/arduino-esp32 |
| As understood | Arduino libraries for ESP32 (WiFi, Network, NetworkClientSecure, HTTPClient, WebServer, FS, Wire, SPI), from the same package | compiled objects and headers in the feature packs (`pack-*`) | LGPL-2.1 (a file with no header falls under the project's `LICENSE.md`); some files of FS are Apache-2.0 | https://github.com/espressif/arduino-esp32/tree/master/libraries |
| As understood | Arduino libraries for ESP32: BLE, Preferences, Hash | the same | Apache-2.0 (BLE: 58 of 60 files, with two MIT; Preferences and Hash: every file) | the same |
| As understood | Arduino library ESPmDNS | the same | MIT (both files carry it) | the same |
| As understood | ESP-IDF libraries and headers (inside the Arduino board package) | headers; library members; bootloader and partition table | mostly Apache-2.0 | https://github.com/espressif/esp-idf |
| Partly reviewed | **Espressif precompiled radio libraries** (`libphy`, the Wi-Fi libraries, `libbtdm_app`) | some members are linked into the thin SDK | Apache-2.0, per the README and `LICENSE` of Espressif's `esp-phy-lib`, `esp32-wifi-lib` and `esp32-bt-lib`. The Arduino SDK package that ships them states **no licence**, and I could not match each file to those repositories: see [`docs/LICENCE_REVIEW.md`](docs/LICENCE_REVIEW.md) | https://github.com/espressif/esp32-wifi-lib |
| As understood | Bluedroid (`libbt`), protobuf-c, cJSON, network_provisioning, esp_diagnostics, nvs_sec_provider (inside the SDK) | library members in the thin SDK | Apache-2.0 (Bluedroid, network_provisioning, esp_diagnostics, nvs_sec_provider), BSD-2-Clause (protobuf-c), MIT (cJSON): read from each project's public files, see [`docs/LICENCE_REVIEW.md`](docs/LICENCE_REVIEW.md) | https://github.com/espressif/esp-idf |

## Other

| Status | Component | Used for | Licence | Source |
|---|---|---|---|---|
| As understood | esptool-js | flashing (`src/flash.js`; an npm dependency, not copied here) | Apache-2.0 | https://github.com/espressif/esptool-js |
| As understood | Comfortaa, Lexend (fonts) | embedded in `docs/design-journal.docx` | SIL Open Font License 1.1 | https://fonts.google.com |

## Modifications made to third-party files (notice)

The Apache-2.0 and LGPL-2.1 licences ask that changes to a work be stated. As of 10 November 2026, this project makes these changes to
the files it redistributes. Nothing else is altered: no source code is edited, and the library code and headers keep their copyright
and licence notices.

| What | Change |
|---|---|
| Arduino library objects in the `pack-*` files (compiled from the `WiFi`, `Network`, `NetworkClientSecure`, `HTTPClient`, `BLE`, `Wire`, `SPI`, `Preferences`, `WebServer`, `ESPmDNS`, `FS` and `Hash` libraries of arduino-esp32 3.3.12; the packs are `pack-wifi`, `pack-http`, `pack-ble`, `pack-wire`, `pack-spi`, `pack-prefs`, `pack-web`) | the debug information was removed from the compiled object files (`objcopy --strip-debug`); the code and data are otherwise as the Arduino tools compiled them |
| the SDK archives in `sdk.*` and `sdk-wifi.*` (from the `esp32s3-libs` package, the toolchain's C and C++ libraries, and the Arduino core's `core.a`) | each archive was repacked to hold only the members that the supported programs link; the member files themselves are unchanged, and archives for libraries no program uses are empty |
| headers in `headers.*` and the packs | copied unchanged |
| the compiler, assembler and linker | built to WebAssembly from the Espressif sources named in `SOURCE.md`, with the S3 chip definition from `xtensa-overlays` compiled in |

A release that includes these files should carry this notice with them.

## Notes

- **Your programs aren't made GPL by the compiler.** The GCC Runtime Library Exception covers libgcc and libstdc++.
- **The Arduino core is LGPL-2.1.** If you *distribute firmware* built with it, its terms apply to you (users must be able to
  relink with a modified core). That is a duty of whoever ships the firmware, not of this repository.
- **The thin SDK includes members of Espressif's precompiled libraries.** Espressif states Apache-2.0 for them, but the Arduino package
  has no licence file of its own: read [`docs/LICENCE_REVIEW.md`](docs/LICENCE_REVIEW.md) and its open points before publishing SDK files.
- Espressif, ESP32, Arduino and SparkFun are trademarks of their owners; this project is independent of them.
