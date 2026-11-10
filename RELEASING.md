# Releasing the built toolchain

[← back to the README](README.md)

The repository itself (scripts and JavaScript, MIT) can be published as it is. Publishing the **built WebAssembly files**
needs a few more steps, because they contain GPL code.

> [!IMPORTANT]
> Hosting the `.wasm` files anywhere public, including a GitHub Pages demo, counts as distributing them. Do the **GPL
> source** items below *before* the first public link.

## Checklist (per release)

**Source and licences**

- [ ] The repository is at a clean commit, tagged (for example `v0.1.0`). That tag is part of the "corresponding source".
- [ ] The binaries were built from that commit with the scripts in `build/`. Record the commit hash.
- [ ] **GPL source is available:** fork `espressif/gcc` and `espressif/binutils-gdb` to your account and keep the tags
      `esp-14.2.0_20260121` and `esp-2.43.1_20260121` there (or attach source archives to the release). Link them in
      [`SOURCE.md`](SOURCE.md).
- [ ] [`SOURCE.md`](SOURCE.md) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) are included next to the binaries.
- [ ] The licence texts are included: GPL-3.0, and the notices for GMP, MPFR, MPC and the Emscripten runtime.

**The SDK bundle**

- [ ] **Decide about it.** Safest: do not publish `sdk.bin` / `sdk.json`. Ship the tools and headers, and let users build the
      SDK part locally. If you do publish it, read the licence of every precompiled library it contains first (the thin SDK
      includes members of `libbtdm_app` and others) and keep only what the licences allow.

**Quality**

- [ ] `npm test` passes.
- [ ] The whole pipeline has run once in a browser ([`demo/`](demo)) using the files you're about to publish.
- [ ] The "What's verified" section of the README says what you actually tested, especially whether a real board has been
      flashed.

## Contents of a release

| File | What it is |
|---|---|
| `esp32s3-thingplus.zip` | `cc1plus.js/.wasm`, `as.js`, `as-new.wasm`, `ld.js`, `ld-new.wasm`, `headers.json/.bin`, `args.json`, `bootloader.bin`, `partitions.bin`, `boot_app0.bin`, `manifest.json` (plus `sdk.*` only if cleared above) |
| `SOURCE.md`, `THIRD_PARTY_NOTICES.md`, `LICENSE` | the source offer, notices and your licence |
| `COPYING3` and the other licence texts | GPL-3.0 and the rest |
| `SHA256SUMS` | checksums of the files |

## Personal information

Git commits show the author's name and email. If you don't want your real email public, use GitHub's no-reply address
(GitHub → Settings → Emails → "Keep my email address private") and set it for this repository:

```bash
git config user.name "Your Name"
git config user.email "12345678+yourusername@users.noreply.github.com"
```

Before pushing, check `git log` for the author line, and search the tree once for names and paths you don't want public.
