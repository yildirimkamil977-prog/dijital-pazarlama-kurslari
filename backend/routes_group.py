import base64
import hashlib
import hmac
import json
import os
import re
import secrets as _secrets
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from deps import (db, now_utc, new_id, get_current_user, require_admin,
                  get_settings_doc, schedule_email, push_notification, get_paytr_credentials)

router = APIRouter()
FRONTEND_URL = os.environ.get("CORS_ORIGINS", "").split(",")[0]
CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")
WEEKDAYS_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
MONTHS_TR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


def _slug(t):
    t = (t or "").lower()
    tr = {"ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u"}
    for k, v in tr.items():
        t = t.replace(k, v)
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t or new_id("g")[1:8]


def _fmt(date_str, time_str):
    try:
        d = datetime.fromisoformat(date_str)
        return f"{d.day} {MONTHS_TR[d.month]} {d.year} {WEEKDAYS_TR[d.weekday()]} · {time_str}"
    except Exception:
        return f"{date_str} {time_str}"


async def _instructors():
    docs = await db.instructors.find({}, {"_id": 0}).to_list(300)
    return {d["instructor_id"]: {"instructor_id": d["instructor_id"], "slug": d["slug"], "name": d["name"],
                                 "title": d.get("title", ""), "avatar": d.get("avatar", ""), "bio": d.get("bio", ""),
                                 "social_links": d.get("social_links", {})} for d in docs}


async def _public(doc, imap, with_links=False):
    enrolled = await db.group_enrollments.count_documents({"group_id": doc["group_id"]})
    cap = doc.get("capacity", 0)
    remaining = max(0, cap - enrolled)
    lessons = sorted(doc.get("lessons", []), key=lambda l: (l.get("date", ""), l.get("time", "")))
    pub_lessons = [{"id": l.get("id"), "title": l.get("title"), "date": l.get("date"), "time": l.get("time"),
                    **({"meet_link": l.get("meet_link", ""), "recording_url": l.get("recording_url", "")} if with_links else {})} for l in lessons]
    return {"group_id": doc["group_id"], "title": doc["title"], "slug": doc["slug"],
            "description": doc.get("description", ""), "image": doc.get("image", ""),
            "what_you_learn": doc.get("what_you_learn", []), "requirements": doc.get("requirements", []),
            "promo_video": doc.get("promo_video", ""), "price": doc.get("price", 0),
            "capacity": cap, "enrolled": enrolled, "remaining": remaining, "low_stock": remaining <= 10,
            "sold_out": remaining <= 0, "lessons": pub_lessons,
            "start_date": lessons[0].get("date") if lessons else None,
            "instructor": imap.get(doc.get("instructor_id")), "is_published": doc.get("is_published", False)}


# ---------- Public ----------
@router.get("/group-trainings")
async def list_groups():
    imap = await _instructors()
    docs = await db.group_trainings.find({"is_published": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [await _public(d, imap) for d in docs]


@router.get("/group-trainings/{slug}")
async def get_group(slug):
    d = await db.group_trainings.find_one({"slug": slug}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
    res = await _public(d, await _instructors())
    allt = (await get_settings_doc()).get("testimonials", [])
    res["reviews"] = [t for t in allt if not t.get("course_id")]
    return res


# ---------- Student ----------
@router.get("/my/group-trainings")
async def my_groups(request: Request):
    user = await get_current_user(request)
    imap = await _instructors()
    enrs = await db.group_enrollments.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    out = []
    for e in enrs:
        d = await db.group_trainings.find_one({"group_id": e["group_id"]}, {"_id": 0})
        if d:
            out.append(await _public(d, imap, with_links=True))
    return out


@router.post("/group-trainings/{group_id}/purchase")
async def purchase_group(group_id: str, request: Request):
    user = await get_current_user(request)
    d = await db.group_trainings.find_one({"group_id": group_id})
    if not d or not d.get("is_published"):
        raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
    if await db.group_enrollments.find_one({"group_id": group_id, "user_id": user["user_id"]}):
        raise HTTPException(status_code=400, detail="Bu eğitime zaten kayıtlısın")
    enrolled = await db.group_enrollments.count_documents({"group_id": group_id})
    if enrolled >= d.get("capacity", 0):
        raise HTTPException(status_code=400, detail="Bu eğitim için kontenjan doldu")
    total = float(d.get("price", 0))
    creds = await get_paytr_credentials()
    if not creds:
        raise HTTPException(status_code=503, detail="Kart ile ödeme henüz yapılandırılmadı. Lütfen daha sonra tekrar deneyin.")
    oid = new_id("PT").replace("_", "")
    order = {"order_id": oid, "user_id": user["user_id"], "user_email": user["email"], "user_name": user.get("name", ""),
             "kind": "group", "group_id": group_id,
             "items": [{"course_id": "", "title": d["title"], "price": total}],
             "subtotal": total, "discount": 0, "discount_code": None, "payment_method": "paytr",
             "total": total, "status": "pending", "created_at": now_utc().isoformat()}
    await db.orders.insert_one({**order})
    ip = request.client.host if request.client else "127.0.0.1"
    amount = int(round(total * 100))
    basket = base64.b64encode(json.dumps([[d["title"], f"{total:.2f}", 1]], ensure_ascii=False).encode()).decode()
    tm = 1 if creds["test_mode"] else 0
    raw = creds["merchant_id"] + ip + oid + user["email"] + str(amount) + basket + "0" + "0" + "TL" + str(tm) + creds["merchant_salt"]
    token = base64.b64encode(hmac.new(creds["merchant_key"].encode(), raw.encode(), hashlib.sha256).digest()).decode()
    form = {"merchant_id": creds["merchant_id"], "user_ip": ip, "merchant_oid": oid, "email": user["email"],
            "payment_amount": amount, "paytr_token": token, "user_basket": basket, "no_installment": 0,
            "max_installment": 0, "currency": "TL", "test_mode": tm, "debug_on": 1, "timeout_limit": 30, "lang": "tr",
            "user_name": user.get("name", "Musteri"), "user_address": "Turkiye", "user_phone": user.get("phone") or "05000000000",
            "merchant_ok_url": f"{FRONTEND_URL}/panel?group=ok", "merchant_fail_url": f"{FRONTEND_URL}/panel?group=fail"}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post("https://www.paytr.com/odeme/api/get-token", data=form)
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ödeme sağlayıcısına ulaşılamadı: {e}")
    if data.get("status") != "success":
        await db.orders.update_one({"order_id": oid}, {"$set": {"status": "token_failed", "reason": data.get("reason")}})
        raise HTTPException(status_code=502, detail=f"PayTR: {data.get('reason', 'token alınamadı')}")
    return {"status": "paytr", "order_id": oid, "iframe_url": "https://www.paytr.com/odeme/guvenli/" + data["token"]}


# ---------- Admin ----------
class LessonIn(BaseModel):
    id: str = ""
    title: str = ""
    date: str = ""
    time: str = ""
    meet_link: str = ""
    recording_url: str = ""


class GroupIn(BaseModel):
    title: str
    description: str = ""
    image: str = ""
    promo_video: str = ""
    what_you_learn: list = []
    requirements: list = []
    price: float = 0
    capacity: int = 0
    instructor_id: str = ""
    lessons: list = []
    is_published: bool = False


def _norm_lessons(lessons):
    out = []
    for l in lessons:
        out.append({"id": l.get("id") or new_id("gl"), "title": l.get("title", ""), "date": l.get("date", ""),
                    "time": l.get("time", ""), "meet_link": l.get("meet_link", ""), "recording_url": l.get("recording_url", "")})
    return out


@router.get("/admin/group-trainings")
async def admin_list(request: Request):
    await require_admin(request)
    imap = await _instructors()
    docs = await db.group_trainings.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await _public(d, imap, with_links=True) for d in docs]


@router.get("/admin/group-trainings/{group_id}")
async def admin_get(group_id: str, request: Request):
    await require_admin(request)
    d = await db.group_trainings.find_one({"group_id": group_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Bulunamadı")
    d["enrolled"] = await db.group_enrollments.count_documents({"group_id": group_id})
    return d


@router.post("/admin/group-trainings")
async def admin_create(body: GroupIn, request: Request):
    await require_admin(request)
    slug = _slug(body.title)
    if await db.group_trainings.find_one({"slug": slug}):
        slug = f"{slug}-{new_id('')[1:5]}"
    doc = body.model_dump()
    doc["lessons"] = _norm_lessons(doc.get("lessons", []))
    doc.update({"group_id": new_id("grp"), "slug": slug, "created_at": now_utc().isoformat()})
    await db.group_trainings.insert_one({**doc})
    doc.pop("_id", None)
    return doc


async def _notify_new_recordings(g_doc, old_lessons):
    """Email enrolled students when a lesson recording is published for the first time."""
    old_rec = {l.get("id"): (l.get("recording_url") or "").strip() for l in (old_lessons or [])}
    settings = await get_settings_doc()
    site_name = settings.get("site_name", "")
    enrs = None
    for l in g_doc.get("lessons", []):
        new_url = (l.get("recording_url") or "").strip()
        if not new_url or old_rec.get(l.get("id"), ""):
            continue
        key = {"group_id": g_doc["group_id"], "lesson_id": l.get("id")}
        if await db.group_recording_sent.find_one(key):
            continue
        await db.group_recording_sent.insert_one({**key, "sent_at": now_utc().isoformat()})
        if enrs is None:
            enrs = await db.group_enrollments.find({"group_id": g_doc["group_id"]}, {"_id": 0}).to_list(2000)
        for e in enrs:
            schedule_email("group_recording", e["user_email"], {
                "name": e.get("user_name", ""), "training": g_doc.get("title", ""), "lesson": l.get("title", ""),
                "panel_url": f"{FRONTEND_URL}/panel", "recording_url": new_url, "site_name": site_name})


@router.put("/admin/group-trainings/{group_id}")
async def admin_update(group_id: str, body: GroupIn, request: Request):
    await require_admin(request)
    old = await db.group_trainings.find_one({"group_id": group_id})
    if not old:
        raise HTTPException(status_code=404, detail="Bulunamadı")
    doc = body.model_dump()
    doc["lessons"] = _norm_lessons(doc.get("lessons", []))
    await db.group_trainings.update_one({"group_id": group_id}, {"$set": doc})
    updated = await db.group_trainings.find_one({"group_id": group_id}, {"_id": 0})
    try:
        await _notify_new_recordings(updated, old.get("lessons", []))
    except Exception as e:
        print(f"[group-recording] error: {e}")
    return updated


@router.delete("/admin/group-trainings/{group_id}")
async def admin_delete(group_id: str, request: Request):
    await require_admin(request)
    await db.group_trainings.delete_one({"group_id": group_id})
    return {"ok": True}


@router.get("/admin/group-trainings/{group_id}/students")
async def admin_students(group_id: str, request: Request):
    await require_admin(request)
    return await db.group_enrollments.find({"group_id": group_id}, {"_id": 0}).to_list(500)


# ---------- Cron: reminders ----------
async def _run_reminders():
    settings = await get_settings_doc()
    tr_now = datetime.now(timezone.utc) + timedelta(hours=3)
    async for g in db.group_trainings.find({"is_published": True}):
        enrs = await db.group_enrollments.find({"group_id": g["group_id"]}, {"_id": 0}).to_list(1000)
        if not enrs:
            continue
        for l in g.get("lessons", []):
            try:
                ldt = datetime.fromisoformat(f"{l.get('date')}T{l.get('time') or '00:00'}:00")
            except Exception:
                continue
            diff_h = (ldt - tr_now).total_seconds() / 3600.0
            kind = None
            if 23.0 < diff_h <= 24.25:
                kind = "24h"
            elif 0.5 < diff_h <= 1.25:
                kind = "1h"
            if not kind:
                continue
            for e in enrs:
                key = {"group_id": g["group_id"], "lesson_id": l.get("id"), "user_id": e["user_id"], "type": kind}
                if await db.group_reminders_sent.find_one(key):
                    continue
                await db.group_reminders_sent.insert_one({**key, "sent_at": now_utc().isoformat()})
                schedule_email("group_reminder", e["user_email"], {
                    "name": e.get("user_name", ""), "training": g["title"], "lesson": l.get("title", ""),
                    "when": _fmt(l.get("date"), l.get("time")), "meet_link": l.get("meet_link", ""),
                    "panel_url": f"{FRONTEND_URL}/panel", "site_name": settings.get("site_name", ""),
                    "remaining_label": "24 saat" if kind == "24h" else "1 saat"})


async def _run_reminders_safe():
    try:
        await _run_reminders()
    except Exception as e:
        print(f"[group-reminders] error: {e}")


@router.post("/cron/group-reminders")
async def cron_group_reminders(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    auth = request.headers.get("Authorization", "")
    if not CRON_SECRET or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], CRON_SECRET):
        raise HTTPException(status_code=401, detail="unauthorized")
    import asyncio
    asyncio.create_task(_run_reminders_safe())
    return {"ok": True}
