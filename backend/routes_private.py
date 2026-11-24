import os
import re
import html as _html
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from deps import db, now_utc, new_id, require_admin, get_current_user, schedule_email, push_notification

router = APIRouter()
SITE = lambda: (os.environ.get("CORS_ORIGINS", "").split(",")[0])


def _slug(text: str) -> str:
    tr = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    return re.sub(r"[^a-z0-9]+", "-", text.translate(tr).lower()).strip("-")


def private_price(p: dict) -> float:
    dp = p.get("discount_price")
    price = float(p.get("price", 0))
    return float(dp) if dp is not None and 0 <= dp < price else price


async def _instructor(iid):
    if not iid:
        return None
    d = await db.instructors.find_one({"instructor_id": iid}, {"_id": 0})
    return d and {"instructor_id": d["instructor_id"], "name": d.get("name", ""), "slug": d.get("slug", ""), "title": d.get("title", ""),
                  "avatar": d.get("avatar", ""), "bio": d.get("bio", "")}


async def _public(p: dict) -> dict:
    keys = ["private_id", "title", "slug", "description", "long_description", "image", "promo_video", "price", "discount_price",
            "lesson_count", "lesson_duration", "curriculum", "what_you_learn", "requirements", "sale_stopped", "is_published"]
    out = {k: p.get(k) for k in keys}
    out["effective_price"] = private_price(p)
    out["instructor"] = await _instructor(p.get("instructor_id"))
    return out


class PrivateIn(BaseModel):
    title: str
    slug: str = ""
    description: str = ""
    long_description: str = ""
    image: str = ""
    promo_video: str = ""
    price: float = 0
    discount_price: Optional[float] = None
    lesson_count: int = 8
    lesson_duration: str = "60-90 dakika"
    curriculum: list = []
    what_you_learn: List[str] = []
    requirements: List[str] = []
    instructor_id: str = ""
    cross_sell_ids: list = []
    sale_stopped: bool = False
    is_published: bool = False


class NotifyIn(BaseModel):
    email: str
    name: str = ""


DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
SLOTS = ["09:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00", "21:00-23:00"]


class AvailabilityIn(BaseModel):
    availability: dict = {}
    note: str = ""


def _questions_until(e: dict) -> str:
    try:
        if e.get("last_lesson_date"):
            return (datetime.fromisoformat(e["last_lesson_date"]) + timedelta(days=30)).date().isoformat()
    except ValueError:
        pass
    return ""


def _tr_date(iso: str) -> str:
    return ".".join(reversed(iso[:10].split("-"))) if iso else ""


def _availability_html(av: dict, note: str) -> str:
    rows = "".join(f"<tr><td style=\"padding:6px 12px 6px 0;color:#fff;font-weight:bold\">{d}</td><td style=\"padding:6px 0;color:#c7cbd6\">{', '.join(av[d])}</td></tr>" for d in DAYS if av.get(d))
    out = f"<table style=\"border-collapse:collapse;margin:8px 0 14px\">{rows}</table>"
    if note:
        out += f"<p style=\"color:#8a92a6\">Notun: {_html.escape(note)}</p>"
    return out


class EnrollUpdateIn(BaseModel):
    recordings: list = []
    last_lesson_date: str = ""
    note: str = ""


# ---------- Public ----------
@router.get("/private-trainings")
async def list_private():
    docs = await db.private_trainings.find({"is_published": True}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return [await _public(d) for d in docs]


@router.get("/private-trainings/{slug}")
async def get_private(slug: str):
    d = await db.private_trainings.find_one({"slug": slug, "is_published": True}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
    return await _public(d)


@router.post("/private-trainings/{private_id}/notify")
async def join_waitlist(private_id: str, body: NotifyIn):
    p = await db.private_trainings.find_one({"private_id": private_id})
    email = body.email.strip().lower()
    if not p or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Geçerli bir e-posta girin")
    if not await db.private_waitlist.find_one({"private_id": private_id, "email": email, "notified": False}):
        await db.private_waitlist.insert_one({"wl_id": new_id("pwl"), "private_id": private_id, "email": email, "name": body.name.strip(),
                                              "notified": False, "created_at": now_utc().isoformat()})
        await push_notification("waitlist", "Bire bir eğitim: haber ver kaydı", f"{email} · {p['title']}", {"private_id": private_id}, email=False)
    return {"ok": True}


# ---------- Student ----------
@router.get("/my/private-trainings")
async def my_private(request: Request):
    user = await get_current_user(request)
    out = []
    for e in await db.private_enrollments.find({"user_id": user["user_id"]}, {"_id": 0}).sort("enrolled_at", -1).to_list(100):
        p = await db.private_trainings.find_one({"private_id": e["private_id"]}, {"_id": 0}) or {}
        until = _questions_until(e)
        out.append({**e, "title": p.get("title", ""), "image": p.get("image", ""), "slug": p.get("slug", ""),
                    "lesson_count": p.get("lesson_count"), "lesson_duration": p.get("lesson_duration", ""), "questions_until": until})
    return out


async def enroll_private_item(order: dict, private_id: str):
    if not await db.private_enrollments.find_one({"private_id": private_id, "user_id": order["user_id"]}):
        await db.private_enrollments.insert_one({
            "enr_id": new_id("penr"), "private_id": private_id, "user_id": order["user_id"],
            "user_name": order.get("user_name", ""), "user_email": order["user_email"], "user_phone": order.get("user_phone", ""),
            "order_id": order.get("order_id"), "recordings": [], "last_lesson_date": "", "note": "",
            "enrolled_at": now_utc().isoformat()})
    p = await db.private_trainings.find_one({"private_id": private_id}) or {}
    schedule_email("private_purchase", order["user_email"], {"name": order.get("user_name", ""), "training": p.get("title", ""),
                                                             "panel_url": SITE() + "/panel"})
    await push_notification("private", "Yeni bire bir eğitim kaydı — planlama için iletişime geçin",
                            f"{order.get('user_name', '')} · {order['user_email']} · {p.get('title', '')}", {"private_id": private_id})


@router.put("/my/private-enrollments/{enr_id}/availability")
async def save_availability(enr_id: str, body: AvailabilityIn, request: Request):
    user = await get_current_user(request)
    e = await db.private_enrollments.find_one({"enr_id": enr_id, "user_id": user["user_id"]})
    if not e:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    av = {d: [s for s in SLOTS if s in (body.availability.get(d) or [])] for d in DAYS}
    av = {d: v for d, v in av.items() if v}
    if not av:
        raise HTTPException(status_code=400, detail="En az bir gün ve saat aralığı seçin")
    note = body.note.strip()[:1000]
    first = not e.get("availability_at")
    await db.private_enrollments.update_one({"enr_id": enr_id}, {"$set": {"availability": av, "availability_note": note,
                                                                       "availability_at": now_utc().isoformat()}})
    p = await db.private_trainings.find_one({"private_id": e["private_id"]}) or {}
    schedule_email("private_availability_received", e["user_email"], {"name": e.get("user_name", ""), "training": p.get("title", ""),
                   "availability_html": _availability_html(av, note), "panel_url": SITE() + "/panel"})
    summary = " · ".join(f"{d}: {', '.join(v)}" for d, v in av.items())
    await push_notification("private", f"Müsaitlik formu {'dolduruldu' if first else 'güncellendi'} — {p.get('title', '')}",
                            f"{e.get('user_name', '')} · {e['user_email']} · {summary}" + (f" · Not: {note}" if note else ""), {"private_id": e["private_id"]})
    return {"ok": True}


# ---------- Admin ----------
@router.get("/admin/private-trainings")
async def admin_list(request: Request):
    await require_admin(request)
    docs = await db.private_trainings.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    for d in docs:
        d["enrolled"] = await db.private_enrollments.count_documents({"private_id": d["private_id"]})
        d["waiting"] = await db.private_waitlist.count_documents({"private_id": d["private_id"], "notified": False})
    return docs


@router.get("/admin/private-trainings/{private_id}")
async def admin_get(private_id: str, request: Request):
    await require_admin(request)
    d = await db.private_trainings.find_one({"private_id": private_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Bulunamadı")
    return d


async def _save(body: PrivateIn, private_id: Optional[str]):
    data = body.model_dump()
    data["slug"] = _slug(data["slug"] or data["title"])
    if await db.private_trainings.find_one({"slug": data["slug"], "private_id": {"$ne": private_id}}):
        data["slug"] += "-" + new_id("x")[-4:]
    data["updated_at"] = now_utc().isoformat()
    return data


@router.post("/admin/private-trainings")
async def admin_create(body: PrivateIn, request: Request):
    await require_admin(request)
    data = await _save(body, None)
    data.update(private_id=new_id("prv"), created_at=now_utc().isoformat())
    await db.private_trainings.insert_one({**data})
    return {"private_id": data["private_id"]}


@router.put("/admin/private-trainings/{private_id}")
async def admin_update(private_id: str, body: PrivateIn, request: Request):
    await require_admin(request)
    old = await db.private_trainings.find_one({"private_id": private_id})
    if not old:
        raise HTTPException(status_code=404, detail="Bulunamadı")
    data = await _save(body, private_id)
    await db.private_trainings.update_one({"private_id": private_id}, {"$set": data})
    notified = 0
    if old.get("sale_stopped") and not data["sale_stopped"] and data["is_published"]:
        url = f"{SITE()}/bire-bir-canli-egitimler/{data['slug']}"
        async for w in db.private_waitlist.find({"private_id": private_id, "notified": False}):
            schedule_email("private_reopen", w["email"], {"name": w.get("name") or "", "training": data["title"], "training_url": url})
            notified += 1
        await db.private_waitlist.update_many({"private_id": private_id, "notified": False},
                                              {"$set": {"notified": True, "notified_at": now_utc().isoformat()}})
    return {"ok": True, "notified": notified}


@router.delete("/admin/private-trainings/{private_id}")
async def admin_delete(private_id: str, request: Request):
    await require_admin(request)
    if await db.private_enrollments.count_documents({"private_id": private_id}):
        raise HTTPException(status_code=400, detail="Kayıtlı öğrencisi olan eğitim silinemez; yayından kaldırabilirsiniz")
    await db.private_trainings.delete_one({"private_id": private_id})
    return {"ok": True}


@router.get("/admin/private-trainings/{private_id}/students")
async def admin_students(private_id: str, request: Request):
    await require_admin(request)
    enr = await db.private_enrollments.find({"private_id": private_id}, {"_id": 0}).sort("enrolled_at", -1).to_list(500)
    for e in enr:
        e["questions_until"] = _questions_until(e)
    wl = await db.private_waitlist.find({"private_id": private_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"enrollments": enr, "waitlist": wl}


@router.put("/admin/private-enrollments/{enr_id}")
async def admin_update_enrollment(enr_id: str, body: EnrollUpdateIn, request: Request):
    await require_admin(request)
    if body.last_lesson_date and not re.match(r"^\d{4}-\d{2}-\d{2}$", body.last_lesson_date):
        raise HTTPException(status_code=400, detail="Son ders tarihi YYYY-AA-GG biçiminde olmalı")
    recs = [{"title": (r.get("title") or "").strip(), "url": (r.get("url") or "").strip(), "date": r.get("date", "")}
            for r in body.recordings if (r.get("url") or "").strip()]
    old = await db.private_enrollments.find_one({"enr_id": enr_id})
    if not old:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    await db.private_enrollments.update_one({"enr_id": enr_id}, {"$set": {"recordings": recs, "last_lesson_date": body.last_lesson_date, "note": body.note}})
    p = await db.private_trainings.find_one({"private_id": old["private_id"]}) or {}
    ctx = {"name": old.get("user_name", ""), "training": p.get("title", ""), "panel_url": SITE() + "/panel"}
    old_urls = {r.get("url") for r in old.get("recordings", [])}
    new_recs = [r for r in recs if r["url"] not in old_urls]
    sent = []
    if new_recs:
        names = ", ".join(r["title"] or "Ders kaydı" for r in new_recs)
        schedule_email("private_recording_added", old["user_email"], {**ctx, "recording_count": len(new_recs), "recordings": names})
        sent.append("recording")
    if body.last_lesson_date and body.last_lesson_date != old.get("last_lesson_date"):
        until = _questions_until({"last_lesson_date": body.last_lesson_date})
        schedule_email("private_completed", old["user_email"], {**ctx, "questions_until": _tr_date(until)})
        sent.append("completed")
    return {"ok": True, "emails": sent}
