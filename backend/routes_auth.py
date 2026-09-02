from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
import httpx
import os
import secrets
import hashlib
from datetime import timedelta

from deps import (
    db, now_utc, new_id, hash_password, verify_password, create_session,
    store_external_session, set_session_cookie, clear_session_cookie,
    get_current_user, schedule_email, push_notification,
)

router = APIRouter(prefix="/auth")

FRONTEND_URL = os.environ.get("CORS_ORIGINS", "").split(",")[0]
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


class ProfileIn(BaseModel):
    name: str
    email: EmailStr


class PasswordIn(BaseModel):
    current_password: str
    new_password: str


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    accept_terms: bool = False


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def public_user(u: dict) -> dict:
    return {
        "user_id": u["user_id"], "name": u.get("name"), "email": u.get("email"),
        "role": u.get("role", "student"), "picture": u.get("picture", ""),
        "auth_provider": u.get("auth_provider", "password"),
    }


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    if not body.accept_terms:
        raise HTTPException(status_code=400, detail="Sözleşmeleri onaylamanız gerekiyor")
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
    user = {
        "user_id": new_id("user"), "name": body.name.strip(), "email": email,
        "password_hash": hash_password(body.password), "role": "student",
        "picture": "", "auth_provider": "password", "accepted_terms": True,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    schedule_email("welcome", email, {"name": user["name"], "login_url": f"{FRONTEND_URL}/panel"})
    await push_notification("registration", "Yeni öğrenci kaydı", f"{user['name']} · {email}", {"email": email})
    return public_user(user)


@router.post("/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return public_user(user)


class SessionIn(BaseModel):
    session_id: str
    accept_terms: bool = False


@router.post("/google/session")
async def google_session(body: SessionIn, response: Response):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google oturumu doğrulanamadı")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Google hesabından e-posta alınamadı")
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": new_id("user"), "name": data.get("name", email), "email": email,
            "password_hash": None, "role": "student", "picture": data.get("picture", ""),
            "auth_provider": "google", "accepted_terms": True,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
        schedule_email("welcome", email, {"name": user["name"], "login_url": f"{FRONTEND_URL}/panel"})
        await push_notification("registration", "Yeni öğrenci kaydı", f"{user['name']} · {email}", {"email": email})
    else:
        await db.users.update_one({"user_id": user["user_id"]},
                                  {"$set": {"picture": data.get("picture", user.get("picture", ""))}})
    await store_external_session(user["user_id"], data["session_token"])
    set_session_cookie(response, data["session_token"])
    return public_user(user)


class GoogleCredIn(BaseModel):
    credential: str
    accept_terms: bool = False


@router.post("/google")
async def google_login(body: GoogleCredIn, response: Response):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": body.credential})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google kimliği doğrulanamadı")
    data = r.json()
    if GOOGLE_CLIENT_ID and data.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google istemci kimliği uyuşmuyor")
    email = (data.get("email") or "").lower().strip()
    if not email or str(data.get("email_verified")).lower() != "true":
        raise HTTPException(status_code=400, detail="Google hesabından doğrulanmış e-posta alınamadı")
    user = await db.users.find_one({"email": email})
    if not user:
        if not body.accept_terms:
            return {"terms_required": True}
        user = {
            "user_id": new_id("user"), "name": data.get("name", email), "email": email,
            "password_hash": None, "role": "student", "picture": data.get("picture", ""),
            "auth_provider": "google", "accepted_terms": True,
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
        schedule_email("welcome", email, {"name": user["name"], "login_url": f"{FRONTEND_URL}/panel"})
        await push_notification("registration", "Yeni öğrenci kaydı", f"{user['name']} · {email}", {"email": email})
    else:
        await db.users.update_one({"user_id": user["user_id"]},
                                  {"$set": {"picture": data.get("picture", user.get("picture", ""))}})
    token = await create_session(user["user_id"])
    set_session_cookie(response, token)
    return public_user(user)


@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    return public_user(user)


@router.put("/profile")
async def update_profile(body: ProfileIn, request: Request):
    user = await get_current_user(request)
    email = body.email.lower().strip()
    if email != user["email"]:
        other = await db.users.find_one({"email": email})
        if other:
            raise HTTPException(status_code=400, detail="Bu e-posta başka bir hesapta kayıtlı")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"name": body.name.strip(), "email": email}})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return public_user(updated)


@router.post("/change-password")
async def change_password(body: PasswordIn, request: Request):
    user = await get_current_user(request)
    full = await db.users.find_one({"user_id": user["user_id"]})
    if not full.get("password_hash"):
        raise HTTPException(status_code=400, detail="Google ile giriş yapıyorsunuz, şifre değiştirilemez")
    if not verify_password(body.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Mevcut şifre hatalı")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Yeni şifre en az 6 karakter olmalı")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    clear_session_cookie(response)
    return {"ok": True}


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str


def _hash_token(t: str) -> str:
    return hashlib.sha256(t.encode("utf-8")).hexdigest()


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_resets.insert_one({
            "token_hash": _hash_token(token), "user_id": user["user_id"],
            "expires_at": (now_utc() + timedelta(hours=1)).isoformat(),
            "used": False, "created_at": now_utc().isoformat(),
        })
        reset_url = f"{FRONTEND_URL}/sifre-sifirla?token={token}"
        schedule_email("password_reset", email, {"name": user.get("name", ""), "reset_url": reset_url})
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Yeni şifre en az 6 karakter olmalı")
    rec = await db.password_resets.find_one({"token_hash": _hash_token(body.token), "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="Bağlantı geçersiz veya daha önce kullanılmış")
    if rec["expires_at"] < now_utc().isoformat():
        raise HTTPException(status_code=400, detail="Bağlantının süresi dolmuş. Lütfen yeni bir talep oluşturun.")
    await db.users.update_one({"user_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_resets.update_many({"user_id": rec["user_id"], "used": False}, {"$set": {"used": True}})
    return {"ok": True}
