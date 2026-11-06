"""Cuts generated paintings out of their white paper and writes the site's WebP layers.

usage: matte.py <gen-dir> <public-art-dir> [only ...]

Watercolour on white has no hard edge to key, so the alpha is recovered from the
paint itself: un-mixing white gives each pixel the colour and opacity it would need
to look the same over paper. Soft washes stay soft and leave no white halo on a dark
sky. That alone would make pale stone see-through, so anything solid (found by
closing the painted area and filling small holes) is forced back to opaque.
"""
import json, os, sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

gen, out = sys.argv[1:3]
only = set(sys.argv[3:])
MAX = 1600


def load(name):
    return np.asarray(Image.open(os.path.join(gen, name, 'out.png')).convert('RGB')).astype(np.float32) / 255


def resize(a, long_edge):
    h, w = a.shape[:2]
    k = min(1, long_edge / max(h, w))
    return a if k == 1 else cv2.resize(a, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA)


def unmix(c, floor=0.02):
    a = 1 - c.min(2)
    a = np.clip((a - floor) / (1 - floor), 0, 1)
    return a


def matte(c, solid=True, hole=0.0001, thresh=0.045, feather=1.3):
    a = unmix(c)
    if solid:
        paint = (1 - c.min(2)) > thresh
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed = cv2.morphologyEx(paint.astype(np.uint8), cv2.MORPH_CLOSE, k).astype(bool)
        # Fill only small white pockets: highlights, not the view through an arch.
        lab, n = ndi.label(~closed)
        if n:
            size = ndi.sum(np.ones_like(lab), lab, np.arange(1, n + 1))
            small = np.zeros(n + 1, bool)
            small[1:] = size < hole * c.shape[0] * c.shape[1]
            closed |= small[lab]
        core = cv2.erode(closed.astype(np.uint8), k, iterations=1).astype(np.float32)
        core = cv2.GaussianBlur(core, (0, 0), feather)
        a = np.maximum(a, core)
    a = np.clip(a, 0, 1)
    col = np.where(a[..., None] > 1e-3, (c - (1 - a[..., None])) / np.maximum(a[..., None], 1e-3), c)
    return np.dstack([np.clip(col, 0, 1), a])


def save(a, path, q=80, aq=85):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    u = (a * 255 + 0.5).astype(np.uint8)
    im = Image.fromarray(u, 'RGBA' if a.shape[2] == 4 else 'RGB')
    im.save(path, 'WEBP', quality=q, alpha_quality=aq, method=6)
    print(f'{os.path.relpath(path, out):32s} {im.size[0]:5d}x{im.size[1]:<5d} {os.path.getsize(path) // 1024:4d} KB')


def tiered(a, path, q):
    """Writes the full layer, then a small one for weak devices in lite/."""
    save(a, path, q)
    d, n = os.path.split(path)
    save(resize(a, 900), os.path.join(d, 'lite', n), max(q - 14, 55), 70)


def crop_bottom_rows(a):
    """Trims the empty sky off a layer that only needs its lower part."""
    al = a[..., 3]
    rows = np.where(al.max(1) > 0.02)[0]
    return a[max(rows[0] - 4, 0):], rows[0]


def strip_clouds(name, dest, n=3, lighten=0):
    c = resize(load(name), 1200)
    m = matte(c, solid=False)
    m[..., :3] = m[..., :3] * (1 - lighten) + np.array([0.985, 0.965, 0.93], np.float32) * lighten
    rows = m[..., 3].max(1) > 0.03
    lab, k = ndi.label(rows)
    spans = sorted(ndi.find_objects(lab), key=lambda s: -(s[0].stop - s[0].start))[:n]
    spans = sorted(spans, key=lambda s: s[0].start)
    for i, s in enumerate(spans):
        y0, y1 = max(s[0].start - 8, 0), min(s[0].stop + 8, m.shape[0])
        band = m[y0:y1]
        xs = np.where(band[..., 3].max(0) > 0.03)[0]
        save(band[:, max(xs[0] - 8, 0):xs[-1] + 8], f'{dest}/cloud{i}.webp', 72, 70)


def petal_cells(name, dest, rows=3, cols=3):
    c = load(name)
    m = matte(c, solid=True)
    H, W = m.shape[:2]
    for r in range(rows):
        for q in range(cols):
            cell = m[r * H // rows:(r + 1) * H // rows, q * W // cols:(q + 1) * W // cols]
            ys, xs = np.where(cell[..., 3] > 0.05)
            cell = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            s = max(cell.shape[:2])
            sq = np.zeros((s, s, 4), np.float32)
            y, x = (s - cell.shape[0]) // 2, (s - cell.shape[1]) // 2
            sq[y:y + cell.shape[0], x:x + cell.shape[1]] = cell
            save(cv2.resize(sq, (96, 96), interpolation=cv2.INTER_AREA), f'{dest}/p{r * cols + q}.webp', 80, 85)


def columns(name, dest, stem, size):
    c = resize(load(name), size)
    m = matte(c, solid=True)
    cols = cv2.dilate((m[..., 3].max(0) > 0.04).astype(np.uint8)[None], np.ones((1, 9), np.uint8))[0].astype(bool)
    lab, k = ndi.label(cols)
    spans = sorted(ndi.find_objects(lab), key=lambda s: s[0].start)
    for i, s in enumerate(spans):
        band = m[:, max(s[0].start - 4, 0):s[0].stop + 4]
        ys = np.where(band[..., 3].max(1) > 0.04)[0]
        save(band[:ys[-1] + 4], f'{dest}/{stem}{i}.webp', 82, 85)


jobs = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'layers.json')))
for dest, spec in jobs.items():
    for out_name, s in spec.items():
        tag = f'{dest}/{out_name}'
        if only and dest not in only and tag not in only:
            continue
        if not os.path.exists(os.path.join(gen, s['src'], 'out.png')):
            print('missing', s['src'])
            continue
        src, mode = s['src'], s['mode']
        path = os.path.join(out, dest, out_name + '.webp')
        if mode == 'opaque':
            k = s.get('lighten', 0)
            tiered(resize(load(src), s.get('size', MAX)) * (1 - k) + np.array([0.98, 0.95, 0.91], np.float32) * k, path, s.get('q', 74))
        elif mode == 'object':
            m = matte(resize(load(src), s.get('size', MAX)), solid=True, hole=s.get('hole', 0.0001))
            if 'lighten' in s:
                k = s['lighten']
                m[..., :3] = m[..., :3] * (1 - k) + np.array([0.985, 0.965, 0.93], np.float32) * k
            (tiered if out_name in ('hills', 'subject', 'fg', 'swing') else save)(m, path, s.get('q', 80))
        elif mode == 'wash':
            save(matte(resize(load(src), s.get('size', MAX)), solid=False), path, s.get('q', 78))
        elif mode == 'clouds':
            strip_clouds(src, os.path.join(out, dest), lighten=s.get('lighten', 0))
        elif mode == 'columns':
            columns(src, os.path.join(out, dest), out_name, s.get('size', 1000))
        elif mode == 'petals':
            petal_cells(src, os.path.join(out, dest))
