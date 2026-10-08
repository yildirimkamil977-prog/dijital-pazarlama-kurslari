"""Iteration 27 - Billing info in checkout/admin/student panel."""
import os
import pytest
import requests
import uuid

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback to frontend .env since this process may not inherit it
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"
COURSE_ID = "course_4f638d946cb2"


@pytest.fixture(scope="module")
def admin_sess():
    s = requests.Session()
    r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def created_ids():
    return {"user_ids": [], "order_ids": []}


def _cleanup(admin_sess, created_ids):
    for uid in created_ids["user_ids"]:
        try:
            admin_sess.delete(f"{BASE}/api/admin/students/{uid}", timeout=20)
        except Exception:
            pass
    # Delete orders directly via mongo? admin endpoint not present. Leave with TEST_ prefix.


def test_01_admin_login(admin_sess):
    r = admin_sess.get(f"{BASE}/api/auth/me", timeout=20)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_02_guest_checkout_corporate_billing_creates_account_and_saves_billing(created_ids):
    s = requests.Session()
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "items": [{"course_id": COURSE_ID}],
        "payment_method": "transfer",
        "customer": {"name": "TEST_Guest", "email": email, "phone": "05550001122"},
        "billing": {
            "type": "corporate",
            "company_name": "TEST_Firma A.Ş.",
            "tax_office": "Kadıköy",
            "tax_no": "1234567890",
            "city": "İstanbul",
            "district": "Kadıköy",
            "address": "TEST adres sok. no 1",
        },
    }
    r = s.post(f"{BASE}/api/payments/checkout", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "transfer"
    assert data.get("account_created") is True
    order_id = data["order_id"]
    created_ids["order_ids"].append(order_id)

    # Verify billing saved on account via GET /payments/billing
    rb = s.get(f"{BASE}/api/payments/billing", timeout=20)
    assert rb.status_code == 200
    b = rb.json()
    assert b["type"] == "corporate"
    assert b["company_name"] == "TEST_Firma A.Ş."
    assert b["tax_no"] == "1234567890"
    assert b["city"] == "İstanbul"

    # auth/me to get user_id
    me = s.get(f"{BASE}/api/auth/me", timeout=20)
    assert me.status_code == 200
    created_ids["user_ids"].append(me.json()["user_id"])
    created_ids["student_session"] = s
    created_ids["student_email"] = email


def test_03_put_billing_updates_account(created_ids):
    s = created_ids["student_session"]
    new_b = {
        "type": "individual",
        "tckn": "12345678901",
        "company_name": "",
        "tax_office": "",
        "tax_no": "",
        "city": "Ankara",
        "district": "Çankaya",
        "address": "TEST yeni adres",
    }
    r = s.put(f"{BASE}/api/payments/billing", json=new_b, timeout=20)
    assert r.status_code == 200
    assert r.json()["tckn"] == "12345678901"
    # Verify persistence
    rb = s.get(f"{BASE}/api/payments/billing", timeout=20)
    assert rb.json()["city"] == "Ankara"
    assert rb.json()["type"] == "individual"


def test_04_admin_get_student_returns_billing(admin_sess, created_ids):
    uid = created_ids["user_ids"][0]
    r = admin_sess.get(f"{BASE}/api/admin/students/{uid}", timeout=20)
    assert r.status_code == 200
    user = r.json()["user"]
    assert user.get("billing", {}).get("city") == "Ankara"


def test_05_admin_put_billing(admin_sess, created_ids):
    uid = created_ids["user_ids"][0]
    b = {
        "type": "corporate", "tckn": "", "company_name": "TEST_AdminSetFirma",
        "tax_office": "Beşiktaş", "tax_no": "9876543210",
        "city": "İzmir", "district": "Konak", "address": "TEST admin adres",
    }
    r = admin_sess.put(f"{BASE}/api/admin/students/{uid}/billing", json=b, timeout=20)
    assert r.status_code == 200
    # verify
    r2 = admin_sess.get(f"{BASE}/api/admin/students/{uid}", timeout=20)
    assert r2.json()["user"]["billing"]["company_name"] == "TEST_AdminSetFirma"


def test_06_admin_put_billing_404_for_unknown_user(admin_sess):
    r = admin_sess.put(f"{BASE}/api/admin/students/user_doesnotexist_xyz/billing",
                       json={"type": "individual"}, timeout=20)
    assert r.status_code == 404


def test_07_logged_in_checkout_saves_billing_on_order(created_ids):
    """Logged-in user places second order; billing in payload must be saved on the new order."""
    s = created_ids["student_session"]
    # Need a different course or free. We'll use a different course if exists.
    # Try any other published paid course
    cs = requests.get(f"{BASE}/api/courses", timeout=20).json()
    other = next((c for c in cs if c.get("course_id") != COURSE_ID and (c.get("price") or 0) > 0), None)
    if not other:
        pytest.skip("No alternate paid course available")
    payload = {
        "items": [{"course_id": other["course_id"]}],
        "payment_method": "transfer",
        "billing": {
            "type": "corporate", "company_name": "TEST_SecondOrderFirma",
            "tax_office": "Şişli", "tax_no": "1111111111",
            "city": "İstanbul", "district": "Şişli", "address": "TEST ikinci",
        },
    }
    r = s.post(f"{BASE}/api/payments/checkout", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    oid = r.json()["order_id"]
    created_ids["order_ids"].append(oid)
    # Verify order has billing - via admin list payments
    # Done in next test


def test_08_admin_payments_lists_orders_with_billing(admin_sess, created_ids):
    r = admin_sess.get(f"{BASE}/api/admin/payments", timeout=20)
    assert r.status_code == 200
    orders = r.json()
    ours = [o for o in orders if o["order_id"] in created_ids["order_ids"]]
    assert len(ours) >= 1
    # At least one should have billing with company_name set
    with_billing = [o for o in ours if (o.get("billing") or {}).get("company_name")]
    assert len(with_billing) >= 1


def test_99_cleanup(admin_sess, created_ids):
    for uid in created_ids["user_ids"]:
        admin_sess.delete(f"{BASE}/api/admin/students/{uid}", timeout=20)
    # cleanup orders directly in Mongo
    import subprocess
    for oid in created_ids["order_ids"]:
        subprocess.run(
            ["python", "-c",
             f"import asyncio;from motor.motor_asyncio import AsyncIOMotorClient as M;import os;c=M(os.environ['MONGO_URL']);asyncio.get_event_loop().run_until_complete(c[os.environ['DB_NAME']].orders.delete_one({{'order_id':'{oid}'}}))"],
            cwd="/app/backend", check=False)
