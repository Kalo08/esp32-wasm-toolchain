#!/usr/bin/env python3
# Rebuild each program's link command from blink's (swap in the program's own objects, in the native order) and link
# with the WebAssembly ld against the FULL SDK, with the native objects. The result must equal the native ELF.
import hashlib, json, os, subprocess, sys, time

SCR = os.environ['CAPTURE_ROOT']
HERE = SCR + '/measure'
GT = os.environ['NATIVEFS_TOOLS']
norm = lambda s: s.replace('////', '/')
base = [norm(l) for l in open(SCR + '/wasm/ld_args.txt').read().split('\n') if l != '']
gather = json.load(open(HERE + '/gather.json'))
i_sketch = next(i for i, a in enumerate(base) if a.endswith('gt_blink.ino.cpp.o'))
i_core = next(i for i, a in enumerate(base) if a.endswith('core/core.a'))
i_out = base.index('-o') + 1
i_map = next(i for i, a in enumerate(base) if 'gt_blink.ino.map' in a)
assert i_core == i_sketch + 1, (i_sketch, i_core)

for name in sys.argv[1:]:
    g = gather[name]
    d = g['dir']
    W = f'/root/work/p_{name}'; os.makedirs(W, exist_ok=True)
    a = list(base)
    a[i_out] = f'{W}/out.elf'
    a[i_map] = a[i_map].split('=')[0] + f'={W}/out.map'
    a[i_core] = f'{d}/core/core.a'
    a[i_sketch:i_sketch + 1] = g['objects']          # sketch object + library objects, in the native order
    t = time.time()
    r = subprocess.run(['node', '--max-old-space-size=6000', GT + '/ld-new'] + a, cwd=W, capture_output=True, text=True)
    elf = f'{W}/out.elf'
    ref = f'{d}/{name}.ino.elf'
    same = r.returncode == 0 and os.path.exists(elf) and hashlib.sha256(open(elf, 'rb').read()).hexdigest() == hashlib.sha256(open(ref, 'rb').read()).hexdigest()
    print(f'{name}: ld exit {r.returncode} in {time.time() - t:.0f} s; {len(g["objects"])} objects; ELF vs the native ELF: '
          + ('IDENTICAL' if same else 'DIFFERENT'), flush=True)
    if not same:
        print((r.stdout + r.stderr)[-700:])
        if os.path.exists(elf):
            x, y = open(elf, 'rb').read(), open(ref, 'rb').read()
            print('   sizes', len(x), len(y), 'differing bytes', sum(1 for p, q in zip(x, y) if p != q))
