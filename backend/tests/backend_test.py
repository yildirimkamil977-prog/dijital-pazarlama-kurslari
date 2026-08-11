"""End-to-end backend tests for Akademi LMS.

Runs against public REACT_APP_BACKEND_URL. Covers auth, courses, checkout (free path),
discounts, progress/certificate issuance and admin CRUD + PayTR settings.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("role") == "admin"
    return s


@pytest.fixture(scope="session")
def student_session():
    s = requests.Session()
    email = f"test_stu_{uuid.uuid4().hex[:8]}@test.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "Test Student", "email": email, "password": "TestPass!2026",
        "accept_terms": True,
    })
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    s.email = email
    s.user_id = r.json()["user_id"]
    return s


@pytest.fixture(scope="session", autouse=True)
def reset_paytr(admin_session):
    """Ensure PayTR starts unconfigured for deterministic tests."""
    admin_session.put(f"{API}/admin/settings/paytr", json={
        "merchant_id": "", "notification_url": "", "test_mode": True
    })
    yield


# ---------------- Health ----------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_public_settings(self):
        r = requests.get(f"{API}/settings/public")
        assert r.status_code == 200
        data = r.json()
        assert "site_name" in data
        assert "payment_configured" in data
        # PayTR should NOT be configured by default
        assert data["payment_configured"] is False


# ---------------- Auth ----------------
class TestAuth:
    def test_register_requires_terms(self):
        email = f"TEST_noterm_{uuid.uuid4().hex[:6]}@test.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "X", "email": email, "password": "Pass!2026", "accept_terms": False
        })
        assert r.status_code == 400

    def test_register_success_and_me(self):
        s = requests.Session()
        email = f"test_reg_{uuid.uuid4().hex[:6]}@test.com"
        r = s.post(f"{API}/auth/register", json={
            "name": "Reg User", "email": email, "password": "Pass!2026", "accept_terms": True
        })
        assert r.status_code == 200
        assert r.json()["email"] == email
        assert r.json()["role"] == "student"
        # session cookie should be present
        assert "session_token" in s.cookies
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == email

    def test_login_bad_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_admin_login(self, admin_session):
        me = admin_session.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["role"] == "admin"

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- Courses ----------------
class TestCoursesPublic:
    def test_list_courses(self):
        r = requests.get(f"{API}/courses")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_course_detail_hides_video(self):
        courses = requests.get(f"{API}/courses").json()
        slug = courses[0]["slug"]
        r = requests.get(f"{API}/courses/{slug}")
        assert r.status_code == 200
        c = r.json()
        assert c["enrolled"] is False
        # non-preview lessons should not expose video_url
        non_preview_leak = False
        for m in c["modules"]:
            for l in m["lessons"]:
                if not l.get("is_preview") and l.get("video_url"):
                    non_preview_leak = True
        assert not non_preview_leak, "Non-preview lesson video_url leaked to public"


# ---------------- Admin: courses + discounts + settings ----------------
class TestAdmin:
    def test_stats(self, admin_session):
        r = admin_session.get(f"{API}/admin/stats")
        assert r.status_code == 200
        for k in ["total_students", "total_courses", "published_courses", "revenue"]:
            assert k in r.json()

    def test_course_crud(self, admin_session):
        payload = {
            "title": f"TEST_Course_{uuid.uuid4().hex[:6]}",
            "subtitle": "s", "description": "d", "category": "Test",
            "price": 100, "discount_price": None, "is_published": True,
            "modules": [{
                "title": "Modül 1",
                "lessons": [
                    {"title": "L1", "video_url": "https://youtube.com/embed/x", "duration_seconds": 60, "is_preview": True},
                    {"title": "L2", "video_url": "https://youtube.com/embed/y", "duration_seconds": 120},
                ],
            }],
        }
        r = admin_session.post(f"{API}/admin/courses", json=payload)
        assert r.status_code == 200, r.text
        c = r.json()
        cid = c["course_id"]
        assert c["title"] == payload["title"]
        assert c["slug"]
        # appears in public list
        pub = requests.get(f"{API}/courses").json()
        assert any(x["course_id"] == cid for x in pub)
        # update
        payload["subtitle"] = "updated"
        r = admin_session.put(f"{API}/admin/courses/{cid}", json=payload)
        assert r.status_code == 200
        assert r.json()["subtitle"] == "updated"
        # delete
        r = admin_session.delete(f"{API}/admin/courses/{cid}")
        assert r.status_code == 200

    def test_discount_crud_and_toggle(self, admin_session):
        code = f"TEST{uuid.uuid4().hex[:5].upper()}"
        r = admin_session.post(f"{API}/admin/discounts", json={
            "code": code, "type": "percent", "value": 100, "active": True
        })
        assert r.status_code == 200
        # toggle off
        r = admin_session.put(f"{API}/admin/discounts/{code}", json={
            "code": code, "type": "percent", "value": 100, "active": False
        })
        assert r.status_code == 200
        assert r.json()["active"] is False
        # delete
        r = admin_session.delete(f"{API}/admin/discounts/{code}")
        assert r.status_code == 200

    def test_get_settings_no_leak(self, admin_session):
        r = admin_session.get(f"{API}/admin/settings")
        assert r.status_code == 200
        p = r.json()["paytr"]
        # Must not leak decrypted keys
        assert "merchant_key" not in p
        assert "merchant_salt" not in p
        assert "merchant_key_enc" not in p
        assert "merchant_salt_enc" not in p
        assert "has_key" in p and "has_salt" in p

    def test_update_general_settings(self, admin_session):
        cur = admin_session.get(f"{API}/admin/settings").json()
        payload = {
            "site_name": cur["site_name"],
            "tagline": cur.get("tagline", ""),
            "contact_email": cur.get("contact_email", ""),
            "support_phone": cur.get("support_phone", ""),
            "hero_title": cur.get("hero_title", ""),
            "hero_subtitle": cur.get("hero_subtitle", ""),
            "about_text": cur.get("about_text", ""),
            "students_count": "12345",
            "email_enabled": True,
        }
        r = admin_session.put(f"{API}/admin/settings/general", json=payload)
        assert r.status_code == 200
        pub = requests.get(f"{API}/settings/public").json()
        assert pub["students_count"] == "12345"

    def test_paytr_configured_flag_and_no_leak(self, admin_session):
        # Provide all 3 -> configured True
        r = admin_session.put(f"{API}/admin/settings/paytr", json={
            "merchant_id": "TESTMERCH", "merchant_key": "dummykey",
            "merchant_salt": "dummysalt", "notification_url": "", "test_mode": True
        })
        assert r.status_code == 200
        assert r.json()["configured"] is True
        # GET must not leak
        got = admin_session.get(f"{API}/admin/settings").json()["paytr"]
        assert got["has_key"] and got["has_salt"] and got["configured"] is True
        assert "merchant_key" not in got
        assert "merchant_salt" not in got
        assert "merchant_key_enc" not in got
        # Reset merchant_id -> configured False (even if enc keys persist)
        r = admin_session.put(f"{API}/admin/settings/paytr", json={
            "merchant_id": "", "notification_url": "", "test_mode": True
        })
        assert r.status_code == 200
        assert r.json()["configured"] is False

    def test_email_templates(self, admin_session):
        r = admin_session.get(f"{API}/admin/email-templates")
        assert r.status_code == 200
        keys = {t["key"] for t in r.json()}
        assert {"welcome", "purchase", "completion"}.issubset(keys)
        r = admin_session.put(f"{API}/admin/email-templates/welcome", json={
            "subject": "Hoşgeldin {{name}}", "html": "<p>hi {{name}}</p>", "enabled": True
        })
        assert r.status_code == 200
        assert r.json()["subject"] == "Hoşgeldin {{name}}"

    def test_students_list(self, admin_session, student_session):
        r = admin_session.get(f"{API}/admin/students")
        assert r.status_code == 200
        assert any(u["email"] == student_session.email for u in r.json())

    def test_admin_forbidden_for_student(self, student_session):
        r = student_session.get(f"{API}/admin/stats")
        assert r.status_code == 403

    def test_payments_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/payments")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Checkout (free path) + discount + progress + certificate ----------------
class TestCheckoutAndProgress:
    def test_paid_checkout_returns_503_when_paytr_not_configured(self, admin_session, student_session):
        # Ensure PayTR unconfigured
        admin_session.put(f"{API}/admin/settings/paytr", json={
            "merchant_id": "", "notification_url": "", "test_mode": True
        })
        courses = requests.get(f"{API}/courses").json()
        paid = next((c for c in courses if (c.get("discount_price") or c.get("price", 0)) > 0), None)
        assert paid is not None
        r = student_session.post(f"{API}/payments/checkout", json={
            "items": [{"course_id": paid["course_id"]}]
        })
        assert r.status_code == 503, f"Expected 503, got {r.status_code}: {r.text}"

    def test_validate_discount_invalid(self, student_session):
        r = student_session.post(f"{API}/payments/validate-discount",
                                 json={"code": "NONEXISTENT_XYZ", "subtotal": 100})
        assert r.status_code == 400

    def test_free_checkout_via_100_percent_discount_and_certificate_issuance(self, admin_session, student_session):
        # 1) Create dedicated test course with 2 lessons, priced
        payload = {
            "title": f"TEST_FreeFlow_{uuid.uuid4().hex[:6]}",
            "subtitle": "s", "description": "d", "category": "Test",
            "price": 500, "is_published": True,
            "modules": [{
                "title": "M",
                "lessons": [
                    {"title": "L1", "video_url": "https://youtube.com/embed/x", "duration_seconds": 60},
                    {"title": "L2", "video_url": "https://youtube.com/embed/y", "duration_seconds": 60},
                ],
            }],
        }
        c = admin_session.post(f"{API}/admin/courses", json=payload).json()
        course_id = c["course_id"]

        # 2) Create 100% discount code
        code = f"TEST100{uuid.uuid4().hex[:4].upper()}"
        r = admin_session.post(f"{API}/admin/discounts", json={
            "code": code, "type": "percent", "value": 100, "active": True
        })
        assert r.status_code == 200

        # 3) Validate discount as student
        r = student_session.post(f"{API}/payments/validate-discount",
                                 json={"code": code, "subtotal": 500})
        assert r.status_code == 200
        assert r.json()["total"] == 0

        # 4) Checkout free
        r = student_session.post(f"{API}/payments/checkout", json={
            "items": [{"course_id": course_id}], "discount_code": code
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "free"
        order_id = r.json()["order_id"]

        # 5) My courses
        mc = student_session.get(f"{API}/my/courses").json()
        assert any(x["course_id"] == course_id for x in mc)

        # 6) Order status
        r = student_session.get(f"{API}/payments/order/{order_id}")
        assert r.status_code == 200
        assert r.json()["status"] == "paid"

        # 7) Player + progress + certificate
        r = student_session.get(f"{API}/my/courses/{course_id}/player")
        assert r.status_code == 200
        player = r.json()
        lesson_ids = [l["id"] for m in player["modules"] for l in m["lessons"]]
        assert len(lesson_ids) == 2

        for i, lid in enumerate(lesson_ids):
            r = student_session.post(f"{API}/my/progress", json={
                "course_id": course_id, "lesson_id": lid, "completed": True
            })
            assert r.status_code == 200
            data = r.json()
            if i == len(lesson_ids) - 1:
                assert data["certificate_issued"] is True
                assert data["progress_pct"] == 100

        # 8) Cert appears
        certs = student_session.get(f"{API}/my/certificates").json()
        assert any(cc["course_id"] == course_id for cc in certs)

        # Cleanup
        admin_session.delete(f"{API}/admin/courses/{course_id}")
        admin_session.delete(f"{API}/admin/discounts/{code}")

    def test_duplicate_enroll_blocked(self, admin_session, student_session):
        # Create free course
        title = f"TEST_Dup_{uuid.uuid4().hex[:6]}"
        c = admin_session.post(f"{API}/admin/courses", json={
            "title": title, "price": 0, "is_published": True,
            "modules": [{"title": "M", "lessons": [{"title": "L", "duration_seconds": 10}]}],
        }).json()
        cid = c["course_id"]
        r = student_session.post(f"{API}/payments/checkout", json={"items": [{"course_id": cid}]})
        assert r.status_code == 200
        r = student_session.post(f"{API}/payments/checkout", json={"items": [{"course_id": cid}]})
        assert r.status_code == 400
        admin_session.delete(f"{API}/admin/courses/{cid}")

    def test_manual_enroll_and_unenroll(self, admin_session, student_session):
        title = f"TEST_Manual_{uuid.uuid4().hex[:6]}"
        c = admin_session.post(f"{API}/admin/courses", json={
            "title": title, "price": 0, "is_published": True,
            "modules": [{"title": "M", "lessons": [{"title": "L", "duration_seconds": 10}]}],
        }).json()
        cid = c["course_id"]
        r = admin_session.post(f"{API}/admin/enrollments",
                               json={"user_id": student_session.user_id, "course_id": cid})
        assert r.status_code == 200
        mc = student_session.get(f"{API}/my/courses").json()
        assert any(x["course_id"] == cid for x in mc)
        r = admin_session.delete(f"{API}/admin/enrollments",
                                 json={"user_id": student_session.user_id, "course_id": cid})
        assert r.status_code == 200
        admin_session.delete(f"{API}/admin/courses/{cid}")


# ---------------- Protected route enforcement ----------------
class TestProtected:
    def test_my_courses_unauth(self):
        r = requests.get(f"{API}/my/courses")
        assert r.status_code == 401

    def test_checkout_unauth(self):
        r = requests.post(f"{API}/payments/checkout", json={"items": []})
        assert r.status_code == 401
