"""Backend tests for paid_amount in /api/my/courses and player enrollment gating."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"


def _login(session: requests.Session, email: str, password: str) -> dict:
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    return s


# --- BUG: paid enrollment shows correct paid_amount ---
def test_admin_my_courses_meta_paid_amount(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/my/courses")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) > 0, "Admin should have enrollments"
    meta = next((c for c in data if "meta" in c.get("title", "").lower() or "meta" in c.get("slug", "").lower()), None)
    assert meta is not None, f"Meta course not found in enrollments: {[c.get('title') for c in data]}"
    assert "paid_amount" in meta, "paid_amount field missing"
    # spec says paid_amount should equal 1999
    assert meta["paid_amount"] == 1999 or meta["paid_amount"] == 1999.0, \
        f"Expected paid_amount=1999, got {meta['paid_amount']}"


# --- BUG: Free enrollment shows paid_amount=0 ---
@pytest.fixture(scope="module")
def free_course_setup(admin_session):
    """Pick a non-Meta course, save its original discount_price, set to 0 for free-enrollment scenario."""
    r = admin_session.get(f"{BASE_URL}/api/admin/courses")
    assert r.status_code == 200
    courses = r.json()
    # Pick a course NOT the Meta one (Meta is used for paid check) and is_published=True
    target = next((c for c in courses if "meta" not in c.get("title", "").lower() and c.get("is_published")), None)
    assert target is not None, "No published non-Meta course found"
    course_id = target["course_id"]
    original_discount = target.get("discount_price")
    # PUT to set discount_price = 0
    payload = {k: v for k, v in target.items() if k in {
        "title","subtitle","description","category","level","price","discount_price","thumbnail",
        "instructor_name","instructor_id","is_published","what_you_learn","requirements",
        "meta_title","meta_description","meta_keywords","cross_sell_ids","modules"
    }}
    payload["discount_price"] = 0
    ur = admin_session.put(f"{BASE_URL}/api/admin/courses/{course_id}", json=payload)
    assert ur.status_code == 200, ur.text
    yield {"course_id": course_id, "slug": target["slug"], "title": target["title"]}
    # Revert
    payload["discount_price"] = original_discount
    admin_session.put(f"{BASE_URL}/api/admin/courses/{course_id}", json=payload)


def test_free_enrollment_paid_amount_zero(free_course_setup):
    """Fresh guest checkout for the free course -> /api/my/courses returns paid_amount=0 with 'Ücretsiz' semantics."""
    course = free_course_setup
    unique = uuid.uuid4().hex[:8]
    email = f"TEST_free_{unique}@example.com"
    guest = requests.Session()
    body = {
        "items": [{"course_id": course["course_id"]}],
        "payment_method": "paytr",
        "customer": {"name": "Test Free", "email": email, "phone": "05001112233"},
        "billing": {"type": "individual"},
    }
    r = guest.post(f"{BASE_URL}/api/payments/checkout", json=body)
    assert r.status_code == 200, f"Checkout failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["status"] == "free", f"Expected status=free, got {data}"

    # Session cookie should be set → GET /api/my/courses
    mc = guest.get(f"{BASE_URL}/api/my/courses")
    assert mc.status_code == 200, mc.text
    lst = mc.json()
    assert len(lst) == 1
    entry = lst[0]
    assert entry["course_id"] == course["course_id"]
    assert entry["paid_amount"] == 0, f"Expected paid_amount=0 for free enrollment, got {entry['paid_amount']}"

    # Also verify player works for enrolled student
    pr = guest.get(f"{BASE_URL}/api/my/courses/{course['course_id']}/player")
    assert pr.status_code == 200, f"Player should be accessible after enrollment: {pr.status_code} {pr.text}"


# --- SECURITY/REGRESSION: player 403 for non-enrolled ---
def test_player_forbidden_for_non_enrolled():
    """Register a new student and try to access a course they aren't enrolled in — expect 403."""
    unique = uuid.uuid4().hex[:8]
    email = f"TEST_nonenr_{unique}@example.com"
    s = requests.Session()
    reg = s.post(f"{BASE_URL}/api/auth/register", json={
        "name": "NonEnrolled Test", "email": email, "password": "TestPass!123", "accept_terms": True
    })
    assert reg.status_code in (200, 201), f"Register failed: {reg.status_code} {reg.text}"
    # Get any published course
    lc = requests.get(f"{BASE_URL}/api/courses")
    assert lc.status_code == 200
    course_id = lc.json()[0]["course_id"]
    r = s.get(f"{BASE_URL}/api/my/courses/{course_id}/player")
    assert r.status_code == 403, f"Expected 403 for non-enrolled, got {r.status_code} {r.text}"


def test_admin_meta_player_accessible(admin_session):
    """Regression: admin (enrolled in Meta) can access player."""
    mc = admin_session.get(f"{BASE_URL}/api/my/courses").json()
    meta = next((c for c in mc if "meta" in c.get("title","").lower()), None)
    assert meta is not None
    r = admin_session.get(f"{BASE_URL}/api/my/courses/{meta['course_id']}/player")
    assert r.status_code == 200
    body = r.json()
    assert body["course_id"] == meta["course_id"]
    assert "modules" in body
