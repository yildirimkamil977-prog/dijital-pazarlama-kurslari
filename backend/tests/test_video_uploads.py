"""Tests for admin video upload + testimonials YouTube Shorts handling (iteration 19)."""
import os
import io
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for local
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"

# Minimal valid-ish MP4 bytes (ftyp box)
MP4_BYTES = (
    b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41"
    + b"\x00\x00\x00\x08free"
    + b"\x00" * 256
)


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def original_testimonials(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/settings")
    assert r.status_code == 200
    return r.json().get("testimonials", [])


def test_upload_image_still_works(admin_session):
    png = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)
    files = {"file": ("x.png", io.BytesIO(png), "image/png")}
    r = admin_session.post(f"{BASE_URL}/api/admin/upload-image", files=files)
    assert r.status_code == 200, r.text[:200]
    url = r.json().get("url", "")
    assert url.startswith("/api/uploads/img_")
    # Fetch it back
    g = requests.get(f"{BASE_URL}{url}")
    assert g.status_code == 200
    assert g.headers.get("content-type", "").startswith("image/")


def test_upload_video_rejects_non_video(admin_session):
    files = {"file": ("x.txt", io.BytesIO(b"hello"), "text/plain")}
    r = admin_session.post(f"{BASE_URL}/api/admin/upload-video", files=files)
    assert r.status_code == 400, r.text[:200]


def test_upload_video_requires_admin():
    files = {"file": ("x.mp4", io.BytesIO(MP4_BYTES), "video/mp4")}
    r = requests.post(f"{BASE_URL}/api/admin/upload-video", files=files)
    assert r.status_code in (401, 403)


UPLOADED_URL = {}


def test_upload_video_success(admin_session):
    files = {"file": ("test.mp4", io.BytesIO(MP4_BYTES), "video/mp4")}
    r = admin_session.post(f"{BASE_URL}/api/admin/upload-video", files=files)
    assert r.status_code == 200, r.text[:300]
    url = r.json().get("url", "")
    assert url.startswith("/api/uploads/vid_"), url
    UPLOADED_URL["url"] = url


def test_uploaded_video_get_full(admin_session):
    url = UPLOADED_URL.get("url")
    assert url
    r = requests.get(f"{BASE_URL}{url}")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("video/")
    assert r.headers.get("accept-ranges") == "bytes"
    assert len(r.content) == len(MP4_BYTES)


def test_uploaded_video_range_request():
    url = UPLOADED_URL.get("url")
    assert url
    r = requests.get(f"{BASE_URL}{url}", headers={"Range": "bytes=0-15"})
    assert r.status_code == 206, f"{r.status_code} {r.text[:100]}"
    cr = r.headers.get("content-range", "")
    assert cr.startswith("bytes 0-15/"), cr
    assert len(r.content) == 16


def test_testimonial_with_shorts_url_saves(admin_session, original_testimonials):
    shorts_url = "https://youtube.com/shorts/dQw4w9WgXcQ"
    new_list = list(original_testimonials) + [{
        "name": "TEST_Shorts User",
        "role": "Tester",
        "quote": "Harika",
        "video_url": shorts_url,
        "thumbnail": "",
        "rating": 5,
        "course_id": "",
    }]
    r = admin_session.put(f"{BASE_URL}/api/admin/settings/testimonials", json=new_list)
    assert r.status_code == 200, r.text[:300]
    # Verify persistence
    g = admin_session.get(f"{BASE_URL}/api/admin/settings")
    saved = g.json().get("testimonials", [])
    assert any(t.get("video_url") == shorts_url and t.get("name") == "TEST_Shorts User" for t in saved)


def test_restore_original_testimonials(admin_session, original_testimonials):
    r = admin_session.put(f"{BASE_URL}/api/admin/settings/testimonials", json=original_testimonials)
    assert r.status_code == 200
    g = admin_session.get(f"{BASE_URL}/api/admin/settings")
    assert len(g.json().get("testimonials", [])) == len(original_testimonials)
