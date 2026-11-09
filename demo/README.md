# Demo: the whole pipeline in a Worker

`index.html` + `worker.js` compile, assemble and link the blink sketch with the WebAssembly tools and make the image
with `../src/elf2image.js`, entirely in the browser, and report the time of each stage. It does not flash.

It expects, next to it, files made by the build scripts (`build/30_pack_web.sh`, `build/39_pack_thin.sh` and the
relink scripts): `cc1plus.js/.wasm`, `as.js`, `as-new.wasm`, `ld.js`, `ld-new.wasm`, `headers.json/.bin`,
`cc1_args.json`, `sdk_thin.json/.bin`, `ld_args.json`, and a copy of `../src/elf2image.js`.

`npm run demo` serves this folder on http://localhost:8650 (`serve.cjs`; a `PUT /save/<name>` route writes results into
`saved/` so they can be compared with the native build: `cmp2.cjs`). Open it in a Chromium browser.

For a real page use `src/cppbuild.js` and `src/cppworker.js` instead: they take the toolchain's location as `base`.
