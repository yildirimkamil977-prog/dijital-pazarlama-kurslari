import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List

import bcrypt
import httpx
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from fastapi import Request, HTTPException, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("akademi")

# ---- Database ----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---- Crypto for settings secrets ----
fernet = Fernet(os.environ["SETTINGS_ENCRYPTION_KEY"].encode())

# ---- Email ----
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Akademi")

SESSION_DAYS = 7


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key="session_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=SESSION_DAYS * 24 * 3600, path="/",
    )


def clear_session_cookie(response: Response):
    response.delete_cookie("session_token", path="/")


async def create_session(user_id: str) -> str:
    token = f"st_{uuid.uuid4().hex}{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": (now_utc() + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    return token


async def store_external_session(user_id: str, token: str):
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": (now_utc() + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": now_utc().isoformat(),
    })


def _token_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    return token


async def get_current_user(request: Request) -> dict:
    token = _token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Oturum geçersiz")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Yönetici yetkisi gerekli")
    return user


# ---- Settings helpers ----
DEFAULT_SETTINGS = {
    "_id": "site",
    "site_name": "Kamil Yıldırım Akademi",
    "tagline": "Dijital pazarlamada gerçek uzmanlığa giden yol",
    "contact_email": "yildirimkamil977@gmail.com",
    "support_phone": "",
    "hero_title": "Gerçek bir dijital pazarlama uzmanı olmaya hazır mısın?",
    "hero_subtitle": "1000'den fazla markada 13 yılda kazanılmış tecrübeyi günler içinde öğren. Uygulamalı dersler, canlı yayınlar ve doğrulanabilir sertifika ile kariyerini bir üst seviyeye taşı.",
    "about_text": "13 yılı aşkın süredir dijital pazarlama alanında yüzlerce markaya danışmanlık veriyorum. Bu akademide, sahada edindiğim tüm bilgi ve stratejileri sıfırdan ileri seviyeye kadar uygulamalı olarak aktarıyorum.",
    "students_count": "10.000+",
    "paytr": {
        "merchant_id": "",
        "merchant_key_enc": "",
        "merchant_salt_enc": "",
        "notification_url": "",
        "test_mode": True,
        "configured": False,
    },
    "email_enabled": True,
}


async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"_id": "site"})
    if not doc:
        await db.settings.insert_one({**DEFAULT_SETTINGS})
        doc = await db.settings.find_one({"_id": "site"})
    return doc


async def get_public_settings() -> dict:
    doc = await get_settings_doc()
    paytr = doc.get("paytr", {})
    return {
        "site_name": doc.get("site_name"),
        "tagline": doc.get("tagline"),
        "contact_email": doc.get("contact_email"),
        "support_phone": doc.get("support_phone"),
        "hero_title": doc.get("hero_title"),
        "hero_subtitle": doc.get("hero_subtitle"),
        "about_text": doc.get("about_text"),
        "students_count": doc.get("students_count"),
        "payment_configured": paytr.get("configured", False),
    }


async def get_paytr_credentials() -> Optional[dict]:
    doc = await get_settings_doc()
    p = doc.get("paytr", {})
    if not p.get("configured"):
        return None
    try:
        return {
            "merchant_id": p["merchant_id"],
            "merchant_key": fernet.decrypt(p["merchant_key_enc"].encode()).decode(),
            "merchant_salt": fernet.decrypt(p["merchant_salt_enc"].encode()).decode(),
            "notification_url": p.get("notification_url", ""),
            "test_mode": p.get("test_mode", True),
        }
    except Exception as e:
        logger.error(f"PayTR credential decrypt error: {e}")
        return None


# ---- Email templates ----
DEFAULT_TEMPLATES = {
    "welcome": {
        "key": "welcome",
        "name": "Üyelik Karşılama",
        "subject": "Aramıza hoş geldin, {{name}}!",
        "html": "<h2>Merhaba {{name}},</h2><p>{{site_name}} ailesine katıldığın için teşekkürler. Artık eğitimlere göz atabilir ve öğrenme yolculuğuna başlayabilirsin.</p><p>Başarılar dileriz!</p>",
        "enabled": True,
    },
    "purchase": {
        "key": "purchase",
        "name": "Satın Alma Onayı",
        "subject": "Siparişin onaylandı - {{course_title}}",
        "html": "<h2>Teşekkürler {{name}}!</h2><p><strong>{{course_title}}</strong> eğitimine erişimin açıldı. Öğrenci panelinden hemen izlemeye başlayabilirsin.</p><p>Tutar: {{amount}} TL</p>",
        "enabled": True,
    },
    "completion": {
        "key": "completion",
        "name": "Kurs Tamamlama & Sertifika",
        "subject": "Tebrikler! {{course_title}} eğitimini tamamladın",
        "html": "<h2>Harikasın {{name}}!</h2><p><strong>{{course_title}}</strong> eğitimini başarıyla tamamladın. Sertifikan öğrenci panelinde seni bekliyor.</p><p>Sertifika kodu: {{certificate_code}}</p>",
        "enabled": True,
    },
}


async def get_template(key: str) -> Optional[dict]:
    doc = await db.email_templates.find_one({"key": key}, {"_id": 0})
    return doc


def render_template(text: str, ctx: dict) -> str:
    for k, v in ctx.items():
        text = text.replace("{{" + k + "}}", str(v))
    return text


async def send_email(to_email: str, subject: str, html: str, reply_to: Optional[str] = None):
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY yok, e-posta atlanıyor")
        return
    payload = {"to": [to_email], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to:
        payload["contact_email"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                             headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        r.raise_for_status()
    except Exception as e:
        logger.error(f"E-posta gönderilemedi ({to_email}): {e}")


def schedule_email(key: str, to_email: str, ctx: dict):
    """Fire-and-forget templated email so user requests aren't blocked."""
    asyncio.create_task(send_templated(key, to_email, ctx))


async def send_templated(key: str, to_email: str, ctx: dict):
    settings = await get_settings_doc()
    if not settings.get("email_enabled", True):
        return
    tpl = await get_template(key)
    if not tpl or not tpl.get("enabled", True):
        return
    ctx = {**ctx, "site_name": settings.get("site_name", "Akademi")}
    subject = render_template(tpl["subject"], ctx)
    html = render_template(tpl["html"], ctx)
    await send_email(to_email, subject, html, reply_to=settings.get("contact_email"))
