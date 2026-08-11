"""Iteration 3 backend tests.

Covers:
- Guest checkout with Havale/EFT applies transfer_discount_pct=2 correctly
- Admin settings PUT /admin/settings/general with exclude_unset does NOT reset
  transfer_discount_pct when the field is omitted; setting it persists and is
  exposed via /settings/public.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def ensure_transfer_pct_2(admin_session):
    """Ensure transfer_discount_pct=2 before tests, restore to 2 after."""
    cur = admin_session.get(f"{API}/admin/settings").json()
    payload = {"site_name": cur.get("site_name") or "Site", "transfer_discount_pct": 2}
    r = admin_session.put(f"{API}/admin/settings/general", json=payload)
    assert r.status_code == 200
    yield
    admin_session.put(f"{API}/admin/settings/general", json={
        "site_name": cur.get("site_name") or "Site", "transfer_discount_pct": 2
    })


class TestTransferDiscountSettings:
    def test_general_update_without_pct_does_not_reset(self, admin_session, ensure_transfer_pct_2):
        # PUT general WITHOUT transfer_discount_pct -> must remain 2
        cur = admin_session.get(f"{API}/admin/settings").json()
        payload = {
            "site_name": cur.get("site_name") or "Site",
            "tagline": cur.get("tagline", ""),
            "hero_title": cur.get("hero_title", ""),
            "promo_enabled": cur.get("promo_enabled", False),
            "promo_text": cur.get("promo_text", ""),
        }
        r = admin_session.put(f"{API}/admin/settings/general", json=payload)
        assert r.status_code == 200
        after = admin_session.get(f"{API}/admin/settings").json()
        assert after["transfer_discount_pct"] == 2, f"transfer_discount_pct reset! Got {after['transfer_discount_pct']}"

    def test_set_pct_5_persists_and_public(self, admin_session, ensure_transfer_pct_2):
        cur = admin_session.get(f"{API}/admin/settings").json()
        r = admin_session.put(f"{API}/admin/settings/general", json={
            "site_name": cur.get("site_name") or "Site",
            "transfer_discount_pct": 5,
        })
        assert r.status_code == 200
        assert admin_session.get(f"{API}/admin/settings").json()["transfer_discount_pct"] == 5
        pub = requests.get(f"{API}/settings/public").json()
        assert pub.get("transfer_discount_pct") == 5
        # restore
        admin_session.put(f"{API}/admin/settings/general", json={
            "site_name": cur.get("site_name") or "Site", "transfer_discount_pct": 2
        })
        assert admin_session.get(f"{API}/admin/settings").json()["transfer_discount_pct"] == 2


class TestGuestTransferCheckout:
    def test_guest_transfer_checkout_applies_2pct(self, admin_session, ensure_transfer_pct_2):
        # Create a paid published course
        payload = {
            "title": f"TEST_Transfer_{uuid.uuid4().hex[:6]}",
            "subtitle": "s", "description": "d", "category": "Test",
            "price": 1000, "is_published": True,
            "modules": [{"title": "M", "lessons": [
                {"title": "L1", "video_url": "https://youtube.com/embed/x", "duration_seconds": 60}
            ]}],
        }
        c = admin_session.post(f"{API}/admin/courses", json=payload).json()
        cid = c["course_id"]

        try:
            guest = requests.Session()
            email = f"test_guest_tr_{uuid.uuid4().hex[:8]}@test.com"
            r = guest.post(f"{API}/payments/checkout", json={
                "items": [{"course_id": cid}],
                "payment_method": "transfer",
                "customer": {"name": "Guest T", "email": email, "phone": "05551112233"},
            })
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["status"] == "transfer"
            # 1000 - 2% = 980
            assert abs(data["total"] - 980.0) < 0.01, f"Expected 980, got {data['total']}"
            oid = data["order_id"]

            # Verify order in admin payments has transfer_discount > 0
            orders = admin_session.get(f"{API}/admin/payments").json()
            o = next((x for x in orders if x["order_id"] == oid), None)
            assert o is not None
            assert o.get("payment_method") == "transfer"
            assert o.get("transfer_discount", 0) > 0
            assert abs(o["transfer_discount"] - 20.0) < 0.01
            assert abs(o["total"] - 980.0) < 0.01
            assert o.get("status") == "awaiting_transfer"
        finally:
            admin_session.delete(f"{API}/admin/courses/{cid}")
