"""Iteration 23 — Waitlist (haber ver) + launch notify + discount auto-apply.

Covers:
  * POST /api/courses/<course_id>/notify (dedupe, invalid email, send_joined fire-and-forget)
  * GET /api/admin/waitlist filters (course_id, status, search) + course_title join
  * GET/POST /api/admin/courses/<id>/waitlist, /waitlist/summary, /waitlist/notify
  * launch_discount_code persistence via PUT /api/admin/courses/<id>
  * notify validations: sale_closed → 400, unpublished → 400, bad launch code → 400
  * notify success: queues all pending, resend specific emails, queued=0 after notified
  * Email templates waitlist_joined & course_launch exist with {discount_block}
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"

TAG = uuid.uuid4().hex[:8]
# Use Resend test addresses — a real Resend key is live in this preview.
EMAIL_A = f"delivered+wl_a_{TAG}@resend.dev"
EMAIL_B = f"delivered+wl_b_{TAG}@resend.dev"
EMAIL_C = f"delivered+wl_c_{TAG}@resend.dev"


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def test_course(admin_session):
    """Pick canonical course (slug google-ads-ile-sifirdan-uzmanliga) and capture original state."""
    r = admin_session.get(f"{API}/admin/courses", timeout=20)
    assert r.status_code == 200
    courses = r.json()
    c = next((x for x in courses if x.get("slug") == "google-ads-ile-sifirdan-uzmanliga"), None) or courses[0]
    cid = c["course_id"]
    # fetch full doc
    full = admin_session.get(f"{API}/admin/courses/{cid}", timeout=20).json()
    orig = {k: full.get(k) for k in ("sale_closed", "is_published", "launch_discount_code", "price", "discount_price", "early_bird_price", "publish_at")}
    yield full, orig
    # restore
    payload = _put_payload(full)
    for k, v in orig.items():
        payload[k] = v
    admin_session.put(f"{API}/admin/courses/{cid}", json=payload, timeout=20)


@pytest.fixture(scope="module")
def test_discount(admin_session, test_course):
    """Create a course-restricted active discount code; delete at teardown."""
    c, _ = test_course
    code = f"TESTWL{TAG.upper()}"
    body = {"code": code, "type": "percent", "value": 10, "active": True, "course_ids": [c["course_id"]], "usage_limit": 0}
    r = admin_session.post(f"{API}/admin/discounts", json=body, timeout=20)
    assert r.status_code in (200, 201), f"create discount failed: {r.status_code} {r.text}"
    yield code
    admin_session.delete(f"{API}/admin/discounts/{code}", timeout=20)


@pytest.fixture(scope="module")
def other_discount(admin_session):
    """Discount restricted to another (dummy) course_id."""
    code = f"TESTOTHER{TAG.upper()}"
    body = {"code": code, "type": "percent", "value": 15, "active": True, "course_ids": ["course_does_not_exist_xyz"], "usage_limit": 0}
    r = admin_session.post(f"{API}/admin/discounts", json=body, timeout=20)
    assert r.status_code in (200, 201)
    yield code
    admin_session.delete(f"{API}/admin/discounts/{code}", timeout=20)


@pytest.fixture(scope="module", autouse=True)
def cleanup_waitlist(admin_session, test_course):
    yield
    c, _ = test_course
    # Delete waitlist entries we created by iterating via admin endpoint and (if available) direct cleanup.
    # No direct DELETE endpoint for waitlist entries, so leave them — they are TEST_ delivered addresses.


def _put_payload(course: dict) -> dict:
    """Convert full course doc to CourseIn-compatible payload."""
    fields = ("title","subtitle","description","category","level","price","discount_price","publish_at","early_bird_price",
              "thumbnail","instructor_name","instructor_id","is_published","what_you_learn","requirements","long_description",
              "sale_closed","launch_discount_code","meta_title","meta_description","meta_keywords","cross_sell_ids","modules")
    out = {k: course.get(k) for k in fields if course.get(k) is not None}
    out.setdefault("title", course.get("title", ""))
    out.setdefault("modules", course.get("modules", []))
    return out


# ---------------- Tests ----------------
class TestNotifyAndWaitlistAPI:
    def test_01_setup_course_sale_closed_published(self, admin_session, test_course):
        c, _ = test_course
        payload = _put_payload(c)
        payload["sale_closed"] = True
        payload["is_published"] = True
        payload["launch_discount_code"] = ""
        r = admin_session.put(f"{API}/admin/courses/{c['course_id']}", json=payload, timeout=20)
        assert r.status_code == 200
        got = r.json()
        assert got["sale_closed"] is True
        assert got["is_published"] is True

    def test_02_notify_invalid_email_400(self, test_course):
        c, _ = test_course
        r = requests.post(f"{API}/courses/{c['course_id']}/notify", json={"email": "not-an-email"}, timeout=20)
        assert r.status_code == 400

    def test_03_notify_creates_entries(self, test_course):
        c, _ = test_course
        for em in (EMAIL_A, EMAIL_B, EMAIL_C):
            r = requests.post(f"{API}/courses/{c['course_id']}/notify", json={"email": em, "name": "Testçi"}, timeout=20)
            assert r.status_code == 200, f"{em}: {r.status_code} {r.text}"
            assert r.json().get("ok") is True

    def test_04_notify_dedup(self, admin_session, test_course):
        """Second POST with same email should NOT create a duplicate row."""
        c, _ = test_course
        r = requests.post(f"{API}/courses/{c['course_id']}/notify", json={"email": EMAIL_A}, timeout=20)
        assert r.status_code == 200
        rows = admin_session.get(f"{API}/admin/courses/{c['course_id']}/waitlist", timeout=20).json()
        matching = [row for row in rows if row["email"] == EMAIL_A]
        assert len(matching) == 1

    def test_05_admin_waitlist_list_filters(self, admin_session, test_course):
        c, _ = test_course
        # all for course
        r = admin_session.get(f"{API}/admin/waitlist", params={"course_id": c["course_id"]}, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        emails = {row["email"] for row in rows}
        assert {EMAIL_A, EMAIL_B, EMAIL_C} <= emails
        # ensure course_title join
        assert all(row.get("course_title") for row in rows)
        # pending filter
        rp = admin_session.get(f"{API}/admin/waitlist", params={"course_id": c["course_id"], "status": "pending"}, timeout=20).json()
        assert {EMAIL_A, EMAIL_B, EMAIL_C} <= {r["email"] for r in rp}
        # search filter
        rs = admin_session.get(f"{API}/admin/waitlist", params={"search": TAG}, timeout=20).json()
        assert len(rs) >= 3

    def test_06_waitlist_summary(self, admin_session, test_course):
        c, _ = test_course
        r = admin_session.get(f"{API}/admin/courses/{c['course_id']}/waitlist/summary", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["pending"] >= 3
        assert d["total"] >= 3

    def test_07_notify_fails_when_sale_closed(self, admin_session, test_course):
        c, _ = test_course
        r = admin_session.post(f"{API}/admin/courses/{c['course_id']}/waitlist/notify", json={"emails": []}, timeout=20)
        assert r.status_code == 400

    def test_08_launch_code_persists_on_save(self, admin_session, test_course, test_discount):
        c, _ = test_course
        payload = _put_payload(c)
        payload["sale_closed"] = True
        payload["is_published"] = True
        payload["launch_discount_code"] = test_discount
        r = admin_session.put(f"{API}/admin/courses/{c['course_id']}", json=payload, timeout=20)
        assert r.status_code == 200
        assert r.json().get("launch_discount_code") == test_discount

    def test_09_notify_bad_code_rejected(self, admin_session, test_course, other_discount):
        """Still sale_closed=True so first error is sale_closed; open sale then test code restriction."""
        c, _ = test_course
        # open sale first
        payload = _put_payload(c)
        payload["sale_closed"] = False
        payload["is_published"] = True
        payload["launch_discount_code"] = other_discount  # restricted to other course
        admin_session.put(f"{API}/admin/courses/{c['course_id']}", json=payload, timeout=20)
        r = admin_session.post(f"{API}/admin/courses/{c['course_id']}/waitlist/notify", json={"emails": []}, timeout=20)
        assert r.status_code == 400
        assert "kurs" in r.json().get("detail", "").lower() or "geçerli" in r.json().get("detail", "").lower()

    def test_10_notify_queues_pending(self, admin_session, test_course, test_discount):
        c, _ = test_course
        # fix code back to valid one, keep sale open + published
        payload = _put_payload(c)
        payload["sale_closed"] = False
        payload["is_published"] = True
        payload["launch_discount_code"] = test_discount
        admin_session.put(f"{API}/admin/courses/{c['course_id']}", json=payload, timeout=20)
        r = admin_session.post(f"{API}/admin/courses/{c['course_id']}/waitlist/notify", json={"emails": []}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d.get("queued") >= 3
        assert d.get("code") == test_discount
        # wait for sequential ~0.6s/entry
        time.sleep(3.5)
        rows = admin_session.get(f"{API}/admin/courses/{c['course_id']}/waitlist", timeout=20).json()
        notified = [r for r in rows if r["email"] in (EMAIL_A, EMAIL_B, EMAIL_C) and r.get("notified_at")]
        assert len(notified) >= 3, f"not all notified: {rows}"
        assert all(n.get("notified_code") == test_discount for n in notified)

    def test_11_notify_empty_queues_zero_second_time(self, admin_session, test_course):
        c, _ = test_course
        r = admin_session.post(f"{API}/admin/courses/{c['course_id']}/waitlist/notify", json={"emails": []}, timeout=20)
        assert r.status_code == 200
        assert r.json().get("queued") == 0

    def test_12_notify_resend_specific_email(self, admin_session, test_course):
        c, _ = test_course
        r = admin_session.post(f"{API}/admin/courses/{c['course_id']}/waitlist/notify", json={"emails": [EMAIL_A]}, timeout=20)
        assert r.status_code == 200
        assert r.json().get("queued") == 1

    def test_13_notify_unpublished_rejected(self, admin_session, test_course):
        c, _ = test_course
        payload = _put_payload(c)
        payload["sale_closed"] = False
        payload["is_published"] = False
        admin_session.put(f"{API}/admin/courses/{c['course_id']}", json=payload, timeout=20)
        r = admin_session.post(f"{API}/admin/courses/{c['course_id']}/waitlist/notify", json={"emails": []}, timeout=20)
        assert r.status_code == 400
        # restore published for subsequent tests / UI
        payload["is_published"] = True
        admin_session.put(f"{API}/admin/courses/{c['course_id']}", json=payload, timeout=20)


class TestEmailTemplates:
    def test_waitlist_templates_exist(self, admin_session):
        r = admin_session.get(f"{API}/admin/email-templates", timeout=20)
        assert r.status_code == 200
        keys = {t["key"]: t for t in r.json()}
        assert "waitlist_joined" in keys
        assert "course_launch" in keys
        assert "{{discount_block}}" in keys["course_launch"]["html"]


class TestAutoApplyDiscountCheckout:
    """Validate /payments/validate-discount accepts the launch code so auto-apply would succeed."""

    def test_validate_launch_code_on_course(self, admin_session, test_course, test_discount):
        c, _ = test_course
        price = float(c.get("price") or 0) or 1000
        payload = {
            "code": test_discount,
            "subtotal": price,
            "items": [{"course_id": c["course_id"], "group_id": "", "price": price}],
        }
        # Note: /payments/validate-discount currently requires authenticated user via get_current_user;
        # auto-apply on checkout for GUEST users would therefore silently fail. See report.
        r = admin_session.post(f"{API}/payments/validate-discount", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("code") == test_discount
        assert d.get("discount", 0) > 0
