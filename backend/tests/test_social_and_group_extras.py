"""Backend tests for instructor social_links + group-trainings extras (what_you_learn, requirements, reviews, meet_link privacy)."""
import os
import secrets
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASS = "Admin!2026Panel"
SEED_SLUG = "google-ads-canli-grup-egitimi"
SEED_INSTRUCTOR_SLUG = "kamil-yildirim"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- Group detail: what_you_learn, requirements, reviews, meet_link privacy ----------
def test_group_detail_has_extras_and_hides_meet_link():
    r = requests.get(f"{API}/group-trainings/{SEED_SLUG}", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    # what_you_learn (6) & requirements (3)
    wyl = d.get("what_you_learn", [])
    reqs = d.get("requirements", [])
    assert isinstance(wyl, list) and len(wyl) == 6, f"expected 6 what_you_learn items, got {len(wyl)}: {wyl}"
    assert isinstance(reqs, list) and len(reqs) == 3, f"expected 3 requirements, got {len(reqs)}: {reqs}"
    # reviews array
    assert "reviews" in d and isinstance(d["reviews"], list)
    # meet_link must NOT be exposed on any lesson in public detail
    for l in d.get("lessons", []):
        assert "meet_link" not in l, f"meet_link should not be exposed publicly: {l}"
    # instructor.social_links present
    inst = d.get("instructor") or {}
    sl = inst.get("social_links") or {}
    assert isinstance(sl, dict)
    for k in ("instagram", "linkedin", "youtube", "website"):
        assert k in sl and sl[k], f"expected social link {k} in {sl}"


# ---------- Instructor social_links via /api/instructors ----------
def test_public_instructors_list_has_social_links():
    r = requests.get(f"{API}/instructors", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    kamil = next((x for x in data if x.get("slug") == SEED_INSTRUCTOR_SLUG), None)
    assert kamil is not None, f"seed instructor missing from list"
    sl = kamil.get("social_links") or {}
    assert isinstance(sl, dict)
    for k in ("instagram", "linkedin", "youtube", "website"):
        assert sl.get(k), f"missing {k} in social_links={sl}"


def test_video_elearning_instructors_have_social_links():
    """Public instructor detail (using seed slug) exposes social_links."""
    r = requests.get(f"{API}/instructors/{SEED_INSTRUCTOR_SLUG}", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "social_links" in d and isinstance(d["social_links"], dict)
    sl = d["social_links"]
    for k in ("instagram", "linkedin", "youtube", "website"):
        assert sl.get(k), f"missing {k} in {sl}"


def test_courses_video_elearning_instructor_card_has_social_links():
    """A published course detail should include instructor with social_links."""
    lst = requests.get(f"{API}/courses", timeout=15).json()
    assert isinstance(lst, list) and lst, "no courses returned"
    # pick a course whose instructor is the seed instructor if possible
    slug = None
    for c in lst:
        if c.get("instructor", {}).get("slug") == SEED_INSTRUCTOR_SLUG or c.get("instructor_slug") == SEED_INSTRUCTOR_SLUG:
            slug = c.get("slug")
            break
    slug = slug or lst[0].get("slug")
    r = requests.get(f"{API}/courses/{slug}", timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    inst = d.get("instructor") or {}
    assert isinstance(inst, dict), f"no instructor in course detail: {d.keys()}"
    assert "social_links" in inst, f"instructor missing social_links: {inst}"


# ---------- Admin CRUD instructor social_links persist ----------
def test_admin_create_instructor_with_social_links_persists(admin_session):
    tag = secrets.token_hex(3)
    payload = {
        "name": f"TEST Instructor {tag}",
        "title": "Tester",
        "bio": "test bio",
        "avatar": "",
        "social_links": {
            "instagram": "https://instagram.com/test",
            "linkedin": "https://linkedin.com/in/test",
            "youtube": "https://youtube.com/@test",
            "x": "https://x.com/test",
            "facebook": "",
            "tiktok": "",
            "website": "https://example.com",
        },
    }
    r = admin_session.post(f"{API}/admin/instructors", json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    inst_id = body.get("instructor_id")
    slug = body.get("slug")
    assert inst_id and slug
    # Response should include social_links
    assert (body.get("social_links") or {}).get("instagram") == "https://instagram.com/test"

    try:
        # Verify persistence via GET /api/instructors (public)
        pub = requests.get(f"{API}/instructors", timeout=15).json()
        found = next((x for x in pub if x.get("slug") == slug), None)
        assert found is not None, "created instructor not returned publicly"
        sl = found.get("social_links") or {}
        assert sl.get("instagram") == "https://instagram.com/test"
        assert sl.get("linkedin") == "https://linkedin.com/in/test"
        assert sl.get("youtube") == "https://youtube.com/@test"
        assert sl.get("website") == "https://example.com"

        # GET public detail /api/instructors/{slug} exposes social_links
        detail = requests.get(f"{API}/instructors/{slug}", timeout=15)
        assert detail.status_code == 200, detail.text
        assert (detail.json().get("social_links") or {}).get("instagram") == "https://instagram.com/test"

        # PUT update
        payload["social_links"]["instagram"] = "https://instagram.com/updated"
        rr = admin_session.put(f"{API}/admin/instructors/{inst_id}", json=payload, timeout=15)
        assert rr.status_code == 200, rr.text
        assert (rr.json().get("social_links") or {}).get("instagram") == "https://instagram.com/updated"

        pub2 = requests.get(f"{API}/instructors", timeout=15).json()
        found2 = next((x for x in pub2 if x.get("slug") == slug), None)
        assert (found2.get("social_links") or {}).get("instagram") == "https://instagram.com/updated"
    finally:
        admin_session.delete(f"{API}/admin/instructors/{inst_id}", timeout=10)
