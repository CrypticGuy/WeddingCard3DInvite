"""usage: gen.py <name> <prompt-file> [ref-image ...]
Runs codex image generation in an isolated directory. Image lands in .shots/gen/<name>/out.png"""
import json, os, re, shutil, subprocess, sys, glob, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
name, pf, *refs = sys.argv[1:]
d = ROOT / '.shots' / 'gen' / name
d.mkdir(parents=True, exist_ok=True)
head = ('Generate exactly one image with your built-in image_gen tool, following the brief below. '
        'Do not write any code to draw it. After generation, copy the generated PNG file unchanged from the '
        'generated_images folder under CODEX_HOME to ./out.png in the current directory, then stop. '
        'Reply with just the word done.\n\n')
prompt = head + pathlib.Path(pf).read_text() + '\n' + (ROOT / 'scripts/v2-art/style.txt').read_text()
(d / 'prompt.txt').write_text(prompt)
cmd = [shutil.which('codex') or 'codex', 'exec', '-C', str(d), '-s', 'workspace-write', '--skip-git-repo-check', '--json', '-o', str(d / 'last.txt')]
for r in refs:
    cmd += ['-i', r]
cmd += ['--', '-']
with open(d / 'log.jsonl', 'w') as out, open(d / 'err.txt', 'w') as err:
    p = subprocess.run(cmd, input=prompt.encode(), stdout=out, stderr=err, cwd=d, shell=False)
log = (d / 'log.jsonl').read_text(errors='ignore')
m = re.search(r'"thread_id":"([^"]+)"', log)
tid = m.group(1) if m else None
if not (d / 'out.png').exists() and tid:
    fs = sorted(glob.glob(os.path.expanduser(f'~/.codex/generated_images/{tid}/*')), key=os.path.getmtime)
    if fs:
        shutil.copy(fs[-1], d / 'out.png')
print(name, 'exit', p.returncode, 'thread', tid, 'ok' if (d / 'out.png').exists() else 'NO IMAGE')
