"""
Automatic identity decision.

Every signal below is measured from the real submission:
  * photo quality: measured here, on the photos that were actually saved (Pillow)
  * face match, liveness (blink), ID framing: measured on the device by the camera and
    sent with the submission
  * ID text: read on the device with OCR and sent with the submission

Modes (VERIFICATION_MODE):
  fast      (default) approve right away unless there is a HARD red flag (the face clearly does not match,
            the ID is expired or unsupported, the name on it clearly belongs to someone else, or a photo is
            unreadable). Smaller doubts (no blink, ID text could not be read, face match only fair, ...) do
            not make the user wait: they are approved and listed for an admin "spot check", who can revoke.
  balanced  every check must pass; only a missing blink is forgiven when everything else is strong.
  strict    every check must pass, including the blink / head turn.
Nothing is ever rejected automatically in any mode.

Note on trust: the device-side signals come from the user's browser. A user who talks to the API
directly could forge them, so auto-approvals are always recorded (auto_approved=True, audit log,
shown to admins) and an admin can revoke them.
"""
import os
import re

from PIL import Image, ImageChops, ImageFilter, ImageStat

# strictest face distance we accept for AUTOMATIC approval (the browser's "same person" limit is 0.6)
FACE_DISTANCE_AUTO_MAX = 0.5
# when the blink/head-turn was not captured, the face match must be at least this good
FACE_DISTANCE_BALANCED_MAX = 0.45
# fast mode: ID photos are small and soft, so a genuine person is often 0.5-0.58 away from their own ID photo
FACE_DISTANCE_FAST_MAX = 0.58
NAME_SCORE_MIN = 0.75
NAME_SCORE_HARD_MIN = 0.5

# In fast mode only these send a person to the admin queue; every other flag is a note for a spot check.
HARD_FLAGS = {
    "unsupported_id", "front_unreadable", "back_unreadable", "selfie_quality",
    "face_mismatch", "face_unchecked", "face_uncertain", "expired_id", "name_mismatch", "duplicate_id",
}

ID_MIN_SHORT_SIDE = 380
ID_MIN_SHARPNESS = 3.0     # fine-detail strength at 640 px wide: a sharp ID is >10, a soft one is <3
SELFIE_MIN_SHORT_SIDE = 400
SELFIE_MIN_SHARPNESS = 0.8



def auto_approve_enabled() -> bool:
    return str(os.getenv("VERIFICATION_AUTO_APPROVE", "True")).lower() in ("1", "true", "yes")


def verification_mode() -> str:
    """
    'fast' (default), 'balanced' or 'strict'. See the module description above.
    """
    mode = str(os.getenv("VERIFICATION_MODE", "fast")).lower()
    return mode if mode in ("fast", "balanced", "strict") else "fast"


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
    # the same ID number must not unlock several accounts: keep a comparable form computed on the server
    norm = re.sub(r"[^A-Z0-9]", "", str(out.get("id_number", "")).upper())
    if len(norm) >= 8:
        out["id_number_norm"] = norm
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
    mode = verification_mode()
    face_max = FACE_DISTANCE_FAST_MAX if mode == "fast" else FACE_DISTANCE_AUTO_MAX
    face_ok = False
    if face_distance is None:
        flags.append("face_unchecked")
    elif not face_matched:
        flags.append("face_mismatch")
    elif face_distance > face_max:
        flags.append("face_uncertain")
    else:
        face_ok = True
        if mode == "fast" and face_distance > FACE_DISTANCE_AUTO_MAX:
            flags.append("face_fair")  # approved, but noted for a spot check

    # one ID, one account
    norm = ocr.get("id_number_norm")
    if norm:
        from .models import IDVerification

        clash = (
            IDVerification.objects.filter(ocr_result__id_number_norm=norm)
            .exclude(user_id=v.user_id)
            .exclude(status=IDVerification.Status.REJECTED)
            .exists()
        )
        if clash:
            flags.append("duplicate_id")

    # text on the ID
    name_score = 0.0
    if not ocr.get("ran"):
        flags.append("ocr_unavailable")
    else:
        name_score = float(ocr.get("name_score", 0))
        if mode == "fast":
            if name_score < NAME_SCORE_HARD_MIN:
                flags.append("name_mismatch")
            elif name_score < NAME_SCORE_MIN:
                flags.append("name_unclear")
        elif name_score < NAME_SCORE_MIN:
            flags.append("name_mismatch")
        if ocr.get("expired") is True:
            flags.append("expired_id")
        if not ocr.get("keyword_found") and not ocr.get("id_number_found"):
            flags.append("unrecognized_id")

    # Balanced mode: a quick/unsuccessful blink alone should not send a clearly legitimate user to an admin.
    quality_all_good = all(
        images[k] is not None and _quality_ok(images[k], "id" if k != "selfie" else "selfie") for k in images
    )
    live_skipped = False
    if (
        "liveness_failed" in flags
        and mode == "balanced"
        and face_ok
        and face_distance is not None and face_distance <= FACE_DISTANCE_BALANCED_MAX
        and ocr.get("ran") and name_score >= 0.9 and ocr.get("keyword_found")
        and "no_live_scan" not in flags
        and quality_all_good
    ):
        flags.remove("liveness_failed")
        live_skipped = True

    # combined confidence (0..1)
    face_score = 0.0 if face_distance is None else max(0.0, min(1.0, (0.6 - face_distance) / 0.25))
    live_score = 1.0 if cc.get("selfie", {}).get("liveness") else (0.6 if live_skipped else 0.0)
    good = [images[k] is not None and _quality_ok(images[k], "id" if k != "selfie" else "selfie") for k in images]
    quality_score = sum(good) / len(good)
    ocr_score = 0.0
    if ocr.get("ran"):
        ocr_score = 0.5 * name_score + 0.25 * (1.0 if ocr.get("keyword_found") else 0.0) + 0.25 * (1.0 if ocr.get("id_number_found") else 0.0)
    detect_score = 1.0 if "no_live_scan" not in flags else 0.0
    confidence = round(0.30 * face_score + 0.15 * live_score + 0.20 * quality_score + 0.25 * ocr_score + 0.10 * detect_score, 3)

    threshold = confidence_threshold()
    if mode == "fast":
        hard = HARD_FLAGS & set(flags)
        auto = auto_approve_enabled() and face_ok and not hard
        live_skipped = auto and "liveness_failed" in flags
    else:
        if confidence < threshold and not flags:
            flags.append("low_confidence")
        auto = auto_approve_enabled() and face_ok and not flags and confidence >= threshold
    return {
        "status": "approved" if auto else "reviewing",
        "confidence": confidence,
        "flags": sorted(set(flags)),
        "image_checks": images,
        "auto": auto,
        "live_skipped": live_skipped and auto,
        "mode": mode,
    }

