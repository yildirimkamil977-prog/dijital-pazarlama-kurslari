import os
import logging

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from deps import (
    db, now_utc, new_id, hash_password, verify_password,
    DEFAULT_SETTINGS, DEFAULT_TEMPLATES,
)
import routes_auth
import routes_courses
import routes_payments
import routes_admin

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("akademi")

app = FastAPI(title="Akademi API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Akademi API çalışıyor"}


api_router.include_router(routes_auth.router)
api_router.include_router(routes_courses.router)
api_router.include_router(routes_payments.router)
api_router.include_router(routes_admin.router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def seed():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.enrollments.create_index([("user_id", 1), ("course_id", 1)])
    await db.progress.create_index([("user_id", 1), ("course_id", 1), ("lesson_id", 1)], unique=True)
    await db.courses.create_index("slug", unique=True)

    # Admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "user_id": new_id("user"), "name": "Kamil Yıldırım", "email": admin_email,
            "password_hash": hash_password(admin_password), "role": "admin",
            "picture": "", "auth_provider": "password", "accepted_terms": True,
            "created_at": now_utc().isoformat(),
        })
        logger.info("Admin oluşturuldu")
    else:
        updates = {"role": "admin"}
        if existing.get("password_hash") and not verify_password(admin_password, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"email": admin_email}, {"$set": updates})

    # Settings
    if not await db.settings.find_one({"_id": "site"}):
        await db.settings.insert_one({**DEFAULT_SETTINGS})
    else:
        existing_s = await db.settings.find_one({"_id": "site"})
        missing = {k: v for k, v in DEFAULT_SETTINGS.items() if k not in existing_s}
        if missing:
            await db.settings.update_one({"_id": "site"}, {"$set": missing})
    # One-time contact info update (v2)
    sdoc = await db.settings.find_one({"_id": "site"})
    if not sdoc.get("contact_v2"):
        await db.settings.update_one({"_id": "site"}, {"$set": {
            "site_name": "Dijital Pazarlama Kursları",
            "contact_email": "destek@dijitalpazarlamakurslari.com",
            "support_phone": "0(850) 305 7034",
            "address": "Atatürk Mah. Ertuğrul Gazi Sok. Metropol İstanbul Sitesi Ataşehir /İstanbul ATAŞEHİR",
            "contact_v2": True,
        }})

    # Email templates
    for key, tpl in DEFAULT_TEMPLATES.items():
        if not await db.email_templates.find_one({"key": key}):
            await db.email_templates.insert_one({**tpl})
    # Migration: ensure bank_transfer template has the notification button
    bt = await db.email_templates.find_one({"key": "bank_transfer"})
    if bt and "{{notify_url}}" not in bt.get("html", ""):
        await db.email_templates.update_one({"key": "bank_transfer"},
                                            {"$set": {"html": DEFAULT_TEMPLATES["bank_transfer"]["html"]}})
    # Migration: refresh welcome + password_reset to link-based branded HTML
    for _k in ("welcome", "password_reset"):
        await db.email_templates.update_one({"key": _k},
                                            {"$set": {"html": DEFAULT_TEMPLATES[_k]["html"], "subject": DEFAULT_TEMPLATES[_k]["subject"]}})

    # Demo courses
    if await db.courses.count_documents({}) == 0:
        await seed_courses()


async def seed_courses():
    demos = [
        {
            "title": "Google Ads ile Sıfırdan Uzmanlığa",
            "subtitle": "Arama, görüntülü ve alışveriş reklamlarıyla dönüşüm odaklı kampanyalar kur.",
            "category": "Reklam Yönetimi", "level": "Başlangıç - İleri",
            "price": 2499, "discount_price": 1799,
            "thumbnail": "https://images.pexels.com/photos/15555796/pexels-photo-15555796.jpeg",
            "instructor_name": "Kamil Yıldırım", "is_published": True,
            "description": "Google Ads hesabı kurulumundan ileri düzey teklif stratejilerine kadar tüm süreçleri gerçek marka hesapları üzerinden uygulamalı öğren. Bütçe optimizasyonu, dönüşüm takibi ve raporlama dahil.",
            "what_you_learn": ["Arama ağı kampanyaları kurmak", "Dönüşüm takibi ve Google Tag Manager",
                                "Akıllı teklif stratejileri", "Bütçe optimizasyonu ve ölçekleme",
                                "Performans Max kampanyaları", "Raporlama ve analiz"],
            "requirements": ["Ön bilgi gerekmez", "Bir Google hesabı"],
            "modules": [
                {"id": new_id("mod"), "title": "Giriş ve Hesap Kurulumu", "lessons": [
                    {"id": new_id("les"), "title": "Google Ads'e Genel Bakış", "video_url": "https://vimeo.com/76979871", "description": "Google Ads ekosistemine giriş.", "duration_seconds": 480, "is_preview": True, "resources": []},
                    {"id": new_id("les"), "title": "Hesap ve Faturalandırma Kurulumu", "video_url": "https://vimeo.com/76979871", "description": "Adım adım hesap kurulumu.", "duration_seconds": 600, "is_preview": False, "resources": [{"name": "Kurulum Checklist.pdf", "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"}]},
                ]},
                {"id": new_id("mod"), "title": "Kampanya Stratejileri", "lessons": [
                    {"id": new_id("les"), "title": "Arama Ağı Kampanyaları", "video_url": "https://vimeo.com/76979871", "description": "Dönüşüm odaklı arama kampanyaları.", "duration_seconds": 900, "is_preview": False, "resources": []},
                    {"id": new_id("les"), "title": "Teklif Stratejileri", "video_url": "https://vimeo.com/76979871", "description": "Akıllı teklif türleri.", "duration_seconds": 720, "is_preview": False, "resources": []},
                ]},
            ],
        },
        {
            "title": "Meta Reklamları: Instagram & Facebook",
            "subtitle": "Satış getiren Meta Ads kampanyaları ve yaratıcı içerik stratejisi.",
            "category": "Sosyal Medya", "level": "Tüm Seviyeler",
            "price": 1999, "discount_price": None,
            "thumbnail": "https://images.pexels.com/photos/27141314/pexels-photo-27141314.jpeg",
            "instructor_name": "Kamil Yıldırım", "is_published": True,
            "description": "Meta Business Suite kurulumundan piksel entegrasyonuna, hedef kitle oluşturmadan yeniden pazarlamaya kadar satış odaklı kampanyaları uygulamalı öğren.",
            "what_you_learn": ["Meta pikseli ve dönüşüm API kurulumu", "Hedef kitle ve lookalike oluşturma",
                                "Yaratıcı reklam içerikleri", "Yeniden pazarlama hunileri"],
            "requirements": ["Ön bilgi gerekmez"],
            "modules": [
                {"id": new_id("mod"), "title": "Temeller", "lessons": [
                    {"id": new_id("les"), "title": "Meta Reklam Ekosistemi", "video_url": "https://vimeo.com/76979871", "description": "Tanıtım dersi.", "duration_seconds": 420, "is_preview": True, "resources": []},
                    {"id": new_id("les"), "title": "Business Suite Kurulumu", "video_url": "https://vimeo.com/76979871", "description": "Kurulum.", "duration_seconds": 540, "is_preview": False, "resources": []},
                ]},
            ],
        },
        {
            "title": "SEO ve İçerik Pazarlaması",
            "subtitle": "Organik trafiği artıran teknik SEO ve içerik stratejileri.",
            "category": "SEO", "level": "Orta Seviye",
            "price": 1499, "discount_price": 999,
            "thumbnail": "https://images.pexels.com/photos/4260481/pexels-photo-4260481.jpeg",
            "instructor_name": "Kamil Yıldırım", "is_published": True,
            "description": "Anahtar kelime araştırmasından teknik SEO'ya, içerik planlamasından link inşasına kadar organik büyümenin tüm adımları.",
            "what_you_learn": ["Anahtar kelime araştırması", "Teknik SEO denetimi", "İçerik stratejisi", "Backlink inşası"],
            "requirements": ["Temel web bilgisi faydalı"],
            "modules": [
                {"id": new_id("mod"), "title": "SEO Temelleri", "lessons": [
                    {"id": new_id("les"), "title": "Arama Motorları Nasıl Çalışır?", "video_url": "https://vimeo.com/76979871", "description": "Giriş.", "duration_seconds": 360, "is_preview": True, "resources": []},
                    {"id": new_id("les"), "title": "Anahtar Kelime Araştırması", "video_url": "https://vimeo.com/76979871", "description": "Araçlar ve yöntemler.", "duration_seconds": 660, "is_preview": False, "resources": []},
                ]},
            ],
        },
    ]
    from routes_admin import slugify
    for d in demos:
        d["slug"] = slugify(d["title"])
        d["course_id"] = new_id("course")
        d["created_at"] = now_utc().isoformat()
        d["updated_at"] = now_utc().isoformat()
        await db.courses.insert_one(d)
    logger.info("Demo kurslar eklendi")


@app.on_event("startup")
async def startup():
    await seed()


@app.on_event("shutdown")
async def shutdown():
    from deps import client
    client.close()
