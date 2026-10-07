"""Tests for admin students filters, enrichment, and CSV export (iteration 18)."""
import os
import re
import time
import uuid
import pytest
import requests
from pathlib import Path


def _load_url():
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found")


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", _load_url()).rstrip("/")
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def seed(admin_session):
    """Create 2 TEST_ students, enroll one in a course and one in a group."""
    s = admin_session
    courses = s.get(f"{BASE_URL}/api/admin/courses").json()
    groups = s.get(f"{BASE_URL}/api/admin/group-trainings").json()
    assert courses, "need at least 1 course"
    course_id = courses[0]["course_id"]
    group_id = groups[0]["group_id"] if groups else None

    created = []
    tag = uuid.uuid4().hex[:6]
    for i in range(2):
        email = f"TEST_filter_{tag}_{i}@example.com".lower()
        reg_sess = requests.Session()  # separate session so admin cookie isn't overwritten
        r = reg_sess.post(f"{BASE_URL}/api/auth/register", json={
            "name": f"TEST Filter {tag} {i}",
            "email": email,
            "password": "TestPass!2026",
            "phone": f"0555000{i:04d}",
            "accept_terms": True,
            "accept_privacy": True,
            "accept_kvkk": True,
            "accept_marketing": False,
        })
        assert r.status_code in (200, 201), r.text
        # fetch user_id via admin list search
        lr = s.get(f"{BASE_URL}/api/admin/students", params={"search": email, "limit": 5}).json()
        assert lr["items"], f"user not found: {email}"
        uid = lr["items"][0]["user_id"]
        created.append({"user_id": uid, "email": email})

    # Enroll student 0 in course, student 1 in group (if exists)
    r = s.post(f"{BASE_URL}/api/admin/enrollments", json={"user_id": created[0]["user_id"], "course_id": course_id})
    assert r.status_code == 200, r.text

    if group_id:
        # Insert group enrollment via mark-paid flow is heavy; use direct endpoint if exists.
        # fall back: try admin add via group-trainings endpoint
        enr_url = f"{BASE_URL}/api/admin/group-trainings/{group_id}/enrollments"
        r = s.post(enr_url, json={"user_id": created[1]["user_id"]})
        # not critical if it doesn't exist
        print("group enroll:", r.status_code, r.text[:200])

    yield {"students": created, "course_id": course_id, "group_id": group_id}

    # cleanup
    for u in created:
        s.delete(f"{BASE_URL}/api/admin/enrollments", json={"user_id": u["user_id"], "course_id": course_id})
        # delete user
        s.delete(f"{BASE_URL}/api/admin/students/{u['user_id']}")


# ---- Tests ----
def test_list_students_basic(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/students", params={"page": 1, "limit": 5})
    assert r.status_code == 200
    d = r.json()
    for k in ("items", "total", "page", "pages"):
        assert k in d
    if d["items"]:
        item = d["items"][0]
        for k in ("courses", "groups", "matched", "order_count", "total_spent", "enrollment_count"):
            assert k in item, f"missing field {k}"


def test_search_filter(admin_session, seed):
    email = seed["students"][0]["email"]
    r = admin_session.get(f"{BASE_URL}/api/admin/students", params={"search": email})
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["email"] == email


def test_date_range_filter(admin_session, seed):
    today = time.strftime("%Y-%m-%d")
    r = admin_session.get(f"{BASE_URL}/api/admin/students", params={"start_date": today, "end_date": today, "limit": 50})
    assert r.status_code == 200
    emails = [u["email"] for u in r.json()["items"]]
    # Both TEST_ students registered today should appear
    for u in seed["students"]:
        assert u["email"] in emails, f"{u['email']} missing in today-range"


def test_date_range_excludes_old(admin_session, seed):
    r = admin_session.get(f"{BASE_URL}/api/admin/students", params={"end_date": "2000-01-01", "limit": 50})
    assert r.status_code == 200
    emails = [u["email"] for u in r.json()["items"]]
    for u in seed["students"]:
        assert u["email"] not in emails


def test_course_filter_or_logic(admin_session, seed):
    r = admin_session.get(f"{BASE_URL}/api/admin/students",
                          params={"course_ids": seed["course_id"], "limit": 200})
    assert r.status_code == 200
    items = r.json()["items"]
    emails = [u["email"] for u in items]
    assert seed["students"][0]["email"] in emails
    # matched should include the course title
    me = next(u for u in items if u["email"] == seed["students"][0]["email"])
    assert len(me["matched"]) >= 1


def test_course_filter_unknown_returns_empty(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/students",
                          params={"course_ids": "course_nonexistent_xyz", "limit": 10})
    assert r.status_code == 200
    assert r.json()["total"] == 0


def test_export_csv_headers(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/students/export")
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "text/csv" in ct
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd and "ogrenciler-" in cd
    # UTF-8 BOM
    assert r.content.startswith(b"\xef\xbb\xbf"), "missing UTF-8 BOM"
    body = r.content.decode("utf-8-sig")
    first = body.splitlines()[0]
    assert ";" in first
    for col in ["Ad Soyad", "E-posta", "Telefon", "Kayıt Tarihi", "Kayıtlı Kurslar",
                "Kayıtlı Grup Eğitimleri", "Sipariş Sayısı", "Toplam Harcama"]:
        assert col in first, f"missing column: {col}"
    assert "Filtreye Uyan Eğitimler" not in first  # no filter -> no extra column


def test_export_csv_with_course_filter_adds_column(admin_session, seed):
    r = admin_session.get(f"{BASE_URL}/api/admin/students/export",
                          params={"course_ids": seed["course_id"]})
    assert r.status_code == 200
    body = r.content.decode("utf-8-sig")
    first = body.splitlines()[0]
    assert "Filtreye Uyan Eğitimler" in first


def test_export_csv_respects_search(admin_session, seed):
    email = seed["students"][0]["email"]
    r = admin_session.get(f"{BASE_URL}/api/admin/students/export", params={"search": email})
    assert r.status_code == 200
    body = r.content.decode("utf-8-sig")
    lines = body.splitlines()
    assert len(lines) == 2  # header + 1 row
    assert email in lines[1]


def test_student_detail_still_works(admin_session, seed):
    uid = seed["students"][0]["user_id"]
    r = admin_session.get(f"{BASE_URL}/api/admin/students/{uid}")
    assert r.status_code == 200
    d = r.json()
    assert d["user"]["user_id"] == uid
    assert isinstance(d["courses"], list)
