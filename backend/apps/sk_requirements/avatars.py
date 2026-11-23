"""
Cartoon "sample face" pictures for the SK Directory.

These are drawn by code (no real person, no stock photo) so the directory looks complete while the
LYDO admin collects the real, verified pictures. They are clearly illustrations and are stored under a
`sample_` file name so they can be told apart from real uploads and replaced or removed at any time.
"""
import random

from PIL import Image, ImageDraw

SKIN = [(247, 219, 190), (238, 199, 158), (226, 177, 131), (206, 152, 106), (178, 124, 84), (150, 100, 66)]
HAIR = [(22, 18, 16), (38, 27, 21), (56, 39, 29), (74, 52, 37), (30, 30, 38), (96, 66, 44)]
SHIRT = [(0, 56, 168), (28, 92, 192), (206, 17, 38), (232, 178, 0), (38, 122, 92), (92, 92, 116), (240, 240, 244), (120, 60, 140)]
BACKGROUND = [(222, 234, 250), (234, 224, 250), (222, 245, 236), (255, 238, 216), (250, 226, 230), (226, 240, 248)]
STYLES = ["short", "side", "long", "bun", "curly", "buzz", "bob"]


def _shade(color, factor):
    return tuple(max(0, min(255, int(c * factor))) for c in color)


def _ellipse(d, cx, cy, rx, ry, fill, outline=None, width=0):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill, outline=outline, width=width)


def make_avatar(seed: int, size: int = 720) -> Image.Image:
    """A friendly illustrated head-and-shoulders portrait, different for every seed."""
    rnd = random.Random(seed * 7919 + 13)
    S = size * 2  # draw large, shrink at the end for smooth edges
    cx = S / 2

    bg = rnd.choice(BACKGROUND)
    img = Image.new("RGB", (S, S), bg)
    d = ImageDraw.Draw(img)
    # soft vertical gradient behind the person
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=tuple(int(c * (1 - 0.12 * t) + 255 * 0.12 * (1 - t)) for c in bg))

    skin = rnd.choice(SKIN)
    skin_dark = _shade(skin, 0.86)
    hair = rnd.choice(HAIR)
    shirt = rnd.choice(SHIRT)
    style = rnd.choice(STYLES)
    head_rx, head_ry = S * 0.175, S * 0.215
    head_cy = S * 0.43

    # long / bob hair goes behind the head and shoulders
    if style == "long":
        _ellipse(d, cx, head_cy + S * 0.05, head_rx * 1.28, head_ry * 1.25, hair)
        d.rectangle([cx - head_rx * 1.28, head_cy, cx + head_rx * 1.28, S * 0.78], fill=hair)
    elif style == "bob":
        _ellipse(d, cx, head_cy + S * 0.02, head_rx * 1.22, head_ry * 1.12, hair)
        d.rectangle([cx - head_rx * 1.22, head_cy - S * 0.02, cx + head_rx * 1.22, head_cy + S * 0.15], fill=hair)
    elif style == "bun":
        _ellipse(d, cx, head_cy - head_ry * 1.12, S * 0.07, S * 0.07, hair)

    # shoulders and shirt
    d.ellipse([S * 0.10, S * 0.70, S * 0.90, S * 1.32], fill=shirt)
    collar = (255, 255, 255) if shirt != (240, 240, 244) else (200, 200, 210)
    d.polygon([(cx - S * 0.11, S * 0.70), (cx + S * 0.11, S * 0.70), (cx, S * 0.86)], fill=skin_dark)
    d.polygon([(cx - S * 0.12, S * 0.69), (cx - S * 0.02, S * 0.78), (cx - S * 0.13, S * 0.80)], fill=collar)
    d.polygon([(cx + S * 0.12, S * 0.69), (cx + S * 0.02, S * 0.78), (cx + S * 0.13, S * 0.80)], fill=collar)

    # neck
    d.rectangle([cx - S * 0.065, S * 0.58, cx + S * 0.065, S * 0.76], fill=skin_dark)

    # ears, then head
    for side in (-1, 1):
        _ellipse(d, cx + side * head_rx * 0.98, head_cy + S * 0.01, S * 0.026, S * 0.04, skin_dark)
    _ellipse(d, cx, head_cy, head_rx, head_ry, skin)

    # hair on top
    top = head_cy - head_ry
    if style in ("short", "side", "bun", "long", "bob"):
        d.pieslice([cx - head_rx * 1.06, top - S * 0.03, cx + head_rx * 1.06, top + head_ry * 1.15], 180, 360, fill=hair)
        d.rectangle([cx - head_rx * 1.04, top + head_ry * 0.38, cx - head_rx * 0.84, top + head_ry * 0.78], fill=hair)
        d.rectangle([cx + head_rx * 0.84, top + head_ry * 0.38, cx + head_rx * 1.04, top + head_ry * 0.78], fill=hair)
        if style == "side":
            d.polygon([(cx - head_rx * 1.0, top + head_ry * 0.45), (cx + head_rx * 0.9, top + head_ry * 0.30), (cx + head_rx * 0.9, top + head_ry * 0.62)], fill=hair)
        else:
            _ellipse(d, cx, top + head_ry * 0.30, head_rx * 0.95, head_ry * 0.28, hair)
    elif style == "curly":
        for i in range(11):
            angle = 3.14159 * (i / 10)
            import math
            x = cx - math.cos(angle) * head_rx * 1.05
            y = top + head_ry * 0.45 - math.sin(angle) * head_ry * 0.72
            _ellipse(d, x, y, S * 0.05, S * 0.05, hair)
        _ellipse(d, cx, top + head_ry * 0.32, head_rx * 0.9, head_ry * 0.3, hair)
    elif style == "buzz":
        d.pieslice([cx - head_rx * 1.02, top - S * 0.01, cx + head_rx * 1.02, top + head_ry * 1.02], 190, 350, fill=_shade(hair, 1.5))

    # eyebrows, eyes, nose, mouth
    brow = _shade(hair, 1.1)
    eye_y = head_cy - head_ry * 0.02
    for side in (-1, 1):
        ex = cx + side * head_rx * 0.42
        d.line([(ex - S * 0.035, eye_y - S * 0.055 + (side * 0)), (ex + S * 0.035, eye_y - S * 0.062)], fill=brow, width=int(S * 0.011))
        _ellipse(d, ex, eye_y, S * 0.026, S * 0.019, (255, 255, 255))
        _ellipse(d, ex, eye_y, S * 0.013, S * 0.013, (40, 28, 22))
        _ellipse(d, ex + S * 0.004, eye_y - S * 0.004, S * 0.004, S * 0.004, (255, 255, 255))
    d.arc([cx - S * 0.025, head_cy + head_ry * 0.10, cx + S * 0.025, head_cy + head_ry * 0.34], 20, 160, fill=_shade(skin, 0.7), width=int(S * 0.007))
    smile = rnd.choice([0.55, 0.75, 1.0])
    d.arc([cx - S * 0.07, head_cy + head_ry * 0.34, cx + S * 0.07, head_cy + head_ry * (0.34 + 0.38 * smile)], 20, 160, fill=(150, 62, 62), width=int(S * 0.010))
    # a touch of blush
    for side in (-1, 1):
        _ellipse(d, cx + side * head_rx * 0.62, head_cy + head_ry * 0.30, S * 0.03, S * 0.017, _shade((255, 150, 140), 1.0))

    # glasses on some portraits
    if rnd.random() < 0.18:
        frame = (60, 60, 70)
        for side in (-1, 1):
            ex = cx + side * head_rx * 0.42
            d.ellipse([ex - S * 0.050, eye_y - S * 0.038, ex + S * 0.050, eye_y + S * 0.042], outline=frame, width=int(S * 0.008))
        d.line([(cx - head_rx * 0.42 + S * 0.05, eye_y), (cx + head_rx * 0.42 - S * 0.05, eye_y)], fill=frame, width=int(S * 0.008))

    return img.resize((size, size), Image.LANCZOS)
