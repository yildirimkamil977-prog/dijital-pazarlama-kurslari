import re
import base64
import secrets
from fastapi import APIRouter, Request, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional, Any

from deps import (
    db, now_utc, new_id, require_admin, fernet, get_settings_doc, schedule_email, hash_password,
)

router = APIRouter(prefix="/admin")


def slugify(text: str) -> str:
    tr = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosucgiosu")
    text = text.translate(tr).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or new_id("kurs")


# ---------------- Courses CRUD ----------------
class Resource(BaseModel):
    name: str
    url: str


class Lesson(BaseModel):
    id: Optional[str] = None
    title: str
    video_url: str = ""
    description: str = ""
    notes: str = ""
    duration_seconds: int = 0
    is_preview: bool = False
    resources: List[Resource] = []


class Module(BaseModel):
    id: Optional[str] = None
    title: str
    lessons: List[Lesson] = []


class CourseIn(BaseModel):
    title: str
    subtitle: str = ""
    description: str = ""
    category: str = ""
    level: str = "Tüm Seviyeler"
    price: float = 0
    discount_price: Optional[float] = None
    thumbnail: str = ""
    instructor_name: str = ""
    is_published: bool = False
    what_you_learn: List[str] = []
    requirements: List[str] = []
    meta_title: str = ""
    meta_description: str = ""
    meta_keywords: str = ""
    cross_sell_ids: List[str] = []
    modules: List[Module] = []


def _prepare_modules(modules: List[Module]) -> List[dict]:
    out = []
    for m in modules:
        md = m.model_dump()
        md["id"] = md.get("id") or new_id("mod")
        for l in md["lessons"]:
            l["id"] = l.get("id") or new_id("les")
        out.append(md)
    return out


@router.get("/courses")
async def admin_list_courses(request: Request):
    await require_admin(request)
    docs = await db.courses.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@router.get("/courses/{course_id}")
async def admin_get_course(course_id: str, request: Request):
    await require_admin(request)
    c = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
    return c


@router.post("/courses")
async def create_course(body: CourseIn, request: Request):
    await require_admin(request)
    slug = slugify(body.title)
    if await db.courses.find_one({"slug": slug}):
        slug = f"{slug}-{new_id('')[1:6]}"
    doc = body.model_dump()
    doc["modules"] = _prepare_modules(body.modules)
    doc.update({"course_id": new_id("course"), "slug": slug,
                "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()})
    await db.courses.insert_one({**doc})
    doc.pop("_id", None)
    return doc


@router.put("/courses/{course_id}")
async def update_course(course_id: str, body: CourseIn, request: Request):
    await require_admin(request)
    existing = await db.courses.find_one({"course_id": course_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
    doc = body.model_dump()
    doc["modules"] = _prepare_modules(body.modules)
    doc["updated_at"] = now_utc().isoformat()
    await db.courses.update_one({"course_id": course_id}, {"$set": doc})
    c = await db.courses.find_one({"course_id": course_id}, {"_id": 0})
    return c


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str, request: Request):
    await require_admin(request)
    await db.courses.delete_one({"course_id": course_id})
    return {"ok": True}


# ---------------- Students ----------------
@router.get("/students")
async def list_students(request: Request, search: str = "", page: int = 1, limit: int = 10):
    await require_admin(request)
    q = {"role": "student"}
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        q["$or"] = [{"name": rx}, {"email": rx}, {"phone": rx}]
    total = await db.users.count_documents(q)
    skip = max(0, (page - 1) * limit)
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    for u in users:
        u["enrollment_count"] = await db.enrollments.count_documents({"user_id": u["user_id"]})
        paid = await db.orders.find({"user_id": u["user_id"], "status": "paid"}, {"_id": 0, "invoice.data": 0}).to_list(500)
        u["total_spent"] = round(sum(o.get("total", 0) for o in paid), 2)
    return {"items": users, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@router.get("/students/{user_id}")
async def student_detail(user_id: str, request: Request):
    await require_admin(request)
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")
    enrolls = await db.enrollments.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    courses = []
    for e in enrolls:
        c = await db.courses.find_one({"course_id": e["course_id"]}, {"_id": 0})
        if not c:
            continue
        total = sum(len(m.get("lessons", [])) for m in c.get("modules", []))
        done = await db.progress.count_documents({"user_id": user_id, "course_id": e["course_id"], "completed": True})
        courses.append({"course_id": e["course_id"], "title": c["title"], "source": e.get("source"),
                        "enrolled_at": e.get("enrolled_at"), "lesson_count": total,
                        "completed_lessons": done, "progress_pct": round(100 * done / total) if total else 0})
    payments = await db.orders.find({"user_id": user_id}, {"_id": 0, "invoice.data": 0}).sort("created_at", -1).to_list(200)
    for p in payments:
        p["has_invoice"] = bool(p.get("invoice")); p.pop("invoice", None)
    certs = await db.certificates.find({"user_id": user_id}, {"_id": 0, "file.data": 0}).to_list(100)
    for c in certs:
        c["has_file"] = bool(c.get("file")); c.pop("file", None)
    return {"user": u, "courses": courses, "payments": payments, "certificates": certs}


@router.post("/students/{user_id}/reset-password")
async def reset_password(user_id: str, request: Request):
    await require_admin(request)
    u = await db.users.find_one({"user_id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")
    new_pw = secrets.token_urlsafe(8)
    await db.users.update_one({"user_id": user_id}, {"$set": {"password_hash": hash_password(new_pw)}})
    schedule_email("password_reset", u["email"], {"name": u.get("name", ""), "new_password": new_pw})
    return {"ok": True, "new_password": new_pw}


@router.post("/students/{user_id}/certificate")
async def upload_certificate(user_id: str, request: Request, course_id: str = "", file: UploadFile = File(...)):
    await require_admin(request)
    u = await db.users.find_one({"user_id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya 8MB'den büyük olamaz")
    c = await db.courses.find_one({"course_id": course_id}, {"_id": 0}) if course_id else None
    existing = await db.certificates.find_one({"user_id": user_id, "course_id": course_id})
    fileobj = {"filename": file.filename or "sertifika.pdf", "data": base64.b64encode(content).decode()}
    if existing:
        await db.certificates.update_one({"certificate_id": existing["certificate_id"]}, {"$set": {"file": fileobj}})
    else:
        await db.certificates.insert_one({
            "certificate_id": new_id("cert"), "code": new_id("CERT").upper(),
            "user_id": user_id, "user_name": u.get("name"), "course_id": course_id,
            "course_title": c["title"] if c else "", "issued_at": now_utc().isoformat(), "file": fileobj,
        })
    return {"ok": True}


@router.get("/students/{user_id}/enrollments")
async def student_enrollments(user_id: str, request: Request):
    await require_admin(request)
    enrolls = await db.enrollments.find({"user_id": user_id}, {"_id": 0}).to_list(200)
    out = []
    for e in enrolls:
        c = await db.courses.find_one({"course_id": e["course_id"]}, {"_id": 0})
        out.append({"course_title": c["title"] if c else e["course_id"],
                    "source": e.get("source"), "enrolled_at": e.get("enrolled_at"),
                    "course_id": e["course_id"]})
    return out


class ManualEnrollIn(BaseModel):
    user_id: str
    course_id: str


@router.post("/enrollments")
async def manual_enroll(body: ManualEnrollIn, request: Request):
    await require_admin(request)
    if await db.enrollments.find_one({"user_id": body.user_id, "course_id": body.course_id}):
        raise HTTPException(status_code=400, detail="Zaten kayıtlı")
    await db.enrollments.insert_one({
        "enrollment_id": new_id("enr"), "user_id": body.user_id, "course_id": body.course_id,
        "source": "manual", "enrolled_at": now_utc().isoformat(),
    })
    return {"ok": True}


@router.delete("/enrollments")
async def remove_enroll(body: ManualEnrollIn, request: Request):
    await require_admin(request)
    await db.enrollments.delete_one({"user_id": body.user_id, "course_id": body.course_id})
    return {"ok": True}


# ---------------- Payments ----------------
@router.get("/payments")
async def list_payments(request: Request):
    await require_admin(request)
    orders = await db.orders.find({"status": {"$in": ["paid", "awaiting_transfer"]}}, {"_id": 0, "invoice.data": 0}).sort("created_at", -1).to_list(1000)
    for o in orders:
        inv = o.get("invoice")
        o["has_invoice"] = bool(inv)
        o["invoice_filename"] = inv.get("filename") if inv else None
        o.pop("invoice", None)
    return orders


@router.post("/payments/{order_id}/invoice")
async def upload_invoice(order_id: str, request: Request, file: UploadFile = File(...)):
    await require_admin(request)
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Dosya 8MB'den büyük olamaz")
    b64 = base64.b64encode(content).decode()
    await db.orders.update_one({"order_id": order_id}, {"$set": {"invoice": {
        "filename": file.filename or "fatura.pdf", "data": b64, "uploaded_at": now_utc().isoformat()}}})
    title = order["items"][0]["title"] if order.get("items") else ""
    schedule_email("invoice_ready", order.get("user_email", ""), {"name": order.get("user_name", ""), "course_title": title})
    return {"ok": True}


@router.post("/upload-image")
async def upload_image(request: Request, file: UploadFile = File(...)):
    await require_admin(request)
    ct = file.content_type or "image/png"
    if not ct.startswith("image/"):
        raise HTTPException(status_code=400, detail="Lütfen bir görsel dosyası yükleyin")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Görsel 5MB'den büyük olamaz")
    uid = new_id("img")
    await db.uploads.insert_one({
        "upload_id": uid, "content_type": ct,
        "data": base64.b64encode(content).decode(), "created_at": now_utc().isoformat(),
    })
    return {"url": f"/api/uploads/{uid}"}


@router.delete("/payments/{order_id}/invoice")
async def delete_invoice(order_id: str, request: Request):
    await require_admin(request)
    await db.orders.update_one({"order_id": order_id}, {"$unset": {"invoice": ""}})
    return {"ok": True}


@router.post("/payments/{order_id}/mark-paid")
async def mark_paid(order_id: str, request: Request):
    await require_admin(request)
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    if order.get("status") == "paid":
        return {"ok": True}
    await db.orders.update_one({"order_id": order_id}, {"$set": {"status": "paid", "updated_at": now_utc().isoformat()}})
    if order.get("discount_code"):
        await db.discount_codes.update_one({"code": order["discount_code"]}, {"$inc": {"used_count": 1}})
    for it in order["items"]:
        if not await db.enrollments.find_one({"user_id": order["user_id"], "course_id": it["course_id"]}):
            await db.enrollments.insert_one({
                "enrollment_id": new_id("enr"), "user_id": order["user_id"], "course_id": it["course_id"],
                "source": "purchase", "order_id": order_id, "enrolled_at": now_utc().isoformat(),
            })
        schedule_email("purchase", order["user_email"], {"name": order.get("user_name"),
                       "course_title": it["title"], "amount": f"{order.get('total', 0):.2f}"})
    return {"ok": True}


# ---------------- Discount codes ----------------
class DiscountIn(BaseModel):
    code: str
    type: str = "percent"  # percent | fixed
    value: float
    active: bool = True
    usage_limit: Optional[int] = None
    min_amount: Optional[float] = None


@router.get("/discounts")
async def list_discounts(request: Request):
    await require_admin(request)
    return await db.discount_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/discounts")
async def create_discount(body: DiscountIn, request: Request):
    await require_admin(request)
    code = body.code.upper().strip()
    if await db.discount_codes.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Bu kod zaten var")
    doc = body.model_dump()
    doc.update({"code": code, "used_count": 0, "created_at": now_utc().isoformat()})
    await db.discount_codes.insert_one({**doc})
    doc.pop("_id", None)
    return doc


@router.put("/discounts/{code}")
async def update_discount(code: str, body: DiscountIn, request: Request):
    await require_admin(request)
    doc = body.model_dump()
    doc["code"] = code.upper()
    await db.discount_codes.update_one({"code": code.upper()}, {"$set": doc})
    return await db.discount_codes.find_one({"code": code.upper()}, {"_id": 0})


@router.delete("/discounts/{code}")
async def delete_discount(code: str, request: Request):
    await require_admin(request)
    await db.discount_codes.delete_one({"code": code.upper()})
    return {"ok": True}


# ---------------- Settings ----------------
@router.get("/settings")
async def admin_get_settings(request: Request):
    await require_admin(request)
    doc = await get_settings_doc()
    p = doc.get("paytr", {})
    return {
        "site_name": doc.get("site_name"), "tagline": doc.get("tagline"),
        "contact_email": doc.get("contact_email"), "support_phone": doc.get("support_phone"),
        "hero_title": doc.get("hero_title"), "hero_subtitle": doc.get("hero_subtitle"),
        "about_text": doc.get("about_text"), "students_count": doc.get("students_count"),
        "email_enabled": doc.get("email_enabled", True),
        "hero_video_url": doc.get("hero_video_url", ""), "hero_poster": doc.get("hero_poster", ""),
        "whatsapp_number": doc.get("whatsapp_number", ""), "whatsapp_message": doc.get("whatsapp_message", ""),
        "bundle_discount_pct": doc.get("bundle_discount_pct", 0),
        "promo_enabled": doc.get("promo_enabled", False), "promo_text": doc.get("promo_text", ""),
        "testimonials": doc.get("testimonials", []),
        "address": doc.get("address", ""),
        "transfer_discount_pct": doc.get("transfer_discount_pct", 0),
        "bank_accounts": doc.get("bank_accounts", []),
        "tracking": doc.get("tracking", {"head_code": "", "body_code": "", "ga_id": "", "meta_pixel_id": "", "google_ads_id": "", "google_ads_purchase_label": ""}),
        "seo": doc.get("seo", {"meta_title": "", "meta_description": "", "meta_keywords": "", "og_image": ""}),
        "paytr": {
            "merchant_id": p.get("merchant_id", ""),
            "has_key": bool(p.get("merchant_key_enc")),
            "has_salt": bool(p.get("merchant_salt_enc")),
            "notification_url": p.get("notification_url", ""),
            "test_mode": p.get("test_mode", True),
            "configured": p.get("configured", False),
        },
    }


class GeneralSettingsIn(BaseModel):
    site_name: str
    tagline: str = ""
    contact_email: str = ""
    support_phone: str = ""
    hero_title: str = ""
    hero_subtitle: str = ""
    about_text: str = ""
    students_count: str = ""
    email_enabled: bool = True
    address: str = ""
    transfer_discount_pct: float = 0
    hero_video_url: str = ""
    hero_poster: str = ""
    whatsapp_number: str = ""
    whatsapp_message: str = ""
    bundle_discount_pct: float = 0
    promo_enabled: bool = False
    promo_text: str = ""


@router.put("/settings/general")
async def update_general(body: GeneralSettingsIn, request: Request):
    await require_admin(request)
    await db.settings.update_one({"_id": "site"}, {"$set": body.model_dump(exclude_unset=True)})
    return {"ok": True}


class TrackingIn(BaseModel):
    head_code: str = ""
    body_code: str = ""
    ga_id: str = ""
    meta_pixel_id: str = ""
    google_ads_id: str = ""
    google_ads_purchase_label: str = ""


@router.put("/settings/tracking")
async def update_tracking(body: TrackingIn, request: Request):
    await require_admin(request)
    await db.settings.update_one({"_id": "site"}, {"$set": {"tracking": body.model_dump()}})
    return {"ok": True}


class SeoIn(BaseModel):
    meta_title: str = ""
    meta_description: str = ""
    meta_keywords: str = ""
    og_image: str = ""


@router.put("/settings/seo")
async def update_seo(body: SeoIn, request: Request):
    await require_admin(request)
    await db.settings.update_one({"_id": "site"}, {"$set": {"seo": body.model_dump()}})
    return {"ok": True}


class BankAccount(BaseModel):
    bank_name: str = ""
    holder: str = ""
    iban: str = ""
    branch: str = ""


@router.put("/settings/bank-accounts")
async def update_bank_accounts(body: List[BankAccount], request: Request):
    await require_admin(request)
    await db.settings.update_one({"_id": "site"}, {"$set": {"bank_accounts": [b.model_dump() for b in body]}})
    return {"ok": True}


class Testimonial(BaseModel):
    name: str
    role: str = ""
    quote: str = ""
    video_url: str = ""
    thumbnail: str = ""
    rating: int = 5
    course_id: str = ""


@router.put("/settings/testimonials")
async def update_testimonials(body: List[Testimonial], request: Request):
    await require_admin(request)
    await db.settings.update_one({"_id": "site"}, {"$set": {"testimonials": [t.model_dump() for t in body]}})
    return {"ok": True}


class PaytrSettingsIn(BaseModel):
    merchant_id: str
    merchant_key: Optional[str] = None
    merchant_salt: Optional[str] = None
    notification_url: str = ""
    test_mode: bool = True


@router.put("/settings/paytr")
async def update_paytr(body: PaytrSettingsIn, request: Request):
    await require_admin(request)
    doc = await get_settings_doc()
    p = doc.get("paytr", {})
    p["merchant_id"] = body.merchant_id.strip()
    if body.merchant_key:
        p["merchant_key_enc"] = fernet.encrypt(body.merchant_key.strip().encode()).decode()
    if body.merchant_salt:
        p["merchant_salt_enc"] = fernet.encrypt(body.merchant_salt.strip().encode()).decode()
    p["notification_url"] = body.notification_url.strip()
    p["test_mode"] = body.test_mode
    p["configured"] = bool(p["merchant_id"] and p.get("merchant_key_enc") and p.get("merchant_salt_enc"))
    await db.settings.update_one({"_id": "site"}, {"$set": {"paytr": p}})
    return {"ok": True, "configured": p["configured"]}


# ---------------- Email templates ----------------
@router.get("/email-templates")
async def list_templates(request: Request):
    await require_admin(request)
    return await db.email_templates.find({}, {"_id": 0}).to_list(50)


class TemplateIn(BaseModel):
    subject: str
    html: str
    enabled: bool = True


@router.put("/email-templates/{key}")
async def update_template(key: str, body: TemplateIn, request: Request):
    await require_admin(request)
    await db.email_templates.update_one({"key": key}, {"$set": body.model_dump()})
    return await db.email_templates.find_one({"key": key}, {"_id": 0})


# ---------------- Dashboard stats ----------------
@router.get("/stats")
async def stats(request: Request):
    await require_admin(request)
    total_students = await db.users.count_documents({"role": "student"})
    total_courses = await db.courses.count_documents({})
    published = await db.courses.count_documents({"is_published": True})
    paid_orders = await db.orders.find({"status": "paid"}, {"_id": 0, "invoice.data": 0}).to_list(5000)
    revenue = round(sum(o.get("total", 0) for o in paid_orders), 2)
    total_enrollments = await db.enrollments.count_documents({})
    recent_orders = await db.orders.find({}, {"_id": 0, "invoice.data": 0}).sort("created_at", -1).to_list(8)

    # Last 14 days revenue + sales timeseries
    from datetime import timedelta
    days = []
    today = now_utc().date()
    buckets = {}
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        buckets[d.isoformat()] = {"date": d.strftime("%d.%m"), "revenue": 0, "sales": 0}
    for o in paid_orders:
        try:
            ds = o.get("created_at", "")[:10]
            if ds in buckets:
                buckets[ds]["revenue"] += o.get("total", 0)
                buckets[ds]["sales"] += 1
        except Exception:
            pass
    timeseries = list(buckets.values())

    # Top courses by enrollment
    pipeline = [{"$group": {"_id": "$course_id", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 5}]
    top_raw = await db.enrollments.aggregate(pipeline).to_list(5)
    top_courses = []
    for t in top_raw:
        c = await db.courses.find_one({"course_id": t["_id"]}, {"_id": 0, "title": 1})
        if c:
            top_courses.append({"title": c["title"], "enrollments": t["count"]})

    pending_count = await db.orders.count_documents({"status": "pending"})
    return {
        "total_students": total_students, "total_courses": total_courses,
        "published_courses": published, "revenue": revenue,
        "total_sales": len(paid_orders), "total_enrollments": total_enrollments,
        "pending_count": pending_count,
        "recent_orders": recent_orders, "timeseries": timeseries, "top_courses": top_courses,
    }
