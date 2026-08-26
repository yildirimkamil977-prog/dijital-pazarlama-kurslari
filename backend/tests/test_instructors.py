"""Instructor CRUD + public endpoints tests"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://video-elearning.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return s


def test_public_list_instructors():
    r = requests.get(f"{BASE_URL}/api/instructors")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) >= 1
    ky = next((i for i in data if i["slug"] == "kamil-yildirim"), None)
    assert ky is not None
    assert ky["course_count"] == 3
    assert ky["name"] == "Kamil Yıldırım"


def test_public_instructor_detail():
    r = requests.get(f"{BASE_URL}/api/instructors/kamil-yildirim")
    assert r.status_code == 200
    d = r.json()
    assert d["slug"] == "kamil-yildirim"
    assert len(d["courses"]) == 3


def test_course_summary_includes_instructor():
    r = requests.get(f"{BASE_URL}/api/courses")
    assert r.status_code == 200
    courses = r.json()
    assert len(courses) >= 1
    with_inst = [c for c in courses if c.get("instructor")]
    assert len(with_inst) == len(courses), "all courses should have instructor"
    for c in with_inst:
        assert c["instructor"]["slug"] == "kamil-yildirim"


def test_admin_instructor_crud(admin_session):
    # Create
    payload = {"name": "TEST_Instructor QA", "title": "Test Title", "bio": "Test bio text"}
    r = admin_session.post(f"{BASE_URL}/api/admin/instructors", json=payload)
    assert r.status_code in (200, 201), f"create {r.status_code} {r.text}"
    created = r.json()
    inst_id = created.get("instructor_id") or created.get("id")
    assert inst_id
    assert created["name"] == payload["name"]

    # List (admin)
    r = admin_session.get(f"{BASE_URL}/api/admin/instructors")
    assert r.status_code == 200
    ids = [i.get("instructor_id") or i.get("id") for i in r.json()]
    assert inst_id in ids

    # Update
    r = admin_session.put(f"{BASE_URL}/api/admin/instructors/{inst_id}", json={"name": "TEST_Instructor QA", "title": "Updated Title", "bio": "Test bio text"})
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "Updated Title"

    # Delete
    r = admin_session.delete(f"{BASE_URL}/api/admin/instructors/{inst_id}")
    assert r.status_code in (200, 204)

    # Verify gone
    r = admin_session.get(f"{BASE_URL}/api/admin/instructors")
    ids = [i.get("instructor_id") or i.get("id") for i in r.json()]
    assert inst_id not in ids
