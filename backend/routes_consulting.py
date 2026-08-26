import base64
import hashlib
import hmac
import json
import os

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from deps import (db, now_utc, new_id, get_current_user, require_admin,
                  get_settings_doc, push_notification, schedule_email, get_paytr_credentials)

router = APIRouter()

FRONTEND_URL = os.environ.get("CORS_ORIGINS", "").split(",")[0]
WEEKDAYS_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
MONTHS_TR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
ACTIVE_STATUSES = ["pending", "approved", "rescheduled", "completed"]
STATUS_TR = {"pending": "Beklemede", "approved": "Onaylandı", "rejected": "Reddedildi",
             "rescheduled": "Yeni saat önerildi", "cancelled": "İptal edildi", "completed": "Tamamlandı"}


def _fmt_dt(date_str: str, time_str: str) -> str:
    try:
        d = datetime.fromisoformat(date_str)
        return f"{WEEKDAYS_TR[d.weekday()]}, {d.day} {MONTHS_TR[d.month]} {d.year} · {time_str}"
    except Exception:
        return f"{date_str} {time_str}"


def _cfg(doc: dict) -> dict:
    c = doc.get("consulting") or {}
    return {"enabled": c.get("enabled", True), "price": c.get("price", 0),
            "weekly": c.get("weekly", {}), "weeks_ahead": c.get("weeks_ahead", 4)}


async def _available_credits(user_id: str):
    granted_courses = await db.enrollments.count_documents({"user_id": user_id, "source": {"$ne": "free"}})
    granted_paid = await db.orders.count_documents({"user_id": user_id, "kind": "consulting", "status": "paid"})
    granted = granted_courses + granted_paid
    consumed = await db.consulting_bookings.count_documents({"user_id": user_id, "status": {"$in": ACTIVE_STATUSES}})
    return max(0, granted - consumed), granted, consumed


async def _generate_slots(cfg: dict):
    weekly = cfg["weekly"]
    if not weekly:
        return []
    tr_now = datetime.now(timezone.utc) + timedelta(hours=3)
    today = tr_now.date()
    end = today + timedelta(weeks=cfg["weeks_ahead"])
    booked = set()
    async for b in db.consulting_bookings.find({"status": {"$in": ACTIVE_STATUSES}}, {"date": 1, "time": 1, "_id": 0}):
        booked.add((b.get("date"), b.get("time")))
    slots = []
    d = today
    while d <= end:
        for r in weekly.get(str(d.weekday()), []):
            try:
                sh = int(str(r["start"]).split(":")[0]); eh = int(str(r["end"]).split(":")[0])
            except Exception:
                continue
            for h in range(sh, eh):
                if d == today and h <= tr_now.hour:
                    continue
                t = f"{h:02d}:00"
                if (d.isoformat(), t) in booked:
                    continue
                slots.append({"date": d.isoformat(), "time": t, "weekday": WEEKDAYS_TR[d.weekday()]})
        d += timedelta(days=1)
    return slots


async def _email_booking(booking, template_key):
    settings = await get_settings_doc()
    schedule_email(template_key, booking.get("user_email"), {
        "name": booking.get("user_name", ""),
        "datetime": _fmt_dt(booking.get("date", ""), booking.get("time", "")),
        "proposed": _fmt_dt(booking.get("proposed_date", ""), booking.get("proposed_time", "")),
        "note": booking.get("admin_note", "") or "-",
        "panel_url": f"{FRONTEND_URL}/panel",
        "site_name": settings.get("site_name", ""),
    })


# ---------------- Student ----------------
@router.get("/consulting/summary")
async def consulting_summary(request: Request):
    user = await get_current_user(request)
    doc = await get_settings_doc(); cfg = _cfg(doc)
    avail, granted, consumed = await _available_credits(user["user_id"])
    bookings = await db.consulting_bookings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for b in bookings:
        b["status_label"] = STATUS_TR.get(b.get("status"), b.get("status"))
    return {"enabled": cfg["enabled"], "price": cfg["price"], "available_credits": avail,
            "granted": granted, "used": consumed, "bookings": bookings}


@router.get("/consulting/slots")
async def consulting_slots(request: Request):
    await get_current_user(request)
    doc = await get_settings_doc(); cfg = _cfg(doc)
    if not cfg["enabled"]:
        return []
    return await _generate_slots(cfg)


class BookIn(BaseModel):
    date: str
    time: str


@router.post("/consulting/book")
async def consulting_book(body: BookIn, request: Request):
    user = await get_current_user(request)
    doc = await get_settings_doc(); cfg = _cfg(doc)
    if not cfg["enabled"]:
        raise HTTPException(status_code=400, detail="Bire bir danışmanlık şu anda kapalı")
    avail, _, _ = await _available_credits(user["user_id"])
    if avail <= 0:
        raise HTTPException(status_code=400, detail="Kullanılabilir danışmanlık hakkın bulunmuyor")
    slots = await _generate_slots(cfg)
    if not any(s["date"] == body.date and s["time"] == body.time for s in slots):
        raise HTTPException(status_code=400, detail="Seçilen zaman dilimi uygun değil veya dolu")
    if await db.consulting_bookings.find_one({"date": body.date, "time": body.time, "status": {"$in": ACTIVE_STATUSES}}):
        raise HTTPException(status_code=400, detail="Bu zaman dilimi az önce doldu, lütfen başka bir saat seçin")
    booking = {"booking_id": new_id("cbk"), "user_id": user["user_id"], "user_name": user.get("name", ""),
               "user_email": user.get("email", ""), "date": body.date, "time": body.time, "status": "pending",
               "admin_note": "", "proposed_date": "", "proposed_time": "",
               "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}
    await db.consulting_bookings.insert_one({**booking})
    await push_notification("consulting_request", "Yeni danışmanlık talebi",
                            f"{user.get('name', '')} · {body.date} {body.time}", {"booking_id": booking["booking_id"]})
    return booking


class RespondIn(BaseModel):
    action: str


@router.post("/consulting/bookings/{booking_id}/respond")
async def respond_proposal(booking_id: str, body: RespondIn, request: Request):
    user = await get_current_user(request)
    b = await db.consulting_bookings.find_one({"booking_id": booking_id, "user_id": user["user_id"]})
    if not b or b.get("status") != "rescheduled":
        raise HTTPException(status_code=404, detail="Öneri bulunamadı")
    if body.action == "accept":
        clash = await db.consulting_bookings.find_one({"date": b["proposed_date"], "time": b["proposed_time"],
                                                       "status": {"$in": ACTIVE_STATUSES}, "booking_id": {"$ne": booking_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Önerilen saat başka bir kayıtla doldu")
        await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {
            "date": b["proposed_date"], "time": b["proposed_time"], "status": "approved",
            "proposed_date": "", "proposed_time": "", "updated_at": now_utc().isoformat()}})
    else:
        await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {
            "status": "cancelled", "updated_at": now_utc().isoformat()}})
    return {"ok": True}


@router.post("/consulting/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, request: Request):
    user = await get_current_user(request)
    b = await db.consulting_bookings.find_one({"booking_id": booking_id, "user_id": user["user_id"]})
    if not b or b.get("status") not in ["pending", "rescheduled"]:
        raise HTTPException(status_code=400, detail="Bu kayıt iptal edilemez")
    await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "cancelled", "updated_at": now_utc().isoformat()}})
    return {"ok": True}


@router.post("/consulting/purchase")
async def consulting_purchase(request: Request, response: Response):
    """Paid 1-hour consulting credit via credit card (PayTR)."""
    user = await get_current_user(request)
    doc = await get_settings_doc(); cfg = _cfg(doc)
    if not cfg["enabled"] or not cfg["price"]:
        raise HTTPException(status_code=400, detail="Ücretli danışmanlık şu anda satışta değil")
    total = float(cfg["price"])
    creds = await get_paytr_credentials()
    if not creds:
        raise HTTPException(status_code=503, detail="Kart ile ödeme henüz yapılandırılmadı. Lütfen daha sonra tekrar deneyin.")
    oid = new_id("PT").replace("_", "")
    order = {"order_id": oid, "user_id": user["user_id"], "user_email": user["email"],
             "user_name": user.get("name", ""), "user_phone": user.get("phone", ""),
             "kind": "consulting", "items": [{"course_id": "", "title": "Bire Bir Danışmanlık (1 saat)", "price": total}],
             "subtotal": total, "discount": 0, "discount_code": None, "payment_method": "paytr",
             "transfer_discount": 0, "billing": {}, "total": total, "status": "pending",
             "created_at": now_utc().isoformat()}
    await db.orders.insert_one({**order})

    user_ip = request.client.host if request.client else "127.0.0.1"
    amount = int(round(total * 100))
    basket = base64.b64encode(json.dumps([["Bire Bir Danışmanlık", f"{total:.2f}", 1]], ensure_ascii=False).encode()).decode()
    test_mode = 1 if creds["test_mode"] else 0
    raw = (creds["merchant_id"] + user_ip + oid + user["email"] + str(amount) + basket + "0" + "0" + "TL" + str(test_mode) + creds["merchant_salt"])
    paytr_token = base64.b64encode(hmac.new(creds["merchant_key"].encode(), raw.encode(), hashlib.sha256).digest()).decode()
    form = {"merchant_id": creds["merchant_id"], "user_ip": user_ip, "merchant_oid": oid, "email": user["email"],
            "payment_amount": amount, "paytr_token": paytr_token, "user_basket": basket, "no_installment": 0,
            "max_installment": 0, "currency": "TL", "test_mode": test_mode, "debug_on": 1, "timeout_limit": 30,
            "lang": "tr", "user_name": user.get("name", "Musteri"), "user_address": "Turkiye",
            "user_phone": (user.get("phone") or "05000000000"),
            "merchant_ok_url": f"{FRONTEND_URL}/panel?consulting=ok", "merchant_fail_url": f"{FRONTEND_URL}/panel?consulting=fail"}
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post("https://www.paytr.com/odeme/api/get-token", data=form)
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ödeme sağlayıcısına ulaşılamadı: {e}")
    if data.get("status") != "success":
        await db.orders.update_one({"order_id": oid}, {"$set": {"status": "token_failed", "reason": data.get("reason")}})
        raise HTTPException(status_code=502, detail=f"PayTR: {data.get('reason', 'token alınamadı')}")
    await db.orders.update_one({"order_id": oid}, {"$set": {"iframe_token": data["token"]}})
    return {"status": "paytr", "order_id": oid, "iframe_url": "https://www.paytr.com/odeme/guvenli/" + data["token"]}


# ---------------- Admin ----------------
class ConfigIn(BaseModel):
    enabled: bool = True
    price: float = 0
    weekly: dict = {}


@router.get("/admin/consulting/config")
async def admin_get_config(request: Request):
    await require_admin(request)
    return _cfg(await get_settings_doc())


@router.put("/admin/consulting/config")
async def admin_set_config(body: ConfigIn, request: Request):
    await require_admin(request)
    await db.settings.update_one({"_id": "site"}, {"$set": {
        "consulting.enabled": body.enabled, "consulting.price": body.price,
        "consulting.weekly": body.weekly, "consulting.weeks_ahead": 4}})
    return {"ok": True}


@router.get("/admin/consulting/pending-count")
async def admin_pending_count(request: Request):
    await require_admin(request)
    n = await db.consulting_bookings.count_documents({"status": "pending"})
    return {"count": n}


@router.get("/admin/consulting/bookings")
async def admin_bookings(request: Request):
    await require_admin(request)
    items = await db.consulting_bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for b in items:
        b["status_label"] = STATUS_TR.get(b.get("status"), b.get("status"))
    return items


class NoteIn(BaseModel):
    note: str = ""


class ProposeIn(BaseModel):
    date: str
    time: str
    note: str = ""


@router.post("/admin/consulting/bookings/{booking_id}/approve")
async def admin_approve(booking_id: str, request: Request):
    await require_admin(request)
    b = await db.consulting_bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "approved", "updated_at": now_utc().isoformat()}})
    await _email_booking(b, "consulting_approved")
    return {"ok": True}


@router.post("/admin/consulting/bookings/{booking_id}/reject")
async def admin_reject(booking_id: str, body: NoteIn, request: Request):
    await require_admin(request)
    b = await db.consulting_bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    b["admin_note"] = body.note
    await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "rejected", "admin_note": body.note, "updated_at": now_utc().isoformat()}})
    await _email_booking(b, "consulting_rejected")
    return {"ok": True}


@router.post("/admin/consulting/bookings/{booking_id}/propose")
async def admin_propose(booking_id: str, body: ProposeIn, request: Request):
    await require_admin(request)
    b = await db.consulting_bookings.find_one({"booking_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    clash = await db.consulting_bookings.find_one({"date": body.date, "time": body.time,
                                                   "status": {"$in": ACTIVE_STATUSES}, "booking_id": {"$ne": booking_id}})
    if clash:
        raise HTTPException(status_code=400, detail="Önerilen zaman dilimi başka bir kayıtla dolu")
    await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {
        "status": "rescheduled", "proposed_date": body.date, "proposed_time": body.time,
        "admin_note": body.note, "updated_at": now_utc().isoformat()}})
    b["proposed_date"] = body.date; b["proposed_time"] = body.time; b["admin_note"] = body.note
    await _email_booking(b, "consulting_proposed")
    return {"ok": True}
