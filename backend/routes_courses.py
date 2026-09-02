import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from deps import db, now_utc, new_id, get_current_user, get_optional_user, get_public_settings, get_settings_doc, schedule_email, push_notification

FRONTEND_URL = os.environ.get("CORS_ORIGINS", "").split(",")[0]

router = APIRouter()


def _course_pricing(c: dict) -> dict:
    from datetime import datetime, timezone
    pub = c.get("publish_at") or ""
    is_upcoming = False
    if pub:
        try:
            dt = datetime.fromisoformat(str(pub).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            is_upcoming = dt > datetime.now(timezone.utc)
        except Exception:
            is_upcoming = False
    eb = c.get("early_bird_price")
    dp = c.get("discount_price")
    regular = float(dp) if (dp is not None and dp >= 0) else float(c.get("price", 0))
    if is_upcoming:
        eff = float(eb) if (eb is not None and eb >= 0) else regular
    else:
        eff = regular
    return {"publish_at": pub, "early_bird_price": eb, "is_upcoming": is_upcoming, "effective_price": eff, "regular_price": regular}


def course_summary(c: dict) -> dict:
    modules = c.get("modules", [])
    lessons = [l for m in modules for l in m.get("lessons", [])]
    total_seconds = sum(int(l.get("duration_seconds", 0)) for l in lessons)
    return {
        "course_id": c["course_id"], "title": c["title"], "slug": c["slug"],
        "subtitle": c.get("subtitle", ""), "description": c.get("description", ""),
        "category": c.get("category", ""), "level": c.get("level", "Tüm Seviyeler"),
        "price": c.get("price", 0), "discount_price": c.get("discount_price"),
        "thumbnail": c.get("thumbnail", ""), "instructor_name": c.get("instructor_name", ""),
        "instructor_id": c.get("instructor_id", ""),
        "is_published": c.get("is_published", False),
        "lesson_count": len(lessons), "total_seconds": total_seconds,
        "what_you_learn": c.get("what_you_learn", []),
        **_course_pricing(c),
    }


@router.get("/settings/public")
async def settings_public():
    return await get_public_settings()


def instructor_card(d: dict) -> dict:
    return {"instructor_id": d["instructor_id"], "slug": d["slug"], "name": d["name"],
            "title": d.get("title", ""), "bio": d.get("bio", ""), "avatar": d.get("avatar", ""),
            "social_links": d.get("social_links", {})}


async def _instructor_map() -> dict:
    docs = await db.instructors.find({}, {"_id": 0}).to_list(300)
    return {d["instructor_id"]: instructor_card(d) for d in docs}


@router.get("/instructors")
async def public_instructors():
    docs = await db.instructors.find({}, {"_id": 0}).sort("created_at", 1).to_list(200)
    out = []
    for d in docs:
        card = instructor_card(d)
        card["course_count"] = await db.courses.count_documents({"instructor_id": d["instructor_id"], "is_published": True})
        out.append(card)
    return out


@router.get("/instructors/{slug}")
async def public_instructor(slug: str):
    d = await db.instructors.find_one({"slug": slug}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Eğitmen bulunamadı")
    card = instructor_card(d)
    docs = await db.courses.find({"instructor_id": d["instructor_id"], "is_published": True}, {"_id": 0}).sort("created_at", -1).to_list(200)
    card["courses"] = [course_summary(c) for c in docs]
    return card


@router.get("/uploads/{upload_id}")
async def get_upload(upload_id: str):
    import base64
    from fastapi.responses import Response
    doc = await db.uploads.find_one({"upload_id": upload_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Görsel bulunamadı")
    return Response(content=base64.b64decode(doc["data"]),
                    media_type=doc.get("content_type", "image/png"),
                    headers={"Cache-Control": "public, max-age=31536000"})


@router.get("/courses")
async def list_courses(category: Optional[str] = None):
    q = {"is_published": True}
    if category:
        q["category"] = category
    docs = await db.courses.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    imap = await _instructor_map()
    result = []
    for c in docs:
        s = course_summary(c)
        s["instructor"] = imap.get(c.get("instructor_id"))
        result.append(s)
    return result


@router.get("/courses/{slug}")
async def get_course(slug: str, request: Request):
    c = await db.courses.find_one({"slug": slug, "is_published": True}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
    user = await get_optional_user(request)
    enrolled = False
    if user:
        enrolled = bool(await db.enrollments.find_one(
            {"user_id": user["user_id"], "course_id": c["course_id"]}))
    summary = course_summary(c)
    summary["requirements"] = c.get("requirements", [])
    # curriculum: hide video urls unless enrolled / preview
    modules = []
    for m in c.get("modules", []):
        lessons = []
        for l in m.get("lessons", []):
            item = {
                "id": l["id"], "title": l["title"],
                "duration_seconds": l.get("duration_seconds", 0),
                "is_preview": l.get("is_preview", False),
                "has_resources": bool(l.get("resources")),
            }
            if enrolled or l.get("is_preview"):
                item["video_url"] = l.get("video_url", "")
            lessons.append(item)
        modules.append({"id": m["id"], "title": m["title"], "lessons": lessons})
    summary["modules"] = modules
    summary["enrolled"] = enrolled
    inst = None
    if c.get("instructor_id"):
        idoc = await db.instructors.find_one({"instructor_id": c["instructor_id"]}, {"_id": 0})
        if idoc:
            inst = instructor_card(idoc)
    summary["instructor"] = inst
    summary["seo"] = {
        "meta_title": c.get("meta_title", ""),
        "meta_description": c.get("meta_description", ""),
        "meta_keywords": c.get("meta_keywords", ""),
    }
    allt = (await get_settings_doc()).get("testimonials", [])
    specific = [t for t in allt if t.get("course_id") == c["course_id"]]
    summary["reviews"] = specific if specific else [t for t in allt if not t.get("course_id")]
    return summary


@router.get("/seo/sitemap.xml")
async def sitemap():
    from fastapi.responses import Response
    courses = await db.courses.find({"is_published": True}, {"_id": 0, "slug": 1}).to_list(500)
    urls = ["", "kurslar", "hakkimda", "iletisim"]
    items = "".join(f"<url><loc>{FRONTEND_URL}/{u}</loc><changefreq>weekly</changefreq></url>" for u in urls)
    items += "".join(f"<url><loc>{FRONTEND_URL}/kurslar/{c['slug']}</loc><changefreq>weekly</changefreq></url>" for c in courses)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>'
    return Response(content=xml, media_type="application/xml")


# ---------- Student: enrollments & player ----------
@router.get("/my/courses")
async def my_courses(request: Request):
    user = await get_current_user(request)
    enrolls = await db.enrollments.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    result = []
    for e in enrolls:
        c = await db.courses.find_one({"course_id": e["course_id"]}, {"_id": 0})
        if not c:
            continue
        s = course_summary(c)
        progress = await db.progress.find(
            {"user_id": user["user_id"], "course_id": c["course_id"], "completed": True},
            {"_id": 0}).to_list(1000)
        s["completed_lessons"] = len(progress)
        s["progress_pct"] = round(100 * len(progress) / s["lesson_count"]) if s["lesson_count"] else 0
        s["enrolled_at"] = e.get("enrolled_at")
        paid = 0.0
        if e.get("source") != "free":
            order = None
            if e.get("order_id"):
                order = await db.orders.find_one({"order_id": e["order_id"]}, {"_id": 0, "invoice.data": 0})
            if not order:
                order = await db.orders.find_one(
                    {"user_id": user["user_id"], "status": "paid", "items.course_id": c["course_id"]},
                    {"_id": 0, "invoice.data": 0}, sort=[("created_at", -1)])
            if order and order.get("total", 0):
                item = next((it for it in order.get("items", []) if it["course_id"] == c["course_id"]), None)
                paid = item.get("price", 0) if item else order.get("total", 0)
        s["paid_amount"] = round(paid, 2)
        result.append(s)
    return result


@router.get("/my/courses/{course_id}/player")
async def player(course_id: str, request: Request):
    user = await get_current_user(request)
    enrolled = await db.enrollments.find_one({"user_id": user["user_id"], "course_id": course_id})
    if not enrolled:
        raise HTTPException(status_code=403, detail="Bu eğitime kayıtlı değilsiniz")
    c = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
    prog_docs = await db.progress.find(
        {"user_id": user["user_id"], "course_id": course_id}, {"_id": 0}).to_list(2000)
    prog = {p["lesson_id"]: p for p in prog_docs}
    modules = []
    for m in c.get("modules", []):
        lessons = []
        for l in m.get("lessons", []):
            p = prog.get(l["id"], {})
            lessons.append({
                "id": l["id"], "title": l["title"], "video_url": l.get("video_url", ""),
                "description": l.get("description", ""), "notes": l.get("notes", ""),
                "resources": l.get("resources", []),
                "duration_seconds": l.get("duration_seconds", 0),
                "completed": p.get("completed", False),
                "last_position": p.get("last_position", 0),
            })
        modules.append({"id": m["id"], "title": m["title"], "lessons": lessons})
    total = sum(len(m["lessons"]) for m in modules)
    done = sum(1 for p in prog_docs if p.get("completed"))
    cert = await db.certificates.find_one({"user_id": user["user_id"], "course_id": course_id}, {"_id": 0})
    return {
        "course_id": course_id, "title": c["title"], "modules": modules,
        "progress_pct": round(100 * done / total) if total else 0,
        "completed_lessons": done, "lesson_count": total,
        "certificate": cert,
    }


class ProgressIn(BaseModel):
    course_id: str
    lesson_id: str
    completed: Optional[bool] = None
    last_position: Optional[float] = None


@router.post("/my/progress")
async def save_progress(body: ProgressIn, request: Request):
    user = await get_current_user(request)
    enrolled = await db.enrollments.find_one({"user_id": user["user_id"], "course_id": body.course_id})
    if not enrolled:
        raise HTTPException(status_code=403, detail="Bu eğitime kayıtlı değilsiniz")
    update = {"updated_at": now_utc().isoformat()}
    if body.completed is not None:
        update["completed"] = body.completed
    if body.last_position is not None:
        update["last_position"] = body.last_position
    await db.progress.update_one(
        {"user_id": user["user_id"], "course_id": body.course_id, "lesson_id": body.lesson_id},
        {"$set": update, "$setOnInsert": {"user_id": user["user_id"], "course_id": body.course_id, "lesson_id": body.lesson_id}},
        upsert=True,
    )
    # check completion for certificate
    c = await db.courses.find_one({"course_id": body.course_id}, {"_id": 0})
    total = sum(len(m.get("lessons", [])) for m in c.get("modules", []))
    done = await db.progress.count_documents(
        {"user_id": user["user_id"], "course_id": body.course_id, "completed": True})
    issued = False
    if total > 0 and done >= total:
        existing = await db.certificates.find_one({"user_id": user["user_id"], "course_id": body.course_id})
        if not existing:
            code = new_id("CERT").upper()
            await db.certificates.insert_one({
                "certificate_id": new_id("cert"), "code": code,
                "user_id": user["user_id"], "user_name": user.get("name"),
                "course_id": body.course_id, "course_title": c["title"],
                "issued_at": now_utc().isoformat(),
            })
            issued = True
            schedule_email("completion", user["email"],
                           {"name": user.get("name"), "course_title": c["title"], "certificate_code": code})
            await push_notification("completion", "Eğitim tamamlandı", f"{user.get('name')} · {c['title']}", {"user": user.get("name"), "course": c["title"]})
            _admin_email = (await get_settings_doc()).get("contact_email")
            if _admin_email:
                schedule_email("course_completed_admin", _admin_email,
                               {"name": user.get("name"), "email": user.get("email"), "course_title": c["title"], "certificate_code": code})
    return {"ok": True, "certificate_issued": issued, "progress_pct": round(100 * done / total) if total else 0}


@router.get("/my/certificates")
async def my_certificates(request: Request):
    user = await get_current_user(request)
    certs = await db.certificates.find({"user_id": user["user_id"]}, {"_id": 0, "file.data": 0}).sort("issued_at", -1).to_list(100)
    for c in certs:
        c["has_file"] = bool(c.get("file"))
        c["file_name"] = c.get("file", {}).get("filename") if c.get("file") else None
        c.pop("file", None)
    return certs


@router.get("/my/certificate-file/{cert_id}")
async def download_certificate(cert_id: str, request: Request):
    import base64
    from fastapi.responses import Response
    user = await get_current_user(request)
    cert = await db.certificates.find_one({"certificate_id": cert_id, "user_id": user["user_id"]})
    if not cert or not cert.get("file"):
        raise HTTPException(status_code=404, detail="Sertifika dosyası bulunamadı")
    f = cert["file"]
    return Response(content=base64.b64decode(f["data"]), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{f.get("filename", "sertifika.pdf")}"'})


@router.get("/my/payments")
async def my_payments(request: Request):
    user = await get_current_user(request)
    orders = await db.orders.find({"user_id": user["user_id"], "status": {"$in": ["paid", "awaiting_transfer"]}}, {"_id": 0, "invoice.data": 0}).sort("created_at", -1).to_list(200)
    for o in orders:
        inv = o.get("invoice")
        o["has_invoice"] = bool(inv)
        o["invoice_filename"] = inv.get("filename") if inv else None
        o.pop("invoice", None)
    return orders


@router.get("/my/invoice/{order_id}")
async def download_invoice(order_id: str, request: Request):
    import base64
    from fastapi.responses import Response
    user = await get_current_user(request)
    q = {"order_id": order_id}
    if user.get("role") != "admin":
        q["user_id"] = user["user_id"]
    order = await db.orders.find_one(q)
    if not order or not order.get("invoice"):
        raise HTTPException(status_code=404, detail="Fatura bulunamadı")
    inv = order["invoice"]
    data = base64.b64decode(inv["data"])
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{inv.get("filename", "fatura.pdf")}"'})


@router.get("/recommendations")
async def recommendations(request: Request, ids: str = ""):
    """Cross-sell: given cart course ids, return recommended published courses with bundle discount."""
    cart_ids = [x for x in ids.split(",") if x]
    settings = await get_public_settings()
    bundle_pct = settings.get("bundle_discount_pct", 0)
    rec_ids = set()
    for cid in cart_ids:
        c = await db.courses.find_one({"course_id": cid}, {"_id": 0, "cross_sell_ids": 1})
        for r in (c or {}).get("cross_sell_ids", []):
            if r not in cart_ids:
                rec_ids.add(r)
    if not rec_ids:
        docs = await db.courses.find({"is_published": True, "course_id": {"$nin": cart_ids}}, {"_id": 0}).sort("created_at", -1).limit(3).to_list(3)
    else:
        docs = await db.courses.find({"is_published": True, "course_id": {"$in": list(rec_ids)}}, {"_id": 0}).to_list(10)
    out = []
    for c in docs:
        base = c.get("discount_price") if c.get("discount_price") is not None else c.get("price", 0)
        bundle_price = round(base * (1 - bundle_pct / 100.0)) if bundle_pct else base
        out.append({"course_id": c["course_id"], "title": c["title"], "slug": c["slug"],
                    "thumbnail": c.get("thumbnail", ""), "subtitle": c.get("subtitle", ""),
                    "price": base, "bundle_price": bundle_price, "bundle_pct": bundle_pct})
    return out


@router.get("/certificates/verify/{code}")
async def verify_certificate(code: str):
    cert = await db.certificates.find_one({"code": code.upper()}, {"_id": 0})
    if not cert:
        raise HTTPException(status_code=404, detail="Sertifika bulunamadı")
    return {"valid": True, "user_name": cert.get("user_name"), "course_title": cert.get("course_title"),
            "issued_at": cert.get("issued_at"), "code": cert.get("code")}
