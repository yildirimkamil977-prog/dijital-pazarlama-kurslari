"""Backend tests for Canlı Grup Eğitimleri feature."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
CRON_SECRET = "c7f4a2e9b13d46f8a05e7c9d2f1b8a63e4d90c7a15b2f83e6d4c1a9b7e5f2038c"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASS = "Admin!2026Panel"
SEED_SLUG = "google-ads-canli-grup-egitimi"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def student_session():
    """Register a fresh student for enrollment tests."""
    import secrets
    email = f"TEST_group_{secrets.token_hex(4)}@example.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "TestPass123!", "name": "Test Student", "phone": "05000000000", "accept_terms": True
    }, timeout=15)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    s.email = email
    return s


# ---------- Public endpoints ----------
def test_list_group_trainings_public():
    r = requests.get(f"{API}/group-trainings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    slugs = [d["slug"] for d in data]
    assert SEED_SLUG in slugs, f"seeded training missing: {slugs}"


def test_get_group_detail_seed():
    r = requests.get(f"{API}/group-trainings/{SEED_SLUG}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["slug"] == SEED_SLUG
    assert d["capacity"] == 12
    assert d["price"] == 4999
    assert d["enrolled"] == 0
    assert d["remaining"] == 12
    assert d["low_stock"] is False  # 12 > 10
    assert len(d["lessons"]) == 2
    # meet_links should NOT be exposed on public detail
    for l in d["lessons"]:
        assert "meet_link" not in l


def test_get_group_detail_404():
    r = requests.get(f"{API}/group-trainings/does-not-exist-xyz", timeout=15)
    assert r.status_code == 404


# ---------- Admin CRUD + capacity live update ----------
def test_admin_crud_and_capacity_urgency(admin_session):
    # Create
    payload = {
        "title": "TEST Group Training Kapasite",
        "description": "test",
        "price": 100,
        "capacity": 20,
        "lessons": [{"title": "L1", "date": "2027-01-15", "time": "20:00", "meet_link": ""}],
        "is_published": True,
    }
    r = admin_session.post(f"{API}/admin/group-trainings", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    doc = r.json()
    gid = doc["group_id"]
    slug = doc["slug"]

    try:
        # Public detail reflects capacity=20 -> urgency hidden
        r = requests.get(f"{API}/group-trainings/{slug}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["capacity"] == 20 and d["remaining"] == 20
        assert d["low_stock"] is False

        # Update capacity -> 8 (urgency ON, remaining<=10)
        payload["capacity"] = 8
        r = admin_session.put(f"{API}/admin/group-trainings/{gid}", json=payload, timeout=15)
        assert r.status_code == 200

        r = requests.get(f"{API}/group-trainings/{slug}", timeout=15)
        d = r.json()
        assert d["capacity"] == 8 and d["remaining"] == 8
        assert d["low_stock"] is True, "urgency (low_stock) should be True when remaining<=10"

        # Update capacity -> 50 -> urgency off
        payload["capacity"] = 50
        r = admin_session.put(f"{API}/admin/group-trainings/{gid}", json=payload, timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/group-trainings/{slug}", timeout=15)
        d = r.json()
        assert d["remaining"] == 50 and d["low_stock"] is False
    finally:
        admin_session.delete(f"{API}/admin/group-trainings/{gid}", timeout=15)


def test_admin_students_endpoint(admin_session):
    # Get gid of seed training
    r = admin_session.get(f"{API}/admin/group-trainings", timeout=15)
    assert r.status_code == 200
    seed = next(x for x in r.json() if x["slug"] == SEED_SLUG)
    r = admin_session.get(f"{API}/admin/group-trainings/{seed['group_id']}/students", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_get_reveals_meet_links(admin_session):
    """Admin listing includes meet_link (with_links=True)."""
    r = admin_session.get(f"{API}/admin/group-trainings", timeout=15)
    assert r.status_code == 200
    for d in r.json():
        for l in d["lessons"]:
            # key should be present (may be empty string)
            assert "meet_link" in l


# ---------- Purchase (PayTR unconfigured => 503) ----------
def test_purchase_returns_503_paytr_unconfigured(student_session):
    r = requests.get(f"{API}/group-trainings/{SEED_SLUG}", timeout=15)
    d = r.json()
    # Use admin endpoint via public listing to get group_id? public list has group_id
    lst = requests.get(f"{API}/group-trainings", timeout=15).json()
    seed = next(x for x in lst if x["slug"] == SEED_SLUG)
    gid = seed["group_id"]
    r = student_session.post(f"{API}/group-trainings/{gid}/purchase", timeout=20)
    assert r.status_code == 503, f"expected 503 (paytr not configured), got {r.status_code}: {r.text}"
    detail = r.json().get("detail", "")
    assert "yapılandırıl" in detail.lower() or "kart" in detail.lower(), detail


def test_purchase_unauth_returns_401():
    lst = requests.get(f"{API}/group-trainings", timeout=15).json()
    gid = next(x for x in lst if x["slug"] == SEED_SLUG)["group_id"]
    r = requests.post(f"{API}/group-trainings/{gid}/purchase", timeout=15)
    assert r.status_code in (401, 403)


# ---------- Capacity enforcement backend ----------
def test_capacity_enforcement_full(admin_session):
    """Fill capacity via direct enrollments (bypass PayTR) then expect 400 on purchase."""
    import secrets
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    # We can't easily seed enrollments via API without payments; use mongo directly.
    try:
        client = MongoClient(mongo_url)
        db = client[db_name]
    except Exception as e:
        pytest.skip(f"mongo not accessible: {e}")

    # Create small training
    payload = {"title": "TEST FullCap", "price": 10, "capacity": 1,
               "lessons": [{"title": "L", "date": "2027-02-01", "time": "10:00", "meet_link": ""}],
               "is_published": True}
    r = admin_session.post(f"{API}/admin/group-trainings", json=payload, timeout=15)
    assert r.status_code == 200
    gid = r.json()["group_id"]
    try:
        # Insert enrollment directly
        db.group_enrollments.insert_one({
            "enrollment_id": f"TEST_enr_{secrets.token_hex(3)}",
            "group_id": gid, "user_id": "TEST_capfill", "user_email": "TEST_capfill@example.com",
            "user_name": "Cap Fill",
        })
        # Verify remaining = 0 and sold_out
        slug = r.json()["slug"]
        det = requests.get(f"{API}/group-trainings/{slug}", timeout=15).json()
        assert det["remaining"] == 0 and det["sold_out"] is True

        # Fresh student attempts purchase -> should hit capacity check BEFORE paytr 503
        s = requests.Session()
        email = f"TEST_grpcap_{secrets.token_hex(3)}@example.com"
        rr = s.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass123!", "name": "X", "phone": "05000000000", "accept_terms": True}, timeout=15)
        tok = rr.json().get("token") or rr.json().get("access_token")
        if tok:
            s.headers.update({"Authorization": f"Bearer {tok}"})
        r2 = s.post(f"{API}/group-trainings/{gid}/purchase", timeout=15)
        assert r2.status_code == 400, f"expected 400 for full capacity, got {r2.status_code} {r2.text}"
        assert "kontenjan" in r2.json().get("detail", "").lower()
    finally:
        db.group_enrollments.delete_many({"group_id": gid})
        admin_session.delete(f"{API}/admin/group-trainings/{gid}", timeout=15)


# ---------- Cron ----------
def test_cron_no_auth_returns_401():
    r = requests.post(f"{API}/cron/group-reminders", timeout=15)
    assert r.status_code == 401


def test_cron_with_bearer_returns_2xx():
    r = requests.post(f"{API}/cron/group-reminders",
                      headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=15)
    assert 200 <= r.status_code < 300, f"{r.status_code} {r.text}"


# ---------- Student panel: /my/group-trainings ----------
def test_my_group_trainings_empty(student_session):
    r = student_session.get(f"{API}/my/group-trainings", timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_my_group_trainings_with_enrollment_shows_meet_links(admin_session):
    """Verify that after enrollment, /my/group-trainings returns meet_link field."""
    import secrets
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    try:
        client = MongoClient(mongo_url)
        db = client[db_name]
    except Exception as e:
        pytest.skip(f"mongo not accessible: {e}")

    payload = {"title": "TEST MeetLinkShow", "price": 10, "capacity": 5,
               "lessons": [
                   {"title": "L1", "date": "2027-03-01", "time": "10:00", "meet_link": "https://meet.google.com/aaa-bbbb-ccc"},
                   {"title": "L2", "date": "2027-03-08", "time": "10:00", "meet_link": ""},
               ],
               "is_published": True}
    r = admin_session.post(f"{API}/admin/group-trainings", json=payload, timeout=15)
    assert r.status_code == 200
    gid = r.json()["group_id"]

    # Fresh student
    s = requests.Session()
    email = f"TEST_grpmeet_{secrets.token_hex(3)}@example.com"
    rr = s.post(f"{API}/auth/register", json={
        "email": email, "password": "TestPass123!", "name": "MeetTest", "phone": "05000000000", "accept_terms": True}, timeout=15)
    assert rr.status_code in (200, 201)
    tok = rr.json().get("token") or rr.json().get("access_token")
    user_id = rr.json().get("user", {}).get("user_id") or rr.json().get("user_id")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})

    # Seed enrollment
    db.group_enrollments.insert_one({
        "enrollment_id": f"TEST_enr_{secrets.token_hex(3)}", "group_id": gid,
        "user_id": user_id, "user_email": email, "user_name": "MeetTest",
    })

    try:
        r2 = s.get(f"{API}/my/group-trainings", timeout=15)
        assert r2.status_code == 200
        arr = r2.json()
        assert len(arr) == 1
        lessons = arr[0]["lessons"]
        assert any(l.get("meet_link") == "https://meet.google.com/aaa-bbbb-ccc" for l in lessons)
        assert any(l.get("meet_link", "") == "" for l in lessons)
    finally:
        db.group_enrollments.delete_many({"group_id": gid})
        admin_session.delete(f"{API}/admin/group-trainings/{gid}", timeout=15)
        db.users.delete_one({"email": email})
