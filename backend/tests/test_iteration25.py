"""Iteration 25 tests: student profile orders linkage, student delete, group enrollments, payments flow (transfer + mark-paid)."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"
COURSE_ID = "course_8b53eae5576a"
GROUP_ID = "grp_741a4764d948"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


def _guest_checkout(email, kind="course"):
    s = requests.Session()
    payload = {
        "payment_method": "transfer",
        "customer": {"name": "Test User", "email": email, "phone": "5551112233"},
        "items": [{"course_id": COURSE_ID}] if kind == "course" else [{"group_id": GROUP_ID}],
    }
    r = s.post(f"{API}/payments/checkout", json=payload)
    return s, r


@pytest.fixture(scope="module")
def seed_course_order():
    email = f"test_iter25_c_{int(time.time())}@example.com"
    s, r = _guest_checkout(email, "course")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "transfer"
    return {"email": email, "order_id": data["order_id"], "total": data["total"], "session": s}


@pytest.fixture(scope="module")
def seed_group_order():
    email = f"test_iter25_g_{int(time.time())}@example.com"
    s, r = _guest_checkout(email, "group")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "transfer"
    return {"email": email, "order_id": data["order_id"], "total": data["total"], "session": s}


def _find_user_by_email(admin, email):
    r = admin.get(f"{API}/admin/students", params={"search": email})
    assert r.status_code == 200
    items = r.json().get("items") if isinstance(r.json(), dict) else r.json()
    for u in items:
        if u.get("email") == email:
            return u
    return None


# --- student_detail: courses show paid_amount matching order total, payments only paid/awaiting_transfer ---
def test_course_checkout_transfer_then_mark_paid(admin, seed_course_order):
    email = seed_course_order["email"]
    oid = seed_course_order["order_id"]
    total = seed_course_order["total"]

    user = _find_user_by_email(admin, email)
    assert user, f"Guest user not found for {email}"
    user_id = user["user_id"]

    # Before mark-paid: no enrollment yet, but payment should appear with awaiting_transfer
    r = admin.get(f"{API}/admin/students/{user_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["courses"] == [], "Course should not be enrolled before mark-paid"
    pay = [p for p in body["payments"] if p["order_id"] == oid]
    assert len(pay) == 1
    assert pay[0]["status"] == "awaiting_transfer"
    assert round(pay[0]["total"], 2) == round(total, 2)

    # Payments page shows same order with same total
    r = admin.get(f"{API}/admin/payments", params={"search": email})
    assert r.status_code == 200
    plist = [p for p in r.json() if p["order_id"] == oid]
    assert len(plist) == 1
    assert round(plist[0]["total"], 2) == round(total, 2)
    assert plist[0]["payment_method"] == "transfer"

    # Mark paid
    r = admin.post(f"{API}/admin/payments/{oid}/mark-paid")
    assert r.status_code == 200, r.text
    assert r.json().get("email_to") == email

    # Now student profile shows enrolled course with paid_amount == order total, order_status=paid
    r = admin.get(f"{API}/admin/students/{user_id}")
    body = r.json()
    courses = [c for c in body["courses"] if c["course_id"] == COURSE_ID]
    assert len(courses) == 1
    c = courses[0]
    assert c["order_id"] == oid
    assert c["order_status"] == "paid"
    assert c["payment_method"] == "transfer"
    assert round(c["paid_amount"], 2) == round(total, 2)
    pay = [p for p in body["payments"] if p["order_id"] == oid][0]
    assert pay["status"] == "paid"
    assert round(pay["total"], 2) == round(total, 2)


def test_group_checkout_transfer_then_mark_paid(admin, seed_group_order):
    email = seed_group_order["email"]
    oid = seed_group_order["order_id"]
    total = seed_group_order["total"]

    user = _find_user_by_email(admin, email)
    assert user, f"Guest user not found for {email}"
    user_id = user["user_id"]

    r = admin.post(f"{API}/admin/payments/{oid}/mark-paid")
    assert r.status_code == 200, r.text

    r = admin.get(f"{API}/admin/students/{user_id}")
    assert r.status_code == 200
    body = r.json()
    groups = [g for g in body["groups"] if g["group_id"] == GROUP_ID]
    assert len(groups) == 1
    g = groups[0]
    assert g["order_id"] == oid
    assert g["order_status"] == "paid"
    assert round(g["paid_amount"], 2) == round(total, 2)
    assert g["source"] == "purchase"


# --- Manual group enroll + duplicate + remove ---
def test_manual_group_enroll_dup_remove(admin):
    # Create fresh student via register
    email = f"test_iter25_m_{int(time.time())}@example.com"
    r = requests.post(f"{API}/auth/register", json={"name": "M Test", "email": email, "password": "Secret!2026", "accept_terms": True})
    assert r.status_code == 200, r.text
    user = _find_user_by_email(admin, email)
    assert user
    uid = user["user_id"]

    r = admin.post(f"{API}/admin/group-enrollments", json={"user_id": uid, "group_id": GROUP_ID})
    assert r.status_code == 200, r.text

    # Duplicate -> 400
    r = admin.post(f"{API}/admin/group-enrollments", json={"user_id": uid, "group_id": GROUP_ID})
    assert r.status_code == 400

    # Profile lists it as manual with paid_amount 0
    r = admin.get(f"{API}/admin/students/{uid}")
    body = r.json()
    gs = [g for g in body["groups"] if g["group_id"] == GROUP_ID]
    assert len(gs) == 1
    assert gs[0]["source"] == "manual"
    assert gs[0]["paid_amount"] == 0
    assert gs[0]["order_id"] is None

    # Remove
    r = admin.request("DELETE", f"{API}/admin/group-enrollments", json={"user_id": uid, "group_id": GROUP_ID})
    assert r.status_code == 200
    r = admin.get(f"{API}/admin/students/{uid}")
    assert not [g for g in r.json()["groups"] if g["group_id"] == GROUP_ID]


# --- Delete student: keeps orders, removes enrollments + group_enrollments + progress + sessions ---
def test_delete_student_keeps_orders(admin, seed_course_order):
    email = seed_course_order["email"]
    oid = seed_course_order["order_id"]
    user = _find_user_by_email(admin, email)
    assert user
    uid = user["user_id"]

    # Delete student
    r = admin.delete(f"{API}/admin/students/{uid}")
    assert r.status_code == 200, r.text

    # User gone
    r = admin.get(f"{API}/admin/students/{uid}")
    assert r.status_code == 404

    # Order still exists in Payments list
    r = admin.get(f"{API}/admin/payments", params={"search": oid})
    assert r.status_code == 200
    found = [p for p in r.json() if p["order_id"] == oid]
    assert len(found) == 1, "Order must remain for accounting"


def test_delete_admin_not_allowed(admin):
    # Find admin's user_id
    r = admin.get(f"{API}/auth/session")
    assert r.status_code == 200
    uid = r.json()["user"]["user_id"]
    r = admin.delete(f"{API}/admin/students/{uid}")
    assert r.status_code == 400


# --- Cleanup: delete any remaining TEST_ data ---
def test_cleanup(admin, seed_group_order):
    # Cleanup group order user + the manual-enroll user still exist
    r = admin.get(f"{API}/admin/students", params={"search": "test_iter25_"})
    if r.status_code == 200:
        items = r.json().get("items") if isinstance(r.json(), dict) else r.json()
        for u in items:
            if u.get("email", "").startswith("test_iter25_"):
                admin.delete(f"{API}/admin/students/{u['user_id']}")
    # Delete leftover orders directly via admin? No admin endpoint; leave orders (test accepts).
    # But remove via mongo-safe path: there's no delete-order endpoint, so we leave the TEST_ orders.
    # Mark them with search for traceability.
    print("Cleanup done; TEST_ orders left in db.orders (expected per requirements).")
