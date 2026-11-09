#!/bin/bash
# copy the WebAssembly tools, boot images and a manifest into the profile folder, then pre-compress
D=/mnt/c/Users/USER/Downloads/git/KaloLab/toolchain/esp32s3-thingplus
S=${CAPTURE_ROOT}
cd $D
for f in cc1plus.js cc1plus.wasm as.js as-new.wasm ld.js ld-new.wasm; do cp /root/work/webtool/$f .; done
cp $S/gt_build/gt_blink.ino.bootloader.bin bootloader.bin
cp $S/gt_build/gt_blink.ino.partitions.bin partitions.bin
cp /mnt/c/Users/USER/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/tools/partitions/boot_app0.bin .
rm -f *.gz
for f in *.wasm *.js *.bin *.json; do gzip -9 -k -f $f; done
tot=$(cat *.gz | wc -c)
python3 - <<PY
import json
mb = round($tot / 1e6)
json.dump({'name': 'esp32s3-thingplus', 'board': 'SparkFun ESP32-S3 Thing Plus (esp32:esp32:sparkfun_esp32s3_thing_plus)', 'chip': 'esp32s3',
  'gcc': '14.2.0 (esp-14.2.0_20260121)', 'binutils': '2.43.1', 'core': 'arduino-esp32 3.3.12', 'downloadMB': mb, 'buildSeconds': 15},
  open('manifest.json', 'w'), indent=1)
PY
gzip -9 -k -f manifest.json
ls -l --block-size=K | awk '{print $5, $9}'; echo "gzip total: $tot bytes"
