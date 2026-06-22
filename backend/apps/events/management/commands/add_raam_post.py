"""
Management command: add_raam_post

Creates the RAAM 2026 cash incentives featured post.

Run:
    python manage.py add_raam_post
"""

import os
from django.core.management.base import BaseCommand
from django.core.files import File
from django.conf import settings


TITLE = (
    "LOOK | Pamahalaang Lungsod ng Lucena, nagbigay ng cash incentives sa "
    "mga atletang nakapag-uwi ng medalya sa RAAM 2026"
)

CONTENT = (
    "Bilang pagpupugay sa ipinamalas na husay, determinasyon at dedikasyon ng mga manlalarong Lucenahin, "
    "pinagkalooban ng lokal na pamahalaan ng cash incentives ang mga atletang nakapag-uwi ng medalya sa "
    "naganap na Regional Athletic Association Meet 2026 (RAAM) sa Lucena Convention Atrium ngayong "
    "Miyerkules, ika-29 ng Abril.\n\n"
    "Personal na ipinamahagi ni Mayor Kuya Mark Alcala ang naturang insentibo katuwang ang pamunuan ng "
    "Deped Lucena sa pangunguna ni SDS Susan Oribiana at kinatawan mula sa City Sports Development Office.\n\n"
    "Tumanggap ng ₱ 7,000 ang bawat gold medalist, ₱ 5,000 ang silver medalist at ₱ 3,000 "
    "naman para sa bronze medalist.\n\n"
    "Ito ay pagkilala ng pamahalaang lokal sa mataas na pagpapahalaga ng lungsod sa mga Lucenahing "
    "namumukod-tangi ang talent and sports na makapagbigay ng karangalan sa Lucena City.\n\n"
    "Matatandaang tinanghal na Overall Top 8 ang SDO Lucena City sa RAAM 2026."
)

THUMBNAIL_FILENAME = "raam-incentives-1.jpg"
SOURCE = "Office of the City Mayor — Lucena City"
DATE_OF_EVENT = "2026-04-29"
POST_TYPE = "local_event"


class Command(BaseCommand):
    help = "Create the RAAM 2026 cash incentives featured post"

    def handle(self, *args, **options):
        from apps.events.models import FeaturedPost

        if FeaturedPost.objects.filter(title=TITLE).exists():
            self.stdout.write(self.style.WARNING("Post already exists. Skipping."))
            return

        thumbnail_path = os.path.join(settings.MEDIA_ROOT, "featured", THUMBNAIL_FILENAME)
        has_thumbnail = os.path.exists(thumbnail_path)

        if not has_thumbnail:
            self.stdout.write(self.style.WARNING(f"Thumbnail not found at: {thumbnail_path}"))

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
            f"Created FeaturedPost #{post.pk}: {post.title[:60]}"
        ))
        if has_thumbnail:
            self.stdout.write(f"  Thumbnail: {post.thumbnail.url}")
