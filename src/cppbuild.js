// Main-thread side of the in-browser C++ compiler (see cppworker.js).

export const DEFAULT_BASE = '/toolchain/esp32s3-thingplus/';

// the toolchain's manifest.json, or null when `base` doesn't have a toolchain
export async function webToolchain(base = DEFAULT_BASE) {
  try {
    const r = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// Compile C++ for the board. onStage(text) reports progress. Resolves { images: [{ address, data }], seconds };
// rejects with an Error whose .log holds the compiler's messages.
export function buildCpp(code, onStage = () => {}, { base = DEFAULT_BASE } = {}) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./cppworker.js', import.meta.url));
    w.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'stage') onStage(d.text);
      else if (d.type === 'done') { w.terminate(); resolve(d); }
      else if (d.type === 'error') { w.terminate(); const err = new Error(d.error); err.log = d.log; reject(err); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(`The compiler stopped unexpectedly (${e.message || 'worker error'}). This browser may not have enough memory for it.`)); };
    w.postMessage({ type: 'build', code, base });
  });
}
