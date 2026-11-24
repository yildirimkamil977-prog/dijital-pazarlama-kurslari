"""Iteration 30: 1:1 private training availability form, questions_until in admin, private emails."""
import os
import time
import uuid
import subprocess
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PASSWORD = "Admin!2026Panel"
mdb = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))[os.environ.get("DB_NAME", "test_database")]
C = {"users": [], "orders": [], "privates": [], "enrs": []}
STATE = {}


def _mail_count(email):
    time.sleep(2)
    out = subprocess.run("tail -n 2000 /var/log/supervisor/backend.err.log /var/log/supervisor/backend.out.log 2>/dev/null",
                         shell=True, capture_output=True, text=True).stdout
    return sum(1 for ln in out.splitlines() if "E-posta" in ln and f"{email})" in ln)


def _log_has(text, wait=6):
    for _ in range(wait):
        out = subprocess.run("tail -n 400 /var/log/supervisor/backend.err.log /var/log/supervisor/backend.out.log 2>/dev/null",
                             shell=True, capture_output=True, text=True).stdout
        if text in out:
            return True
        time.sleep(1)
    return False


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


def _student(tag):
    s = requests.Session()
    e = f"test_{tag}_{uuid.uuid4().hex[:6]}@example.com"
    r = s.post(f"{API}/auth/register", json={"name": f"TEST_ {tag}", "email": e, "password": "Test!12345", "accept_terms": True})
    assert r.status_code == 200, r.text
    C["users"].append(e)
    return s, e


def _buy(admin, s, pid):
    r = s.post(f"{API}/payments/checkout", json={"items": [{"private_id": pid}], "payment_method": "transfer"})
    assert r.status_code == 200, r.text
    oid = r.json()["order_id"]
    C["orders"].append(oid)
    r = admin.post(f"{API}/admin/payments/{oid}/mark-paid")
    assert r.status_code == 200, r.text
    return oid


@pytest.fixture(scope="module", autouse=True)
def setup(admin):
    r = admin.post(f"{API}/admin/private-trainings", json={"title": "TEST_ Bire Bir Avail", "price": 100, "is_published": True, "lesson_count": 4})
    assert r.status_code == 200, r.text
    pid = r.json()["private_id"]
    C["privates"].append(pid)
    sa, ea = _student("availa")
    sb, eb = _student("availb")
    oid = _buy(admin, sa, pid)
    _buy(admin, sb, pid)
    my = sa.get(f"{API}/my/private-trainings").json()
    STATE.update(pid=pid, sa=sa, sb=sb, ea=ea, eb=eb, oid=oid, enr=my[0]["enr_id"],
                 enr_b=sb.get(f"{API}/my/private-trainings").json()[0]["enr_id"],
                 uid_a=mdb.users.find_one({"email": ea})["user_id"])
    yield
    for oid in C["orders"]:
        mdb.orders.delete_one({"order_id": oid})
        mdb.notifications.delete_many({"meta.order_id": oid})
    for e in C["users"]:
        u = mdb.users.find_one({"email": e})
        if u:
            mdb.private_enrollments.delete_many({"user_id": u["user_id"]})
            mdb.user_sessions.delete_many({"user_id": u["user_id"]})
            mdb.users.delete_one({"user_id": u["user_id"]})
            mdb.notifications.delete_many({"body": {"$regex": e}})
    for pid in C["privates"]:
        mdb.notifications.delete_many({"meta.private_id": pid})
        admin.delete(f"{API}/admin/private-trainings/{pid}")


# Purchase email + initial state
class TestPurchase:
    def test_purchase_email_and_initial_fields(self):
        assert _mail_count(STATE["ea"]) >= 1, "private_purchase email not attempted"  # Resend logs no subject; count per recipient
        my = STATE["sa"].get(f"{API}/my/private-trainings").json()
        assert my[0]["order_id"] == STATE["oid"]
        assert not my[0].get("availability_at")
        assert my[0]["questions_until"] == ""


# Student availability endpoint
class TestAvailability:
    def test_requires_auth(self):
        r = requests.put(f"{API}/my/private-enrollments/{STATE['enr']}/availability", json={"availability": {"Pazartesi": ["09:00-12:00"]}})
        assert r.status_code == 401

    def test_other_user_404(self):
        r = STATE["sb"].put(f"{API}/my/private-enrollments/{STATE['enr']}/availability", json={"availability": {"Pazartesi": ["09:00-12:00"]}})
        assert r.status_code == 404

    def test_unknown_404(self):
        r = STATE["sa"].put(f"{API}/my/private-enrollments/penr_nope/availability", json={"availability": {"Pazartesi": ["09:00-12:00"]}})
        assert r.status_code == 404

    def test_empty_400(self):
        r = STATE["sa"].put(f"{API}/my/private-enrollments/{STATE['enr']}/availability", json={"availability": {}})
        assert r.status_code == 400 and "En az bir gün" in r.json()["detail"]
        r = STATE["sa"].put(f"{API}/my/private-enrollments/{STATE['enr']}/availability",
                            json={"availability": {"Funday": ["09:00-12:00"], "Pazartesi": ["01:00-02:00"]}})
        assert r.status_code == 400

    def test_save_filters_and_persists(self, admin):
        m0 = _mail_count(STATE["ea"])
        n0 = mdb.notifications.count_documents({"type": "private", "body": {"$regex": STATE["ea"]}})
        r = STATE["sa"].put(f"{API}/my/private-enrollments/{STATE['enr']}/availability", json={
            "availability": {"Pazartesi": ["09:00-12:00", "bad", "18:00-21:00"], "Funday": ["09:00-12:00"], "Cuma": ["21:00-23:00"], "Salı": []},
            "note": "  TEST_ akşam tercih  "})
        assert r.status_code == 200 and r.json()["ok"] is True
        my = STATE["sa"].get(f"{API}/my/private-trainings").json()[0]
        assert my["availability"] == {"Pazartesi": ["09:00-12:00", "18:00-21:00"], "Cuma": ["21:00-23:00"]}
        assert my["availability_note"] == "TEST_ akşam tercih"
        assert my["availability_at"]
        n1 = mdb.notifications.find_one({"type": "private", "title": {"$regex": "Müsaitlik formu dolduruldu"}, "body": {"$regex": STATE["ea"]}})
        assert n1 is not None
        assert mdb.notifications.count_documents({"type": "private", "body": {"$regex": STATE["ea"]}}) == n0 + 1
        assert _mail_count(STATE["ea"]) == m0 + 1, "private_availability_received email not attempted"

    def test_update_marks_guncellendi(self):
        r = STATE["sa"].put(f"{API}/my/private-enrollments/{STATE['enr']}/availability", json={"availability": {"Pazar": ["12:00-15:00"]}})
        assert r.status_code == 200
        my = STATE["sa"].get(f"{API}/my/private-trainings").json()[0]
        assert my["availability"] == {"Pazar": ["12:00-15:00"]} and my["availability_note"] == ""
        assert mdb.notifications.find_one({"type": "private", "title": {"$regex": "güncellendi"}, "body": {"$regex": STATE["ea"]}})


# Admin enrollment update + emails + questions_until
class TestAdmin:
    def test_update_unknown_404(self, admin):
        assert admin.put(f"{API}/admin/private-enrollments/penr_nope", json={"recordings": []}).status_code == 404

    def test_recording_and_completed_emails(self, admin):
        u = f"{API}/admin/private-enrollments/{STATE['enr']}"
        m0 = _mail_count(STATE["ea"])
        rec1 = {"title": "Ders 1", "url": "https://drive.google.com/TEST1", "date": "2026-11-01"}
        r = admin.put(u, json={"recordings": [rec1], "last_lesson_date": "", "note": ""})
        assert r.status_code == 200 and r.json()["emails"] == ["recording"]
        r = admin.put(u, json={"recordings": [rec1], "last_lesson_date": "2026-11-20", "note": ""})
        assert r.json()["emails"] == ["completed"]
        r = admin.put(u, json={"recordings": [rec1], "last_lesson_date": "2026-11-20", "note": "x"})
        assert r.json()["emails"] == []
        rec2 = {"title": "Ders 2", "url": "https://drive.google.com/TEST2", "date": ""}
        r = admin.put(u, json={"recordings": [rec1, rec2], "last_lesson_date": "2026-11-25", "note": ""})
        assert sorted(r.json()["emails"]) == ["completed", "recording"]
        assert admin.put(u, json={"recordings": [rec1, rec2], "last_lesson_date": "20.11.2026"}).status_code == 400
        assert _mail_count(STATE["ea"]) == m0 + 4, "recording/completed emails count mismatch"

    def test_questions_until_everywhere(self, admin):
        my = STATE["sa"].get(f"{API}/my/private-trainings").json()[0]
        assert my["questions_until"] == "2026-12-25"
        st = admin.get(f"{API}/admin/private-trainings/{STATE['pid']}/students").json()
        e = next(x for x in st["enrollments"] if x["enr_id"] == STATE["enr"])
        assert e["questions_until"] == "2026-12-25"
        assert e["availability"] == {"Pazar": ["12:00-15:00"]}
        eb = next(x for x in st["enrollments"] if x["enr_id"] == STATE["enr_b"])
        assert eb["questions_until"] == "" and not eb.get("availability_at")

    def test_student_detail_privates(self, admin):
        r = admin.get(f"{API}/admin/students/{STATE['uid_a']}")
        assert r.status_code == 200
        pv = r.json()["privates"]
        assert len(pv) == 1
        p = pv[0]
        assert p["title"] == "TEST_ Bire Bir Avail"
        assert p["questions_until"] == "2026-12-25"
        assert p["availability"] == {"Pazar": ["12:00-15:00"]}
        assert "_id" not in p
        assert p.get("paid_amount") == 100 or p.get("order_status") == "paid", p

    def test_email_templates(self, admin):
        keys = ["private_purchase", "private_availability_received", "private_recording_added", "private_completed", "private_reopen"]
        for k in keys:
            t = mdb.email_templates.find_one({"key": k})
            assert t and t.get("enabled") and t.get("subject"), k
        assert "Müsaitlik" in mdb.email_templates.find_one({"key": "private_purchase"})["html"]
        r = admin.get(f"{API}/admin/email-templates")
        if r.status_code == 200:
            got = {t["key"] for t in r.json()}
            assert set(keys) <= got
