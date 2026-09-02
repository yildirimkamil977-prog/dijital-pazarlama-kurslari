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
# Self-hosting: kendi sunucunda kendi Resend anahtarınla gönderim için (opsiyonel).
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "")

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
    "hero_video_url": "https://vimeo.com/76979871",
    "hero_poster": "https://images.pexels.com/photos/15555796/pexels-photo-15555796.jpeg",
    "whatsapp_number": "",
    "whatsapp_message": "Merhaba, eğitimler hakkında bilgi almak istiyorum.",
    "bundle_discount_pct": 15,
    "promo_enabled": True,
    "promo_text": "Yıl sonuna özel: Tüm eğitimlerde avantajlı fiyatlar ve ücretsiz danışmanlık! Fırsatı kaçırma.",
    "testimonials": [
        {"name": "Selin Kaya", "role": "E-ticaret Girişimcisi", "quote": "Google Ads eğitimi sonrası reklam maliyetlerimi %40 düşürdüm, satışlarım ikiye katlandı.", "video_url": "https://vimeo.com/76979871", "thumbnail": "https://images.pexels.com/photos/3771839/pexels-photo-3771839.jpeg", "rating": 5},
        {"name": "Emre Demir", "role": "Freelance Pazarlamacı", "quote": "Meta reklamları eğitimi kariyerimi değiştirdi. Artık kendi ajansımı yönetiyorum.", "video_url": "https://vimeo.com/76979871", "thumbnail": "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg", "rating": 5},
        {"name": "Zeynep Arslan", "role": "Marka Yöneticisi", "quote": "SEO eğitimi ile web sitemizin organik trafiğini 6 ayda 3 katına çıkardık.", "video_url": "https://vimeo.com/76979871", "thumbnail": "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg", "rating": 5},
    ],
    "tracking": {"head_code": "", "body_code": "", "ga_id": "", "meta_pixel_id": "", "google_ads_id": "", "google_ads_purchase_label": ""},
    "seo": {"meta_title": "", "meta_description": "", "meta_keywords": "", "og_image": ""},
    "address": "Atatürk Mah. Ertuğrul Gazi Sok. Metropol İstanbul Sitesi Ataşehir /İstanbul ATAŞEHİR",
    "transfer_discount_pct": 2,
    "bank_accounts": [
        {"bank_name": "Örnek Banka", "holder": "Dijital Pazarlama Kursları", "iban": "TR00 0000 0000 0000 0000 0000 00", "branch": ""},
    ],
    "paytr": {
        "merchant_id": "",
        "merchant_key_enc": "",
        "merchant_salt_enc": "",
        "notification_url": "",
        "test_mode": True,
        "configured": False,
    },
    "email_enabled": True,
    "consulting": {"enabled": True, "price": 1500, "weekly": {}, "weeks_ahead": 4},
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
        "hero_video_url": doc.get("hero_video_url", ""),
        "hero_poster": doc.get("hero_poster", ""),
        "whatsapp_number": doc.get("whatsapp_number", ""),
        "whatsapp_message": doc.get("whatsapp_message", ""),
        "bundle_discount_pct": doc.get("bundle_discount_pct", 0),
        "promo_enabled": doc.get("promo_enabled", False),
        "promo_text": doc.get("promo_text", ""),
        "testimonials": doc.get("testimonials", []),
        "tracking": doc.get("tracking", {}),
        "seo": doc.get("seo", {}),
        "address": doc.get("address", ""),
        "transfer_discount_pct": doc.get("transfer_discount_pct", 0),
        "payment_configured": paytr.get("configured", False),
        "consulting": {"enabled": (doc.get("consulting") or {}).get("enabled", True),
                       "price": (doc.get("consulting") or {}).get("price", 0)},
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
        "html": "<h2 style=\"margin:0 0 14px;color:#ffffff;font-size:22px\">Hoş geldin {{name}}!</h2><p style=\"margin:0 0 14px\">{{site_name}} ailesine katıldığın için çok mutluyuz. Artık tüm eğitimlere göz atabilir, dilediğin cihazdan izleyebilir ve ömür boyu erişimle öğrenme yolculuğuna başlayabilirsin.</p><p style=\"margin:0 0 8px\">Hemen öğrenci panelinden kaldığın yerden devam edebilirsin.</p><div style=\"margin:26px 0\"><a href=\"{{login_url}}\" style=\"background:#FFB800;color:#07090f;padding:13px 28px;border-radius:9px;text-decoration:none;font-weight:bold;display:inline-block\">Panele Git</a></div><p style=\"font-size:13px;color:#8a92a6;margin:0\">Sorularında bize her zaman yazabilirsin. Başarılar dileriz!</p>",
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
    "payment_failed": {
        "key": "payment_failed",
        "name": "Ödeme Başarısız",
        "subject": "Ödemen tamamlanamadı - {{site_name}}",
        "html": "<h2>Merhaba {{name}},</h2><p>Maalesef son ödeme denemen tamamlanamadı. Dilersen sepetine dönüp tekrar deneyebilirsin. Yardıma ihtiyacın olursa bize yazman yeterli.</p>",
        "enabled": True,
    },
    "invoice_ready": {
        "key": "invoice_ready",
        "name": "Fatura Hazır",
        "subject": "Faturan hazır - {{course_title}}",
        "html": "<h2>Merhaba {{name}},</h2><p><strong>{{course_title}}</strong> siparişine ait faturan hazırlandı. Öğrenci panelindeki Ödemelerim bölümünden faturanı indirebilirsin.</p>",
        "enabled": True,
    },
    "password_reset": {
        "key": "password_reset",
        "name": "Şifre Sıfırlama",
        "subject": "Şifreni sıfırla - {{site_name}}",
        "html": "<h2 style=\"margin:0 0 14px;color:#ffffff;font-size:22px\">Şifre sıfırlama talebi</h2><p style=\"margin:0 0 14px\">Merhaba {{name}},</p><p style=\"margin:0 0 20px\">Hesabının şifresini sıfırlamak için bir talep aldık. Yeni şifreni belirlemek için aşağıdaki butona tıkla:</p><div style=\"margin:26px 0\"><a href=\"{{reset_url}}\" style=\"background:#FFB800;color:#07090f;padding:14px 30px;border-radius:9px;text-decoration:none;font-weight:bold;display:inline-block\">Şifremi Sıfırla</a></div><p style=\"font-size:13px;color:#8a92a6;margin:0 0 8px\">Bu bağlantı güvenlik için 1 saat içinde geçerliliğini yitirir.</p><p style=\"font-size:13px;color:#8a92a6;margin:0 0 8px\">Buton çalışmazsa bu adresi tarayıcına yapıştır:<br/>{{reset_url}}</p><p style=\"font-size:13px;color:#8a92a6;margin:16px 0 0\">Bu talebi sen yapmadıysan bu e-postayı dikkate almana gerek yok; şifren değişmeden kalır.</p>",
        "enabled": True,
    },
    "account_created": {
        "key": "account_created",
        "name": "Hesap Oluşturuldu (Giriş Bilgileri)",
        "subject": "Hesabın oluşturuldu - Giriş bilgilerin | {{site_name}}",
        "html": "<h2>Merhaba {{name}},</h2><p>Ödeme adımında senin için otomatik bir öğrenci hesabı oluşturduk. Aşağıdaki bilgilerle giriş yapabilirsin:</p><p><strong>E-posta:</strong> {{email}}<br/><strong>Geçici Şifre:</strong> {{new_password}}</p><p>Güvenliğin için giriş yaptıktan sonra <strong>Hesap Ayarları</strong> bölümünden şifreni değiştirmeni öneririz.</p>",
        "enabled": True,
    },
    "profile_updated": {
        "key": "profile_updated",
        "name": "Profil Güncellendi",
        "subject": "Hesap bilgilerin güncellendi",
        "html": "<h2>Merhaba {{name}},</h2><p>Hesap bilgilerin başarıyla güncellendi. Bu işlemi sen yapmadıysan lütfen bizimle iletişime geç.</p>",
        "enabled": False,
    },
    "bank_transfer": {
        "key": "bank_transfer",
        "name": "Havale/EFT Bilgileri",
        "subject": "Havale/EFT ödeme bilgilerin - {{site_name}}",
        "html": "<h2>Merhaba {{name}},</h2><p><strong>{{course_title}}</strong> siparişin oluşturuldu. Ödemeni aşağıdaki hesaba havale/EFT ile yapabilirsin. Açıklama kısmına <strong>{{order_id}}</strong> yazmayı unutma.</p><p><strong>Tutar (indirimli): {{amount}} TL</strong></p><div>{{bank_info}}</div><p>Ödemeni yaptıktan sonra aşağıdaki butona tıklayarak bize bildirmen, kaydının daha hızlı açılmasını sağlar:</p><div style=\"margin:20px 0\"><a href=\"{{notify_url}}\" style=\"background:#FFB800;color:#07090F;padding:13px 26px;border-radius:9px;text-decoration:none;font-weight:bold;display:inline-block\">Havale/EFT Bildirimi Yap</a></div><p style=\"font-size:13px;color:#666\">Buton çalışmazsa bu adresi tarayıcına yapıştır: {{notify_url}}</p><p>Ödemen onaylandığında eğitimlerine erişimin otomatik açılacaktır.</p>",
        "enabled": True,
    },
    "transfer_notified_admin": {
        "key": "transfer_notified_admin",
        "name": "Havale Bildirimi (Yönetici)",
        "subject": "Yeni havale/EFT bildirimi - Sipariş {{order_id}}",
        "html": "<h2>Yeni havale/EFT bildirimi</h2><p><strong>{{sender_name}}</strong> tarafından <strong>{{order_id}}</strong> numaralı sipariş için ödeme bildirimi yapıldı.</p><p>Eğitim: {{course_title}}<br/>Tutar: {{amount}}<br/>Gönderim tarihi: {{transfer_date}}</p><p>Not: {{note}}</p><p>Yönetim panelindeki <strong>Ödemeler &gt; Havale</strong> bölümünden ödemeyi onaylayabilirsin.</p>",
        "enabled": True,
    },
    "course_completed_admin": {
        "key": "course_completed_admin",
        "name": "Eğitim Tamamlandı (Yönetici)",
        "subject": "Sertifika yükleme: {{name}} - {{course_title}}",
        "html": "<h2>Bir öğrenci eğitimi tamamladı</h2><p><strong>{{name}}</strong> ({{email}}) <strong>{{course_title}}</strong> eğitimini tamamladı.</p><p>Sertifika kodu otomatik oluşturuldu: <strong>{{certificate_code}}</strong>. Dilersen yönetim panelinden bu öğrenci için özel sertifika/fatura yükleyebilirsin.</p>",
        "enabled": True,
    },
    "group_recording": {
        "key": "group_recording",
        "name": "Ders Kaydı Hazır (Grup Eğitimi)",
        "subject": "Ders kaydın hazır: {{lesson}} - {{training}}",
        "html": "<h2 style=\"margin:0 0 14px;color:#ffffff;font-size:22px\">Ders kaydın hazır! 🎬</h2><p style=\"margin:0 0 14px\">Merhaba {{name}},</p><p style=\"margin:0 0 14px\"><strong>{{training}}</strong> eğitiminin <strong>{{lesson}}</strong> dersinin kaydı yayınlandı. Canlı derse katılamadıysan veya tekrar izlemek istersen aşağıdaki butondan ulaşabilirsin.</p><div style=\"margin:26px 0\"><a href=\"{{panel_url}}\" style=\"background:#FFB800;color:#07090f;padding:13px 28px;border-radius:9px;text-decoration:none;font-weight:bold;display:inline-block\">Kaydı İzle</a></div><p style=\"font-size:13px;color:#8a92a6;margin:0\">Kayıtlara öğrenci panelindeki \"Canlı Grup Eğitimi\" bölümünden de her zaman erişebilirsin.</p>",
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
    # Kendi Resend anahtarın (self-hosting) varsa doğrudan Resend API; yoksa Emergent yönetilen servis.
    if RESEND_API_KEY and RESEND_FROM:
        payload = {"from": f"{EMAIL_FROM_NAME} <{RESEND_FROM}>", "to": [to_email],
                   "subject": subject, "html": html}
        if reply_to:
            payload["reply_to"] = reply_to
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post("https://api.resend.com/emails",
                                 headers={"Authorization": f"Bearer {RESEND_API_KEY}"}, json=payload)
            r.raise_for_status()
        except Exception as e:
            logger.error(f"E-posta gönderilemedi (Resend, {to_email}): {e}")
        return
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


def render_email_shell(inner_html: str, s: dict) -> str:
    name = s.get("site_name", "Akademi")
    email = s.get("contact_email", "")
    phone = s.get("support_phone", "")
    addr = s.get("address", "")
    year = now_utc().year
    contact = ""
    if email:
        contact += email + "<br/>"
    if phone:
        contact += phone + "<br/>"
    if addr:
        contact += addr + "<br/>"
    return (
        '<!DOCTYPE html><html lang="tr"><body style="margin:0;background:#0b0d13;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb">'
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d13;padding:32px 12px"><tr><td align="center">'
        '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#10141e;border-radius:16px;overflow:hidden;border:1px solid #1f2637">'
        f'<tr><td style="background:linear-gradient(135deg,#FFB800,#E5A600);padding:22px 32px"><span style="font-size:20px;font-weight:800;color:#07090f">{name}</span></td></tr>'
        f'<tr><td style="padding:32px;font-size:15px;line-height:1.7;color:#cbd2e0">{inner_html}</td></tr>'
        '<tr><td style="padding:24px 32px;background:#0b0d13;border-top:1px solid #1f2637;font-size:12px;color:#8a92a6;line-height:1.7">'
        f'<strong style="color:#e5e7eb">{name}</strong><br/>{contact}'
        f'<span style="color:#5b6270">© {year} {name}. Tüm hakları saklıdır.</span>'
        '</td></tr></table></td></tr></table></body></html>'
    )


async def _email_admin_notification(title: str, body: str):
    try:
        settings = await get_settings_doc()
        if not settings.get("email_enabled", True):
            return
        admin_email = settings.get("notify_email") or settings.get("contact_email")
        if not admin_email:
            return
        frontend = os.environ.get("CORS_ORIGINS", "").split(",")[0]
        inner = (
            '<span style="display:inline-block;background:#FFB80022;color:#FFB800;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:14px">Yönetim Bildirimi</span>'
            f'<h2 style="margin:0 0 10px;color:#fff;font-size:20px">{title}</h2>'
            f'<p style="margin:0 0 18px;color:#cbd2e0">{body or ""}</p>'
            f'<div style="margin:22px 0"><a href="{frontend}/yonetim" style="background:#FFB800;color:#07090f;padding:11px 24px;border-radius:9px;text-decoration:none;font-weight:bold">Yönetim Paneline Git</a></div>'
        )
        html = render_email_shell(inner, settings)
        await send_email(admin_email, f"[Bildirim] {title}", html, reply_to=settings.get("contact_email"))
    except Exception:
        pass


async def push_notification(ntype: str, title: str, body: str = "", meta: dict = None):
    await db.notifications.insert_one({
        "notif_id": new_id("ntf"), "type": ntype, "title": title, "body": body,
        "meta": meta or {}, "read": False, "created_at": now_utc().isoformat(),
    })
    asyncio.create_task(_email_admin_notification(title, body))


async def send_templated(key: str, to_email: str, ctx: dict):
    settings = await get_settings_doc()
    if not settings.get("email_enabled", True):
        return
    tpl = await get_template(key)
    if not tpl or not tpl.get("enabled", True):
        return
    ctx = {**ctx, "site_name": settings.get("site_name", "Akademi")}
    subject = render_template(tpl["subject"], ctx)
    inner = render_template(tpl["html"], ctx)
    html = render_email_shell(inner, settings)
    await send_email(to_email, subject, html, reply_to=settings.get("contact_email"))
