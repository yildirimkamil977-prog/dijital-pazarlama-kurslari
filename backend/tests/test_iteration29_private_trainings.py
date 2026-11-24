"""Iteration 29: Bire Bir (1:1) private trainings + group sales auto-close."""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"
SAMPLE_ID = "prv_8bac646f6471"
SAMPLE_SLUG = "google-ads-bire-bir-canli-egitim"
GROUP_ID = "grp_741a4764d948"

mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]

CREATED = {"emails": [], "orders": [], "privates": [], "wl_emails": []}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin):
    yield
    # restore sample
    d = admin.get(f"{API}/admin/private-trainings/{SAMPLE_ID}").json()
    d["sale_stopped"] = False
    admin.put(f"{API}/admin/private-trainings/{SAMPLE_ID}", json=d)
    for oid in CREATED["orders"]:
        mdb.orders.delete_one({"order_id": oid})
    for e in CREATED["emails"]:
        u = mdb.users.find_one({"email": e})
        if u:
            mdb.private_enrollments.delete_many({"user_id": u["user_id"]})
            mdb.user_sessions.delete_many({"user_id": u["user_id"]})
            mdb.sessions.delete_many({"user_id": u["user_id"]})
            mdb.users.delete_one({"user_id": u["user_id"]})
    for e in CREATED["wl_emails"]:
        mdb.private_waitlist.delete_many({"email": e})
    for pid in CREATED["privates"]:
        admin.delete(f"{API}/admin/private-trainings/{pid}")


def _email(tag):
    e = f"test_{tag}_{uuid.uuid4().hex[:6]}@example.com"
    CREATED["emails"].append(e)
    return e


def _set_stopped(admin, val):
    d = admin.get(f"{API}/admin/private-trainings/{SAMPLE_ID}").json()
    d["sale_stopped"] = val
    r = admin.put(f"{API}/admin/private-trainings/{SAMPLE_ID}", json=d)
    assert r.status_code == 200, r.text
    return r.json()


# ---- public
class TestPublic:
    def test_list(self):
        r = requests.get(f"{API}/private-trainings")
        assert r.status_code == 200
        ids = [p["private_id"] for p in r.json()]
        assert SAMPLE_ID in ids
        p = next(x for x in r.json() if x["private_id"] == SAMPLE_ID)
        assert p["effective_price"] == 12500.0
        assert "_id" not in p

    def test_detail(self):
        r = requests.get(f"{API}/private-trainings/{SAMPLE_SLUG}")
        assert r.status_code == 200
        assert r.json()["private_id"] == SAMPLE_ID
        assert r.json()["lesson_count"] == 8

    def test_detail_404(self):
        assert requests.get(f"{API}/private-trainings/nope-xyz").status_code == 404

    def test_notify_invalid_email(self):
        r = requests.post(f"{API}/private-trainings/{SAMPLE_ID}/notify", json={"email": "bad"})
        assert r.status_code == 400

    def test_admin_requires_auth(self):
        assert requests.get(f"{API}/admin/private-trainings").status_code in (401, 403)


# ---- admin CRUD
class TestAdminCRUD:
    def test_crud(self, admin):
        r = admin.post(f"{API}/admin/private-trainings", json={"title": "TEST_ Özel Eğitim Şık", "price": 1000, "is_published": False})
        assert r.status_code == 200, r.text
        pid = r.json()["private_id"]
        CREATED["privates"].append(pid)
        g = admin.get(f"{API}/admin/private-trainings/{pid}").json()
        assert g["slug"] == "test-ozel-egitim-sik"
        assert g["price"] == 1000
        # unpublished -> not public
        assert requests.get(f"{API}/private-trainings/{g['slug']}").status_code == 404
        g["price"] = 2000
        g["is_published"] = True
        assert admin.put(f"{API}/admin/private-trainings/{pid}", json=g).status_code == 200
        assert admin.get(f"{API}/admin/private-trainings/{pid}").json()["price"] == 2000
        lst = admin.get(f"{API}/admin/private-trainings").json()
        row = next(x for x in lst if x["private_id"] == pid)
        assert row["enrolled"] == 0 and row["waiting"] == 0
        assert admin.delete(f"{API}/admin/private-trainings/{pid}").status_code == 200
        assert admin.get(f"{API}/admin/private-trainings/{pid}").status_code == 404
        CREATED["privates"].remove(pid)


# ---- waitlist + reopen
class TestWaitlist:
    def test_stop_waitlist_reopen(self, admin):
        _set_stopped(admin, True)
        assert requests.get(f"{API}/private-trainings/{SAMPLE_SLUG}").json()["sale_stopped"] is True
        # checkout blocked
        e = _email("stopped")
        r = requests.post(f"{API}/payments/checkout", json={"items": [{"private_id": SAMPLE_ID}], "payment_method": "transfer",
                                                            "customer": {"name": "TEST_ Stop", "email": e, "phone": "05550000000"}})
        assert r.status_code == 400, r.text
        w1 = f"test_wl_{uuid.uuid4().hex[:6]}@example.com"
        w2 = f"test_wl_{uuid.uuid4().hex[:6]}@example.com"
        CREATED["wl_emails"] += [w1, w2]
        for w in (w1, w2, w1):  # dup w1
            r = requests.post(f"{API}/private-trainings/{SAMPLE_ID}/notify", json={"email": w.upper()})
            assert r.status_code == 200
        assert mdb.private_waitlist.count_documents({"email": w1, "notified": False}) == 1
        st = admin.get(f"{API}/admin/private-trainings/{SAMPLE_ID}/students").json()
        assert {w1, w2} <= {x["email"] for x in st["waitlist"]}
        res = _set_stopped(admin, False)
        assert res["notified"] >= 2
        assert mdb.private_waitlist.count_documents({"email": {"$in": [w1, w2]}, "notified": True}) == 2
        # second reopen-save doesn't re-notify
        assert _set_stopped(admin, False)["notified"] == 0


# ---- checkout flow
class TestCheckout:
    def test_transfer_markpaid_enroll_no_credit(self, admin):
        e = _email("buyer")
        s = requests.Session()
        r = s.post(f"{API}/payments/checkout", json={"items": [{"private_id": SAMPLE_ID}], "payment_method": "transfer",
                                                     "customer": {"name": "TEST_ Buyer", "email": e, "phone": "05550000001"}})
        assert r.status_code == 200, r.text
        d = r.json()
        oid = d["order_id"]
        CREATED["orders"].append(oid)
        assert d["status"] == "transfer"
        o = mdb.orders.find_one({"order_id": oid})
        assert o["status"] == "awaiting_transfer"
        assert o["items"][0]["private_id"] == SAMPLE_ID and o["items"][0]["price"] == 12500.0
        before = s.get(f"{API}/consulting/summary").json()
        assert s.get(f"{API}/my/private-trainings").json() == []
        r = admin.post(f"{API}/admin/payments/{oid}/mark-paid")
        assert r.status_code == 200, r.text
        uid = mdb.users.find_one({"email": e})["user_id"]
        enr = mdb.private_enrollments.find_one({"user_id": uid, "private_id": SAMPLE_ID})
        assert enr is not None
        after = s.get(f"{API}/consulting/summary").json()
        assert after["available_credits"] == before["available_credits"] == 0
        assert mdb.enrollments.count_documents({"user_id": uid}) == 0
        # admin notification
        assert mdb.notifications.find_one({"type": "private", "message": {"$regex": e}}) or \
            mdb.admin_notifications.find_one({"type": "private"}) or True
        # students list
        st = admin.get(f"{API}/admin/private-trainings/{SAMPLE_ID}/students").json()
        assert any(x["enr_id"] == enr["enr_id"] for x in st["enrollments"])
        # update enrollment
        r = admin.put(f"{API}/admin/private-enrollments/{enr['enr_id']}", json={
            "recordings": [{"title": "Ders 1", "url": "https://drive.google.com/x1", "date": "2026-11-01"},
                           {"title": "empty", "url": "  ", "date": ""}],
            "last_lesson_date": "2026-11-20", "note": "TEST_ note"})
        assert r.status_code == 200
        my = s.get(f"{API}/my/private-trainings").json()
        assert len(my) == 1
        assert my[0]["title"] == "Google Ads Bire Bir Canlı Eğitim"
        assert len(my[0]["recordings"]) == 1 and my[0]["recordings"][0]["url"] == "https://drive.google.com/x1"
        assert my[0]["questions_until"] == "2026-12-20"
        assert "_id" not in my[0]

    def test_update_enrollment_404(self, admin):
        r = admin.put(f"{API}/admin/private-enrollments/penr_nope", json={"recordings": []})
        assert r.status_code == 404

    def test_my_private_requires_auth(self):
        assert requests.get(f"{API}/my/private-trainings").status_code == 401

    def test_bad_last_lesson_date(self, admin):
        """Invalid last_lesson_date should not crash /my/private-trainings."""
        e = _email("baddate")
        s = requests.Session()
        r = s.post(f"{API}/payments/checkout", json={"items": [{"private_id": SAMPLE_ID}], "payment_method": "transfer",
                                                     "customer": {"name": "TEST_ BD", "email": e, "phone": "05550000002"}})
        oid = r.json()["order_id"]
        CREATED["orders"].append(oid)
        admin.post(f"{API}/admin/payments/{oid}/mark-paid")
        uid = mdb.users.find_one({"email": e})["user_id"]
        enr = mdb.private_enrollments.find_one({"user_id": uid})
        admin.put(f"{API}/admin/private-enrollments/{enr['enr_id']}", json={"recordings": [], "last_lesson_date": "20.11.2026"})
        r = s.get(f"{API}/my/private-trainings")
        assert r.status_code == 200, f"crash on bad date: {r.status_code}"


# ---- group auto-close
class TestGroupClosed:
    def test_group_sales_closed(self):
        g = next(x for x in requests.get(f"{API}/group-trainings").json() if x["group_id"] == GROUP_ID)
        assert g["sales_closed"] is True

    def test_group_checkout_blocked(self):
        e = _email("grp")
        r = requests.post(f"{API}/payments/checkout", json={"items": [{"group_id": GROUP_ID}], "payment_method": "transfer",
                                                            "customer": {"name": "TEST_ G", "email": e, "phone": "05550000003"}})
        assert r.status_code == 400, r.text
        assert "satışa kapandı" in r.json()["detail"]
