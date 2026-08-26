from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
from typing import Optional

from deps import (db, now_utc, new_id, get_current_user, require_admin,
                  get_settings_doc, push_notification)

router = APIRouter()

WEEKDAYS_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
ACTIVE_STATUSES = ["pending", "approved", "rescheduled", "completed"]
STATUS_TR = {"pending": "Beklemede", "approved": "Onaylandı", "rejected": "Reddedildi",
             "rescheduled": "Yeni saat önerildi", "cancelled": "İptal edildi", "completed": "Tamamlandı"}


def _cfg(doc: dict) -> dict:
    c = doc.get("consulting") or {}
    return {"enabled": c.get("enabled", True), "price": c.get("price", 0),
            "weekly": c.get("weekly", {}), "weeks_ahead": c.get("weeks_ahead", 4)}


async def _available_credits(user_id: str):
    granted_courses = await db.enrollments.count_documents({"user_id": user_id, "source": {"$ne": "free"}})
    granted_paid = await db.consulting_purchases.count_documents({"user_id": user_id, "status": "paid"})
    granted = granted_courses + granted_paid
    consumed = await db.consulting_bookings.count_documents({"user_id": user_id, "status": {"$in": ACTIVE_STATUSES}})
    return max(0, granted - consumed), granted, consumed


async def _generate_slots(cfg: dict):
    weekly = cfg["weekly"]
    if not weekly:
        return []
    tr_now = datetime.now(timezone.utc) + timedelta(hours=3)  # Turkey local time
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


# ---------------- Student ----------------
@router.get("/consulting/summary")
async def consulting_summary(request: Request):
    user = await get_current_user(request)
    doc = await get_settings_doc(); cfg = _cfg(doc)
    avail, granted, consumed = await _available_credits(user["user_id"])
    bookings = await db.consulting_bookings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for b in bookings:
        b["status_label"] = STATUS_TR.get(b.get("status"), b.get("status"))
    purchases = await db.consulting_purchases.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"enabled": cfg["enabled"], "price": cfg["price"], "available_credits": avail,
            "granted": granted, "used": consumed, "bookings": bookings, "purchases": purchases,
            "bank_accounts": doc.get("bank_accounts", [])}


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
    existing = await db.consulting_bookings.find_one({"date": body.date, "time": body.time, "status": {"$in": ACTIVE_STATUSES}})
    if existing:
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
    action: str  # accept | decline


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
async def consulting_purchase(request: Request):
    user = await get_current_user(request)
    doc = await get_settings_doc(); cfg = _cfg(doc)
    if not cfg["enabled"] or not cfg["price"]:
        raise HTTPException(status_code=400, detail="Ücretli danışmanlık şu anda satışta değil")
    p = {"purchase_id": new_id("cpr"), "user_id": user["user_id"], "user_name": user.get("name", ""),
         "user_email": user.get("email", ""), "amount": cfg["price"], "status": "awaiting_transfer",
         "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}
    await db.consulting_purchases.insert_one({**p})
    await push_notification("consulting_purchase", "Danışmanlık satın alma (Havale)",
                            f"{user.get('name', '')} · {cfg['price']} ₺", {"purchase_id": p["purchase_id"]})
    return {**p, "bank_accounts": doc.get("bank_accounts", [])}


# ---------------- Admin ----------------
class ConfigIn(BaseModel):
    enabled: bool = True
    price: float = 0
    weekly: dict = {}


@router.get("/admin/consulting/config")
async def admin_get_config(request: Request):
    await require_admin(request)
    doc = await get_settings_doc()
    return _cfg(doc)


@router.put("/admin/consulting/config")
async def admin_set_config(body: ConfigIn, request: Request):
    await require_admin(request)
    await db.settings.update_one({"_id": "site"}, {"$set": {
        "consulting.enabled": body.enabled, "consulting.price": body.price,
        "consulting.weekly": body.weekly, "consulting.weeks_ahead": 4}})
    return {"ok": True}


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
    await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "approved", "updated_at": now_utc().isoformat()}})
    return {"ok": True}


@router.post("/admin/consulting/bookings/{booking_id}/reject")
async def admin_reject(booking_id: str, body: NoteIn, request: Request):
    await require_admin(request)
    await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {"status": "rejected", "admin_note": body.note, "updated_at": now_utc().isoformat()}})
    return {"ok": True}


@router.post("/admin/consulting/bookings/{booking_id}/propose")
async def admin_propose(booking_id: str, body: ProposeIn, request: Request):
    await require_admin(request)
    clash = await db.consulting_bookings.find_one({"date": body.date, "time": body.time,
                                                   "status": {"$in": ACTIVE_STATUSES}, "booking_id": {"$ne": booking_id}})
    if clash:
        raise HTTPException(status_code=400, detail="Önerilen zaman dilimi başka bir kayıtla dolu")
    await db.consulting_bookings.update_one({"booking_id": booking_id}, {"$set": {
        "status": "rescheduled", "proposed_date": body.date, "proposed_time": body.time,
        "admin_note": body.note, "updated_at": now_utc().isoformat()}})
    return {"ok": True}


@router.get("/admin/consulting/purchases")
async def admin_purchases(request: Request):
    await require_admin(request)
    return await db.consulting_purchases.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/admin/consulting/purchases/{purchase_id}/approve")
async def admin_approve_purchase(purchase_id: str, request: Request):
    await require_admin(request)
    await db.consulting_purchases.update_one({"purchase_id": purchase_id}, {"$set": {"status": "paid", "updated_at": now_utc().isoformat()}})
    return {"ok": True}


@router.post("/admin/consulting/purchases/{purchase_id}/reject")
async def admin_reject_purchase(purchase_id: str, request: Request):
    await require_admin(request)
    await db.consulting_purchases.update_one({"purchase_id": purchase_id}, {"$set": {"status": "rejected", "updated_at": now_utc().isoformat()}})
    return {"ok": True}
