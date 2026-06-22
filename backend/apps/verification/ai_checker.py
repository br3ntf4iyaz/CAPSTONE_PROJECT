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
  "image_quality": "good" | "acceptable" | "poor",
  "issues": [<string>],
  "notes": <string>
}

Rules:
- Approve only if: real ID detected, face photo present, full name visible, image quality acceptable or better.
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

    try:
        b64, media_type = encode_image(verification.id_image)
    except Exception as exc:
        return _rejection(f"Could not read uploaded image: {exc}")

    user_full_name = verification.user.full_name

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            f"The registrant's account name is: {user_full_name}\n"
                            f"ID type declared: {verification.get_id_type_display()}\n\n"
                            "Analyse this ID image and return your JSON verdict."
                        ),
                    },
                ],
            }
        ],
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
