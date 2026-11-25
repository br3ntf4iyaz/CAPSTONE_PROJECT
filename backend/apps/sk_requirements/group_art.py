"""A cartoon group picture of a barangay's SK council, drawn by code (no real photo, no stock image).

It is built from the council's own portraits: the picture of each official when there is one, otherwise a drawn
cartoon face. It is only a placeholder: the SK can replace it with their real group photo at any time.
"""
import io

from PIL import Image, ImageDraw, ImageFilter

from .avatars import make_avatar

W, H = 1200, 900  # 4:3: faces stay large when the picture is shown in a small box


def _portrait(member_or_none, chair_photo, seed, diameter):
    """A round portrait: the stored picture when there is one, else a drawn face."""
    img = None
    field = chair_photo if member_or_none is None else member_or_none.photo
    if field:
        try:
            field.open('rb')
            try:
                img = Image.open(io.BytesIO(field.read())).convert('RGB')
            finally:
                field.close()
        except Exception:
            img = None
    if img is None:
        img = make_avatar(seed, 480).convert('RGB')
    side = min(img.size)
    left, top = (img.width - side) // 2, 0  # keep the top: faces are at the top of a portrait
    img = img.crop((left, top, left + side, top + side)).resize((diameter, diameter), Image.LANCZOS)
    mask = Image.new('L', (diameter * 4, diameter * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, diameter * 4 - 1, diameter * 4 - 1], fill=255)
    mask = mask.resize((diameter, diameter), Image.LANCZOS)
    out = Image.new('RGBA', (diameter + 16, diameter + 16), (0, 0, 0, 0))
    ring = Image.new('L', out.size, 0)
    ImageDraw.Draw(ring).ellipse([0, 0, out.width - 1, out.height - 1], fill=255)
    out.paste((255, 255, 255, 255), (0, 0), ring)  # white border
    out.paste(img, (8, 8), mask)
    return out


def _shadow(img, pos, size, alpha):
    """A soft shadow under a portrait, on a canvas big enough that the blur is never cut off."""
    pad = 40
    sh = Image.new('RGBA', (size[0] + 2 * pad, size[1] + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([pad + 6, pad + 16, pad + size[0] - 6, pad + size[1] + 6], fill=(0, 0, 0, alpha))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)), (pos[0] - pad, pos[1] - pad))


def make_group_picture(barangay) -> bytes:
    """JPEG bytes of the council picture of one barangay."""
    members = {p: [] for p in ('kagawad', 'secretary', 'treasurer')}
    for m in barangay.members.all():
        members.setdefault(m.position, []).append(m)
    for v in members.values():
        v.sort(key=lambda m: (m.order, m.id))
    others = members['kagawad'] + members['secretary'] + members['treasurer']

    # a soft scene: sky into warm light, with a gentle hill
    img = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(img)
    top, bottom = (196, 220, 250), (255, 240, 214)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)))
    d.ellipse([-300, 600, W + 300, H + 520], fill=(168, 214, 176))
    d.ellipse([-100, 700, W + 100, H + 700], fill=(139, 197, 150))
    for cx, cy, r in ((190, 70, 60), (270, 55, 42), (950, 90, 66), (1040, 72, 46)):  # clouds
        d.ellipse([cx - r, cy - r // 2, cx + r, cy + r // 2], fill=(255, 255, 255))
    img = img.convert('RGBA')

    seed0 = barangay.pk * 31
    back, mid = others[:5], others[5:9]
    layout = [(back, 120, 200, W * 0.15, W * 0.85), (mid, 330, 225, W * 0.25, W * 0.75)]
    index = 0
    for people, y, diameter, x0, x1 in layout:
        n = max(len(people), 1)
        for i, m in enumerate(people):
            x = x0 + (x1 - x0) * (i / (n - 1) if n > 1 else 0.5)
            p = _portrait(m, None, seed0 + index + 1, diameter)
            pos = (int(x - p.width / 2), int(y))
            _shadow(img, pos, p.size, 70)
            img.alpha_composite(p, pos)
            index += 1
    chair = _portrait(None, barangay.chairperson_photo, seed0, 310)
    _shadow(img, (W // 2 - chair.width // 2, 560), chair.size, 80)
    img.alpha_composite(chair, (W // 2 - chair.width // 2, 560))

    out = io.BytesIO()
    img.convert('RGB').save(out, 'JPEG', quality=90, optimize=True)  # full size, so the zoom viewer stays sharp
    return out.getvalue()
