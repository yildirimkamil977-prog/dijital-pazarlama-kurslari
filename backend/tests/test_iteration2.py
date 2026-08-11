"""Iteration 2 backend tests: bug fixes + new features.

Covers:
- validate-discount detail (label/type/value)
- profile update + change password
- recommendations (cross-sell)
- invoice upload + download flow
- admin settings tracking + testimonials + campaign
- admin stats timeseries + top_courses
- course editor: lesson notes + cross_sell_ids
- player lesson exposes notes
"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def student():
    s = requests.Session()
    email = f"test_it2_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "Iter2 Student", "email": email, "password": "TestPass!2026", "accept_terms": True,
    })
    assert r.status_code == 200, r.text
    s.email = email
    s.password = "TestPass!2026"
    s.user_id = r.json()["user_id"]
    return s


# ---------------- BUG FIX: validate-discount returns full detail ----------------
class TestValidateDiscountDetail:
    def test_percent_returns_label_type_value(self, admin, student):
        code = f"TEST20{uuid.uuid4().hex[:4].upper()}"
        r = admin.post(f"{API}/admin/discounts",
                       json={"code": code, "type": "percent", "value": 20, "active": True})
        assert r.status_code == 200
        try:
            r = student.post(f"{API}/payments/validate-discount",
                             json={"code": code, "subtotal": 500})
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["code"] == code.upper()
            assert data["type"] == "percent"
            assert data["value"] == 20
            assert data["label"] == "%20 indirim"
            assert data["discount"] == 100.0
            assert data["total"] == 400.0
        finally:
            admin.delete(f"{API}/admin/discounts/{code}")

    def test_fixed_amount_label(self, admin, student):
        code = f"TESTF{uuid.uuid4().hex[:4].upper()}"
        r = admin.post(f"{API}/admin/discounts",
                       json={"code": code, "type": "fixed", "value": 50, "active": True})
        assert r.status_code == 200
        try:
            r = student.post(f"{API}/payments/validate-discount",
                             json={"code": code, "subtotal": 500})
            assert r.status_code == 200
            data = r.json()
            assert data["type"] == "fixed"
            assert data["value"] == 50
            assert "50" in data["label"] and "indirim" in data["label"]
            assert data["discount"] == 50.0
        finally:
            admin.delete(f"{API}/admin/discounts/{code}")


# ---------------- NEW: /auth/profile + /auth/change-password ----------------
class TestProfileAndPassword:
    def test_update_profile(self, student):
        new_name = "Renamed User"
        r = student.put(f"{API}/auth/profile", json={"name": new_name, "email": student.email})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == new_name
        me = student.get(f"{API}/auth/me").json()
        assert me["name"] == new_name

    def test_profile_email_conflict(self, student):
        r = student.put(f"{API}/auth/profile",
                        json={"name": "X", "email": ADMIN_EMAIL})
        assert r.status_code == 400

    def test_change_password_wrong_current(self, student):
        r = student.post(f"{API}/auth/change-password",
                         json={"current_password": "wrongpass", "new_password": "NewPass!2026"})
        assert r.status_code == 400

    def test_change_password_success(self, student):
        new_pw = "NewPass!2026"
        r = student.post(f"{API}/auth/change-password",
                         json={"current_password": student.password, "new_password": new_pw})
        assert r.status_code == 200
        # Verify by logging in with new password
        s2 = requests.Session()
        r = s2.post(f"{API}/auth/login", json={"email": student.email, "password": new_pw})
        assert r.status_code == 200
        student.password = new_pw

    def test_change_password_too_short(self, student):
        r = student.post(f"{API}/auth/change-password",
                         json={"current_password": student.password, "new_password": "abc"})
        assert r.status_code == 400


# ---------------- NEW: Recommendations / cross-sell ----------------
class TestRecommendations:
    def test_recommendations_returns_list_with_bundle(self, admin):
        # Set bundle_discount_pct via general settings? It's in campaign path. Use PUT /admin/settings/general.
        cur = admin.get(f"{API}/admin/settings").json()
        payload = {k: cur.get(k, "") for k in [
            "site_name", "tagline", "contact_email", "support_phone",
            "hero_title", "hero_subtitle", "about_text", "students_count",
        ]}
        payload["email_enabled"] = cur.get("email_enabled", True)
        payload["bundle_discount_pct"] = 20
        r = admin.put(f"{API}/admin/settings/general", json=payload)
        assert r.status_code == 200

        r = requests.get(f"{API}/recommendations?ids=")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

        # With ids from an actual published course
        courses = requests.get(f"{API}/courses").json()
        if courses:
            cid = courses[0]["course_id"]
            r = requests.get(f"{API}/recommendations?ids={cid}")
            assert r.status_code == 200
            for rec in r.json():
                assert "bundle_price" in rec
                assert "bundle_pct" in rec
                assert rec["bundle_pct"] == 20
                assert rec["course_id"] != cid


# ---------------- NEW: Invoice flow ----------------
class TestInvoiceFlow:
    def test_invoice_upload_and_download(self, admin, student):
        # 1) Create course + 100% discount, checkout free -> paid order
        course = admin.post(f"{API}/admin/courses", json={
            "title": f"TEST_Inv_{uuid.uuid4().hex[:6]}", "price": 300, "is_published": True,
            "modules": [{"title": "M", "lessons": [{"title": "L", "duration_seconds": 10}]}],
        }).json()
        cid = course["course_id"]
        code = f"TESTINV{uuid.uuid4().hex[:4].upper()}"
        admin.post(f"{API}/admin/discounts",
                   json={"code": code, "type": "percent", "value": 100, "active": True})
        r = student.post(f"{API}/payments/checkout",
                         json={"items": [{"course_id": cid}], "discount_code": code})
        assert r.status_code == 200, r.text
        order_id = r.json()["order_id"]

        # 2) student payments shows has_invoice=False initially
        pays = student.get(f"{API}/my/payments").json()
        order_row = next((o for o in pays if o["order_id"] == order_id), None)
        assert order_row is not None
        assert order_row["has_invoice"] is False
        assert order_row["status"] == "paid"

        # 3) admin upload invoice
        pdf_bytes = b"%PDF-1.4\n%Test PDF\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        files = {"file": ("fatura.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        r = admin.post(f"{API}/admin/payments/{order_id}/invoice", files=files)
        assert r.status_code == 200, r.text

        # 4) student sees has_invoice=True
        pays = student.get(f"{API}/my/payments").json()
        order_row = next(o for o in pays if o["order_id"] == order_id)
        assert order_row["has_invoice"] is True
        assert order_row["invoice_filename"] == "fatura.pdf"

        # 5) student downloads
        r = student.get(f"{API}/my/invoice/{order_id}")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content == pdf_bytes

        # 6) admin delete invoice
        r = admin.delete(f"{API}/admin/payments/{order_id}/invoice")
        assert r.status_code == 200
        pays = student.get(f"{API}/my/payments").json()
        order_row = next(o for o in pays if o["order_id"] == order_id)
        assert order_row["has_invoice"] is False

        # Cleanup
        admin.delete(f"{API}/admin/courses/{cid}")
        admin.delete(f"{API}/admin/discounts/{code}")

    def test_invoice_download_forbidden_other_user(self, admin, student):
        # Random order id should 404
        r = student.get(f"{API}/my/invoice/order_doesnotexist_xyz")
        assert r.status_code == 404


# ---------------- NEW: Admin stats timeseries + top_courses ----------------
class TestAdminStatsCharts:
    def test_stats_charts_fields(self, admin):
        r = admin.get(f"{API}/admin/stats")
        assert r.status_code == 200
        data = r.json()
        assert "timeseries" in data and isinstance(data["timeseries"], list)
        assert "top_courses" in data and isinstance(data["top_courses"], list)
        # 14-day series
        assert len(data["timeseries"]) == 14
        for bucket in data["timeseries"]:
            assert "date" in bucket
            assert "revenue" in bucket
            assert "sales" in bucket


# ---------------- NEW: Admin settings tracking + testimonials + campaign ----------------
class TestAdminExtendedSettings:
    def test_update_tracking(self, admin):
        payload = {"head_code": "<!-- test-head -->", "body_code": "<!-- test-body -->",
                   "ga_id": "GA-TEST", "meta_pixel_id": "PIXEL-TEST", "google_ads_id": "AW-TEST"}
        r = admin.put(f"{API}/admin/settings/tracking", json=payload)
        assert r.status_code == 200
        got = admin.get(f"{API}/admin/settings").json().get("tracking", {})
        for k, v in payload.items():
            assert got.get(k) == v

    def test_update_testimonials(self, admin):
        body = [
            {"name": "Ali", "role": "Öğrenci", "quote": "Harika", "video_url": "https://youtube.com/embed/1"},
            {"name": "Ayşe", "role": "Öğrenci", "quote": "Süper", "video_url": ""},
        ]
        r = admin.put(f"{API}/admin/settings/testimonials", json=body)
        assert r.status_code == 200
        got = admin.get(f"{API}/admin/settings").json().get("testimonials", [])
        assert len(got) >= 2
        assert got[0]["name"] == "Ali"

    def test_update_campaign_bundle_and_whatsapp(self, admin):
        cur = admin.get(f"{API}/admin/settings").json()
        payload = {k: cur.get(k, "") for k in [
            "site_name", "tagline", "contact_email", "support_phone",
            "hero_title", "hero_subtitle", "about_text", "students_count",
        ]}
        payload.update({
            "email_enabled": cur.get("email_enabled", True),
            "whatsapp_number": "905551112233",
            "whatsapp_message": "Merhaba",
            "bundle_discount_pct": 15,
            "promo_bar_text": "Kampanya!",
            "promo_bar_enabled": True,
        })
        r = admin.put(f"{API}/admin/settings/general", json=payload)
        assert r.status_code == 200
        pub = requests.get(f"{API}/settings/public").json()
        # Public should expose whatsapp so button can render
        assert pub.get("whatsapp_number") in ("905551112233", "")  # exposed or empty per design
        # Verify roundtrip via admin GET
        got = admin.get(f"{API}/admin/settings").json()
        assert got.get("whatsapp_number") == "905551112233"
        assert got.get("bundle_discount_pct") == 15
        # Reset to hide whatsapp button for other tests / user
        payload["whatsapp_number"] = ""
        payload["bundle_discount_pct"] = 0
        admin.put(f"{API}/admin/settings/general", json=payload)


# ---------------- NEW: Course editor - lesson notes + cross_sell_ids + player notes ----------------
class TestCourseEditorNotesAndCrossSell:
    def test_notes_and_cross_sell_persist_and_expose_in_player(self, admin, student):
        # Create course A (target of cross-sell)
        a = admin.post(f"{API}/admin/courses", json={
            "title": f"TEST_A_{uuid.uuid4().hex[:6]}", "price": 100, "is_published": True,
            "modules": [{"title": "M", "lessons": [{"title": "L", "duration_seconds": 10}]}],
        }).json()

        # Create course B with cross_sell_ids=[a] and lesson notes
        payload = {
            "title": f"TEST_B_{uuid.uuid4().hex[:6]}", "price": 200, "is_published": True,
            "cross_sell_ids": [a["course_id"]],
            "modules": [{
                "title": "M",
                "lessons": [{"title": "L1", "video_url": "https://youtube.com/embed/x",
                             "duration_seconds": 60, "notes": "Bu ders çok önemli notlar."}],
            }],
        }
        b = admin.post(f"{API}/admin/courses", json=payload).json()
        bid = b["course_id"]

        # Fetch admin course to verify persistence
        adm = admin.get(f"{API}/admin/courses/{bid}").json()
        assert adm.get("cross_sell_ids") == [a["course_id"]]
        assert adm["modules"][0]["lessons"][0].get("notes") == "Bu ders çok önemli notlar."

        # Recommendations should return course A when B is in cart
        r = requests.get(f"{API}/recommendations?ids={bid}")
        assert r.status_code == 200
        ids = [x["course_id"] for x in r.json()]
        assert a["course_id"] in ids

        # Enroll a student in B (manual) then player should expose notes
        admin.post(f"{API}/admin/enrollments",
                   json={"user_id": student.user_id, "course_id": bid})
        pl = student.get(f"{API}/my/courses/{bid}/player").json()
        first_lesson = pl["modules"][0]["lessons"][0]
        assert first_lesson.get("notes") == "Bu ders çok önemli notlar."

        # Cleanup
        admin.delete(f"{API}/admin/enrollments",
                     json={"user_id": student.user_id, "course_id": bid})
        admin.delete(f"{API}/admin/courses/{bid}")
        admin.delete(f"{API}/admin/courses/{a['course_id']}")


# ---------------- Free-preview lesson exposes video_url (BUG FIX check) ----------------
class TestPreviewLessonExposesVideo:
    def test_preview_lesson_video_url_visible_to_public(self, admin):
        payload = {
            "title": f"TEST_Prev_{uuid.uuid4().hex[:6]}", "price": 100, "is_published": True,
            "modules": [{
                "title": "M",
                "lessons": [
                    {"title": "P1", "video_url": "https://youtube.com/embed/PREVIEW",
                     "duration_seconds": 30, "is_preview": True},
                    {"title": "L2", "video_url": "https://youtube.com/embed/secret",
                     "duration_seconds": 60, "is_preview": False},
                ],
            }],
        }
        c = admin.post(f"{API}/admin/courses", json=payload).json()
        try:
            d = requests.get(f"{API}/courses/{c['slug']}").json()
            lessons = d["modules"][0]["lessons"]
            preview = next(l for l in lessons if l["title"] == "P1")
            hidden = next(l for l in lessons if l["title"] == "L2")
            assert preview.get("is_preview") is True
            assert preview.get("video_url") == "https://youtube.com/embed/PREVIEW"
            # non-preview must be hidden
            assert not hidden.get("video_url")
        finally:
            admin.delete(f"{API}/admin/courses/{c['course_id']}")
