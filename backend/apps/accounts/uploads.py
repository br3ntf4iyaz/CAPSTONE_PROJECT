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


_INLINE_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
}


def private_file_response(fieldfile):
    """Stream a private file to an already-authorised caller. Never cached, never sniffed."""
    from django.http import FileResponse, Http404

    if not fieldfile:
        raise Http404("No file.")
    try:
        handle = fieldfile.open("rb")
    except (FileNotFoundError, ValueError):
        raise Http404("File not found.")
    ext = os.path.splitext(fieldfile.name)[1].lower()
    ctype = _INLINE_TYPES.get(ext, "application/octet-stream")
    response = FileResponse(handle, content_type=ctype)
    response["Content-Disposition"] = (
        "inline" if ext in _INLINE_TYPES else "attachment"
    ) + f'; filename="{os.path.basename(fieldfile.name)}"'
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    response["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
    return response
