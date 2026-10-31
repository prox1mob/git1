"""Draws the launcher icon (yellow tile, protractor arc, pencil) at every Android density."""
import math
import os
import sys

from PIL import Image, ImageDraw

S = 1024  # draw big, then scale down for smooth edges
NAVY = (31, 42, 68, 255)
YELLOW = (255, 212, 59, 255)
BLUE = (59, 91, 219, 255)
WHITE = (255, 255, 255, 255)


def draw() -> Image.Image:
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([40, 40, S - 40, S - 40], radius=220, fill=YELLOW)
    # protractor: half disc with tick marks
    cx, cy, r = S * 0.5, S * 0.66, S * 0.34
    d.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=WHITE, outline=NAVY, width=34)
    d.line([cx - r, cy, cx + r, cy], fill=NAVY, width=34)
    for k in range(0, 181, 15):
        a = math.radians(k)
        long = k % 45 == 0
        r1, r2 = r - 18, r - (90 if long else 55)
        d.line([cx + r1 * math.cos(a), cy - r1 * math.sin(a), cx + r2 * math.cos(a), cy - r2 * math.sin(a)], fill=NAVY, width=16 if long else 10)
    # angle ray
    a = math.radians(55)
    d.line([cx, cy, cx + r * 0.95 * math.cos(a), cy - r * 0.95 * math.sin(a)], fill=BLUE, width=30)
    d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=NAVY)
    # pencil across the top-left
    ang = math.radians(-32)
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    px, py, L, w = S * 0.17, S * 0.36, S * 0.34, S * 0.07

    def pt(t, s):
        return (px + ux * t + vx * s, py + uy * t + vy * s)

    d.polygon([pt(0, -w), pt(L, -w), pt(L, w), pt(0, w)], fill=NAVY)
    d.polygon([pt(L, -w), pt(L + w * 2.2, 0), pt(L, w)], fill=(240, 200, 150, 255))
    d.polygon([pt(L + w * 1.5, -w * 0.32), pt(L + w * 2.2, 0), pt(L + w * 1.5, w * 0.32)], fill=NAVY)
    d.polygon([pt(-w * 0.9, -w), pt(0, -w), pt(0, w), pt(-w * 0.9, w)], fill=(229, 72, 77, 255))
    return img


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'res'
    big = draw()
    for name, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        folder = os.path.join(out, f'mipmap-{name}')
        os.makedirs(folder, exist_ok=True)
        big.resize((px, px), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher.png'))
    big.resize((512, 512), Image.LANCZOS).save(os.path.join(out, '..', 'icon-512.png'))
    print('icons written to', out)
