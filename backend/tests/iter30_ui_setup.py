"""Setup/cleanup helper for iteration 30 UI tests. Usage: python iter30_ui_setup.py setup|cleanup"""
import os, sys, json, uuid, requests
from pymongo import MongoClient

API = os.environ.get("REACT_APP_BACKEND_URL", "https://video-elearning.preview.emergentagent.com").rstrip("/") + "/api"
mdb = MongoClient("mongodb://localhost:27017")["test_database"]
F = "/tmp/iter30_ui.json"
admin = requests.Session()
assert admin.post(f"{API}/auth/login", json={"email": "yildirimkamil977@gmail.com", "password": "Admin!2026Panel"}).status_code == 200

if sys.argv[1] == "setup":
    r = admin.post(f"{API}/admin/private-trainings", json={"title": "TEST_ UI Bire Bir", "price": 100, "is_published": True, "lesson_count": 4})
    pid = r.json()["private_id"]
    slug = admin.get(f"{API}/admin/private-trainings/{pid}").json()["slug"]
    code = "TEST_FREE" + uuid.uuid4().hex[:4].upper()
    print(admin.post(f"{API}/admin/discounts", json={"code": code, "type": "percent", "value": 100}).status_code)
    users = []
    for tag in ("uifree", "uitrans"):
        e = f"test_{tag}_{uuid.uuid4().hex[:6]}@example.com"
        s = requests.Session()
        assert s.post(f"{API}/auth/register", json={"name": f"TEST_ {tag}", "email": e, "password": "Test!12345", "accept_terms": True}).status_code == 200
        users.append(e)
    # second student buys via transfer + admin approve (API) for panel tab test
    s = requests.Session(); s.post(f"{API}/auth/login", json={"email": users[1], "password": "Test!12345"})
    oid = s.post(f"{API}/payments/checkout", json={"items": [{"private_id": pid}], "payment_method": "transfer"}).json()["order_id"]
    admin.post(f"{API}/admin/payments/{oid}/mark-paid")
    st = {"pid": pid, "slug": slug, "code": code, "users": users, "orders": [oid],
          "uid_trans": mdb.users.find_one({"email": users[1]})["user_id"]}
    json.dump(st, open(F, "w")); print(st)
else:
    st = json.load(open(F))
    for e in st["users"]:
        u = mdb.users.find_one({"email": e})
        if u:
            for o in mdb.orders.find({"user_id": u["user_id"]}):
                mdb.notifications.delete_many({"meta.order_id": o["order_id"]})
            mdb.orders.delete_many({"user_id": u["user_id"]})
            mdb.private_enrollments.delete_many({"user_id": u["user_id"]})
            mdb.user_sessions.delete_many({"user_id": u["user_id"]})
            mdb.notifications.delete_many({"body": {"$regex": e}})
            mdb.users.delete_one({"user_id": u["user_id"]})
    mdb.notifications.delete_many({"meta.private_id": st["pid"]})
    print(admin.delete(f"{API}/admin/discounts/{st['code']}").status_code, admin.delete(f"{API}/admin/private-trainings/{st['pid']}").status_code)
