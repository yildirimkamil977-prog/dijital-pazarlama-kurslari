from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
import httpx

from deps import (
    db, now_utc, new_id, hash_password, verify_password, create_session,
    store_external_session, set_session_cookie, clear_session_cookie,
    get_current_user, schedule_email,
)

router = APIRouter(prefix="/auth")


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
    await send_templated("welcome", email, {"name": user["name"]})
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
        schedule_email("welcome", email, {"name": user["name"]})
    else:
        await db.users.update_one({"user_id": user["user_id"]},
                                  {"$set": {"picture": data.get("picture", user.get("picture", ""))}})
    await store_external_session(user["user_id"], data["session_token"])
    set_session_cookie(response, data["session_token"])
    return public_user(user)


@router.get("/me")
async def me(request: Request):
    user = await get_current_user(request)
    return public_user(user)


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    clear_session_cookie(response)
    return {"ok": True}
