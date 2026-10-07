"""Iteration 20: SEO + Rich description long_description + auth/session + webp uploads."""
import os
import json
import re
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASS = "Admin!2026Panel"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def course_slug():
    r = requests.get(f"{API}/courses")
    assert r.status_code == 200
    cs = r.json()
    assert cs
    return cs[0]["slug"]


@pytest.fixture(scope="module")
def group_slug():
    r = requests.get(f"{API}/group-trainings")
    assert r.status_code == 200
    gs = r.json()
    assert gs
    return gs[0]["slug"]


# --- Auth session ---

def test_session_anon():
    r = requests.get(f"{API}/auth/session")
    assert r.status_code == 200
    assert r.json() == {"user": None}


def test_session_logged_in(admin_session):
    r = admin_session.get(f"{API}/auth/session")
    assert r.status_code == 200
    j = r.json()
    assert j.get("user") and j["user"]["email"] == ADMIN_EMAIL


def test_logout_and_relogin():
    s = requests.Session()
    s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    r = s.post(f"{API}/auth/logout")
    assert r.status_code in (200, 204)
    r2 = s.get(f"{API}/auth/session")
    assert r2.json() == {"user": None}


# --- SEO meta ---

def test_seo_meta_course(course_slug):
    r = requests.get(f"{API}/seo/meta", params={"path": f"/kurslar/{course_slug}"})
    assert r.status_code == 200
    d = r.json()
    assert d["title"] and d["description"] and d["canonical"].endswith(f"/kurslar/{course_slug}")
    jl = d.get("jsonld") or []
    assert jl
    types = [j.get("@type") for j in jl]
    assert "Course" in types
    assert "BreadcrumbList" in types
    course = next(j for j in jl if j.get("@type") == "Course")
    assert "offers" in course and course["offers"]["priceCurrency"] == "TRY"
    assert "provider" in course
    assert "hasCourseInstance" in course


def test_seo_meta_group(group_slug):
    r = requests.get(f"{API}/seo/meta", params={"path": f"/canli-grup-egitimleri/{group_slug}"})
    assert r.status_code == 200
    d = r.json()
    types = [j.get("@type") for j in d["jsonld"]]
    assert "Course" in types
    assert "EducationEvent" in types
    assert "BreadcrumbList" in types


def test_seo_meta_list_pages():
    for p in ["/", "/kurslar", "/canli-grup-egitimleri"]:
        r = requests.get(f"{API}/seo/meta", params={"path": p})
        assert r.status_code == 200, p
        d = r.json()
        assert d["title"] and d["canonical"]


# --- SEO HTML ---

def test_seo_html_course(course_slug):
    r = requests.get(f"{API}/seo/html", params={"path": f"/kurslar/{course_slug}"})
    assert r.status_code == 200
    h = r.text
    assert "<title>" in h
    assert 'name="description"' in h
    assert 'rel="canonical"' in h
    assert 'property="og:title"' in h
    assert 'id="seo-jsonld"' in h
    assert "window.__INITIAL__" in h
    # H1 prerendered in #root
    root = re.search(r'<div id="root">(.*?)</div></main>', h, re.S)
    assert root, "root pre-render not found"
    assert "<h1" in root.group(1)
    # Validate JSON-LD JSON
    m = re.search(r'<script type="application/ld\+json" id="seo-jsonld">(.*?)</script>', h, re.S)
    assert m
    data = json.loads(m.group(1))
    assert isinstance(data, list) and data


def test_seo_html_group(group_slug):
    r = requests.get(f"{API}/seo/html", params={"path": f"/canli-grup-egitimleri/{group_slug}"})
    assert r.status_code == 200
    h = r.text
    assert "<h1" in h
    assert 'id="seo-jsonld"' in h


def test_seo_html_unknown_404():
    r = requests.get(f"{API}/seo/html", params={"path": "/kurslar/does-not-exist-xyz"})
    assert r.status_code == 404
    assert "noindex" in r.text


# --- Sitemap & robots ---

def test_sitemap(course_slug, group_slug):
    r = requests.get(f"{API}/seo/sitemap.xml")
    assert r.status_code == 200
    assert "application/xml" in r.headers.get("content-type", "")
    body = r.text
    assert f"/kurslar/{course_slug}" in body
    assert f"/canli-grup-egitimleri/{group_slug}" in body
    assert "/egitmen/" in body


def test_robots():
    r = requests.get(f"{API}/seo/robots.txt")
    assert r.status_code == 200
    b = r.text
    assert "User-agent: *" in b
    assert re.search(r"Sitemap:\s*https?://", b)


# --- Long description for course ---

def test_course_long_description_roundtrip(admin_session, course_slug):
    # Fetch admin course
    r = admin_session.get(f"{API}/admin/courses")
    assert r.status_code == 200
    courses = r.json()
    c = next((x for x in courses if x["slug"] == course_slug), None)
    assert c, "course not found in admin list"
    original = c.get("long_description", "")
    cid = c.get("id") or c.get("course_id")
    try:
        new_html = "<h2>Başlık</h2><p><strong>Kalın</strong> metin.</p><ul><li>madde 1</li><li>madde 2</li></ul>"
        payload = {**c, "long_description": new_html}
        up = admin_session.put(f"{API}/admin/courses/{cid}", json=payload)
        assert up.status_code == 200, up.text
        # Verify via public endpoint
        pub = requests.get(f"{API}/courses/{course_slug}")
        assert pub.status_code == 200
        assert "<h2>Başlık</h2>" in pub.json().get("long_description", "")
    finally:
        admin_session.put(f"{API}/admin/courses/{cid}", json={**c, "long_description": original})


def test_group_long_description_roundtrip(admin_session, group_slug):
    r = admin_session.get(f"{API}/admin/group-trainings")
    assert r.status_code == 200
    gs = r.json()
    g = next((x for x in gs if x["slug"] == group_slug), None)
    assert g
    original = g.get("long_description", "")
    gid = g.get("id") or g.get("group_id") or g.get("training_id")
    try:
        new_html = "<h2>Grup Başlık</h2><p>İçerik</p>"
        payload = {**g, "long_description": new_html}
        up = admin_session.put(f"{API}/admin/group-trainings/{gid}", json=payload)
        assert up.status_code == 200, up.text
        pub = requests.get(f"{API}/group-trainings/{group_slug}")
        assert pub.status_code == 200
        assert "<h2>Grup Başlık</h2>" in pub.json().get("long_description", "")
    finally:
        admin_session.put(f"{API}/admin/group-trainings/{gid}", json={**g, "long_description": original})


# --- WebP upload + resize ---

def test_image_upload_webp(admin_session):
    # Minimal PNG (1x1 red)
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0"
        b"\x00\x00\x00\x03\x00\x01[\xa0\xc3\x1f\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    files = {"file": ("t.png", png, "image/png")}
    r = admin_session.post(f"{API}/admin/upload-image", files=files)
    if r.status_code == 404:
        # try alternate route
        r = admin_session.post(f"{API}/admin/upload", files=files)
    assert r.status_code == 200, r.text
    j = r.json()
    url = j.get("url") or j.get("path") or ""
    assert url, j
    # fetch resized
    full = url if url.startswith("http") else f"{BASE}{url}"
    r2 = requests.get(f"{full}?w=400")
    assert r2.status_code == 200
    ct = r2.headers.get("content-type", "")
    assert "webp" in ct, f"expected webp, got {ct}"
    # cleanup
    img_id = url.split("/")[-1]
    try:
        admin_session.delete(f"{API}/admin/uploads/{img_id}")
    except Exception:
        pass
