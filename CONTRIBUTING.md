# Contributing

The most useful contribution right now is **a test on real hardware**. Blink is the only program that has run on a board
(a SparkFun ESP32-S3 Thing Plus). WiFi, BLE, sensors, other boards and other browsers are untested.

## Reporting a hardware test

Open an issue with the **Hardware test report** template. Say which board, which browser and version, what you flashed, and
what happened. "It doesn't boot" is a useful result: include the Device log.

## Changing code

```bash
npm test
```

- `src/elf2image.js`: the flash-image maker. Any change must keep the native comparison identical (it needs the reference ELF; see
  [`build/README.md`](build/README.md)).
- `src/cppfeatures.js`: which libraries a sketch needs, from its `#include` lines. Add a test in `tests/cppfeatures.js`.
- `build/`: the scripts that build the toolchain and the library packs. They are a record of a working recipe for one machine; if you
  adapt them to yours, please say what you changed.

## Adding a library or a board

A library is a **pack**: build an Arduino example for it natively, then run `build/gather.py`, `build/build_packs.py` and
`build/build_libpacks.py` (see [`build/README.md`](build/README.md), step 5). The rule that keeps this honest: every program must
re-link to the same result as the native build. A new board needs its own native capture first (step 0).

## Licences

Contributions are under the repository's MIT licence. Don't add files from other projects without their licence: see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Don't commit toolchain binaries or SDK files.
