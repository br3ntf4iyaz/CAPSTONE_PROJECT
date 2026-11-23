import io
import json
import os
import random
import shutil
import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image, ImageDraw, ImageFilter
from rest_framework.test import APIClient

from .models import IDTypeSetting, IDVerification

User = get_user_model()

GOOD_CHECKS = {
    "front": {"cardDetected": True},
    "back": {"cardDetected": True},
    "selfie": {"liveness": True},
}
GOOD_OCR = {"ran": True, "name_score": 1.0, "keyword_found": True, "id_number_found": True, "expired": False}


def _busy_image(width=1100, height=700, blur=0):
    rnd = random.Random(7)
    img = Image.new("RGB", (width, height), (235, 232, 222))
    d = ImageDraw.Draw(img)
    for _ in range(260):
        d.text((rnd.randint(0, width - 60), rnd.randint(0, height - 20)), rnd.choice(["JUAN", "DELA CRUZ", "1234-5678"]), fill=(30, 30, 30))
    if blur:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def _selfie():
    rnd = random.Random(9)
    img = Image.new("RGB", (720, 960), (150, 120, 100))
    d = ImageDraw.Draw(img)
    for _ in range(300):
        x, y = rnd.randint(0, 720), rnd.randint(0, 960)
        d.ellipse([x, y, x + rnd.randint(5, 40), y + rnd.randint(5, 40)], fill=(rnd.randint(90, 200),) * 3)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return buf.getvalue()


@override_settings(PRIVATE_MEDIA_ROOT=tempfile.mkdtemp())
class AutomaticDecisionTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        from django.conf import settings
        shutil.rmtree(settings.PRIVATE_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.n = 0
        # most tests below describe the careful modes; the fast mode has its own tests further down
        patcher = mock.patch.dict(os.environ, {"VERIFICATION_MODE": "strict"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def _client(self):
        self.n += 1
        user = User.objects.create_user(
            email=f"u{self.n}@t.local", password="x", first_name="Juan", last_name="Dela Cruz", role="youth", is_active=True,
        )
        client = APIClient()
        client.force_authenticate(user)
        return user, client

    def _submit(self, client, **over):
        data = {
            "id_type": "umid",
            "consent": "true",
            "id_image": SimpleUploadedFile("f.jpg", over.pop("front", None) or _busy_image(), content_type="image/jpeg"),
            "id_back_image": SimpleUploadedFile("b.jpg", _busy_image(), content_type="image/jpeg"),
            "selfie_image": SimpleUploadedFile("s.jpg", _selfie(), content_type="image/jpeg"),
            "face_distance": over.pop("dist", "0.32"),
            "face_matched": over.pop("matched", "true"),
            "client_checks": json.dumps(over.pop("checks", GOOD_CHECKS)),
            "ocr_result": json.dumps(over.pop("ocr", GOOD_OCR)),
        }
        data.update(over)
        return client.post("/api/verification/submit/", data, format="multipart")

    def test_all_checks_pass_is_verified_automatically(self):
        user, client = self._client()
        r = self._submit(client)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "approved")
        self.assertTrue(r.data["auto_approved"])
        self.assertTrue(IDVerification.objects.get(user=user).is_verified)

    def test_each_weak_signal_goes_to_a_human_and_nothing_is_rejected(self):
        cases = {
            # no blink AND only an average face match: balanced mode still wants a person to look
            "liveness_failed": dict(checks={**GOOD_CHECKS, "selfie": {"liveness": False}}, dist="0.48"),
            "face_mismatch": dict(dist="0.78", matched="false"),
            "face_uncertain": dict(dist="0.57"),
            "front_unreadable": dict(front=_busy_image(blur=7)),
            "expired_id": dict(ocr={**GOOD_OCR, "expired": True}),
            "name_mismatch": dict(ocr={**GOOD_OCR, "name_score": 0.2}),
            "ocr_unavailable": dict(ocr={"ran": False}),
            "no_live_scan": dict(checks={**GOOD_CHECKS, "front": {"uploaded": True}}),
        }
        for flag, over in cases.items():
            with self.subTest(flag=flag):
                _, client = self._client()
                r = self._submit(client, **over)
                self.assertEqual(r.status_code, 201)
                self.assertEqual(r.data["status"], "reviewing")
                self.assertFalse(r.data["auto_approved"])
                self.assertIn(flag, r.data["decision_flags"])

    def test_missing_blink_is_fine_in_balanced_mode_when_everything_else_is_strong(self):
        with mock.patch.dict(os.environ, {"VERIFICATION_MODE": "balanced"}):
            _, client = self._client()
            r = self._submit(client, checks={**GOOD_CHECKS, "selfie": {"liveness": False}})
        self.assertEqual(r.data["status"], "approved")
        self.assertTrue(r.data["auto_approved"])

    def test_strict_mode_always_requires_the_live_check(self):
        _, client = self._client()
        r = self._submit(client, checks={**GOOD_CHECKS, "selfie": {"liveness": False}})
        self.assertEqual(r.data["status"], "reviewing")
        self.assertIn("liveness_failed", r.data["decision_flags"])

    # ── fast mode (the default): approve unless something is clearly wrong ──────────────────────

    def _fast(self, **over):
        with mock.patch.dict(os.environ, {"VERIFICATION_MODE": "fast"}):
            user, client = self._client()
            return user, self._submit(client, **over)

    def test_fast_mode_small_doubts_do_not_make_the_user_wait(self):
        soft = {
            "no blink": dict(checks={**GOOD_CHECKS, "selfie": {"liveness": False}}),
            "ID text unreadable": dict(ocr={"ran": False}),
            "gallery photo": dict(checks={**GOOD_CHECKS, "front": {"uploaded": True}}),
            "fair face match (ID photos are soft)": dict(dist="0.55"),
            "name only partly matches": dict(ocr={**GOOD_OCR, "name_score": 0.6}),
        }
        for name, over in soft.items():
            with self.subTest(case=name):
                _, r = self._fast(**over)
                self.assertEqual(r.data["status"], "approved")
                self.assertTrue(r.data["auto_approved"])
                self.assertTrue(r.data["decision_flags"], "the doubt must still be recorded for a spot check")

    def test_fast_mode_clear_problems_still_go_to_an_admin(self):
        hard = {
            "face_mismatch": dict(dist="0.78", matched="false"),
            "face_uncertain": dict(dist="0.59"),
            "expired_id": dict(ocr={**GOOD_OCR, "expired": True}),
            "name_mismatch": dict(ocr={**GOOD_OCR, "name_score": 0.2}),
            "front_unreadable": dict(front=_busy_image(blur=7)),
        }
        for flag, over in hard.items():
            with self.subTest(flag=flag):
                _, r = self._fast(**over)
                self.assertEqual(r.data["status"], "reviewing")
                self.assertIn(flag, r.data["decision_flags"])

    def test_fast_mode_one_id_number_cannot_verify_two_accounts(self):
        ocr = {**GOOD_OCR, "id_number": "CRN-0028-1234567-8"}
        _, first = self._fast(ocr=ocr)
        self.assertEqual(first.data["status"], "approved")
        _, second = self._fast(ocr=ocr)
        self.assertEqual(second.data["status"], "reviewing")
        self.assertIn("duplicate_id", second.data["decision_flags"])

    def test_forged_or_missing_device_results_never_auto_approve(self):
        _, client = self._client()
        r = self._submit(client, checks={}, ocr={})
        self.assertEqual(r.data["status"], "reviewing")
        _, client = self._client()
        r = self._submit(client, client_checks="not json{", ocr_result="[]")
        self.assertEqual(r.data["status"], "reviewing")

    def test_consent_is_required(self):
        _, client = self._client()
        r = self._submit(client, consent="false")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["code"], "consent_required")

    def test_disabled_id_type_is_refused(self):
        IDTypeSetting.objects.update_or_create(code="umid", defaults={"label": "UMID", "is_enabled": False})
        _, client = self._client()
        self.assertEqual(self._submit(client).status_code, 400)

    def test_cannot_submit_twice_while_verified(self):
        _, client = self._client()
        self.assertEqual(self._submit(client).status_code, 201)
        self.assertEqual(self._submit(client).status_code, 400)

    def test_admin_must_give_a_reason_to_revoke_and_it_is_audited(self):
        from apps.accounts.models import AuditLog
        user, client = self._client()
        self._submit(client)
        record = IDVerification.objects.get(user=user)
        admin = User.objects.create_user(email="adm@t.local", password="x", role="lgu_admin", is_active=True)
        ac = APIClient()
        ac.force_authenticate(admin)
        url = f"/api/verification/admin/{record.pk}/"
        self.assertEqual(ac.patch(url, {"status": "approved"}, format="json").status_code, 400)
        self.assertEqual(ac.patch(url, {"status": "rejected"}, format="json").status_code, 400)
        self.assertEqual(ac.patch(url, {"status": "rejected", "admin_notes": "Spot check failed"}, format="json").status_code, 200)
        self.assertTrue(AuditLog.objects.filter(action="verification_revoked").exists())

    def test_photos_are_private_and_only_admins_can_open_them(self):
        user, client = self._client()
        self._submit(client)
        record = IDVerification.objects.get(user=user)
        url = f"/api/verification/admin/{record.pk}/file/id_image/"
        self.assertEqual(client.get(url).status_code, 403)
        admin = User.objects.create_user(email="adm2@t.local", password="x", role="lgu_admin", is_active=True)
        ac = APIClient()
        ac.force_authenticate(admin)
        r = ac.get(url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["X-Content-Type-Options"], "nosniff")
        self.assertEqual(self.client.get("/media/" + record.id_image.name).status_code, 404)
