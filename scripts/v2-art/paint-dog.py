"""Turns the raw Beagle frames into watercolour sprites and packs one atlas.

usage: paint-dog.py <rawdir> <out.webp> <out.json>

The pigment model works in optical density, as real watercolour does: colour is
exp(-density), so a darker passage is more pigment, not a black overlay.
The noise is fixed across frames, so the paper does not boil as the dog moves.
"""
import glob, json, os, sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

raw, out_img, out_json = sys.argv[1:4]
FW, FH = 264, 232          # sprite frame, device pixels
COLS = 8
rs = np.random.RandomState(7)


def noise(shape, sigma, seed):
    r = np.random.RandomState(seed).rand(*shape).astype(np.float32)
    n = cv2.GaussianBlur(r, (0, 0), sigma)
    return (n - n.mean()) / (n.std() + 1e-6)


def paint(rgba, N):
    a = rgba[..., 3].astype(np.float32) / 255
    # Un-premultiply by bleeding colour outward, so edges stay clean after the blur.
    rgb = rgba[..., :3].copy()
    m = (a > 0.5)
    idx = ndi.distance_transform_edt(~m, return_distances=False, return_indices=True)
    rgb = rgb[idx[0], idx[1]]

    # Flatten the 3D shading into brush-sized areas.
    f = rgb
    for _ in range(4):
        f = cv2.bilateralFilter(f, 15, 48, 13)
    f = cv2.pyrMeanShiftFiltering(f, 12, 26)
    c = f.astype(np.float32) / 255
    # Keep a little of the form shading from the render, softly.
    c = c * 0.86 + (cv2.GaussianBlur(rgb, (0, 0), 3).astype(np.float32) / 255) * 0.14

    # Warm the colours toward the painted world and lift the blacks.
    c = c ** 0.86
    gray = c.mean(2, keepdims=True)
    c = gray + (c - gray) * 0.86
    c = c * np.array([1.0, 0.975, 0.93], np.float32) + np.array([0.035, 0.03, 0.03], np.float32)
    c = np.clip(c, 0.02, 1)

    D = -np.log(c)

    # Wet-in-wet unevenness, blooms and paper granulation.
    D *= 1 + 0.26 * N['low'][..., None] + 0.10 * N['mid'][..., None] + 0.035 * N['grain'][..., None]

    # Pigment pools at the edge of each shape: the outer silhouette...
    # Brushes wander, so the silhouette gets a small hand-made wobble.
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    wob = 2.6
    mx = xx + N['low2'] * wob
    my = yy + N['low3'] * wob
    a2 = cv2.remap(a, mx, my, cv2.INTER_LINEAR)
    D = cv2.remap(D, mx, my, cv2.INTER_LINEAR)
    dist = ndi.distance_transform_edt(a2 > 0.5).astype(np.float32)
    rimk = np.exp(-dist / 3.0) * (1 + 0.45 * N['mid'])
    D *= (1 + 0.5 * rimk)[..., None]
    # Pale passages need a line of pigment too, or the white legs melt into the paper.
    D += (0.26 * rimk)[..., None] * np.array([0.8, 1.0, 1.05], np.float32)
    # A cool shadow wash down the underside, as a painter would lay in.
    D += (0.2 * np.clip((yy / h - 0.62) / 0.3, 0, 1) * np.exp(-dist / 40))[..., None] * np.array([0.8, 1.0, 0.95], np.float32)
    # ...and at the boundary between colours inside it.
    g = cv2.GaussianBlur(f, (0, 0), 1.2).astype(np.float32) / 255
    g = cv2.remap(g, mx, my, cv2.INTER_LINEAR)
    e = np.sqrt(cv2.Sobel(g.mean(2), cv2.CV_32F, 1, 0, ksize=3) ** 2 + cv2.Sobel(g.mean(2), cv2.CV_32F, 0, 1, ksize=3) ** 2)
    D *= (1 + np.clip(e * 1.7, 0, 0.6))[..., None]

    # Thin, light passages let the paper through.
    c = np.exp(-D)
    light = np.clip(N['low'] * 0.5 + 0.5, 0, 1) * 0.07
    c = c + (1 - c) * light[..., None]

    # A soft silhouette, slightly feathered and broken by the paper tooth.
    al = cv2.GaussianBlur(a2, (0, 0), 1.1)
    al = np.clip((al - 0.30 + 0.02 * N['grain']) / 0.46, 0, 1)
    return np.dstack([np.clip(c, 0, 1), al])


frames = sorted(glob.glob(os.path.join(raw, '*.png')))
first = np.array(Image.open(frames[0]).convert('RGBA'))
H, W = first.shape[:2]
N = {
    'low': noise((H, W), 26, 1), 'mid': noise((H, W), 7, 2), 'grain': noise((H, W), 1.0, 3),
    'low2': noise((H, W), 14, 4), 'low3': noise((H, W), 14, 5),
}

# One crop for every frame, so the feet stay on the same line.
box = None
stack = {}
for f in frames:
    im = np.array(Image.open(f).convert('RGBA'))
    stack[f] = im
    ys, xs = np.where(im[..., 3] > 8)
    b = [xs.min(), ys.min(), xs.max(), ys.max()]
    box = b if box is None else [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
pad = 12
x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
scale = min(FW / (x1 - x0), FH / (y1 - y0))
cw, ch = int(round(FW / scale)), int(round(FH / scale))
cx, cy = (x0 + x1) // 2, y1 - ch   # feet anchored to the bottom of the frame
cx0 = cx - cw // 2

names = [os.path.basename(f)[:-4] for f in frames]
strips = {}
for n in names:
    s = n.split('-')[0]
    strips.setdefault(s, 0)
    strips[s] += 1
order = ['walk', 'back', 'settle', 'idle']
seq = [f'{s}-{k:02d}' for s in order for k in range(strips[s])]
rows = (len(seq) + COLS - 1) // COLS
atlas = Image.new('RGBA', (COLS * FW, rows * FH), (0, 0, 0, 0))
start, i = {}, 0
for s in order:
    start[s] = i
    i += strips[s]
for i, n in enumerate(seq):
    im = stack[os.path.join(raw, n + '.png')] if os.path.join(raw, n + '.png') in stack else stack[[f for f in frames if f.endswith(n + '.png')][0]]
    p = paint(im, N)
    p = p[max(cy, 0):cy + ch, max(cx0, 0):cx0 + cw]
    rgb = (np.clip(p[..., :3] * p[..., 3:], 0, 1))  # premultiply for a clean resize
    pm = np.dstack([rgb, p[..., 3]])
    pm = cv2.resize(pm, (FW, FH), interpolation=cv2.INTER_AREA)
    a = pm[..., 3:]
    col = np.where(a > 1e-3, pm[..., :3] / np.maximum(a, 1e-3), 0)
    o = np.dstack([np.clip(col, 0, 1), a])
    atlas.paste(Image.fromarray((o * 255 + 0.5).astype(np.uint8), 'RGBA'), ((i % COLS) * FW, (i // COLS) * FH))

atlas.save(out_img, 'WEBP', quality=86, alpha_quality=90, method=6, exact=False)
lite = atlas.resize((atlas.width * 2 // 3, atlas.height * 2 // 3), Image.LANCZOS)
lite.save(out_img.replace('.webp', '-lite.webp'), 'WEBP', quality=74, alpha_quality=75, method=6)
# Where the paws sit, as a share of the frame height, for lining up with the 3D dog.
ppu = H / (2 * np.tan(np.radians(15)) * 3.7 * 1.0109)   # render pixels per world unit
meta = {'fw': FW, 'fh': FH, 'cols': COLS, 'strips': {s: {'start': start[s], 'n': strips[s]} for s in order},
        'worldHeight': round(float(ch / ppu), 4), 'footLift': round(float((y1 - box[3]) / ch), 4),
        'rootX': round(float((W / 2 - 0.1 * ppu - cx0) / cw), 4)}
json.dump(meta, open(out_json, 'w'), indent=1)
print('atlas', atlas.size, os.path.getsize(out_img) // 1024, 'KB', meta)
