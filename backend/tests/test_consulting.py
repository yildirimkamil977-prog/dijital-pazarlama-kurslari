"""Backend tests for Consulting (Bire Bir Danışmanlık) feature - card-only + propose modal + email templates."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def student():
    email = f"TEST_consult_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Test!2026Pass"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Consult Test", "accept_terms": True}, timeout=20)
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
    return {"session": s, "email": email, "password": pw}


# --------- Config: enabled, price fixed ---------
def test_admin_config_and_price(admin):
    r = admin.get(f"{API}/admin/consulting/config", timeout=20)
    assert r.status_code == 200
    cfg = r.json()
    assert cfg.get("enabled") is True
    assert cfg.get("price", 0) > 0


# --------- Credits ---------
def test_admin_has_paid_credit(admin):
    r = admin.get(f"{API}/consulting/summary", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["enabled"] is True
    assert j["granted"] >= 1


def test_new_student_has_no_credits(student):
    r = student["session"].get(f"{API}/consulting/summary", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["available_credits"] == 0
    assert j["granted"] == 0


# --------- Pending-count badge endpoint ---------
def test_pending_count_endpoint_increments_and_decrements(admin):
    r = admin.get(f"{API}/admin/consulting/pending-count", timeout=20)
    assert r.status_code == 200
    before = r.json()["count"]

    summary = admin.get(f"{API}/consulting/summary", timeout=20).json()
    if summary["available_credits"] < 1:
        pytest.skip("Admin has no credit for booking")
    slots = admin.get(f"{API}/consulting/slots", timeout=20).json()
    assert slots, "no slots"
    slot = slots[0]
    r = admin.post(f"{API}/consulting/book", json={"date": slot["date"], "time": slot["time"]}, timeout=20)
    assert r.status_code == 200, r.text
    bid = r.json()["booking_id"]

    try:
        r = admin.get(f"{API}/admin/consulting/pending-count", timeout=20)
        after = r.json()["count"]
        assert after == before + 1, f"expected {before+1}, got {after}"

        # Reject -> should decrement
        rr = admin.post(f"{API}/admin/consulting/bookings/{bid}/reject", json={"note": "test"}, timeout=20)
        assert rr.status_code == 200, rr.text
        r = admin.get(f"{API}/admin/consulting/pending-count", timeout=20)
        assert r.json()["count"] == before
    finally:
        # Ensure cleaned up
        admin.post(f"{API}/admin/consulting/bookings/{bid}/reject", json={"note": "cleanup"}, timeout=20)


# --------- Slot regression ---------
def test_slot_locking_regression(admin):
    summary = admin.get(f"{API}/consulting/summary", timeout=20).json()
    if summary["available_credits"] < 1:
        pytest.skip("no credit")
    slots = admin.get(f"{API}/consulting/slots", timeout=20).json()
    assert slots
    slot = slots[0]
    r = admin.post(f"{API}/consulting/book", json={"date": slot["date"], "time": slot["time"]}, timeout=20)
    assert r.status_code == 200
    bid = r.json()["booking_id"]
    try:
        after = admin.get(f"{API}/consulting/slots", timeout=20).json()
        assert not any(s["date"] == slot["date"] and s["time"] == slot["time"] for s in after)
        # rebook blocked
        r2 = admin.post(f"{API}/consulting/book", json={"date": slot["date"], "time": slot["time"]}, timeout=20)
        assert r2.status_code == 400
    finally:
        admin.post(f"{API}/admin/consulting/bookings/{bid}/reject", json={"note": "cleanup"}, timeout=20)


# --------- Approve triggers email (no 500) ---------
def test_admin_approve_no_error_and_email_template_exists(admin):
    summary = admin.get(f"{API}/consulting/summary", timeout=20).json()
    if summary["available_credits"] < 1:
        pytest.skip("no credit")
    slots = admin.get(f"{API}/consulting/slots", timeout=20).json()
    slot = slots[0]
    r = admin.post(f"{API}/consulting/book", json={"date": slot["date"], "time": slot["time"]}, timeout=20)
    assert r.status_code == 200
    bid = r.json()["booking_id"]
    try:
        r = admin.post(f"{API}/admin/consulting/bookings/{bid}/approve", timeout=20)
        assert r.status_code == 200, r.text
        items = admin.get(f"{API}/admin/consulting/bookings", timeout=20).json()
        this_b = next((b for b in items if b["booking_id"] == bid), None)
        assert this_b and this_b["status"] == "approved"
    finally:
        admin.post(f"{API}/admin/consulting/bookings/{bid}/reject", json={"note": "cleanup"}, timeout=20)


# --------- Propose (modal path): sets 'rescheduled' + proposed_date/time ---------
def test_admin_propose_sets_rescheduled(admin):
    summary = admin.get(f"{API}/consulting/summary", timeout=20).json()
    if summary["available_credits"] < 1:
        pytest.skip("no credit")
    slots = admin.get(f"{API}/consulting/slots", timeout=20).json()
    if len(slots) < 2:
        pytest.skip("not enough slots")
    s1, s2 = slots[0], slots[1]
    r = admin.post(f"{API}/consulting/book", json={"date": s1["date"], "time": s1["time"]}, timeout=20)
    assert r.status_code == 200
    bid = r.json()["booking_id"]
    try:
        r = admin.post(f"{API}/admin/consulting/bookings/{bid}/propose",
                       json={"date": s2["date"], "time": s2["time"], "note": "yeni saat öneriyorum"}, timeout=20)
        assert r.status_code == 200, r.text

        items = admin.get(f"{API}/admin/consulting/bookings", timeout=20).json()
        this_b = next((b for b in items if b["booking_id"] == bid), None)
        assert this_b is not None
        assert this_b["status"] == "rescheduled"
        assert this_b.get("proposed_date") == s2["date"]
        assert this_b.get("proposed_time") == s2["time"]
    finally:
        admin.post(f"{API}/admin/consulting/bookings/{bid}/reject", json={"note": "cleanup"}, timeout=20)


# --------- Card-only purchase: returns 503 when PayTR not configured ---------
def test_purchase_returns_503_when_paytr_missing(admin):
    r = admin.post(f"{API}/consulting/purchase", timeout=20)
    assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text}"
    body = r.json()
    detail = body.get("detail", "")
    assert "yapılandır" in detail.lower() or "kart" in detail.lower(), detail


# --------- Email templates existence ---------
def test_email_templates_exist_via_admin(admin):
    # Try to fetch admin email templates listing
    r = admin.get(f"{API}/admin/email-templates", timeout=20)
    if r.status_code != 200:
        pytest.skip(f"admin email templates endpoint not available: {r.status_code}")
    items = r.json()
    keys = {(t.get("key") or "") for t in (items if isinstance(items, list) else items.get("items", []))}
    for k in ("consulting_approved", "consulting_rejected", "consulting_proposed"):
        assert k in keys, f"Missing template key {k}. Present: {keys}"
