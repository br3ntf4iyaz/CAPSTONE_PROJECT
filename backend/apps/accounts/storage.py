import os

from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateStorage(FileSystemStorage):
    """Sensitive files. Lives under PRIVATE_MEDIA_ROOT, which is NOT the public media folder.

    The folder is read from settings on every use (not cached) so it can be changed in tests.
    """

    @property
    def base_location(self):
        return str(settings.PRIVATE_MEDIA_ROOT)

    @property
    def location(self):
        return os.path.abspath(self.base_location)


def private_storage():
    return PrivateStorage()
