"""Code-made textures for V2: the bleed noise and the bare-paper wipe.

usage: textures.py <public-art-dir>
"""
import os, sys
import numpy as np
import cv2
from PIL import Image

out = sys.argv[1]
rs = np.random.RandomState(11)


def spectral(n, power, m=None):
    """Tileable noise, by shaping white noise in frequency. Normalised to 0..1."""
    m = m or n
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.fftfreq(m)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    spec = np.fft.fft2(rs.randn(n, m)) / f ** power
    spec[0, 0] = 0
    a = np.real(np.fft.ifft2(spec))
    a = (a - np.percentile(a, 1)) / (np.percentile(a, 99) - np.percentile(a, 1))
    return np.clip(a, 0, 1).astype(np.float32)


# R: broad blooms. G: the cauliflower edge, ridged. B: paper grain.
n = 256
r = spectral(n, 1.7)
g = 1 - np.abs(spectral(n, 1.25) * 2 - 1)
b = spectral(n, 0.55)
noise = np.dstack([r, g, b])
Image.fromarray((noise * 255).astype(np.uint8), 'RGB').save(os.path.join(out, 'noise.webp'), 'WEBP', quality=90, method=6)

# Wipe: a broad sheet of paper with wet, ragged leading and trailing edges.
H, W = 640, 1500
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
big = cv2.resize(spectral(256, 1.6, 512), (W, H), interpolation=cv2.INTER_CUBIC)
fine = cv2.resize(spectral(256, 1.05, 512), (W, H), interpolation=cv2.INTER_CUBIC)
grain = cv2.resize(spectral(512, 0.45, 1024), (W, H), interpolation=cv2.INTER_LINEAR)
edge = W * 0.1
d = np.minimum(xx, W - xx) + (big - 0.5) * edge * 1.5 + (fine - 0.5) * edge * 0.35 - edge * 0.62
a = np.clip(d / 7 + 0.5, 0, 1)
paper = np.array([0.968, 0.937, 0.89], np.float32)
c = np.ones((H, W, 3), np.float32) * paper
c *= (1 + (grain - 0.5) * 0.035)[..., None]
# Pigment gathered at the drying edge.
rim = np.exp(-np.clip(d, 0, None) / 9)
wash = np.exp(-np.clip(d, 0, None) / 70)
tint = np.array([0.86, 0.68, 0.66], np.float32)
c = c * (1 - (rim * 0.5 + wash * 0.2)[..., None]) + tint * (rim * 0.5 + wash * 0.2)[..., None]
# A faint wash of ground for the dog to walk on.
gl = H * (0.925 + (big - 0.5) * 0.04)
ground = np.clip(1 - np.abs(yy - gl) / (H * 0.075), 0, 1) ** 1.4 * (0.5 + 0.5 * fine)
ground *= np.clip(d / 200, 0, 1)
gt = np.array([0.87, 0.82, 0.68], np.float32)
c = c * (1 - ground[..., None] * 0.6) + gt * ground[..., None] * 0.6
img = np.dstack([np.clip(c, 0, 1), a])
Image.fromarray((img * 255 + 0.5).astype(np.uint8), 'RGBA').save(os.path.join(out, 'wipe.webp'), 'WEBP', quality=78, alpha_quality=80, method=6)
for f in ('noise', 'wipe'):
    print(f, os.path.getsize(os.path.join(out, f + '.webp')) // 1024, 'KB')
