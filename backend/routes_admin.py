import re
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Any

from deps import (
    db, now_utc, new_id, require_admin, fernet, get_settings_doc,
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
async def list_students(request: Request):
    await require_admin(request)
    users = await db.users.find({"role": "student"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    for u in users:
        u["enrollment_count"] = await db.enrollments.count_documents({"user_id": u["user_id"]})
        paid = await db.orders.find({"user_id": u["user_id"], "status": "paid"}, {"_id": 0}).to_list(500)
        u["total_spent"] = round(sum(o.get("total", 0) for o in paid), 2)
    return users


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
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


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


@router.put("/settings/general")
async def update_general(body: GeneralSettingsIn, request: Request):
    await require_admin(request)
    await db.settings.update_one({"_id": "site"}, {"$set": body.model_dump()})
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
    paid_orders = await db.orders.find({"status": "paid"}, {"_id": 0}).to_list(5000)
    revenue = round(sum(o.get("total", 0) for o in paid_orders), 2)
    total_enrollments = await db.enrollments.count_documents({})
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(8)
    return {
        "total_students": total_students, "total_courses": total_courses,
        "published_courses": published, "revenue": revenue,
        "total_sales": len(paid_orders), "total_enrollments": total_enrollments,
        "recent_orders": recent_orders,
    }
