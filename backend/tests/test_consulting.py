"""Backend tests for Consulting (Bire Bir Danışmanlık) feature."""
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
    # Register a fresh student
    email = f"TEST_consult_{uuid.uuid4().hex[:8]}@example.com"
    pw = "Test!2026Pass"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Consult Test", "accept_terms": True}, timeout=20)
    assert r.status_code in (200, 201), f"Register failed: {r.status_code} {r.text}"
    return {"session": s, "email": email, "password": pw}


# ---------------- Admin config -----------------
def test_admin_get_and_set_config(admin):
    r = admin.get(f"{API}/admin/consulting/config", timeout=20)
    assert r.status_code == 200
    cfg = r.json()
    assert "enabled" in cfg and "price" in cfg and "weekly" in cfg

    new_cfg = {"enabled": True, "price": 750, "weekly": {"0": [{"start": "10:00", "end": "13:00"}], "2": [{"start": "14:00", "end": "16:00"}]}}
    r = admin.put(f"{API}/admin/consulting/config", json=new_cfg, timeout=20)
    assert r.status_code == 200

    r = admin.get(f"{API}/admin/consulting/config", timeout=20)
    j = r.json()
    assert j["enabled"] is True
    assert j["price"] == 750
    assert j["weekly"].get("0") == [{"start": "10:00", "end": "13:00"}]
    assert j["weekly"].get("2") == [{"start": "14:00", "end": "16:00"}]


# --------------- Credits -----------------------
def test_admin_has_paid_credit(admin):
    r = admin.get(f"{API}/consulting/summary", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["enabled"] is True
    # Admin has 1 PAID course enrollment per handoff
    assert j["granted"] >= 1
    assert j["available_credits"] == max(0, j["granted"] - j["used"])


def test_new_student_has_no_credits(student):
    r = student["session"].get(f"{API}/consulting/summary", timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["available_credits"] == 0
    assert j["granted"] == 0


# --------------- Slots -------------------------
def test_slots_generated_for_monday_wednesday(admin):
    r = admin.get(f"{API}/consulting/slots", timeout=20)
    assert r.status_code == 200
    slots = r.json()
    assert isinstance(slots, list) and len(slots) > 0
    # All slot times should be hour boundaries and within the configured ranges
    for s in slots:
        assert s["time"].endswith(":00")
        hh = int(s["time"].split(":")[0])
        # weekday is TR name, derived from date; validate hour ranges by (weekday-of-date)
    # Verify a specific expected date/time exists in next 4 weeks (some Monday 10:00 or Wed 14:00)
    hours_by_wd = {}
    from datetime import date, datetime
    for s in slots:
        d = datetime.fromisoformat(s["date"]).date()
        hours_by_wd.setdefault(d.weekday(), set()).add(s["time"])
    if 0 in hours_by_wd:
        assert hours_by_wd[0].issubset({"10:00", "11:00", "12:00"})
    if 2 in hours_by_wd:
        assert hours_by_wd[2].issubset({"14:00", "15:00"})


# --------------- Booking flow ------------------
def test_no_credit_student_cannot_book(student, admin):
    # Grab a slot
    r = admin.get(f"{API}/consulting/slots", timeout=20)
    slots = r.json()
    assert slots
    slot = slots[0]
    r = student["session"].post(f"{API}/consulting/book", json={"date": slot["date"], "time": slot["time"]}, timeout=20)
    assert r.status_code == 400
    assert "Kullanılabilir" in r.text or "hak" in r.text.lower()


def test_admin_book_removes_slot_and_consumes_credit_and_blocks_rebook(admin):
    summary_before = admin.get(f"{API}/consulting/summary", timeout=20).json()
    if summary_before["available_credits"] < 1:
        pytest.skip("Admin has no available credit to test booking")

    slots_before = admin.get(f"{API}/consulting/slots", timeout=20).json()
    assert slots_before
    slot = slots_before[0]

    r = admin.post(f"{API}/consulting/book", json={"date": slot["date"], "time": slot["time"]}, timeout=20)
    assert r.status_code == 200, r.text
    booking = r.json()
    booking_id = booking["booking_id"]
    assert booking["status"] == "pending"

    try:
        # Slot must be removed
        slots_after = admin.get(f"{API}/consulting/slots", timeout=20).json()
        assert not any(s["date"] == slot["date"] and s["time"] == slot["time"] for s in slots_after)

        # Credit consumed
        summary_after = admin.get(f"{API}/consulting/summary", timeout=20).json()
        assert summary_after["available_credits"] == summary_before["available_credits"] - 1

        # Rebook same slot must fail (either by no-credit or already-booked)
        r2 = admin.post(f"{API}/consulting/book", json={"date": slot["date"], "time": slot["time"]}, timeout=20)
        assert r2.status_code == 400

        # Admin approve flow
        r = admin.post(f"{API}/admin/consulting/bookings/{booking_id}/approve", timeout=20)
        assert r.status_code == 200

        items = admin.get(f"{API}/admin/consulting/bookings", timeout=20).json()
        this_b = next((b for b in items if b["booking_id"] == booking_id), None)
        assert this_b and this_b["status"] == "approved"
    finally:
        # Cleanup - directly reject to restore credit
        admin.post(f"{API}/admin/consulting/bookings/{booking_id}/reject", json={"note": "test cleanup"}, timeout=20)


# --------------- Propose / respond -------------
def test_admin_propose_and_student_flow(admin):
    # Need a fresh booking. Skip if admin credit is 0.
    summary = admin.get(f"{API}/consulting/summary", timeout=20).json()
    if summary["available_credits"] < 1:
        pytest.skip("No credits")
    slots = admin.get(f"{API}/consulting/slots", timeout=20).json()
    if len(slots) < 2:
        pytest.skip("Not enough slots")
    s1, s2 = slots[0], slots[1]
    r = admin.post(f"{API}/consulting/book", json={"date": s1["date"], "time": s1["time"]}, timeout=20)
    assert r.status_code == 200
    bid = r.json()["booking_id"]
    try:
        r = admin.post(f"{API}/admin/consulting/bookings/{bid}/propose",
                       json={"date": s2["date"], "time": s2["time"], "note": "yeni saat"}, timeout=20)
        assert r.status_code == 200
        # accept as same user
        r = admin.post(f"{API}/consulting/bookings/{bid}/respond", json={"action": "accept"}, timeout=20)
        assert r.status_code == 200
        items = admin.get(f"{API}/admin/consulting/bookings", timeout=20).json()
        this_b = next((b for b in items if b["booking_id"] == bid), None)
        assert this_b["status"] == "approved"
        assert this_b["date"] == s2["date"] and this_b["time"] == s2["time"]
    finally:
        admin.post(f"{API}/admin/consulting/bookings/{bid}/reject", json={"note": "test cleanup"}, timeout=20)


# --------------- Purchase (Havale) -------------
def test_purchase_flow_grants_credit(admin):
    before = admin.get(f"{API}/consulting/summary", timeout=20).json()
    r = admin.post(f"{API}/consulting/purchase", timeout=20)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["status"] == "awaiting_transfer"
    assert "bank_accounts" in p
    pid = p["purchase_id"]
    try:
        r = admin.post(f"{API}/admin/consulting/purchases/{pid}/approve", timeout=20)
        assert r.status_code == 200
        after = admin.get(f"{API}/consulting/summary", timeout=20).json()
        assert after["available_credits"] == before["available_credits"] + 1
    finally:
        # Cleanup: reject the purchase to remove the credit grant
        admin.post(f"{API}/admin/consulting/purchases/{pid}/reject", timeout=20)
