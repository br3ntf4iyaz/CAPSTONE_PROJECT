"""
Management command: add_sk_dalahican_post

Creates the SK Dalahican rice distribution featured post.

Run:
    python manage.py add_sk_dalahican_post
    python manage.py add_sk_dalahican_post --dry-run
"""

import os
from django.core.management.base import BaseCommand
from django.core.files import File
from django.conf import settings


TITLE = (
    "SK Dalahican namahagi ng bigas sa 1,500 anak ng mga mangingisda "
    "at pedicab drivers sa Araw ng Dalahican"
)

CONTENT = (
    "Namahagi ang Sangguniang Kabataan ng Dalahican ng limang (5) kilong bigas sa 1,500 anak ng mga "
    "mangingisda at pedicab drivers ngayong araw, Abril 28, 2026, na ginanap sa Multipurpose Covered "
    "Court, Barangay Dalahican, Lungsod ng Lucena.\n\n"
    "Sa paggunita ng Araw ng Dalahican, pinili ng ating Sangguniang Kabataan na gawing makabuluhan ang "
    "selebrasyon—hindi sa pamamagitan ng kasiyahan, kundi sa pagbibigay-pagkalinga at pagtulong sa "
    "ating mga kababayan na patuloy na nagsusumikap sa kabila ng krisis.\n\n"
    "Alinsunod sa Executive Order No. 110, s. 2026 na nagdedeklara ng State of National Energy Emergency, "
    "minarapat ng SK Dalahican na isantabi muna ang ibang gawain at ituon ang pondo sa mas mahalagang "
    "pangangailangan ng ating komunidad.\n\n"
    "Sa araw na ito, ating ipinapakita na ang tunay na diwa ng Araw ng Dalahican ay pagkakaisa, malasakit, "
    "at pag-asa para sa bawat pamilya.\n\n"
    "Maraming salamat po sa inyong patuloy na suporta at pakikiisa."
)

THUMBNAIL_FILENAME = "sk-dalahican-1.jpg"
SOURCE = "SK Dalahican, Barangay Dalahican, Lungsod ng Lucena"
DATE_OF_EVENT = "2026-04-28"
POST_TYPE = "local_event"


class Command(BaseCommand):
    help = "Create the SK Dalahican Araw ng Dalahican rice distribution featured post"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview without saving to database",
        )

    def handle(self, *args, **options):
        from apps.events.models import FeaturedPost

        dry_run = options["dry_run"]

        # Check thumbnail
        thumbnail_path = os.path.join(settings.MEDIA_ROOT, "featured", THUMBNAIL_FILENAME)
        has_thumbnail = os.path.exists(thumbnail_path)

        if not has_thumbnail:
            self.stdout.write(
                self.style.WARNING(
                    f"Thumbnail not found at: {thumbnail_path}\n"
                    f"Post will be created without a thumbnail.\n"
                    f"Copy sk-dalahican-1.jpg to that path and re-run to add it."
                )
            )

        # Duplicate guard
        if FeaturedPost.objects.filter(title=TITLE).exists():
            self.stdout.write(self.style.WARNING("Post already exists. Skipping."))
            return

        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f"[DRY RUN] Would create:\n"
                f"  Title:     {TITLE}\n"
                f"  Type:      {POST_TYPE}\n"
                f"  Date:      {DATE_OF_EVENT}\n"
                f"  Source:    {SOURCE}\n"
                f"  Thumbnail: {'YES' if has_thumbnail else 'NO (file missing)'}\n"
                f"  Published: True"
            ))
            return

        post = FeaturedPost(
            title=TITLE,
            content=CONTENT,
            post_type=POST_TYPE,
            source=SOURCE,
            date_of_event=DATE_OF_EVENT,
            is_published=True,
            order=1,
        )

        if has_thumbnail:
            with open(thumbnail_path, "rb") as f:
                post.thumbnail.save(THUMBNAIL_FILENAME, File(f), save=False)

        post.save()

        self.stdout.write(self.style.SUCCESS(
            f"Created FeaturedPost #{post.pk}: {post.title}"
        ))
        if has_thumbnail:
            self.stdout.write(f"  Thumbnail: {post.thumbnail.url}")
        else:
            self.stdout.write(self.style.WARNING(
                "  No thumbnail attached. Copy sk-dalahican-1.jpg to "
                f"{os.path.join(settings.MEDIA_ROOT, 'featured')} and update via admin."
            ))
