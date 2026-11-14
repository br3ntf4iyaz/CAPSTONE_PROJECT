"""
AI-powered ID verification using Claude's vision capabilities.
Called asynchronously after an IDVerification record is saved.
"""
import base64
import json
import re
import anthropic
from django.conf import settings


def encode_image(image_field) -> tuple[str, str]:
    """Return (base64_data, media_type) for the uploaded image."""
    image_field.seek(0)
    raw = image_field.read()
    b64 = base64.standard_b64encode(raw).decode("utf-8")
    name = getattr(image_field, "name", "").lower()
    if name.endswith(".png"):
        media_type = "image/png"
    elif name.endswith(".webp"):
        media_type = "image/webp"
    elif name.endswith(".gif"):
        media_type = "image/gif"
    else:
        media_type = "image/jpeg"
    return b64, media_type


SYSTEM_PROMPT = """You are an identity verification AI for the LYDO (Lucena City Youth Development Office) portal.
Your job is to analyse a Philippine government-issued ID image submitted by a youth registrant.

You must respond with a single JSON object and nothing else. No markdown fences, no extra text.

JSON schema:
{
  "verdict": "approved" | "rejected",
  "confidence": <float 0.0–1.0>,
  "name_detected": <string | null>,
  "id_number_detected": <boolean>,
  "photo_present": <boolean>,
  "back_side_valid": <boolean>,
  "face_match": <boolean>,
  "selfie_is_live_person": <boolean>,
  "image_quality": "good" | "acceptable" | "poor",
  "issues": [<string>],
  "notes": <string>
}

You receive THREE images in this order: (1) the FRONT of the ID, (2) the BACK of the ID, (3) a live selfie taken with the device camera.
Rules:
- back_side_valid is true only if image 2 is the back of a real ID (not a copy of the front, not a random object).
- face_match is true only if the face in the selfie is clearly the same person as the photo on the ID front.
- selfie_is_live_person is false if the selfie looks like a photo of a screen or of a printed photo.
- Approve only if front and back are valid, face_match is true, selfie_is_live_person is true, and: real ID detected, face photo present, full name visible, image quality acceptable or better.
- Reject if: not an ID, blank/covered/cropped, photo missing, unreadable, or clearly fake.
- confidence reflects how certain you are of the verdict (1.0 = completely certain).
- issues is a list of specific problems found (empty list if none).
- notes is a short human-readable summary (1–2 sentences max)."""


def run_ai_check(verification) -> dict:
    """
    Analyse the ID image using Claude.
    Returns a dict with verdict, confidence, issues, notes, etc.
    Updates the IDVerification record in place.
    """
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    content = []
    labels = [("id_image", "Image 1: ID front"), ("id_back_image", "Image 2: ID back"), ("selfie_image", "Image 3: live selfie")]
    for field, label in labels:
        img = getattr(verification, field)
        if not img:
            return _rejection(f"Missing required image: {label}.")
        try:
            b64, media_type = encode_image(img)
        except Exception as exc:
            return _rejection(f"Could not read uploaded image ({label}): {exc}")
        content.append({"type": "text", "text": label})
        content.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}})

    user_full_name = verification.user.full_name
    content.append({
        "type": "text",
        "text": (
            f"The registrant's account name is: {user_full_name}\n"
            f"ID type declared: {verification.get_id_type_display()}\n\n"
            "Analyse the three images and return your JSON verdict."
        ),
    })

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=600,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    raw = message.content[0].text.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON if Claude wrapped it in prose
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                result = json.loads(match.group())
            except json.JSONDecodeError:
                return _rejection("AI returned unparseable response.", raw_text=raw)
        else:
            return _rejection("AI returned unparseable response.", raw_text=raw)

    return {
        "verdict":           result.get("verdict", "rejected"),
        "confidence":        float(result.get("confidence", 0.0)),
        "notes":             result.get("notes", ""),
        "issues":            result.get("issues", []),
        "name_detected":     result.get("name_detected"),
        "id_number_detected": result.get("id_number_detected", False),
        "photo_present":     result.get("photo_present", False),
        "face_match":        bool(result.get("face_match", False)),
        "back_valid":        bool(result.get("back_side_valid", False)),
        "live":              bool(result.get("selfie_is_live_person", False)),
        "image_quality":     result.get("image_quality", "poor"),
        "raw":               raw,
    }


def _rejection(reason: str, raw_text: str = "") -> dict:
    return {
        "verdict":    "rejected",
        "confidence": 1.0,
        "notes":      reason,
        "issues":     [reason],
        "name_detected": None,
        "id_number_detected": False,
        "photo_present": False,
        "image_quality": "poor",
        "raw": raw_text,
    }
