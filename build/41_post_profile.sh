#!/bin/bash
# copy the WebAssembly tools and boot images into the profile folder, pre-compress everything, and write the manifest.
# Run finalize_profile.py first when the SDK variants or library packs changed.
D=/mnt/c/Users/USER/Downloads/git/KaloLab/toolchain/esp32s3-thingplus
S=${CAPTURE_ROOT}
cd $D
for f in cc1plus.js cc1plus.wasm as.js as-new.wasm ld.js ld-new.wasm; do cp /root/work/webtool/$f .; done
cp $S/gt_build/gt_blink.ino.bootloader.bin bootloader.bin
cp $S/gt_build/gt_blink.ino.partitions.bin partitions.bin
cp /mnt/c/Users/USER/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/tools/partitions/boot_app0.bin .
rm -f *.gz
for f in *.wasm *.js *.bin *.json; do gzip -9 -k -f "$f"; done
python3 "$S/wasm/post_manifest.py"
gzip -9 -k -f manifest.json
ls -l --block-size=K | awk '{print $5, $9}'
echo "gzip total: $(cat *.gz | wc -c) bytes"
