// Write a compiled program to an ESP32-S3 over Web Serial, with Espressif's esptool-js
// (npm: esptool-js, Apache-2.0). Chrome and Edge only: Web Serial isn't in Firefox or Safari.
//
//   const { images } = await buildCpp(code);                  // from cppbuild.js
//   const port = await navigator.serial.requestPort();        // must be closed
//   await flashImages(port, images, { onProgress: (f, phase) => ... });
//
// images: [{ address, data }]; the last one is the app, whose header names the chip it was built for.
// Nothing is erased beyond what is written.

import { ESPLoader, Transport } from 'esptool-js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ESP32-family images start with 0xE9 and name their chip in bytes 12-13
export function imageChipId(bytes) {
  if (!bytes || bytes.length < 16 || bytes[0] !== 0xE9) return null;
  return bytes[12] | (bytes[13] << 8);
}

function terminalFor(log) {
  let line = '';
  return { clean() {}, writeLine(s) { log(line + s); line = ''; }, write(s) { line += s; } };
}

export async function flashImages(port, images, { chip = 'ESP32-S3', log = () => {}, onProgress = () => {} } = {}) {
  const transport = new Transport(port, false);
  try {
    const loader = new ESPLoader({ transport, baudrate: 460800, terminal: terminalFor(log), debugLogging: false });
    onProgress(0, 'connecting');
    let description;
    try {
      description = await loader.main();
    } catch (e) {
      throw new Error(`Couldn't start the board's bootloader (${e.message}). Hold the BOOT button, press and release EN/RST, then try again.`);
    }
    const name = loader.chip.CHIP_NAME;
    if (name !== chip) throw new Error(`This is an ${name}, but the program was built for an ${chip}, so nothing was changed.`);
    const app = images[images.length - 1].data;
    if (imageChipId(app) !== loader.chip.IMAGE_CHIP_ID) throw new Error(`The program was built for a different chip than this ${name}, so nothing was changed.`);
    log(`Detected ${description}. Writing ${images.length} parts (${Math.round(images.reduce((n, i) => n + i.data.length, 0) / 1024)} KB).`);
    const totals = images.map(i => i.data.length), sum = totals.reduce((a, b) => a + b, 0), done = totals.map(() => 0);
    onProgress(0, 'writing');
    await loader.writeFlash({
      fileArray: images.map(i => ({ data: i.data, address: i.address })),
      flashMode: 'keep', flashFreq: 'keep', flashSize: 'keep',
      eraseAll: false, compress: true,
      reportProgress: (idx, written, total) => { done[idx] = total ? written / total * totals[idx] : 0; onProgress(done.reduce((a, b) => a + b, 0) / sum, 'writing'); },
    });
    onProgress(1, 'restarting');
    await loader.after('hard_reset');
    return { name, description };
  } finally {
    try { await transport.disconnect(); } catch { /* already closed */ }
    await sleep(300);
  }
}
