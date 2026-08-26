"""Tests for Vimeo migration (bug: YouTube error 153 -> replaced with Vimeo).

Verifies:
- /api/my/courses/{id}/player returns vimeo.com video_url for enrolled admin
- Non-enrolled user gets 403 on player endpoint
- Public course endpoints don't return youtube.com for demo Meta course
- Content settings return vimeo hero_video_url
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PWD = "Admin!2026Panel"
META_COURSE_ID = "course_4f638d946cb2"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def guest_session():
    s = requests.Session()
    email = f"TEST_nonenr_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Passw0rd!123", "name": "Test NonEnr", "accept_terms": True
    })
    assert r.status_code in (200, 201), r.text
    return s


def test_player_returns_vimeo_for_enrolled(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/my/courses/{META_COURSE_ID}/player")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["course_id"] == META_COURSE_ID
    lessons = [l for m in data["modules"] for l in m["lessons"]]
    assert len(lessons) >= 1
    for l in lessons:
        assert "vimeo.com" in l["video_url"], f"Non-vimeo url: {l['video_url']}"
        assert "youtube" not in l["video_url"].lower()


def test_player_403_for_non_enrolled(guest_session):
    r = guest_session.get(f"{BASE_URL}/api/my/courses/{META_COURSE_ID}/player")
    assert r.status_code == 403


def test_content_hero_video_is_vimeo():
    r = requests.get(f"{BASE_URL}/api/settings/public")
    assert r.status_code == 200
    data = r.json()
    hero = data.get("hero_video_url", "")
    if hero:
        assert "vimeo.com" in hero
        assert "youtube" not in hero.lower()
    # testimonials - skip test-pollution names (Ali, Ayşe from test_iteration2)
    for t in data.get("testimonials", []):
        if t.get("name") in ("Ali", "Ayşe"):
            continue
        vu = t.get("video_url", "")
        if vu:
            assert "vimeo.com" in vu, f"testimonial: {vu}"


def test_public_course_preview_lessons_no_youtube(admin_session):
    """Preview lessons exposed publicly should not be youtube for demo Meta course."""
    # find slug via admin course list
    r = admin_session.get(f"{BASE_URL}/api/admin/courses/{META_COURSE_ID}")
    if r.status_code != 200:
        pytest.skip("cannot resolve slug")
    slug = r.json().get("slug")
    if not slug:
        pytest.skip("no slug")
    r = requests.get(f"{BASE_URL}/api/courses/{slug}")
    assert r.status_code == 200
    data = r.json()
    for m in data.get("curriculum", []) or data.get("modules", []):
        for l in m.get("lessons", []):
            vu = l.get("video_url", "")
            if vu:
                assert "youtube" not in vu.lower(), f"Preview lesson still youtube: {vu}"
