# esp32-wasm-toolchain

Compile Arduino C++ for the **ESP32-S3** and flash it **from a web page**: no server-side compiler, no desktop app,
no Arduino IDE. Espressif's own GCC 14.2 and binutils 2.43 are built as WebAssembly and run in a Web Worker; a small
JavaScript `elf2image` makes the flashable image; [esptool-js](https://github.com/espressif/esptool-js) writes it over
Web Serial.

```
 C++  ──cc1plus──▶  assembly  ──as──▶  object  ──ld + SDK libraries──▶  ELF  ──elf2image──▶  image  ──esptool-js──▶  board
        (WebAssembly, in a Worker)                                          (JavaScript)        (Web Serial)
```

It started as the "Flash as C++" feature of KaloLab (a MATLAB-like environment), and
was split out because nothing like it seemed to exist: I found no published GCC C++ compiler for Xtensa running as
WebAssembly. The full story, with every decision and dead end, is in [`docs/design-journal.docx`](docs/design-journal.docx).

> **Status: beta. Read "What is and isn't verified" before relying on it.**

## What is and isn't verified

Verified (on one PC, with the SparkFun ESP32-S3 Thing Plus board definition, Arduino-ESP32 core 3.3.12):

| Stage | Result |
|---|---|
| Assemble (`as-new.wasm`) | **byte-for-byte identical** object file to the native Espressif assembler (after one path was written with forward slashes) |
| Link (`ld-new.wasm`) | **byte-for-byte identical** 6,883,032-byte ELF to the native link, from 883 arguments and the full SDK |
| Link against a *thin* SDK (only the archive members the sample programs use) | byte-for-byte identical ELF, 5 sample programs |
| Compile (`cc1plus.wasm`) | the first 5,600 of 6,297 lines of assembly are identical to the native compiler's; the other 16 lines are debug-info strings (compiler flag list, working-folder path) |
| `elf2image` | **byte-for-byte identical** to `esptool elf2image` for the blink ELF (`npm test`, see below) |
| Whole pipeline in a browser | a blink sketch goes C++ → flashable image in about 13 s in a Chromium Worker; the image differs from the native one only in the embedded ELF hash (32 bytes), the checksum (1) and the image digest (32), because the ELF's debug paths differ |

**Not verified:**
- **Nothing in this repository has been confirmed running on a physical board yet.** The images are built and checked against the native toolchain's, but the final step (`src/flash.js` → Web Serial → the chip booting your program) is untested here. Please report what you see.
- Only the SparkFun ESP32-S3 Thing Plus profile has been built. Other S3 boards need their own capture (`build/README.md`).
- Browsers other than Chromium (Safari and Firefox have no Web Serial), phones, slow or low-memory machines.
- A program that needs more than the Arduino core, Serial, GPIO, PWM, ADC and the C++ standard library (WiFi, Bluetooth, other libraries) fails at the **link** step with undefined references, because the libraries in the bundle are cut down to what the sample programs use (see "Thin SDK").

## Sizes

| | Uncompressed | Compressed |
|---|---|---|
| `cc1plus.wasm` | 18.1–21 MB | 5–6.5 MB |
| `as-new.wasm`, `ld-new.wasm` | 1.1, 1.4 MB | 0.4, 0.4 MB |
| headers (the 364 files a translated program reads) | 5.7 MB | 0.9 MB |
| thin SDK libraries | 24 MB | 6.8 MB (gzip) / about 4 MB (xz) |
| **download in total** | about 50 MB | **about 16 MB gzipped** |

For comparison the whole ESP32-S3 SDK is 243 MB of libraries (67 MB gzipped); a blink needs 22.6 MB of it.

## Use it

You need the toolchain files (see "Build the toolchain") served as static files, then:

```js
import { buildCpp } from './src/cppbuild.js';
import { flashImages } from './src/flash.js';        // needs esptool-js (npm i) and a bundler

const { images } = await buildCpp(sketchText, (stage) => console.log(stage), { base: '/toolchain/esp32s3-thingplus/' });
const port = await navigator.serial.requestPort();   // Chrome or Edge
await flashImages(port, images, { onProgress: (fraction, phase) => {} });
```

`buildCpp` runs the Worker in `src/cppworker.js`; `images` is the bootloader, partition table, `boot_app0` and your
program, each with its flash address. A `.ino` sketch needs `#include <Arduino.h>` and function prototypes added first,
as the Arduino tools do: `inoToCpp(name, text)` in `src/ino.js` does that. Errors from the compiler come back as `error.log`.

A stand-alone page that runs the whole pipeline for blink, without flashing, is in [`demo/`](demo): `npm run demo`.

`src/elf2image.js` is independent and useful on its own:

```js
import { elf2image } from './src/elf2image.js';
const bin = elf2image(elfBytes, { chip: 'esp32s3', flashMode: 'dio', flashFreq: '80m', flashSize: '4MB', elfSha256Offset: 0xb0 });
```

`npm test` checks its SHA-256 against Node's, a synthetic ELF's layout and alignment, and (when the 6.8 MB reference ELF is
at `reference/gt_blink.ino.elf`, see `build/README.md`) the native toolchain's image byte for byte.

## Build the toolchain

The WebAssembly tools are **not in the repository** (tens of MB). You build them (about 1–2 hours of compiling on a
16-thread machine, about 10 GB of disk) or download a release. The scripts in [`build/`](build) are what I ran, in order:
Ubuntu 24.04 (I used WSL 2), Emscripten 7.0.0, Espressif's binutils and GCC at the tags in [`SOURCE.md`](SOURCE.md).
[`build/README.md`](build/README.md) lists the steps, and is honest about what has to be adapted: the scripts were
written for one machine, with a native build of the same sketch as the reference ("ground truth"), and their paths are
parameterised through `build/env.sh` but not otherwise polished. Treat them as a precise record of a working recipe, not
as a one-command installer.

## How it works, and why

- **GCC and GNU binutils, not clang/lld.** The S3 link uses GNU-ld-only features (`--wrap`, `--orphan-handling`, ROM
  linker scripts) and a linker script with 352 placement rules matching `*libX.a:object.*`. Real GCC and ld keep the
  behaviour identical. ([`docs/figures`](docs/figures))
- **The chip definition is compiled in.** Espressif's tools normally load a `xtensa_esp32s3.so` at run time (`dlopen`),
  which WebAssembly cannot do. The loader returns a compiled-in default when `XTENSA_GNU_CONFIG` is unset, so the S3
  files from `xtensa-overlays` are swapped in before building. No `.so`.
- **Separate libraries, not merged.** Merging the SDK with `ld -r` would erase the file names the 352 placement rules match,
  and code that must live in fast internal memory would land in flash.
- **Thin SDK.** A blink links 22.6 MB of members out of 243 MB. `build/build_profile.py` compiles and links sample programs
  against the full SDK, reads the linker map, and keeps only the archive members used (everything else becomes an empty
  archive). Linking against that gives the identical ELF.
- **Memory file system.** The tools are relinked with Emscripten's in-memory file system and `MODULARIZE`, so a Worker can
  write the headers and libraries in, call `main`, and read the result.
- **The test is bytes.** If the WebAssembly tools give the same bytes as the native ones, they are right.

## Layout

```
src/        elf2image.js, cppworker.js (the pipeline), cppbuild.js (main-thread API), flash.js (esptool-js), ino.js (.ino -> C++)
tests/      elf2image tests
build/      scripts that build and verify the toolchain and the profile (see build/README.md)
demo/       a page and Worker that run the whole pipeline for blink
docs/       design journal (.docx), results, the native "ground truth" command lines, figures
reference/  the native blink image (.bin) and flash layout the tests compare against
```

## Licence

Code in this repository: MIT (`LICENSE`). The WebAssembly builds of GCC and binutils are GPL: if you redistribute them you
must offer their source: [`SOURCE.md`](SOURCE.md) has the exact tags and the checklist. SDK libraries and the Arduino core
keep their own licences: see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Publishing built binaries: [`RELEASING.md`](RELEASING.md). Not affiliated with or endorsed by Espressif, Arduino or SparkFun.
