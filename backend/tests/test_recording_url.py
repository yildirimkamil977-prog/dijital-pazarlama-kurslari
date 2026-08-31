"""Backend tests for the per-lesson recording_url feature on Live Group Trainings."""
import os
import secrets
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASS = "Admin!2026Panel"
SEED_SLUG = "google-ads-canli-grup-egitimi"
SEED_L1_RECORDING = "https://vimeo.com/76979871"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# 1) Public detail MUST NOT expose recording_url or meet_link
def test_public_detail_hides_recording_and_meet():
    r = requests.get(f"{API}/group-trainings/{SEED_SLUG}", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert len(d["lessons"]) == 2
    allowed = {"id", "title", "date", "time"}
    for l in d["lessons"]:
        assert "meet_link" not in l, f"meet_link leaked: {l}"
        assert "recording_url" not in l, f"recording_url leaked: {l}"
        extra = set(l.keys()) - allowed
        assert not extra, f"public lesson has unexpected keys: {extra}"


# 2) Public listing must not expose recording_url either
def test_public_listing_hides_recording():
    r = requests.get(f"{API}/group-trainings", timeout=15)
    assert r.status_code == 200
    for d in r.json():
        for l in d.get("lessons", []):
            assert "recording_url" not in l
            assert "meet_link" not in l


# 3) Admin GET reveals both meet_link and recording_url, and seed lesson 1 has the vimeo URL
def test_admin_get_reveals_recording_url_seed(admin_session):
    r = admin_session.get(f"{API}/admin/group-trainings", timeout=15)
    assert r.status_code == 200
    seed = next((d for d in r.json() if d["slug"] == SEED_SLUG), None)
    assert seed is not None
    lessons = seed["lessons"]
    assert len(lessons) == 2
    for l in lessons:
        assert "meet_link" in l and "recording_url" in l
    # Sorted by date/time in _public; lesson 1 = Hesap Kurulumu (2026-09-07)
    l1 = next(l for l in lessons if "Hesap" in (l.get("title") or "") or l.get("date") == "2026-09-07")
    assert l1["recording_url"] == SEED_L1_RECORDING, f"expected {SEED_L1_RECORDING}, got {l1.get('recording_url')}"


# 4) Admin create + update persists recording_url per lesson
def test_admin_create_update_persists_recording_url(admin_session):
    tag = secrets.token_hex(3)
    payload = {
        "title": f"TEST Recording {tag}",
        "description": "test",
        "price": 100,
        "capacity": 10,
        "lessons": [
            {"title": "L1", "date": "2027-04-01", "time": "20:00",
             "meet_link": "https://meet.google.com/aaa-bbbb-ccc",
             "recording_url": "https://vimeo.com/111111111"},
            {"title": "L2", "date": "2027-04-08", "time": "20:00",
             "meet_link": "", "recording_url": ""},
        ],
        "is_published": True,
    }
    r = admin_session.post(f"{API}/admin/group-trainings", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    gid = r.json()["group_id"]
    try:
        # Admin GET reflects recording_url
        rr = admin_session.get(f"{API}/admin/group-trainings/{gid}", timeout=15)
        assert rr.status_code == 200
        d = rr.json()
        recs = {l["title"]: l.get("recording_url", "") for l in d["lessons"]}
        assert recs["L1"] == "https://vimeo.com/111111111"
        assert recs["L2"] == ""

        # Update lesson 2 to add a recording
        payload["lessons"][1]["recording_url"] = "https://vimeo.com/222222222"
        ru = admin_session.put(f"{API}/admin/group-trainings/{gid}", json=payload, timeout=15)
        assert ru.status_code == 200
        # Verify via admin GET
        rr2 = admin_session.get(f"{API}/admin/group-trainings/{gid}", timeout=15)
        recs2 = {l["title"]: l.get("recording_url", "") for l in rr2.json()["lessons"]}
        assert recs2["L1"] == "https://vimeo.com/111111111"
        assert recs2["L2"] == "https://vimeo.com/222222222"

        # Public detail MUST still not expose recording_url
        slug = r.json()["slug"]
        pub = requests.get(f"{API}/group-trainings/{slug}", timeout=15).json()
        for l in pub["lessons"]:
            assert "recording_url" not in l
            assert "meet_link" not in l
    finally:
        admin_session.delete(f"{API}/admin/group-trainings/{gid}", timeout=15)


# 5) Enrolled student sees recording_url via /my/group-trainings on the seed training
def test_enrolled_student_sees_recording_url_on_seed(admin_session):
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("MONGO_URL/DB_NAME not set")
    client = MongoClient(mongo_url)
    db = client[db_name]

    # Find seed group_id
    seed = db.group_trainings.find_one({"slug": SEED_SLUG}, {"_id": 0})
    assert seed is not None, "seed group missing"
    gid = seed["group_id"]

    # Register fresh test student
    s = requests.Session()
    email = f"TEST_rec_{secrets.token_hex(4)}@example.com"
    rr = s.post(f"{API}/auth/register", json={
        "email": email, "password": "TestPass123!", "name": "RecTest",
        "phone": "05000000000", "accept_terms": True,
    }, timeout=15)
    assert rr.status_code in (200, 201), rr.text
    tok = rr.json().get("token") or rr.json().get("access_token")
    user_id = rr.json().get("user", {}).get("user_id") or rr.json().get("user_id")
    assert user_id, f"no user_id in register response: {rr.json()}"
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})

    enr_id = f"TEST_enr_{secrets.token_hex(4)}"
    db.group_enrollments.insert_one({
        "enrollment_id": enr_id, "group_id": gid,
        "user_id": user_id, "user_email": email, "user_name": "RecTest",
    })
    try:
        r2 = s.get(f"{API}/my/group-trainings", timeout=15)
        assert r2.status_code == 200
        arr = r2.json()
        assert len(arr) == 1
        lessons = arr[0]["lessons"]
        assert len(lessons) == 2
        # Both keys should be present, and lesson 1 has the seeded vimeo URL
        for l in lessons:
            assert "recording_url" in l
            assert "meet_link" in l
        rec_urls = [l["recording_url"] for l in lessons]
        assert SEED_L1_RECORDING in rec_urls, f"expected seed recording url in {rec_urls}"
        # Second lesson has empty recording
        empties = [l for l in lessons if l["recording_url"] == ""]
        assert len(empties) == 1
    finally:
        db.group_enrollments.delete_one({"enrollment_id": enr_id})
        db.users.delete_one({"email": email})
