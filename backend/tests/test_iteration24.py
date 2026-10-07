"""Iteration 24 — validate-discount guest access regression.

Fix in review: /api/payments/validate-discount should NOT require login so that
guest visitors (clicking launch email ?kod=CODE link) can get the code auto-applied
at /odeme before completing the customer form.
"""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"

TMP_CODE = "TMPLAUNCH10"
TMP_RESTRICTED = "TMPRESTRICT10"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def guest_session():
    return requests.Session()


@pytest.fixture(scope="module")
def published_course(admin_session):
    r = admin_session.get(f"{API}/courses", timeout=20)
    assert r.status_code == 200
    for c in r.json():
        if c.get("is_published") and not c.get("sale_closed"):
            return c
    pytest.skip("No published, open-sale course available")


@pytest.fixture(scope="module")
def another_course(admin_session, published_course):
    r = admin_session.get(f"{API}/courses", timeout=20)
    for c in r.json():
        if c.get("course_id") != published_course["course_id"] and c.get("is_published"):
            return c
    return published_course  # fallback


@pytest.fixture(scope="module")
def temp_codes(admin_session, another_course):
    # Clean up any leftovers first
    admin_session.delete(f"{API}/admin/discounts/{TMP_CODE}", timeout=20)
    admin_session.delete(f"{API}/admin/discounts/{TMP_RESTRICTED}", timeout=20)
    # Open 10% code
    r1 = admin_session.post(f"{API}/admin/discounts", json={
        "code": TMP_CODE, "type": "percent", "value": 10, "active": True,
    }, timeout=20)
    assert r1.status_code in (200, 201), f"create code failed: {r1.status_code} {r1.text}"
    # Restricted code (only for another_course)
    r2 = admin_session.post(f"{API}/admin/discounts", json={
        "code": TMP_RESTRICTED, "type": "percent", "value": 15, "active": True,
        "course_ids": [another_course["course_id"]],
    }, timeout=20)
    assert r2.status_code in (200, 201), f"create restricted failed: {r2.status_code} {r2.text}"
    yield
    # cleanup
    admin_session.delete(f"{API}/admin/discounts/{TMP_CODE}", timeout=20)
    admin_session.delete(f"{API}/admin/discounts/{TMP_RESTRICTED}", timeout=20)


# --- Guest validate-discount (the fix) ---------------------------------------

def test_guest_validate_discount_open_code(guest_session, temp_codes, published_course):
    """Guest (no auth) can validate an open discount code."""
    r = guest_session.post(f"{API}/payments/validate-discount", json={
        "code": TMP_CODE, "subtotal": 1000.0,
        "items": [{"course_id": published_course["course_id"], "price": 1000.0}],
    }, timeout=20)
    assert r.status_code == 200, f"guest validate failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["code"] == TMP_CODE
    assert data["type"] == "percent"
    assert data["value"] == 10
    assert data["discount"] == 100.0
    assert data["total"] == 900.0


def test_guest_validate_invalid_code_returns_400(guest_session):
    r = guest_session.post(f"{API}/payments/validate-discount", json={
        "code": "NOPE_DOES_NOT_EXIST_XYZ", "subtotal": 500.0, "items": [],
    }, timeout=20)
    assert r.status_code == 400


def test_guest_validate_restricted_code_rejected_for_other_course(
    guest_session, temp_codes, published_course, another_course
):
    """A code restricted to course B must not apply when cart contains only course A."""
    if published_course["course_id"] == another_course["course_id"]:
        pytest.skip("Only one published course available; cannot verify restriction")
    r = guest_session.post(f"{API}/payments/validate-discount", json={
        "code": TMP_RESTRICTED, "subtotal": 1000.0,
        "items": [{"course_id": published_course["course_id"], "price": 1000.0}],
    }, timeout=20)
    assert r.status_code == 400
    assert "geçerli değil" in r.text.lower() or "geçerli" in r.text.lower()


def test_guest_validate_restricted_code_accepted_for_target_course(
    guest_session, temp_codes, another_course
):
    r = guest_session.post(f"{API}/payments/validate-discount", json={
        "code": TMP_RESTRICTED, "subtotal": 500.0,
        "items": [{"course_id": another_course["course_id"], "price": 500.0}],
    }, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["code"] == TMP_RESTRICTED
    assert data["discount"] == 75.0  # 15% of 500
    assert data["total"] == 425.0


# --- Logged-in admin regression ----------------------------------------------

def test_admin_validate_discount_still_works(admin_session, temp_codes, published_course):
    r = admin_session.post(f"{API}/payments/validate-discount", json={
        "code": TMP_CODE, "subtotal": 2000.0,
        "items": [{"course_id": published_course["course_id"], "price": 2000.0}],
    }, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["code"] == TMP_CODE
    assert data["discount"] == 200.0
    assert data["total"] == 1800.0
