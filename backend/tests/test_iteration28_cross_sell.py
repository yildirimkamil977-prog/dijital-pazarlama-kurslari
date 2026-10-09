"""Iteration 28: Cart cross-sell recommendations + admin cross_sell_ids persistence."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"

COURSE_SEO = "course_42e213ed6670"       # has cross_sell [4f638, 8b53e] per spec
COURSE_META = "course_4f638d946cb2"
COURSE_GADS = "course_8b53eae5576a"
GROUP_ID = "grp_741a4764d948"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def saved_state(admin_session):
    """Snapshot cross_sell_ids + sale_closed for restoration."""
    state = {}
    for cid in [COURSE_SEO, COURSE_META, COURSE_GADS]:
        r = admin_session.get(f"{BASE_URL}/api/admin/courses/{cid}")
        assert r.status_code == 200
        d = r.json()
        state[cid] = {"cross_sell_ids": d.get("cross_sell_ids", []), "sale_closed": d.get("sale_closed", False), "doc": d}
    r = admin_session.get(f"{BASE_URL}/api/admin/group-trainings/{GROUP_ID}")
    assert r.status_code == 200
    state[GROUP_ID] = {"cross_sell_ids": r.json().get("cross_sell_ids", []), "doc": r.json()}
    yield state
    # Restore spec target
    restore_course(admin_session, COURSE_SEO, cross_sell_ids=[COURSE_META, COURSE_GADS], sale_closed=False)
    restore_course(admin_session, COURSE_META, cross_sell_ids=[], sale_closed=False)
    restore_course(admin_session, COURSE_GADS, cross_sell_ids=[], sale_closed=False)
    restore_group(admin_session, GROUP_ID, cross_sell_ids=[])


def restore_course(sess, cid, cross_sell_ids=None, sale_closed=None):
    r = sess.get(f"{BASE_URL}/api/admin/courses/{cid}")
    if r.status_code != 200:
        return
    d = r.json()
    if cross_sell_ids is not None:
        d["cross_sell_ids"] = cross_sell_ids
    if sale_closed is not None:
        d["sale_closed"] = sale_closed
    d.pop("_id", None)
    sess.put(f"{BASE_URL}/api/admin/courses/{cid}", json=d)


def restore_group(sess, gid, cross_sell_ids=None):
    r = sess.get(f"{BASE_URL}/api/admin/group-trainings/{gid}")
    if r.status_code != 200:
        return
    d = r.json()
    if cross_sell_ids is not None:
        d["cross_sell_ids"] = cross_sell_ids
    d.pop("_id", None)
    d.pop("group_id", None)
    d.pop("slug", None)
    d.pop("created_at", None)
    d.pop("updated_at", None)
    d.pop("enrolled", None)
    sess.put(f"{BASE_URL}/api/admin/group-trainings/{GROUP_ID}", json=d)


# ---------- Recommendations endpoint ----------

def test_recs_empty_for_group_without_cross_sell(admin_session, saved_state):
    # First ensure group has no cross_sell
    restore_group(admin_session, GROUP_ID, cross_sell_ids=[])
    r = requests.get(f"{BASE_URL}/api/recommendations", params={"ids": GROUP_ID})
    assert r.status_code == 200
    assert r.json() == []


def test_recs_empty_ids_returns_empty():
    r = requests.get(f"{BASE_URL}/api/recommendations", params={"ids": ""})
    assert r.status_code == 200
    assert r.json() == []


def test_recs_course_seo_default_cross_sell(admin_session, saved_state):
    # Ensure spec state
    restore_course(admin_session, COURSE_SEO, cross_sell_ids=[COURSE_META, COURSE_GADS], sale_closed=False)
    restore_course(admin_session, COURSE_META, cross_sell_ids=[], sale_closed=False)
    restore_course(admin_session, COURSE_GADS, cross_sell_ids=[], sale_closed=False)
    r = requests.get(f"{BASE_URL}/api/recommendations", params={"ids": COURSE_SEO})
    assert r.status_code == 200
    data = r.json()
    ids = [x["course_id"] for x in data]
    assert COURSE_META in ids and COURSE_GADS in ids
    for item in data:
        assert item["kind"] == "course"
        assert item["price"] > 0
        assert "bundle_price" in item and "bundle_pct" in item


def test_recs_excludes_sale_closed(admin_session, saved_state):
    restore_course(admin_session, COURSE_SEO, cross_sell_ids=[COURSE_META, COURSE_GADS])
    restore_course(admin_session, COURSE_GADS, sale_closed=True)
    try:
        r = requests.get(f"{BASE_URL}/api/recommendations", params={"ids": COURSE_SEO})
        assert r.status_code == 200
        ids = [x["course_id"] for x in r.json()]
        assert COURSE_GADS not in ids
        assert COURSE_META in ids
    finally:
        restore_course(admin_session, COURSE_GADS, sale_closed=False)


def test_recs_excludes_already_in_cart(admin_session, saved_state):
    restore_course(admin_session, COURSE_SEO, cross_sell_ids=[COURSE_META, COURSE_GADS])
    r = requests.get(f"{BASE_URL}/api/recommendations", params={"ids": f"{COURSE_SEO},{COURSE_META}"})
    assert r.status_code == 200
    ids = [x["course_id"] for x in r.json()]
    assert COURSE_META not in ids
    assert COURSE_GADS in ids


def test_recs_group_cross_sell_with_course(admin_session, saved_state):
    # Set group cross_sell to COURSE_META
    restore_group(admin_session, GROUP_ID, cross_sell_ids=[COURSE_META])
    r = requests.get(f"{BASE_URL}/api/recommendations", params={"ids": GROUP_ID})
    assert r.status_code == 200
    data = r.json()
    assert any(x["course_id"] == COURSE_META and x["kind"] == "course" for x in data)
    restore_group(admin_session, GROUP_ID, cross_sell_ids=[])


def test_recs_course_cross_sell_to_group_returns_kind_group(admin_session, saved_state):
    restore_course(admin_session, COURSE_META, cross_sell_ids=[GROUP_ID])
    try:
        r = requests.get(f"{BASE_URL}/api/recommendations", params={"ids": COURSE_META})
        assert r.status_code == 200
        data = r.json()
        g = next((x for x in data if x["course_id"] == GROUP_ID), None)
        assert g is not None, f"expected group in recs, got {data}"
        assert g["kind"] == "group"
        assert g["group_id"] == GROUP_ID
        assert g["price"] > 0
    finally:
        restore_course(admin_session, COURSE_META, cross_sell_ids=[])


# ---------- Admin persistence ----------

def test_admin_course_cross_sell_persists(admin_session, saved_state):
    restore_course(admin_session, COURSE_META, cross_sell_ids=[COURSE_GADS, GROUP_ID])
    r = admin_session.get(f"{BASE_URL}/api/admin/courses/{COURSE_META}")
    assert r.status_code == 200
    assert set(r.json().get("cross_sell_ids", [])) == {COURSE_GADS, GROUP_ID}
    restore_course(admin_session, COURSE_META, cross_sell_ids=[])


def test_admin_group_cross_sell_persists(admin_session, saved_state):
    restore_group(admin_session, GROUP_ID, cross_sell_ids=[COURSE_SEO, COURSE_META])
    r = admin_session.get(f"{BASE_URL}/api/admin/group-trainings/{GROUP_ID}")
    assert r.status_code == 200
    assert set(r.json().get("cross_sell_ids", [])) == {COURSE_SEO, COURSE_META}
    restore_group(admin_session, GROUP_ID, cross_sell_ids=[])
