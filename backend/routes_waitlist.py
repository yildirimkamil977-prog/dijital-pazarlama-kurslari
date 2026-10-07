import os
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from deps import db, now_utc, require_admin, send_templated

router = APIRouter()
logger = logging.getLogger(__name__)
SITE = os.environ.get("CORS_ORIGINS", "").split(",")[0].rstrip("/")


def _fmt(v: float) -> str:
    return f"{v:,.0f}".replace(",", ".")


async def launch_code_info(course: dict) -> Optional[dict]:
    """Validates the course's launch discount code; returns {code, text} or raises 400."""
    code = (course.get("launch_discount_code") or "").strip().upper()
    if not code:
        return None
    d = await db.discount_codes.find_one({"code": code}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=400, detail=f"Açılış indirim kodu '{code}' bulunamadı")
    if not d.get("active", True):
        raise HTTPException(status_code=400, detail=f"Açılış indirim kodu '{code}' pasif durumda")
    if (d.get("course_ids") or d.get("group_ids")) and course["course_id"] not in (d.get("course_ids") or []):
        raise HTTPException(status_code=400, detail=f"'{code}' kodu bu kursta geçerli değil; kodu bu kursa tanımlayın")
    if d.get("usage_limit") and d.get("used_count", 0) >= d["usage_limit"]:
        raise HTTPException(status_code=400, detail=f"'{code}' kodunun kullanım limiti dolmuş")
    text = f"%{_fmt(d['value'])} indirim" if d.get("type") == "percent" else f"{_fmt(d['value'])} TL indirim"
    return {"code": code, "text": text}


def _ctx(course: dict, entry: dict, info: Optional[dict]) -> dict:
    url = f"{SITE}/kurslar/{course['slug']}"
    block, link = "", url
    if info:
        link = f"{url}?kod={info['code']}"
        block = ('<div style="margin:22px 0;padding:18px 20px;border:1px dashed #FFB800;border-radius:12px;background:rgba(255,184,0,0.08)">'
                 '<p style="margin:0 0 6px;font-size:13px;color:#c9cfdb">Listede olduğun için sana özel</p>'
                 f'<p style="margin:0 0 10px;font-size:20px;font-weight:bold;color:#FFB800">{info["text"]}</p>'
                 f'<p style="margin:0;font-size:13px;color:#c9cfdb">Kod: <strong style="font-size:18px;letter-spacing:2px;color:#ffffff">{info["code"]}</strong><br/>'
                 'Aşağıdaki butona tıklarsan kod ödeme sayfasında otomatik uygulanır.</p></div>')
    return {"name": entry.get("name") or "Merhaba", "email": entry["email"], "course_title": course["title"], "course_url": link,
            "discount_code": info["code"] if info else "", "discount_text": info["text"] if info else "", "discount_block": block}


async def _send_launch(course: dict, entries: list, info: Optional[dict]):
    for e in entries:
        try:
            await send_templated("course_launch", e["email"], _ctx(course, e, info))
            await db.course_waitlist.update_one({"course_id": course["course_id"], "email": e["email"]},
                                                {"$set": {"notified_at": now_utc().isoformat(), "notified_code": info["code"] if info else ""}})
        except Exception as ex:
            logger.error("launch email failed %s: %s", e["email"], ex)
        await asyncio.sleep(0.6)


def send_joined(course: dict, entry: dict):
    asyncio.create_task(send_templated("waitlist_joined", entry["email"], _ctx(course, entry, None)))


@router.get("/admin/waitlist")
async def list_waitlist(request: Request, course_id: str = "", status: str = "", search: str = ""):
    await require_admin(request)
    q: dict = {}
    if course_id:
        q["course_id"] = course_id
    if status == "pending":
        q["notified_at"] = {"$in": [None, ""]}
    elif status == "notified":
        q["notified_at"] = {"$nin": [None, ""]}
    if search:
        import re
        q["$or"] = [{"email": {"$regex": re.escape(search), "$options": "i"}}, {"name": {"$regex": re.escape(search), "$options": "i"}}]
    rows = await db.course_waitlist.find(q, {"_id": 0}).sort("created_at", -1).to_list(10000)
    titles = {c["course_id"]: c["title"] for c in await db.courses.find({}, {"_id": 0, "course_id": 1, "title": 1}).to_list(1000)}
    for r in rows:
        r["course_title"] = titles.get(r["course_id"], r["course_id"])
    return rows


class NotifyIn(BaseModel):
    emails: list = []


@router.post("/admin/courses/{course_id}/waitlist/notify")
async def notify_waitlist(course_id: str, body: NotifyIn, request: Request):
    """emails empty -> all pending entries; emails given -> (re)send to those."""
    await require_admin(request)
    c = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
    if c.get("sale_closed") or not c.get("is_published"):
        raise HTTPException(status_code=400, detail="Kurs satışa açık ve yayında olmalı")
    info = await launch_code_info(c)
    q = {"course_id": course_id, **({"email": {"$in": [e.lower() for e in body.emails]}} if body.emails else {"notified_at": {"$in": [None, ""]}})}
    entries = await db.course_waitlist.find(q, {"_id": 0}).to_list(10000)
    asyncio.create_task(_send_launch(c, entries, info))
    return {"queued": len(entries), "code": info["code"] if info else ""}


@router.get("/admin/courses/{course_id}/waitlist/summary")
async def waitlist_summary(course_id: str, request: Request):
    await require_admin(request)
    pending = await db.course_waitlist.count_documents({"course_id": course_id, "notified_at": {"$in": [None, ""]}})
    total = await db.course_waitlist.count_documents({"course_id": course_id})
    return {"pending": pending, "total": total}
