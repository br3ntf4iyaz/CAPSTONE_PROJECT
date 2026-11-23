"""
Automatic identity decision.

Every signal below is measured from the real submission:
  * photo quality: measured here, on the photos that were actually saved (Pillow)
  * face match, liveness (blink), ID framing: measured on the device by the camera and
    sent with the submission
  * ID text: read on the device with OCR and sent with the submission

A submission is approved automatically ONLY when every hard check passes and the combined
confidence reaches the configured threshold. Anything uncertain goes to a LYDO admin; nothing is
ever rejected automatically.

Note on trust: the device-side signals come from the user's browser. A user who talks to the API
directly could forge them, so auto-approvals are always recorded (auto_approved=True, audit log,
shown to admins) and an admin can revoke them.
"""
import os

from PIL import Image, ImageChops, ImageFilter, ImageStat

# strictest face distance we accept for AUTOMATIC approval (the browser's "same person" limit is 0.6)
FACE_DISTANCE_AUTO_MAX = 0.5
NAME_SCORE_MIN = 0.75

ID_MIN_SHORT_SIDE = 380
ID_MIN_SHARPNESS = 3.0     # fine-detail strength at 640 px wide: a sharp ID is >10, a soft one is <3
SELFIE_MIN_SHORT_SIDE = 400
SELFIE_MIN_SHARPNESS = 0.8



def auto_approve_enabled() -> bool:
    return str(os.getenv("VERIFICATION_AUTO_APPROVE", "True")).lower() in ("1", "true", "yes")


def confidence_threshold() -> float:
    try:
        return float(os.getenv("VERIFICATION_AUTO_APPROVE_THRESHOLD", "0.8"))
    except ValueError:
        return 0.8


def analyse_image(fieldfile) -> dict:
    """Size, fine-detail strength (how much is lost by a light blur, at 640 px), brightness and glare."""
    with fieldfile.open("rb") as f:
        img = Image.open(f)
        img.load()
    width, height = img.size
    gray = img.convert("L")
    if gray.width > 640:
        gray = gray.resize((640, max(1, round(gray.height * 640 / gray.width))))
    sharp = ImageStat.Stat(ImageChops.difference(gray, gray.filter(ImageFilter.GaussianBlur(1.2)))).rms[0]
    mean = ImageStat.Stat(gray).mean[0]
    hist = gray.histogram()
    total = max(1, sum(hist))
    return {
        "width": width,
        "height": height,
        "sharpness": round(sharp, 2),
        "brightness": round(mean, 1),
        "glare": round(sum(hist[247:]) / total, 4),
        "dark": round(sum(hist[:19]) / total, 4),
    }


def _quality_ok(info: dict, kind: str) -> bool:
    short = min(info["width"], info["height"])
    if kind == "id":
        return (
            short >= ID_MIN_SHORT_SIDE and info["sharpness"] >= ID_MIN_SHARPNESS
            and 55 <= info["brightness"] <= 235 and info["glare"] <= 0.12
        )
    return (
        short >= SELFIE_MIN_SHORT_SIDE and info["sharpness"] >= SELFIE_MIN_SHARPNESS
        and 45 <= info["brightness"] <= 232
    )


def clean_client_checks(raw) -> dict:
    """Keep only the known, simple fields the camera reports (never trust arbitrary JSON)."""
    out = {}
    if not isinstance(raw, dict):
        return out
    for side in ("front", "back", "selfie"):
        m = raw.get(side)
        if not isinstance(m, dict):
            continue
        item = {}
        for key in ("uploaded", "cardDetected", "liveness"):
            if isinstance(m.get(key), bool):
                item[key] = m[key]
        for key in ("sharpness", "brightness", "glare", "faceFill"):
            if isinstance(m.get(key), (int, float)) and not isinstance(m.get(key), bool):
                item[key] = float(m[key])
        out[side] = item
    return out


def clean_ocr(raw) -> dict:
    """Same idea for the OCR summary: small, typed, length-limited."""
    if not isinstance(raw, dict) or not raw.get("ran"):
        return {"ran": False}
    out = {"ran": True}
    for key in ("name_score", "confidence"):
        if isinstance(raw.get(key), (int, float)) and not isinstance(raw.get(key), bool):
            out[key] = max(0.0, min(1.0, float(raw[key])))
    for key in ("keyword_found", "id_number_found", "expired"):
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    for key in ("id_number", "expiry_date"):
        if isinstance(raw.get(key), str):
            out[key] = raw[key][:40]
    if isinstance(raw.get("text"), str):
        out["text"] = raw["text"][:1500]
    return out


def evaluate(v, face_distance, face_matched) -> dict:
    """
    Decide what happens to a submission.
    Returns {"status", "confidence", "flags", "image_checks", "auto"}.
    """
    from .models import IDTypeSetting

    flags: list[str] = []
    cc = v.client_checks or {}
    ocr = v.ocr_result or {}

    # accepted ID type
    setting = IDTypeSetting.objects.filter(code=v.id_type).first()
    if setting is not None and not setting.is_enabled:
        flags.append("unsupported_id")

    # photos measured on the server
    images = {}
    for name, field, kind in (("front", v.id_image, "id"), ("back", v.id_back_image, "id"), ("selfie", v.selfie_image, "selfie")):
        try:
            info = analyse_image(field)
        except Exception:
            info = None
        images[name] = info
        if info is None or not _quality_ok(info, kind):
            flags.append({"front": "front_unreadable", "back": "back_unreadable", "selfie": "selfie_quality"}[name])

    # live camera scan of both sides of the ID
    for side in ("front", "back"):
        m = cc.get(side, {})
        if m.get("uploaded") or not m.get("cardDetected"):
            flags.append("no_live_scan")
            break

    # liveness
    if not cc.get("selfie", {}).get("liveness"):
        flags.append("liveness_failed")

    # face match
    face_ok = False
    if face_distance is None:
        flags.append("face_unchecked")
    elif not face_matched:
        flags.append("face_mismatch")
    elif face_distance > FACE_DISTANCE_AUTO_MAX:
        flags.append("face_uncertain")
    else:
        face_ok = True

    # text on the ID
    name_score = 0.0
    if not ocr.get("ran"):
        flags.append("ocr_unavailable")
    else:
        name_score = float(ocr.get("name_score", 0))
        if name_score < NAME_SCORE_MIN:
            flags.append("name_mismatch")
        if ocr.get("expired") is True:
            flags.append("expired_id")
        if not ocr.get("keyword_found") and not ocr.get("id_number_found"):
            flags.append("unrecognized_id")

    # combined confidence (0..1)
    face_score = 0.0 if face_distance is None else max(0.0, min(1.0, (0.6 - face_distance) / 0.25))
    live_score = 1.0 if cc.get("selfie", {}).get("liveness") else 0.0
    good = [images[k] is not None and _quality_ok(images[k], "id" if k != "selfie" else "selfie") for k in images]
    quality_score = sum(good) / len(good)
    ocr_score = 0.0
    if ocr.get("ran"):
        ocr_score = 0.5 * name_score + 0.25 * (1.0 if ocr.get("keyword_found") else 0.0) + 0.25 * (1.0 if ocr.get("id_number_found") else 0.0)
    detect_score = 1.0 if "no_live_scan" not in flags else 0.0
    confidence = round(0.30 * face_score + 0.15 * live_score + 0.20 * quality_score + 0.25 * ocr_score + 0.10 * detect_score, 3)

    threshold = confidence_threshold()
    if confidence < threshold and not flags:
        flags.append("low_confidence")

    auto = auto_approve_enabled() and face_ok and not flags and confidence >= threshold
    return {
        "status": "approved" if auto else "reviewing",
        "confidence": confidence,
        "flags": sorted(set(flags)),
        "image_checks": images,
        "auto": auto,
    }

