# ESP32-S3 build ground truth (Milestone 0)

Captured on this PC with the Arduino IDE's own `arduino-cli`, for the **SparkFun ESP32-S3 Thing Plus**
(`esp32:esp32:sparkfun_esp32s3_thing_plus:CDCOnBoot=cdc`), ESP32 core 3.3.12, Espressif GCC 14.2.0 (`esp-x32/2601`),
esptool 5.3.1. The sketch is `reference/gt_blink.ino` (299,952 bytes of flash, 22%).

## Files

| File | What it is |
|---|---|
| `build_driver.log` | The full `arduino-cli compile -v` output (172 lines, 124 compiler command lines) |
| `1_sketch_compile_*` | The sketch's compile: the driver command, then what GCC runs for it (`cc1plus`, `as`) |
| `2_core_cpp_compile_*` | The same for one Arduino core C++ file |
| `3_core_c_compile_*` | The same for one core C file (`cc1`, `as`) |
| `4_link_*` | The final link: the driver command and the `collect2` command (which runs the linker `ld`) |
| `5_after_link_commands.txt` | Everything after linking: `elf2image`, partition table, `boot_app0`, merge |
| `*_gcc_v.txt` | The raw `-v` output each of the above was cut from |
| `reference/` | The sketch, and the ELF and `.bin` it produced, to compare a WebAssembly build against |

## What the capture shows

1. **The build is reproducible.** Re-running the link command gave a byte-identical ELF (SHA-256 starts `224f616f446e1ee3`,
   6,883,032 bytes). A WebAssembly toolchain can be judged by whether it produces the same bytes.
2. **Compiling a file is three programs, not one.** `gcc` is only a driver: `cc1plus` (C++) or `cc1` (C) writes assembly,
   `as` turns it into an object file, and `collect2` runs `ld` to link. WebAssembly can't start programs, so JavaScript
   would run each step itself.
3. **The chip is defined by a shared library.** Every tool is run with `--dynconfig=xtensa_esp32s3.so`
   (`esp-x32/2601/lib/xtensa_esp32s3.so`, 0.9 MB), which holds the S3's instruction set and registers. Loading a library
   at run time (`dlopen`) isn't available in WebAssembly, so the S3 definition would have to be built into each tool.
4. **The `cc1plus` line is incomplete on its own.** The driver passes most include paths in a temporary `@file` that is
   deleted afterwards. The full include list is in the `#include <...> search starts here:` part of each `*_gcc_v.txt`;
   re-running with `-save-temps` would keep the file.
5. **After linking there are four more steps:** `esptool elf2image --chip esp32s3 --flash-mode dio --flash-freq 80m
   --flash-size 4MB --elf-sha256-offset 0xb0`, then `gen_esp32part` (partition table), `boot_app0.bin`, and
   `esptool merge-bin`. Flashing needs the bootloader, partition table and `boot_app0.bin` as well as the app.
6. **Sizes:** `cc1plus` 28 MB, `cc1` 26 MB, `as` 2 MB, `ld` 2.3 MB, `objcopy` 1.8 MB, `xtensa_esp32s3.so` 0.9 MB (native Windows
   builds). The S3 SDK is 61 MB of headers and 226 MB of libraries.
