"""
Iteration 14 backend tests:
1) mark_paid BUG FIX: group/consulting orders must NOT enroll into db.enrollments (course_id='')
   and must NOT grant consulting credit; COURSE orders DO enroll and grant 1 credit.
2) Admin set meet link: rejects when booking status=pending, succeeds when approved;
   student summary returns booking with meet_link set.
3) Reschedule flow: propose -> student accept -> status=approved with proposed date/time.
"""
import asyncio
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL").strip('"').strip("'")
DB_NAME = os.environ.get("DB_NAME").strip('"').strip("'")
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PW = "Admin!2026Panel"


def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


def register_student():
    s = requests.Session()
    email = f"TEST_it14_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "TEST It14", "email": email, "password": "TestPass!2026",
        "phone": "05001112233", "accept_terms": True}, timeout=20)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    me = s.get(f"{API}/auth/me").json()
    return s, me, email


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.new_event_loop().run_until_complete(coro)


def _get_db():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = AsyncIOMotorClient(MONGO_URL)
    return loop, client, client[DB_NAME]


# ---------- Test 1: mark-paid bug fix ----------
def test_mark_paid_group_and_consulting_do_not_grant_consulting_credit():
    loop, client, db = _get_db()
    try:
        admin = admin_session()
        student, me, email = register_student()
        user_id = me["user_id"]
        created_orders = []

        base = student.get(f"{API}/consulting/summary").json()
        base_granted = base["granted"]
        base_avail = base["available_credits"]

        g = loop.run_until_complete(db.group_trainings.find_one({}, {"group_id": 1}))
        assert g, "no seed group training found"
        group_id = g["group_id"]

        group_oid = "TESTGRP" + uuid.uuid4().hex[:10].upper()
        loop.run_until_complete(db.orders.insert_one({
            "order_id": group_oid, "user_id": user_id, "user_email": email,
            "user_name": "TEST It14", "user_phone": "05001112233",
            "kind": "group", "group_id": group_id,
            "items": [{"course_id": "", "title": "TEST Group", "price": 100.0}],
            "subtotal": 100.0, "discount": 0, "total": 100.0,
            "status": "pending", "payment_method": "transfer",
            "created_at": "2026-01-15T00:00:00+00:00",
        }))
        created_orders.append(group_oid)

        cons_oid = "TESTCON" + uuid.uuid4().hex[:10].upper()
        loop.run_until_complete(db.orders.insert_one({
            "order_id": cons_oid, "user_id": user_id, "user_email": email,
            "user_name": "TEST It14",
            "kind": "consulting",
            "items": [{"course_id": "", "title": "Bire Bir Danışmanlık", "price": 500.0}],
            "subtotal": 500.0, "discount": 0, "total": 500.0,
            "status": "pending", "payment_method": "transfer",
            "created_at": "2026-01-15T00:00:00+00:00",
        }))
        created_orders.append(cons_oid)

        try:
            r1 = admin.post(f"{API}/admin/payments/{group_oid}/mark-paid")
            assert r1.status_code == 200, r1.text
            r2 = admin.post(f"{API}/admin/payments/{cons_oid}/mark-paid")
            assert r2.status_code == 200, r2.text

            bad = loop.run_until_complete(db.enrollments.find_one({"user_id": user_id, "course_id": ""}))
            assert bad is None, f"BUG: enrollments row with empty course_id was created: {bad}"

            genr = loop.run_until_complete(db.group_enrollments.find_one({"user_id": user_id, "group_id": group_id}))
            assert genr is not None, "group_enrollments row missing after group mark-paid"

            after = student.get(f"{API}/consulting/summary").json()
            # consulting-kind paid order grants +1 (via count on kind=consulting paid orders); group grants 0
            assert after["granted"] == base_granted + 1, \
                f"granted should be base+1, got base={base_granted}, after={after['granted']}"
            assert after["available_credits"] == base_avail + 1

            c = loop.run_until_complete(db.courses.find_one({"is_published": True}, {"course_id": 1, "title": 1}))
            assert c, "no published course found"
            course_oid = "TESTCRS" + uuid.uuid4().hex[:10].upper()
            loop.run_until_complete(db.orders.insert_one({
                "order_id": course_oid, "user_id": user_id, "user_email": email,
                "user_name": "TEST It14",
                "items": [{"course_id": c["course_id"], "title": c["title"], "price": 200.0}],
                "subtotal": 200.0, "discount": 0, "total": 200.0,
                "status": "pending", "payment_method": "transfer",
                "created_at": "2026-01-15T00:00:00+00:00",
            }))
            created_orders.append(course_oid)

            r3 = admin.post(f"{API}/admin/payments/{course_oid}/mark-paid")
            assert r3.status_code == 200, r3.text

            enr = loop.run_until_complete(db.enrollments.find_one({"user_id": user_id, "course_id": c["course_id"]}))
            assert enr is not None, "course order mark-paid did NOT enroll the course"
            after2 = student.get(f"{API}/consulting/summary").json()
            assert after2["granted"] == base_granted + 2, \
                f"granted should be base+2 after course mark-paid, got {after2['granted']}"
        finally:
            for oid in created_orders:
                loop.run_until_complete(db.orders.delete_one({"order_id": oid}))
            loop.run_until_complete(db.enrollments.delete_many({"user_id": user_id}))
            loop.run_until_complete(db.group_enrollments.delete_many({"user_id": user_id}))
            loop.run_until_complete(db.users.delete_one({"user_id": user_id}))
    finally:
        client.close(); loop.close()


# ---------- Test 2: meet link ----------
def test_admin_set_meet_link_requires_approved():
    loop, client, db = _get_db()
    booking_id = None
    try:
        admin = admin_session()
        student, me, email = register_student()
        user_id = me["user_id"]
        c = loop.run_until_complete(db.courses.find_one({"is_published": True}, {"course_id": 1}))
        assert c
        loop.run_until_complete(db.enrollments.insert_one({
            "enrollment_id": "enr_test14_" + uuid.uuid4().hex[:8],
            "user_id": user_id, "course_id": c["course_id"],
            "source": "purchase", "enrolled_at": "2026-01-15T00:00:00+00:00",
        }))
        try:
            slots = student.get(f"{API}/consulting/slots").json()
            assert slots, "no consulting slots available in seed config"
            slot = slots[0]
            r = student.post(f"{API}/consulting/book", json={"date": slot["date"], "time": slot["time"]})
            assert r.status_code == 200, r.text
            booking_id = r.json()["booking_id"]

            r_bad = admin.post(f"{API}/admin/consulting/bookings/{booking_id}/meet",
                               json={"meet_link": "https://meet.google.com/abc-defg-hij"})
            assert r_bad.status_code == 400, f"expected 400 on pending meet, got {r_bad.status_code}: {r_bad.text}"

            r_ap = admin.post(f"{API}/admin/consulting/bookings/{booking_id}/approve")
            assert r_ap.status_code == 200, r_ap.text

            meet_url = "https://meet.google.com/xyz-abcd-efg"
            r_ok = admin.post(f"{API}/admin/consulting/bookings/{booking_id}/meet",
                              json={"meet_link": meet_url})
            assert r_ok.status_code == 200, r_ok.text

            summary = student.get(f"{API}/consulting/summary").json()
            found = next((b for b in summary["bookings"] if b["booking_id"] == booking_id), None)
            assert found is not None
            assert found["meet_link"] == meet_url, f"meet_link not set: {found}"
            assert found["status"] == "approved"

            tpl = loop.run_until_complete(db.email_templates.find_one({"key": "consulting_meet"}))
            assert tpl is not None, "consulting_meet email template missing"
        finally:
            if booking_id:
                loop.run_until_complete(db.consulting_bookings.delete_one({"booking_id": booking_id}))
            loop.run_until_complete(db.enrollments.delete_many({"user_id": user_id}))
            loop.run_until_complete(db.users.delete_one({"user_id": user_id}))
    finally:
        client.close(); loop.close()


# ---------- Test 3: reschedule -> student accept -> approved ----------
def test_reschedule_accept_flow_sets_approved_and_date():
    loop, client, db = _get_db()
    booking_id = None
    try:
        admin = admin_session()
        student, me, email = register_student()
        user_id = me["user_id"]
        c = loop.run_until_complete(db.courses.find_one({"is_published": True}, {"course_id": 1}))
        loop.run_until_complete(db.enrollments.insert_one({
            "enrollment_id": "enr_test14b_" + uuid.uuid4().hex[:8],
            "user_id": user_id, "course_id": c["course_id"],
            "source": "purchase", "enrolled_at": "2026-01-15T00:00:00+00:00",
        }))
        try:
            slots = student.get(f"{API}/consulting/slots").json()
            assert len(slots) >= 2, f"need at least 2 slots, got {len(slots)}"
            s0 = slots[0]
            s1 = next((cand for cand in slots[1:] if (cand["date"], cand["time"]) != (s0["date"], s0["time"])), None)
            assert s1 is not None
            r = student.post(f"{API}/consulting/book", json={"date": s0["date"], "time": s0["time"]})
            assert r.status_code == 200, r.text
            booking_id = r.json()["booking_id"]

            rp = admin.post(f"{API}/admin/consulting/bookings/{booking_id}/propose",
                            json={"date": s1["date"], "time": s1["time"], "note": "TEST reschedule"})
            assert rp.status_code == 200, rp.text
            b = loop.run_until_complete(db.consulting_bookings.find_one({"booking_id": booking_id}))
            assert b["status"] == "rescheduled"

            ra = student.post(f"{API}/consulting/bookings/{booking_id}/respond", json={"action": "accept"})
            assert ra.status_code == 200, ra.text
            b2 = loop.run_until_complete(db.consulting_bookings.find_one({"booking_id": booking_id}))
            assert b2["status"] == "approved"
            assert b2["date"] == s1["date"] and b2["time"] == s1["time"]
            assert b2["proposed_date"] == "" and b2["proposed_time"] == ""

            adm = admin.get(f"{API}/admin/consulting/bookings").json()
            found = next((x for x in adm if x["booking_id"] == booking_id), None)
            assert found and found["status"] == "approved"
        finally:
            if booking_id:
                loop.run_until_complete(db.consulting_bookings.delete_one({"booking_id": booking_id}))
            loop.run_until_complete(db.enrollments.delete_many({"user_id": user_id}))
            loop.run_until_complete(db.users.delete_one({"user_id": user_id}))
    finally:
        client.close(); loop.close()
