# Licence review: the SDK bundle and the feature packs

[← back to the README](../README.md)

Reviewed on 10 November 2026, for the question: **may the SDK libraries and the Arduino library code that this project's
bundles contain be redistributed, and on what terms?**

> [!IMPORTANT]
> This is a reading of **public statements**, not legal advice, and it has limits (listed at the end). Nothing here has been
> confirmed by Espressif. Before you publish the SDK bundle, either rely on the "simplest safe option" at the bottom, or get the
> open points confirmed.

## Short answer

- The **precompiled radio libraries** (the "blobs": `libphy`, Wi-Fi and Bluetooth controller libraries) are stated by Espressif, in
  each blob repository's README, to be licensed under the **Apache License 2.0**, the same as ESP-IDF. Apache-2.0 allows
  redistributing compiled code, on conditions (a copy of the licence, retained notices).
- **But** the repository that packages the Arduino SDK (`esp32-arduino-libs`, where `esp32s3-libs` comes from) states **no licence
  at all**, and I could not match each archive in the bundle to a specific licensed repository. So the conclusion rests on an
  assumption that the Arduino package contains the same libraries Espressif licenses in its blob repositories.
- The rest of the SDK is ESP-IDF source code (Apache-2.0), a handful of third-party components (BSD, MIT, Apache-2.0), the
  toolchain's C and C++ libraries (BSD; GPL-3 with the runtime exception), and the Arduino core and libraries (LGPL-2.1 and
  Apache-2.0).

## What I read

| Source | What it says |
|---|---|
| [ESP-IDF licence page](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/COPYRIGHT.html) | ESP-IDF's own source is Apache-2.0; lists third-party components and their licences (below); says licence text in a source header takes precedence over the page's summary. It says nothing specific about precompiled Wi-Fi, PHY or Bluetooth libraries |
| [ESP-IDF `LICENSE`](https://github.com/espressif/esp-idf/blob/master/LICENSE) | Apache License 2.0; no exception for binary libraries (its Section 4 covers redistribution in Object form) |
| [`esp-phy-lib`](https://github.com/espressif/esp-phy-lib) (`libphy`) | README: "These binary libraries are provided under the same license as the parent esp-idf project." Its `LICENSE` is the Apache 2.0 text |
| [`esp32-wifi-lib`](https://github.com/espressif/esp32-wifi-lib) (Wi-Fi libraries) | the same sentence; `LICENSE` is the Apache 2.0 text. The README doesn't name the individual libraries |
| [`esp32-bt-lib`](https://github.com/espressif/esp32-bt-lib) (Bluetooth controller) | the same sentence; `LICENSE` is the Apache 2.0 text. The README doesn't name `libbtdm_app` or `libbtbb` |
| [`esp32-arduino-libs`](https://github.com/espressif/esp32-arduino-libs) (the Arduino SDK package) | **no licence stated**; no `LICENSE` file; says only that it holds the precompiled libraries used by Arduino for ESP32 |
| [`arduino-esp32` `LICENSE.md`](https://github.com/espressif/arduino-esp32/blob/master/LICENSE.md) | GNU LGPL 2.1; says nothing about the `libraries/` folder |
| the Arduino libraries' own source files (read locally, core 3.3.12) | WiFi: LGPL-2.1 headers in 13 of 18 files; Network: LGPL in 5 of 13 (and MIT in 1); NetworkClientSecure: LGPL in 2 of 5; HTTPClient: LGPL-2.1 in both; BLE: Apache-2.0 in 58 of 60 files, MIT in 2, and a `LICENSE` file. Files with no header (for example `WiFi/src/AP.cpp`) fall under the project's `LICENSE.md` (LGPL-2.1) |
| the Arduino package on disk | contains **no licence or notice files** for the SDK libraries |

## The 71 archives in the largest (WiFi) bundle, by origin

| Group | Archives | Licence, and how I know |
|---|---|---|
| **Espressif radio blobs** | `libphy`; `libpp`, `libnet80211`, `libcore`, `libmesh`, `libsmartconfig`, `libespnow`, `libcoexist`; `libbtdm_app`, `libbtbb` | Apache-2.0, stated by the blob repositories' READMEs and `LICENSE` files. **Assumption:** that these archive names come from those repositories (their READMEs don't list names) |
| ESP-IDF components built from source | `libesp_*` (hardware support, system, timer, event, netif, wifi glue, phy glue, coex, drivers, rom, ...), `libhal`, `libsoc`, `libspi_flash`, `libheap`, `libnvs_flash`, `liblog`, `libvfs`, `libefuse`, `libbootloader_support`, `libapp_update`, `libespcoredump`, `libprotocomm`, `libpthread`, `libcxx` | Apache-2.0 (ESP-IDF's own code) |
| Third-party components inside ESP-IDF | `libmbedcrypto`, `libmbedx509`, `libmbedtls`, `libmbedtls_2` (Mbed TLS); `liblwip`; `libwpa_supplicant`; `libfreertos`; `libxtensa`, `libxt_hal` | Mbed TLS: Apache-2.0; lwIP: BSD; wpa_supplicant: BSD; FreeRTOS (original parts): MIT; Xtensa headers: MIT. All from the ESP-IDF licence page |
| Components the ESP-IDF page does not list (checked separately, 10 Nov 2026) | `libbt` (Bluedroid) | Apache-2.0: the source header I read (`btm_ble.c`) says Apache-2.0, Copyright Broadcom Corporation 1999-2012 (code derived from Android). I read **one** file, not all of them |
| | `libprotobuf-c` | BSD-2-Clause, Copyright Dave Benson and the protobuf-c authors, from the upstream project's `LICENSE` (ESP-IDF's component pulls that project in as a submodule) |
| | `libespressif__cjson` | MIT, the licence field of the component-registry entry (`espressif/cjson`) |
| | `libespressif__network_provisioning` | Apache-2.0, the `LICENSE` file in `espressif/idf-extra-components` (folder `network_provisioning`) |
| | `libespressif__esp_diagnostics` | Apache-2.0, the `LICENSE` file of the `espressif/esp-insights` repository |
| | `libnvs_sec_provider` | Apache-2.0, the SPDX header of `components/nvs_sec_provider/nvs_sec_provider.c` in ESP-IDF |
| Toolchain C and C++ libraries | `libc`, `libm`, `libnewlib` (newlib: BSD); `libstdc++`, `libgcc` (GPL-3.0 with the GCC Runtime Library Exception) | the ESP-IDF page and GCC's licence |
| Arduino core | `core.a` | LGPL-2.1 |

The Arduino libraries in the feature packs (compiled objects and headers): **WiFi, Network, NetworkClientSecure, HTTPClient: LGPL-2.1**
(with some files carrying no header, so the project licence applies); **BLE: Apache-2.0** (with two MIT files).

## What redistribution would require

**Apache-2.0** (blobs, ESP-IDF code, Mbed TLS, BLE library): give every recipient a copy of the licence; keep copyright and licence
notices; carry any `NOTICE` text from the source projects; do not use Espressif's trademarks to imply endorsement. For compiled
code (Object form) Section 4 allows redistribution under these same conditions.

**BSD / MIT** (lwIP, wpa_supplicant, newlib, FreeRTOS, Xtensa headers): keep the copyright and licence notice with the binaries.

**LGPL-2.1** (the Arduino core and four Arduino libraries): provide the licence text and the corresponding source (the
`arduino-esp32` tag, 3.3.12), and let users relink. The feature packs hold the libraries as separate **object files**, which a user
can relink, and the core is an archive, so the structure suits this. Programs a user builds from the bundle and then distributes as firmware
inherit the same duty for the LGPL parts.

**GPL-3 with the runtime exception** (`libstdc++`, `libgcc`): the exception means a program that links them isn't made GPL.

## What I could not check

- Whether each file in the Arduino package is *byte-identical* to the one in Espressif's licensed repositories. The packaging
  repository has no licence file to rely on, so this is an assumption.
- Whether the component **versions inside the Arduino package** match the repository versions I read (for the registry components, `libbt` and `libprotobuf-c`). I read current repository files. For Bluedroid I read one header, not every file.
- The licence text inside any binary (I read repositories, not the archives themselves).
- Anything beyond Espressif's *public* statements: contracts, regulatory terms for the radios, patents.
- I read the licence files through a web fetch tool that summarised them, so "standard Apache-2.0 text" is the tool's reading, not a
  byte comparison with apache.org.

## Open points to settle before publishing the SDK bundle

1. **Ask Espressif** (an issue on `esp32-arduino-libs` asking it to add a licence, or on `arduino-esp32`) to confirm that the
   precompiled libraries in the Arduino SDK package are licensed as their blob repositories state, and may be redistributed in this form.
   This is the one thing public documents can't settle: the packaging repository has no licence.
2. ~~Read the licences of `libbt`, `libprotobuf-c`, `libespressif__cjson` and the registry components.~~ Done on 10 Nov 2026 (see the table above);
   the one residual check is whether the versions in the package match what I read.
3. **Add notices:** the licence texts above (Apache-2.0, BSD-2-Clause, MIT, LGPL-2.1, GPL-3 with the runtime exception), plus any `NOTICE`
   files, next to the binaries in a release.

## The simplest safe option

Do **not** publish `sdk.*` or `sdk-wifi.*` (the library bundles). Publish the tools, the headers and the packs only if you've
followed the LGPL steps above, and let people build the SDK part from Espressif's packages on their own machine. That sidesteps
every open point above.
