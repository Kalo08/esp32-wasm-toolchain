# Demo: the whole pipeline in a Worker

[← back to the README](../README.md)

`index.html` and `worker.js` compile, assemble and link the blink sketch with the WebAssembly tools and make the image with
`../src/elf2image.js`, entirely in the browser, and report the time of each stage. **It does not flash.**

```bash
npm run demo        # serves this folder on http://localhost:8650 : open it in Chrome or Edge
```

## What it needs next to it

Files made by the build scripts ([`build/30_pack_web.sh`](../build/30_pack_web.sh), [`build/39_pack_thin.sh`](../build/39_pack_thin.sh)
and the relink scripts):

| File | From |
|---|---|
| `cc1plus.js`, `cc1plus.wasm`, `as.js`, `as-new.wasm`, `ld.js`, `ld-new.wasm` | `build/26_relink_web.sh`, `build/27_relink_bin.sh` |
| `headers.json`, `headers.bin`, `cc1_args.json` | `build/30_pack_web.sh` |
| `sdk_thin.json`, `sdk_thin.bin`, `ld_args.json` | `build/39_pack_thin.sh` |
| `elf2image.js` | a copy of `../src/elf2image.js` |

`serve.cjs` also has a `PUT /save/<name>` route that writes results into `saved/`, so they can be compared with the native
build (`cmp2.cjs`).

> [!NOTE]
> For a real page use [`src/cppbuild.js`](../src/cppbuild.js) and [`src/cppworker.js`](../src/cppworker.js) instead: they take
> the toolchain's location as `base`.
