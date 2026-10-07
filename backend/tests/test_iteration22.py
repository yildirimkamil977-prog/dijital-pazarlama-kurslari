"""Iteration 22: group discount, cart/checkout, discount group_ids, course sale_closed + waitlist."""
import os, json, time, uuid
import pytest, requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASS = "Admin!2026Panel"
GROUP_ID = "grp_741a4764d948"
GROUP_SLUG = "google-ads-canli-grup-egitimi"
COURSE_ID = "course_8b53eae5576a"
COURSE_SLUG = "google-ads-ile-sifirdan-uzmanliga"

TAG = uuid.uuid4().hex[:6]
STATE = {"codes": [], "user_emails": set(), "orig_group_discount_price": None, "orig_sale_closed": False}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def guest_session_factory():
    def make():
        return requests.Session()
    return make


# ---------- 1. Group discount_price persistence ----------
def test_admin_set_group_discount_price(admin):
    r = admin.get(f"{API}/admin/group-trainings/{GROUP_ID}")
    assert r.status_code == 200
    g = r.json()
    STATE["orig_group_discount_price"] = g.get("discount_price")
    payload = {k: g.get(k) for k in ["title","description","long_description","image","promo_video",
                                      "what_you_learn","requirements","price","capacity","instructor_id",
                                      "lessons","curriculum","is_published"]}
    payload["discount_price"] = 3999.0
    r = admin.put(f"{API}/admin/group-trainings/{GROUP_ID}", json=payload)
    assert r.status_code == 200, r.text
    # Public GET
    pr = requests.get(f"{API}/group-trainings/{GROUP_SLUG}").json()
    assert pr["discount_price"] == 3999.0
    assert pr["effective_price"] == 3999.0
    assert pr["price"] == 4999.0


# ---------- 2. Discount code with group_ids ----------
def test_create_group_only_discount_and_validate(admin):
    code = f"TESTGRP{TAG}"
    STATE["codes"].append(code)
    r = admin.post(f"{API}/admin/discounts", json={
        "code": code, "type": "percent", "value": 10, "active": True, "group_ids": [GROUP_ID]
    })
    assert r.status_code == 200, r.text
    assert r.json()["group_ids"] == [GROUP_ID]

    # validate on group item (needs auth; use admin)
    r = admin.post(f"{API}/payments/validate-discount", json={
        "code": code, "subtotal": 3999, "items": [{"group_id": GROUP_ID, "price": 3999}]
    })
    assert r.status_code == 200, r.text
    assert round(r.json()["discount"], 2) == 399.9

    # validate on course only (not matching) should fail with 400
    r2 = admin.post(f"{API}/payments/validate-discount", json={
        "code": code, "subtotal": 1799, "items": [{"course_id": COURSE_ID, "price": 1799}]
    })
    assert r2.status_code == 400


# ---------- 3. Checkout a group as guest with 100% code -> free + enrollment ----------
def test_free_group_checkout_via_cart(admin, guest_session_factory):
    code = f"TESTFREE{TAG}"
    STATE["codes"].append(code)
    r = admin.post(f"{API}/admin/discounts", json={
        "code": code, "type": "percent", "value": 100, "active": True, "group_ids": [GROUP_ID]
    })
    assert r.status_code == 200, r.text

    email = f"TEST_grp_{TAG}@example.com"
    STATE["user_emails"].add(email)
    s = guest_session_factory()
    r = s.post(f"{API}/payments/checkout", json={
        "items": [{"group_id": GROUP_ID}],
        "discount_code": code,
        "payment_method": "transfer",
        "customer": {"name": "Test User", "email": email, "phone": "05550001122"},
        "billing": {"type": "individual"},
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "free", data
    oid = data["order_id"]

    # Verify order paid + group enrollment created
    import asyncio
    from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
    from motor.motor_asyncio import AsyncIOMotorClient
    async def check():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        o = await c.orders.find_one({"order_id": oid}, {"_id": 0})
        u = await c.users.find_one({"email": email.lower()}, {"_id": 0, "user_id": 1})
        enr = await c.group_enrollments.find_one({"group_id": GROUP_ID, "user_id": u["user_id"]}, {"_id": 0}) if u else None
        return o, enr, u
    o, enr, u = asyncio.get_event_loop().run_until_complete(check())
    assert u, "user should be created"
    assert o["status"] == "paid"
    assert o["items"][0]["group_id"] == GROUP_ID
    assert o["items"][0]["price"] == 3999.0  # effective price
    assert enr is not None


# ---------- 4. Already-enrolled rejection ----------
def test_already_enrolled_rejected(guest_session_factory):
    email = f"TEST_grp_{TAG}@example.com"  # same user from previous test
    s = guest_session_factory()
    r = s.post(f"{API}/payments/checkout", json={
        "items": [{"group_id": GROUP_ID}],
        "payment_method": "transfer",
        "customer": {"name": "Test User", "email": email, "phone": "05550001122"},
    })
    assert r.status_code == 400
    assert "zaten kayıtlısınız" in r.text


# ---------- 5. Transfer order with group + admin mark-paid enrolls ----------
def test_transfer_group_then_mark_paid(admin, guest_session_factory):
    email = f"TEST_trgrp_{TAG}@example.com"
    STATE["user_emails"].add(email)
    s = guest_session_factory()
    r = s.post(f"{API}/payments/checkout", json={
        "items": [{"group_id": GROUP_ID}],
        "payment_method": "transfer",
        "customer": {"name": "Test TR", "email": email, "phone": "05550003344"},
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "transfer"
    oid = data["order_id"]

    r2 = admin.post(f"{API}/admin/payments/{oid}/mark-paid")
    assert r2.status_code == 200, r2.text

    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    async def check():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        u = await c.users.find_one({"email": email.lower()}, {"_id": 0, "user_id": 1})
        o = await c.orders.find_one({"order_id": oid}, {"_id": 0})
        enr = await c.group_enrollments.find_one({"group_id": GROUP_ID, "user_id": u["user_id"]}, {"_id": 0}) if u else None
        return o, enr
    o, enr = asyncio.get_event_loop().run_until_complete(check())
    assert o["status"] == "paid"
    assert enr is not None, "mark-paid should enroll user to group item in items[]"


# ---------- 6. Course notify (sale_closed waitlist) ----------
def test_course_sale_closed_notify_and_checkout_reject(admin, guest_session_factory):
    # Enable sale_closed on the course
    r = admin.get(f"{API}/admin/courses/{COURSE_ID}")
    assert r.status_code == 200
    full = r.json()
    STATE["orig_sale_closed"] = full.get("sale_closed", False)
    # minimal PUT with sale_closed=true
    put_fields = ["title","subtitle","description","long_description","category","level",
                  "price","discount_price","early_bird_price","publish_at","thumbnail","promo_video",
                  "requirements","what_you_learn","modules","instructor_id","is_published",
                  "meta_title","meta_description","meta_keywords","cross_sell_ids"]
    payload = {k: full.get(k) for k in put_fields if k in full}
    payload["sale_closed"] = True
    r2 = admin.put(f"{API}/admin/courses/{COURSE_ID}", json=payload)
    assert r2.status_code == 200, r2.text

    # Public course list should reflect sale_closed
    lst = requests.get(f"{API}/courses").json()
    item = next((c for c in lst if c["course_id"] == COURSE_ID), None)
    assert item and item.get("sale_closed") is True

    # Notify POST valid email
    email = f"TEST_wait_{TAG}@example.com"
    r3 = requests.post(f"{API}/courses/{COURSE_ID}/notify", json={"email": email, "name": "Wait1"})
    assert r3.status_code == 200
    # Dedupe
    r4 = requests.post(f"{API}/courses/{COURSE_ID}/notify", json={"email": email, "name": "Wait1"})
    assert r4.status_code == 200
    # Invalid email
    r5 = requests.post(f"{API}/courses/{COURSE_ID}/notify", json={"email": "bad"})
    assert r5.status_code == 400

    # Admin waitlist shows entry (dedup -> 1)
    r6 = admin.get(f"{API}/admin/courses/{COURSE_ID}/waitlist")
    assert r6.status_code == 200
    emails = [w["email"] for w in r6.json() if w["email"] == email.lower()]
    assert len(emails) == 1

    # Checkout rejects sale_closed course
    s = guest_session_factory()
    r7 = s.post(f"{API}/payments/checkout", json={
        "items": [{"course_id": COURSE_ID}],
        "payment_method": "transfer",
        "customer": {"name": "X", "email": f"TEST_rej_{TAG}@example.com", "phone": "05550009999"},
    })
    STATE["user_emails"].add(f"TEST_rej_{TAG}@example.com")
    assert r7.status_code == 400
    assert "satış" in r7.text or "satis" in r7.text.lower()


# ---------- 7. Regression: normal course purchase still works ----------
def test_regression_course_free_checkout(admin, guest_session_factory):
    # Turn sale_closed back off first
    r = admin.get(f"{API}/admin/courses/{COURSE_ID}").json()
    put_fields = ["title","subtitle","description","long_description","category","level",
                  "price","discount_price","early_bird_price","publish_at","thumbnail","promo_video",
                  "requirements","what_you_learn","modules","instructor_id","is_published",
                  "meta_title","meta_description","meta_keywords","cross_sell_ids"]
    payload = {k: r.get(k) for k in put_fields if k in r}
    payload["sale_closed"] = False
    admin.put(f"{API}/admin/courses/{COURSE_ID}", json=payload)

    code = f"TESTCRS{TAG}"
    STATE["codes"].append(code)
    admin.post(f"{API}/admin/discounts", json={
        "code": code, "type": "percent", "value": 100, "active": True, "course_ids": [COURSE_ID]
    })
    email = f"TEST_crs_{TAG}@example.com"
    STATE["user_emails"].add(email)
    s = guest_session_factory()
    r2 = s.post(f"{API}/payments/checkout", json={
        "items": [{"course_id": COURSE_ID}],
        "discount_code": code,
        "payment_method": "transfer",
        "customer": {"name": "C", "email": email, "phone": "05550004400"},
    })
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "free"


# ---------- Z. Cleanup/restore ----------
def test_zz_restore_and_cleanup(admin):
    # Restore group discount_price
    g = admin.get(f"{API}/admin/group-trainings/{GROUP_ID}").json()
    payload = {k: g.get(k) for k in ["title","description","long_description","image","promo_video",
                                      "what_you_learn","requirements","price","capacity","instructor_id",
                                      "lessons","curriculum","is_published"]}
    payload["discount_price"] = STATE["orig_group_discount_price"]
    r = admin.put(f"{API}/admin/group-trainings/{GROUP_ID}", json=payload)
    assert r.status_code == 200

    # Restore course sale_closed
    c = admin.get(f"{API}/admin/courses/{COURSE_ID}").json()
    put_fields = ["title","subtitle","description","long_description","category","level",
                  "price","discount_price","early_bird_price","publish_at","thumbnail","promo_video",
                  "requirements","what_you_learn","modules","instructor_id","is_published",
                  "meta_title","meta_description","meta_keywords","cross_sell_ids"]
    payload = {k: c.get(k) for k in put_fields if k in c}
    payload["sale_closed"] = bool(STATE["orig_sale_closed"])
    admin.put(f"{API}/admin/courses/{COURSE_ID}", json=payload)

    # Delete discount codes
    for code in STATE["codes"]:
        admin.delete(f"{API}/admin/discounts/{code}")

    # Delete TEST_ users, their orders, enrollments, waitlist
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    async def wipe():
        c = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        for email in STATE["user_emails"]:
            u = await c.users.find_one({"email": email.lower()})
            if u:
                uid = u["user_id"]
                await c.orders.delete_many({"user_id": uid})
                await c.enrollments.delete_many({"user_id": uid})
                await c.group_enrollments.delete_many({"user_id": uid})
                await c.sessions.delete_many({"user_id": uid})
                await c.users.delete_one({"user_id": uid})
        await c.course_waitlist.delete_many({"email": {"$regex": f"^test_wait_{TAG}"}})
        for email in STATE["user_emails"]:
            await c.users.delete_many({"email": email.lower()})
    asyncio.get_event_loop().run_until_complete(wipe())

    # Confirm restored
    pub = requests.get(f"{API}/group-trainings/{GROUP_SLUG}").json()
    assert pub.get("discount_price") == STATE["orig_group_discount_price"]
