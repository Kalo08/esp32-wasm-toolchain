# Ground truth: what the native toolchain does

[← back to the README](../README.md)

Every claim in this project is judged against Espressif's **native** toolchain, so I captured exactly what it does for a
blink sketch. It was captured with the Arduino IDE's own `arduino-cli`, for the **SparkFun ESP32-S3 Thing Plus**
(`esp32:esp32:sparkfun_esp32s3_thing_plus:CDCOnBoot=cdc`), ESP32 core 3.3.12, Espressif GCC 14.2.0 (`esp-x32/2601`),
esptool 5.3.1. The sketch is [`../reference/gt_blink.ino`](../reference/gt_blink.ino): 299,952 bytes of flash (22%).

## What the capture shows

| # | Finding | Why it matters |
|---|---|---|
| 1 | **The build is reproducible.** Re-running the link command gives a byte-identical ELF (SHA-256 starts `224f616f446e1ee3`, 6,883,032 bytes) | a pass/fail test for everything built later: same bytes means right |
| 2 | **Compiling a file is three programs, not one.** `gcc` is only a driver: `cc1plus` (C++) or `cc1` (C) writes assembly, `as` makes the object file, `collect2` runs `ld` | WebAssembly can't start programs, so JavaScript runs each step |
| 3 | **The chip is defined by a shared library.** Every tool runs with `--dynconfig=xtensa_esp32s3.so` (0.9 MB), which holds the S3's instruction set and registers | `dlopen` isn't available in WebAssembly, so the S3 definition is built into each tool |
| 4 | **The `cc1plus` line is incomplete on its own.** The driver passes most include paths in a temporary `@file` that it deletes | the full include list is in each `*_gcc_v.txt` (`#include <...> search starts here:`); `-save-temps` would keep the file |
| 5 | **After linking there are four more steps:** `esptool elf2image --chip esp32s3 --flash-mode dio --flash-freq 80m --flash-size 4MB --elf-sha256-offset 0xb0`, then `gen_esp32part` (partition table), `boot_app0.bin`, and `esptool merge-bin` | flashing needs the bootloader, partition table and `boot_app0.bin` as well as the app |
| 6 | **Sizes:** `cc1plus` 28 MB, `cc1` 26 MB, `as` 2 MB, `ld` 2.3 MB, `objcopy` 1.8 MB, `xtensa_esp32s3.so` 0.9 MB (native Windows builds). The S3 SDK is 61 MB of headers and 226 MB of libraries | what the browser would have to carry |

## The captured files

All in [`ground-truth/`](ground-truth). Paths inside them are anonymised.

| File | What it is |
|---|---|
| `1_sketch_compile_*` | the sketch's compile: the driver command, then what GCC runs for it (`cc1plus`, `as`) |
| `2_core_cpp_compile_*` | the same for one Arduino core C++ file |
| `3_core_c_compile_*` | the same for one core C file (`cc1`, `as`) |
| `4_link_*` | the final link: the driver command and the `collect2` command (which runs `ld`) |
| `5_after_link_commands.txt` | everything after linking: `elf2image`, partition table, `boot_app0`, merge |
| `*_gcc_v.txt` | the raw `-v` output each of the above was cut from |
| [`../reference/`](../reference) | the sketch and the `.bin` it produced, to compare a WebAssembly build against |

## Capture log

| Step | Driver command | Re-run exit | Notes |
|---|---|---|---|
| 1 sketch compile | 2,187 characters, 38 arguments | 0 | runs `cc1plus` and `as` |
| 2 core C++ compile | 2,150 characters, 38 arguments | 0 | runs `cc1plus` and `as` |
| 3 core C compile | 2,144 characters, 38 arguments | 0 | runs `cc1` and `as` |
| 4 link | 1,661 characters, 22 arguments | 0 | runs `collect2` (which runs `ld`); ELF from the build and from the re-run: `224f616f446e1ee3`, 6,883,032 bytes, **identical** |
| 5 after the link | 10 command lines | | saved in `5_after_link_commands.txt` |

Result of the build: *Sketch uses 299,952 bytes (22%) of program storage space. Maximum is 1,310,720 bytes. Global variables
use 22,400 bytes (6%) of dynamic memory, leaving 305,280 bytes for local variables. Maximum is 327,680 bytes.*
