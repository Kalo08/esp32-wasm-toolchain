# Releasing the built toolchain

The repository itself (scripts and JavaScript, MIT) can be published as it is. Publishing the **built WebAssembly files**
needs a few more steps, because they contain GPL code. Tick these off for each release.

## Before the release

- [ ] The repository is at a clean commit; tag it (for example `v0.1.0`). That tag is part of the "corresponding source".
- [ ] The binaries in the release were built from that commit with the scripts in `build/` (record the commit hash).
- [ ] **GPL source is available**: fork `espressif/gcc` and `espressif/binutils-gdb` to your account and keep the tags
      `esp-14.2.0_20260121` and `esp-2.43.1_20260121` there (or attach source archives to the release). Link them in `SOURCE.md`.
- [ ] `THIRD_PARTY_NOTICES.md` and `SOURCE.md` are included in the release, next to the binaries.
- [ ] The licence texts are included: GPL-3.0, and the notices for GMP, MPFR, MPC and the Emscripten runtime.
- [ ] **Decide about the SDK bundle.** Safest: do not publish `sdk.bin` / `sdk.json`. Ship the tools and headers, and let users
      build the SDK part locally. If you do publish it, read the licence of every precompiled library it contains first
      (the thin SDK includes members of `libbtdm_app` and others) and keep only what the licences allow.
- [ ] Re-run `npm test`, and run the whole pipeline once in a browser (`demo/`) with the files you are about to publish.
- [ ] Update the "What is and isn't verified" section of `README.md` with what you actually tested (especially a flash to a
      real board).

## Contents of a release

```
esp32s3-thingplus.zip         cc1plus.js/.wasm, as.js, as-new.wasm, ld.js, ld-new.wasm, headers.json/.bin, args.json,
                              bootloader.bin, partitions.bin, boot_app0.bin, manifest.json   (+ sdk.* only if cleared above)
SOURCE.md  THIRD_PARTY_NOTICES.md  LICENSE
COPYING3 (GPL-3.0 text)        and the other licence texts
SHA256SUMS                     checksums of the files
```

## Personal information

Git commits show the author's name and email. If you don't want your real email public, use GitHub's no-reply address
(GitHub → Settings → Emails → "Keep my email address private"), and set it for this repo:

```bash
git config user.name "Your Name"
git config user.email "12345678+yourusername@users.noreply.github.com"
```

Before pushing, check `git log` for the author line and grep the tree once for names and paths you don't want public.
