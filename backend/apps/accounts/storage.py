from django.conf import settings
from django.core.files.storage import FileSystemStorage


def private_storage():
    """Storage for sensitive files. Not under MEDIA_ROOT, so it is never served publicly."""
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)
