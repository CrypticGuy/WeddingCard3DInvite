"""usage: batch.py <prompts.json> name [name ...]   (4 at a time)
prompts.json: { name: { "refs": [names of other gens or paths], "text": "..." } }"""
import json, subprocess, sys, pathlib, tempfile
from concurrent.futures import ThreadPoolExecutor
ROOT = pathlib.Path(__file__).resolve().parents[2]
P = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf8'))
names = sys.argv[2:]

def run(n):
    e = P[n]
    tag = n
    # A re-roll keeps earlier attempts: wedding-sky, wedding-sky.2, ...
    k = 1
    while (ROOT / '.shots/gen' / tag / 'out.png').exists():
        k += 1
        tag = f'{n}.{k}'
    pf = ROOT / '.shots/tools/tmp' / f'{tag}.txt'
    pf.parent.mkdir(exist_ok=True)
    pf.write_text(e['text'], encoding='utf8')
    refs = [str(ROOT / '.shots/gen' / r / 'out.png') if '/' not in r else str(ROOT / r) for r in e.get('refs', [])]
    r = subprocess.run([sys.executable, str(ROOT / 'scripts/v2-art/gen.py'), tag, str(pf), *refs], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr[-300:], flush=True)

with ThreadPoolExecutor(4) as ex:
    list(ex.map(run, names))
