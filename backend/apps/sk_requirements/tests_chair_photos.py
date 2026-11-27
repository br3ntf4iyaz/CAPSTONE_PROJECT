import tempfile

from django.core.management import call_command
from django.test import TestCase, override_settings

from .models import SKBarangay

TMP = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TMP)
class SeedChairPhotosTests(TestCase):
    def test_sets_the_photo_and_never_overwrites_a_real_one(self):
        b = SKBarangay.objects.create(barangay_name='Ilayang Talim', sk_chairperson='Kim Ebarle')
        call_command('seed_chair_photos')
        b.refresh_from_db()
        self.assertTrue(b.chairperson_photo)
        first = b.chairperson_photo.name
        call_command('seed_chair_photos')  # second run keeps it
        b.refresh_from_db()
        self.assertEqual(b.chairperson_photo.name, first)

    def test_replaces_a_cartoon_placeholder_but_not_a_real_upload(self):
        from django.core.files.base import ContentFile
        b = SKBarangay.objects.create(barangay_name='Ilayang Talim')
        b.chairperson_photo.save('sample_chair_1.png', ContentFile(b'x'), save=True)
        call_command('seed_chair_photos')
        b.refresh_from_db()
        self.assertTrue(b.chairperson_photo.name.endswith('.jpg') and 'sample_' not in b.chairperson_photo.name)
        b.chairperson_photo.delete(save=False)
        b.chairperson_photo.save('real_upload.png', ContentFile(b'y'), save=True)
        call_command('seed_chair_photos')
        b.refresh_from_db()
        self.assertIn('real_upload', b.chairperson_photo.name)

    def test_a_missing_barangay_is_not_an_error(self):
        call_command('seed_chair_photos')
