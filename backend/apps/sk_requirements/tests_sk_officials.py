import io
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .models import SKBarangay, SKMember

User = get_user_model()
MEDIA = tempfile.mkdtemp()


def _png():
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), (10, 80, 160)).save(buf, "PNG")
    return buf.getvalue()


@override_settings(MEDIA_ROOT=MEDIA)
class SKOfficialsTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.a = SKBarangay.objects.create(barangay_name="Barangay A", sk_chairperson="Chair A")
        self.b = SKBarangay.objects.create(barangay_name="Barangay B", sk_chairperson="Chair B")
        self.admin = User.objects.create_user(email="adm@t.local", password="x", role="lgu_admin", is_active=True)
        self.youth = User.objects.create_user(email="yt@t.local", password="x", role="youth", is_active=True)
        self.ac = APIClient()
        self.ac.force_authenticate(self.admin)
        self.yc = APIClient()
        self.yc.force_authenticate(self.youth)

    def test_command_creates_the_full_council_for_every_barangay_and_is_repeatable(self):
        call_command("ensure_sk_officials", stdout=io.StringIO())
        for brgy in (self.a, self.b):
            counts = {p: SKMember.objects.filter(barangay=brgy, position=p).count() for p in ("kagawad", "secretary", "treasurer")}
            self.assertEqual(counts, {"kagawad": 7, "secretary": 1, "treasurer": 1})
        before = SKMember.objects.count()
        call_command("ensure_sk_officials", stdout=io.StringIO())
        self.assertEqual(SKMember.objects.count(), before)

    def test_existing_officials_are_never_changed(self):
        SKMember.objects.create(barangay=self.a, position="kagawad", name="Real Person", order=1)
        call_command("ensure_sk_officials", stdout=io.StringIO())
        self.assertTrue(SKMember.objects.filter(barangay=self.a, name="Real Person").exists())
        self.assertEqual(SKMember.objects.filter(barangay=self.a, position="kagawad").count(), 7)

    def test_public_directory_lists_10_officials_per_barangay_without_mixing(self):
        call_command("ensure_sk_officials", stdout=io.StringIO())
        SKMember.objects.filter(barangay=self.a, position="secretary").update(name="Secretary of A")
        data = APIClient().get("/api/sk-requirements/barangays/").data
        by_name = {b["barangay_name"]: b for b in data}
        for brgy in ("Barangay A", "Barangay B"):
            officials = by_name[brgy]["officials"]
            self.assertEqual(len(officials), 10)
            self.assertEqual([o["position"] for o in officials], ["chairperson"] + ["kagawad"] * 7 + ["secretary", "treasurer"])
        self.assertIn("Secretary of A", [o["name"] for o in by_name["Barangay A"]["officials"]])
        self.assertNotIn("Secretary of A", [o["name"] for o in by_name["Barangay B"]["officials"]])

    def test_only_admins_can_manage_officials(self):
        body = {"barangay": self.a.id, "name": "New Kagawad", "position": "kagawad"}
        self.assertEqual(APIClient().post("/api/sk-requirements/members/", body, format="json").status_code, 401)
        self.assertEqual(self.yc.post("/api/sk-requirements/members/", body, format="json").status_code, 403)
        self.assertEqual(self.ac.post("/api/sk-requirements/members/", body, format="json").status_code, 201)

    def test_seat_limits_are_enforced_per_barangay(self):
        call_command("ensure_sk_officials", stdout=io.StringIO())
        r = self.ac.post("/api/sk-requirements/members/", {"barangay": self.a.id, "name": "Extra", "position": "secretary"}, format="json")
        self.assertEqual(r.status_code, 400)
        member = SKMember.objects.filter(barangay=self.a, position="kagawad").first()
        self.assertEqual(self.ac.delete(f"/api/sk-requirements/members/{member.id}/").status_code, 204)
        r = self.ac.post("/api/sk-requirements/members/", {"barangay": self.a.id, "name": "Replacement", "position": "kagawad"}, format="json")
        self.assertEqual(r.status_code, 201)
        # another barangay is unaffected by A's seats (its own seats are counted separately)
        other = SKBarangay.objects.create(barangay_name="Barangay C", sk_chairperson="Chair C")
        r = self.ac.post("/api/sk-requirements/members/", {"barangay": other.id, "name": "C Kagawad", "position": "kagawad"}, format="json")
        self.assertEqual(r.status_code, 201)
        # ...and B, which is full too, still refuses an eighth kagawad
        r = self.ac.post("/api/sk-requirements/members/", {"barangay": self.b.id, "name": "B Extra", "position": "kagawad"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_picture_upload_replace_remove_and_validation(self):
        member = SKMember.objects.create(barangay=self.a, position="treasurer", name="Treasurer A", order=1)
        url = f"/api/sk-requirements/members/{member.id}/"
        ok = self.ac.patch(url, {"photo": SimpleUploadedFile("p.png", _png(), content_type="image/png")}, format="multipart")
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.data["photo_url"])
        bad = self.ac.patch(url, {"photo": SimpleUploadedFile("x.html", b"<script>1</script>", content_type="image/png")}, format="multipart")
        self.assertEqual(bad.status_code, 400)
        gone = self.ac.post(url + "remove-photo/")
        self.assertEqual(gone.status_code, 200)
        self.assertIsNone(gone.data["photo_url"])

    def test_chairperson_name_and_picture_are_editable_by_admins_only(self):
        url = f"/api/sk-requirements/barangays/{self.a.id}/"
        self.assertEqual(self.ac.patch(url, {"sk_chairperson": "Real Chair"}, format="json").status_code, 200)
        self.assertEqual(self.yc.patch(url, {"sk_chairperson": "Hacked"}, format="json").status_code, 403)
        photo = lambda: SimpleUploadedFile("c.png", _png(), content_type="image/png")  # noqa: E731
        self.assertEqual(self.yc.post(url + "chairperson-photo/", {"photo": photo()}, format="multipart").status_code, 403)
        ok = self.ac.post(url + "chairperson-photo/", {"photo": photo()}, format="multipart")
        self.assertEqual(ok.status_code, 200)
        listed = {b["barangay_name"]: b for b in APIClient().get("/api/sk-requirements/barangays/").data}["Barangay A"]
        self.assertEqual(listed["officials"][0]["name"], "Real Chair")
        self.assertTrue(listed["officials"][0]["photo_url"])
        self.assertEqual(self.ac.post(url + "chairperson-photo/", {"remove": "true"}, format="multipart").status_code, 200)
        self.assertEqual(self.ac.post(url + "chairperson-photo/", {"photo": SimpleUploadedFile("c.html", b"x", content_type="image/png")}, format="multipart").status_code, 400)

    # ── sample faces ──────────────────────────────────────────────────────────────────────────

    def test_sample_faces_are_given_to_all_ten_officials_of_every_barangay(self):
        call_command("ensure_sk_officials", stdout=io.StringIO())
        call_command("seed_sample_photos", stdout=io.StringIO())
        data = APIClient().get("/api/sk-requirements/barangays/").data
        for brgy in data:
            self.assertEqual(len(brgy["officials"]), 10)
            self.assertTrue(all(o["photo_url"] for o in brgy["officials"]), brgy["barangay_name"])
        self.assertIn("/sample_", data[0]["officials"][0]["photo_url"])

    def test_sample_faces_never_replace_a_real_picture_and_can_be_cleared(self):
        call_command("ensure_sk_officials", stdout=io.StringIO())
        member = SKMember.objects.filter(barangay=self.a, position="treasurer").first()
        self.ac.patch(f"/api/sk-requirements/members/{member.id}/", {"photo": SimpleUploadedFile("real.png", _png(), content_type="image/png")}, format="multipart")
        member.refresh_from_db()
        real_name = member.photo.name
        call_command("seed_sample_photos", stdout=io.StringIO())
        call_command("seed_sample_photos", "--refresh", stdout=io.StringIO())
        member.refresh_from_db()
        self.assertEqual(member.photo.name, real_name)
        call_command("seed_sample_photos", "--clear", stdout=io.StringIO())
        member.refresh_from_db()
        self.assertEqual(member.photo.name, real_name)  # the real picture survived the clean-up
        others = SKMember.objects.filter(barangay=self.a).exclude(pk=member.pk)
        self.assertTrue(all(not m.photo for m in others))

    # ── SK officials changing the pictures of their own council ────────────────────────────

    def _sk(self, email, barangay_name, verified=True):
        from apps.verification.models import IDVerification
        user = User.objects.create_user(email=email, password="x", role="youth", youth_type="sk", is_active=True, is_email_verified=True)
        user.profile.barangay = barangay_name
        user.profile.save()
        if verified:
            IDVerification.objects.create(user=user, id_type="umid", status="approved")
        client = APIClient()
        client.force_authenticate(user)
        return user, client

    def _photo(self, name="p.png"):
        return SimpleUploadedFile(name, _png(), content_type="image/png")

    def test_verified_sk_can_change_and_remove_pictures_of_their_own_council_only(self):
        call_command("ensure_sk_officials", stdout=io.StringIO())
        _, sk_a = self._sk("ska@t.local", "Barangay A")
        mine = SKMember.objects.filter(barangay=self.a, position="kagawad").first()
        theirs = SKMember.objects.filter(barangay=self.b, position="kagawad").first()
        url_a = f"/api/sk-requirements/barangays/{self.a.id}/member-photo/"
        url_b = f"/api/sk-requirements/barangays/{self.b.id}/member-photo/"

        ok = sk_a.post(url_a, {"member": mine.id, "photo": self._photo()}, format="multipart")
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.data["photo_url"])
        self.assertEqual(sk_a.post(url_a, {"member": theirs.id, "photo": self._photo()}, format="multipart").status_code, 404)   # B's member through A's door
        self.assertEqual(sk_a.post(url_b, {"member": theirs.id, "photo": self._photo()}, format="multipart").status_code, 403)   # B's barangay
        self.assertEqual(sk_a.post(url_a, {"member": mine.id, "remove": "true"}, format="multipart").status_code, 200)
        mine.refresh_from_db()
        self.assertFalse(mine.photo)

        chair = sk_a.post(f"/api/sk-requirements/barangays/{self.a.id}/chairperson-photo/", {"photo": self._photo("c.png")}, format="multipart")
        self.assertEqual(chair.status_code, 200)

    def test_an_sk_who_has_not_verified_their_identity_cannot_change_pictures(self):
        call_command("ensure_sk_officials", stdout=io.StringIO())
        _, sk = self._sk("unverified@t.local", "Barangay A", verified=False)
        member = SKMember.objects.filter(barangay=self.a).first()
        r = sk.post(f"/api/sk-requirements/barangays/{self.a.id}/member-photo/", {"member": member.id, "photo": self._photo()}, format="multipart")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["code"], "verify_first")

    def test_picture_rules_still_apply_to_sk_uploads_and_are_audited(self):
        from apps.accounts.models import AuditLog
        call_command("ensure_sk_officials", stdout=io.StringIO())
        _, sk = self._sk("ska2@t.local", "Barangay A")
        member = SKMember.objects.filter(barangay=self.a).first()
        url = f"/api/sk-requirements/barangays/{self.a.id}/member-photo/"
        bad = sk.post(url, {"member": member.id, "photo": SimpleUploadedFile("x.html", b"<script>1</script>", content_type="image/png")}, format="multipart")
        self.assertEqual(bad.status_code, 400)
        sk.post(url, {"member": member.id, "photo": self._photo()}, format="multipart")
        self.assertTrue(AuditLog.objects.filter(action="sk_photo_changed", details__by="ska2@t.local").exists())

    def test_can_edit_flag_is_true_only_for_admins_and_the_verified_sk_of_that_barangay(self):
        _, sk_a = self._sk("ska3@t.local", "Barangay A")
        flags = lambda c: {b["barangay_name"]: b["can_edit_officials"] for b in c.get("/api/sk-requirements/barangays/").data}  # noqa: E731
        self.assertEqual(flags(sk_a), {"Barangay A": True, "Barangay B": False})
        self.assertEqual(flags(self.ac), {"Barangay A": True, "Barangay B": True})
        self.assertEqual(flags(self.yc), {"Barangay A": False, "Barangay B": False})
        self.assertEqual(flags(APIClient()), {"Barangay A": False, "Barangay B": False})
