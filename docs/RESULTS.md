# Results

[← back to the README](../README.md)

Everything below was measured on one PC (Windows 11, WSL 2 Ubuntu 24.04, 16 threads), for the **SparkFun ESP32-S3 Thing
Plus** (`esp32:esp32:sparkfun_esp32s3_thing_plus:CDCOnBoot=cdc`, Arduino-ESP32 core 3.3.12). The tools were built with
Emscripten 7.0.0 from Espressif's own sources at the tags in [`../SOURCE.md`](../SOURCE.md) (GCC 14.2.0, binutils 2.43.1,
`esp-14.2.0_20260121`), with the ESP32-S3 chip definition (`xtensa-overlays/xtensa_esp32s3`) compiled in: no
`xtensa_esp32s3.so`, no `dlopen`.

> [!IMPORTANT]
> Every stage is compared with Espressif's native toolchain. A blink sketch built by the browser compiler has also been flashed to a
> physical SparkFun ESP32-S3 Thing Plus and blinked its LED (reported by the author). **Nothing else has been run on hardware.**

## At a glance

| | |
|---|---|
| Assembler, linker, image maker | Verified: byte-for-byte identical to the native tools |
| C++ compiler | Verified: identical code and data; 16 debug-string lines differ |
| Whole pipeline in a browser Worker | Verified: about 13 s for blink |
| Download | about 16 MB gzipped |
| Flash and run on a real board | Verified for blink (the on-board LED blinks); other programs not yet tested |

## Test results (the blink sketch)

| Stage | WebAssembly tool | Result against the native Espressif tool |
|---|---|---|
| Compile C++ to assembly | `cc1plus.wasm` | The first 5,600 of 6,297 lines (all code, data and debug tables) are **identical**. Only 16 lines of debug *strings* differ: the recorded compiler flags lack `-mdynconfig=...`, the working-folder path, and the order of those three strings. 5.5 s with the full SDK, 2.7 s with only the 337 headers it needs |
| Assemble to an object file | `as-new.wasm` | **Byte-for-byte identical** object file (same SHA-256) once a Windows-style `\` path in the input is written with `/`. 0.18 s |
| Link the firmware | `ld-new.wasm` | **Byte-for-byte identical ELF** (SHA-256 starts `224f616f446e1ee3`, 6,883,032 bytes), from all 883 linker arguments and the 226 MB SDK. 90 s reading the SDK across WSL's slow Windows bridge, 6–10 s from the local disk |
| Make the flash image | `src/elf2image.js` | **Byte-for-byte identical** to `esptool elf2image` for the blink ELF (300,096 bytes) |

### Linking against a thin SDK

`build/build_profile.py` compiles and links sample programs against the full SDK, reads the linker map, and keeps only the
archive members used. Re-linking each sample against that gives the **identical ELF**, for all five (blink, sensors, text and
functions, RGB LED, tone/PWM/ADC/random).

### Whole pipeline in a browser

A Chromium Web Worker compiled, assembled and linked blink and made the image, with everything in Emscripten's in-memory
file system:

| Step | Time |
|---|---|
| Fetch headers and SDK (28.5 MB uncompressed, local server) | 0.4 s |
| Compile (`cc1plus`) | about 5–7 s |
| Assemble (`as`) | 0.2 s |
| Link (`ld`) | about 4 s |
| Make the image (`elf2image`) | 1.1 s |
| **Total** | **12.8 s** |

The browser's image differs from the native one only in the embedded ELF SHA-256 (32 bytes at offset `0xb0`), the checksum
(1 byte) and the image digest (32 bytes), because the ELF's debug-info paths differ. Code and data segments are identical.

## Sizes

| File | Uncompressed | Compressed |
|---|---|---|
| `cc1plus.wasm` (C++ compiler) | 18.1–21 MB | 5.1–6.5 MB |
| `as-new.wasm` (assembler) | 1.1 MB | 0.4 MB |
| `ld-new.wasm` (linker) | 1.3–1.4 MB | 0.4 MB |
| `objcopy.wasm` | 0.9 MB | 0.3 MB |
| Headers (364 files: compiler, SDK and Arduino core) | 5.7 MB | 0.9 MB |
| Thin SDK libraries (5 sample programs) | 24 MB | about 7 MB gzip |
| **Download in total (gzip)** | about 50 MB | **about 16 MB** |

For comparison, the whole ESP32-S3 SDK is 243 MB of libraries (67 MB gzipped) plus 61 MB of headers.

## What a program pulls in from the SDK

Measured from the linker map of a native build (members actually linked, not whole libraries):

| Program | Native app size | Archives | Members used | Gzipped |
|---|---|---|---|---|
| Blink | 299,952 bytes | 51 | 22.6 MB (of 72 MB in those archives) | 6.9 MB (4.1 MB xz) |
| WiFiScan (Arduino example) | 842,928 bytes | 66 | 42.1 MB (of 88.9 MB) | 12.9 MB (7.9 MB xz) |
| BasicHttpsClient (WiFi and TLS) | 1,028,704 bytes | 66 | 42.4 MB | 13.0 MB (7.9 MB xz) |
| BLE Server | 561,968 bytes | 49 | 23.2 MB (of 71.3 MB) | 7.0 MB (4.2 MB xz) |
| WireScan, SPI_Multiple_Buses, StartCounter | 299,456 / 279,216 / 282,832 bytes | about 50 each | close to blink | close to blink |
| HelloServer (web server, mDNS, WiFi) | 918,768 bytes | WiFi-class | included in the union below | included in the union below |
| Union of WiFi, HTTPS and BLE | | 68 | 47.1 MB | 14.5 MB (8.5 MB xz) |

TLS adds only about 0.3 MB on top of WiFi; BLE adds about 0.6 MB on top of blink. The Arduino libraries' own compiled code is separate:
2.5 MB (WiFi), 1.2 MB (HTTP), 10.6 MB (BLE) with debug info, 0.4, 0.2 and 0.8 MB stripped.

### WiFi, HTTP and BLE in the browser

The three Arduino examples were built in a browser Worker, with the feature packs loaded because of their `#include` lines:

| Example | Time | App image | Against the Arduino IDE's image |
|---|---|---|---|
| WiFiScan | 8.1 s | 842,928 bytes | same size; differs in the embedded ELF hash (32 bytes), checksum and digest (33) and 7 timestamp bytes |
| BasicHttpsClient | 9.1 s | 1,028,704 bytes | same size; the same, with 6 timestamp bytes |
| BLE Server | 4.7 s | 561,968 bytes | same size; the same, with 6 timestamp bytes |

The timestamp bytes are the build time recorded in the Arduino core objects (each native build compiled its own copy of the core).
Download: about 16 MB for a basic sketch, about 23 MB for one using WiFi (the larger SDK variant is 13.7 MB gzipped, and the packs are 0.3,
0.4 and 0.4 MB). Nothing was run on a board.

## How to run (Node, as the tests did)

```
node cc1plus <the cc1plus arguments from the capture>              # writes assembly
node as-new --gdwarf-4 --traditional-format --longcalls -o out.o in.s
node ld-new <the linker arguments from the capture>
```

These Node builds use direct file access (`NODERAWFS`); the browser build uses Emscripten's in-memory file system instead.
Keep the header folders on a fast local disk: through WSL's Windows bridge the same compile was still not finished after 25
minutes.

## Not done yet

- [x] Flash a real board and confirm it runs (blink, on the SparkFun ESP32-S3 Thing Plus)
- [ ] Other ESP32-S3 boards
- [ ] Run WiFi, BLE and sensors (I2C, SPI) on a real board (the WiFi and BLE builds are verified; the radios and sensors are not)
- [ ] Other Arduino libraries (web server, MQTT, SD...) and multi-file sketches in the Worker
- [ ] The Arduino core and libraries compiled by this toolchain (the bundle uses the Arduino IDE's own `core.a`)
- [ ] Matching the debug strings exactly (only matters for a byte-identical ELF)
- [ ] Publishing: the GPL source offer and the SDK licence review ([`../RELEASING.md`](../RELEASING.md))
