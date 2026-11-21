import os

from rest_framework import serializers

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
DOC_EXTS = {".pdf", ".doc", ".docx"}


def _fail(field, message):
    raise serializers.ValidationError({field: message} if field else message)


def check_upload(file, allowed_exts, max_bytes, field="file"):
    """Reject files by extension AND by what is really inside (not the client-sent type).

    - images must open as a real image
    - PDFs must start with the %PDF header
    - Word files must start with the DOC/DOCX container signatures
    """
    if file is None:
        return file
    if file.size > max_bytes:
        _fail(field, f"File must be under {max_bytes // (1024 * 1024)} MB.")
    ext = os.path.splitext(file.name or "")[1].lower()
    if ext not in allowed_exts:
        _fail(field, "Allowed file types: " + ", ".join(sorted(e.lstrip(".").upper() for e in allowed_exts)) + ".")
    head = file.read(8)
    file.seek(0)
    ok = True
    if ext in IMAGE_EXTS:
        try:
            from PIL import Image
            Image.open(file).verify()
        except Exception:
            ok = False
        file.seek(0)
    elif ext == ".pdf":
        ok = head.startswith(b"%PDF")
    elif ext == ".docx":
        ok = head.startswith(b"PK")
    elif ext == ".doc":
        ok = head.startswith(b"\xd0\xcf\x11\xe0")
    if not ok:
        _fail(field, "The file content does not match its type.")
    return file
