# One native Arduino build of an example (SparkFun ESP32-S3 Thing Plus), in its own copy of the cached build folder,
# so its objects, linker map and ELF can be used as the reference. Usage: native_one.ps1 <Name> <ExampleSubPath>
param([string]$Name, [string]$Example)
$ErrorActionPreference = 'Continue'
$scr = 'C:\work'
$cli = 'C:\Users\USER\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$lib = "$env:LOCALAPPDATA\Arduino15\packages\esp32\hardware\esp32\3.3.12\libraries"
$work = "$scr\measure"
$fqbn = 'esp32:esp32:sparkfun_esp32s3_thing_plus:CDCOnBoot=cdc'
$sk = "$work\sketches2\$Name"
$bp = "$work\build_$Name"
if (Test-Path "$bp\done.txt") { "${Name}: already built"; exit 0 }
Remove-Item $sk, $bp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $sk | Out-Null
Copy-Item "$lib\$Example\*" $sk -Recurse
$ino = Get-ChildItem $sk -Filter *.ino | Select-Object -First 1
if ($ino.BaseName -ne $Name) { Rename-Item $ino.FullName "$Name.ino" }
Copy-Item "$scr\gt_build" $bp -Recurse
$t = Get-Date
"${Name}: compiling ($t)"
& $cli compile --fqbn $fqbn --build-path $bp $sk 2>&1 | Select-Object -Last 6
$secs = [int]((Get-Date) - $t).TotalSeconds
# the build counts as done when the ELF and the linker map exist (a late partition-table step can print noise)
if ((Test-Path "$bp\$Name.ino.elf") -and (Test-Path "$bp\$Name.ino.map") -and (Test-Path "$bp\$Name.ino.bin")) { Set-Content "$bp\done.txt" "ok $secs"; "${Name}: done in $secs s" } else { "${Name}: FAILED after $secs s" }
