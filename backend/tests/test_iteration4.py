"""Iteration 4 backend tests.

Covers:
- POST /api/admin/upload-image with png/jpg -> returns {url} then GET returns image bytes
- POST /api/payments/checkout guest + transfer + billing.city/district -> 200 order created,
  billing persisted with city/district on the order.
- Non-admin cannot upload.
"""
import io
import os
import struct
import uuid
import zlib
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


def _make_png_bytes():
    # Minimal 1x1 red PNG
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    raw = b"\x00\xff\x00\x00"  # filter + RGB
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


class TestImageUpload:
    def test_upload_png_and_fetch(self, admin_session):
        png = _make_png_bytes()
        r = admin_session.post(
            f"{API}/admin/upload-image",
            files={"file": ("test.png", png, "image/png")},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data
        url = data["url"]
        assert url.startswith("/api/uploads/")

        # Fetch it publicly
        full = f"{BASE_URL}{url}"
        g = requests.get(full)
        assert g.status_code == 200, f"GET {full} -> {g.status_code}"
        assert g.headers.get("content-type", "").startswith("image/")
        assert len(g.content) == len(png)
        assert g.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_upload_rejects_non_image(self, admin_session):
        r = admin_session.post(
            f"{API}/admin/upload-image",
            files={"file": ("test.txt", b"hello", "text/plain")},
        )
        assert r.status_code == 400

    def test_upload_requires_admin(self):
        png = _make_png_bytes()
        r = requests.post(
            f"{API}/admin/upload-image",
            files={"file": ("test.png", png, "image/png")},
        )
        assert r.status_code in (401, 403)


class TestGuestTransferWithBilling:
    def test_checkout_with_city_district(self, admin_session):
        # Create paid course
        payload = {
            "title": f"TEST_Billing_{uuid.uuid4().hex[:6]}",
            "subtitle": "s", "description": "d", "category": "Test",
            "price": 500, "is_published": True,
            "modules": [{"title": "M", "lessons": [
                {"title": "L1", "video_url": "https://youtube.com/embed/x", "duration_seconds": 60}
            ]}],
        }
        c = admin_session.post(f"{API}/admin/courses", json=payload).json()
        cid = c["course_id"]
        try:
            guest = requests.Session()
            email = f"test_billing_{uuid.uuid4().hex[:8]}@test.com"
            r = guest.post(f"{API}/payments/checkout", json={
                "items": [{"course_id": cid}],
                "payment_method": "transfer",
                "customer": {"name": "Guest B", "email": email, "phone": "05551112233"},
                "billing": {
                    "type": "individual",
                    "tckn": "12345678901",
                    "city": "İstanbul",
                    "district": "Kadıköy",
                    "address": "Test mah. no:1",
                },
            })
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["status"] == "transfer"
            oid = data["order_id"]

            orders = admin_session.get(f"{API}/admin/payments").json()
            o = next((x for x in orders if x["order_id"] == oid), None)
            assert o is not None
            b = o.get("billing") or {}
            assert b.get("city") == "İstanbul", f"billing.city missing: {b}"
            assert b.get("district") == "Kadıköy", f"billing.district missing: {b}"
        finally:
            admin_session.delete(f"{API}/admin/courses/{cid}")

    def test_checkout_corporate_billing(self, admin_session):
        payload = {
            "title": f"TEST_Corp_{uuid.uuid4().hex[:6]}",
            "subtitle": "s", "description": "d", "category": "Test",
            "price": 300, "is_published": True,
            "modules": [{"title": "M", "lessons": [
                {"title": "L1", "video_url": "https://youtube.com/embed/x", "duration_seconds": 60}
            ]}],
        }
        c = admin_session.post(f"{API}/admin/courses", json=payload).json()
        cid = c["course_id"]
        try:
            guest = requests.Session()
            email = f"test_corp_{uuid.uuid4().hex[:8]}@test.com"
            r = guest.post(f"{API}/payments/checkout", json={
                "items": [{"course_id": cid}],
                "payment_method": "transfer",
                "customer": {"name": "Firma Yetkilisi", "email": email, "phone": "05551112233"},
                "billing": {
                    "type": "corporate",
                    "company_name": "TEST A.Ş.",
                    "tax_office": "Kadıköy VD",
                    "tax_no": "1234567890",
                    "city": "Ankara",
                    "district": "Çankaya",
                    "address": "Kızılay",
                },
            })
            assert r.status_code == 200, r.text
            oid = r.json()["order_id"]
            orders = admin_session.get(f"{API}/admin/payments").json()
            o = next((x for x in orders if x["order_id"] == oid), None)
            assert o is not None
            b = o.get("billing") or {}
            assert b.get("type") == "corporate"
            assert b.get("company_name") == "TEST A.Ş."
            assert b.get("city") == "Ankara"
            assert b.get("district") == "Çankaya"
        finally:
            admin_session.delete(f"{API}/admin/courses/{cid}")
