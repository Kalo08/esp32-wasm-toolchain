# ESP32-S3 toolchain as WebAssembly: results

Built with Emscripten 7.0.0 inside Ubuntu 24.04 (WSL), from Espressif's own sources at the tags matching the
toolchain in your Arduino IDE (GCC 14.2.0 / binutils 2.43.1, `esp-14.2.0_20260121`), with the ESP32-S3 chip
configuration (`xtensa-overlays/xtensa_esp32s3`) compiled in. No `xtensa_esp32s3.so`, no `dlopen`.

## Test results (your gt_blink sketch, SparkFun ESP32-S3 Thing Plus)

| Stage | WebAssembly tool | Result against the native Espressif tool |
|---|---|---|
| Compile C++ to assembly | `cc1plus.wasm` | The first 5,600 lines (all code, data and debug tables) are **identical**. Only 16 lines of debug *strings* differ (the recorded compiler flags lack `-mdynconfig=...`, the working-folder path, and the order of those 3 strings). 5.5 s with the full SDK, 2.7 s with only the 337 headers it needs. |
| Assemble to object file | `as-new.wasm` | **Byte-for-byte identical** object file (same SHA-256) once a Windows-style `\` path in the input is written with `/`. 0.18 s. |
| Link the firmware | `ld-new.wasm` | **Byte-for-byte identical ELF** (SHA-256 starts `224f616f446e1ee3`, 6,883,032 bytes), from all 883 linker arguments and the 226 MB SDK. 90 s (reading the SDK across WSL's slow Windows bridge). |

## Sizes

| File | Uncompressed | Brotli |
|---|---|---|
| `cc1plus.wasm` (C++ compiler) | 18.1 MB | 5.1 MB |
| `as-new.wasm` (assembler) | 1.1 MB | 0.4 MB |
| `ld-new.wasm` (linker) | 1.3 MB | 0.4 MB |
| `objcopy.wasm` | 0.9 MB | 0.3 MB |
| **Whole toolchain** | **21.4 MB** | **about 6.2 MB** |
| Headers read by this sketch: 337 files (162 compiler, 131 SDK, 44 Arduino core) | 5.2 MB | 0.7 MB |

## How to run (Node, as the tests did)

    node cc1plus <the cc1plus arguments from the capture>     # writes assembly
    node as-new --gdwarf-4 --traditional-format --longcalls -o out.o in.s
    node ld-new <the linker arguments from the capture>

Notes: the files were built for Node with direct file access (`NODERAWFS`); a browser build uses Emscripten's in-memory
file system instead. Keep the header folders on a fast local disk: through WSL's Windows bridge the same compile
took over 25 minutes without finishing.

## Not done yet

- `elf2image` (the step that turns the ELF into the flashable `.bin`; Espressif's `esptool` does it in Python)
- Compiling the Arduino core and libraries ahead of time into an archive (`core.a`) to ship with the tools
- Running any of this in a browser (Web Worker, in-memory files, loading headers on demand)
- Matching the debug strings exactly (only matters if you want the final ELF byte-identical)
- GPL: the GCC and binutils programs are GPL-licensed, so a website that serves them must also offer their source
